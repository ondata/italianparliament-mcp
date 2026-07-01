import { z } from "zod";
import { cdQuery } from "../core/client.js";
import { OCD_PREFIXES } from "../core/prefixes.js";
import { flattenBindings } from "../core/flatten.js";
import type { Tool } from "./types.js";

const inputSchema = z.object({
  legislature: z
    .number()
    .int()
    .positive()
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
      "Filtra per tipo di atto (match parziale case-insensitive su dc:type e, in fallback, sul label). Es. 'immediata' per interrogazioni a risposta immediata/question time (dc:type non le distingue dalle orali per leg. 19: il match scatta sul label), 'scritta', 'commissione', 'mozione', 'interpellanza', 'odg'",
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
    "[CAMERA] Atti di indirizzo e controllo: interrogazioni (orali, scritte, in commissione), interpellanze, mozioni. Include il testo/oggetto dell'atto nel campo description. Filtrabile per legislatura, deputato (primo firmatario o cofirmatario).",
  inputSchema,
  examples: [
    "italianparliament aic list --legislature 19 --limit 10",
    "italianparliament aic list --legislature 19 --keyword xylella",
    "italianparliament aic list --deputy-uri http://dati.camera.it/ocd/deputato.rdf/d306921_17 --primary-only",
    "italianparliament aic list --legislature 19 --date-from 2026-01-01 --limit 50",
    "italianparliament aic list --legislature 19 --date-from 2026-01-01 --date-to 2026-03-31 --format jsonl",
    "italianparliament aic list --legislature 19 --type immediata --limit 20",
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
    // questi record (62% degli aic leg. 19). SUBSTR isola la data di
    // presentazione (primi 8 caratteri), valida in entrambi i formati.
    const dateFromFilter = input.dateFrom
      ? `FILTER(SUBSTR(STR(?date), 1, 8) >= "${input.dateFrom.replace(/-/g, "")}")`
      : "";
    const dateToFilter = input.dateTo
      ? `FILTER(SUBSTR(STR(?date), 1, 8) <= "${input.dateTo.replace(/-/g, "")}")`
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

    const coreSelect = `SELECT DISTINCT ?s ?label ?title ?type ?date ?identifier ?sponsor_uri ?rif_leg ?description ?url
WHERE {
  ?s a ocd:aic .
  ?s rdfs:label ?label .
  ${signatoryPattern}
  OPTIONAL { ?s dc:title ?title }
  OPTIONAL { ?s dc:type ?type }
  OPTIONAL { ?s dc:date ?date }
  OPTIONAL { ?s dc:identifier ?identifier }
  OPTIONAL { ?s ocd:rif_leg ?rif_leg }
  OPTIONAL { ?s dc:description ?description }
  OPTIONAL { ?s dcterms:isReferencedBy ?url }
  ${legFilter}
  ${dateFromFilter}
  ${dateToFilter}
  ${keywordFilter}
  ${typeFilter}
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
        date,
        identifier: r.identifier ?? "",
        sponsor_uri: r.sponsor_uri ?? "",
        legislature,
        description: r.description ?? "",
        url: r.url ?? "",
        html_url,
      };
    });
    return { rows, columns };
  },
};
