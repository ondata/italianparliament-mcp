import { describe, it, expect } from "vitest";
import { votesTool, buildBillCodeBlock } from "./votes.js";

describe("buildBillCodeBlock", () => {
  it("aggancia il riferimento all'atto e le sue varianti", () => {
    const b = buildBillCodeBlock("2790");
    expect(b).toContain("rif_attoCamera");
    expect(b).toContain('STRAFTER(STR(?_bcAtto), "_") = "2790"');
    expect(b).toContain('STRSTARTS(STRAFTER(STR(?_bcAtto), "_"), "2790-")');
  });

  it("cerca gli ordini del giorno con CONTAINS, mai con REGEX", () => {
    // Nel motore di Virtuoso la barra ha semantica anomala:
    // REGEX("9/2329/1", "9/1") è true. Con un "9/<num>/" in regex ogni ordine
    // del giorno numerato <num> finirebbe attribuito all'atto <num>.
    const b = buildBillCodeBlock("1");
    expect(b).toContain('CONTAINS(STR(?_bcDescr), "9/1/")');
    const regexArg = b.match(/REGEX\(STR\(\?_bcDescr\), "([^"]*)"\)/)?.[1] ?? "";
    expect(regexArg).not.toContain("/");
  });

  it("ancora il match testuale alle sigle degli atti, non a una sottostringa", () => {
    const b = buildBillCodeBlock("100");
    expect(b).toContain("(DDL|PDL|ODG|A[ .]*C)");
    expect(b).toContain("([^0-9]|$)");
    expect(b).not.toContain('CONTAINS(STR(?description)');
  });

  it("escapa i metacaratteri regex del numero", () => {
    expect(buildBillCodeBlock("2790-bis")).toContain("2790-bis");
    expect(buildBillCodeBlock("2.5")).toContain("2\\\\.5");
  });
});

describe("votes --bill-code (endpoint)", () => {
  it("non attribuisce all'atto 100 le mille votazioni che citano '100' negli emendamenti", async () => {
    // Sentinella del difetto originale: con un CONTAINS nudo su dc:description
    // questa chiamata restituiva 1.127 votazioni, nessuna delle quali sull'atto
    // 100 (erano "EM 1.100", "EM 5.1000", "ART AGG 15.01001" di altri atti).
    // Nella leg. 19 l'atto C.100 non ha alcuna votazione: il risultato giusto
    // è zero righe, con un hint che spiega il vuoto.
    const result = await votesTool.execute({
      legislature: 19,
      billCode: "100",
      limit: 100,
      offset: 0,
    });
    expect(result.rows.length).toBe(0);
    expect(result.hint).toMatch(/numero dell'ATTO Camera/);
  }, 30000);

  it("trova il voto finale e gli ordini del giorno del DL Pnrr (C.2420)", async () => {
    const result = await votesTool.execute({
      legislature: 19,
      billCode: "2420",
      limit: 100,
      offset: 0,
    });
    expect(result.rows.length).toBeGreaterThanOrEqual(26);
    expect(
      result.rows.some((r) => r.description?.includes("decreto-legge 7 aprile 2025, n. 45")),
    ).toBe(true);
    expect(result.rows.some((r) => r.description?.includes("9/2420/"))).toBe(true);
  }, 30000);

  it("la fiducia (solo testuale, 'Votazione Fiducia A.C. 3053') non va persa", async () => {
    // Il voto di fiducia non ha rif_attoCamera: vive solo nella descrizione, in
    // una forma che né "DDL" né "9/" coprono.
    const result = await votesTool.execute({
      legislature: 19,
      billCode: "3053",
      limit: 100,
      offset: 0,
    });
    expect(result.rows.some((r) => r.description?.includes("Fiducia A.C. 3053"))).toBe(true);
  }, 30000);

  it("il numero base trova anche la variante (C.2790 → 2790-bis, bilancio 2021)", async () => {
    const base = await votesTool.execute({
      legislature: 18,
      billCode: "2790",
      countOnly: true,
      limit: 1,
      offset: 0,
    });
    const variant = await votesTool.execute({
      legislature: 18,
      billCode: "2790-bis",
      countOnly: true,
      limit: 1,
      offset: 0,
    });
    expect(Number(base.rows[0].count)).toBeGreaterThan(40);
    expect(base.rows[0].count).toBe(variant.rows[0].count);
  }, 30000);
});
