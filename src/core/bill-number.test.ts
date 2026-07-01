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
