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

  it("tiene la query sotto la soglia di ~2 KB del Senato", () => {
    // 53 fiducie in leg. 19: la OR-chain intera supera i 2 KB di query string
    // e l'endpoint risponde 403. A blocchi di 25 ogni query resta ben sotto.
    const nums = Array.from({ length: 53 }, (_, i) => String(1000 + i));
    const orChain = (batch: string[]) =>
      batch.map((n) => `STR(?f) = "S.${n}"`).join(" || ");
    expect(encodeURIComponent(orChain(nums)).length).toBeGreaterThan(2000);
    for (const batch of chunk(nums, 25)) {
      expect(encodeURIComponent(orChain(batch)).length).toBeLessThan(1300);
    }
  });

  it("rifiuta una dimensione non valida", () => {
    expect(() => chunk([1, 2], 0)).toThrow();
  });
});
