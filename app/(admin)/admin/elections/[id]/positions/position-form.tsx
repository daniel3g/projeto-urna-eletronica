"use client";

import { useActionState, useEffect, useRef } from "react";

import { createPosition, type FormState } from "./actions";

const initialState: FormState = { error: null };

export function PositionForm({ electionId }: { electionId: string }) {
  const [state, formAction, pending] = useActionState(
    createPosition,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Cadastro em sequência: limpa o formulário depois de cada cargo aceito.
  useEffect(() => {
    if (!pending && !state.error) formRef.current?.reset();
  }, [pending, state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/15"
    >
      <input type="hidden" name="electionId" value={electionId} />

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-sm font-medium">Cargo</span>
          <input
            name="name"
            required
            placeholder="Presidente"
            className="rounded-md border border-black/15 bg-transparent px-3 py-2 outline-none focus:border-blue-500 dark:border-white/20"
          />
        </label>

        <label className="flex w-28 flex-col gap-1.5">
          <span className="text-sm font-medium">Dígitos</span>
          <input
            name="digits"
            type="number"
            min={1}
            max={5}
            defaultValue={2}
            required
            className="rounded-md border border-black/15 bg-transparent px-3 py-2 outline-none focus:border-blue-500 dark:border-white/20"
          />
        </label>

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? "Adicionando…" : "Adicionar"}
        </button>
      </div>

      {state.error ? (
        <p
          role="alert"
          className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400"
        >
          {state.error}
        </p>
      ) : null}

      <p className="text-xs opacity-60">
        A quantidade de dígitos define o número dos candidatos deste cargo — e o
        banco recusa qualquer candidato fora dessa medida.
      </p>
    </form>
  );
}
