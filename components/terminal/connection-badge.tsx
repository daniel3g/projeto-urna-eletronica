"use client";

import type { Connection } from "./use-terminal";

/**
 * Indicador discreto de conexão (doc 04 §5).
 *
 * Âmbar não é falha: significa que o WebSocket caiu e o polling de 3 s assumiu.
 * A liberação continua chegando, só com um pouco mais de atraso.
 */
export function ConnectionBadge({ connection }: { connection: Connection }) {
  const map = {
    realtime: { symbol: "●", label: "tempo real", className: "text-green-500" },
    polling: { symbol: "◐", label: "verificando", className: "text-amber-500" },
    offline: { symbol: "○", label: "sem conexão", className: "text-red-500" },
  } as const;

  const current = map[connection];

  return (
    <span className="flex items-center gap-1.5 text-xs opacity-70">
      <span aria-hidden className={current.className}>
        {current.symbol}
      </span>
      {current.label}
    </span>
  );
}
