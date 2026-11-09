"use client";

import { BallotBoxConsole } from "@/components/terminal/ballot-box-console";
import { ConnectionBadge } from "@/components/terminal/connection-badge";
import { PairScreen } from "@/components/terminal/pair-screen";
import { useTerminal } from "@/components/terminal/use-terminal";

export default function UrnaPage() {
  const { ready, token, state, connection, refresh, savePairing } =
    useTerminal("ballot_box");

  if (!ready) return null;

  if (!token) {
    return (
      <PairScreen
        kind="ballot_box"
        title="Urna eletrônica"
        onPaired={savePairing}
      />
    );
  }

  const electionOpen = state?.election?.status === "open";
  const voting = state?.screen === "voting" && state.ballot && state.session;

  // Tela cheia só pode ser pedida a partir de um gesto do usuário — por isso
  // vai no toque da tela de espera, e não em um efeito ao carregar.
  function requestFullscreen() {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen().catch(() => {});
    }
  }

  return (
    <main className="flex flex-1 flex-col" onClick={requestFullscreen}>
      {voting && state.ballot && state.session ? (
        <BallotBoxConsole
          token={token}
          positions={state.ballot.positions}
          positionsCompleted={state.session.positionsCompleted}
          onFinished={refresh}
          onReload={refresh}
        />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-8 p-6 text-center">
          <p className="text-sm uppercase tracking-[0.3em] opacity-50">
            Urna eletrônica
          </p>

          {state ? (
            electionOpen ? (
              <h1 className="text-4xl font-semibold tracking-wide sm:text-5xl">
                AGUARDANDO LIBERAÇÃO
              </h1>
            ) : (
              <div>
                <h1 className="text-3xl font-semibold tracking-wide sm:text-4xl">
                  VOTAÇÃO NÃO INICIADA
                </h1>
                <p className="mt-3 text-sm opacity-60">
                  {state.election?.status === "closed"
                    ? "A eleição foi encerrada."
                    : "A eleição ainda não foi aberta pelo administrador."}
                </p>
              </div>
            )
          ) : (
            <h1 className="text-2xl opacity-60">Conectando…</h1>
          )}

          {state?.election ? (
            <p className="text-sm opacity-50">{state.election.name}</p>
          ) : null}
        </div>
      )}

      <footer className="flex items-center justify-between border-t border-white/10 px-6 py-3 text-sm">
        <span className="opacity-70">
          {state
            ? `${state.terminal.label} · Seção ${state.section?.code ?? "—"}`
            : "—"}
        </span>
        <ConnectionBadge connection={connection} />
      </footer>
    </main>
  );
}
