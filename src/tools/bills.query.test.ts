import { describe, it, expect } from "vitest";
import {
  buildCountQuery,
  buildListQuery,
  buildNaturaFilter,
} from "./bills.js";

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

// --- una riga per atto, non per tupla (issue #99) ---------------------------
describe("buildListQuery / buildCountQuery", () => {
  const WHERE = "WHERE {\n  ?s a <http://dati.camera.it/ocd/atto> .\n}";

  it("il conteggio conta gli ATTI, non le righe della tupla", () => {
    const q = buildCountQuery(WHERE);
    expect(q).toContain("COUNT(DISTINCT ?s)");
    // La vecchia forma contava le righe di una subquery SELECT DISTINCT sulla
    // tupla intera: 160.454 contro 121.021 atti reali, +32%.
    expect(q).not.toContain("COUNT(*)");
  });

  it("l'elenco collassa il firmatario multi-valore con GROUP BY", () => {
    const q = buildListQuery(WHERE, 100, 0);
    expect(q).toContain("(MIN(?_sponsor) AS ?sponsor_uri)");
    expect(q).toMatch(/GROUP BY[^\n]*\?s\b/);
  });

  it("non proietta il firmatario nudo, che reintrodurrebbe i duplicati", () => {
    const q = buildListQuery(WHERE, 100, 0);
    const projection = q.slice(0, q.indexOf("WHERE {"));
    // ?sponsor_uri deve comparire solo come alias del MIN, mai come variabile
    // selezionata direttamente.
    expect(projection).not.toMatch(/(?<!AS )\?sponsor_uri/);
  });

  it("il GROUP BY copre tutte le variabili proiettate non aggregate", () => {
    const q = buildListQuery(WHERE, 100, 0);
    const projection = q.slice(0, q.indexOf("WHERE {"));
    const groupBy = q.slice(q.indexOf("GROUP BY"), q.indexOf("ORDER BY"));
    // Una variabile proiettata e non raggruppata è un errore SPARQL, e in
    // Virtuoso può passare silenziosamente restituendo righe in più.
    const proiettate = (projection.match(/\?[a-zA-Z_]+/g) ?? []).filter(
      (v) => v !== "?_sponsor" && v !== "?sponsor_uri",
    );
    for (const v of proiettate) {
      expect(groupBy).toContain(v);
    }
  });

  it("limit e offset finiscono nella query dell'elenco", () => {
    const q = buildListQuery(WHERE, 250, 500);
    expect(q).toContain("LIMIT 250");
    expect(q).toContain("OFFSET 500");
  });
});
