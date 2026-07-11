import { z } from "zod";
import { snQuery } from "../core/client.js";
import { OSR_PREFIXES } from "../core/prefixes.js";
import { flattenBindings } from "../core/flatten.js";
import { actHtmlUrl, ddlRssUrl } from "../core/html-url.js";
import { extractBillNumber } from "../core/bill-number.js";
import type { Tool } from "./types.js";

const inputSchema = z.object({
  legislature: z
    .number()
    .int()
    .positive()
    .default(19)
    .describe("Numero legislatura Senato (default 19)"),
  ddlUri: z
    .string()
    .url()
    .optional()
    .describe("Filtra le votazioni collegate a un DDL (es. http://dati.senato.it/ddl/58039)"),
  keyword: z
    .string()
    .optional()
    .describe("Cerca nel label della votazione e nel titolo del DDL collegato (case-insensitive), fiducie incluse (il DDL citato per numero nel label viene risolto e il suo titolo concorre al match). Es. 'caccia', 'bilancio', 'sicurezza'. Nota: i nomi colloquiali dei decreti (es. 'piano casa') possono non comparire né nel label né nel titolo ufficiale — in caso di vuoto filtra per data"),
  confidenceVote: z
    .boolean()
    .optional()
    .describe("Filtra le votazioni di fiducia governativa (label contiene 'fiducia', escluse le mozioni di 'sfiducia')"),
  finalVote: z
    .boolean()
    .optional()
    .describe("Filtra le votazioni finali (label contiene 'Votazione finale')"),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Data inizio seduta (YYYY-MM-DD)"),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Data fine seduta (YYYY-MM-DD)"),
  countOnly: z
    .boolean()
    .optional()
    .describe("Se true, restituisce solo il numero totale di votazioni (colonna count)"),
  limit: z.number().int().positive().max(1000).default(100),
  offset: z.number().int().nonnegative().default(0),
});

const columns = [
  "uri",
  "date",
  "number",
  "type",
  "label",
  "outcome",
  "in_favour",
  "against",
  "abstentions",
  "present",
  "voters",
  "majority",
  "bill_number",
  "ddl_uri",
  "ddl_count",
  "ambiguous_ddl",
  "ddl_uris_json",
  "ddl_html_url",
  "ddl_html_urls_json",
  "rss_url",
  "rss_urls_json",
  "object_uri",
];

