import "server-only";

import { createServiceClient } from "@/lib/supabase/service";

export type CandidateResult = {
  id: string;
  number: string;
  name: string;
  partyName: string | null;
  votes: number;
  pct: number;
};

export type PositionResult = {
  id: string;
  name: string;
  displayOrder: number;
  candidates: CandidateResult[];
  blankVotes: number;
  nullVotes: number;
  totalVotes: number;
};

export type Results = {
  turnout: { eligible: number; voted: number; absent: number; pct: number };
  positions: PositionResult[];
};

/**
 * Apuração a partir das views de agregação.
 *
 * As views só devolvem o que TEM voto. Cargo sem nenhum voto e candidato zerado
 * simplesmente não aparecem nelas — por isso a lista de cargos e candidatos é
 * lida à parte e usada como base. Candidato com zero voto precisa aparecer na
 * tela: some-lo pareceria erro de apuração.
 */
export async function loadResults(electionId: string): Promise<Results> {
  const db = createServiceClient();

  const [
    { data: positions },
    { data: candidates },
    { data: byCandidate },
    { data: totals },
    { data: turnout },
  ] = await Promise.all([
    db
      .from("positions")
      .select("id, name, display_order")
      .eq("election_id", electionId)
      .eq("is_active", true)
      .order("display_order"),
    db
      .from("candidates")
      .select("id, position_id, number, full_name, ballot_name, party_name")
      .eq("election_id", electionId)
      .eq("is_active", true),
    db
      .from("v_results_by_candidate")
      .select("position_id, candidate_id, votes")
      .eq("election_id", electionId),
    db
      .from("v_results_totals")
      .select("position_id, total_votes, blank_votes, null_votes")
      .eq("election_id", electionId),
    db
      .from("v_turnout")
      .select("eligible, voted, absent, turnout_pct")
      .eq("election_id", electionId)
      .maybeSingle(),
  ]);

  const votesByCandidate = new Map(
    (byCandidate ?? []).map((row) => [row.candidate_id, Number(row.votes ?? 0)]),
  );
  const totalsByPosition = new Map(
    (totals ?? []).map((row) => [row.position_id, row]),
  );

  const results: PositionResult[] = (positions ?? []).map((position) => {
    const totalsRow = totalsByPosition.get(position.id);
    const totalVotes = Number(totalsRow?.total_votes ?? 0);

    const list: CandidateResult[] = (candidates ?? [])
      .filter((candidate) => candidate.position_id === position.id)
      .map((candidate) => {
        const votes = votesByCandidate.get(candidate.id) ?? 0;
        return {
          id: candidate.id,
          number: candidate.number,
          name: candidate.ballot_name || candidate.full_name,
          partyName: candidate.party_name,
          votes,
          pct: totalVotes > 0 ? (votes / totalVotes) * 100 : 0,
        };
      })
      // Empate desempatado pelo número, só para a ordem não dançar entre cargas.
      .sort((a, b) => b.votes - a.votes || a.number.localeCompare(b.number));

    return {
      id: position.id,
      name: position.name,
      displayOrder: position.display_order,
      candidates: list,
      blankVotes: Number(totalsRow?.blank_votes ?? 0),
      nullVotes: Number(totalsRow?.null_votes ?? 0),
      totalVotes,
    };
  });

  return {
    turnout: {
      eligible: Number(turnout?.eligible ?? 0),
      voted: Number(turnout?.voted ?? 0),
      absent: Number(turnout?.absent ?? 0),
      pct: Number(turnout?.turnout_pct ?? 0),
    },
    positions: results,
  };
}

export type SectionProgress = {
  id: string;
  code: string;
  name: string;
  total: number;
  voted: number;
};

/**
 * Acompanhamento durante a votação: conta PESSOAS, nunca votos.
 *
 * Esta consulta não toca em `votes` — nem poderia dizer nada sobre resultado
 * parcial (doc 07 §4).
 */
export async function loadProgress(
  electionId: string,
): Promise<{ sections: SectionProgress[]; total: number; voted: number }> {
  const db = createServiceClient();

  const [{ data: sections }, { data: voters }] = await Promise.all([
    db.from("sections").select("id, code, name").eq("election_id", electionId).order("code"),
    db
      .from("election_voters")
      .select("section_id, status")
      .eq("election_id", electionId)
      .limit(5000),
  ]);

  const rows = voters ?? [];

  const list: SectionProgress[] = (sections ?? []).map((section) => {
    const ofSection = rows.filter((voter) => voter.section_id === section.id);
    return {
      id: section.id,
      code: section.code,
      name: section.name,
      total: ofSection.length,
      voted: ofSection.filter((voter) => voter.status === "voted").length,
    };
  });

  return {
    sections: list,
    total: rows.length,
    voted: rows.filter((voter) => voter.status === "voted").length,
  };
}
