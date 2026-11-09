import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Renova o cookie de sessão do administrador a cada requisição.
 *
 * Server Components não podem escrever cookies; sem esta camada, a sessão
 * expiraria silenciosamente e o admin cairia no /login no meio do trabalho.
 *
 * Não faz autorização: quem decide se alguém pode ver /admin é requireAdmin()
 * em lib/auth/admin.ts. Aqui só a sessão é mantida viva.
 */
export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Não remover: é esta chamada que dispara a renovação do token.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * Tudo, menos arquivos estáticos e imagens. Os terminais (/mesario, /urna)
     * não usam cookie de sessão, mas passar por aqui não lhes custa nada.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
