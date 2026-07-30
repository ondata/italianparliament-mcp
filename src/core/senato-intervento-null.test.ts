import { describe, it, expect } from "vitest";
import {
  excludeInterventoNull,
  SENATO_INTERVENTO_NULL,
} from "./senato-intervento-null.js";

describe("excludeInterventoNull", () => {
  it("esclude la risorsa senza identità, non gli interventi con id", () => {
    const f = excludeInterventoNull();
    expect(f).toContain(SENATO_INTERVENTO_NULL);
    expect(f).toMatch(/\?int != </);
    // Il filtro è per identità esatta: un match per sottostringa su "null"
    // scarterebbe anche interventi veri il cui id contenesse quella sequenza.
    expect(f).not.toMatch(/CONTAINS|REGEX|STRENDS/);
  });

  it("accetta un nome di variabile diverso", () => {
    expect(excludeInterventoNull("?i")).toMatch(/\?i != </);
  });
});
