import { z } from "zod";
import { cdQuery } from "../core/client.js";
import { flattenBindings } from "../core/flatten.js";
import { OCD_PREFIXES } from "../core/prefixes.js";
import { extractBillNumber, billBaseNumber } from "../core/bill-number.js";
import type { Tool } from "./types.js";

const inputSchema = z.object({
  legislature: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Numero legislatura Camera"),
  approved: z
    .boolean()
    .optional()
    .describe("Filtra per votazioni approvate (true) o non approvate (false)"),
  confidenceVote: z
    .boolean()
    .optional()
    .describe("Filtra per votazioni di fiducia (true) o ordinarie (false)"),
  keyword: z
    .string()
    .optional()
    .describe("Cerca nel titolo della votazione (match case-insensitive, es. 'fiducia', 'bilancio')"),
  billCode: z
    .string()
    .optional()
    .describe("Filtra votazioni collegate a un DDL per numero atto (es. '2807', '1665'). Cerca in dc:description."),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Data inizio (YYYY-MM-DD)"),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Data fine (YYYY-MM-DD)"),
  countOnly: z
    .boolean()
    .optional()
    .describe("Se true, restituisce solo il numero totale di risultati (colonna count)"),
  limit: z.number().int().positive().max(1000).default(100),
  offset: z.number().int().nonnegative().default(0),
});

const columns = [
  "uri",
  "label",
  "title",
  "description",
  "type",
  "date",
  "approved",
  "in_favour",
  "against",
  "abstentions",
  "present",
  "voters",
  "quorum",
  "confidence_vote",
  "secret_vote",
  "final_vote",
  "legislature_uri",
  "session_uri",
  "bill_number",
  "bill_uri",
  "aic_code",
  "aic_link",
  "url",
];

const COL_MAP: Record<string, string> = {
  s: "uri",
  description: "description",
  approvato: "approved",
  favorevoli: "in_favour",
  contrari: "against",
  astenuti: "abstentions",
  presenti: "present",
  votanti: "voters",
  maggioranza: "quorum",
  richiestaFiducia: "confidence_vote",
  votazioneSegreta: "secret_vote",
  votazioneFinale: "final_vote",
  rif_leg: "legislature_uri",
  rif_seduta: "session_uri",
  rif_attoCamera: "bill_uri",
};

const BOOL_COLS = new Set([
  "approved",
  "confidence_vote",
  "secret_vote",
  "final_vote",
]);

