import { z } from "zod";
import { cdQuery } from "../core/client.js";
import { flattenBindings } from "../core/flatten.js";
import { OCD_PREFIXES } from "../core/prefixes.js";
import { decodeHtml } from "../core/decode-html.js";
import { htmlEntityKeywordVariants } from "../core/html-entity-variants.js";
import { actHtmlUrl } from "../core/html-url.js";
import type { Tool } from "./types.js";

const inputSchema = z.object({
  legislature: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("Numero legislatura Camera"),
  type: z
    .string()
    .optional()
    .describe(
      "Filtro sul tipo di atto (match case-insensitive su dc:type). ATTENZIONE: dc:type ha un solo valore tra i progetti di legge — 'Progetto di Legge' vale su tutti i 3107 atti della leg. 19 — quindi NON discrimina ordinario/costituzionale né disegno/proposta: per quello usare 'natura'. type: 'costituzionale' dà 0 righe, non perché non esistano leggi costituzionali. L'unico altro valore nel grafo è 'Relazione' (5.996 atti, nessuno in leg. 19)",
    ),
  natura: z
    .string()
    .optional()
    .describe(
      "Filtro sulla natura dell'atto (match case-insensitive sul codice natura: 'costituzionale', 'ordinari', 'disegno', 'proposta'). Codici: disegno_legge_ordinario, proposta_legge_ordinaria, disegno_legge_costituzionale, proposta_legge_costituzionale",
    ),
  initiative: z
    .string()
    .optional()
    .describe("Filtro sull'iniziativa (match case-insensitive, es. 'Popolare', 'Governo', 'Parlamentare', 'Regioni')"),
  keyword: z
    .string()
    .optional()
    .describe("Cerca nel titolo del DDL (match case-insensitive, es. 'autonomia', 'lavoro')"),
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
    .describe("Se true, restituisce solo il numero totale di risultati (colonna count), utile per confronti senza scaricare le righe"),
  limit: z.number().int().min(1).max(1000).default(100),
  offset: z.number().int().nonnegative().default(0),
});

const columns = [
  "uri",
  "label",
  "title",
  "type",
  "natura",
  "date",
  "description",
  "initiative",
  "identifier",
  "legislature_uri",
  "sponsor_uri",
  "url",
  "html_url",
];

function sparqlEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Filtro sulla natura dell'atto, ancorato al **local name** dell'IRI.
 *
 * `?natura` è un IRI (`http://dati.camera.it/ocd/natura.rdf/disegno_legge_ordinario`):
 * un CONTAINS sullo `STR()` nudo batte anche sul percorso, quindi `--natura camera`
 * (o `rdf`, `http`, `natura.rdf`, `legge`) restituirebbe l'intero stock di atti —
 * indistinguibile, per il chiamante, da "nessun filtro". Lo STRAFTER isola il codice:
 * un valore non pertinente dà zero righe, che l'emptyHint sa spiegare.
 *
 * Tutti e 4 i valori del vocabolario condividono il prefisso `natura.rdf/`, quindi
 * lo STRAFTER non perde nulla; se un giorno comparisse un IRI con altra forma,
 * STRAFTER restituirebbe "" e quell'atto resterebbe fuori dal filtro (fallimento
 * visibile come zero righe, non come risultato gonfiato).
 */
export function buildNaturaFilter(natura: string): string {
  return `FILTER(CONTAINS(LCASE(STRAFTER(STR(?natura), "natura.rdf/")), LCASE("${sparqlEscape(natura)}")))`;
}

