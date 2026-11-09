import { NextResponse } from "next/server";

import { resolveTerminal } from "@/lib/auth/terminal";
import { notifyPollWorkers } from "@/lib/realtime/broadcast";
import { createServiceClient } from "@/lib/supabase/service";

const MESSAGES: Record<string, string> = {
  no_session: "Nenhum eleitor liberado nesta urna.",
  election_not_open: "A eleição não está aberta.",
  position_out_of_order: "Cargo fora de ordem. A urna vai recarregar.",
};

/**
 * Registra o voto de um cargo.
 *
 * Todo o trabalho acontece dentro de public.cast_vote, em uma transação: o
 * insert em `votes` e o avanço do eleitor são inseparáveis. Este handler só
 * autentica o terminal e traduz o resultado.
 *
 * O corpo NUNCA contém identificador de eleitor. O vínculo urna → eleitor vive
 * no banco, e some no instante em que a votação termina.
 */
export async function POST(request: Request) {
  const terminal = await resolveTerminal(request, "ballot_box");

  if (!terminal) {
    return NextResponse.json(
      { error: { code: "terminal_not_paired", message: "Terminal não pareado." } },
      { status: 401 },
    );
  }

  let body: {
    position_id?: string;
    position_order?: number;
    vote_type?: string;
    candidate_number?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "invalid_body", message: "Requisição inválida." } },
      { status: 400 },
    );
  }

  const voteType = body.vote_type;

  if (voteType !== "candidate" && voteType !== "blank" && voteType !== "null") {
    return NextResponse.json(
      { error: { code: "invalid_body", message: "Tipo de voto inválido." } },
      { status: 400 },
    );
  }

  const db = createServiceClient();

  const { data, error } = await db.rpc("cast_vote", {
    p_terminal_id: terminal.id,
    p_position_id: String(body.position_id ?? ""),
    p_position_order: Number(body.position_order ?? 0),
    p_vote_type: voteType,
    // O parâmetro tem default no Postgres, então o tipo gerado é `undefined`,
    // não `null` — enviar null explicitamente não passa na tipagem.
    p_candidate_number: body.candidate_number ?? undefined,
  });

  if (error) {
    // Vai para o log do servidor: no dia da eleição, "erro 500" na tela da urna
    // não diz nada a ninguém. A causa precisa estar legível em algum lugar.
    console.error("[cast_vote]", {
      terminal: terminal.label,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });

    return NextResponse.json(
      { error: { code: "vote_failed", message: error.message } },
      { status: 500 },
    );
  }

  const result = data as {
    ok: boolean;
    code?: string;
    recorded?: boolean;
    reason?: string;
    vote_type?: string;
    positions_completed?: number;
    finished?: boolean;
  };

  if (!result.ok) {
    const code = result.code ?? "vote_failed";
    return NextResponse.json(
      { error: { code, message: MESSAGES[code] ?? "Não foi possível registrar." } },
      { status: code === "no_session" ? 409 : 409 },
    );
  }

  // A mesa do mesário muda em dois momentos: o eleitor começou (LIBERADO →
  // VOTANDO) e terminou (urna livre). O aviso não leva conteúdo de voto — só
  // "seu estado mudou" — e uma falha aqui é coberta pelo polling.
  const positionsCompleted = result.positions_completed ?? 0;
  if (result.recorded && (positionsCompleted === 1 || result.finished)) {
    await notifyPollWorkers(terminal.electionId, terminal.sectionId);
  }

  return NextResponse.json({
    recorded: result.recorded ?? false,
    reason: result.reason ?? null,
    voteType: result.vote_type ?? voteType,
    positionsCompleted,
    finished: result.finished ?? false,
  });
}
