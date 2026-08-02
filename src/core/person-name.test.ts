import { describe, it, expect } from "vitest";
import { preferredName, personDisplayName } from "./person-name.js";

// I casi sono tutti reali, presi dal grafo Camera con
// FILTER(STR(?foafSurname) != STR(?nicknameSurname)) sulle 135 persone che
// hanno un cognome d'uso diverso da quello anagrafico.
describe("preferredName", () => {
  it("preferisce il cognome d'uso quando aggiunge il secondo cognome", () => {
    expect(preferredName("ALBERTI", "ALBERTI CASELLATI")).toBe("ALBERTI CASELLATI");
    expect(preferredName("VILLECCO", "VILLECCO CALIPARI")).toBe("VILLECCO CALIPARI");
    expect(preferredName("GUIDI", "GUIDI CINGOLANI")).toBe("GUIDI CINGOLANI");
    expect(preferredName("SCILIPOTI", "SCILIPOTI ISGRO'")).toBe("SCILIPOTI ISGRO'");
  });

  it("tiene l'anagrafico quando è il nome d'uso a essere più corto", () => {
    expect(preferredName("ZELIOLI LANZINI", "ZELIOLI")).toBe("ZELIOLI LANZINI");
    expect(preferredName("CATANOSO GENOESE", "CATANOSO")).toBe("CATANOSO GENOESE");
    expect(preferredName("NATALI PIERUCCI BONDI", "NATALI")).toBe("NATALI PIERUCCI BONDI");
  });

  it("mostra entrambi quando i due cognomi sono disgiunti", () => {
    // cognome acquisito e pseudonimo: sceglierne uno perderebbe informazione
    expect(preferredName("DI SERIO", "D'ANTONA")).toBe("DI SERIO (D'ANTONA)");
    expect(preferredName("TRANQUILLI", "SILONE")).toBe("TRANQUILLI (SILONE)");
  });

  it("tratta apostrofi e spazi come equivalenti, tenendo la forma d'uso", () => {
    expect(preferredName("DE VIDOVICH", "DE' VIDOVICH")).toBe("DE' VIDOVICH");
  });

  it("regge i valori mancanti", () => {
    expect(preferredName("MELONI", "")).toBe("MELONI");
    expect(preferredName("", "MELONI")).toBe("MELONI");
    expect(preferredName("MELONI", "MELONI")).toBe("MELONI");
  });
});

describe("personDisplayName", () => {
  it("compone nome e cognome d'uso", () => {
    expect(personDisplayName("MARIA ELISABETTA", "ALBERTI", ["ALBERTI CASELLATI"])).toBe(
      "MARIA ELISABETTA ALBERTI CASELLATI",
    );
  });

  it("senza alias restituisce il nome anagrafico", () => {
    expect(personDisplayName("GIORGIA", "MELONI")).toBe("GIORGIA MELONI");
    expect(personDisplayName("GIORGIA", "MELONI", [])).toBe("GIORGIA MELONI");
  });

  it("con più alias il risultato non dipende dall'ordine", () => {
    // 18 persone nel grafo hanno due cognomi d'uso distinti
    const a = personDisplayName("ANNA", "ROSSI", ["ROSSI GASPARRINI", "ROSSI"]);
    const b = personDisplayName("ANNA", "ROSSI", ["ROSSI", "ROSSI GASPARRINI"]);
    expect(a).toBe("ANNA ROSSI GASPARRINI");
    expect(b).toBe(a);
  });

  it("ignora gli alias vuoti", () => {
    expect(personDisplayName("GIORGIA", "MELONI", ["", "  "])).toBe("GIORGIA MELONI");
  });
});
