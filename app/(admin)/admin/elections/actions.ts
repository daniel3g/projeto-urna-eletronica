"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth/admin";
import { createServiceClient } from "@/lib/supabase/service";

export type FormState = { error: string | null };

export async function createElection(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (name.length < 3) {
    return { error: "O nome da eleição precisa ter ao menos 3 caracteres." };
  }

  const db = createServiceClient();
  const { data, error } = await db
    .from("elections")
    .insert({
      name,
      description: description || null,
      created_by: admin.userId,
    })
    .select("id")
    .single();

  if (error) {
    return { error: `Não foi possível criar a eleição: ${error.message}` };
  }

  revalidatePath("/admin");
  redirect(`/admin/elections/${data.id}`);
}