export const votesTool: Tool<typeof inputSchema> = {
  name: "votes",
  description:
    "[CAMERA] Lista votazioni della Camera dei Deputati con contatori (favorevoli, contrari, astenuti), esito, tipo, seduta, atto collegato. Filtrabile per parola chiave (cerca in label, title e description: es. 'bilancio' trova le votazioni sul DDL Bilancio). Nota: alcune votazioni hanno description povera (es. solo 'DDL.n. 2920-A' senza il tema del decreto): in quel caso filtra per intervallo di date (attorno alla data di trasmissione/approvazione dall'iter) e leggi il dettaglio con vote-detail, invece di dedurre il conteggio.",
  emptyHint:
    "Nessuna votazione trovata. La ricerca per keyword sulle votazioni Camera spesso manca il voto finale/fiducia: riprova filtrando per intervallo di date (dalla timeline di bill-progress) e usa vote-detail per il dettaglio. Non inventare numeri, date o esiti del voto.",
  inputSchema,
  examples: [
    "italianparliament votes list --legislature 19 --limit 50",
    "italianparliament votes list --approved true",
    "italianparliament votes list --legislature 19 --keyword bilancio --limit 50",
    "italianparliament votes list --legislature 19 --date-from 2026-01-01 --limit 50",
    "italianparliament votes list --legislature 19 --date-from 2026-01-01 --date-to 2026-03-31 --format jsonl",
    "italianparliament votes list --bill-code 2807",
  ],
  async execute(input) {
    const approvedFilter =
      input.approved !== undefined
        ? `FILTER(?approvato = "${input.approved ? 1 : 0}"^^xsd:integer)`
        : "";
    const confidenceFilter =
      input.confidenceVote !== undefined
        ? `FILTER(?richiestaFiducia = "${input.confidenceVote ? 1 : 0}"^^xsd:integer)`
        : "";
    const keywordEsc = input.keyword !== undefined
      ? input.keyword.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
      : "";
    const keywordFilter =
      input.keyword !== undefined
        ? `FILTER(CONTAINS(LCASE(STR(?label)), LCASE("${keywordEsc}")) || CONTAINS(LCASE(STR(?title)), LCASE("${keywordEsc}")) || CONTAINS(LCASE(STR(?description)), LCASE("${keywordEsc}")))`
        : "";
    // STR() obbligatorio: Virtuoso non confronta il dc:date Camera (literal
    // YYYYMMDD) come stringa lessicografica senza STR() — con confronto nudo il
    // range restituisce risultati errati o vuoti silenziosi (vedi bug notizie).
    const dateFromFilter = input.dateFrom
      ? `FILTER(STR(?date) >= "${input.dateFrom.replace(/-/g, "")}")`
      : "";
    const dateToFilter = input.dateTo
      ? `FILTER(STR(?date) <= "${input.dateTo.replace(/-/g, "")}")`
      : "";
    const billCodeEsc = input.billCode !== undefined
      ? input.billCode.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
      : "";
    const billCodeFilter = input.billCode !== undefined
      ? `FILTER(CONTAINS(STR(?description), "${billCodeEsc}"))`
      : "";

    // Subquery-first: prima selezioniamo/ordiniamo/limitiamo i soli URI delle
    // votazioni (con i filtri come pattern vincolanti), poi agganciamo i ~17
    // OPTIONAL solo alle righe risultanti. Senza questo, Virtuoso materializza
    // tutti gli OPTIONAL su decine di migliaia di votazioni prima di ordinare e
    // limitare → ~33s (e timeout). Con la subquery: <1s.
    // NB: legislatura come triple vincolante, non FILTER su variabile OPTIONAL.
    const V = "http://dati.camera.it/ocd";
    // ?vd = data interna alla subquery. Alcune votazioni hanno più dc:date:
    // GROUP BY ?s + MAX(?vd) garantisce una sola riga per voto (altrimenti i
    // duplicati consumano slot del LIMIT e tornano meno voti del richiesto).
    const inner: string[] = [`?s a <${V}/votazione> .`];
    if (input.legislature !== undefined)
      inner.push(`?s <${V}/rif_leg> <http://dati.camera.it/ocd/legislatura.rdf/repubblica_${input.legislature}> .`);
    if (input.dateFrom || input.dateTo) {
      inner.push(`?s dc:date ?vd .`);
      if (input.dateFrom) inner.push(`FILTER(STR(?vd) >= "${input.dateFrom.replace(/-/g, "")}")`);
      if (input.dateTo) inner.push(`FILTER(STR(?vd) <= "${input.dateTo.replace(/-/g, "")}")`);
    } else {
      inner.push(`OPTIONAL { ?s dc:date ?vd }`);
    }
    if (approvedFilter) inner.push(`?s <${V}/approvato> ?approvato . ${approvedFilter}`);
    if (confidenceFilter) inner.push(`?s <${V}/richiestaFiducia> ?richiestaFiducia . ${confidenceFilter}`);
    if (keywordFilter) inner.push(`?s rdfs:label ?label . ?s dc:description ?description . OPTIONAL { ?s dc:title ?title } ${keywordFilter}`);
    if (billCodeFilter) inner.push(`?s dc:description ?description . ${billCodeFilter}`);

    const coreSelect = `SELECT DISTINCT ?s ?label ?title ?description ?type ?date
                ?approvato ?favorevoli ?contrari ?astenuti
                ?presenti ?votanti ?maggioranza
                ?richiestaFiducia ?votazioneSegreta ?votazioneFinale
                ?rif_leg ?rif_seduta ?rif_attoCamera ?url
WHERE {
  {
    SELECT ?s (MAX(?vd) AS ?date) WHERE {
      ${inner.join("\n      ")}
    }
    GROUP BY ?s
    ORDER BY DESC(?date)
    LIMIT ${input.limit}
    OFFSET ${input.offset}
  }
  ?s rdfs:label ?label .
  OPTIONAL { ?s dc:title ?title }
  OPTIONAL { ?s dc:description ?description }
  OPTIONAL { ?s dc:type ?type }
  OPTIONAL { ?s <${V}/approvato> ?approvato }
  OPTIONAL { ?s <${V}/favorevoli> ?favorevoli }
  OPTIONAL { ?s <${V}/contrari> ?contrari }
  OPTIONAL { ?s <${V}/astenuti> ?astenuti }
  OPTIONAL { ?s <${V}/presenti> ?presenti }
  OPTIONAL { ?s <${V}/votanti> ?votanti }
  OPTIONAL { ?s <${V}/maggioranza> ?maggioranza }
  OPTIONAL { ?s <${V}/richiestaFiducia> ?richiestaFiducia }
  OPTIONAL { ?s <${V}/votazioneSegreta> ?votazioneSegreta }
  OPTIONAL { ?s <${V}/votazioneFinale> ?votazioneFinale }
  OPTIONAL { ?s <${V}/rif_leg> ?rif_leg }
  OPTIONAL { ?s <${V}/rif_seduta> ?rif_seduta }
  OPTIONAL { ?s <${V}/rif_attoCamera> ?rif_attoCamera }
  OPTIONAL { ?s dc:relation ?url }
}
ORDER BY DESC(?date)`;

    // Per il count usiamo solo i pattern vincolanti (no OPTIONAL): con ~13
    // OPTIONAL numerici e decine di migliaia di votazioni il wrap dell'intero
    // SELECT manda Virtuoso in timeout.
    const countWhere = [`?s a <${V}/votazione> .`];
    if (input.legislature !== undefined)
      countWhere.push(`?s <${V}/rif_leg> <http://dati.camera.it/ocd/legislatura.rdf/repubblica_${input.legislature}> .`);
    if (approvedFilter) countWhere.push(`?s <${V}/approvato> ?approvato . ${approvedFilter}`);
    if (confidenceFilter) countWhere.push(`?s <${V}/richiestaFiducia> ?richiestaFiducia . ${confidenceFilter}`);
    if (keywordFilter) countWhere.push(`?s rdfs:label ?label . OPTIONAL { ?s dc:title ?title } ${keywordFilter}`);
    if (dateFromFilter || dateToFilter) countWhere.push(`?s dc:date ?date . ${dateFromFilter} ${dateToFilter}`);
    if (billCodeFilter) countWhere.push(`?s dc:description ?description . ${billCodeFilter}`);

    const query = input.countOnly
      ? `${OCD_PREFIXES}\nSELECT (COUNT(DISTINCT ?s) AS ?count) WHERE {\n${countWhere.join("\n  ")}\n}`
      : `${OCD_PREFIXES}\n${coreSelect}`;

    const results = await cdQuery(query);
    if (input.countOnly) {
      const c = flattenBindings(results)[0]?.count ?? "0";
      return { rows: [{ count: c }], columns: ["count"] };
    }
    const raw = flattenBindings(results);
    const rows = raw.map((r) => {
      const row: Record<string, string> = {};
      for (const [k, v] of Object.entries(r)) {
        const mapped = COL_MAP[k] ?? k;
        row[mapped] = BOOL_COLS.has(mapped)
          ? v === "1"
            ? "true"
            : v === "0"
              ? "false"
              : v
          : v;
      }
      return row;
    });
    // Dedup per uri: gli OPTIONAL multi-valore della query esterna (es. dc:type,
    // dc:relation) possono produrre più righe per la stessa votazione. Teniamo
    // la prima così da avere una riga per voto (coerente col LIMIT).
    const seen = new Set<string>();
    const deduped = rows.filter((r) => {
      const uri = r.uri ?? "";
      if (seen.has(uri)) return false;
      seen.add(uri);
      return true;
    });
    // Vuoto su finestra di date recente: il LOD Camera è pubblicato a lotti e
    // può essere indietro di giorni. Segnaliamo che un "non trovato" recente non
    // equivale a "non avvenuto", invece di restituire un elenco vuoto silenzioso.
    if (deduped.length === 0) {
      // Precedenza allo staleness hint: su una finestra recente il vuoto è più
      // probabilmente ritardo di pubblicazione del LOD Camera che giorno
      // sbagliato — il gg-1 su quella finestra fuorvierebbe verso la causa
      // sbagliata (review Copilot su PR #46).
      const hint =
        recentWindowHint(input.dateFrom, input.dateTo) ??
        confidenceVoteDayBeforeHint(input.confidenceVote, input.dateFrom, input.dateTo);
      if (hint) return { rows: deduped, columns, hint };
    }
    // bill_number dal testo della descrizione ("DDL 2920-A - VOTO FINALE" → "2920-A").
    for (const r of deduped) {
      r.bill_number = extractBillNumber(r.description);
      // Estrai codice mozione/risoluzione AIC da description (es. "MOZ 1-586" → 1/00586).
      // Anche label/title per le risoluzioni ("Risoluzione 6_00266" → 6/00266).
      const aic = extractAicCode(r.description) ?? extractAicCode(r.title) ?? extractAicCode(r.label);
      if (aic) {
        const legNum = r.legislature_uri?.match(/repubblica_(\d+)/)?.[1] ?? "19";
        r.aic_code = aic.code;
        r.aic_link = `https://aic.camera.it/aic/scheda.html?core=aic&numero=${aic.code}&ramo=CAMERA&leg=${legNum}`;
      } else {
        r.aic_code = "";
        r.aic_link = "";
      }
    }
    // Fallback: alcune votazioni non hanno rif_attoCamera ma citano il DDL nella
    // descrizione. Risolviamo il numero base → URI atto (ac<leg>_<num>)
    // verificandone l'esistenza via dc:identifier — niente URI fabbricati. La
    // legislatura è quella della riga (rif_leg): una query per legislatura.
    const needing = deduped.filter((r) => !r.bill_uri && r.bill_number && r.legislature_uri);
    if (needing.length) {
      const byLeg = new Map<string, typeof needing>();
      for (const r of needing) {
        const g = byLeg.get(r.legislature_uri) ?? [];
        g.push(r);
        byLeg.set(r.legislature_uri, g);
      }
      for (const [legUri, group] of byLeg) {
        const bases = [...new Set(group.map((r) => billBaseNumber(r.bill_number)))];
        const filter = bases.map((n) => `STR(?id) = "${n}"`).join(" || ");
        const fbQuery = `${OCD_PREFIXES}
SELECT ?a ?id WHERE {
  ?a a <${V}/atto> ; <${V}/rif_leg> <${legUri}> ; dc:identifier ?id .
  FILTER(${filter})
}`;
        const byId = new Map<string, string>();
        for (const rr of flattenBindings(await cdQuery(fbQuery))) {
          if (rr.id && rr.a && !byId.has(rr.id)) byId.set(rr.id, rr.a);
        }
        for (const r of group) {
          const a = byId.get(billBaseNumber(r.bill_number));
          if (a) r.bill_uri = a;
          // Difesa: il numero citato nella descrizione non corrisponde ad alcun
          // atto della legislatura (refuso/atto assente dal grafo). Non esporlo
          // come identificativo interrogabile: il testo grezzo resta in
          // `description`, ma `bill_number` deve solo contenere numeri verificati.
          else r.bill_number = "";
        }
      }
    }
    return { rows: deduped, columns };
  },
};

