import { NextResponse } from "next/server";

import { resolveTerminal } from "@/lib/auth/terminal";
import { CANDIDATE_BUCKET, signPhotoUrls } from "@/lib/db/photos";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Procura o candidato pelo número digitado no cargo atual.
 *
 * Chamado quando o eleitor completa a quantidade de dígitos do cargo. Devolver
 * `found: false` NÃO registra voto nulo — apenas informa a urna para exibir
 * "NÚMERO ERRADO". Quem classifica o voto é a função cast_vote, no servidor.
 */
export async function GET(request: Request) {
  const terminal = await resolveTerminal(request, "ballot_box");

  if (!terminal) {
    return NextResponse.json(
      { error: { code: "terminal_not_paired", message: "Terminal não pareado." } },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const positionId = url.searchParams.get("position_id") ?? "";
  const number = url.searchParams.get("number") ?? "";

  if (!positionId || !/^[0-9]+$/.test(number)) {
    return NextResponse.json(
      { error: { code: "invalid_query", message: "Consulta inválida." } },
      { status: 400 },
    );
  }

  const db = createServiceClient();

  const { data: candidate } = await db
    .from("candidates")
    .select(
      "id, number, full_name, ballot_name, party_name, party_acronym, photo_path, deputy_name, deputy_photo_path",
    )
    .eq("election_id", terminal.electionId)
    .eq("position_id", positionId)
    .eq("number", number)
    .eq("is_active", true)
    .maybeSingle();

  if (!candidate) {
    return NextResponse.json({ found: false, candidate: null });
  }

  const photoUrls = await signPhotoUrls(CANDIDATE_BUCKET, [
    candidate.photo_path,
    candidate.deputy_photo_path,
  ]);

  return NextResponse.json({
    found: true,
    candidate: {
      number: candidate.number,
      name: candidate.ballot_name || candidate.full_name,
      fullName: candidate.full_name,
      partyName: candidate.party_name,
      partyAcronym: candidate.party_acronym,
      photoUrl: candidate.photo_path
        ? (photoUrls.get(candidate.photo_path) ?? null)
        : null,
      deputyName: candidate.deputy_name,
      deputyPhotoUrl: candidate.deputy_photo_path
        ? (photoUrls.get(candidate.deputy_photo_path) ?? null)
        : null,
    },
  });
}
