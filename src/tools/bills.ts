import { z } from "zod";
import { cdQuery } from "../core/client.js";
import { flattenBindings } from "../core/flatten.js";
import { OCD_PREFIXES } from "../core/prefixes.js";
import { decodeHtml } from "../core/decode-html.js";
import type { Tool } from "./types.js";

const inputSchema = z.object({
  legislature: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Numero legislatura Camera"),
  type: z
    .string()
    .optional()
    .describe("Filtro sul tipo di atto (match case-insensitive)"),
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
  limit: z.number().int().positive().max(1000).default(100),
  offset: z.number().int().nonnegative().default(0),
});

const columns = [
  "uri",
  "label",
  "title",
  "type",
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

export const billsTool: Tool<typeof inputSchema> = {
  name: "bills",
  description:
    "[CAMERA] Lista disegni di legge (atti) della Camera dei Deputati. Filtrabile per legislatura e tipo. Per i DDL del Senato usare bill-progress.",
  inputSchema,
  examples: [
    "italianparliament bills list --legislature 19 --limit 50",
    'italianparliament bills list --type "disegno di legge"',
    "italianparliament bills list --legislature 19 --date-from 2026-01-01 --limit 50",
    "italianparliament bills list --legislature 19 --date-from 2026-01-01 --date-to 2026-03-31 --format jsonl",
  ],
  async execute(input) {
    const legFilter =
      input.legislature !== undefined
        ? `FILTER(?rif_leg = <http://dati.camera.it/ocd/legislatura.rdf/repubblica_${input.legislature}>)`
        : "";
    const typeFilter =
      input.type !== undefined
        ? `FILTER(CONTAINS(LCASE(STR(?type)), LCASE("${sparqlEscape(input.type)}")))`
        : "";
    const dateFromFilter = input.dateFrom
      ? `FILTER(?date >= "${input.dateFrom.replace(/-/g, "")}")`
      : "";
    const dateToFilter = input.dateTo
      ? `FILTER(?date <= "${input.dateTo.replace(/-/g, "")}")`
      : "";

    const query = `${OCD_PREFIXES}
SELECT DISTINCT ?s ?label ?title ?type ?date ?description
                ?initiative ?identifier ?rif_leg ?sponsor_uri ?url
WHERE {
  ?s a <http://dati.camera.it/ocd/atto> .
  ?s rdfs:label ?label .
  OPTIONAL { ?s dc:title ?title }
  OPTIONAL { ?s dc:type ?type }
  OPTIONAL { ?s dc:date ?date }
  OPTIONAL { ?s dc:description ?description }
  OPTIONAL { ?s <http://dati.camera.it/ocd/iniziativa> ?initiative }
  OPTIONAL { ?s dc:identifier ?identifier }
  OPTIONAL { ?s <http://dati.camera.it/ocd/rif_leg> ?rif_leg }
  OPTIONAL { ?s <http://dati.camera.it/ocd/primo_firmatario> ?sponsor_uri . FILTER(!isBlank(?sponsor_uri)) }
  OPTIONAL { ?s dcterms:isReferencedBy ?url }
  ${legFilter}
  ${typeFilter}
  ${dateFromFilter}
  ${dateToFilter}
}
ORDER BY DESC(?date)
LIMIT ${input.limit}
OFFSET ${input.offset}`;

    const results = await cdQuery(query);
    const raw = flattenBindings(results);
    const rows = raw.map((r) => {
      const { s, rif_leg, ...rest } = r;
      const uri = s ?? "";
      const m = uri.match(/ac(\d+)_(\d+)$/);
      const html_url = m
        ? `https://www.camera.it/leg19/126?leg=${m[1]}&idDocumento=${m[2]}`
        : "";
      return {
        uri,
        legislature_uri: rif_leg ?? "",
        ...rest,
        label: decodeHtml(rest.label ?? ""),
        title: decodeHtml(rest.title ?? ""),
        html_url,
      };
    });
    return { rows, columns };
  },
};
