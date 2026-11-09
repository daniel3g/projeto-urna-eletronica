import Link from "next/link";

import { requireAdmin } from "@/lib/auth/admin";
import {
  ELECTION_STATUS_LABEL,
  ELECTION_STATUS_STYLE,
  formatDateTime,
} from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Eleições — Urna Eletrônica Escolar" };

export default async function AdminHome() {
  await requireAdmin();

  // Leitura com a sessão do próprio admin: quem libera é a política RLS
  // "admin le eleicoes". Se ela quebrar, esta lista vem vazia — de propósito.
  const supabase = await createClient();
  const { data: elections, error } = await supabase
    .from("elections")
    .select("id, name, status, opened_at, closed_at, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Eleições</h1>
        <Link
          href="/admin/elections/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Nova eleição
        </Link>
      </div>

      {error ? (
        <p className="rounded-md bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          Não foi possível carregar as eleições: {error.message}
        </p>
      ) : null}

      {elections && elections.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {elections.map((election) => (
            <li key={election.id}>
              <Link
                href={`/admin/elections/${election.id}`}
                className="flex items-center justify-between rounded-lg border border-black/10 px-4 py-3 hover:bg-black/[0.03] dark:border-white/15 dark:hover:bg-white/[0.04]"
              >
                <div>
                  <p className="font-medium">{election.name}</p>
                  <p className="text-xs opacity-60">
                    criada em {formatDateTime(election.created_at)}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${ELECTION_STATUS_STYLE[election.status]}`}
                >
                  {ELECTION_STATUS_LABEL[election.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : !error ? (
        <div className="rounded-lg border border-dashed border-black/15 p-8 text-center dark:border-white/20">
          <p className="font-medium">Nenhuma eleição cadastrada.</p>
          <p className="mt-1 text-sm opacity-70">
            Crie a primeira para começar a configurar cargos e candidatos.
          </p>
        </div>
      ) : null}
    </div>
  );
}
