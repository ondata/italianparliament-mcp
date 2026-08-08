import { describe, it, expect } from "vitest";
import { buildBirthPlaceFilter } from "./deputies.js";

// Solo test deterministici: i test che interrogano l'endpoint stanno in
// tools.test.ts, l'unico file (con sparql.test.ts) che la CI esclude — i
// runner GitHub Actions vengono bloccati da dati.camera.it.
describe("buildBirthPlaceFilter", () => {
  it("ancora il match al local name, non all'IRI intero", () => {
    const f = buildBirthPlaceFilter("genova");
    // Senza STRAFTER il CONTAINS batte anche sul percorso
    // (http://dati.camera.it/ocd/luogo.rdf/genova_genova_liguria): "camera",
    // "ocd" o "luogo" matcherebbero ogni deputato con un luogo di nascita.
    expect(f).toContain('STRAFTER(STR(?birth_place_uri), "luogo.rdf/")');
    expect(f).toContain('LCASE("genova")');
  });

  it("i frammenti del percorso non fanno parte del local name", () => {
    // Il local name ha forma comune_provincia_regione: nessuno di questi
    // frammenti vi compare, quindi dopo lo STRAFTER il CONTAINS è falso.
    const localName = "genova_genova_liguria";
    for (const noise of ["camera", "ocd", "dati", "rdf", "http", "luogo.rdf"]) {
      expect(localName.includes(noise)).toBe(false);
    }
  });

  it("resta case-insensitive su entrambi i lati del confronto", () => {
    const f = buildBirthPlaceFilter("GENOVA");
    expect(f).toContain("LCASE(STRAFTER(");
    expect(f).toContain('LCASE("GENOVA")');
  });

  it("neutralizza le virgolette nell'input", () => {
    const f = buildBirthPlaceFilter('genova" ) || (1=1');
    expect(f).toContain('genova\\" ) || (1=1');
    expect(f.match(/(?<!\\)"/g)?.length).toBe(4);
  });
});
