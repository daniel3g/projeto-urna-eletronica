"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { Desk } from "@/components/terminal/use-terminal";

type BallotBox = { id: string; label: string; busy: boolean };

type VoterCard = {
  student: {
    id: string;
    rm: string;
    fullName: string;
    className: string | null;
    photoUrl: string | null;
  };
  section: { id: string; code: string; name: string } | null;
  voterStatus: "waiting" | "released" | "voting" | "voted" | null;
  canRelease: boolean;
  blockedReason: string | null;
  releasedBallotBox: { id: string; label: string } | null;
  otherSection: boolean;
};

const STATUS_STYLE: Record<string, string> = {
  waiting: "bg-green-500/15 text-green-700 dark:text-green-400",
  released: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  voting: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  voted: "bg-black/10 opacity-60 dark:bg-white/10",
};

const STATUS_LABEL: Record<string, string> = {
  waiting: "AGUARDANDO VOTAÇÃO",
  released: "LIBERADO",
  voting: "EM VOTAÇÃO",
  voted: "JÁ VOTOU",
};

export function PollWorkerConsole({
  token,
  desk,
  onChanged,
}: {
  token: string;
  desk: Desk | null;
  onChanged: () => Promise<void> | void;
}) {
  const [term, setTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [cards, setCards] = useState<VoterCard[] | null>(null);
  const [ballotBoxes, setBallotBoxes] = useState<BallotBox[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const sessions = desk?.sessions ?? [];
  // Com todas as urnas da seção ocupadas não há para onde mandar o próximo
  // eleitor: a busca some até alguma urna terminar.
  const allBusy =
    !!desk && desk.ballotBoxes.length > 0 && desk.ballotBoxes.every((box) => box.busy);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // O campo volta (e ganha foco) quando uma urna fica livre — o mesário digita
  // o próximo RM sem tocar no mouse.
  useEffect(() => {
    if (!allBusy) focusInput();
  }, [allBusy, focusInput]);

  const authHeaders = useCallback(
    () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }),
    [token],
  );

  async function lookup(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);

    try {
      // RM primeiro — é o caminho de todo dia. Só cai para busca por nome
      // quando o RM não existe, o que evita uma requisição na maioria dos casos.
      const byRm = !trimmed.includes(" ");
      let response = await fetch(
        `/api/poll-worker/lookup?${byRm ? "rm" : "q"}=${encodeURIComponent(trimmed)}`,
        { headers: authHeaders(), cache: "no-store" },
      );
      let body = await response.json();

      if (response.ok && byRm && body.results.length === 0 && trimmed.length >= 2) {
        response = await fetch(
          `/api/poll-worker/lookup?q=${encodeURIComponent(trimmed)}`,
          { headers: authHeaders(), cache: "no-store" },
        );
        body = await response.json();
      }

      if (!response.ok) {
        setError(body?.error?.message ?? "Falha na consulta.");
        setCards(null);
        return;
      }

      setBallotBoxes(body.available_ballot_boxes ?? []);
      setCards(body.results as VoterCard[]);

      const free = (body.available_ballot_boxes as BallotBox[]).find(
        (box) => !box.busy,
      );
      setSelected(free?.id ?? "");

      if (body.results.length === 0) {
        setError(`Nenhum eleitor encontrado para "${trimmed}".`);
      }
    } catch {
      setError("Sem conexão com o servidor.");
      setCards(null);
    } finally {
      setLoading(false);
    }
  }

  async function release(card: VoterCard) {
    if (!selected) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/poll-worker/release", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          student_id: card.student.id,
          ballot_box_terminal_id: selected,
        }),
      });

      const body = await response.json();

      if (!response.ok) {
        setError(body?.error?.message ?? "Falha ao liberar.");
        await lookup(term);
        return;
      }

      setCards(null);
      setTerm("");
      // Espera a mesa atualizada: assim o painel "liberado na Urna 01" já está
      // na tela quando o botão destrava, sem piscar o campo de busca no meio.
      await onChanged();
      focusInput();
    } catch {
      setError("Sem conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  }

  async function cancel(studentId: string) {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/poll-worker/cancel", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ student_id: studentId }),
      });

      const body = await response.json();
      if (!response.ok) setError(body?.error?.message ?? "Falha ao cancelar.");

      await onChanged();
      if (cards) await lookup(term);
    } catch {
      setError("Sem conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 p-6">
      {sessions.map((session) => (
        <section
          key={session.ballotBox.id}
          aria-live="polite"
          className={`flex flex-wrap items-center gap-4 rounded-lg px-5 py-4 ${
            session.status === "voting"
              ? "bg-blue-500/15 text-blue-800 dark:text-blue-300"
              : "bg-amber-500/15 text-amber-800 dark:text-amber-300"
          }`}
        >
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-widest opacity-80">
              {session.ballotBox.label}
            </p>
            <p className="text-xl font-semibold">
              {session.status === "voting"
                ? "Eleitor votando"
                : `Encaminhe para a ${session.ballotBox.label}`}
            </p>
            <p className="text-sm opacity-80">
              {session.student.fullName} · RM {session.student.rm}
            </p>
          </div>

          {/* Depois do primeiro voto o eleitor está diante da urna: cancelar
              passa a ser ação do administrador (doc 05 §6). */}
          {session.status === "released" ? (
            <button
              type="button"
              onClick={() => void cancel(session.student.id)}
              disabled={loading}
              className="rounded-md border border-current/30 px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-40 dark:hover:bg-white/10"
            >
              Cancelar liberação
            </button>
          ) : null}
        </section>
      ))}

      {allBusy ? (
        <p className="text-center text-sm opacity-70">
          {desk && desk.ballotBoxes.length === 1
            ? "Aguarde o eleitor terminar de votar para liberar o próximo."
            : "Todas as urnas estão ocupadas. Aguarde uma delas terminar."}
        </p>
      ) : (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void lookup(term);
        }}
        className="flex flex-col gap-2"
      >
        <label htmlFor="rm" className="text-sm font-medium uppercase tracking-wide opacity-70">
          RM do eleitor
        </label>
        <div className="flex gap-2">
          <input
            id="rm"
            ref={inputRef}
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="12345"
            className="flex-1 rounded-md border border-black/20 bg-transparent px-4 py-3 font-mono text-xl outline-none focus:border-blue-500 dark:border-white/25"
          />
          <button
            type="submit"
            disabled={loading || !term.trim()}
            className="rounded-md bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-40"
          >
            Buscar
          </button>
        </div>
        <p className="text-xs opacity-50">
          Não sabe o RM? Digite parte do nome e busque.
        </p>
      </form>
      )}

      {error ? (
        <p
          role="alert"
          className="rounded-md bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400"
        >
          {error}
        </p>
      ) : null}

      {cards?.map((card) => (
        <article
          key={card.student.id}
          className="flex flex-col gap-4 rounded-lg border border-black/10 p-4 dark:border-white/15"
        >
          <div className="flex items-center gap-4">
            {card.student.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL assinada
              <img
                src={card.student.photoUrl}
                alt={`Foto de ${card.student.fullName}`}
                className="h-24 w-24 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <span
                aria-hidden
                className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg bg-black/5 text-2xl font-medium opacity-50 dark:bg-white/10"
              >
                {card.student.fullName
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase())
                  .join("")}
              </span>
            )}

            <div className="flex-1">
              <p className="text-xl font-semibold">{card.student.fullName}</p>
              <p className="text-sm opacity-70">
                RM {card.student.rm}
                {card.student.className ? ` · ${card.student.className}` : ""}
              </p>
              {card.section ? (
                <p className="text-sm opacity-70">
                  Seção {card.section.code} — {card.section.name}
                </p>
              ) : (
                <p className="text-sm opacity-70">Sem seção definida</p>
              )}

              <span
                className={`mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
                  STATUS_STYLE[card.voterStatus ?? "voted"]
                }`}
              >
                {card.voterStatus
                  ? STATUS_LABEL[card.voterStatus]
                  : "FORA DESTA ELEIÇÃO"}
              </span>
            </div>
          </div>

          {card.otherSection ? (
            <p className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
              Este eleitor pertence a outra seção. Você ainda pode liberá-lo aqui.
            </p>
          ) : null}

          {card.canRelease ? (
            <>
              {ballotBoxes.length === 0 ? (
                <p className="text-sm text-red-700 dark:text-red-400">
                  Nenhuma urna pareada nesta seção.
                </p>
              ) : (
                <fieldset className="flex flex-wrap items-center gap-3">
                  <legend className="mb-1 text-sm font-medium">Urna</legend>
                  {ballotBoxes.map((box) => (
                    <label
                      key={box.id}
                      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                        box.busy
                          ? "border-black/10 opacity-40 dark:border-white/15"
                          : "cursor-pointer border-black/20 dark:border-white/25"
                      }`}
                    >
                      <input
                        type="radio"
                        name="ballotBox"
                        value={box.id}
                        disabled={box.busy}
                        checked={selected === box.id}
                        onChange={() => setSelected(box.id)}
                      />
                      {box.label}
                      {box.busy ? (
                        <span className="opacity-60">— em votação</span>
                      ) : null}
                    </label>
                  ))}
                </fieldset>
              )}

              <button
                type="button"
                onClick={() => void release(card)}
                disabled={loading || !selected}
                className="rounded-md bg-green-600 px-5 py-3 text-lg font-semibold text-white hover:bg-green-700 disabled:opacity-40"
              >
                Liberar eleitor
              </button>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <p className="flex-1 text-sm font-medium">{card.blockedReason}</p>
              {card.voterStatus === "released" ? (
                <button
                  type="button"
                  onClick={() => void cancel(card.student.id)}
                  disabled={loading}
                  className="rounded-md border border-black/15 px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-40 dark:border-white/20 dark:hover:bg-white/10"
                >
                  Cancelar liberação
                </button>
              ) : null}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
