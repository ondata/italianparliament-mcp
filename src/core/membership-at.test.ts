import { describe, it, expect } from "vitest";
import { chunkWhile, isoDate, pickDenominationAt, pickMembershipAt } from "./membership-at.js";

describe("isoDate", () => {
  it("Camera YYYYMMDD → ISO", () => {
    expect(isoDate("20130515")).toBe("2013-05-15");
  });
  it("Senato datetime stringa (date di firma) → solo la data", () => {
    expect(isoDate("2023-01-13 00:00:00.0")).toBe("2023-01-13");
  });
  it("ISO e vuoto restano com'erano", () => {
    expect(isoDate("2023-01-13")).toBe("2023-01-13");
    expect(isoDate("")).toBe("");
    expect(isoDate(undefined)).toBe("");
  });
});

// Capelli (d306066_17): MISTO 2013-03-19 → 2014-11-19, poi gr1889 fino a fine legislatura.
const capelli = [
  { group_uri: "gr1589", group_label: "MISTO", start: "2013-03-19", end: "2014-11-19" },
  { group_uri: "gr1889", group_label: "PER L'ITALIA", start: "2014-11-19", end: "2018-03-22" },
];

describe("pickMembershipAt", () => {
  it("una sola adesione valida alla data", () => {
    expect(pickMembershipAt(capelli, "2013-05-15")).toEqual({ group_uri: "gr1589", group_label: "MISTO" });
    expect(pickMembershipAt(capelli, "2015-06-15")).toEqual({ group_uri: "gr1889", group_label: "PER L'ITALIA" });
  });
  it("nessuna adesione alla data → vuoto", () => {
    expect(pickMembershipAt(capelli, "2012-01-01")).toEqual({ group_uri: "", group_label: "" });
    expect(pickMembershipAt([], "2015-06-15")).toEqual({ group_uri: "", group_label: "" });
  });
  it("data vuota → vuoto, senza indovinare", () => {
    expect(pickMembershipAt(capelli, "")).toEqual({ group_uri: "", group_label: "" });
  });
  it("adesione in corso (end vuota) vale fino a oggi", () => {
    const m = [{ group_uri: "gr4133", group_label: "FDI", start: "2022-10-18", end: "" }];
    expect(pickMembershipAt(m, "2025-11-12").group_uri).toBe("gr4133");
  });
  it("nodi duplicati identici (Senato) → una sola", () => {
    const m = [
      { group_uri: "g87", group_label: "A", start: "2021-01-26", end: "2021-03-29" },
      { group_uri: "g87", group_label: "A", start: "2021-01-26", end: "2021-03-29" },
    ];
    expect(pickMembershipAt(m, "2021-02-01")).toEqual({ group_uri: "g87", group_label: "A" });
  });
  it("due adesioni valide il giorno del cambio → entrambe con ';'", () => {
    expect(pickMembershipAt(capelli, "2014-11-19")).toEqual({
      group_uri: "gr1589;gr1889",
      group_label: "MISTO;PER L'ITALIA",
    });
  });
});

describe("pickDenominationAt", () => {
  const den = [
    { title: "Lega-Salvini Premier", start: "2018-03-27", end: "2022-10-12" },
    { title: "Lega Salvini Premier - PSd'Az", start: "2022-10-13", end: "" },
  ];
  it("la denominazione in vigore alla data", () => {
    expect(pickDenominationAt(den, "2020-01-01")).toBe("Lega-Salvini Premier");
    expect(pickDenominationAt(den, "2023-01-13")).toBe("Lega Salvini Premier - PSd'Az");
  });
  it("nessuna copre la data → l'ultima iniziata", () => {
    expect(pickDenominationAt(den, "2017-01-01")).toBe("Lega Salvini Premier - PSd'Az");
  });
});

describe("chunkWhile", () => {
  it("spezza quando il blocco non entra più, almeno un elemento per blocco", () => {
    expect(chunkWhile([1, 2, 3, 4, 5], (c) => c.length <= 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunkWhile([1], () => false)).toEqual([[1]]);
    expect(chunkWhile([], () => true)).toEqual([]);
  });
});
