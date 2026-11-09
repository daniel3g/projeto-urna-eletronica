"use client";

import { useActionState, useEffect, useRef } from "react";

import { createStudent, type FormState } from "./actions";

const initialState: FormState = { error: null };

const field =
  "rounded-md border border-black/15 bg-transparent px-3 py-2 outline-none focus:border-blue-500 dark:border-white/20";

export function StudentForm() {
  const [state, formAction, pending] = useActionState(
    createStudent,
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
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex w-32 flex-col gap-1.5">
          <span className="text-sm font-medium">RM</span>
          <input
            name="rm"
            required
            maxLength={20}
            placeholder="12345"
            className={`${field} font-mono`}
          />
        </label>

        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-sm font-medium">Nome</span>
          <input name="fullName" required placeholder="Ana Silva" className={field} />
        </label>

        <label className="flex w-40 flex-col gap-1.5">
          <span className="text-sm font-medium">
            Turma <span className="font-normal opacity-60">(opcional)</span>
          </span>
          <input name="className" placeholder="1º INFO" className={field} />
        </label>

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? "Salvando…" : "Adicionar"}
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
