import { z } from "zod";
import { snQuery } from "../core/client.js";
import { OSR_PREFIXES } from "../core/prefixes.js";
import { flattenBindings } from "../core/flatten.js";
import type { Tool } from "./types.js";

const inputSchema = z.object({
  ddlUri: z
    .string()
    .url()
    .describe("URI del DDL Senato (es. http://dati.senato.it/ddl/25597)"),
  limit: z.number().int().min(1).max(1000).default(100),
});

const columns = [
  "initiative_uri",
  "label",
  "presenter",
  "senator_uri",
  "type",
  "is_primary",
];

export const billSignatoriesTool: Tool<typeof inputSchema> = {
  name: "bill-signatories",
  description:
    "[SENATO] Firmatari di un DDL al Senato: primo firmatario e cofirmatari con nome e link al profilo senatore. Richiede l'URI del DDL (ottenibile da bill-progress).",
  inputSchema,
  examples: [
    "italianparliament bill-signatories show --ddl-uri http://dati.senato.it/ddl/25597",
    "italianparliament bill-signatories show --ddl-uri http://dati.senato.it/ddl/25597 --format jsonl",
  ],
  async execute(input) {
    const query = `${OSR_PREFIXES}
SELECT ?init ?label ?presentatore ?senatore ?tipoIniziativa ?primoFirmatario
WHERE {
  <${input.ddlUri}> osr:iniziativa ?init .
  ?init rdfs:label ?label .
  OPTIONAL { ?init osr:presentatore ?presentatore }
  OPTIONAL { ?init osr:senatore ?senatore }
  OPTIONAL { ?init osr:tipoIniziativa ?tipoIniziativa }
  OPTIONAL { ?init osr:primoFirmatario ?primoFirmatario }
}
LIMIT ${input.limit}`;

    const results = await snQuery(query);
    const raw = flattenBindings(results);
    const rows = raw.map((r) => ({
      initiative_uri: r.init ?? "",
      label: r.label ?? "",
      presenter: r.presentatore ?? "",
      senator_uri: r.senatore ?? "",
      type: r.tipoIniziativa ?? "",
      is_primary: r.primoFirmatario === "1" ? "true" : "false",
    }));
    return { rows, columns };
  },
};
