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
  "legislature_uri",
  "url",
  "html_url",
];

export const aicTool: Tool<typeof inputSchema> = {
  name: "aic",
  description:
    "[CAMERA] Atti di indirizzo e controllo: interrogazioni (orali, scritte, in commissione), interpellanze, mozioni. Filtrabile per legislatura, deputato (primo firmatario o cofirmatario).",
  inputSchema,
  examples: [
    "italianparliament aic list --legislature 19 --limit 10",
    "italianparliament aic list --deputy-uri http://dati.camera.it/ocd/deputato.rdf/d306921_17 --primary-only",
    "italianparliament aic list --legislature 19 --date-from 2026-01-01 --limit 50",
    "italianparliament aic list --legislature 19 --date-from 2026-01-01 --date-to 2026-03-31 --format jsonl",
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
    const dateFromFilter = input.dateFrom
      ? `FILTER(?date >= "${input.dateFrom.replace(/-/g, "")}")`
      : "";
    const dateToFilter = input.dateTo
      ? `FILTER(?date <= "${input.dateTo.replace(/-/g, "")}")`
      : "";

    const query = `${OCD_PREFIXES}
SELECT DISTINCT ?s ?label ?title ?type ?date ?identifier ?sponsor_uri ?rif_leg ?url
WHERE {
  ?s a ocd:aic .
  ?s rdfs:label ?label .
  ${signatoryPattern}
  OPTIONAL { ?s dc:title ?title }
  OPTIONAL { ?s dc:type ?type }
  OPTIONAL { ?s dc:date ?date }
  OPTIONAL { ?s dc:identifier ?identifier }
  OPTIONAL { ?s ocd:rif_leg ?rif_leg }
  OPTIONAL { ?s dcterms:isReferencedBy ?url }
  ${legFilter}
  ${dateFromFilter}
  ${dateToFilter}
}
ORDER BY DESC(?date)
LIMIT ${input.limit}
OFFSET ${input.offset}`;

    const results = await cdQuery(query);
    const raw = flattenBindings(results);
    const rows = raw.map((r) => {
      const uri = r.s ?? "";
      const m = uri.match(/aic(\d+)_(\d+)_(\d+)$/);
      const html_url = m
        ? `https://aic.camera.it/aic/scheda.html?core=aic&numero=${m[1]}/${m[2]}&ramo=CAMERA&leg=${m[3]}`
        : "";
      return {
        uri,
        label: r.label ?? "",
        title: r.title ?? "",
        type: r.type ?? "",
        date: r.date ?? "",
        identifier: r.identifier ?? "",
        sponsor_uri: r.sponsor_uri ?? "",
        legislature_uri: r.rif_leg ?? "",
        url: r.url ?? "",
        html_url,
      };
    });
    return { rows, columns };
  },
};
