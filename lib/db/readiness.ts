import "server-only";

import type { ReadinessInput } from "@/lib/domain/readiness";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Carrega os números que alimentam evaluateReadiness().
 *
 * Existe como módulo próprio para que a página e a Server Action de abertura
 * enxerguem exatamente o mesmo estado — o checklist não pode dizer "pode abrir"
 * enquanto o servidor pensa outra coisa.
 */
export async function loadReadinessInput(
  electionId: string,
): Promise<ReadinessInput> {
  const db = createServiceClient();

  const [
    { data: positions },
    { data: candidates },
    { count: sectionCount },
    { data: terminals },
    { data: voters },
  ] = await Promise.all([
    db
      .from("positions")
      .select("id, name")
      .eq("election_id", electionId)
      .eq("is_active", true)
      .order("display_order"),
    db
      .from("candidates")
      .select("position_id")
      .eq("election_id", electionId)
      .eq("is_active", true),
    db
      .from("sections")
      .select("id", { count: "exact", head: true })
      .eq("election_id", electionId)
      .eq("is_active", true),
    db
      .from("terminals")
      .select("kind, paired_at, is_active")
      .eq("election_id", electionId),
    db
      .from("election_voters")
      .select("section_id")
      .eq("election_id", electionId)
      .limit(5000),
  ]);

  const candidatesByPosition = new Map<string, number>();
  for (const candidate of candidates ?? []) {
    candidatesByPosition.set(
      candidate.position_id,
      (candidatesByPosition.get(candidate.position_id) ?? 0) + 1,
    );
  }

  const paired = (terminals ?? []).filter(
    (terminal) => terminal.is_active && terminal.paired_at !== null,
  );

  const voterList = voters ?? [];

  return {
    activePositions: (positions ?? []).map((position) => ({
      id: position.id,
      name: position.name,
      activeCandidates: candidatesByPosition.get(position.id) ?? 0,
    })),
    sectionCount: sectionCount ?? 0,
    pairedBallotBoxes: paired.filter((t) => t.kind === "ballot_box").length,
    pairedPollWorkers: paired.filter((t) => t.kind === "poll_worker").length,
    voterCount: voterList.length,
    votersWithoutSection: voterList.filter((voter) => !voter.section_id).length,
  };
}
