import { describe, it, expect } from "vitest";
import { resolveGroupAcronym, buildGroupAcronymHint } from "./vote-detail.js";

// Sigle realmente presenti in una votazione di leg. 19 (vs19_456_018).
const AVAILABLE = [
  "FDI",
  "M5S",
  "LEGA",
  "M-ALT",
  "M-MIN",
  "PD-IDP",
  "FI-PPE",
  "AVS",
  "M-+EUR",
  "APERRE",
  "IVICRE",
  "NM-M-C",
];

describe("resolveGroupAcronym", () => {
  it("match esatto", () => {
    expect(resolveGroupAcronym("FDI", AVAILABLE)).toBe("FDI");
    expect(resolveGroupAcronym("FI-PPE", AVAILABLE)).toBe("FI-PPE");
  });

  it("ignora maiuscole/minuscole", () => {
    expect(resolveGroupAcronym("fdi", AVAILABLE)).toBe("FDI");
    expect(resolveGroupAcronym("Pd-Idp", AVAILABLE)).toBe("PD-IDP");
  });

  it("ignora la punteggiatura", () => {
    expect(resolveGroupAcronym("PD IDP", AVAILABLE)).toBe("PD-IDP");
    expect(resolveGroupAcronym("nmmc", AVAILABLE)).toBe("NM-M-C");
  });

  it("null sulle sigle di groups list non derivabili da una regola", () => {
    // Sono i casi che motivano l'hint: nessuna normalizzazione le riconcilia.
    expect(resolveGroupAcronym("AZ-PER-RE", AVAILABLE)).toBeNull();
    expect(resolveGroupAcronym("IV-CR", AVAILABLE)).toBeNull();
    expect(resolveGroupAcronym("MISTO", AVAILABLE)).toBeNull();
  });

  it("null su sigla inesistente", () => {
    expect(resolveGroupAcronym("XYZ", AVAILABLE)).toBeNull();
  });
});

describe("buildGroupAcronymHint", () => {
  it("suggerisce la sigla più simile e elenca quelle presenti", () => {
    const h = buildGroupAcronymHint("AZ-PER-RE", AVAILABLE);
    expect(h).toContain('Nessun gruppo con sigla "AZ-PER-RE"');
    expect(h).toContain('Forse cercavi "APERRE"');
    expect(h).toContain("IVICRE");
  });

  it("suggerisce IVICRE per IV-CR", () => {
    expect(buildGroupAcronymHint("IV-CR", AVAILABLE)).toContain('Forse cercavi "IVICRE"');
  });

  it("spiega che il Misto è disaggregato", () => {
    const h = buildGroupAcronymHint("MISTO", AVAILABLE);
    expect(h).toContain("Misto");
    expect(h).toContain("M-ALT");
    // Nessuna componente somiglia a "MISTO": meglio nessun suggerimento che uno a caso.
    expect(h).not.toContain("Forse cercavi");
  });

  it("non suggerisce nulla su una sigla senza affinità", () => {
    expect(buildGroupAcronymHint("XYZ", AVAILABLE)).not.toContain("Forse cercavi");
  });

  it("votazione senza sigle: dice che il filtro non è applicabile", () => {
    expect(buildGroupAcronymHint("FDI", [])).toContain("non è applicabile");
  });
});
