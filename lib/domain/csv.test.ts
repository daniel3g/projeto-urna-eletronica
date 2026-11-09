import { describe, expect, it } from "vitest";

import { detectDelimiter, normalizeHeader, parseCsv } from "./csv";

describe("detectDelimiter", () => {
  it("reconhece ; do Excel em português", () => {
    expect(detectDelimiter("rm;nome;turma")).toBe(";");
  });

  it("reconhece vírgula e tabulação", () => {
    expect(detectDelimiter("rm,nome,turma")).toBe(",");
    expect(detectDelimiter("rm\tnome\tturma")).toBe("\t");
  });

  it("ignora separadores dentro de aspas", () => {
    expect(detectDelimiter('"Silva, Ana";"1A"')).toBe(";");
  });

  it("uma coluna só cai na vírgula", () => {
    expect(detectDelimiter("rm")).toBe(",");
  });
});

describe("parseCsv", () => {
  it("lê exportação do Excel: BOM, ; e CRLF", () => {
    const input = "﻿rm;nome;turma\r\n123;Ana Souza;7A\r\n456;Bruno Lima;7B\r\n";
    expect(parseCsv(input)).toEqual([
      ["rm", "nome", "turma"],
      ["123", "Ana Souza", "7A"],
      ["456", "Bruno Lima", "7B"],
    ]);
  });

  it("aceita CR sozinho como quebra de linha", () => {
    expect(parseCsv("a,b\r1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("aspas protegem separador e quebra de linha", () => {
    expect(parseCsv('rm,nome\n1,"Silva, Ana"\n2,"linha\nquebrada"')).toEqual([
      ["rm", "nome"],
      ["1", "Silva, Ana"],
      ["2", "linha\nquebrada"],
    ]);
  });

  it("aspas duplas escapam aspas", () => {
    expect(parseCsv('nome\n"Ana ""Aninha"" Souza"')).toEqual([
      ["nome"],
      ['Ana "Aninha" Souza'],
    ]);
  });

  it("descarta linhas em branco e só com separadores", () => {
    expect(parseCsv("a;b\n\n;\n1;2\n   \n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("mantém campos vazios no meio da linha", () => {
    expect(parseCsv("1,,3")).toEqual([["1", "", "3"]]);
  });

  it("respeita o separador informado", () => {
    expect(parseCsv("a;b,c", ",")).toEqual([["a;b", "c"]]);
  });

  it("arquivo vazio vira tabela vazia", () => {
    expect(parseCsv("")).toEqual([]);
    expect(parseCsv("﻿")).toEqual([]);
  });
});

describe("normalizeHeader", () => {
  it("tira acento, caixa e espaços", () => {
    expect(normalizeHeader(" Matrícula ")).toBe("matricula");
    expect(normalizeHeader("Nome Completo")).toBe("nomecompleto");
    expect(normalizeHeader("SÉRIE")).toBe("serie");
    expect(normalizeHeader("Código-Aluno")).toBe("codigoaluno");
  });
});
