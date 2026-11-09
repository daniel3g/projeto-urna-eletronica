"use client";

import { useActionState, useEffect, useRef } from "react";

import { createSection, type FormState } from "./actions";

const initialState: FormState = { error: null };

const field =
  "rounded-md border border-black/15 bg-transparent px-3 py-2 outline-none focus:border-blue-500 dark:border-white/20";

export function SectionForm({ electionId }: { electionId: string }) {
  const [state, formAction, pending] = useActionState(
    createSection,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

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
        <label className="flex w-28 flex-col gap-1.5">
          <span className="text-sm font-medium">Código</span>
          <input
            name="code"
            required
            maxLength={10}
            placeholder="01"
            className={`${field} font-mono`}
          />
        </label>

        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-sm font-medium">Local</span>
          <input
            name="name"
            required
            placeholder="Laboratório de Informática"
            className={field}
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
        Cada seção comporta um terminal de mesário e uma ou mais urnas. Com várias
        seções, a votação acontece em paralelo.
      </p>
    </form>
  );
}
