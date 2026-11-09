import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth/admin";
import { loadResults } from "@/lib/db/results";
import { formatDateTime } from "@/lib/format";
import { createServiceClient } from "@/lib/supabase/service";

import { Projection } from "./projection";

type Props = { params: Promise<{ id: string }> };

export default async function ResultsPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;

  const db = createServiceClient();

  const { data: election } = await db
    .from("elections")
    .select("id, name, status, closed_at")
    .eq("id", id)
    .maybeSingle();

  if (!election) notFound();

  // A apuração só existe depois do encerramento. Antes disso o painel mostra
  // participação — pessoas, não votos (doc 07 §4).
  if (election.status !== "closed") {
    return (
      <div className="flex flex-col gap-6">
        <Link
          href={`/admin/elections/${id}`}
          className="text-sm opacity-60 hover:opacity-100"
        >
          ← {election.name}
        </Link>
        <div className="rounded-lg border border-dashed border-black/15 p-8 text-center dark:border-white/20">
          <p className="font-medium">A apuração fica disponível após o encerramento.</p>
          <p className="mt-1 text-sm opacity-70">
            Enquanto a eleição estiver aberta, o painel mostra apenas quantas
            pessoas já votaram — nunca resultados parciais.
          </p>
        </div>
      </div>
    );
  }

  const results = await loadResults(id);
  const { turnout } = results;

  const votesCast = results.positions.reduce(
    (max, position) => Math.max(max, position.totalVotes),
    0,
  );
  const partial = votesCast > turnout.voted;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href={`/admin/elections/${id}`}
            className="text-sm opacity-60 hover:opacity-100"
          >
            ← {election.name}
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">Apuração</h1>
          <p className="mt-1 text-sm opacity-70">
            Encerrada em {formatDateTime(election.closed_at)}
          </p>
        </div>
        <Projection positions={results.positions} electionName={election.name} />
      </div>

      <section className="rounded-lg border border-black/10 p-4 dark:border-white/15">
        <h2 className="font-medium">Comparecimento</h2>
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Eleitores aptos" value={turnout.eligible} />
          <Stat label="Votaram" value={turnout.voted} />
          <Stat label="Não votaram" value={turnout.absent} />
          <Stat label="Participação" value={`${turnout.pct.toFixed(1)}%`} />
        </div>

        <div className="mt-4 h-3 overflow-hidden rounded-full bg-black/10 dark:bg-white/15">
          <div
            className="h-full bg-green-600"
            style={{ width: `${Math.min(100, turnout.pct)}%` }}
          />
        </div>
      </section>

      {results.positions.map((position) => {
        const max = Math.max(1, ...position.candidates.map((c) => c.votes));

        return (
          <section key={position.id} className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">{position.name}</h2>

            {position.candidates.length === 0 ? (
              <p className="text-sm opacity-60">Nenhum candidato cadastrado.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {position.candidates.map((candidate, rank) => (
                  <li key={candidate.id} className="flex items-center gap-3">
                    <span className="w-12 shrink-0 font-mono text-sm opacity-60">
                      {candidate.number}
                    </span>
                    <span className="w-48 shrink-0 truncate font-medium">
                      {candidate.name}
                    </span>
                    <span className="h-5 flex-1 overflow-hidden rounded bg-black/5 dark:bg-white/10">
                      <span
                        className={`block h-full ${
                          rank === 0 && candidate.votes > 0
                            ? "bg-green-600"
                            : "bg-black/25 dark:bg-white/30"
                        }`}
                        style={{ width: `${(candidate.votes / max) * 100}%` }}
                      />
                    </span>
                    <span className="w-16 shrink-0 text-right font-semibold tabular-nums">
                      {candidate.votes}
                    </span>
                    <span className="w-16 shrink-0 text-right text-sm opacity-60 tabular-nums">
                      {candidate.pct.toFixed(1)}%
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-black/5 pt-2 text-sm opacity-70 dark:border-white/10">
              <span>Brancos: {position.blankVotes}</span>
              <span>Nulos: {position.nullVotes}</span>
              <span>Total: {position.totalVotes}</span>
            </div>
          </section>
        );
      })}

      {partial ? (
        <p className="rounded-md bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          Há mais votos registrados em algum cargo ({votesCast}) do que eleitores
          concluídos ({turnout.voted}). Isso acontece quando alguma sessão foi
          interrompida no meio: os cargos já confirmados continuam contando, e
          por serem anônimos não podem ser identificados nem removidos. Os votos
          são válidos; apenas o comparecimento e o total por cargo não coincidem.
        </p>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-sm opacity-70">{label}</p>
    </div>
  );
}
