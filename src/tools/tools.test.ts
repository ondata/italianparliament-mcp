import { describe, it, expect } from "vitest";
import { peopleTool } from "./people.js";
import { deputiesTool } from "./deputies.js";
import { senatorsTool } from "./senators.js";
import { searchTool } from "./search.js";
import { legislaturesTool } from "./legislatures.js";
import { groupsTool } from "./groups.js";
import { sessionsTool } from "./sessions.js";
import { governmentsTool } from "./governments.js";
import { billsTool } from "./bills.js";
import { votesTool } from "./votes.js";
import { speechesTool } from "./speeches.js";
import { aicTool } from "./aic.js";
import { voteDetailTool } from "./vote-detail.js";
import { groupMembersTool } from "./group-members.js";
import { deputyTool } from "./deputy.js";
import { senatorTool } from "./senator.js";
import { billTool } from "./bill.js";
import { rolesTool } from "./roles.js";
import { govMembersTool } from "./gov-members.js";
import { committeesTool } from "./committees.js";
import { billProgressTool } from "./bill-progress.js";
import { billSignatoriesTool } from "./bill-signatories.js";
import { amendmentsTool, enrichProponents, checkAknTruncation, aknEmptyHint } from "./amendments.js";
import { senatoVotesTool } from "./senato-votes.js";
import { cameraAmendmentsTool } from "./camera-amendments.js";
import { documentsTool } from "./documents.js";
import { attendanceTool } from "./attendance.js";
import { senatoAttendanceTool } from "./senato-attendance.js";

// Integration tests — hit real SPARQL endpoints.
// Run with: npx vitest run src/tools/tools.test.ts
// These are slow (network), so timeout is generous.

