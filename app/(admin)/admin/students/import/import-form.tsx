"use client";

import Link from "next/link";
import { useActionState } from "react";

import { importStudents } from "../actions";
import { emptyImportState } from "../import-state";

export function ImportForm() {
  const [state, formAction, pending] = useActionState(
    importStudents,
    emptyImportState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Arquivo CSV</span>
        <input
          type="file"
          name="file"
          accept=".csv,text/csv"
          required
          className="rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-black/5 file:px-3 file:py-1.5 file:text-sm dark:border-white/20 dark:file:bg-white/10"
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

      {state.summary ? (
        <div className="flex flex-col gap-4 rounded-lg border border-black/10 p-4 dark:border-white/15">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Linhas" value={state.summary.total} />
            <Stat label="A criar" value={state.summary.toCreate} tone="green" />
            <Stat label="A atualizar" value={state.summary.toUpdate} tone="blue" />
            <Stat
              label="Com erro"
              value={state.summary.errors}
              tone={state.summary.errors > 0 ? "red" : undefined}
            />
          </div>

          {state.sample.length > 0 && state.phase === "preview" ? (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide opacity-60">
                Primeiras linhas
              </p>
              <ul className="flex flex-col gap-1 text-sm">
                {state.sample.map((row) => (
                  <li key={row.rm} className="flex gap-3">
                    <span className="font-mono opacity-70">{row.rm}</span>
                    <span className="flex-1">{row.fullName}</span>
                    <span className="opacity-60">{row.className ?? "—"}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {state.issues.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-red-700 dark:text-red-400">
                Linhas ignoradas
              </p>
              <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto text-sm">
                {state.issues.slice(0, 50).map((issue, index) => (
                  <li key={`${issue.line}-${index}`} className="flex gap-3">
                    <span className="w-16 shrink-0 opacity-60">
                      linha {issue.line}
                    </span>
                    <span className="font-mono opacity-70">{issue.rm || "—"}</span>
                    <span className="flex-1">{issue.message}</span>
                  </li>
                ))}
                {state.issues.length > 50 ? (
                  <li className="opacity-60">
                    … e mais {state.issues.length - 50}.
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {state.phase === "done" ? (
        <div className="rounded-md bg-green-500/10 px-4 py-3 text-sm text-green-700 dark:text-green-400">
          <p className="font-medium">Importação concluída.</p>
          <p className="mt-1">
            {state.summary?.toCreate} criados, {state.summary?.toUpdate}{" "}
            atualizados.{" "}
            <Link href="/admin/students" className="underline">
              Ver estudantes
            </Link>
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            name="commit"
            value="false"
            disabled={pending}
            className="rounded-md border border-black/15 px-4 py-2 font-medium hover:bg-black/5 disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/10"
          >
            {pending ? "Processando…" : "Analisar arquivo"}
          </button>

          {state.phase === "preview" && state.summary ? (
            <button
              type="submit"
              name="commit"
              value="true"
              disabled={pending}
              className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              Confirmar importação de{" "}
              {state.summary.toCreate + state.summary.toUpdate} estudantes
            </button>
          ) : null}
        </div>
      )}

      {state.phase === "preview" ? (
        <p className="text-xs opacity-60">
          Nada foi gravado ainda. Mantenha o arquivo selecionado e confirme para
          aplicar.
        </p>
      ) : null}
    </form>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "green" | "blue" | "red";
}) {
  const color =
    tone === "green"
      ? "text-green-700 dark:text-green-400"
      : tone === "blue"
        ? "text-blue-700 dark:text-blue-400"
        : tone === "red"
          ? "text-red-700 dark:text-red-400"
          : "";

  return (
    <div>
      <p className={`text-2xl font-semibold ${color}`}>{value}</p>
      <p className="text-xs opacity-70">{label}</p>
    </div>
  );
}
