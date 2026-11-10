"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import type { PositionResult } from "@/lib/db/results";

/**
 * Apuração encenada: um cargo por vez, os votos "chegando" até 100%.
 *
 * A ORDEM DA CONTAGEM É SIMULADA. Os totais finais vêm da apuração oficial;
 * aqui eles viram uma pilha de cédulas embaralhada no navegador e contada em
 * lotes. Não existe — nem pode existir — ordem real de votação: `votes` não
 * guarda horário preciso nem sequência, por sigilo (docs/03 §3). O ponto de
 * chegada é sempre idêntico ao resultado oficial.
 */

/** Duração da contagem de um cargo em 1x, independente do número de votos. */
const DURATION_MS = 180_000;
const ROW_PX = 72;
const SPEEDS = [1, 2, 4] as const;

const BLANK = "__blank";
const NULL = "__null";

type Run = {
  index: number;
  order: string[];
  counted: number;
  playing: boolean;
};

function shuffledBallots(position: PositionResult): string[] {
  const ballots: string[] = [];
  for (const candidate of position.candidates) {
    for (let i = 0; i < candidate.votes; i++) ballots.push(candidate.id);
  }
  for (let i = 0; i < position.blankVotes; i++) ballots.push(BLANK);
  for (let i = 0; i < position.nullVotes; i++) ballots.push(NULL);

  // Fisher–Yates.
  for (let i = ballots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ballots[i], ballots[j]] = [ballots[j], ballots[i]];
  }
  return ballots;
}

/**
 * Próximo lote: tamanho irregular, como urnas chegando, e espera proporcional
 * ao tamanho — assim o total fica em DURATION_MS / speed seja qual for o sorteio.
 * Com ~100 votos são lotes de 1–2 cédulas a cada ~2–4 s.
 */
function nextBatch(total: number, speed: number): { size: number; delay: number } {
  const typical = Math.max(1, Math.round(total / 100));
  const size = 1 + Math.floor(Math.random() * typical * 2);
  return { size, delay: (DURATION_MS / speed) * (size / total) };
}

function freshRun(positions: PositionResult[], index: number): Run {
  return { index, order: shuffledBallots(positions[index]), counted: 0, playing: false };
}

