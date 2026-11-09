"use client";

import { useActionState } from "react";

import { login, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">E-mail</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          autoFocus
          required
          className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 outline-none focus:border-blue-500"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Senha</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 outline-none focus:border-blue-500"
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

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
