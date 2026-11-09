import { NextResponse } from "next/server";

import {
  generateTerminalToken,
  hashTerminalToken,
  normalizePairingCode,
} from "@/lib/auth/terminal";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Pareamento de terminal. Único endpoint público da aplicação.
 *
 * Protegido por três coisas: o código tem 32^6 combinações (~1 bilhão), vale por
 * 30 minutos e é de uso único. O limitador abaixo é defesa em profundidade.
 */

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;

/**
 * Limitador em memória: vale por instância. Em serverless, várias instâncias
 * significam vários contadores independentes. Suficiente para o cenário real
 * (uma escola, uma rede), e não é a barreira principal.
 */
const attempts = new Map<string, { count: number; resetAt: number }>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const current = attempts.get(key);

  if (!current || now > current.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  current.count += 1;
  return current.count > MAX_ATTEMPTS;
}

function fail(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";

  if (rateLimited(ip)) {
    return fail(
      429,
      "too_many_attempts",
      "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "invalid_body", "Requisição inválida.");
  }

  const raw =
    typeof body === "object" && body !== null && "pairing_code" in body
      ? String((body as { pairing_code: unknown }).pairing_code ?? "")
      : "";

  const code = normalizePairingCode(raw);

  if (code.length !== 6) {
    return fail(400, "invalid_pairing_code", "O código tem 6 caracteres.");
  }

  const db = createServiceClient();

  const { data: terminal } = await db
    .from("terminals")
    .select(
      "id, kind, label, is_active, pairing_code_expires_at, election_id, section_id",
    )
    .eq("pairing_code", code)
    .maybeSingle();

  if (!terminal || !terminal.is_active) {
    return fail(
      404,
      "invalid_pairing_code",
      "Código não encontrado. Confira com o administrador.",
    );
  }

  const expiresAt = terminal.pairing_code_expires_at
    ? new Date(terminal.pairing_code_expires_at)
    : null;

  if (!expiresAt || expiresAt.getTime() < Date.now()) {
    return fail(
      410,
      "pairing_code_expired",
      "Código expirado. Peça um novo ao administrador.",
    );
  }

  const token = generateTerminalToken();

  // Uso único: o código sai no mesmo update que grava o hash do token.
  const { error } = await db
    .from("terminals")
    .update({
      token_hash: hashTerminalToken(token),
      pairing_code: null,
      pairing_code_expires_at: null,
      paired_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    })
    .eq("id", terminal.id)
    .eq("pairing_code", code); // corrida: só o primeiro a chegar pareia

  if (error) {
    return fail(500, "pairing_failed", "Falha ao parear. Tente novamente.");
  }

  const [{ data: election }, { data: section }] = await Promise.all([
    db
      .from("elections")
      .select("id, name, status")
      .eq("id", terminal.election_id)
      .maybeSingle(),
    db
      .from("sections")
      .select("id, code, name")
      .eq("id", terminal.section_id)
      .maybeSingle(),
  ]);

  // O token vai embora aqui uma única vez. Perdido, gera-se outro código.
  return NextResponse.json({
    terminal_token: token,
    terminal: { id: terminal.id, kind: terminal.kind, label: terminal.label },
    election,
    section,
  });
}
