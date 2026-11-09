import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/lib/db/types";

/**
 * Cliente com a sessão do administrador. Usa a chave anônima e RESPEITA o RLS —
 * é assim que as políticas de leitura do doc 03 §5 são exercitadas de verdade.
 *
 * Para escrever, use createServiceClient() em lib/supabase/service.ts.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components não podem escrever cookies. O middleware já
            // renovou a sessão antes de chegar aqui, então ignorar é correto.
          }
        },
      },
    },
  );
}
