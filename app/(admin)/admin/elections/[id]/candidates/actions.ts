"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth/admin";
import { createServiceClient } from "@/lib/supabase/service";

export type FormState = { error: string | null };

export async function createCandidate(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const electionId = String(formData.get("electionId") ?? "");
  const positionId = String(formData.get("positionId") ?? "");
  const number = String(formData.get("number") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const ballotName = String(formData.get("ballotName") ?? "").trim();
  const partyName = String(formData.get("partyName") ?? "").trim();
  const partyAcronym = String(formData.get("partyAcronym") ?? "").trim();
  const deputyName = String(formData.get("deputyName") ?? "").trim();

  if (!electionId || !positionId) return { error: "Selecione o cargo." };
  if (fullName.length < 3) return { error: "Informe o nome do candidato." };
  if (!/^[0-9]+$/.test(number)) {
    return { error: "O número deve conter apenas dígitos." };
  }

  const db = createServiceClient();

  // Confere os dígitos antes de tentar gravar: a mensagem fica melhor do que a
  // do trigger, que continua valendo como última barreira.
  const { data: position } = await db
    .from("positions")
    .select("name, digits")
    .eq("id", positionId)
    .maybeSingle();

  if (!position) return { error: "Cargo não encontrado." };

  if (number.length !== position.digits) {
    return {
      error: `O cargo ${position.name} usa ${position.digits} ${
        position.digits === 1 ? "dígito" : "dígitos"
      }. O número "${number}" tem ${number.length}.`,
    };
  }

  const { error } = await db.from("candidates").insert({
    election_id: electionId,
    position_id: positionId,
    number,
    full_name: fullName,
    ballot_name: ballotName || null,
    party_name: partyName || null,
    party_acronym: partyAcronym || null,
    deputy_name: deputyName || null,
  });

  if (error) return { error: translate(error.message) };

  revalidatePath(`/admin/elections/${electionId}/candidates`);
  return { error: null };
}

export async function deleteCandidate(formData: FormData) {
  await requireAdmin();

  const electionId = String(formData.get("electionId") ?? "");
  const candidateId = String(formData.get("candidateId") ?? "");
  const path = `/admin/elections/${electionId}/candidates`;

  const db = createServiceClient();
  const { error } = await db.from("candidates").delete().eq("id", candidateId);

  if (error) {
    redirect(`${path}?erro=${encodeURIComponent(translate(error.message))}`);
  }

  revalidatePath(path);
  redirect(path);
}

function translate(message: string): string {
  if (message.includes("cargos e candidatos estao bloqueados")) {
    return "A eleição já foi aberta. Candidatos não podem mais ser alterados.";
  }
  if (message.includes("candidates_unique_number")) {
    return "Já existe um candidato com esse número neste cargo.";
  }
  if (message.includes("digitos exigidos pelo cargo")) {
    return "O número não tem a quantidade de dígitos exigida pelo cargo.";
  }
  if (message.includes("violates foreign key")) {
    return "Este candidato já recebeu votos e não pode ser removido.";
  }
  return message;
}
