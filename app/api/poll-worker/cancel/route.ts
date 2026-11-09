import { NextResponse } from "next/server";

import { resolveTerminal } from "@/lib/auth/terminal";
import { notifyTerminal } from "@/lib/realtime/broadcast";
import { createServiceClient } from "@/lib/supabase/service";

function fail(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * Cancela uma liberação — o aluno desistiu, foi embora, ou o mesário errou.
 *
 * Só vale enquanto a urna não iniciou a votação. Depois de `voting`, o aluno
 * está diante da urna e destravar é ação do administrador (doc 05 §6).
 */
export async function POST(request: Request) {
  const terminal = await resolveTerminal(request, "poll_worker");

  if (!terminal) {
    return fail(401, "terminal_not_paired", "Terminal não pareado.");
  }

  let body: { student_id?: string };
  try {
    body = await request.json();
  } catch {
    return fail(400, "invalid_body", "Requisição inválida.");
  }

  const studentId = String(body.student_id ?? "");
  if (!studentId) return fail(400, "invalid_body", "Informe o estudante.");

  const db = createServiceClient();

  const { data: voter } = await db
    .from("election_voters")
    .select("id, status, ballot_box_terminal_id")
    .eq("election_id", terminal.electionId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (!voter) return fail(404, "voter_not_found", "Eleitor não encontrado.");

  if (voter.status !== "released") {
    return fail(
      409,
      "voter_not_released",
      voter.status === "voting"
        ? "A urna já iniciou a votação. Peça ao administrador para destravar."
        : "Este eleitor não está liberado.",
    );
  }

  const ballotBoxId = voter.ballot_box_terminal_id;

  const { error } = await db
    .from("election_voters")
    .update({
      status: "waiting",
      ballot_box_terminal_id: null,
      released_by_terminal_id: null,
      released_at: null,
      session_expires_at: null,
    })
    .eq("id", voter.id)
    .eq("status", "released");

  if (error) return fail(500, "cancel_failed", error.message);

  // A urna precisa voltar para a tela de espera.
  if (ballotBoxId) await notifyTerminal(ballotBoxId);

  return NextResponse.json({ cancelled: true });
}
