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
    .describe("Numero legislatura Camera"),
  approved: z
    .boolean()
    .optional()
    .describe("Filtra per votazioni approvate (true) o non approvate (false)"),
  confidenceVote: z
    .boolean()
    .optional()
    .describe("Filtra per votazioni di fiducia (true) o ordinarie (false)"),
  keyword: z
    .string()
    .optional()
    .describe("Cerca nel titolo della votazione (match case-insensitive, es. 'fiducia', 'bilancio')"),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Data inizio (YYYY-MM-DD)"),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Data fine (YYYY-MM-DD)"),
  limit: z.number().int().positive().max(1000).default(100),
  offset: z.number().int().nonnegative().default(0),
});

const columns = [
  "uri",
  "label",
  "title",
  "type",
  "date",
  "approved",
  "in_favour",
  "against",
  "abstentions",
  "present",
  "voters",
  "quorum",
  "confidence_vote",
  "secret_vote",
  "final_vote",
  "legislature_uri",
  "session_uri",
  "bill_uri",
  "url",
];

const COL_MAP: Record<string, string> = {
  s: "uri",
  approvato: "approved",
  favorevoli: "in_favour",
  contrari: "against",
  astenuti: "abstentions",
  presenti: "present",
  votanti: "voters",
  maggioranza: "quorum",
  richiestaFiducia: "confidence_vote",
  votazioneSegreta: "secret_vote",
  votazioneFinale: "final_vote",
  rif_leg: "legislature_uri",
  rif_seduta: "session_uri",
  rif_attoCamera: "bill_uri",
};

const BOOL_COLS = new Set([
  "approved",
  "confidence_vote",
  "secret_vote",
  "final_vote",
]);

export const votesTool: Tool<typeof inputSchema> = {
  name: "votes",
  description:
    "[CAMERA] Lista votazioni della Camera dei Deputati con contatori (favorevoli, contrari, astenuti), esito, tipo, seduta, atto collegato. Filtrabile per parola chiave nel titolo.",
  inputSchema,
  examples: [
    "italianparliament votes list --legislature 19 --limit 50",
    "italianparliament votes list --approved true",
    "italianparliament votes list --legislature 19 --keyword bilancio --limit 50",
    "italianparliament votes list --legislature 19 --date-from 2026-01-01 --limit 50",
    "italianparliament votes list --legislature 19 --date-from 2026-01-01 --date-to 2026-03-31 --format jsonl",
  ],
  async execute(input) {
    const legFilter =
      input.legislature !== undefined
        ? `FILTER(?rif_leg = <http://dati.camera.it/ocd/legislatura.rdf/repubblica_${input.legislature}>)`
        : "";
    const approvedFilter =
      input.approved !== undefined
        ? `FILTER(?approvato = "${input.approved ? 1 : 0}"^^xsd:integer)`
        : "";
    const confidenceFilter =
      input.confidenceVote !== undefined
        ? `FILTER(?richiestaFiducia = "${input.confidenceVote ? 1 : 0}"^^xsd:integer)`
        : "";
    const keywordEsc = input.keyword !== undefined
      ? input.keyword.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
      : "";
    const keywordFilter =
      input.keyword !== undefined
        ? `FILTER(CONTAINS(LCASE(STR(?label)), LCASE("${keywordEsc}")) || CONTAINS(LCASE(STR(?title)), LCASE("${keywordEsc}")))`
        : "";
    const dateFromFilter = input.dateFrom
      ? `FILTER(?date >= "${input.dateFrom.replace(/-/g, "")}")`
      : "";
    const dateToFilter = input.dateTo
      ? `FILTER(?date <= "${input.dateTo.replace(/-/g, "")}")`
      : "";

    const query = `${OCD_PREFIXES}
SELECT DISTINCT ?s ?label ?title ?type ?date
                ?approvato ?favorevoli ?contrari ?astenuti
                ?presenti ?votanti ?maggioranza
                ?richiestaFiducia ?votazioneSegreta ?votazioneFinale
                ?rif_leg ?rif_seduta ?rif_attoCamera ?url
WHERE {
  ?s a <http://dati.camera.it/ocd/votazione> .
  ?s rdfs:label ?label .
  OPTIONAL { ?s dc:title ?title }
  OPTIONAL { ?s dc:type ?type }
  OPTIONAL { ?s dc:date ?date }
  OPTIONAL { ?s <http://dati.camera.it/ocd/approvato> ?approvato }
  OPTIONAL { ?s <http://dati.camera.it/ocd/favorevoli> ?favorevoli }
  OPTIONAL { ?s <http://dati.camera.it/ocd/contrari> ?contrari }
  OPTIONAL { ?s <http://dati.camera.it/ocd/astenuti> ?astenuti }
  OPTIONAL { ?s <http://dati.camera.it/ocd/presenti> ?presenti }
  OPTIONAL { ?s <http://dati.camera.it/ocd/votanti> ?votanti }
  OPTIONAL { ?s <http://dati.camera.it/ocd/maggioranza> ?maggioranza }
  OPTIONAL { ?s <http://dati.camera.it/ocd/richiestaFiducia> ?richiestaFiducia }
  OPTIONAL { ?s <http://dati.camera.it/ocd/votazioneSegreta> ?votazioneSegreta }
  OPTIONAL { ?s <http://dati.camera.it/ocd/votazioneFinale> ?votazioneFinale }
  OPTIONAL { ?s <http://dati.camera.it/ocd/rif_leg> ?rif_leg }
  OPTIONAL { ?s <http://dati.camera.it/ocd/rif_seduta> ?rif_seduta }
  OPTIONAL { ?s <http://dati.camera.it/ocd/rif_attoCamera> ?rif_attoCamera }
  OPTIONAL { ?s dc:relation ?url }
  ${legFilter}
  ${approvedFilter}
  ${confidenceFilter}
  ${keywordFilter}
  ${dateFromFilter}
  ${dateToFilter}
}
ORDER BY DESC(?date)
LIMIT ${input.limit}
OFFSET ${input.offset}`;

    const results = await cdQuery(query);
    const raw = flattenBindings(results);
    const rows = raw.map((r) => {
      const row: Record<string, string> = {};
      for (const [k, v] of Object.entries(r)) {
        const mapped = COL_MAP[k] ?? k;
        row[mapped] = BOOL_COLS.has(mapped)
          ? v === "1"
            ? "true"
            : v === "0"
              ? "false"
              : v
          : v;
      }
      return row;
    });
    return { rows, columns };
  },
};
