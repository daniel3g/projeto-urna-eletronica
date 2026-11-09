import { describe, expect, it } from "vitest";

import {
  EMPTY_ENTRY,
  canConfirm,
  isComplete,
  pressBlank,
  pressCorrect,
  pressDigit,
  voteTypeFor,
  type Entry,
} from "./ballot";

/** Digita uma sequência de teclas a partir do campo vazio. */
function type(keys: string, digits: number, from: Entry = EMPTY_ENTRY): Entry {
  return [...keys].reduce((entry, key) => pressDigit(entry, key, digits), from);
}

describe("pressDigit", () => {
  it("acumula dígitos até o tamanho do cargo", () => {
    expect(type("13", 2)).toEqual({ buffer: "13", blank: false });
  });

  it("ignora dígitos além do tamanho do cargo", () => {
    expect(type("1234", 2).buffer).toBe("12");
  });

  it("ignora o que não é dígito", () => {
    expect(type("a1-", 2).buffer).toBe("1");
    expect(pressDigit(EMPTY_ENTRY, "12", 2)).toBe(EMPTY_ENTRY);
  });

  it("não digita com BRANCO marcado", () => {
    const blank = pressBlank(EMPTY_ENTRY);
    expect(pressDigit(blank, "5", 2)).toBe(blank);
  });

  it("não altera a entrada original", () => {
    const entry: Entry = { buffer: "1", blank: false };
    pressDigit(entry, "2", 2);
    expect(entry).toEqual({ buffer: "1", blank: false });
  });
});

describe("pressCorrect", () => {
  it("volta ao início do cargo, nunca apaga só um dígito", () => {
    expect(pressCorrect()).toEqual(EMPTY_ENTRY);
  });

  it("desfaz o BRANCO e libera a digitação de novo", () => {
    const afterCorrect = pressCorrect();
    expect(type("7", 2, afterCorrect).buffer).toBe("7");
  });
});

describe("pressBlank", () => {
  it("marca BRANCO com o campo vazio", () => {
    expect(pressBlank(EMPTY_ENTRY)).toEqual({ buffer: "", blank: true });
  });

  it("é ignorado com dígitos já digitados", () => {
    const entry = type("1", 2);
    expect(pressBlank(entry)).toBe(entry);
  });

  it("é idempotente", () => {
    const blank = pressBlank(EMPTY_ENTRY);
    expect(pressBlank(blank)).toEqual(blank);
  });
});

describe("isComplete / canConfirm", () => {
  it("campo vazio não confirma", () => {
    expect(isComplete(EMPTY_ENTRY, 2)).toBe(false);
    expect(canConfirm(EMPTY_ENTRY, 2)).toBe(false);
  });

  it("número incompleto não confirma", () => {
    expect(canConfirm(type("1", 2), 2)).toBe(false);
    expect(canConfirm(type("12", 3), 3)).toBe(false);
  });

  it("número completo confirma", () => {
    expect(canConfirm(type("12", 2), 2)).toBe(true);
    expect(canConfirm(type("12345", 5), 5)).toBe(true);
  });

  it("BRANCO confirma", () => {
    expect(canConfirm(pressBlank(EMPTY_ENTRY), 2)).toBe(true);
  });
});

describe("voteTypeFor", () => {
  it("BRANCO envia 'blank'", () => {
    expect(voteTypeFor(pressBlank(EMPTY_ENTRY))).toBe("blank");
  });

  it("número envia 'candidate' — a classificação como nulo é do servidor", () => {
    expect(voteTypeFor(type("99", 2))).toBe("candidate");
  });
});
