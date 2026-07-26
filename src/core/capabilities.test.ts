import { describe, it, expect } from "vitest";
import { CAPABILITIES, capabilityScore } from "./capabilities.js";

// Guardie anti-drift sul catalogo di `which` (review Copilot PR #48): gli
// esempi sono curati a mano, questi vincoli strutturali impediscono che si
// scollino dai comandi che dichiarano di illustrare.
describe("CAPABILITIES", () => {
  it("ogni example inizia con 'italianparliament <cmd>' (incollabile e coerente)", () => {
    for (const c of CAPABILITIES) {
      expect(c.example, `example di "${c.cmd}"`).toMatch(
        new RegExp(`^italianparliament ${c.cmd}( |$)`),
      );
    }
  });

  it("nessuna forma combinata 'a / b' in cmd (deve essere un solo comando eseguibile)", () => {
    for (const c of CAPABILITIES) {
      expect(c.cmd, `cmd "${c.cmd}"`).not.toContain(" / ");
    }
  });

  it("terms e desc mai vuoti, cmd unici", () => {
    const seen = new Set<string>();
    for (const c of CAPABILITIES) {
      expect(c.terms.length, `terms di "${c.cmd}"`).toBeGreaterThan(0);
      expect(c.desc, `desc di "${c.cmd}"`).not.toBe("");
      expect(seen.has(c.cmd), `cmd duplicato "${c.cmd}"`).toBe(false);
      seen.add(c.cmd);
    }
  });
});

describe("capabilityScore", () => {
  it("match esatto sul term batte il match parziale", () => {
    const cap = CAPABILITIES.find((c) => c.cmd === "person-career show")!;
    expect(capabilityScore(cap, "carriera")).toBe(100);
    expect(capabilityScore(cap, "carrier")).toBe(70);
  });

  it("query senza alcun match dà 0", () => {
    const cap = CAPABILITIES.find((c) => c.cmd === "search find")!;
    expect(capabilityScore(cap, "zzz-inesistente")).toBe(0);
  });

  it("query vuota o di soli spazi dà 0 (la funzione si difende da sola, è esportata)", () => {
    const cap = CAPABILITIES.find((c) => c.cmd === "search find")!;
    expect(capabilityScore(cap, "")).toBe(0);
    expect(capabilityScore(cap, "   ")).toBe(0);
  });

  // Il tema Giunta per le autorizzazioni era scoperto, e "immunità
  // parlamentare" veniva instradata su `search find` per via del term
  // "parlamentare" nudo: un match sbagliato è peggio di nessun match (#78).
  const best = (q: string) =>
    CAPABILITIES.map((c) => ({ cmd: c.cmd, score: capabilityScore(c, q) }))
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score);

  it("le formulazioni sulla Giunta portano ai comandi su commissioni e giunte", () => {
    for (const q of ["giunta per le autorizzazioni", "autorizzazione a procedere", "immunità parlamentare"]) {
      const cmds = best(q).map((c) => c.cmd);
      expect(cmds, `query "${q}"`).toContain("committee-members list");
      expect(cmds, `query "${q}"`).toContain("committees list");
    }
  });

  it("'immunità parlamentare' non instrada più su search find", () => {
    expect(best("immunità parlamentare").map((c) => c.cmd)).not.toContain("search find");
  });

  it("'gruppo parlamentare' resta sui gruppi, non sulla ricerca per nome", () => {
    const cmds = best("gruppo parlamentare").map((c) => c.cmd);
    expect(cmds).toContain("groups list");
    expect(cmds).not.toContain("search find");
  });

  it("non-regressione: cercare una persona porta ancora a search find", () => {
    for (const q of ["cerca", "parlamentare", "nome", "trova persona"]) {
      expect(best(q).map((c) => c.cmd), `query "${q}"`).toContain("search find");
    }
  });

  it("match case-insensitive sui terms", () => {
    const cap = CAPABILITIES.find((c) => c.cmd === "person-career show")!;
    expect(capabilityScore(cap, "CARRIERA")).toBe(100);
    expect(capabilityScore(cap, "  Carriera  ")).toBe(100);
  });
});
