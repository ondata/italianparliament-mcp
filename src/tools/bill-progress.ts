import { z } from "zod";
import { snQuery } from "../core/client.js";
import { OSR_PREFIXES } from "../core/prefixes.js";
import { flattenBindings } from "../core/flatten.js";
import type { Tool } from "./types.js";

const inputSchema = z.object({
  ddlUri: z
    .string()
    .url()
    .optional()
    .describe("URI del DDL Senato (es. http://dati.senato.it/ddl/25597)"),
  keyword: z
    .string()
    .optional()
    .describe("Cerca nel titolo del DDL (match case-insensitive, es. 'autonomia', 'lavoro')"),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Data inizio presentazione (YYYY-MM-DD)"),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Data fine presentazione (YYYY-MM-DD)"),
  legislature: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Numero legislatura"),
  limit: z.number().int().min(1).max(1000).default(100),
  offset: z.number().int().min(0).default(0),
});

const columns = [
  "ddl_uri",
  "title",
  "status",
  "status_date",
  "presentation_date",
  "initiative_description",
  "nature",
  "legislature",
  "phase",
  "phase_number",
  "html_url",
];

export const billProgressTool: Tool<typeof inputSchema> = {
  name: "bill-progress",
  description:
    "[SENATO] Disegni di legge (DDL) al Senato con stato dell'iter (assegnato, esame in commissione, approvato, ecc.), date, iniziativa, natura. Filtrabile per legislatura, parola chiave nel titolo e intervallo date di presentazione. Usare questo tool per cercare DDL al Senato.",
  inputSchema,
  examples: [
    "italianparliament bill-progress list --legislature 19 --limit 20",
    "italianparliament bill-progress list --ddl-uri http://dati.senato.it/ddl/25597",
    "italianparliament bill-progress list --legislature 19 --keyword autonomia --limit 20",
    "italianparliament bill-progress list --legislature 19 --date-from 2026-04-01 --date-to 2026-04-13",
    "italianparliament bill-progress list --legislature 19 --format jsonl",
  ],
  async execute(input) {
    const filters: string[] = [];
    if (input.ddlUri) {
      filters.push(`FILTER(?s = <${input.ddlUri}>)`);
    }
    if (input.keyword) {
      const escaped = input.keyword.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      filters.push(`FILTER(CONTAINS(LCASE(STR(?titolo)), LCASE("${escaped}")))`);
    }
    if (input.legislature) {
      filters.push(`?s osr:legislatura ${input.legislature} .`);
    }
    if (input.dateFrom) {
      filters.push(`FILTER(STR(?dataPresentazione) >= "${input.dateFrom}")`);
    }
    if (input.dateTo) {
      filters.push(`FILTER(STR(?dataPresentazione) <= "${input.dateTo}")`);
    }

    const query = `${OSR_PREFIXES}
PREFIX dc: <http://purl.org/dc/elements/1.1/>
SELECT ?s ?titolo ?statoDdl ?dataStatoDdl ?dataPresentazione
       ?descrIniziativa ?natura ?legislatura ?fase ?numeroFase
WHERE {
  ?s a osr:Ddl .
  OPTIONAL { ?s osr:titolo ?titolo }
  OPTIONAL { ?s osr:statoDdl ?statoDdl }
  OPTIONAL { ?s osr:dataStatoDdl ?dataStatoDdl }
  OPTIONAL { ?s osr:dataPresentazione ?dataPresentazione }
  OPTIONAL { ?s osr:descrIniziativa ?descrIniziativa }
  OPTIONAL { ?s osr:natura ?natura }
  OPTIONAL { ?s osr:legislatura ?legislatura }
  OPTIONAL { ?s osr:fase ?fase }
  OPTIONAL { ?s osr:numeroFase ?numeroFase }
  ${filters.join("\n  ")}
}
ORDER BY DESC(?dataPresentazione)
LIMIT ${input.limit}
OFFSET ${input.offset}`;

    const results = await snQuery(query);
    const raw = flattenBindings(results);
    const rows = raw.map((r) => {
      const ddl_uri = r.s ?? "";
      const idMatch = ddl_uri.match(/\/ddl\/(\d+)$/);
      const html_url = idMatch
        ? `https://www.senato.it/leggi-e-documenti/disegni-di-legge/scheda-ddl?tab=datiGenerali&did=${idMatch[1]}`
        : "";
      return {
        ddl_uri,
        title: r.titolo ?? "",
        status: r.statoDdl ?? "",
        status_date: r.dataStatoDdl ?? "",
        presentation_date: r.dataPresentazione ?? "",
        initiative_description: r.descrIniziativa ?? "",
        nature: r.natura ?? "",
        legislature: r.legislatura ?? "",
        phase: r.fase ?? "",
        phase_number: r.numeroFase ?? "",
        html_url,
      };
    });
    return { rows, columns };
  },
};
