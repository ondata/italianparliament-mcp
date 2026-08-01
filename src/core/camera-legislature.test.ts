import { describe, it, expect } from "vitest";
import {
  legislaturesForDateRange,
  parseLegislatureRanges,
  type LegislatureRange,
} from "./camera-legislature.js";

const RIGHE = [
  { uri: "http://dati.camera.it/ocd/legislatura.rdf/repubblica_17", date: "20130315-20180322" },
  { uri: "http://dati.camera.it/ocd/legislatura.rdf/repubblica_18", date: "20180323-20221012" },
  { uri: "http://dati.camera.it/ocd/legislatura.rdf/repubblica_19", date: "20221013" },
];

describe("parseLegislatureRanges", () => {
  it("legge intervallo chiuso e legislatura in corso", () => {
    expect(parseLegislatureRanges(RIGHE)).toEqual([
      { legislature: 17, from: "20130315", to: "20180322" },
      { legislature: 18, from: "20180323", to: "20221012" },
      { legislature: 19, from: "20221013", to: undefined },
    ]);
  });

  it("scarta le legislature del Regno, che nessun tool interroga", () => {
    expect(
      parseLegislatureRanges([
        { uri: "http://dati.camera.it/ocd/legislatura.rdf/regno_16", date: "18860510-18900427" },
        ...RIGHE,
      ]).map((r) => r.legislature),
    ).toEqual([17, 18, 19]);
  });

  it("scarta le righe senza data o con intervallo malformato invece di indovinare", () => {
    expect(
      parseLegislatureRanges([
        { uri: "http://dati.camera.it/ocd/legislatura.rdf/repubblica_15", date: "" },
        { uri: "http://dati.camera.it/ocd/legislatura.rdf/repubblica_16", date: "2008" },
      ]),
    ).toEqual([]);
  });
});

const RANGES: LegislatureRange[] = parseLegislatureRanges(RIGHE);

describe("legislaturesForDateRange", () => {
  it("una data dentro una legislatura dà solo quella", () => {
    expect(legislaturesForDateRange(RANGES, "20201209", "20201209")).toEqual([18]);
  });

  it("intervallo a cavallo → più legislature", () => {
    expect(legislaturesForDateRange(RANGES, "20220901", "20221231")).toEqual([18, 19]);
  });

  it("estremo aperto a destra include la legislatura in corso", () => {
    expect(legislaturesForDateRange(RANGES, "20200101", undefined)).toEqual([18, 19]);
  });

  it("estremo aperto a sinistra include tutto ciò che precede", () => {
    expect(legislaturesForDateRange(RANGES, undefined, "20180101")).toEqual([17]);
  });

  it("data futura oltre l'inizio della corrente resta nella corrente", () => {
    expect(legislaturesForDateRange(RANGES, "20260729", "20260729")).toEqual([19]);
  });

  it("data anteriore a tutte le legislature note non ne dà nessuna", () => {
    expect(legislaturesForDateRange(RANGES, "20000101", "20000131")).toEqual([]);
  });

  it("un intervallo molto ampio ne può coprire più di due", () => {
    expect(legislaturesForDateRange(RANGES, "20140101", "20230101")).toEqual([
      17, 18, 19,
    ]);
  });
});
