import { z } from "zod";
import { snQuery } from "../core/client.js";
import { OSR_PREFIXES } from "../core/prefixes.js";
import { flattenBindings } from "../core/flatten.js";
import { personHtmlUrl } from "../core/html-url.js";
import type { Tool } from "./types.js";

const inputSchema = z.object({
  groupUri: z
    .string()
    .url()
    .optional()
    .describe("URI completo del gruppo parlamentare (es. http://dati.senato.it/gruppo/85)"),
  legislature: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Numero legislatura"),
  asOf: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Data di riferimento YYYY-MM-DD (default: oggi). Filtra i membri attivi in quella data."),
  limit: z.number().int().min(1).max(1000).default(200),
  offset: z.number().int().min(0).default(0),
});

const columns = [
  "senator_uri",
  "group_uri",
  "group_label",
  "group_html_url",
  "start_date",
  "end_date",
  "legislature",
  "html_url",
];

export const senatorGroupMembersTool: Tool<typeof inputSchema> = {
  name: "senator-group-members",
  description:
    "[SENATO] Membri di un gruppo parlamentare del Senato attivi in una data (default: oggi). Restituisce senatore, gruppo, date ingresso/uscita. Filtrabile per gruppo URI e legislatura.",
  inputSchema,
  examples: [
    "italianparliament senator-group-members list",
    "italianparliament senator-group-members list --as-of 2024-01-01",
    "italianparliament senator-group-members list --group-uri http://dati.senato.it/gruppo/85 --legislature 19",
    "italianparliament senator-group-members list --legislature 19 --format jsonl",
  ],
  async execute(input) {
    const asOf = input.asOf ?? new Date().toISOString().split("T")[0];
    const filters: string[] = [];

    if (input.groupUri) {
      filters.push(`FILTER(?group = <${input.groupUri}>)`);
    }
    if (input.legislature) {
      filters.push(`FILTER(?legislature = ${input.legislature})`);
    }

    const query = `${OSR_PREFIXES}
PREFIX ocd: <http://dati.camera.it/ocd/>
SELECT DISTINCT ?senator_uri ?group ?group_label ?start_date ?end_date ?legislature
WHERE {
  ?senator_uri a osr:Senatore ;
               ocd:aderisce ?membership .
  ?membership a ocd:adesioneGruppo ;
              osr:gruppo ?group ;
              osr:legislatura ?legislature ;
              osr:inizio ?start_date .
  OPTIONAL { ?membership osr:fine ?end_date }
  ?group osr:denominazione ?denom .
  ?denom osr:titolo ?group_label ;
         osr:inizio ?denom_inizio .
  OPTIONAL { ?denom osr:fine ?denom_fine }
  FILTER(str(?start_date) <= "${asOf}")
  FILTER(!BOUND(?end_date) || str(?end_date) >= "${asOf}")
  FILTER(str(?denom_inizio) <= "${asOf}")
  FILTER(!BOUND(?denom_fine) || str(?denom_fine) >= "${asOf}")
  ${filters.join("\n  ")}
}
ORDER BY ?group ?senator_uri
LIMIT ${input.limit}
OFFSET ${input.offset}`;

    const results = await snQuery(query);
    const raw = flattenBindings(results);
    const rows = raw.map((r) => {
      const group_uri = r.group ?? "";
      const idMatch = group_uri.match(/\/gruppo\/(\d+)$/);
      const group_html_url = idMatch
        ? `https://www.senato.it/composizione/gruppi-parlamentari/riepilogo-della-composizione/composizione?did=${idMatch[1]}`
        : "";
      return {
        senator_uri: r.senator_uri ?? "",
        group_uri,
        group_label: r.group_label ?? "",
        group_html_url,
        start_date: r.start_date ?? "",
        end_date: r.end_date ?? "",
        legislature: r.legislature ?? "",
        html_url: personHtmlUrl(r.senator_uri),
      };
    });
    return { rows, columns };
  },
};