describe("Camera tools", () => {
  it("deputies: returns rows for legislature 19", async () => {
    const result = await deputiesTool.execute({ legislature: 19, limit: 3, offset: 0 });
    expect(result.rows.length).toBe(3);
    expect(result.rows[0]).toHaveProperty("first_name");
    expect(result.rows[0]).toHaveProperty("last_name");
  }, 30000);

  it("deputies: demographic filters (gender + birthplace) constrain output", async () => {
    // Deputate leg.19 nate in Sicilia. Alla Camera birth_place NON è la città ma
    // lo slug dell'URI del luogo `comune_provincia_regione` (es.
    // "messina_messina_sicilia"): la regione è codificata lì, ed è ciò che rende
    // filtrabile la regione di nascita (a differenza del Senato, solo città).
    const result = await deputiesTool.execute({
      legislature: 19,
      gender: "female",
      birthPlace: "sicilia",
      limit: 100,
      offset: 0,
    });
    expect(result.rows.length).toBeGreaterThan(0);
    for (const r of result.rows) {
      expect(r.gender).toBe("female");
      // slug comune_provincia_regione che termina con la regione filtrata
      expect(r.birth_place).toMatch(/_sicilia$/);
      expect(r.birth_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  }, 30000);

  it("deputies: born-from/born-to bound the birth date", async () => {
    const result = await deputiesTool.execute({
      legislature: 19,
      bornFrom: "1990-01-01",
      bornTo: "1999-12-31",
      limit: 100,
      offset: 0,
    });
    expect(result.rows.length).toBeGreaterThan(0);
    for (const r of result.rows) {
      expect(r.birth_date >= "1990-01-01" && r.birth_date <= "1999-12-31").toBe(true);
    }
  }, 30000);

  it("legislatures: returns all legislatures", async () => {
    const result = await legislaturesTool.execute({});
    expect(result.rows.length).toBeGreaterThan(30);
    expect(result.rows[0]).toHaveProperty("uri");
    expect(result.rows[0]).toHaveProperty("date");
  }, 30000);

  it("groups: returns groups with acronyms for leg 19", async () => {
    const result = await groupsTool.execute({ legislature: 19, limit: 100 });
    expect(result.rows.length).toBeGreaterThan(5);
    const fdi = result.rows.find((r) => r.acronym === "FDI");
    expect(fdi).toBeDefined();
    const m5s = result.rows.find((r) => r.acronym === "M5S");
    expect(m5s).toBeDefined();
  }, 30000);

  it("sessions: returns sessions without BF_ duplicates", async () => {
    const result = await sessionsTool.execute({ legislature: 19, limit: 5, offset: 0 });
    expect(result.rows.length).toBe(5);
    for (const row of result.rows) {
      expect(row.uri).toMatch(/seduta\.rdf\/s\d/);
      expect(row.number).not.toBe("");
    }
  }, 30000);

  it("governments: ordered chronologically descending", async () => {
    const result = await governmentsTool.execute({ limit: 3, offset: 0 });
    expect(result.rows.length).toBe(3);
    expect(result.rows[0].label).toContain("Meloni");
    expect(result.rows[0]).toHaveProperty("start_date");
  }, 30000);

  it("bills: returns bills for legislature 19", async () => {
    const result = await billsTool.execute({ legislature: 19, limit: 3, offset: 0 });
    expect(result.rows.length).toBe(3);
    expect(result.rows[0]).toHaveProperty("type");
  }, 30000);

  it("bills: keyword matches decoded HTML entities in Camera titles", async () => {
    const result = await billsTool.execute({
      legislature: 19,
      keyword: "criminalità",
      limit: 100,
      offset: 0,
    });
    expect(
      result.rows.some(
        (r) => r.uri === "http://dati.camera.it/ocd/attocamera.rdf/ac19_2696",
      ),
    ).toBe(true);
  }, 30000);

  it("bills: HTML-entity keyword match is case-insensitive on accented input", async () => {
    const result = await billsTool.execute({
      legislature: 19,
      keyword: "CRIMINALITÀ",
      limit: 100,
      offset: 0,
    });
    expect(
      result.rows.some(
        (r) => r.uri === "http://dati.camera.it/ocd/attocamera.rdf/ac19_2696",
      ),
    ).toBe(true);
  }, 30000);

  it("votes: returns votes for legislature 19", async () => {
    const result = await votesTool.execute({ legislature: 19, limit: 3, offset: 0 });
    expect(result.rows.length).toBe(3);
    expect(result.rows[0]).toHaveProperty("in_favour");
    expect(result.rows[0]).toHaveProperty("approved");
  }, 30000);

  it("votes: date range uses STR() so it is not a silent empty (feb 2025 ≈ 436)", async () => {
    // Sentinella anti-regressione: il confronto data Camera va avvolto in STR().
    // Senza STR() Virtuoso fa un confronto numerico spurio → 0 righe mute pur
    // essendoci ~436 votazioni a febbraio 2025 (ground truth via STRSTARTS).
    // Se qualcuno rimuove STR() dal filtro data, questo test torna a 0 e rompe.
    const result = await votesTool.execute({
      legislature: 19,
      dateFrom: "2025-02-01",
      dateTo: "2025-02-28",
      countOnly: true,
      limit: 1,
      offset: 0,
    });
    expect(Number(result.rows[0].count)).toBeGreaterThan(400);
  }, 30000);

  it("votes: empty result on a recent window surfaces the Camera-staleness hint (and not on historical)", async () => {
    // Data futura prossima: nessun voto esiste ancora (vuoto garantito) ma la
    // finestra è "recente" → deve comparire l'hint di freschezza del LOD Camera,
    // così il vuoto non è muto. Su una finestra storica l'hint NON deve comparire.
    const soon = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    const recent = await votesTool.execute({
      legislature: 19,
      dateFrom: soon,
      dateTo: soon,
      limit: 5,
      offset: 0,
    });
    expect(recent.rows.length).toBe(0);
    expect(recent.hint).toMatch(/LOD Camera/);

    const historical = await votesTool.execute({
      legislature: 18,
      dateFrom: "2019-01-01",
      dateTo: "2019-01-01",
      limit: 5,
      offset: 0,
    });
    expect(historical.rows.length).toBe(0);
    expect(historical.hint).toBeUndefined();
  }, 30000);

  it("votes: --confidence-vote empty on the press-reported date surfaces the day-before hint (DL Rilancio 2020)", async () => {
    // La stampa riporta l'approvazione finale della Camera del DL Rilancio al
    // 9/7/2020, ma la fiducia fu votata l'8/7/2020: cercare la fiducia sulla
    // data di stampa dà 0 righe. Deve comparire l'hint "gg-1", non un vuoto muto.
    const onPressDate = await votesTool.execute({
      legislature: 18,
      dateFrom: "2020-07-09",
      dateTo: "2020-07-09",
      confidenceVote: true,
      limit: 5,
      offset: 0,
    });
    expect(onPressDate.rows.length).toBe(0);
    expect(onPressDate.hint).toMatch(/giorno PRIMA/);

    const dayBefore = await votesTool.execute({
      legislature: 18,
      dateFrom: "2020-07-08",
      dateTo: "2020-07-08",
      confidenceVote: true,
      limit: 5,
      offset: 0,
    });
    expect(dayBefore.rows.length).toBeGreaterThan(0);
    expect(dayBefore.hint).toBeUndefined();
  }, 30000);

  it("votes: --confidence-vote on a recent empty window surfaces the staleness hint, not gg-1 (review fix)", async () => {
    // Su una finestra recente il vuoto è più probabilmente ritardo di
    // pubblicazione del LOD Camera che "giorno sbagliato": lo staleness hint
    // deve avere precedenza sul gg-1, altrimenti fuorvia sulla causa.
    const soon = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    const result = await votesTool.execute({
      legislature: 19,
      dateFrom: soon,
      dateTo: soon,
      confidenceVote: true,
      limit: 5,
      offset: 0,
    });
    expect(result.rows.length).toBe(0);
    expect(result.hint).toMatch(/LOD Camera/);
    expect(result.hint).not.toMatch(/giorno PRIMA/);
  }, 30000);

  it("votes: --confidence-vote on a wide historical date range does not surface the gg-1 hint (review fix)", async () => {
    // Il gg-1 è specifico del pattern "singolo giorno sbagliato": su un
    // intervallo ampio "in questa data" e "riprova gg-1" sarebbero fuorvianti,
    // quindi l'hint non deve comparire (nessuno staleness hint qui: intervallo
    // storico, non recente).
    const result = await votesTool.execute({
      legislature: 18,
      dateFrom: "2019-06-01",
      dateTo: "2019-06-10",
      confidenceVote: true,
      limit: 5,
      offset: 0,
    });
    expect(result.rows.length).toBe(0);
    expect(result.hint).toBeUndefined();
  }, 30000);

  it("speeches: returns speeches for legislature 19", async () => {
    const result = await speechesTool.execute({ legislature: 19, limit: 3, offset: 0, chamber: "camera", countOnly: false });
    expect(result.rows.length).toBe(3);
    expect(result.rows[0]).toHaveProperty("deputy_uri");
    expect(result.rows[0]).toHaveProperty("document_url");
    expect(result.rows[0]).toHaveProperty("date");
  }, 30000);

  it("speeches: --date-from/--date-to filters Camera to the session date (in19)", async () => {
    // Interventi d'Aula del 2026-06-17 (question time). La colonna date è
    // ricavata dalla ocd:discussione (non da ods:modified) e deve restare
    // dentro l'intervallo richiesto: nessuna riga fuori dal 17/6.
    const result = await speechesTool.execute({
      legislature: 19,
      dateFrom: "2026-06-17",
      dateTo: "2026-06-17",
      limit: 200,
      offset: 0,
      chamber: "camera",
      countOnly: false,
    });
    expect(result.rows.length).toBeGreaterThan(0);
    for (const r of result.rows) {
      expect(r.date).toBe("2026-06-17");
    }
  }, 30000);

  it("speeches: Camera date filter without legislature fails fast (no unindexed scan)", async () => {
    await expect(
      speechesTool.execute({
        chamber: "camera",
        dateFrom: "2026-06-17",
        dateTo: "2026-06-17",
        limit: 10,
        offset: 0,
        countOnly: false,
      }),
    ).rejects.toThrow(/legislature/i);
  }, 10000);

  it("speeches: --date-from/--date-to filters Senato to the session date", async () => {
    // Sedute del Senato di marzo 2025: tutte le date restituite devono cadere
    // nell'intervallo (filtro STR su osr:dataSeduta xsd:date).
    const result = await speechesTool.execute({
      chamber: "senato",
      legislature: 19,
      dateFrom: "2025-03-01",
      dateTo: "2025-03-31",
      limit: 200,
      offset: 0,
      countOnly: false,
    });
    expect(result.rows.length).toBeGreaterThan(0);
    for (const r of result.rows) {
      expect(r.date >= "2025-03-01" && r.date <= "2025-03-31").toBe(true);
    }
  }, 30000);

  it("speeches: inputSchema rejects a malformed date (MCP path validation)", () => {
    // Il path MCP valida l'input con questo schema (server.ts makeHandler),
    // come la CLI: una data non YYYY-MM-DD non deve raggiungere executeCamera
    // e finire interpolata nella query SPARQL.
    expect(() =>
      speechesTool.inputSchema.parse({
        chamber: "camera",
        legislature: 19,
        dateFrom: '2026-06-17" injection',
      }),
    ).toThrow();
  });

  it("speeches: countOnly honours the date filter (Camera)", async () => {
    // Sentinella sul ramo count: il filtro data deve applicarsi anche con
    // countOnly:true (dateJoin è dentro la count query). Un giorno con sedute
    // dà un conteggio > 0; un intervallo senza sedute dà 0 — se il filtro
    // fosse ignorato il secondo conterebbe tutti gli interventi della legislatura.
    const withSession = await speechesTool.execute({
      legislature: 19,
      dateFrom: "2026-06-17",
      dateTo: "2026-06-17",
      chamber: "camera",
      countOnly: true,
      limit: 100,
      offset: 0,
    });
    expect(Number(withSession.rows[0].count)).toBeGreaterThan(0);
    const emptyRange = await speechesTool.execute({
      legislature: 19,
      dateFrom: "1990-01-01",
      dateTo: "1990-01-02",
      chamber: "camera",
      countOnly: true,
      limit: 100,
      offset: 0,
    });
    expect(Number(emptyRange.rows[0].count)).toBe(0);
  }, 30000);

  it("aic: returns atti for legislature 19", async () => {
    const result = await aicTool.execute({ legislature: 19, primaryOnly: false, limit: 3, offset: 0 });
    expect(result.rows.length).toBe(3);
    expect(result.rows[0]).toHaveProperty("type");
    expect(result.rows[0]).toHaveProperty("identifier");
  }, 30000);

  it("aic: --date-from/--date-to matches the aula (modification) date, not just presentation (question time)", async () => {
    // Question time del 2025-07-09: interrogazioni a risposta immediata
    // presentate l'8/7 e trattate in Aula il 9/7 (dc:date="20250708-20250709").
    // Filtrando per il 9/7 devono comparire, matchando la data di modifica.
    const result = await aicTool.execute({
      legislature: 19,
      type: "immediata",
      dateFrom: "2025-07-09",
      dateTo: "2025-07-09",
      primaryOnly: false,
      limit: 100,
      offset: 0,
    });
    expect(result.rows.length).toBeGreaterThan(0);
    const qt = result.rows.find((r) => r.identifier === "3/02077");
    expect(qt).toBeDefined();
    expect(qt?.date).toBe("2025-07-08 (modificato 2025-07-09)");
  }, 30000);

  it("vote-detail: returns individual votes", async () => {
    const result = await voteDetailTool.execute({
      voteUri: "http://dati.camera.it/ocd/votazione.rdf/vs19_047_005",
      limit: 5,
    });
    expect(result.rows.length).toBe(5);
    expect(result.rows[0]).toHaveProperty("vote");
    expect(result.rows[0]).toHaveProperty("group_acronym");
  }, 30000);

  it("group-members: returns members for legislature 19", async () => {
    const result = await groupMembersTool.execute({ legislature: 19, limit: 3, offset: 0 });
    expect(result.rows.length).toBe(3);
    expect(result.rows[0]).toHaveProperty("group_label");
    expect(result.rows[0]).toHaveProperty("deputy_uri");
  }, 30000);

  it("roles: returns roles with role field populated", async () => {
    const result = await rolesTool.execute({ legislature: 19, limit: 5, offset: 0 });
    expect(result.rows.length).toBe(5);
    const withRole = result.rows.filter((r) => r.role !== "");
    expect(withRole.length).toBeGreaterThan(0);
  }, 30000);

  it("deputy: returns structured detail for Meloni", async () => {
    const result = await deputyTool.execute({ id: 302103, legislature: 19 });
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].first_name).toBe("GIORGIA");
    expect(result.rows[0].last_name).toBe("MELONI");
    expect(result.rows[0].gender).toBe("female");
  }, 30000);

  it("bill: returns structured detail", async () => {
    const result = await billTool.execute({
      uri: "http://dati.camera.it/ocd/attocamera.rdf/ac19_153",
    });
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].type).toBe("Progetto di Legge");
    expect(result.rows[0]).toHaveProperty("initiative");
  }, 30000);

  it("search: finds Meloni in camera", async () => {
    const result = await searchTool.execute({
      name: "meloni",
      chamber: "camera",
      limit: 10,
    });
    expect(result.rows.length).toBeGreaterThan(0);
    const giorgia = result.rows.find((r) => r.first_name === "Giorgia");
    expect(giorgia).toBeDefined();
    expect(giorgia?.gender).toBe("female");
  }, 30000);

  // Regressione: "nome cognome" deve funzionare anche con un secondo nome in
  // mezzo (label anagrafica "Elena Ethel Schlein"). Prima falliva perché il
  // match era su sottostringa contigua invece che per token.
  it("search: finds middle-name person by 'first last'", async () => {
    const result = await searchTool.execute({
      name: "Elena Schlein",
      chamber: "camera",
      limit: 10,
    });
    const schlein = result.rows.find((r) => r.last_name === "Schlein");
    expect(schlein).toBeDefined();
  }, 30000);

  it("gov-members: returns Meloni government members", async () => {
    const result = await govMembersTool.execute({ legislature: 19, limit: 5, offset: 0 });
    expect(result.rows.length).toBe(5);
    expect(result.rows[0]).toHaveProperty("person_name");
    expect(result.rows[0]).toHaveProperty("role");
  }, 30000);

  it("gov-members: search by name", async () => {
    const result = await govMembersTool.execute({ name: "meloni", limit: 10, offset: 0 });
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.rows[0].person_name).toContain("MELONI");
  }, 30000);

  it("attendance: aggregates vote counts for Meloni (mostly non-voting as PM)", async () => {
    const result = await attendanceTool.execute({ id: 302103, legislature: 19 });
    expect(result.rows.length).toBe(1);
    const r = result.rows[0];
    expect(r.deputy_name).toBe("GIORGIA MELONI");
    const total =
      Number(r.favorevole) +
      Number(r.contrario) +
      Number(r.astensione) +
      Number(r.non_ha_votato) +
      Number(r.ha_votato) +
      Number(r.altro);
    expect(String(total)).toBe(r.totale);
    expect(Number(r.non_ha_votato)).toBeGreaterThan(Number(r.favorevole));
  }, 30000);
});

