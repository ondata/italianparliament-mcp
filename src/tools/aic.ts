import { z } from "zod";
import { cdQuery } from "../core/client.js";
import { OCD_PREFIXES } from "../core/prefixes.js";
import { flattenBindings } from "../core/flatten.js";
import { cameraFreshnessHint } from "../core/freshness.js";
import type { Tool } from "./types.js";

const inputSchema = z.object({
  legislature: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("Numero legislatura"),
  deputyUri: z
    .string()
    .url()
    .optional()
    .describe("URI completo del deputato (primo firmatario o cofirmatario)"),
  primaryOnly: z
    .boolean()
    .default(false)
    .describe("Se true, solo atti di cui il deputato è primo firmatario"),
  keyword: z
    .string()
    .optional()
    .describe(
      "Cerca nel testo/oggetto dell'atto (match case-insensitive su label, titolo e description, a confini di parola: 'CETA' non matcha 'Acetamiprid')",
    ),
  type: z
    .string()
    .optional()
    .describe(
      "Filtra per tipo di atto (match parziale case-insensitive su dc:type e, in fallback, sul label). Es. 'immediata' per interrogazioni a risposta immediata/question time (dc:type non le distingue dalle orali per leg. 19: il match scatta sul label), 'scritta', 'commissione', 'mozione', 'interpellanza', 'odg'. Per la SEDE del question time il label è regolare, quindi filtrabile qui: 'immediata in assemblea' = question time in Aula, 'immediata in commissione' = question time in commissione (nessun campo/flag dedicato necessario).",
    ),
  chamber: z
    .enum(["camera", "senato"])
    .optional()
    .describe(
      "Filtra per ramo di provenienza dell'atto (ocd:ramo). Il dataset AIC della Camera contiene ANCHE il sindacato ispettivo del Senato (~160.000 atti, URI con suffisso _S): senza questo filtro si vedono entrambi i rami, come è sempre stato. Attenzione: in legislatura 17 circa il 4,5% degli atti non dichiara il ramo, e il filtro li esclude (il ramo non è deducibile).",
    ),
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
  limit: z.number().int().min(1).max(1000).default(100),
  offset: z.number().int().min(0).default(0),
});

const columns = [
  "uri",
  "label",
  "title",
  "type",
  "chamber",
  "date",
  "identifier",
  "sponsor_uri",
  "legislature",
  "description",
  "url",
  "html_url",
];

