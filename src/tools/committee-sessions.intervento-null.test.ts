import { describe, it, expect } from "vitest";
import { committeeSessionsTool } from "./committee-sessions.js";

/**
 * Il grafo del Senato ha una risorsa `osr:Intervento` senza identità
 * (`intervento/null`) in cui collassano gli interventi privi di id, collegata a
 * 36.853 sedute e 47.571 oggetti di trattazione. Il join
 * oggetto→intervento→seduta la attraversava, quindi restituiva righe FALSE: per
 * l'Atto del Governo n. 418 (schema di d.lgs. su IA e attività di polizia)
 * erano 18.945 sedute, incluse sedute d'Assemblea del 1996. Vedi
 * `src/core/senato-intervento-null.ts` e la trappola nel wiki LOD.
 */
describe("committee-sessions: la risorsa Intervento senza identità non genera righe", () => {
  it("su un atto agganciato solo al nodo senza id non inventa sedute, e spiega il vuoto", async () => {
    await expect(
      committeeSessionsTool.execute({
        ddlUri: "http://dati.senato.it/documento/54072",
        chamber: "both",
        limit: 200,
        offset: 0,
      }),
    ).rejects.toThrow(/senza identità/);
  }, 60000);

  it("non menziona il nodo quando l'atto semplicemente non è mai andato in commissione", async () => {
    // URI valido ma senza alcun oggetto di trattazione collegato: qui il vuoto è
    // genuino e il messaggio deve restare quello generico.
    await expect(
      committeeSessionsTool.execute({
        ddlUri: "http://dati.senato.it/documento/999999999",
        chamber: "both",
        limit: 200,
        offset: 0,
      }),
    ).rejects.toThrow(/potrebbe non essere ancora stato esaminato/);
  }, 60000);

  it("un DDL realmente esaminato resta completo e senza sedute fuori legislatura", async () => {
    // DDL delega nucleare (S.1924): 17 sedute, tutte della legislatura 19. Il
    // filtro non deve tagliare le righe legittime — inclusa la seduta d'Aula del
    // 29/7/2026, che viene da un intervento con id vero.
    const result = await committeeSessionsTool.execute({
      ddlUri: "http://dati.senato.it/ddl/60187",
      chamber: "both",
      limit: 1000,
      offset: 0,
    });
    expect(result.rows.length).toBeGreaterThan(10);
    expect(result.rows.every((r) => r.date >= "2022-01-01")).toBe(true);
  }, 60000);
});

describe("committee-sessions --count-only: uno zero non va letto come 'non esaminato'", () => {
  it("spiega lo zero quando l'atto è agganciato solo al nodo senza id", async () => {
    const result = await committeeSessionsTool.execute({
      ddlUri: "http://dati.senato.it/documento/54072",
      chamber: "both",
      countOnly: true,
      limit: 200,
      offset: 0,
    });
    expect(result.rows[0].count).toBe("0");
    expect(result.notice).toMatch(/NON significa che l'atto non sia stato esaminato/);
  }, 60000);

  it("non aggiunge rumore quando le sedute ci sono", async () => {
    const result = await committeeSessionsTool.execute({
      ddlUri: "http://dati.senato.it/ddl/60187",
      chamber: "both",
      countOnly: true,
      limit: 200,
      offset: 0,
    });
    expect(Number(result.rows[0].count)).toBeGreaterThan(10);
    expect(result.notice).toBeUndefined();
  }, 60000);
});
