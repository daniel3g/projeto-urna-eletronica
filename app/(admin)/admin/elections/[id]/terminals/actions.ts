"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth/admin";
import {
  generatePairingCode,
  PAIRING_CODE_TTL_MINUTES,
} from "@/lib/auth/terminal";
import { notifyTerminal } from "@/lib/realtime/broadcast";
import { createServiceClient } from "@/lib/supabase/service";

export type FormState = { error: string | null };

function pathFor(electionId: string) {
  return `/admin/elections/${electionId}/terminals`;
}

function fail(electionId: string, message: string): never {
  redirect(`${pathFor(electionId)}?erro=${encodeURIComponent(message)}`);
}

export async function createTerminal(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const electionId = String(formData.get("electionId") ?? "");
  const sectionId = String(formData.get("sectionId") ?? "");
  const kind = String(formData.get("kind") ?? "");
  const label = String(formData.get("label") ?? "").trim();

  if (!sectionId) return { error: "Selecione a seção." };
  if (kind !== "poll_worker" && kind !== "ballot_box") {
    return { error: "Tipo de terminal inválido." };
  }
  if (label.length < 2) return { error: "Informe o nome do terminal." };

  const db = createServiceClient();
  const { error } = await db.from("terminals").insert({
    election_id: electionId,
    section_id: sectionId,
    kind,
    label,
  });

  if (error) return { error: translate(error.message) };

  revalidatePath(pathFor(electionId));
  return { error: null };
}

export async function issuePairingCode(formData: FormData) {
  await requireAdmin();

  const electionId = String(formData.get("electionId") ?? "");
  const terminalId = String(formData.get("terminalId") ?? "");

  const db = createServiceClient();

  const expiresAt = new Date(
    Date.now() + PAIRING_CODE_TTL_MINUTES * 60 * 1000,
  ).toISOString();

  // Colisão de código é improvável, mas o índice único existe — três tentativas
  // resolvem qualquer azar sem deixar o admin na mão.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { error } = await db
      .from("terminals")
      .update({
        pairing_code: generatePairingCode(),
        pairing_code_expires_at: expiresAt,
      })
      .eq("id", terminalId);

    if (!error) {
      revalidatePath(pathFor(electionId));
      redirect(pathFor(electionId));
    }

    if (!error!.message.includes("terminals_pairing_code_unique")) {
      fail(electionId, translate(error!.message));
    }
  }

  fail(electionId, "Não foi possível gerar um código. Tente de novo.");
}

/**
 * Dispara um evento no canal do terminal, sem mudar nada no banco.
 *
 * Serve para confirmar, antes do dia, que o caminho servidor → Realtime →
 * máquina está de pé: o indicador do terminal pisca e volta. É o critério de
 * pronto da Etapa 2 no roadmap.
 */
export async function pingTerminal(formData: FormData) {
  await requireAdmin();

  const electionId = String(formData.get("electionId") ?? "");
  const terminalId = String(formData.get("terminalId") ?? "");

  const delivered = await notifyTerminal(terminalId);

  if (!delivered) {
    fail(
      electionId,
      "Não foi possível publicar no canal. O terminal continua funcionando pelo polling.",
    );
  }

  redirect(`${pathFor(electionId)}?ok=${encodeURIComponent("Evento enviado.")}`);
}

export async function revokeTerminal(formData: FormData) {
  await requireAdmin();

  const electionId = String(formData.get("electionId") ?? "");
  const terminalId = String(formData.get("terminalId") ?? "");

  const db = createServiceClient();
  const { error } = await db
    .from("terminals")
    .update({
      token_hash: null,
      paired_at: null,
      pairing_code: null,
      pairing_code_expires_at: null,
    })
    .eq("id", terminalId);

  if (error) fail(electionId, translate(error.message));

  revalidatePath(pathFor(electionId));
  redirect(pathFor(electionId));
}

export async function deleteTerminal(formData: FormData) {
  await requireAdmin();

  const electionId = String(formData.get("electionId") ?? "");
  const terminalId = String(formData.get("terminalId") ?? "");

  const db = createServiceClient();
  const { error } = await db.from("terminals").delete().eq("id", terminalId);

  if (error) fail(electionId, translate(error.message));

  revalidatePath(pathFor(electionId));
  redirect(pathFor(electionId));
}

function translate(message: string): string {
  if (message.includes("terminals_unique_label")) {
    return "Já existe um terminal com esse nome nesta eleição.";
  }
  if (message.includes("violates foreign key")) {
    return "Este terminal já liberou eleitores e não pode ser removido. Use Revogar.";
  }
  return message;
}
