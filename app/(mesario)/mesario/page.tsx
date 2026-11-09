"use client";

import { ConnectionBadge } from "@/components/terminal/connection-badge";
import { PairScreen } from "@/components/terminal/pair-screen";
import { PollWorkerConsole } from "@/components/terminal/poll-worker-console";
import { useTerminal } from "@/components/terminal/use-terminal";

export default function MesarioPage() {
  const { ready, token, state, connection, refresh, savePairing } =
    useTerminal("poll_worker");

  if (!ready) return null;

  if (!token) {
    return (
      <PairScreen
        kind="poll_worker"
        title="Terminal do mesário"
        onPaired={savePairing}
      />
    );
  }

  const electionOpen = state?.election?.status === "open";

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 px-6 py-3 text-sm dark:border-white/15">
        <span className="font-medium">
          {state?.election?.name ?? "Terminal do mesário"}
        </span>
        <div className="flex items-center gap-4">
          <span className="opacity-70">
            {state
              ? `Seção ${state.section?.code ?? "—"} · ${state.terminal.label}`
              : "—"}
          </span>
          <ConnectionBadge connection={connection} />
        </div>
      </header>

      {electionOpen ? (
        <PollWorkerConsole token={token} onChanged={refresh} />
      ) : (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-md text-center">
            <p className="text-lg font-medium">
              {state?.election?.status === "closed"
                ? "Eleição encerrada."
                : "A eleição ainda não foi aberta."}
            </p>
            <p className="mt-2 text-sm opacity-70">
              {state?.election?.status === "closed"
                ? "Nenhum eleitor pode mais ser liberado."
                : "Assim que o administrador abrir, esta tela libera a busca por RM."}
            </p>
          </div>
        </div>
      )}

      {state?.stats ? (
        <footer className="border-t border-black/10 px-6 py-3 text-sm dark:border-white/15">
          <span className="opacity-70">
            Já votaram nesta seção: <strong>{state.stats.voted}</strong> de{" "}
            {state.stats.total} · faltam {state.stats.pending}
          </span>
        </footer>
      ) : null}
    </main>
  );
}
