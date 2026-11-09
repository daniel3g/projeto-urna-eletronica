import { NextResponse } from "next/server";

import { resolveTerminal } from "@/lib/auth/terminal";
import {
  listActiveSessions,
  listBallotBoxes,
  sweepExpiredReleases,
  type ActiveSession,
  type BallotBoxOption,
} from "@/lib/db/poll-worker";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Estado do terminal — o endpoint que a urna e o mesário consultam.
 *
 * Nesta etapa devolve apenas identidade e situação da eleição. O conteúdo
 * específico da urna (cargos liberados, sessão de votação) entra na Etapa 4,
 * quando `/api/ballot-box/state` do doc 06 §5 for implementado por completo.
 *
 * Repare no que NÃO sai daqui: nome, RM ou id de eleitor. A urna não recebe
 * identidade (doc 03 §4).
 */
export async function GET(request: Request) {
  const terminal = await resolveTerminal(request);

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

  const db = createServiceClient();

  const [{ data: election }, { data: section }] = await Promise.all([
    db
      .from("elections")
      .select("id, name, status")
      .eq("id", terminal.electionId)
      .maybeSingle(),
    db
      .from("sections")
      .select("id, code, name")
      .eq("id", terminal.sectionId)
      .maybeSingle(),
  ]);

  // Contadores da seção, só para o mesário: é o que ele acompanha durante o dia.
  // A urna não recebe nada disso — ela não precisa saber quem falta votar.
  let stats: { total: number; voted: number; pending: number } | null = null;

  // Mesa do mesário: as urnas da seção e quem está em cada uma. É o que mantém
  // "eleitor votando" na tela até a urna terminar.
  let desk: { ballotBoxes: BallotBoxOption[]; sessions: ActiveSession[] } | null =
    null;

  if (terminal.kind === "poll_worker") {
    // Liberações vencidas soltam a urna antes de a mesa ser montada.
    await sweepExpiredReleases(terminal.electionId);

    const [{ data: voters }, ballotBoxes] = await Promise.all([
      db
        .from("election_voters")
        .select("status")
        .eq("election_id", terminal.electionId)
        .eq("section_id", terminal.sectionId)
        .limit(5000),
      listBallotBoxes(terminal.electionId, terminal.sectionId),
    ]);

    const list = voters ?? [];
    const voted = list.filter((voter) => voter.status === "voted").length;
    stats = { total: list.length, voted, pending: list.length - voted };

    desk = {
      ballotBoxes,
      sessions: await listActiveSessions(terminal.electionId, ballotBoxes),
    };
  }

  // Estado da urna: existe eleitor liberado nesta máquina?
  //
  // O índice parcial `election_voters_one_active_per_ballot_box` garante que a
  // resposta é no máximo uma linha — por isso não há token de sessão. O vínculo
  // urna → eleitor já é único no banco, e o token do terminal é quem autentica.
  let session: { positionsCompleted: number } | null = null;
  let ballot: {
    positions: { id: string; name: string; digits: number; displayOrder: number }[];
  } | null = null;

  if (terminal.kind === "ballot_box") {
    const { data: voter } = await db
      .from("election_voters")
      .select("status, positions_completed")
      .eq("ballot_box_terminal_id", terminal.id)
      .in("status", ["released", "voting"])
      .maybeSingle();

    if (voter && election?.status === "open") {
      session = { positionsCompleted: voter.positions_completed };

      const { data: positions } = await db
        .from("positions")
        .select("id, name, digits, display_order")
        .eq("election_id", terminal.electionId)
        .eq("is_active", true)
        .order("display_order");

      ballot = {
        positions: (positions ?? []).map((position) => ({
          id: position.id,
          name: position.name,
          digits: position.digits,
          displayOrder: position.display_order,
        })),
      };
    }
  }

  // Repare no que NÃO sai daqui nem com sessão ativa: nome, RM, foto ou id do
  // eleitor. A urna não recebe identidade (doc 03 §4).
  return NextResponse.json({
    screen: session ? "voting" : "waiting",
    terminal: { id: terminal.id, kind: terminal.kind, label: terminal.label },
    election,
    section,
    stats,
    desk,
    session,
    ballot,
    realtime: { topic: `terminal:${terminal.id}` },
  });
}
