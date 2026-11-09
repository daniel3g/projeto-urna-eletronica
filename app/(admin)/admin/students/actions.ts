"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth/admin";
import { parseStudentsCsv } from "@/lib/domain/students-import";
import { createServiceClient } from "@/lib/supabase/service";

import { emptyImportState, type ImportState, type ImportSummary } from "./import-state";

export type FormState = { error: string | null };

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const CHUNK = 500;

export async function createStudent(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const rm = String(formData.get("rm") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const className = String(formData.get("className") ?? "").trim();

  if (!rm) return { error: "Informe o RM." };
  if (fullName.length < 3) return { error: "Informe o nome do estudante." };

  const db = createServiceClient();
  const { error } = await db.from("students").insert({
    rm,
    full_name: fullName,
    class_name: className || null,
  });

  if (error) return { error: translate(error.message, rm) };

  revalidatePath("/admin/students");
  return { error: null };
}

export async function toggleStudent(formData: FormData) {
  await requireAdmin();

  const studentId = String(formData.get("studentId") ?? "");
  const nextActive = String(formData.get("nextActive") ?? "") === "true";
  const query = String(formData.get("q") ?? "");

  const db = createServiceClient();
  await db
    .from("students")
    .update({ is_active: nextActive })
    .eq("id", studentId);

  revalidatePath("/admin/students");
  redirect(query ? `/admin/students?q=${encodeURIComponent(query)}` : "/admin/students");
}

// --------------------------------------------------------------- importação

/**
 * Importa estudantes em duas etapas.
 *
 * O botão "Analisar" envia com commit=false e devolve o resumo; o botão de
 * confirmação reenvia o MESMO arquivo com commit=true. Reprocessar o CSV é
 * barato e evita carregar centenas de linhas em estado escondido do formulário.
 */
export async function importStudents(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  await requireAdmin();

  const commit = String(formData.get("commit") ?? "") === "true";
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { ...emptyImportState, error: "Escolha um arquivo CSV." };
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ...emptyImportState,
      error: "Arquivo muito grande. O limite é 2 MB.",
    };
  }

  const { rows, issues } = parseStudentsCsv(await file.text());

  if (rows.length === 0) {
    return {
      ...emptyImportState,
      issues,
      error:
        "Nenhuma linha válida encontrada. Confira se o arquivo tem as colunas rm e nome.",
    };
  }

  const db = createServiceClient();

  // Quais RMs já existem, para separar criação de atualização no resumo.
  const existing = new Set<string>();
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK).map((row) => row.rm);
    const { data, error } = await db
      .from("students")
      .select("rm")
      .in("rm", slice);

    if (error) {
      return { ...emptyImportState, error: `Falha ao consultar o banco: ${error.message}` };
    }
    for (const found of data ?? []) existing.add(found.rm);
  }

  const summary: ImportSummary = {
    total: rows.length + issues.length,
    toCreate: rows.filter((row) => !existing.has(row.rm)).length,
    toUpdate: rows.filter((row) => existing.has(row.rm)).length,
    errors: issues.length,
  };

  const sample = rows.slice(0, 5).map((row) => ({
    rm: row.rm,
    fullName: row.fullName,
    className: row.className,
  }));

  if (!commit) {
    return { phase: "preview", summary, issues, sample, error: null };
  }

  for (let i = 0; i < rows.length; i += CHUNK) {
    const payload = rows.slice(i, i + CHUNK).map((row) => ({
      rm: row.rm,
      full_name: row.fullName,
      class_name: row.className,
    }));

    // upsert por rm: o aluno existente tem nome e turma atualizados, e a foto
    // que já estiver cadastrada permanece — photo_path não vai no payload.
    const { error } = await db
      .from("students")
      .upsert(payload, { onConflict: "rm" });

    if (error) {
      return {
        phase: "preview",
        summary,
        issues,
        sample,
        error: `Falha ao gravar a partir da linha ${rows[i].line}: ${error.message}`,
      };
    }
  }

  revalidatePath("/admin/students");
  return { phase: "done", summary, issues, sample, error: null };
}

function translate(message: string, rm: string): string {
  if (message.includes("students_rm_unique")) {
    return `Já existe um estudante com o RM ${rm}.`;
  }
  if (message.includes("students_rm_format")) {
    return "RM inválido. Use até 20 caracteres entre letras, números, ponto, hífen e sublinhado.";
  }
  return message;
}
