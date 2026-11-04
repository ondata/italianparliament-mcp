import { describe, it, expect } from "vitest";
import { withSenatoLaw } from "./bill-progress.js";

// Deterministico, zero rete: il lookup è iniettato. Protegge la distinzione
// fra "non è legge" (colonne vuote, nessuna nota) e "non ho potuto
// verificare" (colonne vuote E nota), che un vuoto muto cancellerebbe.
const rows = [
  { ddl_uri: "http://dati.senato.it/ddl/58034", nature: "ordinaria", title: "interporti" },
  { ddl_uri: "http://dati.senato.it/ddl/55479", nature: "ordinaria", title: "in corso" },
];

describe("withSenatoLaw", () => {
  it("lookup fallito (es. 403 Senato): righe intatte, law_* vuote, notice che lo dice", async () => {
    const out = await withSenatoLaw(rows, async () => {
      throw new Error("SPARQL request failed with status 403");
    });
    expect(out.rows).toHaveLength(2);
    expect(out.rows[0]).toMatchObject({ title: "interporti", law_number: "", law_date: "", law_url: "" });
    expect(out.rows[1]).toMatchObject({ title: "in corso", law_number: "", law_date: "", law_url: "" });
    expect(out.notice).toMatch(/non verificati/);
    expect(out.notice).toMatch(/non perché il DDL non sia diventato legge/);
  });

  it("lookup riuscito: la legge va sulla riga giusta, le altre restano vuote senza notice", async () => {
    const out = await withSenatoLaw(rows, async () => {
      return new Map([
        [rows[0].ddl_uri, { numbers: new Set(["177"]), dates: new Set(["2025-11-13"]) }],
      ]);
    });
    expect(out.notice).toBeUndefined();
    expect(out.rows[0]).toMatchObject({
      law_number: "177",
      law_date: "2025-11-13",
      law_url: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:2025-11-13;177",
    });
    expect(out.rows[1]).toMatchObject({ law_number: "", law_date: "", law_url: "" });
  });

  it("nessuna riga: nessuna query, nessuna notice", async () => {
    let called = false;
    const out = await withSenatoLaw([], async () => {
      called = true;
      return new Map();
    });
    expect(out).toEqual({ rows: [] });
    expect(called).toBe(false);
  });
});
