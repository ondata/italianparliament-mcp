import { describe, it, expect } from "vitest";
import { buildSenatoVotesEmptyHint } from "./senato-votes.js";

describe("buildSenatoVotesEmptyHint", () => {
  describe("con sonda (path per data)", () => {
    it("sedute=0 → nessuna seduta d'Assemblea", () => {
      const h = buildSenatoVotesEmptyHint(
        { dateFrom: "2020-08-15", dateTo: "2020-08-15" },
        18,
        { sedute: 0, votazioni: 0 },
      );
      expect(h).toContain("non risulta alcuna seduta d'Assemblea");
      expect(h).toContain("leg. 18");
      expect(h).not.toContain("buco della fonte");
    });

    it("sedute>0 e votazioni=0 → fingerprint buco della fonte", () => {
      const h = buildSenatoVotesEmptyHint(
        { dateFrom: "2020-03-10", dateTo: "2020-04-16" },
        18,
        { sedute: 9, votazioni: 0 },
      );
      expect(h).toContain("9 sedute d'Assemblea ma ZERO votazioni");
      expect(h).toContain("buco della fonte");
      expect(h).toContain("Non inventare");
    });

    it("votazioni>0 → dato pieno, è il filtro (caso Milleproroghe 26/2)", () => {
      const h = buildSenatoVotesEmptyHint(
        { dateFrom: "2020-02-26", dateTo: "2020-02-26", confidenceVote: true },
        18,
        { sedute: 1, votazioni: 21 },
      );
      expect(h).toContain("21 votazioni nel LOD");
      expect(h).toContain("--confidence-vote true");
      expect(h).not.toContain("buco della fonte");
    });

    it("non menziona mai la finestra COVID hardcoded fuori contesto", () => {
      // 26/2 non interseca 10/3–16/4: la vecchia stringa statica lo citava lo
      // stesso. Ora nessun riferimento a date specifiche non pertinenti.
      const h = buildSenatoVotesEmptyHint(
        { dateFrom: "2020-02-26", dateTo: "2020-02-26", confidenceVote: true },
        18,
        { sedute: 1, votazioni: 21 },
      );
      expect(h).not.toContain("10 marzo");
      expect(h).not.toContain("16 aprile");
      expect(h).not.toContain("Cura Italia");
    });

    it("descrive un giorno singolo quando from===to", () => {
      const h = buildSenatoVotesEmptyHint(
        { dateFrom: "2020-02-26", dateTo: "2020-02-26" },
        18,
        { sedute: 0, votazioni: 0 },
      );
      expect(h).toContain("giorno 2020-02-26");
    });
  });

  describe("senza sonda (frammenti statici pertinenti)", () => {
    it("con --ddl-uri mostra solo il blocco DDL, non quello label", () => {
      const h = buildSenatoVotesEmptyHint(
        { ddlUri: "http://dati.senato.it/ddl/58039" },
        19,
      );
      expect(h).toContain("Con --ddl-uri");
      expect(h).not.toContain("--date-from/--date-to intorno all'evento");
    });

    it("con filtri label mostra solo il blocco label, non quello DDL", () => {
      const h = buildSenatoVotesEmptyHint({ keyword: "bilancio" }, 19);
      expect(h).toContain("non compare in tutti i label");
      expect(h).not.toContain("Con --ddl-uri");
    });

    it("senza filtri discriminanti dà indicazione generica", () => {
      const h = buildSenatoVotesEmptyHint({}, 19);
      expect(h).toContain("Restringi la ricerca");
    });
  });
});
