import type { Database } from "@/lib/db/types";

type Enums = Database["public"]["Enums"];

export const ELECTION_STATUS_LABEL: Record<Enums["election_status"], string> = {
  draft: "Rascunho",
  open: "Aberta",
  closed: "Encerrada",
};

export const VOTER_STATUS_LABEL: Record<Enums["voter_status"], string> = {
  waiting: "Aguardando",
  released: "Liberado",
  voting: "Votando",
  voted: "Votou",
};

export const VOTE_TYPE_LABEL: Record<Enums["vote_type"], string> = {
  candidate: "Candidato",
  blank: "Branco",
  null: "Nulo",
};

export const TERMINAL_KIND_LABEL: Record<Enums["terminal_kind"], string> = {
  poll_worker: "Terminal do mesário",
  ballot_box: "Urna",
};

export const ELECTION_STATUS_STYLE: Record<Enums["election_status"], string> = {
  draft: "bg-neutral-500/15 text-neutral-700 dark:text-neutral-300",
  open: "bg-green-500/15 text-green-700 dark:text-green-400",
  closed: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
};

export function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}
