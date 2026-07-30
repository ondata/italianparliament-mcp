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

  it("esclude la latenza quando la finestra è interamente precedente al lotto", () => {
    const note = buildFreshnessNote("2026-07-28T13:16:06Z", {
      areaLabel: area,
      dateFrom: "2026-07-20",
      dateTo: "2026-07-22",
    });
    expect(note?.covered).toBe(true);
    expect(note?.text).toContain("interamente coperta");
    expect(note?.text).toContain("NON si spiega con il ritardo");
  });

  // Guardare solo dateFrom dichiarerebbe coperta tutta la finestra, escludendo a
  // torto la latenza per la sua coda; guardare solo dateTo farebbe l'errore
  // opposto su un intervallo storico lunghissimo. Il caso a cavallo va detto
  // per quello che è (review Greptile P1 su PR #87).
  it("riconosce la finestra a cavallo del lotto: coperta solo in parte", () => {
    const note = buildFreshnessNote("2026-07-28T13:16:06Z", {
      areaLabel: area,
      dateFrom: "2026-06-01",
      dateTo: "2026-07-31",
    });
    expect(note?.covered).toBe(false);
    expect(note?.text).toContain("coperta solo fino al 2026-07-28");
    expect(note?.text).toContain("per i giorni successivi");
  });

  // Finestra aperta a destra: se comincia prima del lotto include per
  // costruzione anche i giorni non caricati.
  it("tratta una finestra senza dateTo come aperta oltre il lotto", () => {
    const note = buildFreshnessNote("2026-07-28T13:16:06Z", {
      areaLabel: area,
      dateFrom: "2026-07-01",
    });
    expect(note?.covered).toBe(false);
    expect(note?.text).toContain("va dal 2026-07-01 in avanti");
  });

  // Con la sola dateTo la finestra è aperta a sinistra: il messaggio deve dire
  // "fino al", non "parte dal" (review Copilot su PR #87).
  it("con la sola dateTo parla della fine della finestra, non dell'inizio", () => {
    const note = buildFreshnessNote("2026-06-18T13:34:35Z", {
      areaLabel: "l'area dei lavori d'Aula",
      dateTo: "2026-07-01",
    });
    expect(note?.covered).toBe(false);
    expect(note?.text).toContain("va fino al 2026-07-01");
    expect(note?.text).not.toContain("parte dal");
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
