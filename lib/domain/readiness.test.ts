import { describe, expect, it } from "vitest";

import { evaluateReadiness, type ReadinessInput } from "./readiness";

const READY: ReadinessInput = {
  activePositions: [
    { id: "p1", name: "Presidente", activeCandidates: 2 },
    { id: "p2", name: "Vice", activeCandidates: 1 },
  ],
  sectionCount: 2,
  pairedBallotBoxes: 2,
  pairedPollWorkers: 1,
  voterCount: 30,
  votersWithoutSection: 0,
};

function check(input: ReadinessInput, id: string) {
  const found = evaluateReadiness(input).checks.find((c) => c.id === id);
  if (!found) throw new Error(`check ${id} não existe`);
  return found;
}

describe("evaluateReadiness", () => {
  it("eleição completa pode abrir, sem bloqueios", () => {
    const result = evaluateReadiness(READY);
    expect(result.canOpen).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(result.checks.every((c) => c.ok)).toBe(true);
  });

  it.each([
    ["sections", { sectionCount: 0 }],
    ["ballot-box", { pairedBallotBoxes: 0 }],
    ["poll-worker", { pairedPollWorkers: 0 }],
    ["voters", { voterCount: 0 }],
  ] as const)("falta de %s bloqueia a abertura", (id, patch) => {
    const input = { ...READY, ...patch };
    const result = evaluateReadiness(input);
    expect(result.canOpen).toBe(false);
    expect(result.blockers).toEqual([check(input, id).label]);
  });

  it("sem cargos bloqueia também a regra de candidatos", () => {
    const input = { ...READY, activePositions: [] };
    const result = evaluateReadiness(input);
    expect(result.canOpen).toBe(false);
    expect(check(input, "positions").ok).toBe(false);
    expect(check(input, "candidates").ok).toBe(false);
    expect(result.blockers).toHaveLength(2);
  });

  it("cargo sem candidato bloqueia e é nomeado no detalhe", () => {
    const input: ReadinessInput = {
      ...READY,
      activePositions: [
        { id: "p1", name: "Presidente", activeCandidates: 2 },
        { id: "p2", name: "Vice", activeCandidates: 0 },
        { id: "p3", name: "Tesoureiro", activeCandidates: 0 },
      ],
    };
    const candidates = check(input, "candidates");
    expect(evaluateReadiness(input).canOpen).toBe(false);
    expect(candidates.ok).toBe(false);
    expect(candidates.detail).toBe("sem candidato: Vice, Tesoureiro");
  });

  it("eleitor sem seção é só aviso — não impede a abertura", () => {
    const input = { ...READY, votersWithoutSection: 3 };
    const result = evaluateReadiness(input);
    const voters = check(input, "voters-section");
    expect(result.canOpen).toBe(true);
    expect(voters.ok).toBe(false);
    expect(voters.blocking).toBe(false);
    expect(voters.detail).toContain("3 sem seção");
  });

  it("singular e plural no detalhe", () => {
    const one = {
      ...READY,
      activePositions: [READY.activePositions[0]],
      sectionCount: 1,
      voterCount: 1,
    };
    expect(check(one, "positions").detail).toBe("1 cargo");
    expect(check(one, "sections").detail).toBe("1 seção");
    expect(check(one, "voters").detail).toBe("1 eleitor");
    expect(check(READY, "positions").detail).toBe("2 cargos");
    expect(check(READY, "sections").detail).toBe("2 seções");
  });
});
