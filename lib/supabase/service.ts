import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db/types";

/**
 * Cliente com service_role: IGNORA o RLS.
 *
 * Só pode ser usado dentro de Route Handlers e Server Actions, e sempre DEPOIS
 * de autorizar quem está chamando (requireAdmin, requireTerminal). Ver doc 03 §2:
 * toda regra de negócio é verificada aqui, não na interface.
 *
 * O import "server-only" faz o build falhar se este módulo for arrastado para um
 * componente cliente.
 */
let cached: ReturnType<typeof createClient<Database>> | null = null;

export function createServiceClient() {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias. " +
        "Copie .env.local.example para .env.local e preencha.",
    );
  }

  cached = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return cached;
}
