"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth/admin";
import { createServiceClient } from "@/lib/supabase/service";

export type FormState = { error: string | null };

export async function createSection(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const electionId = String(formData.get("electionId") ?? "");
  const code = String(formData.get("code") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();

  if (!electionId) return { error: "Eleição não informada." };
  if (!code) return { error: "Informe o código da seção (ex.: 01)." };
  if (name.length < 2) return { error: "Informe o local da seção." };

  const db = createServiceClient();
  const { error } = await db
    .from("sections")
    .insert({ election_id: electionId, code, name });

  if (error) return { error: translate(error.message) };

  revalidatePath(`/admin/elections/${electionId}/sections`);
  return { error: null };
}

export async function deleteSection(formData: FormData) {
  await requireAdmin();

  const electionId = String(formData.get("electionId") ?? "");
  const sectionId = String(formData.get("sectionId") ?? "");
  const path = `/admin/elections/${electionId}/sections`;

  const db = createServiceClient();
  const { error } = await db.from("sections").delete().eq("id", sectionId);

  if (error) {
    redirect(`${path}?erro=${encodeURIComponent(translate(error.message))}`);
  }

  revalidatePath(path);
  redirect(path);
}

function translate(message: string): string {
  if (message.includes("sections_unique_code")) {
    return "Já existe uma seção com esse código nesta eleição.";
  }
  if (message.includes("violates foreign key")) {
    return "Esta seção tem eleitores associados e não pode ser removida.";
  }
  return message;
}
