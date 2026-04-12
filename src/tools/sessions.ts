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
    .describe("Numero legislatura Camera (es. 19)"),
  limit: z.number().int().positive().max(1000).default(100),
  offset: z.number().int().nonnegative().default(0),
});

const columns = ["uri", "label", "date", "number", "legislature_uri"];

export const sessionsTool: Tool<typeof inputSchema> = {
  name: "sessions",
  description:
    "[CAMERA] Sedute della Camera dei Deputati con numero progressivo e data, ordinate dalla piu recente. Filtrabile per legislatura.",
  inputSchema,
  examples: [
    "italianparliament sessions list --legislature 19 --limit 50",
    "italianparliament sessions list --legislature 18 --offset 100",
    "italianparliament sessions list --format jsonl",
  ],
  async execute(input) {
    const legFilter =
      input.legislature !== undefined
        ? `FILTER(?rif_leg = <http://dati.camera.it/ocd/legislatura.rdf/repubblica_${input.legislature}>)`
        : "";

    const query = `${OCD_PREFIXES}
SELECT DISTINCT ?s ?label ?date ?number ?rif_leg
WHERE {
  ?s a <http://dati.camera.it/ocd/seduta> .
  ?s rdfs:label ?label .
  FILTER(STRSTARTS(STR(?s), "http://dati.camera.it/ocd/seduta.rdf/s"))
  OPTIONAL { ?s dc:date ?date }
  OPTIONAL { ?s dc:identifier ?number }
  OPTIONAL { ?s <http://dati.camera.it/ocd/rif_leg> ?rif_leg }
  ${legFilter}
}
ORDER BY DESC(?date)
LIMIT ${input.limit}
OFFSET ${input.offset}`;

    const results = await cdQuery(query);
    const raw = flattenBindings(results);
    const rows = raw.map((r) => {
      const { s, rif_leg, ...rest } = r;
      return { uri: s ?? "", legislature_uri: rif_leg ?? "", ...rest };
    });
    return { rows, columns };
  },
};
