/**
 * Leitor de CSV sem dependência externa.
 *
 * Escrito para o que realmente chega de uma escola: planilha exportada do Excel
 * em português, que vem com BOM UTF-8, separador `;` e quebra de linha CRLF.
 * Função pura — nenhum I/O, testável isoladamente (doc 01 §2).
 */

export type Delimiter = "," | ";" | "\t";

const BOM = /^﻿/;
const DIACRITICS = /[̀-ͯ]/g;

export function detectDelimiter(firstLine: string): Delimiter {
  const counts: Record<Delimiter, number> = { ",": 0, ";": 0, "\t": 0 };
  let inQuotes = false;

  for (const char of firstLine) {
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && (char === "," || char === ";" || char === "\t")) {
      counts[char] += 1;
    }
  }

  const winner = (Object.keys(counts) as Delimiter[]).reduce((best, current) =>
    counts[current] > counts[best] ? current : best,
  );

  // Arquivo de uma coluna só: qualquer separador serve.
  return counts[winner] === 0 ? "," : winner;
}

/**
 * Devolve as linhas do CSV já sem BOM, com aspas resolvidas e linhas em branco
 * descartadas. Segue o RFC 4180 no que importa: aspas duplas escapam aspas.
 */
export function parseCsv(input: string, delimiter?: Delimiter): string[][] {
  const text = input
    .replace(BOM, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  const delim = delimiter ?? detectDelimiter(text.split("\n", 1)[0] ?? "");

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delim) {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

/** Minúsculas, sem acento e sem espaços — para comparar cabeçalhos. */
export function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .replace(/[^a-z0-9]/g, "");
}
