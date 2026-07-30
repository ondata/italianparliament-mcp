import { describe, it, expect } from "vitest";
import { buildFreshnessNote } from "./freshness.js";

const area = "l'area degli atti di indirizzo e controllo (aic)";

describe("buildFreshnessNote", () => {
  it("tace se la classe non espone un timestamp di caricamento", () => {
    expect(
      buildFreshnessNote(undefined, { areaLabel: area, dateFrom: "2026-07-29" }),
    ).toBeUndefined();
  });

  it("tace senza filtro di data: lì il vuoto non c'entra con la latenza", () => {
    expect(buildFreshnessNote("2026-07-28T13:16:06Z", { areaLabel: area })).toBeUndefined();
  });

  it("avverte quando la finestra è successiva all'ultimo lotto", () => {
    const note = buildFreshnessNote("2026-07-28T13:16:06Z", {
      areaLabel: area,
      dateFrom: "2026-07-29",
    });
    expect(note?.covered).toBe(false);
    expect(note?.text).toContain("caricata fino al 2026-07-28");
    expect(note?.text).toContain("non ancora pubblicato");
  });

  // Il lotto del 28/07 contiene gli atti fino al 27/07: chiedere esattamente il
  // giorno del lotto è già zona ambigua, non copertura.
  it("tratta il giorno stesso del lotto come non ancora coperto", () => {
    const note = buildFreshnessNote("2026-07-28T13:16:06Z", {
      areaLabel: area,
      dateFrom: "2026-07-28",
    });
    expect(note?.covered).toBe(false);
    expect(note?.text).toContain("non è ancora coperta da un caricamento");
  });

  it("esclude la latenza quando la finestra è precedente al lotto", () => {
    const note = buildFreshnessNote("2026-07-28T13:16:06Z", {
      areaLabel: area,
      dateFrom: "2026-07-20",
      dateTo: "2026-07-22",
    });
    expect(note?.covered).toBe(true);
    expect(note?.text).toContain("è coperta");
    expect(note?.text).toContain("NON si spiega con il ritardo");
  });

  // Con la sola dateTo la finestra è aperta a sinistra: il confronto usa
  // comunque l'unico estremo disponibile.
  it("usa dateTo quando dateFrom manca", () => {
    const note = buildFreshnessNote("2026-06-18T13:34:35Z", {
      areaLabel: "l'area dei lavori d'Aula",
      dateTo: "2026-07-01",
    });
    expect(note?.covered).toBe(false);
  });

  // Le aree divergono: al 2026-07-29 gli atti erano al 28/07 e le sedute al
  // 18/06. La stessa finestra è quindi coperta per una e non per l'altra.
  it("dà esiti diversi per aree con lotti diversi, a parità di finestra", () => {
    const window = { dateFrom: "2026-07-01", dateTo: "2026-07-10" };
    expect(
      buildFreshnessNote("2026-07-28T13:16:06Z", { areaLabel: area, ...window })?.covered,
    ).toBe(true);
    expect(
      buildFreshnessNote("2026-06-18T13:34:35Z", { areaLabel: "le sedute", ...window })?.covered,
    ).toBe(false);
  });
});
