import Link from "next/link";
import { notFound } from "next/navigation";

import { PhotoUpload } from "@/app/(admin)/admin/photos/photo-upload";
import { requireAdmin } from "@/lib/auth/admin";
import { CANDIDATE_BUCKET, signPhotoUrls } from "@/lib/db/photos";
import { ELECTION_STATUS_LABEL } from "@/lib/format";
import { createServiceClient } from "@/lib/supabase/service";

import { deleteCandidate } from "./actions";
import { CandidateForm } from "./candidate-form";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
};

export default async function CandidatesPage({ params, searchParams }: Props) {
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

  const [{ data: positions }, { data: candidates }] = await Promise.all([
    db
      .from("positions")
      .select("id, name, digits, display_order")
      .eq("election_id", id)
      .order("display_order"),
    db
      .from("candidates")
      .select(
        "id, position_id, number, full_name, ballot_name, party_name, party_acronym, deputy_name, photo_path, deputy_photo_path",
      )
      .eq("election_id", id)
      .order("number"),
  ]);

  const isDraft = election.status === "draft";
  const positionList = positions ?? [];
  const candidateList = candidates ?? [];

  const photoUrls = await signPhotoUrls(
    CANDIDATE_BUCKET,
    candidateList.flatMap((candidate) => [
      candidate.photo_path,
      candidate.deputy_photo_path,
    ]),
  );

  const currentPath = `/admin/elections/${id}/candidates`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/admin/elections/${id}`}
          className="text-sm opacity-60 hover:opacity-100"
        >
          ← {election.name}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Candidatos</h1>
        <p className="mt-1 text-sm opacity-70">
          O número é o que o eleitor digita na urna. Ele precisa ter exatamente a
          quantidade de dígitos do cargo.
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

      {!isDraft ? (
        <p className="rounded-md bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          Esta eleição está em{" "}
          <strong>{ELECTION_STATUS_LABEL[election.status]}</strong>. Os candidatos
          estão congelados.
        </p>
      ) : null}

      {positionList.length === 0 ? (
        <div className="rounded-lg border border-dashed border-black/15 p-8 text-center dark:border-white/20">
          <p className="font-medium">Cadastre os cargos primeiro.</p>
          <p className="mt-1 text-sm opacity-70">
            Todo candidato pertence a um cargo, e é o cargo que define quantos
            dígitos o número terá.
          </p>
          <Link
            href={`/admin/elections/${id}/positions`}
            className="mt-4 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Ir para Cargos
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {positionList.map((position) => {
            const ofPosition = candidateList.filter(
              (candidate) => candidate.position_id === position.id,
            );

            return (
              <section key={position.id} className="flex flex-col gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">
                  {position.name}
                </h2>

                {ofPosition.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-black/15 px-4 py-3 text-sm opacity-60 dark:border-white/20">
                    Nenhum candidato. A eleição não pode ser aberta com um cargo
                    vazio.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {ofPosition.map((candidate) => (
                      <li
                        key={candidate.id}
                        className="flex items-center gap-4 rounded-lg border border-black/10 px-4 py-3 dark:border-white/15"
                      >
                        <span className="font-mono text-lg font-semibold tabular-nums">
                          {candidate.number}
                        </span>

                        <PhotoUpload
                          kind="candidate"
                          id={candidate.id}
                          name={candidate.full_name}
                          photoUrl={
                            candidate.photo_path
                              ? (photoUrls.get(candidate.photo_path) ?? null)
                              : null
                          }
                          photoPath={candidate.photo_path}
                          revalidate={currentPath}
                          size={56}
                        />

                        <div className="flex-1">
                          <p className="font-medium">
                            {candidate.ballot_name || candidate.full_name}
                          </p>
                          <p className="text-xs opacity-60">
                            {[
                              candidate.ballot_name ? candidate.full_name : null,
                              candidate.party_name
                                ? `${candidate.party_name}${candidate.party_acronym ? ` (${candidate.party_acronym})` : ""}`
                                : null,
                              candidate.deputy_name
                                ? `vice: ${candidate.deputy_name}`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </p>
                        </div>

                        {candidate.deputy_name ? (
                          <div className="flex flex-col items-center gap-1">
                            <PhotoUpload
                              kind="candidate-deputy"
                              id={candidate.id}
                              name={candidate.deputy_name}
                              photoUrl={
                                candidate.deputy_photo_path
                                  ? (photoUrls.get(candidate.deputy_photo_path) ??
                                    null)
                                  : null
                              }
                              photoPath={candidate.deputy_photo_path}
                              revalidate={currentPath}
                              size={40}
                            />
                            <span className="text-[10px] uppercase tracking-wide opacity-50">
                              vice
                            </span>
                          </div>
                        ) : null}

                        {isDraft ? (
                          <form action={deleteCandidate}>
                            <input type="hidden" name="electionId" value={id} />
                            <input
                              type="hidden"
                              name="candidateId"
                              value={candidate.id}
                            />
                            <button
                              type="submit"
                              aria-label={`Remover ${candidate.full_name}`}
                              className="rounded-md border border-black/15 px-2 py-1 text-sm hover:bg-red-500/10 hover:text-red-700 dark:border-white/20 dark:hover:text-red-400"
                            >
                              Remover
                            </button>
                          </form>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}

          {isDraft ? (
            <CandidateForm
              electionId={id}
              positions={positionList.map((position) => ({
                id: position.id,
                name: position.name,
                digits: position.digits,
              }))}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
