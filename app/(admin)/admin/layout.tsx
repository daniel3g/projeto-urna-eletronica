import Link from "next/link";

import { logout } from "@/app/login/actions";
import { requireAdmin } from "@/lib/auth/admin";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const admin = await requireAdmin();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-black/10 px-6 py-3 dark:border-white/15">
        <div className="flex items-center gap-6">
          <Link href="/admin" className="font-semibold">
            Urna Eletrônica Escolar
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/admin" className="opacity-70 hover:opacity-100">
              Eleições
            </Link>
            <Link href="/admin/students" className="opacity-70 hover:opacity-100">
              Estudantes
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <span className="opacity-70">{admin.fullName}</span>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-md border border-black/15 px-3 py-1.5 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
            >
              Sair
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 p-6">{children}</main>
    </div>
  );
}
