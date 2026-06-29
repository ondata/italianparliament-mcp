import { z } from "zod";
import { snQuery } from "../core/client.js";
import { flattenBindings } from "../core/flatten.js";
import { OSR_PREFIXES } from "../core/prefixes.js";
import { personHtmlUrl } from "../core/html-url.js";
import type { Tool } from "./types.js";

const inputSchema = z.object({
  legislature: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Numero legislatura Senato (es. 19)"),
  activeOnly: z
    .boolean()
    .optional()
    .describe("Solo senatori in carica (default: true se nessuna legislatura)"),
  limit: z.number().int().positive().max(1000).default(300),
  offset: z.number().int().nonnegative().default(0),
});

const columns = [
  "uri",
  "first_name",
  "last_name",
  "legislature",
  "mandate_start",
  "mandate_end",
  "mandate_type",
  "mandate_termination_reason",
  "election_type",
  "election_region",
  "gender",
  "birth_date",
  "birth_city",
  "photo",
  "html_url",
];

const COL_MAP: Record<string, string> = {
  s: "uri",
  fn: "first_name",
  ln: "last_name",
  leg: "legislature",
  ms: "mandate_start",
  me: "mandate_end",
  mt: "mandate_type",
  tfm: "mandate_termination_reason",
  te: "election_type",
  re: "election_region",
  gen: "gender",
  dob: "birth_date",
  bc: "birth_city",
  pic: "photo",
};

export const senatorsTool: Tool<typeof inputSchema> = {
  name: "senators",
  description:
    "[SENATO] Lista senatori del Senato della Repubblica. Filtrabile per legislatura o solo in carica. Restituisce nome, cognome, genere, data/luogo nascita, foto.",
  inputSchema,
  examples: [
    "italianparliament senators list --legislature 19",
    "italianparliament senators list --active-only",
    "italianparliament senators list --limit 500 --format jsonl",
  ],
  async execute(input) {
    const activeOnly =
      input.activeOnly ?? input.legislature === undefined;
    const legFilter =
      input.legislature !== undefined
        ? `FILTER(?leg=${input.legislature})`
        : "";
    const activeFilter = activeOnly ? "FILTER(!bound(?me))" : "";

    const query = `${OSR_PREFIXES}
SELECT DISTINCT ?s ?fn ?ln ?leg ?ms ?me ?mt ?tfm ?te ?re ?gen ?dob ?bc ?pic
WHERE {
  ?s a osr:Senatore .
  ?s <http://xmlns.com/foaf/0.1/firstName> ?fn .
  ?s <http://xmlns.com/foaf/0.1/lastName> ?ln .
  ?s osr:mandato ?m .
  ?m osr:legislatura ?leg .
  ?m osr:inizio ?ms .
  ?m osr:tipoMandato ?mt .
  OPTIONAL { ?m osr:fine ?me }
  OPTIONAL { ?m osr:tipoFineMandato ?tfm }
  OPTIONAL { ?m osr:tipoElezione ?te }
  OPTIONAL { ?m osr:regioneElezione ?re }
  OPTIONAL { ?s <http://xmlns.com/foaf/0.1/gender> ?gen }
  OPTIONAL { ?s osr:dataNascita ?dob }
  OPTIONAL { ?s osr:cittaNascita ?bc }
  OPTIONAL { ?s <http://xmlns.com/foaf/0.1/depiction> ?pic }
  ${legFilter}
  ${activeFilter}
}
ORDER BY ?ln ?fn
LIMIT ${input.limit} OFFSET ${input.offset}`;

    const results = await snQuery(query);
    const raw = flattenBindings(results);
    const rows = raw.map((r) => {
      const row: Record<string, string> = {};
      for (const [k, v] of Object.entries(r)) {
        row[COL_MAP[k] ?? k] = v;
      }
      row.html_url = personHtmlUrl(row.uri);
      return row;
    });
    return { rows, columns };
  },
};
