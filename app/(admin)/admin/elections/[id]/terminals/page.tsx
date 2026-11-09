import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth/admin";
import { formatPairingCode } from "@/lib/auth/terminal";
import { formatDateTime, TERMINAL_KIND_LABEL } from "@/lib/format";
import { createServiceClient } from "@/lib/supabase/service";

import {
  deleteTerminal,
  issuePairingCode,
  pingTerminal,
  revokeTerminal,
} from "./actions";
import { TerminalForm } from "./terminal-form";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string; ok?: string }>;
};

export default async function TerminalsPage({ params, searchParams }: Props) {
  await requireAdmin();
  const { id } = await params;
  const { erro, ok } = await searchParams;

  const db = createServiceClient();

  const { data: election } = await db
    .from("elections")
    .select("id, name, status")
    .eq("id", id)
    .maybeSingle();

  if (!election) notFound();

  const [{ data: sections }, { data: terminals }] = await Promise.all([
    db.from("sections").select("id, code, name").eq("election_id", id).order("code"),
    db
      .from("terminals")
      .select(
        "id, section_id, kind, label, paired_at, last_seen_at, pairing_code, pairing_code_expires_at",
      )
      .eq("election_id", id)
      .order("label"),
  ]);

  const sectionList = sections ?? [];
  const terminalList = terminals ?? [];
  // Server Component: renderiza uma vez por requisição e não re-renderiza no
  // navegador, então ler o relógio aqui é estável. A regra de pureza mira
  // componentes que re-renderizam.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/admin/elections/${id}`}
          className="text-sm opacity-60 hover:opacity-100"
        >
          ← {election.name}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Terminais</h1>
        <p className="mt-1 text-sm opacity-70">
          Cada computador usado na eleição é pareado uma vez, com um código. No
          dia, ninguém digita senha.
        </p>
      </div>

      {erro ? (
        <p
          role="alert"
          className="rounded-md bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400"
        >
          {erro}
        </p>
      ) : null}

      {ok ? (
        <p className="rounded-md bg-green-500/10 px-4 py-3 text-sm text-green-700 dark:text-green-400">
          {ok} Confira se o indicador do terminal reagiu.
        </p>
      ) : null}

      {sectionList.length === 0 ? (
        <div className="rounded-lg border border-dashed border-black/15 p-8 text-center dark:border-white/20">
          <p className="font-medium">Cadastre as seções primeiro.</p>
          <p className="mt-1 text-sm opacity-70">
            Todo terminal pertence a uma seção.
          </p>
          <Link
            href={`/admin/elections/${id}/sections`}
            className="mt-4 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Ir para Seções
          </Link>
        </div>
      ) : null}

      {sectionList.map((section) => {
        const ofSection = terminalList.filter(
          (terminal) => terminal.section_id === section.id,
        );

        return (
          <section key={section.id} className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">
              Seção {section.code} — {section.name}
            </h2>

            {ofSection.length === 0 ? (
              <p className="rounded-lg border border-dashed border-black/15 px-4 py-3 text-sm opacity-60 dark:border-white/20">
                Nenhum terminal nesta seção.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {ofSection.map((terminal) => {
                  const codeValid =
                    terminal.pairing_code &&
                    terminal.pairing_code_expires_at &&
                    new Date(terminal.pairing_code_expires_at).getTime() > now;

                  return (
                    <li
                      key={terminal.id}
                      className="flex flex-wrap items-center gap-4 rounded-lg border border-black/10 px-4 py-3 dark:border-white/15"
                    >
                      <div className="min-w-40 flex-1">
                        <p className="font-medium">{terminal.label}</p>
                        <p className="text-xs opacity-60">
                          {TERMINAL_KIND_LABEL[terminal.kind]}
                        </p>
                      </div>

                      <div className="text-xs">
                        {terminal.paired_at ? (
                          <>
                            <p className="font-medium text-green-700 dark:text-green-400">
                              pareado
                            </p>
                            <p className="opacity-60">
                              visto em {formatDateTime(terminal.last_seen_at)}
                            </p>
                          </>
                        ) : (
                          <p className="opacity-60">não pareado</p>
                        )}
                      </div>

                      {/* O código aparece mesmo com o terminal pareado: é o caso
                          de repareamento, quando a máquina perdeu o token. */}
                      {codeValid ? (
                        <div className="text-right">
                          <p className="font-mono text-xl font-semibold tracking-widest">
                            {formatPairingCode(terminal.pairing_code!)}
                          </p>
                          <p className="text-xs opacity-60">
                            válido até{" "}
                            {formatDateTime(terminal.pairing_code_expires_at)}
                          </p>
                        </div>
                      ) : null}

                      <div className="flex items-center gap-1">
                        <form action={issuePairingCode}>
                          <input type="hidden" name="electionId" value={id} />
                          <input
                            type="hidden"
                            name="terminalId"
                            value={terminal.id}
                          />
                          <button
                            type="submit"
                            title="Gera um código para parear (ou reparear) uma máquina"
                            className="rounded-md border border-black/15 px-2.5 py-1 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
                          >
                            {codeValid
                              ? "Novo código"
                              : terminal.paired_at
                                ? "Reparear"
                                : "Gerar código"}
                          </button>
                        </form>

                        {terminal.paired_at ? (
                          <>
                            <form action={pingTerminal}>
                              <input type="hidden" name="electionId" value={id} />
                              <input
                                type="hidden"
                                name="terminalId"
                                value={terminal.id}
                              />
                              <button
                                type="submit"
                                title="Dispara um evento no canal deste terminal"
                                className="rounded-md border border-black/15 px-2.5 py-1 text-sm hover:bg-blue-500/10 hover:text-blue-700 dark:border-white/20 dark:hover:text-blue-400"
                              >
                                Testar canal
                              </button>
                            </form>

                            <form action={revokeTerminal}>
                              <input type="hidden" name="electionId" value={id} />
                              <input
                                type="hidden"
                                name="terminalId"
                                value={terminal.id}
                              />
                              <button
                                type="submit"
                                title="Derruba o pareamento atual — use quando a máquina for perdida"
                                className="rounded-md border border-black/15 px-2.5 py-1 text-sm hover:bg-amber-500/10 hover:text-amber-700 dark:border-white/20 dark:hover:text-amber-400"
                              >
                                Revogar
                              </button>
                            </form>
                          </>
                        ) : null}

                        <form action={deleteTerminal}>
                          <input type="hidden" name="electionId" value={id} />
                          <input
                            type="hidden"
                            name="terminalId"
                            value={terminal.id}
                          />
                          <button
                            type="submit"
                            aria-label={`Remover ${terminal.label}`}
                            className="rounded-md border border-black/15 px-2.5 py-1 text-sm hover:bg-red-500/10 hover:text-red-700 dark:border-white/20 dark:hover:text-red-400"
                          >
                            Remover
                          </button>
                        </form>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}

      <TerminalForm electionId={id} sections={sectionList} />

      {terminalList.length > 0 ? (
        <div className="rounded-lg border border-black/10 p-4 text-sm dark:border-white/15">
          <p className="font-medium">Como parear</p>
          <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5 opacity-70">
            <li>Gere o código do terminal aqui.</li>
            <li>
              No computador de destino, abra{" "}
              <code className="font-mono">/urna</code> ou{" "}
              <code className="font-mono">/mesario</code>.
            </li>
            <li>Digite o código. Ele vale por 30 minutos e serve uma vez só.</li>
            <li>
              A máquina guarda o token e passa a abrir direto na tela certa.
            </li>
          </ol>
          <p className="mt-3 text-sm font-medium">
            A máquina voltou a pedir código?
          </p>
          <p className="mt-1 text-sm opacity-70">
            Acontece quando o navegador apaga os dados do site ao fechar, quando
            se usa uma janela anônima, ou quando o computador é trocado. Clique
            em <strong>Reparear</strong> e digite o novo código na máquina.
          </p>
          <p className="mt-2 text-xs opacity-60">
            Gerar um código novo <strong>não derruba</strong> o pareamento atual:
            a máquina antiga continua funcionando até alguém usar o código, e só
            então o token anterior deixa de valer. Já <strong>Revogar</strong>{" "}
            derruba na hora — use quando um computador sumir.
          </p>
        </div>
      ) : null}
    </div>
  );
}
