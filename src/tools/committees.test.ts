import { describe, it, expect } from "vitest";
import { mergeSenatoCommittees } from "./committees.js";

const row = (o: Partial<Record<string, string>> & { uri: string }) => ({
  chamber: "senato",
  uri: o.uri,
  title: o.title ?? "",
  short_title: o.short_title ?? "",
  subtitle: o.subtitle ?? "",
  category: o.category ?? "",
  session_count: o.session_count ?? "",
});

// I due insiemi si intersecano solo in parte (#82): le Giunte hanno anagrafica
// ma non sedute, gli organi "2-*" hanno sedute ma non esistono come risorse.
describe("mergeSenatoCommittees", () => {
  it("tiene gli organi con sedute e ne completa l'anagrafica", () => {
    const out = mergeSenatoCommittees(
      [row({ uri: "c/0-1", short_title: "Affari Costituzionali", session_count: "742" })],
      [row({ uri: "c/0-1", title: "1a Commissione", short_title: "Affari Costituzionali", category: "Commissioni permanenti" })],
    );
    expect(out).toHaveLength(1);
    expect(out[0].session_count).toBe("742");
    expect(out[0].title).toBe("1a Commissione");
    expect(out[0].category).toBe("Commissioni permanenti");
  });

  it("aggiunge gli organi descritti ma senza sedute, con conteggio 0 (le Giunte)", () => {
    const out = mergeSenatoCommittees(
      [row({ uri: "c/0-1", short_title: "Affari Costituzionali", session_count: "742" })],
      [row({ uri: "c/0-21", short_title: "Giunta delle elezioni", category: "Giunte" })],
    );
    expect(out.map((r) => r.uri)).toEqual(["c/0-1", "c/0-21"]);
    expect(out[1].session_count).toBe("0");
  });

  it("tiene gli organi con sedute ma privi di anagrafica, senza inventarne il nome", () => {
    const out = mergeSenatoCommittees([row({ uri: "c/2-1", session_count: "647" })], []);
    expect(out).toHaveLength(1);
    expect(out[0].short_title).toBe("");
    expect(out[0].title).toBe("");
    expect(out[0].session_count).toBe("647");
  });

  it("ordina per numero di sedute decrescente, poi per titolo", () => {
    const out = mergeSenatoCommittees(
      [
        row({ uri: "c/0-5", short_title: "Bilancio", session_count: "592" }),
        row({ uri: "c/2-1", session_count: "647" }),
      ],
      [
        row({ uri: "c/0-22", short_title: "Biblioteca", category: "Giunte" }),
        row({ uri: "c/0-21", short_title: "Giunta delle elezioni", category: "Giunte" }),
      ],
    );
    expect(out.map((r) => r.uri)).toEqual(["c/2-1", "c/0-5", "c/0-22", "c/0-21"]);
  });

  it("non duplica un organo presente in entrambi gli insiemi", () => {
    const out = mergeSenatoCommittees(
      [row({ uri: "c/0-1", session_count: "742" })],
      [row({ uri: "c/0-1", short_title: "Affari Costituzionali" })],
    );
    expect(out).toHaveLength(1);
    expect(out[0].short_title).toBe("Affari Costituzionali");
  });
});
