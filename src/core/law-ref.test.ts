import { describe, it, expect } from "vitest";
import { normattivaUrl, pairLaw } from "./law-ref.js";

describe("normattivaUrl", () => {
  it("legge ordinaria, di conversione e di bilancio → urn legge", () => {
    for (const nat of ["ordinaria", "di conversione di decreto-legge", "di approvazione di bilancio"]) {
      expect(normattivaUrl(nat, "2025-11-13", "177")).toBe(
        "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:2025-11-13;177",
      );
    }
  });

  it("legge costituzionale → urn legge.costituzionale", () => {
    expect(normattivaUrl("costituzionale", "2020-10-19", "1")).toBe(
      "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge.costituzionale:2020-10-19;1",
    );
  });

  it("natura sconosciuta o vuota → nessun link (l'urn col tipo sbagliato apre un altro atto)", () => {
    expect(normattivaUrl("", "2020-10-19", "1")).toBe("");
    expect(normattivaUrl("regionale", "2020-10-19", "1")).toBe("");
  });
});

describe("pairLaw", () => {
  const today = "2026-11-04";

  it("una coppia sola → numero, data e link", () => {
    expect(pairLaw(["177"], ["2025-11-13"], "ordinaria", today)).toEqual({
      law_number: "177",
      law_date: "2025-11-13",
      law_url: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:2025-11-13;177",
    });
  });

  it("niente numero → tutto vuoto", () => {
    expect(pairLaw([], [], "ordinaria", today)).toEqual({ law_number: "", law_date: "", law_url: "" });
  });

  it("data segnaposto nel futuro (2100-01-01) → valori grezzi, nessun link", () => {
    // ddl/58803 (leg. 19, costituzionale)
    expect(pairLaw(["690"], ["2100-01-01"], "costituzionale", today)).toEqual({
      law_number: "690",
      law_date: "2100-01-01",
      law_url: "",
    });
  });

  it("due coppie non accoppiabili → valori elencati con ';', nessun link", () => {
    // ddl/49285 (riduzione dei parlamentari): 1 e 687, 2020-10-19 e 2100-01-01
    expect(pairLaw(["687", "1", "1"], ["2100-01-01", "2020-10-19"], "costituzionale", today)).toEqual({
      law_number: "1;687",
      law_date: "2020-10-19;2100-01-01",
      law_url: "",
    });
  });
});
