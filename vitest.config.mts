import { defineConfig } from "vitest/config";

// Por enquanto só a camada de domínio (doc 10, "Testes automatizados"): funções
// puras, sem DOM e sem banco — ambiente node basta.
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
