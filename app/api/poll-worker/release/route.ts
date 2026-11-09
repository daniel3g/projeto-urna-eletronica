import { NextResponse } from "next/server";

import { resolveTerminal } from "@/lib/auth/terminal";
import { notifyPollWorkers, notifyTerminal } from "@/lib/realtime/broadcast";
import { createServiceClient } from "@/lib/supabase/service";

/** Tempo que o eleitor tem para chegar à urna antes da liberação expirar. */
const SESSION_MINUTES = 10;

function fail(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  const terminal = await resolveTerminal(request, "poll_worker");

  if (!terminal) {
    return fail(401, "terminal_not_paired", "Terminal não pareado.");
  }

  let body: { student_id?: string; ballot_box_terminal_id?: string };
  try {
    body = await request.json();
  } catch {
    return fail(400, "invalid_body", "Requisição inválida.");
  }

  const studentId = String(body.student_id ?? "");
  const ballotBoxId = String(body.ballot_box_terminal_id ?? "");

  if (!studentId || !ballotBoxId) {
    return fail(400, "invalid_body", "Informe o estudante e a urna.");
  }

  const db = createServiceClient();

  // 1. Eleição aberta.
  const { data: election } = await db
    .from("elections")
    .select("status")
    .eq("id", terminal.electionId)
    .maybeSingle();

  if (election?.status !== "open") {
    return fail(409, "election_not_open", "A eleição não está aberta.");
  }

  // 2. A urna existe, é urna mesmo, está pareada e é da seção deste mesário.
  const { data: ballotBox } = await db
    .from("terminals")
    .select("id, label, kind, section_id, is_active, paired_at")
    .eq("id", ballotBoxId)
    .eq("election_id", terminal.electionId)
    .maybeSingle();

  if (
    !ballotBox ||
    ballotBox.kind !== "ballot_box" ||
    !ballotBox.is_active ||
    !ballotBox.paired_at
  ) {
    return fail(409, "ballot_box_unavailable", "Urna indisponível.");
  }

  if (ballotBox.section_id !== terminal.sectionId) {
    return fail(
      403,
      "ballot_box_other_section",
      "Essa urna pertence a outra seção.",
    );
  }

  // 3. O eleitor participa da eleição e ainda está aguardando.
  const { data: voter } = await db
    .from("election_voters")
    .select("id, status")
    .eq("election_id", terminal.electionId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (!voter) {
    return fail(404, "voter_not_found", "Eleitor não participa desta eleição.");
  }

  if (voter.status === "voted") {
    return fail(409, "voter_already_voted", "Este eleitor já votou.");
  }

  if (voter.status !== "waiting") {
    return fail(409, "voter_already_released", "Este eleitor já foi liberado.");
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_MINUTES * 60 * 1000);

  // 4. Grava. O `.eq("status", "waiting")` fecha a corrida entre dois mesários,
  //    e o índice parcial no banco recusa uma segunda liberação na mesma urna.
  const { data: updated, error } = await db
    .from("election_voters")
    .update({
      status: "released",
      ballot_box_terminal_id: ballotBoxId,
      released_by_terminal_id: terminal.id,
      released_at: now.toISOString(),
      session_expires_at: expiresAt.toISOString(),
    })
    .eq("id", voter.id)
    .eq("status", "waiting")
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.message.includes("one_active_per_ballot_box")) {
      return fail(
        409,
        "ballot_box_busy",
        `A ${ballotBox.label} já está ocupada por outro eleitor.`,
      );
    }
    return fail(500, "release_failed", error.message);
  }

  if (!updated) {
    return fail(409, "voter_already_released", "Este eleitor já foi liberado.");
  }

  // 5. Avisa a urna. Se o broadcast falhar, a liberação continua valendo — a
  //    urna descobre pelo polling em até 3 s (doc 04 §5).
  //    As outras mesas da seção também veem a urna ocupada na hora.
  const [notified] = await Promise.all([
    notifyTerminal(ballotBoxId),
    notifyPollWorkers(terminal.electionId, terminal.sectionId),
  ]);

  return NextResponse.json({
    released_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    ballot_box_label: ballotBox.label,
    notified,
  });
}
