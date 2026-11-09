import "server-only";

import { signPhotoUrls, STUDENT_BUCKET } from "@/lib/db/photos";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/db/types";

type VoterStatus = Database["public"]["Enums"]["voter_status"];

export type BallotBoxOption = {
  id: string;
  label: string;
  busy: boolean;
};

export type VoterCard = {
  student: {
    id: string;
    rm: string;
    fullName: string;
    className: string | null;
    photoUrl: string | null;
  };
  section: { id: string; code: string; name: string } | null;
  /** null = o estudante existe, mas não participa desta eleição. */
  voterStatus: VoterStatus | null;
  canRelease: boolean;
  blockedReason: string | null;
  releasedBallotBox: { id: string; label: string } | null;
  votedAt: string | null;
  /** Verdadeiro quando o eleitor é de outra seção — avisa, mas não impede. */
  otherSection: boolean;
};

/**
 * Sessões de liberação que expiraram voltam para AGUARDANDO, soltando a urna.
 *
 * Só mexe em `released`: quem está em `voting` já iniciou a votação de verdade
 * e não pode ser interrompido por relógio. Esse caso é destravado à mão pelo
 * administrador (doc 05 §6).
 */
export async function sweepExpiredReleases(electionId: string): Promise<void> {
  const db = createServiceClient();

  await db
    .from("election_voters")
    .update({
      status: "waiting",
      ballot_box_terminal_id: null,
      released_by_terminal_id: null,
      released_at: null,
      session_expires_at: null,
    })
    .eq("election_id", electionId)
    .eq("status", "released")
    .lt("session_expires_at", new Date().toISOString());
}

export async function listBallotBoxes(
  electionId: string,
  sectionId: string,
): Promise<BallotBoxOption[]> {
  const db = createServiceClient();

  const [{ data: terminals }, { data: active }] = await Promise.all([
    db
      .from("terminals")
      .select("id, label")
      .eq("election_id", electionId)
      .eq("section_id", sectionId)
      .eq("kind", "ballot_box")
      .eq("is_active", true)
      .not("paired_at", "is", null)
      .order("label"),
    db
      .from("election_voters")
      .select("ballot_box_terminal_id")
      .eq("election_id", electionId)
      .in("status", ["released", "voting"]),
  ]);

  const busy = new Set(
    (active ?? [])
      .map((row) => row.ballot_box_terminal_id)
      .filter((id): id is string => !!id),
  );

  return (terminals ?? []).map((terminal) => ({
    id: terminal.id,
    label: terminal.label,
    busy: busy.has(terminal.id),
  }));
}

export type ActiveSession = {
  ballotBox: { id: string; label: string };
  status: "released" | "voting";
  student: { id: string; rm: string; fullName: string };
};

/**
 * Quem está liberado ou votando nas urnas informadas — o painel fixo do mesário.
 *
 * Só serve ao terminal do mesário, que já vê nome e RM de quem atende. A urna
 * nunca recebe isto (doc 03 §4).
 */
export async function listActiveSessions(
  electionId: string,
  ballotBoxes: BallotBoxOption[],
): Promise<ActiveSession[]> {
  const busy = ballotBoxes.filter((box) => box.busy);
  if (busy.length === 0) return [];

  const db = createServiceClient();

  const { data: voters } = await db
    .from("election_voters")
    .select("student_id, status, ballot_box_terminal_id")
    .eq("election_id", electionId)
    .in("status", ["released", "voting"])
    .in(
      "ballot_box_terminal_id",
      busy.map((box) => box.id),
    );

  const rows = voters ?? [];
  if (rows.length === 0) return [];

  const { data: students } = await db
    .from("students")
    .select("id, rm, full_name")
    .in(
      "id",
      rows.map((row) => row.student_id),
    );

  const studentById = new Map((students ?? []).map((row) => [row.id, row]));
  const boxById = new Map(ballotBoxes.map((box) => [box.id, box]));

  return rows.flatMap((row) => {
    const box = row.ballot_box_terminal_id
      ? boxById.get(row.ballot_box_terminal_id)
      : undefined;
    const student = studentById.get(row.student_id);
    if (!box || !student) return [];
    if (row.status !== "released" && row.status !== "voting") return [];

    return [
      {
        ballotBox: { id: box.id, label: box.label },
        status: row.status,
        student: { id: student.id, rm: student.rm, fullName: student.full_name },
      },
    ];
  });
}