export const aicTool: Tool<typeof inputSchema> = {
  name: "aic",
  description:
    "[CAMERA+SENATO] Atti di indirizzo e controllo: interrogazioni (orali, scritte, in commissione), interpellanze, mozioni. Include il testo/oggetto dell'atto nel campo description. Filtrabile per legislatura, deputato (primo firmatario o cofirmatario). Il filtro per data (--date-from/--date-to) combacia sia sulla data di presentazione sia su quella di modifica: per i question time (interrogazioni a risposta immediata) la modifica è la data di TRATTAZIONE IN AULA, quindi filtra per quel giorno per trovarli. IMPORTANTE: il dataset della Camera pubblica ANCHE il sindacato ispettivo del SENATO (~160.000 atti in leg. 17-19, URI con suffisso _S, primo firmatario su senatore.rdf), quindi questo è il modo per cercare per ARGOMENTO le interrogazioni dei senatori: --keyword cerca nel testo (dc:description) e trova anche gli atti Senato. Il campo chamber dice il ramo di ogni riga, --chamber lo filtra. Per gli atti Senato html_url resta vuoto (nessuna scheda verificata su aic.camera.it): il riferimento navigabile è la colonna url, che restituisce il PDF ufficiale dell'atto.",
  inputSchema,
  examples: [
    "italianparliament aic list --legislature 19 --limit 10",
    "italianparliament aic list --legislature 19 --keyword xylella",
    "italianparliament aic list --deputy-uri http://dati.camera.it/ocd/deputato.rdf/d306921_17 --primary-only",
    "italianparliament aic list --legislature 19 --date-from 2026-01-01 --limit 50",
    "italianparliament aic list --legislature 19 --date-from 2026-01-01 --date-to 2026-03-31 --format jsonl",
    "italianparliament aic list --legislature 19 --type immediata --limit 20",
    "italianparliament aic list --legislature 19 --type \"immediata in assemblea\" --limit 20",
    "italianparliament aic list --legislature 19 --chamber senato --keyword nucleare --limit 20",
  ],
  async execute(input) {
    let signatoryPattern: string;
    if (!input.deputyUri) {
      signatoryPattern =
        "OPTIONAL { ?s ocd:primo_firmatario ?sponsor_uri }";
    } else if (input.primaryOnly) {
      signatoryPattern = `?s ocd:primo_firmatario <${input.deputyUri}> .
  BIND(<${input.deputyUri}> AS ?sponsor_uri)`;
    } else {
      signatoryPattern = `{
    ?s ocd:primo_firmatario <${input.deputyUri}> .
    BIND(<${input.deputyUri}> AS ?sponsor_uri)
  } UNION {
    ?s ocd:altro_firmatario <${input.deputyUri}> .
    BIND(<${input.deputyUri}> AS ?sponsor_uri)
  }`;
    }

    const legFilter = input.legislature
      ? `?s ocd:rif_leg <http://dati.camera.it/ocd/legislatura.rdf/repubblica_${input.legislature}> .`
      : "";
    // dc:date è per lo più "YYYYMMDD" ma sugli atti modificati dopo la
    // presentazione diventa composto "YYYYMMDD-YYYYMMDD" (presentazione-
    // modifica): confrontarlo per intero come stringa rompe il filtro su
    // questi record (62% degli aic leg. 19). SUBSTR isola le due date:
    // presentazione (car. 1-8) e modifica (car. 10-17, presente solo nei
    // composti). Per le interrogazioni a risposta immediata (question time)
    // la data di TRATTAZIONE IN AULA è la modifica, non la presentazione:
    // l'atto è presentato la vigilia e discusso il giorno dopo. Perciò il
    // filtro combacia se cade nell'intervallo la presentazione OPPURE la
    // modifica (altrimenti un question time cercato per la sua data d'Aula
    // darebbe 0 righe).
    const dFrom = input.dateFrom?.replace(/-/g, "");
    const dTo = input.dateTo?.replace(/-/g, "");
    // Il confronto va forzato lessicografico con STR(): su Virtuoso Camera
    // SUBSTR/REPLACE restituiscono valori che con >=/<= verrebbero confrontati
    // come numerici, dando 0 righe (l'uguaglianza = invece funziona). La data
    // di presentazione sono i primi 8 caratteri; la modifica (question time =
    // giorno d'Aula) è il secondo gruppo del composto "YYYYMMDD-YYYYMMDD",
    // estratto con REPLACE (per i formati semplici resta la presentazione, così
    // il ramo modifica non introduce falsi).
    const pres = `STR(SUBSTR(STR(?date), 1, 8))`;
    const modif = `STR(REPLACE(STR(?date), "^([0-9]{8})-([0-9]{8}).*$", "$2"))`;
    const rangeCond = (expr: string): string =>
      [dFrom ? `${expr} >= "${dFrom}"` : "", dTo ? `${expr} <= "${dTo}"` : ""]
        .filter(Boolean)
        .join(" && ");
    const dateFilter =
      dFrom || dTo
        ? `FILTER((${rangeCond(pres)}) || (${rangeCond(modif)}))`
        : "";
    // Escape per REGEX a confini di parola: i metacaratteri regex vanno protetti
    // con DOPPIO backslash nel testo sorgente SPARQL, perché il parsing della
    // stringa Turtle consuma un livello ("\\." -> "\.") prima che REGEX() veda
    // il proprio escape "\.". Idem per "\b": nel sorgente serve "\\b" perché
    // Turtle lo riduce a "\b" (altrimenti "\b" da solo verrebbe letto come
    // backspace, un ECHAR Turtle valido, non come confine di parola).
    const keywordPattern = input.keyword !== undefined
      ? input.keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\\\$&").replace(/"/g, '\\"')
      : "";
    const keywordFilter = input.keyword !== undefined
      ? `FILTER(REGEX(COALESCE(STR(?label), ""), "\\\\b${keywordPattern}\\\\b", "i") || REGEX(COALESCE(STR(?title), ""), "\\\\b${keywordPattern}\\\\b", "i") || REGEX(COALESCE(STR(?description), ""), "\\\\b${keywordPattern}\\\\b", "i"))`
      : "";
    const typeEsc = input.type !== undefined
      ? input.type.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
      : "";
    // Anche sul label: per la legislatura 19 il dc:type NON distingue "a
    // risposta immediata" (question time) da "a risposta orale" - tutte le
    // interrogazioni con identifier "3/..." sono tipizzate "INTERROGAZIONE A
    // RISPOSTA ORALE" nonostante il label dica "RISPOSTA IMMEDIATA". Senza
    // controllare anche il label, --type immediata darebbe 0 risultati.
    const typeFilter = input.type !== undefined
      ? `FILTER(CONTAINS(LCASE(COALESCE(STR(?type), "")), LCASE("${typeEsc}")) || CONTAINS(LCASE(COALESCE(STR(?label), "")), LCASE("${typeEsc}")))`
      : "";
    // ocd:ramo distingue gli atti della Camera da quelli del Senato, che il
    // dataset AIC della Camera pubblica insieme (URI con suffisso _S). Resta
    // OPTIONAL perché in leg. 17 il 4,5% degli atti non lo dichiara: renderlo
    // obbligatorio perderebbe quelle righe anche quando nessuno ha chiesto un
    // ramo. Il filtro, quando c'è, li esclude per forza: senza ocd:ramo il
    // ramo non è deducibile e non va indovinato.
    // Il valore è già ristretto dall'enum Zod a camera|senato, quindi entra
    // nella query senza escape aggiuntivo. Il match è per sottostringa perché
    // il dato è testo istituzionale ("Camera dei Deputati").
    const chamberFilter = input.chamber
      ? `FILTER(CONTAINS(LCASE(STR(?ramo)), "${input.chamber}"))`
      : "";

    const coreSelect = `SELECT DISTINCT ?s ?label ?title ?type ?ramo ?date ?identifier ?sponsor_uri ?rif_leg ?description ?url
WHERE {
  ?s a ocd:aic .
  ?s rdfs:label ?label .
  ${signatoryPattern}
  OPTIONAL { ?s ocd:ramo ?ramo }
  OPTIONAL { ?s dc:title ?title }
  OPTIONAL { ?s dc:type ?type }
  OPTIONAL { ?s dc:date ?date }
  OPTIONAL { ?s dc:identifier ?identifier }
  OPTIONAL { ?s ocd:rif_leg ?rif_leg }
  OPTIONAL { ?s dc:description ?description }
  OPTIONAL { ?s dcterms:isReferencedBy ?url }
  ${legFilter}
  ${dateFilter}
  ${keywordFilter}
  ${typeFilter}
  ${chamberFilter}
}`;

    const query = input.countOnly
      ? `${OCD_PREFIXES}\nSELECT (COUNT(*) AS ?count) WHERE {\n${coreSelect}\n}`
      : `${OCD_PREFIXES}\n${coreSelect}\nORDER BY DESC(?date)\nLIMIT ${input.limit}\nOFFSET ${input.offset}`;

    const results = await cdQuery(query);
    if (input.countOnly) {
      const c = flattenBindings(results)[0]?.count ?? "0";
      return { rows: [{ count: c }], columns: ["count"] };
    }
    const raw = flattenBindings(results);
    const rows = raw.map((r) => {
      const uri = r.s ?? "";
      // Gli atti del Senato (suffisso _S) non matchano di proposito: la scheda
      // aic.camera.it risponde 200 a qualsiasi combinazione di parametri, quindi
      // non è stato possibile verificare un pattern valido per il ramo Senato e
      // un URL inventato sarebbe peggio di uno assente. Per quegli atti il
      // riferimento umano è la colonna url (dcterms:isReferencedBy), verificata:
      // restituisce il PDF "ATTO SENATO Sindacato Ispettivo" con testo e iter.
      const m = uri.match(/aic(\d+)_(\d+)_(\d+)$/);
      const html_url = m
        ? `https://aic.camera.it/aic/scheda.html?core=aic&numero=${m[1]}/${m[2]}&ramo=CAMERA&leg=${m[3]}`
        : "";
      const legM = (r.rif_leg ?? "").match(/repubblica_(\d+)$/);
      const legislature = legM ? legM[1] : "";
      const dateRaw = r.date ?? "";
      const formatYmd = (s: string) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
      const dateRange = dateRaw.match(/^(\d{8})-(\d{8})$/);
      const date = dateRange
        ? `${formatYmd(dateRange[1])} (modificato ${formatYmd(dateRange[2])})`
        : dateRaw.length === 8
          ? formatYmd(dateRaw)
          : dateRaw;
      return {
        uri,
        label: r.label ?? "",
        title: r.title ?? "",
        type: r.type ?? "",
        chamber: normalizeChamber(r.ramo),
        date,
        identifier: r.identifier ?? "",
        sponsor_uri: r.sponsor_uri ?? "",
        legislature,
        description: r.description ?? "",
        url: r.url ?? "",
        html_url,
      };
    });
    if (rows.length === 0) {
      // Il vuoto su una finestra di date è ambiguo: può essere latenza di
      // pubblicazione. L'hint lo qualifica con l'ultimo lotto caricato.
      const hint = await cameraFreshnessHint({
        ocdClass: "aic",
        areaLabel: "l'area degli atti di indirizzo e controllo (aic)",
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
      });
      if (hint) return { rows, columns, hint };
    }
    return { rows, columns };
  },
};

/**
 * `ocd:ramo` è testo istituzionale ("Camera dei Deputati", "Senato della
 * Repubblica"): si normalizza a camera/senato per renderlo filtrabile a valle
 * (grep, jq, --chamber). Un valore non riconosciuto si restituisce grezzo
 * invece di essere forzato in una delle due categorie.
 */
function normalizeChamber(ramo?: string): string {
  if (!ramo) return "";
  const r = ramo.toLowerCase();
  if (r.includes("senato")) return "senato";
  if (r.includes("camera")) return "camera";
  return ramo;
}
