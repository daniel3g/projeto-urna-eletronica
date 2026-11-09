import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth/admin";
import {
  loadCandidateRoster,
  loadProgress,
  loadResults,
} from "@/lib/db/results";
import { formatDateTime } from "@/lib/format";
import { createServiceClient } from "@/lib/supabase/service";

import { PrintButton } from "./print-button";

type Props = { params: Promise<{ id: string }> };

async function loadElection(id: string) {
  const db = createServiceClient();
  const { data } = await db
    .from("elections")
    .select("id, name, description, status, opened_at, closed_at")
    .eq("id", id)
    .maybeSingle();
  return data;
}

// O <title> vira o nome sugerido do arquivo em "Salvar como PDF".
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await requireAdmin();
  const { id } = await params;
  const election = await loadElection(id);
  return { title: election ? `Relatório — ${election.name}` : "Relatório" };
}

const SIGNATURES = [
  "Presidente da mesa",
  "Mesário(a)",
  "Mesário(a)",
  "Direção da escola",
];

/**
 * Relatório oficial da eleição, pensado para A4 (impressão ou PDF).
 *
 * Mesma regra da apuração: só existe depois do encerramento. Não há boletim
 * por urna — `votes` não guarda urna nem seção, de propósito (doc 03 §3). O
 * que vai por seção é comparecimento: pessoas, não votos.
 */
