import { describe, it, expect } from "vitest";
import { chunk } from "./chunk.js";

describe("chunk", () => {
  it("spezza in blocchi della dimensione richiesta", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("preserva l'ordine originale", () => {
    const nums = Array.from({ length: 53 }, (_, i) => i);
    expect(chunk(nums, 25).flat()).toEqual(nums);
  });

  it("restituisce un solo blocco se la lista è più corta della dimensione", () => {
    expect(chunk(["a", "b"], 25)).toEqual([["a", "b"]]);
  });

  it("restituisce lista vuota su input vuoto (nessuna query a vuoto)", () => {
    expect(chunk([], 25)).toEqual([]);
  });

  it("rifiuta una dimensione non valida", () => {
    expect(() => chunk([1, 2], 0)).toThrow();
  });
});
