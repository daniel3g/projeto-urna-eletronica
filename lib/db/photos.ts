import "server-only";

import { createServiceClient } from "@/lib/supabase/service";

export const STUDENT_BUCKET = "student-photos";
export const CANDIDATE_BUCKET = "candidate-photos";

/** Uma hora: tempo de sobra para a página ser usada, curto para o link vazar. */
const SIGNED_URL_TTL = 3600;

/**
 * Assina vários caminhos de uma vez.
 *
 * Uma lista de 100 estudantes viraria 100 chamadas se cada foto fosse assinada
 * isoladamente; `createSignedUrls` resolve tudo em uma.
 */
export async function signPhotoUrls(
  bucket: string,
  paths: (string | null)[],
): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((path): path is string => !!path))];
  const signed = new Map<string, string>();

  if (unique.length === 0) return signed;

  const db = createServiceClient();
  const { data, error } = await db.storage
    .from(bucket)
    .createSignedUrls(unique, SIGNED_URL_TTL);

  if (error || !data) return signed;

  for (const item of data) {
    if (item.signedUrl && item.path) signed.set(item.path, item.signedUrl);
  }

  return signed;
}