/**
 * Se la ricerca è per voto di fiducia (--confidence-vote true) su un SINGOLO
 * giorno (dateFrom === dateTo) e il risultato è vuoto, la fiducia potrebbe
 * essere stata votata il giorno PRIMA della data cercata: la stampa riporta
 * tipicamente la data dell'approvazione finale, non quella della fiducia
 * (es. DL Rilancio 2020: fiducia 8/7, approvazione finale 9/7). Limitato al
 * giorno singolo (non finestre ampie/open-ended, review Copilot su PR #46):
 * su un intervallo largo "in questa data" e "gg-1" sarebbero fuorvianti.
 * Solo un suggerimento — nessun retry automatico, per non falsare l'output.
 */
function confidenceVoteDayBeforeHint(
  confidenceVote?: boolean,
  dateFrom?: string,
  dateTo?: string,
): string | undefined {
  if (confidenceVote !== true) return undefined;
  if (!dateFrom || !dateTo || dateFrom !== dateTo) return undefined;
  return "Nessuna fiducia trovata in questa data. La fiducia è spesso votata il giorno PRIMA dell'approvazione finale riportata dalla stampa: riprova con --date-from/--date-to sul giorno precedente (gg-1). Non inventare esito o contatori.";
}

/**
 * Se la finestra di date interrogata tocca gli ultimi ~14 giorni (o il futuro
 * prossimo), restituisce una nota di freschezza; altrimenti undefined. Serve a
 * qualificare un risultato vuoto sul dato Camera più recente, che il LOD
 * pubblica a lotti con alcuni giorni di ritardo (vedi
 * docs/lod-wiki/freschezza-e-autorevolezza.md).
 */
