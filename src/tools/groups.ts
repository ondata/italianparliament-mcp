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
});

const columns = ["uri", "label", "title", "acronym", "legislature_uri", "html_url"];

export const groupsTool: Tool<typeof inputSchema> = {
  name: "groups",
  description:
    "[CAMERA] Gruppi parlamentari della Camera dei Deputati con acronimo (es. FDI, PD-IDP, M5S). Filtrabile per legislatura.",
  inputSchema,
  examples: [
    "italianparliament groups list --legislature 19",
    "italianparliament groups list --limit 200",
    "italianparliament groups list --legislature 18 --format jsonl",
  ],
  async execute(input) {
    const legFilter =
      input.legislature !== undefined
        ? `FILTER(?rif_leg = <http://dati.camera.it/ocd/legislatura.rdf/repubblica_${input.legislature}>)`
        : "";

    const query = `${OCD_PREFIXES}
SELECT DISTINCT ?s ?label ?title ?acronym ?rif_leg
WHERE {
  ?s a <http://dati.camera.it/ocd/gruppoParlamentare> .
  ?s rdfs:label ?label .
  OPTIONAL { ?s dc:title ?title }
  OPTIONAL { ?s dcterms:alternative ?acronym }
  OPTIONAL { ?s <http://dati.camera.it/ocd/rif_leg> ?rif_leg }
  ${legFilter}
}
LIMIT ${input.limit}`;

    const results = await cdQuery(query);
    const raw = flattenBindings(results);
    const rows = raw.map((r) => {
      const label = r.label ?? "";
      // Extract acronym from label, e.g. "FRATELLI D'ITALIA (FDI) (18.10.2022" -> "FDI"
      // Handles nested parens like "NM(N-C-U-I)M-CP"
      const acronymMatch = label.match(/\(([A-Z][A-Z0-9 /(),-]*)\)\s*\(/);
      const acronym = r.acronym || (acronymMatch ? acronymMatch[1] : "");
      const uriStr = r.s ?? "";
      const idMatch = uriStr.match(/\/gr(\d+)$/);
      const html_url = idMatch
        ? `https://www.camera.it/leg19/217?idlegislatura=19&shadow_gruppi_parlamentari=${idMatch[1]}`
        : "";
      return {
        uri: uriStr,
        label,
        title: r.title ?? "",
        acronym,
        legislature_uri: r.rif_leg ?? "",
        html_url,
      };
    });
    return { rows, columns };
  },
};
