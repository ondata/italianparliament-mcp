import { describe, it, expect } from "vitest";
import { withEmptyHint } from "./empty-hint.js";
import type { ToolResult } from "../tools/types.js";

const empty = (hint?: string): ToolResult => ({ rows: [], columns: ["a"], hint });
const filled = (hint?: string): ToolResult => ({ rows: [{ a: "1" }], columns: ["a"], hint });

// Riproduce la risoluzione del path MCP (server.ts formatResult, escluso DEFAULT_EMPTY)
const mcpHint = (result: ToolResult, emptyHint?: string) => result.hint ?? emptyHint;

describe("withEmptyHint", () => {
  it("risultato vuoto senza hint dinamico usa l'emptyHint statico", () => {
    const out = withEmptyHint(empty(), "STATICO");
    expect(out.hint).toBe("STATICO");
    expect(out.rows).toEqual([]);
  });

  it("l'hint dinamico ha precedenza sull'emptyHint statico", () => {
    const out = withEmptyHint(empty("DINAMICO"), "STATICO");
    expect(out.hint).toBe("DINAMICO");
  });

  it("risultato non vuoto non riceve alcun hint", () => {
    const out = withEmptyHint(filled(), "STATICO");
    expect(out.hint).toBeUndefined();
  });

  it("vuoto senza hint dinamico né emptyHint non produce hint", () => {
    const out = withEmptyHint(empty(), undefined);
    expect(out.hint).toBeUndefined();
  });

  it("non muta l'oggetto risultato in ingresso", () => {
    const input = empty();
    const out = withEmptyHint(input, "STATICO");
    expect(input.hint).toBeUndefined();
    expect(out).not.toBe(input);
  });

  it("parità con il path MCP (result.hint ?? emptyHint)", () => {
    const cases: Array<[ToolResult, string | undefined]> = [
      [empty(), "STATICO"],
      [empty("DINAMICO"), "STATICO"],
      [empty(), undefined],
    ];
    for (const [result, emptyHint] of cases) {
      expect(withEmptyHint(result, emptyHint).hint).toBe(mcpHint(result, emptyHint));
    }
  });
});
