import { z } from "zod";
import { snQuery } from "../core/client.js";
import { OSR_PREFIXES } from "../core/prefixes.js";
import { flattenBindings } from "../core/flatten.js";
import type { Tool } from "./types.js";

const inputSchema = z.object({
  legislature: z
    .number()
    .int()
    .positive()
    .default(19)
    .describe("Numero legislatura Senato (default 19)"),
  ddlUri: z
    .string()
    .url()
    .optional()
    .describe("Filtra le votazioni collegate a un DDL (es. http://dati.senato.it/ddl/58039)"),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Data inizio seduta (YYYY-MM-DD)"),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Data fine seduta (YYYY-MM-DD)"),
  limit: z.number().int().positive().max(1000).default(100),
  offset: z.number().int().nonnegative().default(0),
});

const columns = [
  "uri",
  "date",
  "number",
  "type",
  "label",
  "outcome",
  "in_favour",
  "against",
  "abstentions",
  "present",
  "voters",
  "majority",
  "ddl_uri",
  "object_uri",
];

export const senatoVotesTool: Tool<typeof inputSchema> = {
  name: "senato-votes",
  description:
    "[SENATO] Lista votazioni dell'Assemblea del Senato con esito, contatori (favorevoli, contrari, astenuti, presenti, votanti), tipo, data seduta e DDL collegato. Filtrabile per legislatura, data e DDL. Per il voto del singolo senatore usare senato-vote-detail.",
  inputSchema,
  examples: [
    "italianparliament senato-votes list --legislature 19 --limit 50",
    "italianparliament senato-votes list --legislature 19 --date-from 2026-01-01 --date-to 2026-03-31",
    "italianparliament senato-votes list --ddl-uri http://dati.senato.it/ddl/58039 --format jsonl",
  ],
  async execute(input) {
    const ddlPattern = input.ddlUri
      ? `?v osr:oggetto ?oggetto . ?oggetto osr:relativoA <${input.ddlUri}> .`
      : `OPTIONAL { ?v osr:oggetto ?oggetto . OPTIONAL { ?oggetto osr:relativoA ?ddl } }`;
    const dateFromFilter = input.dateFrom
      ? `FILTER(?date >= "${input.dateFrom}"^^xsd:date)`
      : "";
    const dateToFilter = input.dateTo
      ? `FILTER(?date <= "${input.dateTo}"^^xsd:date)`
      : "";

    const query = `${OSR_PREFIXES}
SELECT DISTINCT ?v ?date ?numero ?tipo ?label ?esito
                ?favorevoli ?contrari ?astenuti ?presenti ?votanti ?maggioranza
                ?ddl ?oggetto
WHERE {
  ?v a osr:Votazione ; osr:legislatura ${input.legislature} ; osr:seduta ?s .
  OPTIONAL { ?s osr:dataSeduta ?date }
  OPTIONAL { ?v rdfs:label ?label }
  OPTIONAL { ?v osr:numero ?numero }
  OPTIONAL { ?v osr:tipoVotazione ?tipo }
  OPTIONAL { ?v osr:esito ?esito }
  OPTIONAL { ?v osr:favorevoli ?favorevoli }
  OPTIONAL { ?v osr:contrari ?contrari }
  OPTIONAL { ?v osr:astenuti ?astenuti }
  OPTIONAL { ?v osr:presenti ?presenti }
  OPTIONAL { ?v osr:votanti ?votanti }
  OPTIONAL { ?v osr:maggioranza ?maggioranza }
  ${ddlPattern}
  ${dateFromFilter}
  ${dateToFilter}
}
ORDER BY DESC(?date) DESC(?numero)
LIMIT ${input.limit}
OFFSET ${input.offset}`;

    const results = await snQuery(query);
    const raw = flattenBindings(results);
    // Un voto su DDL unificati è collegato a più ddl via osr:relativoA:
    // il join moltiplica le righe. Collassiamo per URI votazione e
    // concateniamo i DDL distinti.
    const byUri = new Map<string, Record<string, string>>();
    for (const r of raw) {
      const uri = r.v ?? "";
      const ddl = r.ddl ?? "";
      const existing = byUri.get(uri);
      if (existing) {
        if (ddl && !existing.ddl_uri.split(" | ").includes(ddl)) {
          existing.ddl_uri = existing.ddl_uri ? `${existing.ddl_uri} | ${ddl}` : ddl;
        }
        continue;
      }
      byUri.set(uri, {
        uri,
        date: r.date ?? "",
        number: r.numero ?? "",
        type: r.tipo ?? "",
        label: r.label ?? "",
        outcome: r.esito ?? "",
        in_favour: r.favorevoli ?? "",
        against: r.contrari ?? "",
        abstentions: r.astenuti ?? "",
        present: r.presenti ?? "",
        voters: r.votanti ?? "",
        majority: r.maggioranza ?? "",
        ddl_uri: ddl,
        object_uri: r.oggetto ?? "",
      });
    }
    return { rows: [...byUri.values()], columns };
  },
};