export const billsTool: Tool<typeof inputSchema> = {
  name: "bills",
  description:
    "[CAMERA] Lista disegni di legge (atti) della Camera dei Deputati. Filtrabile per legislatura, tipo, natura (costituzionale/ordinario, disegno/proposta), iniziativa (Popolare, Governo, Parlamentare, Regioni) e parola chiave nel titolo. Per i DDL del Senato usare bill-progress. Per ricostruire l'iter completo di un atto: prendi qui l'URI Camera, poi passa a bill-progress (--uri per la timeline Camera, --number+--branch S per agganciare il DDL Senato).",
  emptyHint:
    "Nessun atto trovato. Il --keyword è un match letterale sul titolo formale: prova il termine normativo o una radice più corta (2-3 varianti) prima di concludere che l'atto non esiste. Non inventare estremi dell'atto.",
  inputSchema,
  examples: [
    "italianparliament bills list --legislature 19 --limit 50",
    'italianparliament bills list --type "disegno di legge"',
    "italianparliament bills list --legislature 19 --natura costituzionale",
    "italianparliament bills list --legislature 19 --natura disegno --count-only",
    "italianparliament bills list --legislature 19 --initiative Popolare",
    "italianparliament bills list --legislature 19 --initiative Governo --limit 50",
    "italianparliament bills list --legislature 19 --keyword autonomia --limit 50",
    "italianparliament bills list --legislature 19 --date-from 2026-01-01 --limit 50",
    "italianparliament bills list --legislature 19 --date-from 2026-01-01 --date-to 2026-03-31 --format jsonl",
  ],
  async execute(input) {
    const legFilter =
      input.legislature !== undefined
        ? `FILTER(?rif_leg = <http://dati.camera.it/ocd/legislatura.rdf/repubblica_${input.legislature}>)`
        : "";
    const keywordFilter =
      input.keyword !== undefined
        ? `FILTER(${htmlEntityKeywordVariants(input.keyword)
            .map(
              (variant) =>
                `(CONTAINS(LCASE(STR(?label)), LCASE("${sparqlEscape(variant)}")) || CONTAINS(LCASE(STR(?title)), LCASE("${sparqlEscape(variant)}")))`,
            )
            .join(" || ")})`
        : "";
    const typeFilter =
      input.type !== undefined
        ? `FILTER(CONTAINS(LCASE(STR(?type)), LCASE("${sparqlEscape(input.type)}")))`
        : "";
    const naturaFilter =
      input.natura !== undefined ? buildNaturaFilter(input.natura) : "";
    const initiativeFilter =
      input.initiative !== undefined
        ? `FILTER(CONTAINS(LCASE(STR(?initiative)), LCASE("${sparqlEscape(input.initiative)}")))`
        : "";
    // STR() obbligatorio: Virtuoso non confronta il dc:date Camera (literal
    // YYYYMMDD) come stringa lessicografica senza STR() — con confronto nudo il
    // range restituisce risultati errati o vuoti silenziosi.
    const dateFromFilter = input.dateFrom
      ? `FILTER(STR(?date) >= "${input.dateFrom.replace(/-/g, "")}")`
      : "";
    const dateToFilter = input.dateTo
      ? `FILTER(STR(?date) <= "${input.dateTo.replace(/-/g, "")}")`
      : "";

    const coreSelect = `SELECT DISTINCT ?s ?label ?title ?type ?natura ?date ?description
                ?initiative ?identifier ?rif_leg ?sponsor_uri ?url
WHERE {
  ?s a <http://dati.camera.it/ocd/atto> .
  ?s rdfs:label ?label .
  OPTIONAL { ?s dc:title ?title }
  OPTIONAL { ?s dc:type ?type }
  OPTIONAL { ?s <http://dati.camera.it/ocd/rif_natura> ?natura }
  OPTIONAL { ?s dc:date ?date }
  OPTIONAL { ?s dc:description ?description }
  OPTIONAL { ?s <http://dati.camera.it/ocd/iniziativa> ?initiative }
  OPTIONAL { ?s dc:identifier ?identifier }
  OPTIONAL { ?s <http://dati.camera.it/ocd/rif_leg> ?rif_leg }
  OPTIONAL { ?s <http://dati.camera.it/ocd/primo_firmatario> ?sponsor_uri . FILTER(!isBlank(?sponsor_uri)) }
  OPTIONAL { ?s dcterms:isReferencedBy ?url }
  ${legFilter}
  ${keywordFilter}
  ${typeFilter}
  ${naturaFilter}
  ${initiativeFilter}
  ${dateFromFilter}
  ${dateToFilter}
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
      const { s, rif_leg, natura: naturaIri, ...rest } = r;
      const uri = s ?? "";
      const html_url = actHtmlUrl(uri);
      // riduci l'IRI natura al local name leggibile
      // (http://dati.camera.it/ocd/natura.rdf/disegno_legge_ordinario -> disegno_legge_ordinario)
      const natura = naturaIri ? String(naturaIri).replace(/^.*\//, "") : "";
      return {
        uri,
        legislature_uri: rif_leg ?? "",
        ...rest,
        natura,
        label: decodeHtml(rest.label ?? ""),
        title: decodeHtml(rest.title ?? ""),
        html_url,
      };
    });
    return { rows, columns };
  },
};
