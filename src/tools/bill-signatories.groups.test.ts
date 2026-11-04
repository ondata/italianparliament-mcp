import { describe, it, expect } from "vitest";
import { withGroups } from "./bill-signatories.js";

// Deterministico, zero rete: i lookup sono iniettati. Protegge la distinzione
// fra "senza gruppo" (vuoto, nessuna nota) e "non ho potuto verificare"
// (vuoto E nota), e la risoluzione alla data della firma.
const cols = ["name", "role", "is_primary", "person_uri", "html_url", "signed_date", "withdrawn_date", "group_uri", "group_label"];
const dep = "http://dati.camera.it/ocd/deputato.rdf/d306066_17";
const sen = "http://dati.senato.it/senatore/32703";

const rows = [
  { name: "CAPELLI", role: "primo firmatario", is_primary: "true", person_uri: dep, html_url: "", signed_date: "2015-06-15", withdrawn_date: "" },
  { name: "ROSSI", role: "cofirmatario", is_primary: "false", person_uri: sen, html_url: "", signed_date: "2021-02-01", withdrawn_date: "2023-01-13" },
  { name: "Governo", role: "Governo (proponente)", is_primary: "false", person_uri: "", html_url: "", signed_date: "2015-06-15", withdrawn_date: "" },
];

const camera = async () =>
  new Map([[dep, [
    { group_uri: "gr1589", group_label: "MISTO", start: "2013-03-19", end: "2014-11-19" },
    { group_uri: "gr1889", group_label: "PER L'ITALIA", start: "2014-11-19", end: "2018-03-22" },
  ]]]);
const senato = async () => ({
  memberships: new Map([[sen, [
    { group_uri: "g49", start: "2018-03-27", end: "2021-01-25" },
    { group_uri: "g87", start: "2021-01-26", end: "2021-03-29" },
    { group_uri: "g87", start: "2021-01-26", end: "2021-03-29" },
  ]]]),
  denominations: new Map([
    ["g49", [{ title: "Lega", start: "2018-03-27", end: "" }]],
    ["g87", [{ title: "Europeisti", start: "2021-01-26", end: "2021-03-29" }]],
  ]),
});

describe("withGroups", () => {
  it("gruppo alla data della firma, per persona e per grafo; governo senza gruppo; nessuna notice", async () => {
    const out = await withGroups(rows, cols, { camera, senato });
    expect(out.notice).toBeUndefined();
    expect(out.rows[0]).toMatchObject({ group_uri: "gr1889", group_label: "PER L'ITALIA" });
    expect(out.rows[1]).toMatchObject({ group_uri: "g87", group_label: "Europeisti", withdrawn_date: "2023-01-13" });
    expect(out.rows[2]).toMatchObject({ group_uri: "", group_label: "" });
  });

  it("lookup fallito (es. 403 Senato): righe intatte, gruppo vuoto, notice che lo dice", async () => {
    const out = await withGroups(rows, cols, {
      camera,
      senato: async () => { throw new Error("403"); },
    });
    expect(out.rows).toHaveLength(3);
    expect(out.rows[0].group_uri).toBe("gr1889"); // la Camera ha risposto
    expect(out.rows[1]).toMatchObject({ group_uri: "", group_label: "" });
    expect(out.notice).toMatch(/non verificato/);
  });

  it("nessun firmatario parlamentare: nessun lookup", async () => {
    let called = 0;
    const out = await withGroups([rows[2]], cols, {
      camera: async () => { called++; return new Map(); },
      senato: async () => { called++; return { memberships: new Map(), denominations: new Map() }; },
    });
    expect(called).toBe(0);
    expect(out.rows[0]).toMatchObject({ group_uri: "", group_label: "" });
  });
});
