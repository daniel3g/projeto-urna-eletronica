import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/db/types";

type TerminalKind = Database["public"]["Enums"]["terminal_kind"];

/** Sem I, O, 0 e 1: quem digita o código no dia não erra por causa da fonte. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

export const PAIRING_CODE_TTL_MINUTES = 30;

export function generatePairingCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}

/** `K7MP2Q` → `K7M-P2Q`, só para exibição. */
export function formatPairingCode(code: string): string {
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

/** Aceita o que o usuário digitar: hífen, espaço, minúscula. */
export function normalizePairingCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function generateTerminalToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashTerminalToken(token: string): string {
  const pepper = process.env.TERMINAL_TOKEN_PEPPER;

  if (!pepper) {
    throw new Error(
      "TERMINAL_TOKEN_PEPPER não está definida. Gere uma com " +
        '`node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64url\'))"` ' +
        "e coloque no .env.local.",
    );
  }

  return createHash("sha256").update(`${token}${pepper}`).digest("hex");
}

export type ResolvedTerminal = {
  id: string;
  kind: TerminalKind;
  label: string;
  electionId: string;
  sectionId: string;
};

function readBearer(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token || null;
}

/**
 * Resolve o terminal a partir do header Authorization.
 *
 * Devolve null para token ausente, inválido, revogado ou de tipo errado — o
 * chamador decide entre 401 e 403. Atualiza `last_seen_at` de passagem, que é o
 * que alimenta o monitoramento de terminais no painel.
 */
export async function resolveTerminal(
  request: Request,
  expectedKind?: TerminalKind,
): Promise<ResolvedTerminal | null> {
  const token = readBearer(request);
  if (!token) return null;

  const db = createServiceClient();

  const { data: terminal } = await db
    .from("terminals")
    .select("id, kind, label, election_id, section_id, is_active")
    .eq("token_hash", hashTerminalToken(token))
    .maybeSingle();

  if (!terminal || !terminal.is_active) return null;
  if (expectedKind && terminal.kind !== expectedKind) return null;

  await db
    .from("terminals")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", terminal.id);

  return {
    id: terminal.id,
    kind: terminal.kind,
    label: terminal.label,
    electionId: terminal.election_id,
    sectionId: terminal.section_id,
  };
}
