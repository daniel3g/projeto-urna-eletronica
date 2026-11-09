"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/admin";
import { CANDIDATE_BUCKET, STUDENT_BUCKET } from "@/lib/db/photos";
import { createServiceClient } from "@/lib/supabase/service";

export type PhotoResult = { error: string | null };

const MAX_BYTES = 200 * 1024;

type Resolved = {
  bucket: string;
  path: string;
  apply: (photoPath: string | null) => Promise<{ error: string | null }>;
};

/**
 * O caminho do objeto é decidido AQUI, nunca enviado pelo cliente — quem escolhe
 * onde grava é o servidor. Convenção em docs/08-storage.md §2.
 */
async function resolveTarget(
  kind: string,
  id: string,
  extension: string,
): Promise<Resolved | null> {
  const db = createServiceClient();

  if (kind === "student") {
    const { data } = await db
      .from("students")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (!data) return null;

    return {
      bucket: STUDENT_BUCKET,
      path: `${id}.${extension}`,
      apply: async (photoPath) => {
        const { error } = await db
          .from("students")
          .update({ photo_path: photoPath })
          .eq("id", id);
        return { error: error?.message ?? null };
      },
    };
  }

  if (kind === "candidate" || kind === "candidate-deputy") {
    const { data } = await db
      .from("candidates")
      .select("id, election_id")
      .eq("id", id)
      .maybeSingle();
    if (!data) return null;

    const isDeputy = kind === "candidate-deputy";

    return {
      bucket: CANDIDATE_BUCKET,
      path: `${data.election_id}/${id}${isDeputy ? "-vice" : ""}.${extension}`,
      apply: async (photoPath) => {
        // Ramificação explícita em vez de chave computada: com `{ [column]: ... }`
        // o TypeScript perde o nome da coluna e o update deixa de ser tipado.
        const { error } = await db
          .from("candidates")
          .update(
            isDeputy
              ? { deputy_photo_path: photoPath }
              : { photo_path: photoPath },
          )
          .eq("id", id);
        return { error: error?.message ?? null };
      },
    };
  }

  return null;
}

/** Confere os bytes iniciais em vez de confiar no Content-Type declarado. */
function sniff(bytes: Uint8Array): "webp" | "jpeg" | "png" | null {
  if (
    bytes.length > 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "webp";
  }
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }
  if (
    bytes.length > 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  ) {
    return "png";
  }
  return null;
}

export async function uploadPhoto(formData: FormData): Promise<PhotoResult> {
  await requireAdmin();

  const kind = String(formData.get("kind") ?? "");
  const id = String(formData.get("id") ?? "");
  const revalidate = String(formData.get("revalidate") ?? "");
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Nenhuma imagem recebida." };
  }

  if (file.size > MAX_BYTES) {
    return { error: "A imagem processada ficou grande demais. Tente outra foto." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = sniff(bytes);

  if (!format) {
    return { error: "O arquivo não é uma imagem WebP, JPEG ou PNG válida." };
  }

  const extension = format === "jpeg" ? "jpg" : format;
  const target = await resolveTarget(kind, id, extension);

  if (!target) return { error: "Registro não encontrado." };

  const db = createServiceClient();

  const { error: uploadError } = await db.storage
    .from(target.bucket)
    .upload(target.path, bytes, {
      contentType: `image/${format}`,
      upsert: true,
    });

  if (uploadError) {
    return { error: `Falha ao enviar a imagem: ${uploadError.message}` };
  }

  const { error: applyError } = await target.apply(target.path);
  if (applyError) return { error: applyError };

  if (revalidate) revalidatePath(revalidate);
  return { error: null };
}

export async function removePhoto(formData: FormData): Promise<PhotoResult> {
  await requireAdmin();

  const kind = String(formData.get("kind") ?? "");
  const id = String(formData.get("id") ?? "");
  const currentPath = String(formData.get("currentPath") ?? "");
  const revalidate = String(formData.get("revalidate") ?? "");

  const target = await resolveTarget(kind, id, "webp");
  if (!target) return { error: "Registro não encontrado." };

  const db = createServiceClient();

  if (currentPath) {
    // Se a remoção do objeto falhar, ainda assim zeramos a referência: uma foto
    // órfã no bucket é bem menos ruim do que um caminho quebrado no banco.
    await db.storage.from(target.bucket).remove([currentPath]);
  }

  const { error } = await target.apply(null);
  if (error) return { error };

  if (revalidate) revalidatePath(revalidate);
  return { error: null };
}
