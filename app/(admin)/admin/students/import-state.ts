import type { ImportIssue } from "@/lib/domain/students-import";

/**
 * Tipos e estado inicial da importação.
 *
 * Vivem fora de actions.ts porque um arquivo "use server" só pode exportar
 * funções async — exportar o objeto `emptyImportState` de lá quebra o build.
 */
export type ImportSummary = {
  total: number;
  toCreate: number;
  toUpdate: number;
  errors: number;
};

export type ImportState = {
  phase: "idle" | "preview" | "done";
  summary: ImportSummary | null;
  issues: ImportIssue[];
  sample: { rm: string; fullName: string; className: string | null }[];
  error: string | null;
};

export const emptyImportState: ImportState = {
  phase: "idle",
  summary: null,
  issues: [],
  sample: [],
  error: null,
};
