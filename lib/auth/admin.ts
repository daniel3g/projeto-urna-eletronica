import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type AdminSession = {
  userId: string;
  email: string | null;
  fullName: string;
};

/**
 * Devolve o administrador logado, ou null. Usa a sessão do próprio usuário, de
 * modo que a política "usuario le proprio perfil" é quem libera a leitura —
 * um usuário sem perfil, inativo, ou com role 'operator' não passa.
 */
export async function getCurrentAdmin(): Promise<AdminSession | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin" || !profile.is_active) return null;

  return { userId: user.id, email: user.email ?? null, fullName: profile.full_name };
}

/** Igual ao acima, mas redireciona para /login em vez de devolver null. */
export async function requireAdmin(): Promise<AdminSession> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");
  return admin;
}
