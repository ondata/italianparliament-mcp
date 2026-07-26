import { describe, it, expect } from "vitest";
import { sparqlStringLiteral } from "./sparql-literal.js";

describe("sparqlStringLiteral", () => {
  it("avvolge il valore tra virgolette", () => {
    expect(sparqlStringLiteral("FDI")).toBe('"FDI"');
  });

  it("scappa le virgolette interne", () => {
    expect(sparqlStringLiteral('AL"T')).toBe('"AL\\"T"');
  });

  it("scappa i backslash", () => {
    expect(sparqlStringLiteral("A\\B")).toBe('"A\\\\B"');
  });

  it("scappa i ritorni a capo", () => {
    expect(sparqlStringLiteral("a\nb\rc")).toBe('"a\\nb\\rc"');
  });

  it("lascia intatti gli altri caratteri, accenti compresi", () => {
    expect(sparqlStringLiteral("M-+EUR è così")).toBe('"M-+EUR è così"');
  });
});
