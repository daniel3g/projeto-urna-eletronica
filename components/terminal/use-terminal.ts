"use client";

import { useCallback, useEffect, useState } from "react";

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

export function readToken(kind: TerminalKind): string | null {
  try {
    return window.localStorage.getItem(storageKey(kind));
  } catch {
    return null;
  }
}

/** Intervalo do fallback por polling (doc 04 §5). */
const POLL_MS = 3000;

export function useTerminal(kind: TerminalKind) {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<TerminalState | null>(null);
  const [serverOk, setServerOk] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  const connection: Connection = !serverOk
    ? "offline"
    : subscribed
      ? "realtime"
      : "polling";

  useEffect(() => {
    setToken(readToken(kind));
    setReady(true);
  }, [kind]);

  const refresh = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch("/api/terminal/state", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      if (response.status === 401) {
        // Token revogado pelo admin: a máquina volta sozinha à tela de código.
        window.localStorage.removeItem(storageKey(kind));
        setToken(null);
        setState(null);
        return;
      }

      if (!response.ok) {
        setServerOk(false);
        return;
      }

      setState((await response.json()) as TerminalState);
      setServerOk(true);
    } catch {
      setServerOk(false);
    }
  }, [token, kind]);

  useEffect(() => {
    if (!token) return;

    void refresh();
    const timer = window.setInterval(() => void refresh(), POLL_MS);

    // Rede voltou ou a aba reapareceu: não espera o próximo tick.
    const immediate = () => void refresh();
    window.addEventListener("online", immediate);
    document.addEventListener("visibilitychange", immediate);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", immediate);
      document.removeEventListener("visibilitychange", immediate);
    };
  }, [token, refresh]);

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
    (newToken: string) => {
      window.localStorage.setItem(storageKey(kind), newToken);
      setToken(newToken);
    },
    [kind],
  );

  const unpair = useCallback(() => {
    window.localStorage.removeItem(storageKey(kind));
    setToken(null);
    setState(null);
    setServerOk(false);
  }, [kind]);

  return { ready, token, state, connection, refresh, savePairing, unpair };
}
