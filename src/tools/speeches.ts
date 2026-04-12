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
    .describe("URI completo del deputato"),
  limit: z.number().int().min(1).max(1000).default(100),
  offset: z.number().int().min(0).default(0),
});

const columns = [
  "uri",
  "label",
  "deputy_uri",
  "document_url",
  "modified",
];

export const speechesTool: Tool<typeof inputSchema> = {
  name: "speeches",
  description:
    "[CAMERA] Interventi in aula della Camera dei Deputati con link al documento ufficiale (stenografico/bollettino). Filtrabile per legislatura e deputato.",
  inputSchema,
  examples: [
    "italianparliament speeches list --legislature 19 --limit 10",
    "italianparliament speeches list --deputy-uri http://dati.camera.it/ocd/deputato.rdf/d306921_17",
    "italianparliament speeches list --legislature 18 --format jsonl",
  ],
  async execute(input) {
    const filters: string[] = [];
    if (input.legislature) {
      filters.push(
        `FILTER(STRSTARTS(STR(?s), "http://dati.camera.it/ocd/intervento.rdf/in${input.legislature}_"))`,
      );
    }
    if (input.deputyUri) {
      filters.push(`?s ocd:rif_deputato <${input.deputyUri}> .`);
    }

    const query = `${OCD_PREFIXES}
SELECT DISTINCT ?s ?label ?rif_deputato ?relation ?modified
WHERE {
  ?s a ocd:intervento .
  ?s rdfs:label ?label .
  OPTIONAL { ?s ocd:rif_deputato ?rif_deputato }
  OPTIONAL { ?s dc:relation ?relation }
  OPTIONAL { ?s ods:modified ?modified }
  ${filters.join("\n  ")}
}
ORDER BY DESC(?modified)
LIMIT ${input.limit}
OFFSET ${input.offset}`;

    const results = await cdQuery(query);
    const raw = flattenBindings(results);
    const rows = raw.map((r) => ({
      uri: r.s ?? "",
      label: r.label ?? "",
      deputy_uri: r.rif_deputato ?? "",
      document_url: r.relation ?? "",
      modified: r.modified ?? "",
    }));
    return { rows, columns };
  },
};
