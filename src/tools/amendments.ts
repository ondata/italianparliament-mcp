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
  limit: z.number().int().min(1).max(1000).default(100),
  offset: z.number().int().min(0).default(0),
});

const columns = [
  "uri",
  "label",
  "number",
  "type",
  "legislature",
  "url",
];

export const amendmentsTool: Tool<typeof inputSchema> = {
  name: "amendments",
  description:
    "[SENATO] Emendamenti presentati al Senato con numero, tipo e link al testo ufficiale. Filtrabile per legislatura.",
  inputSchema,
  examples: [
    "italianparliament amendments list --legislature 19 --limit 20",
    "italianparliament amendments list --legislature 18 --format jsonl",
  ],
  async execute(input) {
    const legFilter = input.legislature
      ? `?s osr:legislatura ${input.legislature} .`
      : "";

    const query = `${OSR_PREFIXES}
SELECT ?s ?label ?numero ?tipo ?legislatura ?url
WHERE {
  ?s a osr:Emendamento .
  OPTIONAL { ?s rdfs:label ?label }
  OPTIONAL { ?s osr:numero ?numero }
  OPTIONAL { ?s osr:tipo ?tipo }
  OPTIONAL { ?s osr:legislatura ?legislatura }
  OPTIONAL { ?s osr:URLTesto ?url }
  ${legFilter}
}
LIMIT ${input.limit}
OFFSET ${input.offset}`;

    const results = await snQuery(query);
    const raw = flattenBindings(results);
    const rows = raw.map((r) => ({
      uri: r.s ?? "",
      label: r.label ?? "",
      number: r.numero ?? "",
      type: r.tipo ?? "",
      legislature: r.legislatura ?? "",
      url: r.url ?? "",
    }));
    return { rows, columns };
  },
};
