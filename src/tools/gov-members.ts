import { z } from "zod";
import { cdQuery } from "../core/client.js";
import { OCD_PREFIXES } from "../core/prefixes.js";
import { flattenBindings } from "../core/flatten.js";
import type { Tool } from "./types.js";

const inputSchema = z.object({
  governmentUri: z
    .string()
    .url()
    .optional()
    .describe("URI del governo (es. http://dati.camera.it/ocd/governo.rdf/g202)"),
  legislature: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Numero legislatura"),
  name: z
    .string()
    .optional()
    .describe("Cerca per nome/cognome del membro (case-insensitive)"),
  limit: z.number().int().min(1).max(1000).default(100),
  offset: z.number().int().min(0).default(0),
});

const columns = [
  "uri",
  "label",
  "person_name",
  "person_uri",
  "role",
  "start_date",
  "end_date",
  "termination_reason",
  "government_uri",
  "legislature_uri",
];

export const govMembersTool: Tool<typeof inputSchema> = {
  name: "gov-members",
  description:
    "[CAMERA] Membri del governo italiano: presidente del consiglio, ministri, sottosegretari, viceministri. Con nome, ruolo, date inizio/fine, motivo cessazione. Filtrabile per governo, legislatura o nome persona.",
  inputSchema,
  examples: [
    "italianparliament gov-members list --legislature 19",
    "italianparliament gov-members list --government-uri http://dati.camera.it/ocd/governo.rdf/g202",
    "italianparliament gov-members list --name meloni",
  ],
  async execute(input) {
    const filters: string[] = [];
    if (input.governmentUri) {
      filters.push(`?m ocd:rif_governo <${input.governmentUri}> .`);
    }
    if (input.legislature) {
      filters.push(
        `?m ocd:rif_leg <http://dati.camera.it/ocd/legislatura.rdf/repubblica_${input.legislature}> .`,
      );
    }
    if (input.name) {
      filters.push(
        `FILTER(CONTAINS(LCASE(?persona_name), "${input.name.toLowerCase()}"))`,
      );
    }

    const query = `${OCD_PREFIXES}
SELECT DISTINCT ?m ?label ?persona_name ?rif_persona ?role
       ?start_date ?end_date ?reason ?rif_governo ?rif_leg
WHERE {
  ?m a ocd:membroGoverno .
  ?m rdfs:label ?label .
  OPTIONAL { ?m ocd:rif_persona ?rif_persona }
  OPTIONAL { ?rif_persona rdfs:label ?persona_name }
  OPTIONAL { ?m ocd:membroGoverno ?role }
  OPTIONAL { ?m ocd:startDate ?start_date }
  OPTIONAL { ?m ocd:endDate ?end_date }
  OPTIONAL { ?m ocd:motivoTermine ?reason }
  OPTIONAL { ?m ocd:rif_governo ?rif_governo }
  OPTIONAL { ?m ocd:rif_leg ?rif_leg }
  ${filters.join("\n  ")}
}
ORDER BY ?persona_name
LIMIT ${input.limit}
OFFSET ${input.offset}`;

    const results = await cdQuery(query);
    const raw = flattenBindings(results);
    const rows = raw.map((r) => ({
      uri: r.m ?? "",
      label: r.label ?? "",
      person_name: r.persona_name ?? "",
      person_uri: r.rif_persona ?? "",
      role: r.role ?? "",
      start_date: r.start_date ?? "",
      end_date: r.end_date ?? "",
      termination_reason: r.reason ?? "",
      government_uri: r.rif_governo ?? "",
      legislature_uri: r.rif_leg ?? "",
    }));
    return { rows, columns };
  },
};
