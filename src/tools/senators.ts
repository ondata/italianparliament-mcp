import { z } from "zod";
import { snQuery } from "../core/client.js";
import { flattenBindings } from "../core/flatten.js";
import { OSR_PREFIXES } from "../core/prefixes.js";
import { personHtmlUrl } from "../core/html-url.js";
import { regionFromProvince } from "../core/province-region.js";
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
  gender: z
    .enum(["male", "female"])
    .optional()
    .describe("Filtra per genere: 'male' o 'female'"),
  bornFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Nati dal (YYYY-MM-DD, incluso)"),
  bornTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Nati fino al (YYYY-MM-DD, incluso)"),
  birthPlace: z
    .string()
    .optional()
    .describe(
      "Filtra per città di nascita (match case-insensitive, es. 'rovigo'). Provincia, nazione e regione di nascita sono restituite come colonne (birth_province, birth_country, birth_region): per filtrarle usa una pipeline (es. jq).",
    ),
  limit: z.number().int().positive().max(1000).default(300),
  offset: z.number().int().nonnegative().default(0),
});

const sparqlEsc = (s: string): string => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

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
  "birth_province",
  "birth_country",
  "birth_region",
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
  bp: "birth_province",
  bn: "birth_country",
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
    "italianparliament senators list --legislature 19 --gender female",
    "italianparliament senators list --legislature 19 --born-from 1980-01-01 --format jsonl",
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

    // Genere Senato: valori F/M (Camera usa female/male). dataNascita è YYYY-MM-DD,
    // confronto lessicografico via STR(). Il Senato espone anche provincia
    // (osr:provinciaNascita) e nazione (osr:nazioneNascita) di nascita; la
    // regione è derivata dalla provincia via province-region.ts.
    const demoFilters = [
      input.gender ? `FILTER(STR(?gen) = "${input.gender === "female" ? "F" : "M"}")` : "",
      input.bornFrom ? `FILTER(STR(?dob) >= "${input.bornFrom}")` : "",
      input.bornTo ? `FILTER(STR(?dob) <= "${input.bornTo}")` : "",
      input.birthPlace ? `FILTER(CONTAINS(LCASE(STR(?bc)), LCASE("${sparqlEsc(input.birthPlace)}")))` : "",
    ]
      .filter(Boolean)
      .join("\n  ");

    const query = `${OSR_PREFIXES}
SELECT DISTINCT ?s ?fn ?ln ?leg ?ms ?me ?mt ?tfm ?te ?re ?gen ?dob ?bc ?bp ?bn ?pic
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
  OPTIONAL { ?s osr:provinciaNascita ?bp }
  OPTIONAL { ?s osr:nazioneNascita ?bn }
  OPTIONAL { ?s <http://xmlns.com/foaf/0.1/depiction> ?pic }
  ${legFilter}
  ${activeFilter}
  ${demoFilters}
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
      row.birth_region = regionFromProvince(row.birth_province);
      return row;
    });
    return { rows, columns };
  },
};
