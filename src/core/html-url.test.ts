import { describe, it, expect } from "vitest";
import {
  personHtmlUrl,
  actHtmlUrl,
  ddlRssUrl,
  parseCameraActUri,
} from "./html-url.js";

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

describe("parseCameraActUri", () => {
  it("scompone un atto Camera in legislatura e id", () => {
    expect(
      parseCameraActUri("http://dati.camera.it/ocd/attocamera.rdf/ac19_2822"),
    ).toEqual({ legislature: "19", id: "2822" });
  });

  it("tiene il suffisso degli atti variante (navetta, testo commissione, composti)", () => {
    // Regressione: con `_(\d+)$` questi tornavano undefined e l'atto spariva
    // per intero da bill-progress, bill-text e camera-amendments.
    expect(
      parseCameraActUri("http://dati.camera.it/ocd/attocamera.rdf/ac19_703-B"),
    ).toEqual({ legislature: "19", id: "703-B" });
    expect(
      parseCameraActUri("http://dati.camera.it/ocd/attocamera.rdf/ac19_54-A"),
    ).toEqual({ legislature: "19", id: "54-A" });
    expect(
      parseCameraActUri(
        "http://dati.camera.it/ocd/attocamera.rdf/ac18_1059-bis-B",
      ),
    ).toEqual({ legislature: "18", id: "1059-bis-B" });
  });

  it("ritorna undefined per URI non-atto-Camera o vuoto", () => {
    expect(parseCameraActUri("http://dati.senato.it/ddl/59851")).toBeUndefined();
    expect(parseCameraActUri(undefined)).toBeUndefined();
  });
});

describe("actHtmlUrl", () => {
  it("mappa un atto Camera (legislatura dall'URI)", () => {
    expect(
      actHtmlUrl("http://dati.camera.it/ocd/attocamera.rdf/ac19_2822"),
    ).toBe("https://www.camera.it/leg19/126?leg=19&idDocumento=2822");
  });

  it("usa l'id INTERO per gli atti variante", () => {
    // Verificato sul sito: idDocumento=703-B serve la scheda che dichiara
    // "Atto Camera: 703-B". Puntare alla scheda dell'atto base (703)
    // racconterebbe un iter diverso da quello richiesto.
    expect(
      actHtmlUrl("http://dati.camera.it/ocd/attocamera.rdf/ac19_703-B"),
    ).toBe("https://www.camera.it/leg19/126?leg=19&idDocumento=703-B");
  });

  it("mappa un DDL Senato", () => {
    expect(actHtmlUrl("http://dati.senato.it/ddl/59851")).toBe(
      "https://www.senato.it/leggi-e-documenti/disegni-di-legge/scheda-ddl?tab=datiGenerali&did=59851",
    );
  });

  it("ritorna stringa vuota per URI non-atto o vuoto", () => {
    expect(actHtmlUrl("http://dati.senato.it/senatore/32")).toBe("");
    expect(actHtmlUrl(undefined)).toBe("");
  });
});

describe("ddlRssUrl", () => {
  it("costruisce il feed RSS del DDL con la legislatura", () => {
    expect(ddlRssUrl("http://dati.senato.it/ddl/59372", 19)).toBe(
      "https://www.senato.it/feed-rss/documenti/ddl/rss/59372/19",
    );
  });

  it("ritorna stringa vuota senza legislatura o per non-DDL", () => {
    expect(ddlRssUrl("http://dati.senato.it/ddl/59372", undefined)).toBe("");
    expect(ddlRssUrl("http://dati.camera.it/ocd/attocamera.rdf/ac19_1", 19)).toBe(
      "",
    );
  });
});
