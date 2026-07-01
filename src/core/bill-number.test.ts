import { describe, it, expect } from "vitest";
import { extractBillNumber, billBaseNumber } from "./bill-number.js";

describe("extractBillNumber", () => {
  it("estrae dai label Senato (varie formattazioni)", () => {
    expect(extractBillNumber("Ddl n.345. Votazione questione di fiducia")).toBe("345");
    expect(extractBillNumber("Disegno di legge n. 1193. Votazione questione di fiducia")).toBe("1193");
    expect(extractBillNumber("Disegno di legge n.714 Votazione questione di fiducia")).toBe("714");
  });

  it("mantiene il suffisso di lettura (Senato)", () => {
    expect(extractBillNumber("DDL 562-B. Articolo 8")).toBe("562-B");
    expect(extractBillNumber("DDL n. 924-bis. Em. 3.202, Pirondini e altri")).toBe("924-bis");
  });

  it("estrae dalle description Camera", () => {
    expect(extractBillNumber("DDL 2920-A - VOTO FINALE")).toBe("2920-A");
    expect(extractBillNumber("DDL 2128 - EM 1.2")).toBe("2128");
    expect(extractBillNumber("TU DDL 1168 E ABB-A - EM 1.7")).toBe("1168");
    expect(extractBillNumber("DDL.n. 2920-A")).toBe("2920-A");
  });

  it("estrae dagli Ordini del Giorno Camera (numerazione 9/atto/progressivo)", () => {
    expect(extractBillNumber("ODG 9/2920/46")).toBe("2920");
    expect(extractBillNumber("ODG 9/2920/9")).toBe("2920");
    expect(extractBillNumber("odg 9/1632/3")).toBe("1632");
  });

  it("estrae dagli Ordini del Giorno in forma estesa, col suffisso 'E ABB'", () => {
    expect(extractBillNumber("Ordine del giorno n. 9/1049/3 ZANELLA LUANA (AVS)")).toBe("1049");
    expect(extractBillNumber("Ordine del giorno n. 9/1042 E ABB/11 BONETTI ELENA (APERRE)")).toBe(
      "1042",
    );
    expect(extractBillNumber("ODG 9/2564-A E ABB/1")).toBe("2564-A");
  });

  it("estrae dalle PDL (proposta di legge, stesso schema delle DDL)", () => {
    expect(extractBillNumber("PDL 1928-A - VOTO FINALE")).toBe("1928-A");
    expect(extractBillNumber("TU PDL 1928 E ABB-A/R - ODG 2")).toBe("1928");
    expect(extractBillNumber("Proposta di legge n. 703-B")).toBe("703-B");
  });

  it("ritorna vuoto sui riferimenti a Doc./relazioni e sui casi composti a 4 segmenti", () => {
    // "Doc." non è un DDL/PDL: nessuna estrazione forzata.
    expect(extractBillNumber("Ordine del giorno n. 9/Doc. VIII, n. 6/18 RICCIARDI (M5S)")).toBe(
      "",
    );
    // testo unificato + riferimento di ramo: 4 segmenti anziché 3, non tentiamo un'estrazione a rischio di errore.
    expect(extractBillNumber("ODG 9/1928 E ABB-A/R/8")).toBe("");
  });

  it("ritorna vuoto quando non c'è un DDL (mozioni, verifica numero legale, undefined)", () => {
    expect(extractBillNumber("Mozione n. 1-00234")).toBe("");
    expect(extractBillNumber("Verifica del numero legale")).toBe("");
    expect(extractBillNumber("")).toBe("");
    expect(extractBillNumber(undefined)).toBe("");
  });
});

describe("billBaseNumber", () => {
  it("rimuove il suffisso di lettura (per l'URI atto Camera)", () => {
    expect(billBaseNumber("1632-A")).toBe("1632");
    expect(billBaseNumber("2920-A")).toBe("2920");
    expect(billBaseNumber("924-bis")).toBe("924");
    expect(billBaseNumber("2128")).toBe("2128");
  });
});