describe("Senato tools", () => {
  it("senators: returns rows for legislature 19", async () => {
    const result = await senatorsTool.execute({ legislature: 19, limit: 3, offset: 0 });
    expect(result.rows.length).toBe(3);
    expect(result.rows[0]).toHaveProperty("first_name");
    expect(result.rows[0]).toHaveProperty("last_name");
  }, 30000);

  it("senators: gender filter uses STR() (foaf:gender is typed → F/M)", async () => {
    // Regressione: al Senato foaf:gender è un letterale tipizzato, quindi
    // il confronto diretto ?gen="F" dà 0; serve STR(?gen).
    const result = await senatorsTool.execute({
      legislature: 19,
      gender: "female",
      limit: 500,
      offset: 0,
    });
    expect(result.rows.length).toBeGreaterThan(0);
    for (const r of result.rows) {
      expect(r.gender).toBe("F");
    }
  }, 30000);

  it("senators: born-from bounds the birth date", async () => {
    const result = await senatorsTool.execute({
      legislature: 19,
      bornFrom: "1980-01-01",
      limit: 500,
      offset: 0,
    });
    expect(result.rows.length).toBeGreaterThan(0);
    for (const r of result.rows) {
      expect(r.birth_date >= "1980-01-01").toBe(true);
    }
  }, 30000);

  it("senator: returns structured detail", async () => {
    const result = await senatorTool.execute({
      uri: "http://dati.senato.it/senatore/32",
    });
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].last_name).toBe("Alberti Casellati");
  }, 30000);

  it("committees: returns active Senato committees for leg 19", async () => {
    const result = await committeesTool.execute({ chamber: "senato", legislature: 19, limit: 300 });
    expect(result.rows.length).toBeGreaterThan(10);
    const affari = result.rows.find((r) =>
      r.short_title.includes("Affari Costituzionali"),
    );
    expect(affari).toBeDefined();
    expect(Number(affari!.session_count)).toBeGreaterThan(100);
  }, 30000);

  it("committees: returns Camera committees for leg 19", async () => {
    const result = await committeesTool.execute({ chamber: "camera", legislature: 19, limit: 300 });
    expect(result.rows.length).toBeGreaterThan(10);
    const giustizia = result.rows.find((r) => r.title.includes("GIUSTIZIA"));
    expect(giustizia).toBeDefined();
    expect(giustizia!.category).toBe("COMMISSIONE PERMANENTE");
    expect(Number(giustizia!.session_count)).toBeGreaterThan(10);
  }, 30000);

  it("bill-progress: returns DDL for legislature 19", async () => {
    const result = await billProgressTool.execute({ legislature: 19, limit: 3, offset: 0 });
    expect(result.rows.length).toBe(3);
    expect(result.rows[0]).toHaveProperty("status");
    expect(result.rows[0]).toHaveProperty("title");
    expect(result.rows[0].legislature).toBe("19");
  }, 30000);

  it("people: resolves a mixed Camera+Senato batch of URIs to names", async () => {
    const result = await peopleTool.execute({
      uris: [
        "http://dati.senato.it/senatore/32",
        "http://dati.camera.it/ocd/deputato.rdf/d308917_19",
      ],
    });
    expect(result.rows.length).toBe(2);
    const sen = result.rows.find((r) => r.chamber === "senato");
    const cam = result.rows.find((r) => r.chamber === "camera");
    expect(sen?.last_name).toMatch(/casellati/i);
    expect(cam?.last_name).toMatch(/colosimo/i);
    expect(sen?.html_url).toContain("scheda-attivita?did=32");
    expect(cam?.html_url).toContain("19-308917");
  }, 30000);

  it("bill-progress: Camera atto returns iter timeline with same schema as Senato", async () => {
    const camera = await billProgressTool.execute({
      uri: "http://dati.camera.it/ocd/attocamera.rdf/ac19_302",
      limit: 100,
      offset: 0,
    });
    const senato = await billProgressTool.execute({
      legislature: 19,
      limit: 1,
      offset: 0,
    });
    // schema colonne identico tra ramo Camera e ramo Senato (issue #11)
    expect(camera.columns).toEqual(senato.columns);
    expect(camera.rows.length).toBeGreaterThanOrEqual(2);
    const first = camera.rows[0];
    expect(first.ddl_uri).toBe(
      "http://dati.camera.it/ocd/attocamera.rdf/ac19_302",
    );
    expect(first).toHaveProperty("status");
    expect(first.status_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(first.phase).toBe("C.302");
  }, 30000);

  it("bill-progress: Camera keyword matches decoded HTML entities in atto titles", async () => {
    const result = await billProgressTool.execute({
      uri: "http://dati.camera.it/ocd/attocamera.rdf/ac19_2696",
      keyword: "criminalità",
      limit: 10,
      offset: 0,
    });
    expect(result.rows.length).toBeGreaterThan(0);
    expect(
      result.rows.every(
        (r) => r.ddl_uri === "http://dati.camera.it/ocd/attocamera.rdf/ac19_2696",
      ),
    ).toBe(true);
  }, 30000);

  it("bill-progress: --number + --branch C returns the Camera iter timeline (#41)", async () => {
    // dl Covid Camera 2020: --number 2617 --branch C --legislature 18 deve dare
    // la timeline dell'atto Camera (più stati datati), non il record di rimando
    // lato Senato (una riga, phase C.2617, senza date).
    const result = await billProgressTool.execute({
      number: "2617",
      branch: "C",
      legislature: 18,
      limit: 100,
      offset: 0,
    });
    expect(result.rows.length).toBeGreaterThanOrEqual(2);
    expect(result.rows[0].ddl_uri).toBe(
      "http://dati.camera.it/ocd/attocamera.rdf/ac18_2617",
    );
    expect(result.rows[0].phase).toBe("C.2617");
    expect(result.rows[0].status_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // deve contenere lo stato finale "Legge"
    expect(result.rows.some((r) => /Legge/.test(r.status))).toBe(true);
  }, 30000);

  it("bill-progress: --number + --branch C honours pagination filters", async () => {
    const result = await billProgressTool.execute({
      number: "2617",
      branch: "C",
      legislature: 18,
      limit: 1,
      offset: 0,
    });
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].ddl_uri).toBe(
      "http://dati.camera.it/ocd/attocamera.rdf/ac18_2617",
    );
  }, 30000);

  it("bill-progress: empty Camera timeline surfaces a branch-C specific hint", async () => {
    const result = await billProgressTool.execute({
      number: "2617",
      branch: "C",
      legislature: 18,
      dateFrom: "2035-01-01",
      limit: 10,
      offset: 0,
    });
    expect(result.rows.length).toBe(0);
    expect(result.hint).toContain("iter Camera");
    expect(result.hint).toContain("filtri");
  }, 30000);

  it("bill-signatories: returns signatories for a Senato DDL", async () => {
    const result = await billSignatoriesTool.execute({
      billUri: "http://dati.senato.it/ddl/25597",
      limit: 10,
    });
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.rows[0]).toHaveProperty("name");
    const primary = result.rows.find((r) => r.is_primary === "true");
    expect(primary).toBeDefined();
  }, 30000);

  it("bill-signatories: returns signatories for a Camera atto", async () => {
    const result = await billSignatoriesTool.execute({
      billUri: "http://dati.camera.it/ocd/attocamera.rdf/ac19_2696",
      limit: 50,
    });
    expect(result.rows.length).toBeGreaterThan(0);
    const primary = result.rows.find((r) => r.is_primary === "true");
    expect(primary).toBeDefined();
    expect(primary?.name).toBeTruthy();
  }, 30000);

  it("bill-signatories: Camera government decree resolves ministers via ocd:rif_persona (no empty names)", async () => {
    // Piano Casa (ac19_2920) è un decreto-legge: i proponenti sono ministri
    // (blank node membro-governo). Prima del fix tornavano righe con name="".
    const result = await billSignatoriesTool.execute({
      billUri: "http://dati.camera.it/ocd/attocamera.rdf/ac19_2920",
      limit: 50,
    });
    expect(result.rows.length).toBeGreaterThan(0);
    // Nessun nome vuoto: ogni ministro è risolto via ocd:rif_persona.
    expect(result.rows.every((r) => r.name.trim().length > 0)).toBe(true);
    // Ruolo governativo esplicito e is_primary non "true" (proponenti multipli).
    expect(result.rows.every((r) => r.role.startsWith("Governo"))).toBe(true);
    expect(result.rows.some((r) => r.role.includes("Ministro"))).toBe(true);
    expect(result.rows.every((r) => r.is_primary === "false")).toBe(true);
  }, 30000);

  it("bill-signatories: Senato parliamentary DDL with deputy signatories is not classified as government", async () => {
    // Corte dei Conti (ddl/59070, S.1457): iniziativa Parlamentare con primo
    // firmatario deputato (Foti). Prima del fix l'assenza di osr:senatore
    // faceva classificare tutti come "Governo (proponente)" senza person_uri.
    const result = await billSignatoriesTool.execute({
      billUri: "http://dati.senato.it/ddl/59070",
      limit: 10,
    });
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.rows.every((r) => !r.role.startsWith("Governo"))).toBe(true);
    const primary = result.rows.find((r) => r.is_primary === "true");
    expect(primary?.role).toBe("primo firmatario");
    expect(primary?.name).toContain("Foti");
    // I deputati sono agganciati via ocd:rif_deputato → URI Camera + scheda.
    expect(primary?.person_uri).toContain("dati.camera.it");
    expect(primary?.html_url).toContain("camera.it/deputati");
  }, 30000);

  it("amendments: returns amendments for legislature 19", async () => {
    const result = await amendmentsTool.execute({ legislature: 19, limit: 3, offset: 0 });
    expect(result.rows.length).toBe(3);
    expect(result.rows[0]).toHaveProperty("number");
    expect(result.rows[0]).toHaveProperty("url");
    expect(result.rows[0].legislature).toBe("19");
  }, 30000);

  it("amendments: ogni riga espone akn_xml_url (testo raw senza WAF), da LOD o da fallback AKN", async () => {
    // ddl/60233 (Piano Casa): la freschezza del LOD è intermittente (osservato
    // riallinearsi tra il 7 e il 10 lug 2026, wiki senato/emendamenti-freschezza.md).
    // Non si assume quale sorgente risponda in un dato momento: si accetta
    // "lod" o "akn" e si verifica solo che akn_xml_url sia comunque coerente.
    const result = await amendmentsTool.execute({
      ddlUri: "http://dati.senato.it/ddl/60233",
      limit: 5,
      offset: 0,
    });
    expect(result.rows.length).toBe(5);
    expect(["lod", "akn"]).toContain(result.rows[0].source);
    expect(result.rows[0].akn_xml_url).toContain(
      "raw.githubusercontent.com/SenatoDellaRepubblica/AkomaNtosoBulkData/master/Leg19/Atto00060233/",
    );
    expect(result.rows[0].ddl_uri).toBe("http://dati.senato.it/ddl/60233");
  }, 30000);

  it("amendments: fallback AKN attivo su LOD vuoto, con hint quando anche il bulk è vuoto", async () => {
    // DDL inesistente: LOD vuoto → il fallback interroga il bulk AKN (404 →
    // listing vuoto) e il vuoto è qualificato dall'hint doppia-fonte.
    const result = await amendmentsTool.execute({
      ddlUri: "http://dati.senato.it/ddl/99999999",
      legislature: 19,
      limit: 5,
      offset: 0,
    });
    expect(result.rows.length).toBe(0);
    expect(result.hint).toContain("bulk AKN");
  }, 30000);

  it("aknEmptyHint: vuoto genuino (entriesLength 0) vs pagina oltre la fine (entriesLength > 0)", () => {
    // Vuoto genuino: nessuna fonte ha nulla per l'atto.
    expect(aknEmptyHint(0, 0)).toContain("né nel LOD né nel bulk");
    // Pagina oltre la fine: il bulk ha risultati, ma l'offset richiesto li supera —
    // NON deve leggersi come "nessun emendamento" (bug segnalato da Copilot).
    const pastEnd = aknEmptyHint(799, 900);
    expect(pastEnd).not.toContain("né nel LOD né nel bulk");
    expect(pastEnd).toContain("799");
    expect(pastEnd).toContain("900");
  });

  it("amendments: withProponents estrae il primo firmatario dal testo AKN", async () => {
    // Il bulk AKN contiene anche file stub vuoti (200 OK, zero contenuto —
    // wiki senato/emendamenti-firmatario.md, es. odg G1.17 su questo stesso
    // DDL): non si assume che la riga in posizione 0 sia per forza popolata,
    // solo che ALMENO una riga della finestra lo sia.
    const result = await amendmentsTool.execute({
      ddlUri: "http://dati.senato.it/ddl/60233",
      withProponents: true,
      limit: 5,
      offset: 0,
    });
    expect(result.rows.length).toBe(5);
    const withProponent = result.rows.find((r) => r.first_proponent !== "");
    expect(withProponent).toBeDefined();
    expect(withProponent?.first_proponent_uri).toContain("dati.senato.it");
    expect(withProponent?.number).not.toBe("");
  }, 30000);

  it("amendments: withProponents con limit oltre la soglia fallisce esplicito (offline guard)", async () => {
    // withProponents fa un fetch per riga: senza cap, limit alto (fino a 1000
    // da schema) rischierebbe centinaia/migliaia di richieste HTTP e timeout
    // silenzioso, specie sul Worker.
    await expect(
      amendmentsTool.execute({
        ddlUri: "http://dati.senato.it/ddl/60233",
        withProponents: true,
        limit: 101,
        offset: 0,
      }),
    ).rejects.toThrow(/limit<=100/);
  });

  it("amendments: enrichProponents fallisce esplicito se TUTTI i fetch al bulk AKN falliscono", async () => {
    // URL raw a percorsi inesistenti (404 reali): un outage/irraggiungibilità
    // di GitHub non deve tradursi in righe silenziosamente vuote,
    // indistinguibili dal caso legittimo "nessun proponente" (file stub).
    const rows = [
      {
        akn_xml_url:
          "https://raw.githubusercontent.com/SenatoDellaRepubblica/AkomaNtosoBulkData/master/Leg19/Atto00060233/emend/00000000-em.akn.xml",
      },
      {
        akn_xml_url:
          "https://raw.githubusercontent.com/SenatoDellaRepubblica/AkomaNtosoBulkData/master/Leg19/Atto00060233/emend/00000001-em.akn.xml",
      },
    ];
    await expect(enrichProponents(rows)).rejects.toThrow(/tutti i 2 fetch/);
  }, 30000);

  it("checkAknTruncation: offset oltre il visibile ma dentro Assemblea troncata -> fallisce esplicito", () => {
    // aula: 1500 reali, solo 1000 visibili (troncato); comm: 50, non troncato.
    // offset 1000 punterebbe al primo elemento "comm" nell'array concatenato,
    // ma potrebbe in realtà essere ancora un elemento di Assemblea non visibile.
    const aula = { totalCount: 1500, names: new Array(1000).fill("x") };
    const comm = { totalCount: 50, names: new Array(50).fill("y") };
    expect(() =>
      checkAknTruncation(aula, comm, 1050, 1000, 10, "Leg19/Atto00000001"),
    ).toThrow(/emendamenti d'Assemblea/);
  });

  it("checkAknTruncation: finestra tutta dentro Assemblea visibile -> non fallisce anche se Assemblea è troncata", () => {
    const aula = { totalCount: 1500, names: new Array(1000).fill("x") };
    const comm = { totalCount: 50, names: new Array(50).fill("y") };
    expect(() =>
      checkAknTruncation(aula, comm, 1050, 990, 10, "Leg19/Atto00000001"),
    ).not.toThrow();
  });

  it("checkAknTruncation: solo Commissione troncata, offset oltre il visibile -> fallisce esplicito", () => {
    const aula = { totalCount: 400, names: new Array(400).fill("x") };
    const comm = { totalCount: 1200, names: new Array(1000).fill("y") };
    expect(() =>
      checkAknTruncation(aula, comm, 1400, 1400, 10, "Leg19/Atto00000001"),
    ).toThrow(/emendamenti di Commissione/);
  });

  it("checkAknTruncation: nessuna troncatura -> non fallisce mai", () => {
    const aula = { totalCount: 400, names: new Array(400).fill("x") };
    const comm = { totalCount: 399, names: new Array(399).fill("y") };
    expect(() =>
      checkAknTruncation(aula, comm, 799, 790, 100, "Leg19/Atto00000001"),
    ).not.toThrow();
  });

  it("amendments: rejects a Camera ddlUri instead of returning empty (offline guard)", async () => {
    await expect(
      amendmentsTool.execute({
        ddlUri: "http://dati.camera.it/ocd/attocamera.rdf/ac19_2696",
        limit: 100,
        offset: 0,
      }),
    ).rejects.toThrow(/solo-Senato/);
  });

  it("senato-votes: --ddl-uri includes the fiducia (no osr:oggetto) and excludes same-day extraneous votes", async () => {
    // DDL 60233 "Piano Casa", seduta 2026-07-01: pregiudiziale (relativoA
    // diretto) + fiducia (ddl_uri vuoto alla fonte, ricollegato per data) +
    // una risoluzione estranea votata lo stesso giorno (da escludere).
    const result = await senatoVotesTool.execute({
      legislature: 19,
      ddlUri: "http://dati.senato.it/ddl/60233",
      limit: 100,
      offset: 0,
    });
    const uris = result.rows.map((r) => r.uri);
    expect(uris).toContain("http://dati.senato.it/votazione/19-434-2"); // fiducia
    expect(uris).toContain("http://dati.senato.it/votazione/19-434-1"); // pregiudiziale
    expect(uris).not.toContain("http://dati.senato.it/votazione/19-434-3"); // risoluzione estranea
    const fiducia = result.rows.find((r) => r.uri.endsWith("19-434-2"));
    expect(fiducia).toBeDefined();
    expect(fiducia!.in_favour).toBe("106");
    expect(fiducia!.against).toBe("62");
    expect(fiducia!.ddl_uri).toBe("http://dati.senato.it/ddl/60233");
    // Il label ha un refuso ("DDL  n. 1994" per S.1944): il numero del label
    // NON risolve ad alcun DDL → azzerato per difesa; poi la propagazione
    // intra-seduta risolve ddl_uri e il backfill rilegge il numero VERO dalla
    // osr:fase (1944). Il tool non emette mai il refuso 1994 come bill_number.
    expect(fiducia!.bill_number).toBe("1944");
  }, 30000);

  it("senato-votes: --ddl-uri resolves the legislature from the DDL, not the default 19", async () => {
    // DDL 52988 = S.1811 (decreto lockdown DL 19/2020), legislatura 18. L'URI
    // dati.senato.it/ddl/{N} non codifica la legislatura: senza risolverla dal
    // DDL, il filtro di default (19) darebbe un falso negativo silenzioso.
    // Nessun --legislature passato: deve comunque trovare il voto di leg.18.
    const result = await senatoVotesTool.execute({
      legislature: 19,
      ddlUri: "http://dati.senato.it/ddl/52988",
      limit: 100,
      offset: 0,
    });
    const voto = result.rows.find((r) => r.uri.endsWith("/18-219-1"));
    expect(voto).toBeDefined();
    expect(voto!.ddl_uri).toBe("http://dati.senato.it/ddl/52988");
    // rss_url deve puntare alla legislatura del DDL (18), non al default 19.
    expect(voto!.rss_url).toContain("/52988/18");
  }, 30000);

  it("senato-votes: backfills bill_number from the resolved DDL on generic labels", async () => {
    // 19-376-2 (Corte dei Conti): label "Votazione finale" senza numero, ma
    // ddl_uri risolto via osr:relativoA → bill_number = fase S.1457.
    const result = await senatoVotesTool.execute({
      legislature: 19,
      keyword: "corte dei conti",
      dateFrom: "2025-12-20",
      dateTo: "2025-12-31",
      limit: 100,
      offset: 0,
    });
    const finale = result.rows.find((r) => r.uri.endsWith("/19-376-2"));
    expect(finale?.label).toBe("Votazione finale");
    expect(finale?.bill_number).toBe("1457");
    expect(finale?.ddl_uri).toBe("http://dati.senato.it/ddl/59070");
  }, 45000);

  it("senato-votes: ddl_title resolves the linked osr:Documento title (not just osr:Ddl)", async () => {
    // Seduta 19-438 (16/7/2026): risoluzioni di commissione sull'autonomia
    // differenziata. ddl_uri punta a un osr:Documento (non osr:Ddl) — il
    // titolo va risolto comunque, senza richiedere `a osr:Ddl` nel BGP.
    const result = await senatoVotesTool.execute({
      legislature: 19,
      dateFrom: "2026-07-16",
      dateTo: "2026-07-16",
      limit: 100,
      offset: 0,
    });
    const veneto = result.rows.find((r) => r.uri.endsWith("/19-438-8"));
    expect(veneto?.ddl_uri).toBe("http://dati.senato.it/documento/54207");
    expect(veneto?.ddl_title).toBe(
      "Risoluzione su schemi di intesa preliminare autonomia regione Veneto",
    );
    const cataldi = result.rows.find((r) => r.uri.endsWith("/19-438-3"));
    expect(cataldi?.ddl_uri).toBe("http://dati.senato.it/documento/54204");
    expect(cataldi?.ddl_title).toBe(
      "Risoluzione su schemi di intesa preliminare autonomia regione Liguria",
    );
  }, 30000);

  it("senato-votes: --keyword also matches osr:titoloBreve of the linked documento (not just osr:titolo)", async () => {
    // Stesso caso di sopra (19-438-3, ODG Cataldi su documento/54204): il
    // label ("ODG G170, Cataldi e altri") non nomina la Liguria, solo il
    // documento collegato. Prima del fix il match --keyword guardava solo
    // osr:titolo (già copre "Liguria" qui, ma la query ora include anche
    // osr:titoloBreve senza regressioni).
    const result = await senatoVotesTool.execute({
      legislature: 19,
      keyword: "regione liguria",
      dateFrom: "2026-07-16",
      dateTo: "2026-07-16",
      limit: 100,
      offset: 0,
    });
    const cataldi = result.rows.find((r) => r.uri.endsWith("/19-438-3"));
    expect(cataldi).toBeDefined();
    expect(cataldi?.ddl_title).toBe(
      "Risoluzione su schemi di intesa preliminare autonomia regione Liguria",
    );
  }, 30000);

  it("senato-votes: --ddl-uri includes the fiducia when it falls on a different seduta than the strongly-linked vote", async () => {
    // DDL 59201 = S.1509 (decreto sicurezza 2025): la pregiudiziale
    // (osr:oggetto/osr:relativoA) è del 2025-06-03, la fiducia (senza
    // osr:oggetto) è del giorno DOPO, 2025-06-04 — sedute diverse. Prima del
    // fix, la risoluzione delle date del DDL si basava solo sul link forte
    // (2025-06-03): la fiducia del 4/6 restava fuori dal filtro data e
    // spariva silenziosamente (nessun errore, riga mancante).
    const result = await senatoVotesTool.execute({
      legislature: 19,
      ddlUri: "http://dati.senato.it/ddl/59201",
      limit: 100,
      offset: 0,
    });
    const uris = result.rows.map((r) => r.uri);
    expect(uris).toContain("http://dati.senato.it/votazione/19-311-1"); // pregiudiziale 3/6
    expect(uris).toContain("http://dati.senato.it/votazione/19-312-1"); // fiducia 4/6
    const fiducia = result.rows.find((r) => r.uri.endsWith("19-312-1"));
    expect(fiducia).toBeDefined();
    expect(fiducia!.date).toBe("2025-06-04");
    expect(fiducia!.in_favour).toBe("109");
    expect(fiducia!.against).toBe("69");
    expect(fiducia!.ddl_uri).toBe("http://dati.senato.it/ddl/59201");
  }, 30000);

  it("bill: rejects Senato URIs with a routing message (solo-Camera)", async () => {
    await expect(
      billTool.execute({ uri: "http://dati.senato.it/ddl/59070" }),
    ).rejects.toThrow(/solo-Camera.*bill-progress/s);
  });

  it("senato-votes: --keyword matches the DDL title also for fiducie (no osr:oggetto)", async () => {
    // Fiducia decreto sicurezza (19-312-1): label "Disegno di legge n.1509.
    // Votazione questione di fiducia" senza la parola "sicurezza", che vive
    // solo nel titolo del DDL 59201. Prima del fix il filtro keyword SPARQL
    // la escludeva (niente osr:oggetto → ?ddlTitolo unbound).
    const result = await senatoVotesTool.execute({
      legislature: 19,
      keyword: "sicurezza",
      dateFrom: "2025-06-01",
      dateTo: "2025-06-10",
      limit: 100,
      offset: 0,
    });
    const fiducia = result.rows.find((r) => r.uri.endsWith("/19-312-1"));
    expect(fiducia).toBeDefined();
    expect(fiducia?.bill_number).toBe("1509");
    expect(fiducia?.ddl_uri).toBe("http://dati.senato.it/ddl/59201");
  }, 45000);

  it("camera-amendments: scrapes counts per sede (sentinel: AC 2696 ref=37/ass=25)", async () => {
    const result = await cameraAmendmentsTool.execute({
      billUri: "http://dati.camera.it/ocd/attocamera.rdf/ac19_2696",
      countOnly: true,
      limit: 2000,
    });
    const bySede = Object.fromEntries(result.rows.map((r) => [r.sede, Number(r.count)]));
    expect(bySede["referente"]).toBe(37);
    expect(bySede["assemblea"]).toBe(25);
  }, 30000);

  it("camera-amendments: lists amendments with number and signatory (AC 2696)", async () => {
    const result = await cameraAmendmentsTool.execute({
      billUri: "http://dati.camera.it/ocd/attocamera.rdf/ac19_2696",
      countOnly: false,
      limit: 2000,
    });
    expect(result.rows.length).toBe(62);
    expect(result.rows[0]).toHaveProperty("number");
    expect(result.rows[0]).toHaveProperty("first_signatory");
    expect(result.rows[0].text_url).toMatch(/getPropostaEmendativa\.aspx/);
  }, 30000);

  it("camera-amendments: falls back to the ostr index on historical acts where the scheda has no direct link (AC 2402, leg.18)", async () => {
    // La scheda-atto storica (leg.18) non incorpora più getProposteEmendative.aspx
    // (il bottone "Emendamenti" punta al motore di ricerca generico
    // ricerca-emendamenti): prima del fix il tool restituiva 0 righe senza
    // errore pur esistendo gli emendamenti alla fonte. L'indice strutturato
    // apps/emendamenti/ostr/{leg} li contiene comunque.
    const result = await cameraAmendmentsTool.execute({
      billUri: "http://dati.camera.it/ocd/attocamera.rdf/ac18_2402",
      countOnly: false,
      limit: 2000,
    });
    const bySede: Record<string, number> = {};
    for (const r of result.rows) bySede[r.sede] = (bySede[r.sede] ?? 0) + 1;
    expect(bySede["referente"]).toBe(54);
    expect(bySede["assemblea"]).toBe(53);
    // Emendamento Locatelli (Lega) sulla sospensione dei centri diurni,
    // citato dalla stampa sul dl Covid, votato in Assemblea.
    const locatelli = result.rows.find(
      (r) => r.sede === "assemblea" && r.number === "1.52",
    );
    // Nbsp (U+00A0) tra cognome e nome nel dato grezzo, non normalizzato dal tool.
    expect(locatelli?.first_signatory).toBe("Locatelli Alessandra");
  }, 30000);

  it("camera-amendments: rejects a Senato URI (offline guard)", async () => {
    await expect(
      cameraAmendmentsTool.execute({
        billUri: "http://dati.senato.it/ddl/60131",
        countOnly: false,
        limit: 2000,
      }),
    ).rejects.toThrow(/atto Camera/);
  });

  it("documents: returns documents for legislature 19", async () => {
    const result = await documentsTool.execute({ legislature: 19, limit: 3, offset: 0 });
    expect(result.rows.length).toBe(3);
    expect(result.rows[0]).toHaveProperty("type");
    expect(result.rows[0]).toHaveProperty("title");
    expect(result.rows[0]).toHaveProperty("status");
  }, 30000);

  it("senato-attendance: aggregates vote counts for a senator in legislature 19", async () => {
    const result = await senatoAttendanceTool.execute({
      senatorUri: "http://dati.senato.it/senatore/3900",
      legislature: 19,
    });
    expect(result.rows.length).toBe(1);
    const r = result.rows[0];
    const total =
      Number(r.favorevole) +
      Number(r.contrario) +
      Number(r.astenuto) +
      Number(r.presente_non_votante) +
      Number(r.in_congedo_missione);
    expect(String(total)).toBe(r.totale);
    expect(Number(r.totale)).toBeGreaterThan(0);
  }, 30000);
});