export default async function ReportPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;

  const election = await loadElection(id);
  if (!election) notFound();

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
          <p className="font-medium">O relatório fica disponível após o encerramento.</p>
        </div>
      </div>
    );
  }

  const [results, progress, roster] = await Promise.all([
    loadResults(id),
    loadProgress(id),
    loadCandidateRoster(id),
  ]);

  const { turnout } = results;
  const votesCast = results.positions.reduce(
    (max, position) => Math.max(max, position.totalVotes),
    0,
  );
  const partial = votesCast > turnout.voted;

  const inSections = progress.sections.reduce((sum, s) => sum + s.total, 0);
  const votedInSections = progress.sections.reduce((sum, s) => sum + s.voted, 0);
  const withoutSection = {
    total: progress.total - inSections,
    voted: progress.voted - votedInSections,
  };

  return (
    <article className="flex flex-col gap-8 text-sm print:gap-6 print:text-[11pt]">
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <Link
          href={`/admin/elections/${id}/results`}
          className="text-sm opacity-60 hover:opacity-100"
        >
          ← Apuração
        </Link>
        <PrintButton />
      </div>

      <header className="border-b-2 border-current pb-4">
        <p className="text-xs font-semibold uppercase tracking-widest opacity-70">
          Relatório de apuração
        </p>
        <h1 className="mt-1 text-2xl font-bold">{election.name}</h1>
        {election.description ? (
          <p className="mt-1 opacity-80">{election.description}</p>
        ) : null}
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1">
          <div className="flex gap-2">
            <dt className="opacity-70">Abertura:</dt>
            <dd>{formatDateTime(election.opened_at)}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="opacity-70">Encerramento:</dt>
            <dd>{formatDateTime(election.closed_at)}</dd>
          </div>
        </dl>
      </header>

      <section className="break-inside-avoid">
        <h2 className="mb-2 text-base font-bold uppercase tracking-wide">
          Comparecimento
        </h2>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-current text-left">
              <th className="py-1.5 pr-2 font-semibold">Seção</th>
              <Num head>Aptos</Num>
              <Num head>Votaram</Num>
              <Num head>Faltaram</Num>
              <Num head>Participação</Num>
            </tr>
          </thead>
          <tbody>
            {progress.sections.map((section) => (
              <TurnoutRow
                key={section.id}
                label={`${section.code} — ${section.name}`}
                total={section.total}
                voted={section.voted}
              />
            ))}
            {withoutSection.total > 0 ? (
              <TurnoutRow
                label="Sem seção definida"
                total={withoutSection.total}
                voted={withoutSection.voted}
              />
            ) : null}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-current font-semibold">
              <td className="py-1.5 pr-2">Total</td>
              <Num>{turnout.eligible}</Num>
              <Num>{turnout.voted}</Num>
              <Num>{turnout.absent}</Num>
              <Num>{formatPct(turnout.pct)}</Num>
            </tr>
          </tfoot>
        </table>
      </section>

      {results.positions.map((position) => (
        <section key={position.id} className="break-inside-avoid">
          <h2 className="mb-2 text-base font-bold uppercase tracking-wide">
            {position.name}
          </h2>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-current text-left">
                <th className="w-14 py-1.5 pr-2 font-semibold">Nº</th>
                <th className="py-1.5 pr-2 font-semibold">Candidato</th>
                <th className="py-1.5 pr-2 font-semibold">Chapa</th>
                <Num head>Votos</Num>
                <Num head>%</Num>
              </tr>
            </thead>
            <tbody>
              {position.candidates.map((candidate, rank) => (
                <tr
                  key={candidate.id}
                  className={`border-b border-current/20 ${
                    rank === 0 && candidate.votes > 0 ? "font-semibold" : ""
                  }`}
                >
                  <td className="py-1.5 pr-2 font-mono">{candidate.number}</td>
                  <td className="py-1.5 pr-2">{candidate.name}</td>
                  <td className="py-1.5 pr-2">{candidate.partyName ?? "—"}</td>
                  <Num>{candidate.votes}</Num>
                  <Num>{formatPct(candidate.pct)}</Num>
                </tr>
              ))}
              <tr className="border-b border-current/20">
                <td className="py-1.5 pr-2" />
                <td className="py-1.5 pr-2" colSpan={2}>
                  Brancos
                </td>
                <Num>{position.blankVotes}</Num>
                <Num>{formatPct(share(position.blankVotes, position.totalVotes))}</Num>
              </tr>
              <tr className="border-b border-current/20">
                <td className="py-1.5 pr-2" />
                <td className="py-1.5 pr-2" colSpan={2}>
                  Nulos
                </td>
                <Num>{position.nullVotes}</Num>
                <Num>{formatPct(share(position.nullVotes, position.totalVotes))}</Num>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-current font-semibold">
                <td className="py-1.5 pr-2" />
                <td className="py-1.5 pr-2" colSpan={2}>
                  Total de votos
                </td>
                <Num>{position.totalVotes}</Num>
                <Num>{position.totalVotes > 0 ? "100,0%" : "—"}</Num>
              </tr>
            </tfoot>
          </table>
        </section>
      ))}

      <section className="flex flex-col gap-2 text-xs opacity-80">
        <p>
          Percentuais calculados sobre o total de votos de cada cargo, incluindo
          brancos e nulos. Em caso de empate, a ordem segue o número do candidato.
        </p>
        <p>
          O voto é secreto: o sistema registra se cada eleitor votou, mas nenhum
          voto guarda vínculo com o eleitor, com a seção ou com a urna em que foi
          registrado.
        </p>
        {partial ? (
          <p className="font-semibold">
            Atenção: há mais votos registrados em algum cargo ({votesCast}) do que
            eleitores que concluíram a votação ({turnout.voted}). Isso ocorre quando
            uma sessão é interrompida no meio: os cargos já confirmados permanecem
            válidos e, por serem anônimos, não podem ser identificados nem removidos.
          </p>
        ) : null}
      </section>

      <section className="break-inside-avoid">
        <h2 className="mb-6 text-base font-bold uppercase tracking-wide">
          Assinaturas
        </h2>
        <div className="grid grid-cols-2 gap-x-10 gap-y-12">
          {SIGNATURES.map((role, index) => (
            <div key={index} className="flex flex-col gap-1">
              <div className="h-8 border-b border-current" />
              <p className="text-xs">{role}</p>
              <p className="text-xs opacity-70">Nome:</p>
            </div>
          ))}
        </div>
        <p className="mt-10 text-xs">
          Local e data: ______________________________________________
        </p>
      </section>

      <section className="break-before-page">
        <h2 className="mb-2 text-base font-bold uppercase tracking-wide">
          Anexo — Candidatos registrados
        </h2>
        {results.positions.map((position) => {
          const ofPosition = roster.filter((c) => c.positionId === position.id);

          return (
            <div key={position.id} className="mb-5 break-inside-avoid">
              <h3 className="mb-1 font-semibold">{position.name}</h3>
              {ofPosition.length === 0 ? (
                <p className="opacity-70">Nenhum candidato registrado.</p>
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-current text-left">
                      <th className="w-14 py-1 pr-2 font-semibold">Nº</th>
                      <th className="py-1 pr-2 font-semibold">Nome completo</th>
                      <th className="py-1 pr-2 font-semibold">Nome de urna</th>
                      <th className="py-1 pr-2 font-semibold">Chapa</th>
                      <th className="py-1 pr-2 font-semibold">Vice</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ofPosition.map((candidate) => (
                      <tr key={candidate.id} className="border-b border-current/20">
                        <td className="py-1 pr-2 font-mono">{candidate.number}</td>
                        <td className="py-1 pr-2">{candidate.fullName}</td>
                        <td className="py-1 pr-2">{candidate.ballotName ?? "—"}</td>
                        <td className="py-1 pr-2">
                          {candidate.partyName
                            ? `${candidate.partyName}${
                                candidate.partyAcronym
                                  ? ` (${candidate.partyAcronym})`
                                  : ""
                              }`
                            : "—"}
                        </td>
                        <td className="py-1 pr-2">{candidate.deputyName ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </section>
    </article>
  );
}

function TurnoutRow({
  label,
  total,
  voted,
}: {
  label: string;
  total: number;
  voted: number;
}) {
  return (
    <tr className="border-b border-current/20">
      <td className="py-1.5 pr-2">{label}</td>
      <Num>{total}</Num>
      <Num>{voted}</Num>
      <Num>{total - voted}</Num>
      <Num>{formatPct(share(voted, total))}</Num>
    </tr>
  );
}

function Num({ children, head }: { children: React.ReactNode; head?: boolean }) {
  const className = "py-1.5 pl-2 text-right tabular-nums";
  return head ? (
    <th className={`${className} font-semibold`}>{children}</th>
  ) : (
    <td className={className}>{children}</td>
  );
}

function share(part: number, whole: number) {
  return whole > 0 ? (part / whole) * 100 : 0;
}

const pctFormat = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function formatPct(value: number) {
  return `${pctFormat.format(value)}%`;
}
