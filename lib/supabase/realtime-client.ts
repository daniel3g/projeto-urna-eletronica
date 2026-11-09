"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente usado só para escutar broadcast nos terminais.
 *
 * Sem sessão e sem persistência: o terminal não tem usuário no Supabase Auth —
 * ele se identifica no NOSSO servidor, pelo token de terminal. Aqui a chave
 * anônima serve apenas para abrir o WebSocket.
 */
let cached: SupabaseClient | null = null;

export function getRealtimeClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;
  if (cached) return cached;

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 5 } },
  });

  return cached;
}
