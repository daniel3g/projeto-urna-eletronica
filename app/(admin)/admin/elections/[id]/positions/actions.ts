"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth/admin";
import { createServiceClient } from "@/lib/supabase/service";

export type FormState = { error: string | null };

/**
 * Valor temporário usado ao trocar duas ordens de lugar.
 *
 * `positions_unique_order` é DEFERRABLE, mas o supabase-js manda cada UPDATE em
 * sua própria transação, então a troca direta A↔B esbarraria na constraint no
 * commit do primeiro comando. O desvio por um valor livre resolve sem precisar
 * de RPC. Cabe em smallint e passa no check `display_order >= 1`.
 */
const TEMP_ORDER = 32000;

export async function createPosition(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const electionId = String(formData.get("electionId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const digits = Number(formData.get("digits"));

  if (!electionId) return { error: "Eleição não informada." };
  if (name.length < 2) return { error: "Informe o nome do cargo." };
  if (!Number.isInteger(digits) || digits < 1 || digits > 5) {
    return { error: "A quantidade de dígitos precisa ficar entre 1 e 5." };
  }

  const db = createServiceClient();

  const { data: last } = await db
    .from("positions")
    .select("display_order")
    .eq("election_id", electionId)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await db.from("positions").insert({
    election_id: electionId,
    name,
    digits,
    display_order: (last?.display_order ?? 0) + 1,
  });

  if (error) return { error: translate(error.message) };

  revalidatePath(`/admin/elections/${electionId}/positions`);
  return { error: null };
}

export async function deletePosition(formData: FormData) {
  await requireAdmin();

  const electionId = String(formData.get("electionId") ?? "");
  const positionId = String(formData.get("positionId") ?? "");
  const path = `/admin/elections/${electionId}/positions`;

  const db = createServiceClient();
  const { error } = await db.from("positions").delete().eq("id", positionId);

  if (error) redirect(`${path}?erro=${encodeURIComponent(translate(error.message))}`);

  revalidatePath(path);
  redirect(path);
}

export async function movePosition(formData: FormData) {
  await requireAdmin();

  const electionId = String(formData.get("electionId") ?? "");
  const positionId = String(formData.get("positionId") ?? "");
  const direction = String(formData.get("direction") ?? "");
  const path = `/admin/elections/${electionId}/positions`;

  const db = createServiceClient();

  const { data: current } = await db
    .from("positions")
    .select("id, display_order")
    .eq("id", positionId)
    .maybeSingle();

  if (!current) redirect(`${path}?erro=${encodeURIComponent("Cargo não encontrado.")}`);

  const { data: neighbour } = await db
    .from("positions")
    .select("id, display_order")
    .eq("election_id", electionId)
    .order("display_order", { ascending: direction === "down" })
    .filter(
      "display_order",
      direction === "down" ? "gt" : "lt",
      current.display_order,
    )
    .limit(1)
    .maybeSingle();

  // Já está no topo ou no fim: nada a fazer.
  if (!neighbour) redirect(path);

  const a = current.display_order;
  const b = neighbour.display_order;

  const steps = [
    db.from("positions").update({ display_order: TEMP_ORDER }).eq("id", current.id),
    db.from("positions").update({ display_order: a }).eq("id", neighbour.id),
    db.from("positions").update({ display_order: b }).eq("id", current.id),
  ];

  for (const step of steps) {
    const { error } = await step;
    if (error) {
      redirect(`${path}?erro=${encodeURIComponent(translate(error.message))}`);
    }
  }

  revalidatePath(path);
  redirect(path);
}

/** Traduz as mensagens que vêm dos triggers e constraints do banco. */
function translate(message: string): string {
  if (message.includes("cargos e candidatos estao bloqueados")) {
    return "A eleição já foi aberta. Cargos e candidatos não podem mais ser alterados.";
  }
  if (message.includes("positions_unique_name")) {
    return "Já existe um cargo com esse nome nesta eleição.";
  }
  if (message.includes("violates foreign key")) {
    return "Este cargo já possui candidatos ou votos e não pode ser removido.";
  }
  return message;
}