function describeBlock(
  status: VoterStatus | null,
  votedAt: string | null,
  ballotBoxLabel: string | null,
): string | null {
  if (status === null) {
    return "Este estudante não está associado a esta eleição.";
  }
  if (status === "voted") {
    const hour = votedAt
      ? new Intl.DateTimeFormat("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "America/Sao_Paulo",
        }).format(new Date(votedAt))
      : null;
    return hour ? `Este eleitor já votou às ${hour}.` : "Este eleitor já votou.";
  }
  if (status === "released") {
    return `Já liberado${ballotBoxLabel ? ` na ${ballotBoxLabel}` : ""}.`;
  }
  if (status === "voting") {
    return `Em votação${ballotBoxLabel ? ` na ${ballotBoxLabel}` : ""}.`;
  }
  return null;
}

/** Monta o cartão do eleitor a partir de uma lista de estudantes já encontrada. */
export async function buildVoterCards(
  electionId: string,
  students: {
    id: string;
    rm: string;
    full_name: string;
    class_name: string | null;
    photo_path: string | null;
  }[],
  poolWorkerSectionId: string,
): Promise<VoterCard[]> {
  if (students.length === 0) return [];

  const db = createServiceClient();

  const [{ data: voters }, photoUrls] = await Promise.all([
    db
      .from("election_voters")
      .select("student_id, status, voted_at, section_id, ballot_box_terminal_id")
      .eq("election_id", electionId)
      .in(
        "student_id",
        students.map((student) => student.id),
      ),
    signPhotoUrls(
      STUDENT_BUCKET,
      students.map((student) => student.photo_path),
    ),
  ]);

  const rows = voters ?? [];

  // Seção e urna vêm em consultas próprias, sem embedding do PostgREST.
  // As duas FKs aqui são COMPOSTAS — (section_id, election_id) e
  // (ballot_box_terminal_id, election_id) — e não vale apostar em como o
  // PostgREST as resolve: uma falha de embedding voltaria como lista vazia e o
  // cartão mostraria a situação errada sem erro nenhum. São no máximo 10 linhas.
  const sectionIds = [
    ...new Set(rows.map((row) => row.section_id).filter((id): id is string => !!id)),
  ];
  const terminalIds = [
    ...new Set(
      rows
        .map((row) => row.ballot_box_terminal_id)
        .filter((id): id is string => !!id),
    ),
  ];

  const [{ data: sections }, { data: terminals }] = await Promise.all([
    sectionIds.length
      ? db.from("sections").select("id, code, name").in("id", sectionIds)
      : Promise.resolve({ data: [] as { id: string; code: string; name: string }[] }),
    terminalIds.length
      ? db.from("terminals").select("id, label").in("id", terminalIds)
      : Promise.resolve({ data: [] as { id: string; label: string }[] }),
  ]);

  const sectionById = new Map((sections ?? []).map((row) => [row.id, row]));
  const terminalById = new Map((terminals ?? []).map((row) => [row.id, row]));

  const byStudent = new Map(rows.map((row) => [row.student_id, row]));

  return students.map((student) => {
    const voter = byStudent.get(student.id);
    const status = voter?.status ?? null;
    const ballotBox = voter?.ballot_box_terminal_id
      ? (terminalById.get(voter.ballot_box_terminal_id) ?? null)
      : null;
    const section = voter?.section_id
      ? (sectionById.get(voter.section_id) ?? null)
      : null;

    const blockedReason = describeBlock(
      status,
      voter?.voted_at ?? null,
      ballotBox?.label ?? null,
    );

    return {
      student: {
        id: student.id,
        rm: student.rm,
        fullName: student.full_name,
        className: student.class_name,
        photoUrl: student.photo_path
          ? (photoUrls.get(student.photo_path) ?? null)
          : null,
      },
      section,
      voterStatus: status,
      canRelease: status === "waiting",
      blockedReason,
      releasedBallotBox: ballotBox,
      votedAt: voter?.voted_at ?? null,
      otherSection:
        !!voter?.section_id && voter.section_id !== poolWorkerSectionId,
    };
  });
}
