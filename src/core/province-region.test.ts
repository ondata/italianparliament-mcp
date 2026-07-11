import { describe, it, expect } from "vitest";
import { normProvince, regionFromProvince, canonicalRegion } from "./province-region.js";

describe("normProvince", () => {
  it("toglie accenti, minuscolizza e normalizza i separatori", () => {
    expect(normProvince("Forlì-Cesena")).toBe("forli cesena");
    expect(normProvince("Valle d'Aosta")).toBe("valle d aosta");
    expect(normProvince("  Reggio   Emilia ")).toBe("reggio emilia");
  });
});

describe("regionFromProvince", () => {
  it("risolve province italiane in qualsiasi grafia ragionevole", () => {
    expect(regionFromProvince("Rovigo")).toBe("Veneto");
    expect(regionFromProvince("cremona")).toBe("Lombardia");
    expect(regionFromProvince("POTENZA")).toBe("Basilicata");
  });
  it("copre gli alias delle forme brevi del Senato", () => {
    expect(regionFromProvince("Aosta")).toBe("Valle d'Aosta/Vallée d'Aoste");
    expect(regionFromProvince("Bolzano")).toBe("Trentino-Alto Adige/Südtirol");
    expect(regionFromProvince("Sud Sardegna")).toBe("Sardegna");
  });
  it("ritorna stringa vuota per input assente o non risolvibile", () => {
    expect(regionFromProvince("")).toBe("");
    expect(regionFromProvince(undefined)).toBe("");
    expect(regionFromProvince("Parigi")).toBe("");
  });
});

describe("canonicalRegion", () => {
  it("porta gli slug regione della Camera alla forma canonica del Senato", () => {
    expect(canonicalRegion("veneto")).toBe("Veneto");
    expect(canonicalRegion("emilia-romagna")).toBe("Emilia-Romagna");
    expect(canonicalRegion("friuli-venezia-giulia")).toBe("Friuli-Venezia Giulia");
    expect(canonicalRegion("trentino-alto-adige")).toBe("Trentino-Alto Adige/Südtirol");
    expect(canonicalRegion("valle-d-aosta")).toBe("Valle d'Aosta/Vallée d'Aoste");
  });
  it("ritorna vuoto per gli stati esteri (disambiguazione slug a 2 parti)", () => {
    expect(canonicalRegion("svizzera")).toBe("");
    expect(canonicalRegion("argentina")).toBe("");
    expect(canonicalRegion("")).toBe("");
  });
});
