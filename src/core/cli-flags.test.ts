import { describe, it, expect } from "vitest";
import {
  buildUnknownFlagError,
  dashPrefixes,
  parseBoolFlag,
  suggestFlag,
  unknownFlags,
} from "./cli-flags.js";

describe("unknownFlags", () => {
  const declared = ["legislature", "date-from", "date-to", "limit", "format"];

  it("accetta i nomi dichiarati", () => {
    expect(unknownFlags(["legislature", "limit"], declared)).toEqual([]);
  });

  it("accetta la grafia camelCase, che citty già risolve", () => {
    // `--dateFrom` funziona oggi grazie al Proxy di citty: rifiutarlo sarebbe
    // una regressione, non una validazione.
    expect(unknownFlags(["dateFrom", "dateTo"], declared)).toEqual([]);
  });

  it("accetta la grafia kebab di un nome dichiarato in camelCase", () => {
    expect(unknownFlags(["as-of"], ["asOf"])).toEqual([]);
  });

  it("segnala il nome inesistente (caso --committee-uri del report)", () => {
    expect(unknownFlags(["committee-uri"], ["committee-name", "limit"])).toEqual([
      "committee-uri",
    ]);
  });

  it("segnala tutti i nomi ignoti, non solo il primo", () => {
    expect(unknownFlags(["pippo", "limit", "pluto"], declared)).toEqual([
      "pippo",
      "pluto",
    ]);
  });
});

describe("suggestFlag", () => {
  it("suggerisce il nome vicino", () => {
    expect(suggestFlag("committee-uri", ["committee-name", "keyword"])).toBe(
      "committee-name",
    );
  });

  it("non suggerisce nulla quando nessun nome è plausibile", () => {
    expect(suggestFlag("this-flag-does-not-exist", ["limit", "format"])).toBeUndefined();
  });
});

describe("buildUnknownFlagError", () => {
  it("dice che il filtro NON è stato applicato ed elenca i validi", () => {
    const e = buildUnknownFlagError(["committee-uri"], ["committee-name", "limit"]);
    expect(e).toContain("Opzione sconosciuta: --committee-uri");
    expect(e).toContain("forse intendevi --committee-name?");
    expect(e).toContain("NON è stato applicato");
    expect(e).toContain("--limit");
  });

  it("plurale con più opzioni ignote", () => {
    expect(buildUnknownFlagError(["a", "b"], ["limit"])).toContain(
      "Opzioni sconosciute",
    );
  });

  it("cita l'opzione con il numero di trattini digitato dall'utente", () => {
    const e = buildUnknownFlagError(["q"], ["limit"], dashPrefixes(["-q"]));
    expect(e).toContain("-q");
    expect(e).not.toContain("--q");
  });
});

describe("dashPrefixes", () => {
  it("distingue forma corta e lunga", () => {
    const m = dashPrefixes(["-q", "--limit", "5", "--date-from", "2020-01-01"]);
    expect(m.get("q")).toBe("-");
    expect(m.get("limit")).toBe("--");
    expect(m.get("date-from")).toBe("--");
  });
});

describe("parseBoolFlag", () => {
  it("legge true e false, in entrambe le forme", () => {
    expect(parseBoolFlag("true", "confidence-vote")).toBe(true);
    expect(parseBoolFlag("false", "confidence-vote")).toBe(false);
    expect(parseBoolFlag(true, "confidence-vote")).toBe(true);
    expect(parseBoolFlag(false, "confidence-vote")).toBe(false);
  });

  it("opzione assente resta indefinita: nessun filtro, ed è corretto così", () => {
    expect(parseBoolFlag(undefined, "confidence-vote")).toBeUndefined();
  });

  it("il flag nudo è un ERRORE, non un filtro assente", () => {
    // citty mette la stringa vuota per `--confidence-vote` senza valore.
    // Trattarla come "opzione assente" restituiva TUTTE le votazioni (19.428)
    // a chi ne voleva 71, senza alcun segnale: risultato plausibile e sbagliato.
    expect(() => parseBoolFlag("", "confidence-vote")).toThrow(
      /richiede un valore/,
    );
    expect(() => parseBoolFlag("", "confidence-vote")).toThrow(
      /--confidence-vote true/,
    );
  });

  it("un valore non booleano resta un errore", () => {
    expect(() => parseBoolFlag("si", "approved")).toThrow(/Expected: true or false/);
  });
});
