import { z } from "zod";
import { cdQuery } from "../core/client.js";
import { flattenBindings } from "../core/flatten.js";
import { OCD_PREFIXES } from "../core/prefixes.js";
import type { Tool } from "./types.js";

const inputSchema = z.object({});

const columns = ["uri", "label", "title", "date"];

export const legislaturesTool: Tool<typeof inputSchema> = {
  name: "legislatures",
  description:
    "[CAMERA] Elenco di tutte le legislature della Camera dei Deputati, dal Regno d'Italia (1848) alla Repubblica (XIX legislatura in corso). Include date inizio/fine.",
  inputSchema,
  examples: [
    "italianparliament legislatures list",
    "italianparliament legislatures list --format jsonl",
  ],
  async execute() {
    const query = `${OCD_PREFIXES}
SELECT DISTINCT ?s ?label ?title ?date
WHERE {
  ?s a <http://dati.camera.it/ocd/legislatura> .
  ?s rdfs:label ?label .
  OPTIONAL { ?s dc:title ?title }
  OPTIONAL { ?s dc:date ?date }
}
ORDER BY ?date`;

    const results = await cdQuery(query);
    const raw = flattenBindings(results);
    const rows = raw.map((r) => {
      const { s, ...rest } = r;
      return { uri: s ?? "", ...rest };
    });
    return { rows, columns };
  },
};
