"use client";

import { useState } from "react";

import { closeElection } from "./actions";

/**
 * Encerramento com confirmação por digitação do nome.
 *
 * Encerrar é irreversível (doc 05 §1): não existe reabrir. O atrito é
 * proposital — é a última ação antes da apuração valer.
 */
export function CloseElection({
  electionId,
  electionName,
}: {
  electionId: string;
  electionName: string;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-red-500/40 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-500/10 dark:text-red-400"
      >
        Encerrar eleição
      </button>
    );
  }

  return (
    <form
      action={closeElection}
      className="flex flex-col gap-3 rounded-lg border border-red-500/30 bg-red-500/5 p-4"
    >
      <input type="hidden" name="electionId" value={electionId} />

      <div>
        <p className="font-medium text-red-700 dark:text-red-400">
          Encerrar a eleição é irreversível.
        </p>
        <p className="mt-1 text-sm opacity-80">
          Nenhum voto poderá mais ser registrado, e não existe reabrir. Para
          confirmar, digite o nome da eleição:
        </p>
        <p className="mt-1 font-mono text-sm">{electionName}</p>
      </div>

      <input
        name="confirmName"
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        autoComplete="off"
        placeholder="Digite o nome exatamente como acima"
        className="rounded-md border border-black/15 bg-transparent px-3 py-2 outline-none focus:border-red-500 dark:border-white/20"
      />

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={typed !== electionName}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40"
        >
          Encerrar definitivamente
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setTyped("");
          }}
          className="rounded-md border border-black/15 px-4 py-2 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