export function LiveCount({
  positions,
  electionName,
}: {
  positions: PositionResult[];
  electionName: string;
}) {
  const [run, setRun] = useState<Run | null>(null);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);

  const playing = run?.playing ?? false;

  const close = useCallback(() => {
    setRun(null);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  }, []);

  const goTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= positions.length) return;
      setRun(freshRun(positions, index));
    },
    [positions],
  );

  const togglePlay = useCallback(() => {
    setRun((current) => {
      if (!current) return current;
      const done = current.counted >= current.order.length;
      // Terminado: Espaço recomeça a contagem do cargo.
      if (done) return { ...freshRun(positions, current.index), playing: true };
      return { ...current, playing: !current.playing };
    });
  }, [positions]);

  const skipToEnd = useCallback(() => {
    setRun((current) =>
      current ? { ...current, counted: current.order.length, playing: false } : current,
    );
  }, []);

  // Relógio da contagem: um lote por vez, cada um agendando o seguinte.
  const runCounted = run?.counted ?? 0;
  const runTotal = run?.order.length ?? 0;
  useEffect(() => {
    if (!playing || runTotal === 0) return;
    const { size, delay } = nextBatch(runTotal, speed);
    const id = window.setTimeout(() => {
      setRun((current) => {
        if (!current) return current;
        const counted = Math.min(current.order.length, current.counted + size);
        return { ...current, counted, playing: counted < current.order.length };
      });
    }, delay);
    return () => window.clearTimeout(id);
  }, [playing, speed, runCounted, runTotal]);

  // Teclado.
  const open = run !== null;
  const index = run?.index ?? 0;
  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === " ") {
        event.preventDefault();
        togglePlay();
      } else if (event.key === "ArrowRight") {
        goTo(index + 1);
      } else if (event.key === "ArrowLeft") {
        goTo(index - 1);
      } else if (event.key === "End") {
        skipToEnd();
      } else if (event.key === "Escape") {
        close();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, index, togglePlay, goTo, skipToEnd, close]);

  const tally = useMemo(() => {
    const counts = new Map<string, number>();
    if (!run) return counts;
    for (let i = 0; i < run.counted; i++) {
      const key = run.order[i];
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [run]);

  if (!run) {
    return (
      <button
        type="button"
        onClick={() => {
          setRun(freshRun(positions, 0));
          void document.documentElement.requestFullscreen().catch(() => {});
        }}
        disabled={positions.length === 0}
        className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-40"
      >
        Assistir à apuração
      </button>
    );
  }

  const position = positions[run.index];
  const total = run.order.length;
  const counted = run.counted;
  const done = counted >= total;
  const progress = total > 0 ? (counted / total) * 100 : 100;

  const ranked = position.candidates
    .map((candidate) => ({ ...candidate, live: tally.get(candidate.id) ?? 0 }))
    .sort((a, b) => b.live - a.live || a.number.localeCompare(b.number));
  const rankOf = new Map(ranked.map((candidate, rank) => [candidate.id, rank]));

  const top = ranked[0]?.live ?? 0;
  const tiedAtTop = ranked.filter((candidate) => candidate.live === top).length > 1;
  const hasWinner = done && top > 0 && !tiedAtTop;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-950 p-10 text-neutral-50">
      <header className="flex items-baseline justify-between">
        <p className="text-sm uppercase tracking-[0.3em] opacity-50">{electionName}</p>
        <p className="text-sm opacity-50">
          Cargo {run.index + 1} de {positions.length}
        </p>
      </header>

      <div className="flex flex-1 flex-col justify-center gap-8">
        <h1 className="text-5xl font-bold tracking-wide">{position.name.toUpperCase()}</h1>

        <div>
          <div className="flex items-baseline justify-between">
            <p className="text-2xl font-semibold tabular-nums">
              {progress.toFixed(1)}% apurado
            </p>
            <p className="text-lg opacity-60 tabular-nums">
              {counted} de {total} votos
            </p>
          </div>
          <div className="mt-2 h-3 bg-white/10">
            <div
              className="h-full bg-sky-400 transition-[width] duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {position.candidates.length === 0 ? (
          <p className="text-2xl opacity-60">Nenhum candidato cadastrado.</p>
        ) : (
          <ul className="relative" style={{ height: ranked.length * ROW_PX }}>
            {/* Ordem estável no DOM; a posição vem do ranking, para a troca de
                lugar ser animada em vez de os itens "pularem". */}
            {position.candidates.map((candidate) => {
              const rank = rankOf.get(candidate.id) ?? 0;
              const live = tally.get(candidate.id) ?? 0;
              const pct = counted > 0 ? (live / counted) * 100 : 0;
              const winner = hasWinner && rank === 0;
              const leading = !done && rank === 0 && live > 0 && !tiedAtTop;

              return (
                <li
                  key={candidate.id}
                  className="absolute inset-x-0 flex items-center gap-5 transition-[top] duration-700 ease-out"
                  style={{ top: rank * ROW_PX, height: ROW_PX }}
                >
                  <span className="w-16 font-mono text-3xl opacity-60">{candidate.number}</span>
                  <span className="w-72 truncate text-3xl font-semibold">{candidate.name}</span>
                  <span className="h-8 flex-1 bg-white/10">
                    <span
                      className={`block h-full transition-[width] duration-500 ease-out ${
                        winner ? "bg-green-500" : leading ? "bg-white/80" : "bg-white/40"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                  <span className="w-32 text-right text-3xl font-bold tabular-nums">{live}</span>
                  <span className="w-24 text-right text-xl opacity-60 tabular-nums">
                    {pct.toFixed(1)}%
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <p className="text-xl opacity-60 tabular-nums">
          Brancos {tally.get(BLANK) ?? 0} · Nulos {tally.get(NULL) ?? 0}
        </p>

        <p className="h-10 text-3xl font-bold">
          {total === 0 ? (
            <span className="opacity-60">Nenhum voto neste cargo.</span>
          ) : done ? (
            hasWinner ? (
              <span className="text-green-400">
                Apuração concluída · mais votado: {ranked[0].name}
              </span>
            ) : top > 0 ? (
              <span className="text-amber-400">Apuração concluída · empate no primeiro lugar</span>
            ) : (
              <span className="opacity-60">Apuração concluída.</span>
            )
          ) : counted === 0 && !run.playing ? (
            <span className="opacity-60">Pressione Espaço para iniciar a apuração</span>
          ) : null}
        </p>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <ControlButton onClick={() => goTo(run.index - 1)} disabled={run.index === 0}>
            ← Anterior
          </ControlButton>
          <ControlButton onClick={togglePlay} disabled={total === 0}>
            {done ? "Recomeçar" : run.playing ? "Pausar" : counted === 0 ? "Iniciar" : "Continuar"}
          </ControlButton>
          <ControlButton onClick={skipToEnd} disabled={done}>
            Pular para o fim
          </ControlButton>
          <ControlButton
            onClick={() => goTo(run.index + 1)}
            disabled={run.index === positions.length - 1}
          >
            Próximo cargo →
          </ControlButton>
          <span className="ml-2 flex items-center gap-1 opacity-70">
            Velocidade
            {SPEEDS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setSpeed(value)}
                className={`rounded px-2 py-1 ${
                  speed === value ? "bg-white/20 font-semibold" : "hover:bg-white/10"
                }`}
              >
                {value}x
              </button>
            ))}
          </span>
        </div>

        <div className="flex items-center gap-4 opacity-50">
          <span>Espaço iniciar/pausar · End pular · ← → cargos · Esc sair</span>
          <button type="button" onClick={close} className="underline">
            Sair
          </button>
        </div>
      </footer>

      <p className="mt-3 text-xs opacity-30">
        A ordem de contagem é simulada; o resultado final é o oficial.
      </p>
    </div>
  );
}

function ControlButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border border-white/20 px-3 py-1.5 font-medium hover:bg-white/10 disabled:opacity-30"
    >
      {children}
    </button>
  );
}
