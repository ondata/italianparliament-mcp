import { describe, it, expect } from "vitest";
import { personHtmlUrl } from "./html-url.js";

describe("personHtmlUrl", () => {
  it("mappa un deputato Camera in URL scheda elenco", () => {
    expect(
      personHtmlUrl("http://dati.camera.it/ocd/deputato.rdf/d308917_19"),
    ).toBe("https://www.camera.it/deputati/elenco/19-308917");
  });

  it("mappa un deputato Regno (prefisso dr) best-effort", () => {
    expect(
      personHtmlUrl("http://dati.camera.it/ocd/deputato.rdf/dr1833_19"),
    ).toBe("https://www.camera.it/deputati/elenco/19-1833");
  });

  it("mappa un senatore in URL scheda-attivita", () => {
    expect(personHtmlUrl("http://dati.senato.it/senatore/32")).toBe(
      "https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did=32",
    );
  });

  it("ritorna stringa vuota per URI non-persona (es. persona.rdf, atto, vuoto)", () => {
    expect(personHtmlUrl("http://dati.camera.it/ocd/persona.rdf/p302103")).toBe(
      "",
    );
    expect(
      personHtmlUrl("http://dati.camera.it/ocd/attocamera.rdf/ac19_2822"),
    ).toBe("");
    expect(personHtmlUrl("")).toBe("");
    expect(personHtmlUrl(undefined)).toBe("");
  });
});
