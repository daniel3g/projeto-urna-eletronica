"use client";

import { useCallback, useEffect, useEffectEvent, useState } from "react";

import {
  canConfirm,
  EMPTY_ENTRY,
  isComplete,
  pressBlank,
  pressCorrect,
  pressDigit,
  voteTypeFor,
  type Entry,
} from "@/lib/domain/ballot";
import { useSounds } from "@/components/terminal/use-sounds";

type Position = {
  id: string;
  name: string;
  digits: number;
  displayOrder: number;
};

type Candidate = {
  number: string;
  name: string;
  partyName: string | null;
  partyAcronym: string | null;
  photoUrl: string | null;
  deputyName: string | null;
  deputyPhotoUrl: string | null;
};

type Lookup = { found: boolean; candidate: Candidate | null };

const RETRY_MS = 2000;
const GIVE_UP_MS = 30000;

export function BallotBoxConsole({
  token,
  positions,
  positionsCompleted,
  onFinished,
  onReload,
}: {
  token: string;
  positions: Position[];
  positionsCompleted: number;
  onFinished: () => void;
  onReload: () => void;
}) {
  const [index, setIndex] = useState(positionsCompleted);
  const [entry, setEntry] = useState<Entry>(EMPTY_ENTRY);
  /** Resposta da busca, marcada com o cargo e o número a que se refere. */
  const [fetched, setFetched] = useState<{ key: string; lookup: Lookup } | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [finished, setFinished] = useState(false);

  const { playKey, playEnd } = useSounds();

  const position = positions[index];
  const total = positions.length;
  const busy = submitting || finished;

  /** Todo toque de tecla — na tela ou no teclado físico — soa antes de agir. */
  const withKeySound = useCallback(
    (action: () => void) => () => {
      playKey();
      action();
    },
    [playKey],
  );

  const authHeaders = useCallback(
    () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }),
    [token],
  );

  // Recarregar no meio da votação perderia o cargo em digitação — os já
  // confirmados estão salvos, mas o susto é desnecessário.
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, []);

  // Busca o candidato assim que o número fica completo. Só existe busca para
  // número completo; com campo vazio, incompleto ou BRANCO, a chave é nula.
  const lookupKey =
    position && !entry.blank && entry.buffer.length === position.digits
      ? `${position.id}:${entry.buffer}`
      : null;

  // Uma resposta que chegou para outra chave (o eleitor já corrigiu) não vale.
  const lookup = fetched && fetched.key === lookupKey ? fetched.lookup : null;

  useEffect(() => {
    if (!lookupKey) return;

    const [positionId, number] = lookupKey.split(":");
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(
          `/api/ballot-box/candidate?position_id=${positionId}&number=${number}`,
          { headers: authHeaders(), cache: "no-store" },
        );
        const body = (await response.json()) as Lookup;
        if (!cancelled && response.ok) setFetched({ key: lookupKey, lookup: body });
      } catch {
        // Sem rede, a urna trata como número não encontrado: o eleitor ainda
        // pode CORRIGIR, e a classificação real acontece no servidor.
        if (!cancelled) {
          setFetched({ key: lookupKey, lookup: { found: false, candidate: null } });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [lookupKey, authHeaders]);

  const confirm = useCallback(async () => {
    if (!position || busy || !canConfirm(entry, position.digits)) return;

    setSubmitting(true);
    setFailed(false);

    const payload = JSON.stringify({
      position_id: position.id,
      position_order: position.displayOrder,
      vote_type: voteTypeFor(entry),
      candidate_number: entry.blank ? null : entry.buffer,
    });

    const deadline = Date.now() + GIVE_UP_MS;

    while (Date.now() < deadline) {
      try {
        const response = await fetch("/api/ballot-box/vote", {
          method: "POST",
          headers: authHeaders(),
          body: payload,
        });

        const body = await response.json();

        if (response.ok) {
          setSubmitting(false);
          setEntry(EMPTY_ENTRY);

          if (body.finished) {
            setFinished(true);
            playEnd();
            window.setTimeout(onFinished, 3000);
          } else {
            setIndex(body.positionsCompleted as number);
          }
          return;
        }

        // Conflito de estado não se resolve repetindo: recarrega do servidor.
        if (response.status === 409) {
          setSubmitting(false);
          onReload();
          return;
        }
      } catch {
        // Rede caiu: cai no retry abaixo.
      }

      await new Promise((resolve) => window.setTimeout(resolve, RETRY_MS));
    }

    setSubmitting(false);
    setFailed(true);
  }, [position, entry, busy, authHeaders, onFinished, onReload, playEnd]);

  // Teclado físico: a urna aceita teclado numérico além dos botões na tela.
  // Effect Event: o ouvinte de teclado chama sempre o `confirm` mais recente sem
  // precisar ser registrado de novo a cada dígito.
  const confirmFromKeyboard = useEffectEvent(() => void confirm());

  useEffect(() => {
    if (!position) return;

    const onKey = (event: KeyboardEvent) => {
      // Tecla segurada dispara keydown em rajada: um toque, um som.
      if (busy || event.repeat) return;

      if (/^[0-9]$/.test(event.key)) {
        playKey();
        setEntry((current) => pressDigit(current, event.key, position.digits));
      } else if (event.key === "Backspace" || event.key === "Delete") {
        playKey();
        setEntry(pressCorrect());
      } else if (event.key === " ") {
        event.preventDefault();
        playKey();
        setEntry((current) => pressBlank(current));
      } else if (event.key === "Enter") {
        playKey();
        confirmFromKeyboard();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [position, busy, playKey]);

  if (finished) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <p className="text-7xl font-bold tracking-widest">FIM</p>
        <p className="text-xl opacity-70">Obrigado por votar!</p>
      </div>
    );
  }

  if (!position) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-xl opacity-70">Preparando…</p>
      </div>
    );
  }

  const boxes = Array.from({ length: position.digits }, (_, i) => entry.buffer[i] ?? "");
  const complete = isComplete(entry, position.digits);

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <header className="flex items-baseline justify-between border-b border-white/15 pb-3">
        <h1 className="text-3xl font-bold tracking-wide">
          {position.name.toUpperCase()}
        </h1>
        <span className="text-sm opacity-60">
          {index + 1} de {total}
        </span>
      </header>

      <div className="flex flex-1 flex-col gap-6 sm:flex-row">
        <section className="flex flex-1 flex-col gap-5">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] opacity-50">Número</p>
            <div className="mt-2 flex gap-2">
              {boxes.map((digit, i) => (
                <span
                  key={i}
                  className="flex h-16 w-12 items-center justify-center border-2 border-white/30 text-3xl font-bold tabular-nums"
                >
                  {digit}
                </span>
              ))}
            </div>
          </div>

          {entry.blank ? (
            <div>
              <p className="text-4xl font-bold tracking-wide">BRANCO</p>
              <p className="mt-2 text-sm opacity-70">
                Se confirmar, seu voto para {position.name.toUpperCase()} será EM
                BRANCO. Aperte CORRIGE para escolher um número.
              </p>
            </div>
          ) : complete && lookup ? (
            lookup.found && lookup.candidate ? (
              <div className="flex flex-col gap-1">
                <p className="text-xs uppercase tracking-[0.2em] opacity-50">Nome</p>
                <p className="text-3xl font-bold">{lookup.candidate.name}</p>
                {lookup.candidate.partyName ? (
                  <p className="text-sm opacity-70">
                    CHAPA: {lookup.candidate.partyName.toUpperCase()}
                    {lookup.candidate.partyAcronym
                      ? ` (${lookup.candidate.partyAcronym})`
                      : ""}
                  </p>
                ) : null}
                {lookup.candidate.deputyName ? (
                  <p className="mt-2 text-sm opacity-70">
                    VICE: {lookup.candidate.deputyName.toUpperCase()}
                  </p>
                ) : null}
              </div>
            ) : (
              <div>
                <p className="text-3xl font-bold text-amber-400">NÚMERO ERRADO</p>
                <p className="mt-1 text-4xl font-bold">VOTO NULO</p>
                <p className="mt-2 text-sm opacity-70">
                  Se confirmar, seu voto para {position.name.toUpperCase()} será
                  NULO. Aperte CORRIGE para digitar outro número.
                </p>
              </div>
            )
          ) : (
            <p className="text-sm opacity-50">
              Digite o número do seu candidato.
            </p>
          )}

          <div className="mt-auto border-t border-white/15 pt-3 text-sm opacity-70">
            <p>Aperte a tecla:</p>
            <p>CONFIRMA para confirmar este voto</p>
            <p>CORRIGE para digitar de novo</p>
          </div>
        </section>

        {lookup?.found && lookup.candidate ? (
          <aside className="flex shrink-0 flex-col items-center gap-3">
            {lookup.candidate.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL assinada
              <img
                src={lookup.candidate.photoUrl}
                alt=""
                className="h-48 w-48 object-cover"
              />
            ) : (
              <div className="flex h-48 w-48 items-center justify-center border border-white/20 text-sm opacity-40">
                sem foto
              </div>
            )}
            {lookup.candidate.deputyPhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL assinada
              <img
                src={lookup.candidate.deputyPhotoUrl}
                alt=""
                className="h-24 w-24 object-cover"
              />
            ) : null}
          </aside>
        ) : null}
      </div>

      {submitting ? (
        <p className="rounded bg-white/10 px-4 py-3 text-center text-lg">
          Registrando voto…
        </p>
      ) : null}

      {failed ? (
        <div className="rounded bg-red-500/20 px-4 py-3 text-center">
          <p className="text-lg font-semibold">Falha de comunicação</p>
          <p className="mt-1 text-sm opacity-80">
            Chame o mesário. Os cargos já confirmados estão salvos.
          </p>
          <button
            type="button"
            onClick={() => void confirm()}
            className="mt-3 rounded bg-white/15 px-4 py-2 font-medium hover:bg-white/25"
          >
            Tentar novamente
          </button>
        </div>
      ) : null}

      <footer className="flex flex-wrap items-end justify-between gap-6">
        <div className="grid grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
            <Key
              key={digit}
              onClick={withKeySound(() =>
                setEntry((current) => pressDigit(current, digit, position.digits)),
              )}
              disabled={busy}
            >
              {digit}
            </Key>
          ))}
          <span />
          <Key
            onClick={withKeySound(() =>
              setEntry((current) => pressDigit(current, "0", position.digits)),
            )}
            disabled={busy}
          >
            0
          </Key>
        </div>

        <div className="flex flex-col gap-2">
          <ActionKey
            onClick={withKeySound(() => setEntry((current) => pressBlank(current)))}
            disabled={busy || entry.buffer.length > 0}
            className="bg-white text-neutral-900 hover:bg-neutral-200"
          >
            BRANCO
          </ActionKey>
          <ActionKey
            onClick={withKeySound(() => setEntry(pressCorrect()))}
            disabled={busy}
            className="bg-orange-500 text-white hover:bg-orange-600"
          >
            CORRIGE
          </ActionKey>
          <ActionKey
            onClick={withKeySound(() => void confirm())}
            disabled={busy || !canConfirm(entry, position.digits)}
            className="bg-green-600 text-white hover:bg-green-700"
          >
            CONFIRMA
          </ActionKey>
        </div>
      </footer>
    </div>
  );
}

function Key({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-16 w-16 border border-white/25 text-2xl font-semibold hover:bg-white/10 disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function ActionKey({
  children,
  onClick,
  disabled,
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  className: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-14 w-40 text-lg font-bold tracking-wide disabled:opacity-30 ${className}`}
    >
      {children}
    </button>
  );
}
