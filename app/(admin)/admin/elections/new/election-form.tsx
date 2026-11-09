"use client";

import { useActionState } from "react";

import { createElection, type FormState } from "../actions";

const initialState: FormState = { error: null };

export function ElectionForm() {
  const [state, formAction, pending] = useActionState(
    createElection,
    initialState,
  );

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Nome da eleição</span>
        <input
          name="name"
          autoFocus
          required
          placeholder="Eleição do Grêmio Estudantil 2026"
          className="rounded-md border border-black/15 bg-transparent px-3 py-2 outline-none focus:border-blue-500 dark:border-white/20"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">
          Descrição <span className="font-normal opacity-60">(opcional)</span>
        </span>
        <textarea
          name="description"
          rows={3}
          className="rounded-md border border-black/15 bg-transparent px-3 py-2 outline-none focus:border-blue-500 dark:border-white/20"
        />
      </label>

      {state.error ? (
        <p
          role="alert"
          className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400"
        >
          {state.error}
        </p>
      ) : null}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? "Criando…" : "Criar eleição"}
        </button>
      </div>

      <p className="text-xs opacity-60">
        A eleição nasce em <strong>Rascunho</strong>. Cargos e candidatos só
        podem ser cadastrados nesse estado.
      </p>
    </form>
  );
}
