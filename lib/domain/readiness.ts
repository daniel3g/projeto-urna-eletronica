/**
 * Avaliação de prontidão de uma eleição — função pura, sem I/O.
 *
 * As pré-condições vêm do doc 05 §1. A regra de ouro: esta função é a mesma
 * consultada pela tela e pela Server Action que abre a eleição. A interface
 * nunca decide sozinha se pode abrir.
 */

export type ReadinessInput = {
  activePositions: { id: string; name: string; activeCandidates: number }[];
  sectionCount: number;
  pairedBallotBoxes: number;
  pairedPollWorkers: number;
  voterCount: number;
  votersWithoutSection: number;
};

export type Check = {
  id: string;
  label: string;
  ok: boolean;
  detail: string | null;
  /** Falso = apenas um aviso; não impede a abertura. */
  blocking: boolean;
};

export type Readiness = {
  checks: Check[];
  canOpen: boolean;
  blockers: string[];
};

export function evaluateReadiness(input: ReadinessInput): Readiness {
  const emptyPositions = input.activePositions.filter(
    (position) => position.activeCandidates === 0,
  );

  const checks: Check[] = [
    {
      id: "positions",
      label: "Ao menos um cargo cadastrado",
      ok: input.activePositions.length > 0,
      detail:
        input.activePositions.length > 0
          ? `${input.activePositions.length} ${input.activePositions.length === 1 ? "cargo" : "cargos"}`
          : "Nenhum cargo — a urna não teria o que apresentar.",
      blocking: true,
    },
    {
      id: "candidates",
      label: "Todo cargo com ao menos um candidato",
      ok: input.activePositions.length > 0 && emptyPositions.length === 0,
      detail:
        emptyPositions.length > 0
          ? `sem candidato: ${emptyPositions.map((position) => position.name).join(", ")}`
          : input.activePositions.length > 0
            ? "todos os cargos preenchidos"
            : "depende do cadastro de cargos",
      blocking: true,
    },
    {
      id: "sections",
      label: "Ao menos uma seção",
      ok: input.sectionCount > 0,
      detail:
        input.sectionCount > 0
          ? `${input.sectionCount} ${input.sectionCount === 1 ? "seção" : "seções"}`
          : "Mesmo uma eleição em uma sala só precisa de uma seção.",
      blocking: true,
    },
    {
      id: "ballot-box",
      label: "Ao menos uma urna pareada",
      ok: input.pairedBallotBoxes > 0,
      detail:
        input.pairedBallotBoxes > 0
          ? `${input.pairedBallotBoxes} ${input.pairedBallotBoxes === 1 ? "urna pareada" : "urnas pareadas"}`
          : "Nenhuma urna pareada.",
      blocking: true,
    },
    {
      id: "poll-worker",
      label: "Ao menos um terminal de mesário pareado",
      ok: input.pairedPollWorkers > 0,
      detail:
        input.pairedPollWorkers > 0
          ? `${input.pairedPollWorkers} ${input.pairedPollWorkers === 1 ? "terminal pareado" : "terminais pareados"}`
          : "Nenhum terminal de mesário pareado.",
      blocking: true,
    },
    {
      id: "voters",
      label: "Ao menos um eleitor associado",
      ok: input.voterCount > 0,
      detail:
        input.voterCount > 0
          ? `${input.voterCount} ${input.voterCount === 1 ? "eleitor" : "eleitores"}`
          : "Nenhum estudante associado à eleição.",
      blocking: true,
    },
    {
      id: "voters-section",
      label: "Todos os eleitores com seção definida",
      ok: input.votersWithoutSection === 0,
      detail:
        input.votersWithoutSection === 0
          ? "distribuição completa"
          : `${input.votersWithoutSection} sem seção — poderão votar em qualquer urna`,
      blocking: false,
    },
  ];

  const blockers = checks
    .filter((check) => check.blocking && !check.ok)
    .map((check) => check.label);

  return { checks, canOpen: blockers.length === 0, blockers };
}
