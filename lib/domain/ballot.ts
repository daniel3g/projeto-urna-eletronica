/**
 * Regras da digitação na urna — funções puras, sem I/O.
 *
 * São as regras do doc 05 §4. Ficam aqui, isoladas, porque é o miolo da
 * experiência do eleitor: o que cada tecla faz, e quando CONFIRMA vale.
 */

export type Entry = {
  /** Dígitos já digitados. */
  buffer: string;
  /** BRANCO selecionado e aguardando confirmação. */
  blank: boolean;
};

export const EMPTY_ENTRY: Entry = { buffer: "", blank: false };

export function pressDigit(entry: Entry, digit: string, digits: number): Entry {
  // Com BRANCO marcado, digitar não faz nada: o eleitor precisa CORRIGIR antes.
  if (entry.blank) return entry;
  if (entry.buffer.length >= digits) return entry;
  if (!/^[0-9]$/.test(digit)) return entry;

  return { buffer: entry.buffer + digit, blank: false };
}

/** CORRIGE sempre volta ao início do cargo — nunca apaga só um dígito. */
export function pressCorrect(): Entry {
  return EMPTY_ENTRY;
}

export function pressBlank(entry: Entry): Entry {
  // BRANCO só vale com o campo vazio; com dígitos digitados é ignorado.
  if (entry.buffer.length > 0) return entry;
  return { buffer: "", blank: true };
}

export function isComplete(entry: Entry, digits: number): boolean {
  return entry.blank || entry.buffer.length === digits;
}

/**
 * CONFIRMA com número incompleto é ignorado em silêncio, como na urna real —
 * sem mensagem de erro, sem bipe de reprovação.
 */
export function canConfirm(entry: Entry, digits: number): boolean {
  return isComplete(entry, digits);
}

export type VoteType = "candidate" | "blank" | "null";

/**
 * O que a urna ENVIA. A classificação final é do servidor: um número sem
 * candidato vira 'null' lá, não aqui.
 */
export function voteTypeFor(entry: Entry): VoteType {
  return entry.blank ? "blank" : "candidate";
}
