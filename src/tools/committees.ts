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
    .describe("Numero legislatura (mostra solo commissioni attive in quella legislatura)"),
  limit: z.number().int().min(1).max(1000).default(300),
});

const columns = [
  "uri",
  "title",
  "short_title",
  "subtitle",
  "session_count",
];

export const committeesTool: Tool<typeof inputSchema> = {
  name: "committees",
  description:
    "[SENATO] Commissioni del Senato della Repubblica (permanenti, speciali, d'inchiesta). Con filtro legislatura mostra solo le commissioni attive e il numero di sedute tenute.",
  inputSchema,
  examples: [
    "italianparliament committees list --legislature 19",
    "italianparliament committees list",
    "italianparliament committees list --format jsonl",
  ],
  async execute(input) {
    let query: string;
    if (input.legislature) {
      // Filter by legislature via SedutaCommissione, count sessions
      query = `${OSR_PREFIXES}
SELECT ?comm (MIN(?titoloBreve) AS ?titoloBreve) (COUNT(DISTINCT ?seduta) AS ?n_sedute)
WHERE {
  ?seduta a osr:SedutaCommissione .
  ?seduta osr:commissione ?comm .
  ?seduta osr:legislatura ${input.legislature} .
  ?comm osr:titoloBreve ?titoloBreve .
}
GROUP BY ?comm
ORDER BY DESC(?n_sedute)
LIMIT ${input.limit}`;
    } else {
      // All committees, no session count
      query = `${OSR_PREFIXES}
SELECT ?comm ?titolo ?titoloBreve ?sottotitolo
WHERE {
  ?comm a osr:Commissione .
  OPTIONAL { ?comm osr:titolo ?titolo }
  OPTIONAL { ?comm osr:titoloBreve ?titoloBreve }
  OPTIONAL { ?comm osr:sottotitolo ?sottotitolo }
}
ORDER BY ?titoloBreve
LIMIT ${input.limit}`;
    }

    const results = await snQuery(query);
    const raw = flattenBindings(results);
    const rows = raw.map((r) => ({
      uri: r.comm ?? "",
      title: r.titolo ?? "",
      short_title: r.titoloBreve ?? "",
      subtitle: r.sottotitolo ?? "",
      session_count: r.n_sedute ?? "",
    }));
    return { rows, columns };
  },
};
