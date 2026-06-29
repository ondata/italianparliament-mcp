import { z } from "zod";
import { cdQuery } from "../core/client.js";
import { OCD_PREFIXES } from "../core/prefixes.js";
import { flattenBindings } from "../core/flatten.js";
import { cleanGroupLabel } from "../core/group-label.js";
import { personHtmlUrl } from "../core/html-url.js";
import type { Tool } from "./types.js";

const inputSchema = z.object({
  groupUri: z
    .string()
    .url()
    .optional()
    .describe("URI completo del gruppo parlamentare"),
  deputyUri: z
    .string()
    .url()
    .optional()
    .describe("URI completo del deputato — restituisce tutti i gruppi in cui e stato iscritto"),
  legislature: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Numero legislatura"),
  limit: z.number().int().min(1).max(1000).default(200),
  offset: z.number().int().min(0).default(0),
});

const columns = [
  "group_uri",
  "group_label",
  "deputy_uri",
  "start_date",
  "end_date",
  "legislature_uri",
  "html_url",
];

export const groupMembersTool: Tool<typeof inputSchema> = {
  name: "group-members",
  description:
    "[CAMERA] Membri di un gruppo parlamentare della Camera: chi ne fa parte, data inizio/fine. Filtrabile per gruppo, deputato e legislatura. Con deputato URI restituisce la storia dei cambi di gruppo.",
  inputSchema,
  examples: [
    "italianparliament group-members list --legislature 19 --limit 50",
    "italianparliament group-members list --group-uri http://dati.camera.it/ocd/gruppoParlamentare.rdf/gp19_1 --format jsonl",
    "italianparliament group-members list --deputy-uri http://dati.camera.it/ocd/deputato.rdf/d308001_19",
    "italianparliament group-members list --legislature 18",
  ],
  async execute(input) {
    const filters: string[] = [];
    if (input.groupUri) {
      filters.push(`FILTER(?group = <${input.groupUri}>)`);
    }
    if (input.deputyUri) {
      filters.push(`FILTER(?deputy_uri = <${input.deputyUri}>)`);
    }
    if (input.legislature) {
      filters.push(
        `?group ocd:rif_leg <http://dati.camera.it/ocd/legislatura.rdf/repubblica_${input.legislature}> .`,
      );
    }

    const query = `${OCD_PREFIXES}
SELECT DISTINCT ?group ?group_label ?deputy_uri ?start_date ?end_date ?rif_leg
WHERE {
  ?group a ocd:gruppoParlamentare .
  ?group rdfs:label ?group_label .
  ?group ocd:siComponeDi ?membership .
  ?membership ocd:rif_deputato ?deputy_uri .
  OPTIONAL { ?membership dc:date ?start_date }
  OPTIONAL { ?membership ocd:dataFine ?end_date }
  OPTIONAL { ?group ocd:rif_leg ?rif_leg }
  ${filters.join("\n  ")}
}
ORDER BY ?deputy_uri ?start_date
LIMIT ${input.limit}
OFFSET ${input.offset}`;

    const results = await cdQuery(query);
    const raw = flattenBindings(results);
    const rows = raw.map((r) => {
      // dc:date contains "YYYYMMDD-YYYYMMDD" (start-end concatenated) or "YYYYMMDD-" (no end)
      const raw_date = r.start_date ?? "";
      const parts = raw_date.split("-");
      const start = parts[0] ?? "";
      const end = r.end_date || parts[1] || "";
      return {
        group_uri: r.group ?? "",
        group_label: cleanGroupLabel(r.group_label ?? ""),
        deputy_uri: r.deputy_uri ?? "",
        start_date: start,
        end_date: end,
        legislature_uri: r.rif_leg ?? "",
        html_url: personHtmlUrl(r.deputy_uri),
      };
    });
    return { rows, columns };
  },
};
