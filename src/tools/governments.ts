import { z } from "zod";
import { cdQuery } from "../core/client.js";
import { flattenBindings } from "../core/flatten.js";
import { OCD_PREFIXES } from "../core/prefixes.js";
import type { Tool } from "./types.js";

const inputSchema = z.object({
  legislature: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Numero legislatura Camera (es. 18)"),
  limit: z.number().int().positive().max(1000).default(100),
  offset: z.number().int().nonnegative().default(0),
});

const columns = ["uri", "label", "start_date", "legislature_uri"];

export const governmentsTool: Tool<typeof inputSchema> = {
  name: "governments",
  description:
    "[CAMERA] Governi italiani dal piu recente (Meloni, Draghi, Conte...) con data inizio. Filtrabile per legislatura. Per i membri del governo usare gov-members.",
  inputSchema,
  examples: [
    "italianparliament governments list",
    "italianparliament governments list --legislature 18",
    "italianparliament governments list --format jsonl",
  ],
  async execute(input) {
    const legFilter =
      input.legislature !== undefined
        ? `?s ocd:rif_leg <http://dati.camera.it/ocd/legislatura.rdf/repubblica_${input.legislature}> .`
        : "";

    const query = `${OCD_PREFIXES}
SELECT DISTINCT ?s ?label ?date ?rif_leg
WHERE {
  ?s a ocd:governo .
  ?s rdfs:label ?label .
  OPTIONAL { ?s dc:date ?date }
  OPTIONAL { ?s ocd:rif_leg ?rif_leg }
  ${legFilter}
}
ORDER BY DESC(?date)
LIMIT ${input.limit}
OFFSET ${input.offset}`;

    const results = await cdQuery(query);
    const raw = flattenBindings(results);
    const rows = raw.map((r) => ({
      uri: r.s ?? "",
      label: r.label ?? "",
      start_date: r.date ?? "",
      legislature_uri: r.rif_leg ?? "",
    }));
    return { rows, columns };
  },
};
