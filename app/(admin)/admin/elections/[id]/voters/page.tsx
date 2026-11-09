import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth/admin";
import { VOTER_STATUS_LABEL } from "@/lib/format";
import { createServiceClient } from "@/lib/supabase/service";

import {
  addAllActiveStudents,
  addOneStudent,
  addStudentsByClass,
  distributeSections,
  removeVoter,
  setVoterSection,
} from "./actions";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; erro?: string }>;
};

const PAGE_SIZE = 200;

export default async function VotersPage({ params, searchParams }: Props) {
  await requireAdmin();
  const { id } = await params;
  const { q, erro } = await searchParams;
  const query = (q ?? "").trim();

  const db = createServiceClient();

  const { data: election } = await db
    .from("elections")
    .select("id, name, status")
    .eq("id", id)
    .maybeSingle();

  if (!election) notFound();

  const [{ data: sections }, { data: voters }, { data: students }] =
    await Promise.all([
      db.from("sections").select("id, code, name").eq("election_id", id).order("code"),
      db
        .from("election_voters")
        .select(
          "id, status, section_id, student_id, students(rm, full_name, class_name, is_active)",
        )
        .eq("election_id", id)
        .limit(2000),
      db.from("students").select("id, rm, full_name, class_name").eq("is_active", true),
    ]);

  const sectionList = sections ?? [];
  const voterList = voters ?? [];
  const studentList = students ?? [];

  const associated = new Set(voterList.map((voter) => voter.student_id));
  const outside = studentList.filter((student) => !associated.has(student.id));

  // Turmas que ainda têm alguém de fora, para o atalho de associar por turma.
  const classesOutside = new Map<string, number>();
  for (const student of outside) {
    const key = student.class_name ?? "Sem turma";
    classesOutside.set(key, (classesOutside.get(key) ?? 0) + 1);
  }

  const withoutSection = voterList.filter((voter) => !voter.section_id).length;
  const isClosed = election.status === "closed";

  const filtered = query
    ? voterList.filter((voter) => {
        const needle = query.toLowerCase();
        return (
          (voter.students?.rm ?? "").toLowerCase().includes(needle) ||
          (voter.students?.full_name ?? "").toLowerCase().includes(needle)
        );
      })
    : voterList;

  const sorted = filtered.slice().sort((a, b) => {
    const classA = a.students?.class_name ?? "";
    const classB = b.students?.class_name ?? "";
    if (classA !== classB) return classA.localeCompare(classB, "pt-BR");
    return (a.students?.full_name ?? "").localeCompare(
      b.students?.full_name ?? "",
      "pt-BR",
    );
  });

  const searchMatches = query
    ? outside
        .filter((student) => {
          const needle = query.toLowerCase();
          return (
            student.rm.toLowerCase().includes(needle) ||
            student.full_name.toLowerCase().includes(needle)
          );
        })
        .slice(0, 8)
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/admin/elections/${id}`}
          className="text-sm opacity-60 hover:opacity-100"
        >
          ← {election.name}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Eleitores</h1>
        <p className="mt-1 text-sm opacity-70">
          Quem está apto a votar nesta eleição, e em qual seção.
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Associados" value={voterList.length} />
        <Stat label="Fora da eleição" value={outside.length} />
        <Stat
          label="Sem seção"
          value={withoutSection}
          tone={withoutSection > 0 ? "amber" : undefined}
        />
        <Stat
          label="Já votaram"
          value={voterList.filter((voter) => voter.status === "voted").length}
        />
      </div>

      {!isClosed ? (
        <div className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/15">
          <p className="text-sm font-medium">Associar estudantes</p>

          <div className="flex flex-wrap gap-2">
            <form action={addAllActiveStudents}>
              <input type="hidden" name="electionId" value={id} />
              <button
                type="submit"
                disabled={outside.length === 0}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
              >
                Associar todos os ativos ({outside.length})
              </button>
            </form>

            <form action={distributeSections}>
              <input type="hidden" name="electionId" value={id} />
              <button
                type="submit"
                disabled={sectionList.length === 0 || voterList.length === 0}
                className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium hover:bg-black/5 disabled:opacity-40 dark:border-white/20 dark:hover:bg-white/10"
              >
                Distribuir entre as seções
              </button>
            </form>
          </div>

          {classesOutside.size > 0 ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-black/5 pt-3 dark:border-white/10">
              <span className="text-xs opacity-60">por turma:</span>
              {[...classesOutside.entries()]
                .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
                .map(([className, count]) => (
                  <form key={className} action={addStudentsByClass}>
                    <input type="hidden" name="electionId" value={id} />
                    <input
                      type="hidden"
                      name="className"
                      value={className === "Sem turma" ? "" : className}
                    />
                    <button
                      type="submit"
                      className="rounded-full border border-black/15 px-3 py-1 text-xs hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
                    >
                      {className} <span className="opacity-60">+{count}</span>
                    </button>
                  </form>
                ))}
            </div>
          ) : null}

          {sectionList.length === 0 ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Nenhuma seção cadastrada — a distribuição fica indisponível e a
              eleição não poderá ser aberta.
            </p>
          ) : null}
        </div>
      ) : null}

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="Buscar por nome ou RM"
          className="flex-1 rounded-md border border-black/15 bg-transparent px-3 py-2 outline-none focus:border-blue-500 dark:border-white/20"
        />
        <button
          type="submit"
          className="rounded-md border border-black/15 px-4 py-2 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
        >
          Buscar
        </button>
        {query ? (
          <Link
            href={`/admin/elections/${id}/voters`}
            className="rounded-md px-3 py-2 text-sm opacity-60 hover:opacity-100"
          >
            Limpar
          </Link>
        ) : null}
      </form>

      {searchMatches.length > 0 && !isClosed ? (
        <div className="rounded-lg border border-dashed border-black/15 p-3 dark:border-white/20">
          <p className="mb-2 text-xs opacity-60">
            Fora da eleição, correspondem à busca:
          </p>
          <ul className="flex flex-col gap-1">
            {searchMatches.map((student) => (
              <li key={student.id} className="flex items-center gap-3 text-sm">
                <span className="w-24 font-mono opacity-70">{student.rm}</span>
                <span className="flex-1">{student.full_name}</span>
                <span className="opacity-60">{student.class_name ?? "—"}</span>
                <form action={addOneStudent}>
                  <input type="hidden" name="electionId" value={id} />
                  <input type="hidden" name="studentId" value={student.id} />
                  <input type="hidden" name="q" value={query} />
                  <button
                    type="submit"
                    className="rounded-md border border-black/15 px-2 py-1 text-xs hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
                  >
                    Associar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {sorted.length > 0 ? (
        <>
          <p className="text-sm opacity-70">
            {sorted.length} {sorted.length === 1 ? "eleitor" : "eleitores"}
            {sorted.length > PAGE_SIZE
              ? ` · mostrando os ${PAGE_SIZE} primeiros`
              : ""}
          </p>

          <ul className="flex flex-col gap-1.5">
            {sorted.slice(0, PAGE_SIZE).map((voter) => (
              <li
                key={voter.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-black/10 px-4 py-2.5 dark:border-white/15"
              >
                <span className="w-24 shrink-0 font-mono text-sm">
                  {voter.students?.rm}
                </span>
                <span className="flex-1 font-medium">
                  {voter.students?.full_name}
                </span>
                <span className="w-24 shrink-0 text-sm opacity-60">
                  {voter.students?.class_name ?? "—"}
                </span>

                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                    voter.status === "voted"
                      ? "bg-green-500/15 text-green-700 dark:text-green-400"
                      : "bg-black/5 opacity-70 dark:bg-white/10"
                  }`}
                >
                  {VOTER_STATUS_LABEL[voter.status]}
                </span>

                {voter.status === "waiting" && !isClosed ? (
                  <form action={setVoterSection} className="shrink-0">
                    <input type="hidden" name="electionId" value={id} />
                    <input type="hidden" name="voterId" value={voter.id} />
                    <input type="hidden" name="q" value={query} />
                    <select
                      name="sectionId"
                      defaultValue={voter.section_id ?? ""}
                      className="rounded-md border border-black/15 bg-transparent px-2 py-1 text-xs dark:border-white/20"
                    >
                      <option value="">sem seção</option>
                      {sectionList.map((section) => (
                        <option key={section.id} value={section.id}>
                          {section.code} — {section.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="ml-1 rounded-md border border-black/15 px-2 py-1 text-xs hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
                    >
                      Salvar
                    </button>
                  </form>
                ) : (
                  <span className="shrink-0 text-xs opacity-60">
                    {sectionList.find((section) => section.id === voter.section_id)
                      ?.code ?? "sem seção"}
                  </span>
                )}

                {voter.status === "waiting" && !isClosed ? (
                  <form action={removeVoter} className="shrink-0">
                    <input type="hidden" name="electionId" value={id} />
                    <input type="hidden" name="voterId" value={voter.id} />
                    <input type="hidden" name="q" value={query} />
                    <button
                      type="submit"
                      aria-label={`Remover ${voter.students?.full_name}`}
                      className="rounded-md border border-black/15 px-2 py-1 text-xs hover:bg-red-500/10 hover:text-red-700 dark:border-white/20 dark:hover:text-red-400"
                    >
                      Remover
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-black/15 p-8 text-center dark:border-white/20">
          <p className="font-medium">
            {query
              ? "Nenhum eleitor encontrado com esse termo."
              : "Nenhum estudante associado a esta eleição."}
          </p>
          <p className="mt-1 text-sm opacity-70">
            {query
              ? "A busca cobre os já associados; quem estiver de fora aparece na caixa acima."
              : "Associe os estudantes ativos e distribua entre as seções."}
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "amber";
}) {
  return (
    <div className="rounded-lg border border-black/10 p-4 dark:border-white/15">
      <p
        className={`text-2xl font-semibold ${
          tone === "amber" ? "text-amber-700 dark:text-amber-400" : ""
        }`}
      >
        {value}
      </p>
      <p className="text-sm opacity-70">{label}</p>
    </div>
  );
}
