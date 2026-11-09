import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/lib/auth/admin";

import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar — Urna Eletrônica Escolar" };

export default async function LoginPage() {
  if (await getCurrentAdmin()) redirect("/admin");

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold">Painel administrativo</h1>
        <p className="mt-1 mb-6 text-sm opacity-70">
          Acesso restrito aos organizadores da eleição.
        </p>

        <LoginForm />

        <p className="mt-6 text-xs opacity-60">
          Mesários e urnas não fazem login: são pareados por token pelo
          administrador.
        </p>
      </div>
    </main>
  );
}
