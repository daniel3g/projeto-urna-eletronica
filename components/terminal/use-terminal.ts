"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import { getRealtimeClient } from "@/lib/supabase/realtime-client";

export type TerminalKind = "ballot_box" | "poll_worker";

export type TerminalState = {
  screen: string;
  terminal: { id: string; kind: TerminalKind; label: string };
  election: { id: string; name: string; status: string } | null;
  section: { id: string; code: string; name: string } | null;
  /** Só vem para o terminal do mesário. */
  stats: { total: number; voted: number; pending: number } | null;
  /** Só vem para a urna, e só quando há eleitor liberado. */
  session: { positionsCompleted: number } | null;
  ballot: {
    positions: { id: string; name: string; digits: number; displayOrder: number }[];
  } | null;
  realtime: { topic: string };
};

/**
 * `realtime` = WebSocket ativo. `polling` = só o fallback de 3 s respondendo.
 * `offline` = o servidor não está respondendo. Ver doc 04 §5.
 */
export type Connection = "realtime" | "polling" | "offline";

/** Chave por tipo: a mesma máquina pode ser usada como urna e como mesário em ensaios. */
export function storageKey(kind: TerminalKind) {
  return `urna.terminal_token.${kind}`;
}

// --- Token do terminal -------------------------------------------------------
//
// O token mora no localStorage, que o React não enxerga. Em vez de copiá-lo para
// um estado num efeito, o hook assina este pequeno store: a leitura é sempre a
// do armazenamento, e quem grava avisa os assinantes.

/** Reserva para navegadores que recusam localStorage (janela anônima restrita). */
const memoryTokens = new Map<TerminalKind, string>();
const listeners = new Set<() => void>();

export function readToken(kind: TerminalKind): string | null {
  try {
    return window.localStorage.getItem(storageKey(kind));
  } catch {
    return memoryTokens.get(kind) ?? null;
  }
}

function writeToken(kind: TerminalKind, token: string | null) {
  if (token) memoryTokens.set(kind, token);
  else memoryTokens.delete(kind);

  try {
    if (token) window.localStorage.setItem(storageKey(kind), token);
    else window.localStorage.removeItem(storageKey(kind));
  } catch {
    // Fica só na memória: vale até a aba fechar.
  }

  for (const listener of listeners) listener();
}

function subscribeToken(listener: () => void) {
  listeners.add(listener);
  // Outra aba pareou ou despareou a mesma máquina.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/**
 * No servidor e na hidratação o token é desconhecido (`undefined`), não ausente
 * (`null`): a página espera o navegador antes de decidir entre parear e operar.
 */
const UNKNOWN_TOKEN = () => undefined;

// --- Estado do terminal ------------------------------------------------------

/** Intervalo do fallback por polling (doc 04 §5). */
const POLL_MS = 3000;

type Fetched =
  | { kind: "ok"; state: TerminalState }
  | { kind: "revoked" }
  | { kind: "unavailable" };

/** Só busca — não toca em estado do React. */
async function fetchTerminalState(token: string): Promise<Fetched> {
  try {
    const response = await fetch("/api/terminal/state", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (response.status === 401) return { kind: "revoked" };
    if (!response.ok) return { kind: "unavailable" };

    return { kind: "ok", state: (await response.json()) as TerminalState };
  } catch {
    return { kind: "unavailable" };
  }
}

export function useTerminal(kind: TerminalKind) {
  const getToken = useCallback(() => readToken(kind), [kind]);
  const token = useSyncExternalStore(subscribeToken, getToken, UNKNOWN_TOKEN);
  const ready = token !== undefined;

  const [state, setState] = useState<TerminalState | null>(null);
  const [serverOk, setServerOk] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  const connection: Connection = !serverOk
    ? "offline"
    : subscribed
      ? "realtime"
      : "polling";

  const apply = useCallback(
    (fetched: Fetched) => {
      if (fetched.kind === "revoked") {
        // Token revogado pelo admin: a máquina volta sozinha à tela de código.
        writeToken(kind, null);
        setState(null);
        return;
      }

      if (fetched.kind === "unavailable") {
        setServerOk(false);
        return;
      }

      setState(fetched.state);
      setServerOk(true);
    },
    [kind],
  );

  const refresh = useCallback(async () => {
    if (!token) return;
    apply(await fetchTerminalState(token));
  }, [token, apply]);

  useEffect(() => {
    if (!token) return;

    // O estado só muda no retorno da requisição, nunca no corpo do efeito.
    const tick = () => {
      void fetchTerminalState(token).then(apply);
    };

    tick();
    const timer = window.setInterval(tick, POLL_MS);

    // Rede voltou ou a aba reapareceu: não espera o próximo tick.
    window.addEventListener("online", tick);
    document.addEventListener("visibilitychange", tick);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [token, apply]);

  // Canal de broadcast. Só entra em cena depois que o estado revelou o tópico,
  // e é otimização: se nada aqui funcionar, o polling acima entrega o mesmo
  // resultado com até 3 s de atraso.
  const topic = state?.realtime?.topic;

  useEffect(() => {
    if (!topic) return;

    const client = getRealtimeClient();
    if (!client) return;

    const channel = client
      .channel(topic)
      .on("broadcast", { event: "state_changed" }, () => void refresh())
      .subscribe((status) => {
        setSubscribed(status === "SUBSCRIBED");
      });

    return () => {
      setSubscribed(false);
      void client.removeChannel(channel);
    };
  }, [topic, refresh]);

  const savePairing = useCallback(
    (newToken: string) => writeToken(kind, newToken),
    [kind],
  );

  const unpair = useCallback(() => {
    writeToken(kind, null);
    setState(null);
    setServerOk(false);
  }, [kind]);

  return {
    ready,
    token: token ?? null,
    state,
    connection,
    refresh,
    savePairing,
    unpair,
  };
}
