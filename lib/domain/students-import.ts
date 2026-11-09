import { normalizeHeader, parseCsv } from "./csv";

export type ParsedStudent = {
  line: number;
  rm: string;
  fullName: string;
  className: string | null;
};

export type ImportIssue = {
  line: number;
  rm: string;
  message: string;
};

export type ParseResult = {
  rows: ParsedStudent[];
  issues: ImportIssue[];
  hasHeader: boolean;
};

/** Mesma regra do check `students_rm_format` no banco. */
const RM_FORMAT = /^[0-9A-Za-z._-]{1,20}$/;

const RM_ALIASES = new Set(["rm", "ra", "matricula", "registro", "codigo"]);
const NAME_ALIASES = new Set(["nome", "aluno", "estudante", "nomecompleto"]);
const CLASS_ALIASES = new Set(["turma", "classe", "serie", "sala", "curso"]);

type ColumnMap = { rm: number; name: number; className: number | null };

function mapColumns(header: string[]): ColumnMap | null {
  const normalized = header.map(normalizeHeader);

  const rm = normalized.findIndex((cell) => RM_ALIASES.has(cell));
  const name = normalized.findIndex((cell) => NAME_ALIASES.has(cell));
  const className = normalized.findIndex((cell) => CLASS_ALIASES.has(cell));

  if (rm === -1 || name === -1) return null;

  return { rm, name, className: className === -1 ? null : className };
}

/**
 * Interpreta o CSV de estudantes.
 *
 * Aceita cabeçalho (`rm,nome,turma`, em qualquer ordem, com ou sem acento) ou
 * arquivo sem cabeçalho, caso em que assume a ordem posicional rm, nome, turma.
 * Nunca lança: tudo que estiver errado vira uma linha em `issues`, para o
 * administrador ver o problema antes de gravar qualquer coisa.
 */
export function parseStudentsCsv(content: string): ParseResult {
  const table = parseCsv(content);

  if (table.length === 0) {
    return {
      rows: [],
      issues: [{ line: 0, rm: "", message: "O arquivo está vazio." }],
      hasHeader: false,
    };
  }

  const mapped = mapColumns(table[0]);
  const columns: ColumnMap = mapped ?? { rm: 0, name: 1, className: 2 };
  const hasHeader = mapped !== null;
  const body = hasHeader ? table.slice(1) : table;
  const offset = hasHeader ? 2 : 1;

  const rows: ParsedStudent[] = [];
  const issues: ImportIssue[] = [];
  const seen = new Map<string, number>();

  body.forEach((cells, index) => {
    const line = index + offset;
    const rm = (cells[columns.rm] ?? "").trim();
    const fullName = (cells[columns.name] ?? "").trim();
    const rawClass =
      columns.className === null ? "" : (cells[columns.className] ?? "").trim();

    if (!rm) {
      issues.push({ line, rm: "", message: "RM em branco." });
      return;
    }

    if (!RM_FORMAT.test(rm)) {
      issues.push({
        line,
        rm,
        message:
          "RM inválido. Use até 20 caracteres entre letras, números, ponto, hífen e sublinhado.",
      });
      return;
    }

    if (!fullName) {
      issues.push({ line, rm, message: "Nome em branco." });
      return;
    }

    const firstSeen = seen.get(rm);
    if (firstSeen !== undefined) {
      issues.push({
        line,
        rm,
        message: `RM repetido no arquivo (já aparece na linha ${firstSeen}).`,
      });
      return;
    }

    seen.set(rm, line);
    rows.push({ line, rm, fullName, className: rawClass || null });
  });

  return { rows, issues, hasHeader };
}
