import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth/admin";
import { loadReadinessInput } from "@/lib/db/readiness";
import { loadProgress } from "@/lib/db/results";
import { evaluateReadiness } from "@/lib/domain/readiness";
import {
  ELECTION_STATUS_LABEL,
  ELECTION_STATUS_STYLE,
  formatDateTime,
} from "@/lib/format";
import { createServiceClient } from "@/lib/supabase/service";

import { openElection } from "./actions";
import { CloseElection } from "./close-election";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
};

export default async function ElectionPage({ params, searchParams }: Props) {
  await requireAdmin();
  const { id } = await params;
  const { erro } = await searchParams;

  // Contagens vêm pelo service client: election_voters e terminals não possuem
  // política de leitura nenhuma (doc 03 §5), então nem o admin logado os enxerga
  // pela chave anônima. Só o servidor acessa.
  const db = createServiceClient();

  const { data: election } = await db
    .from("elections")
    .select("id, name, description, status, opened_at, closed_at")
    .eq("id", id)
    .maybeSingle();

  if (!election) notFound();

  const countFor = async (
    table: "positions" | "candidates" | "sections" | "terminals" | "election_voters",
  ) => {
    const { count } = await db
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("election_id", id);
    return count ?? 0;
  };

  const [positions, candidates, sections, terminals, voters, readiness, progress] =
    await Promise.all([
      countFor("positions"),
      countFor("candidates"),
      countFor("sections"),
      countFor("terminals"),
      countFor("election_voters"),
      loadReadinessInput(id).then(evaluateReadiness),
      loadProgress(id),
    ]);

  const cards = [
    { label: "Cargos", value: positions, href: `/admin/elections/${id}/positions` },
    { label: "Candidatos", value: candidates, href: `/admin/elections/${id}/candidates` },
    { label: "Seções", value: sections, href: `/admin/elections/${id}/sections` },
    { label: "Terminais", value: terminals, href: `/admin/elections/${id}/terminals` },
    { label: "Eleitores", value: voters, href: `/admin/elections/${id}/voters` },
  ];

  const isDraft = election.status === "draft";
  const isOpen = election.status === "open";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin" className="text-sm opacity-60 hover:opacity-100">
          ← Eleições
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{election.name}</h1>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${ELECTION_STATUS_STYLE[election.status]}`}
          >
            {ELECTION_STATUS_LABEL[election.status]}
          </span>
        </div>
        {election.description ? (
          <p className="mt-1 text-sm opacity-70">{election.description}</p>
        ) : null}
        {election.opened_at ? (
          <p className="mt-1 text-xs opacity-60">
            aberta em {formatDateTime(election.opened_at)}
            {election.closed_at
              ? ` · encerrada em ${formatDateTime(election.closed_at)}`
              : null}
          </p>
        ) : null}
      </div>

      {erro ? (
        <p
          role="alert"
          className="rounded-md bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400"
        >
          {erro}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map((card) =>
          card.href ? (
            <Link
              key={card.label}
              href={card.href}
              className="rounded-lg border border-black/10 p-4 hover:bg-black/[0.03] dark:border-white/15 dark:hover:bg-white/[0.04]"
            >
              <p className="text-2xl font-semibold">{card.value}</p>
              <p className="text-sm opacity-70">{card.label}</p>
            </Link>
          ) : (
            <div
              key={card.label}
              className="rounded-lg border border-dashed border-black/10 p-4 opacity-50 dark:border-white/15"
            >
              <p className="text-2xl font-semibold">{card.value}</p>
              <p className="text-sm">{card.label}</p>
              <p className="mt-1 text-xs">em breve</p>
            </div>
          ),
        )}
      </div>

      {isDraft ? (
        <section className="flex flex-col gap-4 rounded-lg border border-black/10 p-4 dark:border-white/15">
          <div>
            <h2 className="font-medium">Pronta para abrir?</h2>
            <p className="mt-1 text-sm opacity-70">
              Conferido no servidor no momento do clique — não basta a tela estar
              verde.
            </p>
          </div>

          <ul className="flex flex-col gap-2">
            {readiness.checks.map((check) => (
              <li key={check.id} className="flex items-start gap-3 text-sm">
                <span
                  aria-hidden
                  className={
                    check.ok
                      ? "text-green-600 dark:text-green-400"
                      : check.blocking
                        ? "text-red-600 dark:text-red-400"
                        : "text-amber-600 dark:text-amber-400"
                  }
                >
                  {check.ok ? "✓" : check.blocking ? "✗" : "!"}
                </span>
                <span className="flex-1">
                  <span className={check.ok ? "" : "font-medium"}>
                    {check.label}
                  </span>
                  {check.detail ? (
                    <span className="opacity-60"> — {check.detail}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>

          <form action={openElection}>
            <input type="hidden" name="electionId" value={id} />
            <button
              type="submit"
              disabled={!readiness.canOpen}
              className="rounded-md bg-green-600 px-4 py-2.5 font-medium text-white hover:bg-green-700 disabled:opacity-40"
            >
              Abrir eleição
            </button>
          </form>

          <p className="text-xs opacity-60">
            Ao abrir, cargos e candidatos são congelados pelo próprio banco. A
            lista de eleitores continua editável enquanto a eleição estiver
            aberta.
          </p>
        </section>
      ) : null}

      {isOpen ? (
        <section className="flex flex-col gap-4 rounded-lg border border-black/10 p-4 dark:border-white/15">
          <div>
            <h2 className="font-medium">Participação</h2>
            <p className="mt-1 text-sm opacity-70">
              Esta tela conta pessoas, nunca votos — não há resultado parcial
              enquanto a eleição estiver aberta.
            </p>
          </div>

          <div>
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium">
                {progress.voted} de {progress.total}
              </span>
              <span className="opacity-60">
                {progress.total > 0
                  ? `${((progress.voted / progress.total) * 100).toFixed(1)}%`
                  : "—"}
              </span>
            </div>
            <div className="mt-1 h-3 overflow-hidden rounded-full bg-black/10 dark:bg-white/15">
              <div
                className="h-full bg-green-600"
                style={{
                  width: `${progress.total > 0 ? (progress.voted / progress.total) * 100 : 0}%`,
                }}
              />
            </div>
          </div>

          {progress.sections.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {progress.sections.map((section) => (
                <li key={section.id} className="flex items-center gap-3 text-sm">
                  <span className="w-32 shrink-0 truncate opacity-70">
                    Seção {section.code}
                  </span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded bg-black/10 dark:bg-white/15">
                    <span
                      className="block h-full bg-green-600"
                      style={{
                        width: `${section.total > 0 ? (section.voted / section.total) * 100 : 0}%`,
                      }}
                    />
                  </span>
                  <span className="w-20 shrink-0 text-right tabular-nums opacity-70">
                    {section.voted} / {section.total}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          <div>
            <CloseElection electionId={id} electionName={election.name} />
          </div>
        </section>
      ) : null}

      {election.status === "closed" ? (
        <section className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/15">
          <div>
            <h2 className="font-medium">Eleição encerrada</h2>
            <p className="mt-1 text-sm opacity-70">
              Nenhum voto pode mais ser registrado. Os resultados estão
              disponíveis.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/admin/elections/${id}/results`}
              className="inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Ver apuração
            </Link>
            <Link
              href={`/admin/elections/${id}/report`}
              className="inline-block rounded-md border border-black/15 px-4 py-2 text-sm font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
            >
              Relatório (PDF)
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