export const senatoVotesTool: Tool<typeof inputSchema> = {
  name: "senato-votes",
  description:
    "[SENATO] Lista votazioni dell'Assemblea del Senato con esito, contatori (favorevoli, contrari, astenuti, presenti, votanti), tipo, data seduta e DDL collegato. Filtrabile per legislatura, data, DDL, parola chiave (label + titolo del DDL collegato, fiducie incluse), voti di fiducia (--confidence-vote) e voti finali (--final-vote). Per il voto del singolo senatore usare senato-vote-detail. Le votazioni di FIDUCIA hanno ddl_uri vuoto alla fonte (il DDL è solo nel label, es. 'Disegno di legge n.1933. Votazione questione di fiducia'), ma --ddl-uri le include comunque: risolve le sedute del DDL e ricollega la fiducia votata quel giorno. Verifica sempre il ddl_uri di una 'Votazione finale' trovata per data: può appartenere a un atto diverso (testo unificato). Riporta solo i contatori restituiti, non stimarli.",
  emptyHint:
    "Nessuna votazione trovata. Con --ddl-uri significa che nel LOD non risulta alcuna votazione d'Assemblea collegata a quel DDL (fiducie incluse): verifica l'URI del DDL, oppure il voto potrebbe essere solo in Commissione. Con --keyword/--confidence-vote/--final-vote: il tema/tipo non compare in tutti i label — riprova filtrando per data (--date-from/--date-to intorno all'evento) e riconosci il voto dal label. Caso limite: se cerchi una fiducia e il DDL non ha nessun altro voto d'Assemblea che lo cita, prova per data e riconosci il DDL dal label. Gap noto di dataset (legislatura 18): tra il 10 marzo e il 16 aprile 2020 (periodo COVID) non risulta ALCUNA votazione d'Assemblea nel LOD, pur essendoci le sedute con i relativi interventi — include la fiducia sul decreto Cura Italia (9/4/2020). Un vuoto in questa finestra non significa che non si sia votato: è un buco della fonte, non deducibile da qui. Non inventare l'esito o i contatori del voto.",
  inputSchema,
  examples: [
    "italianparliament senato-votes list --legislature 19 --limit 50",
    "italianparliament senato-votes list --legislature 19 --date-from 2026-01-01 --date-to 2026-03-31",
    "italianparliament senato-votes list --ddl-uri http://dati.senato.it/ddl/58039 --format jsonl",
    "italianparliament senato-votes list --legislature 19 --confidence-vote true",
    "italianparliament senato-votes list --legislature 19 --final-vote true --date-from 2026-06-01",
    "italianparliament senato-votes list --legislature 19 --keyword bilancio",
  ],
  async execute(input) {
    // Filtro label-based: keyword (CONTAINS), confidence ('fiducia' ma non
    // 'sfiducia' che indica mozioni di sfiducia), final ('votazione finale').
    // Il tipo semantico (finale/fiducia) non è in osr:tipoVotazione (che è la
    // modalità: elettronica/nominale/segreta), ma nel label.
    const keywordEsc = input.keyword
      ? input.keyword.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
      : "";
    const labelFilters: string[] = [];
    // Il tema del provvedimento spesso non è nel label del voto ("Votazione
    // finale") ma nel titolo del DDL collegato (osr:titolo, via
    // osr:oggetto/osr:relativoA): la keyword deve poter matchare anche lì,
    // altrimenti ricerche come "caccia" non trovano il voto finale collegato
    // a un DDL sulla caccia. BOUND() evita che il match sul titolo (assente
    // sulle fiducie, prive di osr:oggetto) faccia fallire l'intero OR.
    if (input.keyword)
      labelFilters.push(
        `(CONTAINS(LCASE(STR(?label)), LCASE("${keywordEsc}")) || ` +
          `(BOUND(?ddlTitolo) && CONTAINS(LCASE(STR(?ddlTitolo)), LCASE("${keywordEsc}"))))`,
      );
    if (input.confidenceVote !== undefined)
      // 'fiducia' copre 'questione di fiducia' / 'questione fiducia' / 'fiducia governo';
      // esclude 'sfiducia' (mozioni di sfiducia individuale).
      labelFilters.push(
        input.confidenceVote
          ? `CONTAINS(LCASE(STR(?label)), "fiducia") && !CONTAINS(LCASE(STR(?label)), "sfiducia")`
          : `!CONTAINS(LCASE(STR(?label)), "fiducia")`,
      );
    if (input.finalVote !== undefined)
      labelFilters.push(
        input.finalVote
          ? `CONTAINS(LCASE(STR(?label)), "votazione finale")`
          : `!CONTAINS(LCASE(STR(?label)), "votazione finale")`,
      );
    const needsLabel = labelFilters.length > 0;
    const labelFilter = needsLabel ? `FILTER(${labelFilters.join(" && ")})` : "";
    // Titolo del DDL collegato, serve solo per il match --keyword sul tema
    // (vedi sopra); va nel BGP prima del labelFilter perché ?ddlTitolo vi è
    // referenziato.
    const ddlTopicPattern = input.keyword
      ? "OPTIONAL { ?v osr:oggetto ?kwOggetto . OPTIONAL { ?kwOggetto osr:relativoA ?kwDdl . OPTIONAL { ?kwDdl osr:titolo ?ddlTitolo } } }"
      : "";

    const dateFromFilter = input.dateFrom
      ? `FILTER(?date >= "${input.dateFrom}"^^xsd:date)`
      : "";
    const dateToFilter = input.dateTo
      ? `FILTER(?date <= "${input.dateTo}"^^xsd:date)`
      : "";

    // --ddl-uri identifica univocamente il provvedimento e quindi la sua
    // legislatura. L'URI (dati.senato.it/ddl/{N}) non la codifica, ma la
    // proprietà osr:legislatura del DDL sì. Senza risolverla, il filtro di
    // legislatura di default (19) esclude in silenzio i DDL di altre
    // legislature (falso negativo: "Nessuna votazione trovata" pur essendo
    // l'URI già non ambiguo). La deriviamo dal DDL e la usiamo in tutte le
    // query; fallback all'input se il DDL non la espone.
    let effectiveLeg = input.legislature;
    if (input.ddlUri) {
      const legRows = flattenBindings(
        await snQuery(
          `${OSR_PREFIXES}\nSELECT ?leg WHERE { <${input.ddlUri}> osr:legislatura ?leg } LIMIT 1`,
        ),
      );
      const resolved = Number(legRows[0]?.leg);
      if (Number.isInteger(resolved) && resolved > 0) effectiveLeg = resolved;
    }

    // Supplemento fiducie per --keyword: le fiducie non hanno osr:oggetto,
    // quindi ?ddlTitolo resta unbound e il filtro keyword in SPARQL le esclude
    // anche quando il tema cercato è nel titolo del DDL citato per numero nel
    // label ("Disegno di legge n.1509. Votazione questione di fiducia").
    // Le recuperiamo a parte — set piccolo (~55 fiducie nell'intera leg. 19) —
    // risolviamo il DDL via osr:fase (come il Fallback 1) leggendone anche il
    // titolo, e teniamo solo quelle il cui titolo matcha la keyword.
    // Non si applica: con --ddl-uri (le fiducie sono già ricollegate lì), se le
    // fiducie sono escluse dai filtri (--confidence-vote false, --final-vote
    // true), o senza keyword.
    const wantsFiduciaSupplement =
      !!input.keyword &&
      !input.ddlUri &&
      input.confidenceVote !== false &&
      input.finalVote !== true;
    const fiduciaThemeSupplement = async (): Promise<
      Array<Record<string, string>>
    > => {
      const q = `${OSR_PREFIXES}
SELECT DISTINCT ?v ?date ?numero ?tipo ?label ?esito
                ?favorevoli ?contrari ?astenuti ?presenti ?votanti ?maggioranza
WHERE {
  ?v a osr:Votazione ; osr:legislatura ${effectiveLeg} ; osr:seduta ?s .
  OPTIONAL { ?s osr:dataSeduta ?date }
  ?v rdfs:label ?label .
  FILTER(CONTAINS(LCASE(STR(?label)), "fiducia") &&
         !CONTAINS(LCASE(STR(?label)), "sfiducia") &&
         !CONTAINS(LCASE(STR(?label)), LCASE("${keywordEsc}")))
  OPTIONAL { ?v osr:numero ?numero }
  OPTIONAL { ?v osr:tipoVotazione ?tipo }
  OPTIONAL { ?v osr:esito ?esito }
  OPTIONAL { ?v osr:favorevoli ?favorevoli }
  OPTIONAL { ?v osr:contrari ?contrari }
  OPTIONAL { ?v osr:astenuti ?astenuti }
  OPTIONAL { ?v osr:presenti ?presenti }
  OPTIONAL { ?v osr:votanti ?votanti }
  OPTIONAL { ?v osr:maggioranza ?maggioranza }
  ${dateFromFilter}
  ${dateToFilter}
}`;
      const cand = flattenBindings(await snQuery(q))
        .map((r) => ({
          uri: r.v ?? "",
          date: r.date ?? "",
          number: r.numero ?? "",
          type: r.tipo ?? "",
          label: r.label ?? "",
          outcome: r.esito ?? "",
          in_favour: r.favorevoli ?? "",
          against: r.contrari ?? "",
          abstentions: r.astenuti ?? "",
          present: r.presenti ?? "",
          voters: r.votanti ?? "",
          majority: r.maggioranza ?? "",
          bill_number: extractBillNumber(r.label),
          ddl_uri: "",
          object_uri: "",
        }))
        .filter((v) => v.bill_number);
      if (cand.length === 0) return [];
      const nums = [...new Set(cand.map((v) => v.bill_number))];
      const filter = nums.map((n) => `STR(?f) = "S.${n}"`).join(" || ");
      const fq = `${OSR_PREFIXES}
SELECT ?ddl ?f ?titolo WHERE {
  ?ddl a osr:Ddl ; osr:legislatura ${effectiveLeg} ; osr:fase ?f .
  OPTIONAL { ?ddl osr:titolo ?titolo }
  FILTER(${filter})
}`;
      const byNum = new Map<string, { ddl: string; titolo: string }>();
      for (const r of flattenBindings(await snQuery(fq))) {
        const num = (r.f ?? "").replace(/^S\./, "");
        if (num && r.ddl && !byNum.has(num))
          byNum.set(num, { ddl: r.ddl, titolo: r.titolo ?? "" });
      }
      const kw = input.keyword!.toLowerCase();
      return cand.filter((v) => {
        const hit = byNum.get(v.bill_number);
        if (!hit || !hit.titolo.toLowerCase().includes(kw)) return false;
        v.ddl_uri = hit.ddl;
        return true;
      });
    };

    // --ddl-uri: le votazioni di FIDUCIA non hanno osr:oggetto, quindi il filtro
    // diretto osr:relativoA le esclude a monte. Ma sono nella stessa seduta
    // (stessa data) del voto procedurale/finale che invece cita il DDL. Perciò
    // risolviamo prima le DATE delle sedute in cui il DDL è stato votato, poi
    // interroghiamo per quelle date e ricolleghiamo il DDL con i fallback
    // esistenti (come già avviene per le query per data). Il set di date è
    // piccolo (poche sedute): niente rischio timeout.
    let ddlDateFilter = "";
    if (input.ddlUri) {
      const datesQuery = `${OSR_PREFIXES}
SELECT DISTINCT ?date WHERE {
  ?v a osr:Votazione ; osr:legislatura ${effectiveLeg} ; osr:seduta ?s .
  ?s osr:dataSeduta ?date .
  ?v osr:oggetto ?o . ?o osr:relativoA <${input.ddlUri}> .
}`;
      const ddlDates = [
        ...new Set(
          flattenBindings(await snQuery(datesQuery))
            .map((r) => r.date)
            .filter(Boolean),
        ),
      ];
      if (ddlDates.length === 0) {
        return input.countOnly
          ? { rows: [{ count: "0" }], columns: ["count"] }
          : { rows: [], columns };
      }
      ddlDateFilter = `FILTER(?date IN (${ddlDates
        .map((d) => `"${d}"^^xsd:date`)
        .join(", ")}))`;
    }

    // Count minimale (solo pattern vincolanti): il wrap dell'intero SELECT con
    // gli OPTIONAL su ~64k votazioni manda Virtuoso in timeout. Non applicabile
    // a --ddl-uri, che richiede la risoluzione via fallback: in quel caso il
    // conteggio è la cardinalità del result-set filtrato (calcolata sotto).
    if (input.countOnly && !input.ddlUri) {
      const countWhere = [`?v a osr:Votazione ; osr:legislatura ${effectiveLeg} .`];
      if (ddlTopicPattern) countWhere.push(ddlTopicPattern);
      if (needsLabel) countWhere.push(`?v rdfs:label ?label . ${labelFilter}`);
      if (input.dateFrom || input.dateTo)
        countWhere.push(`?v osr:seduta ?sed . ?sed osr:dataSeduta ?date . ${dateFromFilter} ${dateToFilter}`);
      const q = `${OSR_PREFIXES}\nSELECT (COUNT(DISTINCT ?v) AS ?count) WHERE {\n${countWhere.join("\n  ")}\n}`;
      let c = Number(flattenBindings(await snQuery(q))[0]?.count ?? "0");
      // Il count SPARQL non vede le fiducie matchate via titolo DDL (vedi
      // supplemento): le aggiungiamo. Nessun doppio conteggio: il supplemento
      // esclude i label che già matchano la keyword.
      if (wantsFiduciaSupplement) c += (await fiduciaThemeSupplement()).length;
      return { rows: [{ count: String(c) }], columns: ["count"] };
    }

    // Il DDL è sempre in forma OPTIONAL: con --ddl-uri il filtro effettivo è per
    // data (ddlDateFilter) + post-filtro sull'esito risolto. Con --ddl-uri il
    // set è piccolo: niente LIMIT/OFFSET server, paginiamo in TS dopo il
    // post-filtro (altrimenti il LIMIT taglierebbe prima del filtro).
    const paginate = input.ddlUri ? "" : `LIMIT ${input.limit}\nOFFSET ${input.offset}`;
    const coreSelect = `SELECT DISTINCT ?v ?date ?numero ?tipo ?label ?esito
                ?favorevoli ?contrari ?astenuti ?presenti ?votanti ?maggioranza
                ?ddl ?oggetto
WHERE {
  ?v a osr:Votazione ; osr:legislatura ${effectiveLeg} ; osr:seduta ?s .
  OPTIONAL { ?s osr:dataSeduta ?date }
  ${ddlTopicPattern}
  ${needsLabel ? `?v rdfs:label ?label . ${labelFilter}` : "OPTIONAL { ?v rdfs:label ?label }"}
  OPTIONAL { ?v osr:numero ?numero }
  OPTIONAL { ?v osr:tipoVotazione ?tipo }
  OPTIONAL { ?v osr:esito ?esito }
  OPTIONAL { ?v osr:favorevoli ?favorevoli }
  OPTIONAL { ?v osr:contrari ?contrari }
  OPTIONAL { ?v osr:astenuti ?astenuti }
  OPTIONAL { ?v osr:presenti ?presenti }
  OPTIONAL { ?v osr:votanti ?votanti }
  OPTIONAL { ?v osr:maggioranza ?maggioranza }
  OPTIONAL { ?v osr:oggetto ?oggetto . OPTIONAL { ?oggetto osr:relativoA ?ddl } }
  ${ddlDateFilter}
  ${dateFromFilter}
  ${dateToFilter}
}`;

    const query = `${OSR_PREFIXES}\n${coreSelect}\nORDER BY DESC(?date) DESC(?numero)\n${paginate}`;

    const results = await snQuery(query);
    const raw = flattenBindings(results);
    // Post-filtro --ddl-uri: teniamo i voti FORTEMENTE collegati al DDL — link
    // diretto osr:relativoA (raccolto qui) o risoluzione via numero nel label
    // (Fallback 1, sotto) — più le sole FIDUCIE. Il Fallback 2 (propagazione
    // per data) aggancia al DDL anche voti estranei votati la stessa seduta
    // (es. una risoluzione su comunicazioni del governo): quelli vanno esclusi.
    const strong = new Set<string>();
    // Un voto su DDL unificati è collegato a più ddl via osr:relativoA:
    // il join moltiplica le righe. Collassiamo per URI votazione e
    // concateniamo i DDL distinti.
    const byUri = new Map<string, Record<string, string>>();
    for (const r of raw) {
      const uri = r.v ?? "";
      const ddl = r.ddl ?? "";
      if (input.ddlUri && ddl === input.ddlUri) strong.add(uri);
      const existing = byUri.get(uri);
      if (existing) {
        if (ddl && !existing.ddl_uri.split(" | ").includes(ddl)) {
          existing.ddl_uri = existing.ddl_uri ? `${existing.ddl_uri} | ${ddl}` : ddl;
        }
        continue;
      }
      byUri.set(uri, {
        uri,
        date: r.date ?? "",
        number: r.numero ?? "",
        type: r.tipo ?? "",
        label: r.label ?? "",
        outcome: r.esito ?? "",
        in_favour: r.favorevoli ?? "",
        against: r.contrari ?? "",
        abstentions: r.astenuti ?? "",
        present: r.presenti ?? "",
        voters: r.votanti ?? "",
        majority: r.maggioranza ?? "",
        bill_number: extractBillNumber(r.label),
        ddl_uri: ddl,
        object_uri: r.oggetto ?? "",
      });
    }
    // Fallback 1: alcuni voti (tipicamente le fiducie) non hanno osr:oggetto e
    // quindi nessun ddl_uri via grafo, ma citano il DDL nel label. Risolviamo il
    // numero → URI in un'unica query via osr:fase="S.<num>" (univoco intra-leg;
    // niente VALUES batch su Virtuoso → OR-chain). Solo per i label che citano
    // davvero un DDL (bill_number non vuoto).
    let needing = [...byUri.values()].filter((v) => !v.ddl_uri && v.bill_number);
    const nums = [...new Set(needing.map((v) => v.bill_number))];
    if (nums.length) {
      const filter = nums.map((n) => `STR(?f) = "S.${n}"`).join(" || ");
      const fbQuery = `${OSR_PREFIXES}
SELECT ?ddl ?f WHERE {
  ?ddl a osr:Ddl ; osr:legislatura ${effectiveLeg} ; osr:fase ?f .
  FILTER(${filter})
}`;
      const byFase = new Map<string, string>();
      for (const r of flattenBindings(await snQuery(fbQuery))) {
        const num = (r.f ?? "").replace(/^S\./, "");
        if (num && r.ddl && !byFase.has(num)) byFase.set(num, r.ddl);
      }
      for (const v of needing) {
        const ddl = byFase.get(v.bill_number);
        if (ddl) {
          v.ddl_uri = ddl;
          if (input.ddlUri && ddl === input.ddlUri) strong.add(v.uri);
        }
        // Difesa: il numero citato nel label non corrisponde ad alcun DDL della
        // legislatura (es. refuso nella fonte, "DDL n. 1994" per S.1944). Non
        // esporlo come identificativo interrogabile: il testo grezzo resta in
        // `label`, ma `bill_number` deve solo contenere numeri verificati.
        else v.bill_number = "";
      }
    }
    // Fallback 2: voti rimasti senza ddl_uri anche dopo Fallback 1
    // (es. fiducie il cui bill_number è un refuso della fonte).
    // Se lo stesso giorno ha altre votazioni con ddl_uri noto
    // (la seduta d'Assemblea è unica per data), propaghiamo quel DDL.
    // Attenzione: se la stessa data ha più DDL diversi, non propaghiamo.
    needing = [...byUri.values()].filter((v) => !v.ddl_uri);
    unlinked: if (needing.length > 0) {
      const dateDdls = new Map<string, string>();
      let ambiguous = false;
      for (const v of byUri.values()) {
        if (!v.date || !v.ddl_uri) continue;
        const existing = dateDdls.get(v.date);
        if (existing === undefined) {
          dateDdls.set(v.date, v.ddl_uri);
        } else if (existing !== v.ddl_uri) {
          ambiguous = true;
        }
      }
      if (!ambiguous) {
        for (const v of needing) {
          if (v.ddl_uri || !v.date) continue;
          const ddl = dateDdls.get(v.date);
          if (ddl) {
            v.ddl_uri = ddl;
            // Non modifichiamo bill_number: il numero nel label è un refuso,
            // meglio tenerlo vuoto (già azzerato).
          }
        }
      }
    }
    // Merge del supplemento fiducie (solo prima pagina: con offset > 0 le
    // stesse righe si ripresenterebbero a ogni pagina). Le righe arrivano già
    // risolte (ddl_uri + bill_number verificati); il totale può superare di
    // qualche unità il limit richiesto: preferiamo l'eccesso alla perdita
    // della fiducia cercata.
    let supplementApplied = false;
    if (wantsFiduciaSupplement && input.offset === 0) {
      for (const row of await fiduciaThemeSupplement()) {
        if (!byUri.has(row.uri)) {
          byUri.set(row.uri, row);
          supplementApplied = true;
        }
      }
    }
    const splitMulti = (value: string): string[] =>
      value
        .split(" | ")
        .map((u) => u.trim())
        .filter(Boolean);

    let values = [...byUri.values()];
    // Le righe supplementari rompono l'ORDER BY del server: riordina.
    if (supplementApplied)
      values.sort(
        (a, b) =>
          (b.date || "").localeCompare(a.date || "") ||
          Number(b.number || 0) - Number(a.number || 0),
      );
    if (input.ddlUri) {
      const target = input.ddlUri;
      // Post-filtro: solo i voti FORTEMENTE collegati al DDL (link diretto o
      // Fallback 1) più le sole FIDUCIE; scartiamo i voti agganciati per sola
      // propagazione-data (Fallback 2) che fiducie non sono (es. risoluzioni).
      values = values.filter(
        (v) =>
          v.ddl_uri
            .split(" | ")
            .map((u) => u.trim())
            .includes(target) &&
          (strong.has(v.uri) || /fiducia/i.test(v.label)),
      );
      // ORDER BY server già applicato; paginiamo in TS dopo il post-filtro.
      if (input.countOnly)
        return { rows: [{ count: String(values.length) }], columns: ["count"] };
      values = values.slice(input.offset, input.offset + input.limit);
    }
    // Backfill di bill_number dal DDL risolto: sui label generici ("Votazione
    // finale") o coi refusi il numero non è estraibile dal testo, ma quando
    // ddl_uri è stato risolto (link diretto o fallback) il numero è la
    // osr:fase del DDL. Solo DDL singolo (multi = ambiguo) e solo fasi S.
    // (bill_number è il numero Senato).
    const missingNum = values.filter(
      (v) => !v.bill_number && v.ddl_uri && !v.ddl_uri.includes(" | "),
    );
    if (missingNum.length > 0) {
      const ddlUris = [...new Set(missingNum.map((v) => v.ddl_uri))];
      const numQuery = `${OSR_PREFIXES}
SELECT ?ddl ?f WHERE {
  ?ddl a osr:Ddl ; osr:fase ?f .
  FILTER(?ddl IN (${ddlUris.map((u) => `<${u}>`).join(", ")}))
}`;
      const faseByDdl = new Map<string, string>();
      for (const r of flattenBindings(await snQuery(numQuery))) {
        if (r.ddl && /^S\./.test(r.f ?? "") && !faseByDdl.has(r.ddl))
          faseByDdl.set(r.ddl, r.f.replace(/^S\./, ""));
      }
      for (const v of missingNum) {
        v.bill_number = faseByDdl.get(v.ddl_uri) ?? "";
      }
    }
    const rows = values.map((v) => {
      const ddlUris = splitMulti(v.ddl_uri);
      const ddlHtmlUrls = ddlUris.map((u) => actHtmlUrl(u)).filter(Boolean);
      const rssUrls = ddlUris.map((u) => ddlRssUrl(u, effectiveLeg)).filter(Boolean);
      return {
        ...v,
        ddl_count: String(ddlUris.length),
        ambiguous_ddl: ddlUris.length > 1 ? "true" : "false",
        ddl_uris_json: JSON.stringify(ddlUris),
        ddl_html_url: ddlHtmlUrls.join(" | "),
        ddl_html_urls_json: JSON.stringify(ddlHtmlUrls),
        rss_url: rssUrls.join(" | "),
        rss_urls_json: JSON.stringify(rssUrls),
      };
    });
    return { rows, columns };
  },
};
