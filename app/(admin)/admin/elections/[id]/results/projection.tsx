"use client";

import { useCallback, useEffect, useState } from "react";

import type { PositionResult } from "@/lib/db/results";

/**
 * Modo de projeção: um cargo por vez, tela cheia, para divulgar o resultado no
 * auditório. Setas ou clique avançam.
 */
export function Projection({
  positions,
  electionName,
}: {
  positions: PositionResult[];
  electionName: string;
}) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const close = useCallback(() => {
    setOpen(false);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === " ") {
        event.preventDefault();
        setIndex((current) => Math.min(current + 1, positions.length - 1));
      } else if (event.key === "ArrowLeft") {
        setIndex((current) => Math.max(current - 1, 0));
      } else if (event.key === "Escape") {
        close();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, positions.length, close]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setIndex(0);
          setOpen(true);
          void document.documentElement.requestFullscreen().catch(() => {});
        }}
        disabled={positions.length === 0}
        className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium hover:bg-black/5 disabled:opacity-40 dark:border-white/20 dark:hover:bg-white/10"
      >
        Modo de projeção
      </button>
    );
  }

  const position = positions[index];
  const max = Math.max(1, ...position.candidates.map((c) => c.votes));

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-950 p-10 text-neutral-50">
      <header className="flex items-baseline justify-between">
        <p className="text-sm uppercase tracking-[0.3em] opacity-50">
          {electionName}
        </p>
        <p className="text-sm opacity-50">
          {index + 1} de {positions.length}
        </p>
      </header>

      <div className="flex flex-1 flex-col justify-center gap-8">
        <h1 className="text-5xl font-bold tracking-wide">
          {position.name.toUpperCase()}
        </h1>

        <ul className="flex flex-col gap-4">
          {position.candidates.map((candidate, rank) => (
            <li key={candidate.id} className="flex items-center gap-5">
              <span className="w-16 font-mono text-3xl opacity-60">
                {candidate.number}
              </span>
              <span className="w-72 truncate text-3xl font-semibold">
                {candidate.name}
              </span>
              <span className="h-8 flex-1 bg-white/10">
                <span
                  className={`block h-full ${rank === 0 && candidate.votes > 0 ? "bg-green-500" : "bg-white/40"}`}
                  style={{ width: `${(candidate.votes / max) * 100}%` }}
                />
              </span>
              <span className="w-32 text-right text-3xl font-bold tabular-nums">
                {candidate.votes}
              </span>
              <span className="w-24 text-right text-xl opacity-60 tabular-nums">
                {candidate.pct.toFixed(1)}%
              </span>
            </li>
          ))}
        </ul>

        <p className="text-xl opacity-60">
          Brancos {position.blankVotes} · Nulos {position.nullVotes} · Total{" "}
          {position.totalVotes}
        </p>
      </div>

      <footer className="flex items-center justify-between text-sm opacity-50">
        <span>← → para navegar · Esc para sair</span>
        <button type="button" onClick={close} className="underline">
          Sair
        </button>
      </footer>
    </div>
  );
}
