import { describe, expect, it } from "vitest";

import { parseStudentsCsv } from "./students-import";

describe("parseStudentsCsv", () => {
  it("lê cabeçalho com acento e em outra ordem", () => {
    const result = parseStudentsCsv("Nome;Turma;Matrícula\nAna Souza;7A;123\n");
    expect(result.hasHeader).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.rows).toEqual([
      { line: 2, rm: "123", fullName: "Ana Souza", className: "7A" },
    ]);
  });

  it("sem cabeçalho assume rm, nome, turma e numera a partir de 1", () => {
    const result = parseStudentsCsv("123,Ana Souza,7A\n456,Bruno Lima,7B");
    expect(result.hasHeader).toBe(false);
    expect(result.rows.map((row) => [row.line, row.rm])).toEqual([
      [1, "123"],
      [2, "456"],
    ]);
  });

  it("turma é opcional", () => {
    const result = parseStudentsCsv("rm,nome\n123,Ana Souza\n456,Bruno Lima,");
    expect(result.issues).toEqual([]);
    expect(result.rows.map((row) => row.className)).toEqual([null, null]);
  });

  it("apara espaços dos campos", () => {
    const result = parseStudentsCsv("rm,nome,turma\n  123 ,  Ana Souza ,  7A ");
    expect(result.rows[0]).toMatchObject({
      rm: "123",
      fullName: "Ana Souza",
      className: "7A",
    });
  });

  it("arquivo vazio vira um problema, nunca uma exceção", () => {
    expect(parseStudentsCsv("")).toEqual({
      rows: [],
      issues: [{ line: 0, rm: "", message: "O arquivo está vazio." }],
      hasHeader: false,
    });
  });

  it("aponta cada linha ruim com o número da linha do arquivo", () => {
    const csv = [
      "rm;nome;turma",
      "123;Ana Souza;7A", // 2 — ok
      ";Sem RM;7A", // 3
      "12 3;RM com espaço;7A", // 4
      "456;;7B", // 5
      "123;Ana Repetida;7A", // 6
      "789;Carla Dias;7C", // 7 — ok
    ].join("\n");

    const result = parseStudentsCsv(csv);

    expect(result.rows.map((row) => row.line)).toEqual([2, 7]);
    expect(result.issues.map((issue) => [issue.line, issue.rm])).toEqual([
      [3, ""],
      [4, "12 3"],
      [5, "456"],
      [6, "123"],
    ]);
    expect(result.issues[0].message).toBe("RM em branco.");
    expect(result.issues[1].message).toMatch(/^RM inválido/);
    expect(result.issues[2].message).toBe("Nome em branco.");
    expect(result.issues[3].message).toBe(
      "RM repetido no arquivo (já aparece na linha 2).",
    );
  });

  it("aceita RM com letras, ponto, hífen e sublinhado até 20 caracteres", () => {
    const ok = "A1.b-2_c".padEnd(20, "9");
    const tooLong = ok + "9";
    const result = parseStudentsCsv(`rm,nome\n${ok},Ana\n${tooLong},Bruno`);
    expect(result.rows.map((row) => row.rm)).toEqual([ok]);
    expect(result.issues.map((issue) => issue.rm)).toEqual([tooLong]);
  });
});
