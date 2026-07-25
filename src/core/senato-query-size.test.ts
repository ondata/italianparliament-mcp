import { describe, it, expect } from "vitest";
import {
  SENATO_MAX_OR_TERMS,
  SENATO_MAX_REQUEST_URI,
  senatoRequestUriLength,
  assertQueryFits,
} from "./senato-query-size.js";
import { chunk } from "./chunk.js";
import { OSR_PREFIXES } from "./prefixes.js";

describe("senato-query-size", () => {
  it("misura la request-URI con l'encoding usato dal client", () => {
    // "/sparql?" + "query=" + "a" + "&format=application%2Fjson"
    // (URLSearchParams encoda anche lo slash: 26 byte, non 24)
    expect(senatoRequestUriLength("a")).toBe(8 + 6 + 1 + 26);
  });

  it("lascia passare una query sotto la soglia", () => {
    expect(() => assertQueryFits("SELECT ?s WHERE { ?s ?p ?o }")).not.toThrow();
  });

  it("blocca la query oltre la soglia con un messaggio che dice cosa fare", () => {
    const q = `SELECT ?s WHERE { ?s ?p "${"x".repeat(SENATO_MAX_REQUEST_URI)}" }`;
    expect(() => assertQueryFits(q, "corte dei conti")).toThrow(
      /Query troppo lunga.*corte dei conti/s,
    );
  });

  it("la OR-chain delle fiducie sfora intera, a blocchi di SENATO_MAX_OR_TERMS no", () => {
    // 53 fiducie in leg. 19: è il caso reale che mandava --keyword in 403.
    const nums = Array.from({ length: 53 }, (_, i) => String(1000 + i));
    const query = (batch: string[]) => `${OSR_PREFIXES}
SELECT ?ddl ?f WHERE {
  ?ddl a osr:Ddl ; osr:legislatura 19 ; osr:fase ?f .
  FILTER(${batch.map((n) => `STR(?f) = "S.${n}"`).join(" || ")})
}`;
    expect(senatoRequestUriLength(query(nums))).toBeGreaterThan(
      SENATO_MAX_REQUEST_URI,
    );
    for (const batch of chunk(nums, SENATO_MAX_OR_TERMS)) {
      expect(() => assertQueryFits(query(batch))).not.toThrow();
    }
  });

  it("il confine è esattamente 2047 accettata / 2048 rifiutata", () => {
    // padding calibrato sulla lunghezza reale, non stimato
    const fill = (target: number) => {
      let q = "SELECT ?s WHERE { ?s ?p ?o }";
      while (senatoRequestUriLength(q) < target) q += "x";
      return q;
    };
    const alLimite = fill(SENATO_MAX_REQUEST_URI);
    expect(senatoRequestUriLength(alLimite)).toBe(2047);
    expect(() => assertQueryFits(alLimite)).not.toThrow();
    expect(() => assertQueryFits(alLimite + "x")).toThrow();
  });
});
