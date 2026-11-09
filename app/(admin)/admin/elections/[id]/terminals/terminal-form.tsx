"use client";

import { useActionState, useEffect, useRef } from "react";

import { createTerminal, type FormState } from "./actions";

const initialState: FormState = { error: null };

const field =
  "rounded-md border border-black/15 bg-transparent px-3 py-2 outline-none focus:border-blue-500 dark:border-white/20";

export function TerminalForm({
  electionId,
  sections,
}: {
  electionId: string;
  sections: { id: string; code: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(
    createTerminal,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !state.error) formRef.current?.reset();
  }, [pending, state]);

  if (sections.length === 0) return null;

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/15"
    >
      <input type="hidden" name="electionId" value={electionId} />

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-sm font-medium">Seção</span>
          <select name="sectionId" className={field}>
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.code} — {section.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex w-52 flex-col gap-1.5">
          <span className="text-sm font-medium">Tipo</span>
          <select name="kind" className={field} defaultValue="ballot_box">
            <option value="ballot_box">Urna</option>
            <option value="poll_worker">Terminal do mesário</option>
          </select>
        </label>

        <label className="flex w-40 flex-col gap-1.5">
          <span className="text-sm font-medium">Nome</span>
          <input name="label" required placeholder="Urna 01" className={field} />
        </label>

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? "Criando…" : "Criar terminal"}
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
    </form>
  );
}
