import { z } from "zod";
import { snQuery } from "../core/client.js";
import { OSR_PREFIXES } from "../core/prefixes.js";
import { flattenBindings } from "../core/flatten.js";
import type { Tool } from "./types.js";

const inputSchema = z.object({
  legislature: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Numero legislatura"),
  type: z
    .string()
    .optional()
    .describe("Filtro sul tipo di documento (match case-insensitive, es. 'Atto del Governo')"),
  limit: z.number().int().min(1).max(1000).default(100),
  offset: z.number().int().min(0).default(0),
});

const columns = [
  "uri",
  "title",
  "type",
  "status",
  "presentation_date",
  "number",
  "legislature",
  "url",
];

export const documentsTool: Tool<typeof inputSchema> = {
  name: "documents",
  description:
    "[SENATO] Documenti parlamentari del Senato: atti del governo sottoposti a parere, atti dell'Unione Europea, relazioni della Corte dei Conti, risoluzioni delle commissioni. Filtrabile per legislatura e tipo documento.",
  inputSchema,
  examples: [
    "italianparliament documents list --legislature 19 --limit 20",
    "italianparliament documents list --legislature 19 --type 'Atto del Governo'",
    "italianparliament documents list --legislature 19 --format jsonl",
  ],
  async execute(input) {
    const filters: string[] = [];
    if (input.legislature) {
      filters.push(`?s osr:legislatura ${input.legislature} .`);
    }
    if (input.type) {
      filters.push(
        `FILTER(CONTAINS(LCASE(?tipoDoc), "${input.type.toLowerCase()}"))`,
      );
    }

    const query = `${OSR_PREFIXES}
PREFIX dc: <http://purl.org/dc/elements/1.1/>
SELECT ?s ?titolo ?tipoDoc ?statoDoc ?dataPresentazione ?numeroDoc ?legislatura ?url
WHERE {
  ?s a osr:Documento .
  OPTIONAL { ?s osr:titolo ?titolo }
  OPTIONAL { ?s osr:tipoDoc ?tipoDoc }
  OPTIONAL { ?s osr:statoDoc ?statoDoc }
  OPTIONAL { ?s osr:dataPresentazione ?dataPresentazione }
  OPTIONAL { ?s osr:numeroDoc ?numeroDoc }
  OPTIONAL { ?s osr:legislatura ?legislatura }
  OPTIONAL { ?s osr:URLTesto ?url }
  ${filters.join("\n  ")}
}
ORDER BY DESC(?dataPresentazione)
LIMIT ${input.limit}
OFFSET ${input.offset}`;

    const results = await snQuery(query);
    const raw = flattenBindings(results);
    const rows = raw.map((r) => ({
      uri: r.s ?? "",
      title: r.titolo ?? "",
      type: r.tipoDoc ?? "",
      status: r.statoDoc ?? "",
      presentation_date: r.dataPresentazione ?? "",
      number: r.numeroDoc ?? "",
      legislature: r.legislatura ?? "",
      url: r.url ?? "",
    }));
    return { rows, columns };
  },
};
