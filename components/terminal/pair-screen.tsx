"use client";

import { useState } from "react";

import type { TerminalKind } from "./use-terminal";

export function PairScreen({
  kind,
  title,
  onPaired,
}: {
  kind: TerminalKind;
  title: string;
  onPaired: (token: string) => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const clean = code.replace(/[^A-Za-z0-9]/g, "");
  const canSubmit = clean.length === 6 && !pending;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/terminals/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pairing_code: clean }),
      });

      const body = await response.json();

      if (!response.ok) {
        setError(body?.error?.message ?? "Não foi possível parear.");
        return;
      }

      if (body.terminal?.kind !== kind) {
        setError(
          body.terminal?.kind === "ballot_box"
            ? "Esse código é de uma urna. Abra /urna nesta máquina."
            : "Esse código é de um terminal de mesário. Abra /mesario nesta máquina.",
        );
        return;
      }

      onPaired(body.terminal_token as string);
    } catch {
      setError("Sem conexão com o servidor.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-1 mb-6 text-sm opacity-70">
          Digite o código de pareamento gerado pelo administrador. É uma vez só —
          depois esta máquina abre direto.
        </p>

        <input
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          inputMode="text"
          maxLength={7}
          placeholder="K7M-P2Q"
          aria-label="Código de pareamento"
          className="w-full rounded-md border border-black/20 bg-transparent px-4 py-3 text-center font-mono text-2xl tracking-widest outline-none focus:border-blue-500 dark:border-white/25"
        />

        {error ? (
          <p
            role="alert"
            className="mt-3 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400"
          >
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit}
          className="mt-4 w-full rounded-md bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-40"
        >
          {pending ? "Pareando…" : "Parear terminal"}
        </button>

        <p className="mt-6 text-xs opacity-50">
          O código não distingue maiúsculas e o hífen é opcional.
        </p>
      </form>
    </main>
  );
}
