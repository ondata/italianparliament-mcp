import { describe, it, expect } from "vitest";
import { dropBareDuplicates } from "./bill-rapporteurs.js";

const row = (over: Partial<Parameters<typeof dropBareDuplicates>[0][0]>) => ({
  rapporteur_name: "FRASSINI Rebecca",
  rapporteur_type: "",
  committee: "",
  date: "",
  deputy_uri: "http://dati.camera.it/ocd/deputato.rdf/d307630_19",
  html_url: "",
  ...over,
});

describe("dropBareDuplicates", () => {
  it("scarta la riga nuda quando la stessa persona ha una riga con commissione e data", () => {
    const out = dropBareDuplicates([
      row({ committee: "V Commissione (Bilancio)", date: "20260701" }),
      row({}),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].committee).toBe("V Commissione (Bilancio)");
  });

  it("tiene la riga senza commissione che però porta un tipo", () => {
    // Non è un caso isolato: 35.708 nodi ocd:relatore su 42.250 hanno dc:type,
    // e ~2.800 distinguono maggioranza da minoranza. Il valore qui sotto viene
    // da C.687, dove solo il lato atto sa "relatore per la maggioranza".
    const out = dropBareDuplicates([
      row({ committee: "XII Commissione (Affari sociali)", date: "20190627" }),
      row({
        rapporteur_name: "LEPRI Stefano, relatore per la maggioranza",
        rapporteur_type: "maggioranza",
      }),
    ]);
    expect(out).toHaveLength(2);
    expect(out.map((r) => r.rapporteur_type)).toContain("maggioranza");
  });

  it("tiene la riga nuda quando è l'unica che c'è", () => {
    // È il caso degli atti in corso: i lavori d'Aula non sono ancora
    // pubblicati, il nome del relatore sì. Scartarla equivarrebbe a tornare al
    // vuoto che questo fix elimina.
    const out = dropBareDuplicates([row({})]);
    expect(out).toHaveLength(1);
    expect(out[0].rapporteur_name).toBe("FRASSINI Rebecca");
  });

  it("non fonde persone diverse", () => {
    const out = dropBareDuplicates([
      row({ committee: "VII Commissione (Cultura)", date: "20260730" }),
      row({
        rapporteur_name: "CANGIANO Gerolamo",
        deputy_uri: "http://dati.camera.it/ocd/deputato.rdf/d308786_19",
      }),
    ]);
    expect(out).toHaveLength(2);
    expect(out.map((r) => r.rapporteur_name)).toContain("CANGIANO Gerolamo");
  });

  it("conserva più sedute della stessa persona: sono righe informative, non duplicati", () => {
    const out = dropBareDuplicates([
      row({ committee: "I Commissione", date: "20260331" }),
      row({ committee: "I Commissione", date: "20260409" }),
    ]);
    expect(out).toHaveLength(2);
  });

  it("raggruppa per nome quando manca l'URI del deputato", () => {
    const out = dropBareDuplicates([
      row({ deputy_uri: "", committee: "V Commissione (Bilancio)", date: "20260701" }),
      row({ deputy_uri: "", rapporteur_name: "frassini rebecca" }),
    ]);
    expect(out).toHaveLength(1);
  });
});
