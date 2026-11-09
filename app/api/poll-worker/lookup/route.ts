import { NextResponse } from "next/server";

import { resolveTerminal } from "@/lib/auth/terminal";
import {
  buildVoterCards,
  listBallotBoxes,
  sweepExpiredReleases,
} from "@/lib/db/poll-worker";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Busca do eleitor pelo terminal do mesário.
 *
 * `?rm=` faz a busca exata (caminho principal, o mesário digita e aperta Enter).
 * `?q=` busca por nome, para quando o aluno não sabe o RM.
 */
export async function GET(request: Request) {
  const terminal = await resolveTerminal(request, "poll_worker");

  if (!terminal) {
    return NextResponse.json(
      {
        error: {
          code: "terminal_not_paired",
          message: "Terminal não pareado ou token revogado.",
        },
      },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const rm = (url.searchParams.get("rm") ?? "").trim();
  const q = (url.searchParams.get("q") ?? "").trim();

  if (!rm && q.length < 2) {
    return NextResponse.json(
      { error: { code: "invalid_query", message: "Informe o RM ou parte do nome." } },
      { status: 400 },
    );
  }

  const db = createServiceClient();

  const { data: election } = await db
    .from("elections")
    .select("id, name, status")
    .eq("id", terminal.electionId)
    .maybeSingle();

  // Aproveita a consulta para soltar urnas presas por sessão expirada.
  await sweepExpiredReleases(terminal.electionId);

  const query = db
    .from("students")
    .select("id, rm, full_name, class_name, photo_path")
    .eq("is_active", true);

  const { data: students } = rm
    ? await query.eq("rm", rm).limit(1)
    : await query.ilike("full_name", `%${q}%`).order("full_name").limit(10);

  const cards = await buildVoterCards(
    terminal.electionId,
    students ?? [],
    terminal.sectionId,
  );

  const ballotBoxes = await listBallotBoxes(
    terminal.electionId,
    terminal.sectionId,
  );

  return NextResponse.json({
    election,
    section_id: terminal.sectionId,
    results: cards,
    available_ballot_boxes: ballotBoxes,
  });
}
