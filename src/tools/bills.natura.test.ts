import { describe, it, expect } from "vitest";
import { buildNaturaFilter } from "./bills.js";

// Solo test deterministici: i test che interrogano l'endpoint stanno in
// tools.test.ts, l'unico file (con sparql.test.ts) che la CI esclude — i
// runner GitHub Actions vengono bloccati da dati.camera.it.
describe("buildNaturaFilter", () => {
  it("ancora il match al local name, non all'IRI intero", () => {
    const f = buildNaturaFilter("costituzionale");
    // Senza STRAFTER il CONTAINS batte anche sul percorso dell'IRI
    // (http://dati.camera.it/ocd/natura.rdf/...): "camera", "rdf" o "http"
    // matcherebbero ogni atto e il filtro restituirebbe l'intero stock.
    expect(f).toContain('STRAFTER(STR(?natura), "natura.rdf/")');
    expect(f).toContain('LCASE("costituzionale")');
  });

  it("non fa passare i frammenti del percorso dell'IRI", () => {
    // Il local name non contiene nessuno di questi: con lo STRAFTER davanti,
    // il CONTAINS su di essi è falso e la query dà zero righe.
    for (const noise of ["camera", "rdf", "http", "natura.rdf", "dati"]) {
      const localName = "disegno_legge_ordinario";
      expect(localName.includes(noise)).toBe(false);
      expect(buildNaturaFilter(noise)).toContain('STRAFTER(STR(?natura), "natura.rdf/")');
    }
  });

  it("resta case-insensitive su entrambi i lati del confronto", () => {
    const f = buildNaturaFilter("COSTITUZIONALE");
    expect(f).toContain("LCASE(STRAFTER(");
    expect(f).toContain('LCASE("COSTITUZIONALE")');
  });

  it("neutralizza le virgolette nell'input", () => {
    const f = buildNaturaFilter('ordinari" ) || (1=1');
    expect(f).toContain('ordinari\\" ) || (1=1');
    // nessuna virgoletta non escapata che possa chiudere il literal in anticipo
    expect(f.match(/(?<!\\)"/g)?.length).toBe(4);
  });
});
