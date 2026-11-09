"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth/admin";
import { loadReadinessInput } from "@/lib/db/readiness";
import { evaluateReadiness } from "@/lib/domain/readiness";
import { createServiceClient } from "@/lib/supabase/service";

function fail(electionId: string, message: string): never {
  redirect(
    `/admin/elections/${electionId}?erro=${encodeURIComponent(message)}`,
  );
}

export async function openElection(formData: FormData) {
  await requireAdmin();
  const electionId = String(formData.get("electionId") ?? "");

  const db = createServiceClient();

  const { data: election } = await db
    .from("elections")
    .select("id, status")
    .eq("id", electionId)
    .maybeSingle();

  if (!election) fail(electionId, "Eleição não encontrada.");

  if (election.status !== "draft") {
    fail(electionId, "Só uma eleição em rascunho pode ser aberta.");
  }

  // Reavaliada aqui, não confiando no que a tela mostrou: entre carregar a
  // página e clicar, alguém pode ter removido o último candidato de um cargo.
  const readiness = evaluateReadiness(await loadReadinessInput(electionId));

  if (!readiness.canOpen) {
    fail(
      electionId,
      `A eleição ainda não pode ser aberta: ${readiness.blockers.join("; ")}.`,
    );
  }

  const { error } = await db
    .from("elections")
    .update({ status: "open", opened_at: new Date().toISOString() })
    .eq("id", electionId)
    .eq("status", "draft"); // guarda contra dois cliques simultâneos

  if (error) fail(electionId, error.message);

  revalidatePath(`/admin/elections/${electionId}`);
  redirect(`/admin/elections/${electionId}`);
}

export async function closeElection(formData: FormData) {
  await requireAdmin();
  const electionId = String(formData.get("electionId") ?? "");
  const confirmName = String(formData.get("confirmName") ?? "").trim();

  const db = createServiceClient();

  const { data: election } = await db
    .from("elections")
    .select("id, name, status")
    .eq("id", electionId)
    .maybeSingle();

  if (!election) fail(electionId, "Eleição não encontrada.");

  if (election.status !== "open") {
    fail(electionId, "Só uma eleição aberta pode ser encerrada.");
  }

  if (confirmName !== election.name) {
    fail(
      electionId,
      "O nome digitado não confere. O encerramento não foi realizado.",
    );
  }

  const { error } = await db
    .from("elections")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", electionId)
    .eq("status", "open");

  if (error) fail(electionId, error.message);

  revalidatePath(`/admin/elections/${electionId}`);
  redirect(`/admin/elections/${electionId}`);
}
