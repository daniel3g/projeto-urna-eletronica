import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth/admin";
import { TERMINAL_KIND_LABEL } from "@/lib/format";
import { createServiceClient } from "@/lib/supabase/service";

import { deleteSection } from "./actions";
import { SectionForm } from "./section-form";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
};

export default async function SectionsPage({ params, searchParams }: Props) {
  await requireAdmin();
  const { id } = await params;
  const { erro } = await searchParams;

  const db = createServiceClient();

  const { data: election } = await db
    .from("elections")
    .select("id, name, status")
    .eq("id", id)
    .maybeSingle();

  if (!election) notFound();

  const [{ data: sections }, { data: terminals }] = await Promise.all([
    db
      .from("sections")
      .select("id, code, name")
      .eq("election_id", id)
      .order("code"),
    db
      .from("terminals")
      .select("id, section_id, kind, label, paired_at")
      .eq("election_id", id)
      .order("label"),
  ]);

  const sectionList = sections ?? [];
  const terminalList = terminals ?? [];
  const isClosed = election.status === "closed";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/admin/elections/${id}`}
          className="text-sm opacity-60 hover:opacity-100"
        >
          ← {election.name}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Seções</h1>
        <p className="mt-1 text-sm opacity-70">
          Os estudantes são distribuídos entre as seções, e cada seção tem os seus
          próprios terminais.
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

      {sectionList.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {sectionList.map((section) => {
            const ofSection = terminalList.filter(
              (terminal) => terminal.section_id === section.id,
            );

            return (
              <li
                key={section.id}
                className="rounded-lg border border-black/10 px-4 py-3 dark:border-white/15"
              >
                <div className="flex items-center gap-4">
                  <span className="font-mono text-lg font-semibold">
                    {section.code}
                  </span>
                  <p className="flex-1 font-medium">{section.name}</p>

                  {!isClosed ? (
                    <form action={deleteSection}>
                      <input type="hidden" name="electionId" value={id} />
                      <input type="hidden" name="sectionId" value={section.id} />
                      <button
                        type="submit"
                        aria-label={`Remover seção ${section.code}`}
                        className="rounded-md border border-black/15 px-2 py-1 text-sm hover:bg-red-500/10 hover:text-red-700 dark:border-white/20 dark:hover:text-red-400"
                      >
                        Remover
                      </button>
                    </form>
                  ) : null}
                </div>

                {ofSection.length > 0 ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-black/5 pt-2 dark:border-white/10">
                    {ofSection.map((terminal) => (
                      <span
                        key={terminal.id}
                        className="rounded-full bg-black/5 px-2.5 py-1 text-xs dark:bg-white/10"
                      >
                        {terminal.label}
                        <span className="opacity-60">
                          {" · "}
                          {TERMINAL_KIND_LABEL[terminal.kind]}
                          {terminal.paired_at ? " · pareado" : " · não pareado"}
                        </span>
                      </span>
                    ))}
                    <Link
                      href={`/admin/elections/${id}/terminals`}
                      className="text-xs underline opacity-60 hover:opacity-100"
                    >
                      gerenciar terminais
                    </Link>
                  </div>
                ) : (
                  <p className="mt-2 border-t border-black/5 pt-2 text-xs opacity-60 dark:border-white/10">
                    Sem terminais. Remover a seção também removeria os terminais
                    dela.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="rounded-lg border border-dashed border-black/15 p-8 text-center dark:border-white/20">
          <p className="font-medium">Nenhuma seção cadastrada.</p>
          <p className="mt-1 text-sm opacity-70">
            Mesmo uma eleição em uma sala só precisa de pelo menos uma seção.
          </p>
        </div>
      )}

      {!isClosed ? <SectionForm electionId={id} /> : null}
    </div>
  );
}
