"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth/admin";
import { createServiceClient } from "@/lib/supabase/service";

const CHUNK = 500;
/** Ids por requisição em filtros `in` — mantém a URL do PostgREST em tamanho sadio. */
const ID_BATCH = 150;

function pathFor(electionId: string, query?: string) {
  const base = `/admin/elections/${electionId}/voters`;
  return query ? `${base}?q=${encodeURIComponent(query)}` : base;
}

function fail(electionId: string, message: string): never {
  redirect(
    `${pathFor(electionId)}?erro=${encodeURIComponent(message)}`,
  );
}

async function insertVoters(electionId: string, studentIds: string[]) {
  const db = createServiceClient();

  for (let i = 0; i < studentIds.length; i += CHUNK) {
    const payload = studentIds.slice(i, i + CHUNK).map((studentId) => ({
      election_id: electionId,
      student_id: studentId,
    }));

    // ignoreDuplicates: reexecutar a associação não é erro, é no-op.
    const { error } = await db
      .from("election_voters")
      .upsert(payload, {
        onConflict: "election_id,student_id",
        ignoreDuplicates: true,
      });

    if (error) fail(electionId, translate(error.message));
  }
}

export async function addAllActiveStudents(formData: FormData) {
  await requireAdmin();
  const electionId = String(formData.get("electionId") ?? "");

  const db = createServiceClient();

  const [{ data: students }, { data: voters }] = await Promise.all([
    db.from("students").select("id").eq("is_active", true),
    db.from("election_voters").select("student_id").eq("election_id", electionId),
  ]);

  const already = new Set((voters ?? []).map((voter) => voter.student_id));
  const missing = (students ?? [])
    .map((student) => student.id)
    .filter((id) => !already.has(id));

  if (missing.length === 0) {
    redirect(pathFor(electionId));
  }

  await insertVoters(electionId, missing);

  revalidatePath(pathFor(electionId));
  redirect(pathFor(electionId));
}

export async function addStudentsByClass(formData: FormData) {
  await requireAdmin();
  const electionId = String(formData.get("electionId") ?? "");
  const className = String(formData.get("className") ?? "");

  const db = createServiceClient();
  const base = db.from("students").select("id").eq("is_active", true);

  // Turma em branco significa os alunos sem turma, e no banco isso é NULL —
  // `.eq("class_name", "")` não casaria com nenhum deles.
  const { data: students } = className
    ? await base.eq("class_name", className)
    : await base.is("class_name", null);

  await insertVoters(electionId, (students ?? []).map((student) => student.id));

  revalidatePath(pathFor(electionId));
  redirect(pathFor(electionId));
}

export async function addOneStudent(formData: FormData) {
  await requireAdmin();
  const electionId = String(formData.get("electionId") ?? "");
  const studentId = String(formData.get("studentId") ?? "");
  const query = String(formData.get("q") ?? "");

  await insertVoters(electionId, [studentId]);

  revalidatePath(pathFor(electionId));
  redirect(pathFor(electionId, query));
}

export async function removeVoter(formData: FormData) {
  await requireAdmin();
  const electionId = String(formData.get("electionId") ?? "");
  const voterId = String(formData.get("voterId") ?? "");
  const query = String(formData.get("q") ?? "");

  const db = createServiceClient();

  const { data: voter } = await db
    .from("election_voters")
    .select("status")
    .eq("id", voterId)
    .maybeSingle();

  if (!voter) fail(electionId, "Eleitor não encontrado.");

  // Só sai quem ainda não entrou no fluxo. Remover alguém que já votou apagaria
  // o registro de comparecimento sem apagar o voto — que é anônimo e fica.
  if (voter.status !== "waiting") {
    fail(
      electionId,
      "Só é possível remover eleitores que ainda não foram liberados.",
    );
  }

  const { error } = await db.from("election_voters").delete().eq("id", voterId);
  if (error) fail(electionId, translate(error.message));

  revalidatePath(pathFor(electionId));
  redirect(pathFor(electionId, query));
}

export async function setVoterSection(formData: FormData) {
  await requireAdmin();
  const electionId = String(formData.get("electionId") ?? "");
  const voterId = String(formData.get("voterId") ?? "");
  const rawSection = String(formData.get("sectionId") ?? "");
  const query = String(formData.get("q") ?? "");

  const db = createServiceClient();

  const { data: voter } = await db
    .from("election_voters")
    .select("status")
    .eq("id", voterId)
    .maybeSingle();

  if (!voter) fail(electionId, "Eleitor não encontrado.");

  if (voter.status !== "waiting") {
    fail(
      electionId,
      "A seção não pode mudar depois que o eleitor foi liberado.",
    );
  }

  const { error } = await db
    .from("election_voters")
    .update({ section_id: rawSection || null })
    .eq("id", voterId);

  if (error) fail(electionId, translate(error.message));

  revalidatePath(pathFor(electionId));
  redirect(pathFor(electionId, query));
}

/**
 * Distribui os eleitores ainda em espera entre as seções.
 *
 * A ordenação é por turma e depois por nome, e o corte é em blocos contíguos —
 * assim uma turma tende a ficar inteira na mesma seção, e as seções ficam com
 * tamanhos parecidos. Quem já foi liberado ou já votou não é tocado.
 */
export async function distributeSections(formData: FormData) {
  await requireAdmin();
  const electionId = String(formData.get("electionId") ?? "");

  const db = createServiceClient();

  const [{ data: sections }, { data: voters }] = await Promise.all([
    db.from("sections").select("id, code").eq("election_id", electionId).eq("is_active", true).order("code"),
    db
      .from("election_voters")
      .select("id, students(class_name, full_name)")
      .eq("election_id", electionId)
      .eq("status", "waiting"),
  ]);

  const sectionList = sections ?? [];
  if (sectionList.length === 0) {
    fail(electionId, "Cadastre ao menos uma seção antes de distribuir.");
  }

  const ordered = (voters ?? []).slice().sort((a, b) => {
    const classA = a.students?.class_name ?? "";
    const classB = b.students?.class_name ?? "";
    if (classA !== classB) return classA.localeCompare(classB, "pt-BR");
    return (a.students?.full_name ?? "").localeCompare(
      b.students?.full_name ?? "",
      "pt-BR",
    );
  });

  if (ordered.length === 0) redirect(pathFor(electionId));

  const perSection = Math.ceil(ordered.length / sectionList.length);

  for (let index = 0; index < sectionList.length; index += 1) {
    const slice = ordered.slice(index * perSection, (index + 1) * perSection);
    if (slice.length === 0) continue;

    const ids = slice.map((voter) => voter.id);

    for (let i = 0; i < ids.length; i += ID_BATCH) {
      const { error } = await db
        .from("election_voters")
        .update({ section_id: sectionList[index].id })
        .in("id", ids.slice(i, i + ID_BATCH));

      if (error) fail(electionId, translate(error.message));
    }
  }

  revalidatePath(pathFor(electionId));
  redirect(pathFor(electionId));
}

function translate(message: string): string {
  if (message.includes("eleitores nao podem mais ser alterados")) {
    return "A eleição está encerrada. A lista de eleitores não pode mais mudar.";
  }
  if (message.includes("election_voters_section_fk")) {
    return "Essa seção não pertence a esta eleição.";
  }
  return message;
}