function recentWindowHint(dateFrom?: string, dateTo?: string): string | undefined {
  const bound = dateTo ?? dateFrom;
  if (!bound) return undefined;
  const boundMs = new Date(`${bound}T00:00:00Z`).getTime();
  if (Number.isNaN(boundMs)) return undefined;
  const daysAgo = (Date.now() - boundMs) / 86_400_000;
  if (daysAgo > 14) return undefined;
  return "Nessuna votazione nell'intervallo. Attenzione: il LOD Camera è pubblicato a lotti e può essere indietro di alcuni giorni, quindi un voto molto recente potrebbe non essere ancora caricato — un 'non trovato' su una data recente NON equivale a 'non avvenuto'. Verifica sul resoconto d'Aula/scheda iter di camera.it e riprova più avanti. Non inventare numeri, date o esiti.";
}

/**
 * Estrai codice mozione/risoluzione AIC dal testo.
 * Pattern: "MOZ 1-586" → { code: "1/00586" }
 *          "RIS 6-263" → { code: "6/00263" }
 *          "Risoluzione 6_00266" → { code: "6/00266" }
 */
function extractAicCode(text: string): { code: string } | null {
  if (!text) return null;
  // MOZ 1-586 / RIS 6-263
  let m = text.match(/\b(MOZ|RIS)\s+(\d+)-(\d+)/i);
  if (m) {
    const prefix = m[2];
    const num = m[3].padStart(5, "0");
    return { code: `${prefix}/${num}` };
  }
  // Risoluzione 6_00266 (da title)
  m = text.match(/\bRisoluzione\s+(\d+)[_](\d+)/i);
  if (m) {
    const prefix = m[1];
    const num = m[2];
    return { code: `${prefix}/${num}` };
  }
  return null;
}
