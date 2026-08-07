import { describe, it, expect } from "vitest";
import { buildBillCodeBlock } from "./votes.js";

// Solo test deterministici: i test che interrogano l'endpoint stanno in
// tools.test.ts, l'unico file (con sparql.test.ts) che la CI esclude — i
// runner GitHub Actions vengono bloccati da dati.camera.it.
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
    // A.C. copre "Votazione Fiducia A.C. 3053": la fiducia non ha
    // rif_attoCamera e non usa la sigla DDL, senza questo prefisso si perde.
    expect(b).toContain("(DDL|PDL|ODG|A[ .]*C)");
    expect(b).toContain("([^0-9]|$)");
    expect(b).not.toContain("CONTAINS(STR(?description)");
  });

  it("escapa i metacaratteri regex del numero", () => {
    expect(buildBillCodeBlock("2790-bis")).toContain("2790-bis");
    expect(buildBillCodeBlock("2.5")).toContain("2\\\\.5");
  });
});
