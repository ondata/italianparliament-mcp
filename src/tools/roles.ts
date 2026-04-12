import { z } from "zod";
import { cdQuery } from "../core/client.js";
import { flattenBindings } from "../core/flatten.js";
import { OCD_PREFIXES } from "../core/prefixes.js";
import type { Tool } from "./types.js";

const inputSchema = z.object({
  deputyUri: z.string().url().optional().describe("Filtra per URI deputato"),
  groupUri: z.string().url().optional().describe("Filtra per URI gruppo parlamentare"),
  legislature: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(1000).default(100),
  offset: z.number().int().nonnegative().default(0),
});

const columns = [
  "uri",
  "label",
  "deputy_uri",
  "group_uri",
  "start_date",
  "end_date",
  "role",
  "legislature_uri",
];

export const rolesTool: Tool<typeof inputSchema> = {
  name: "roles",
  description:
    "[CAMERA] Incarichi parlamentari della Camera: presidente, vicepresidente, segretario, tesoriere, delegato d'aula di ciascun gruppo. Filtrabile per deputato, gruppo o legislatura.",
  inputSchema,
  examples: [
    "italianparliament roles list --legislature 19",
    "italianparliament roles list --deputy-uri http://dati.camera.it/ocd/deputato.rdf/d306921_17",
    "italianparliament roles list --group-uri http://dati.camera.it/ocd/gruppoParlamentare.rdf/gr4131",
  ],
  async execute(input) {
    const filters: string[] = [];
    if (input.deputyUri)
      filters.push(`FILTER(?rif_deputato = <${input.deputyUri}>)`);
    if (input.groupUri)
      filters.push(`FILTER(?rif_gruppo = <${input.groupUri}>)`);
    if (input.legislature !== undefined)
      filters.push(
        `FILTER(?rif_leg = <http://dati.camera.it/ocd/legislatura.rdf/repubblica_${input.legislature}>)`,
      );

    const query = `${OCD_PREFIXES}
SELECT DISTINCT ?s ?label ?rif_deputato ?rif_gruppo
                ?start_date ?end_date ?role ?rif_leg
WHERE {
  ?s a <http://dati.camera.it/ocd/incarico> .
  ?s rdfs:label ?label .
  OPTIONAL { ?s <http://dati.camera.it/ocd/rif_deputato> ?rif_deputato }
  OPTIONAL { ?s <http://dati.camera.it/ocd/rif_gruppoParlamentare> ?rif_gruppo }
  OPTIONAL { ?s dc:date ?start_date }
  OPTIONAL { ?s <http://dati.camera.it/ocd/dataFine> ?end_date }
  OPTIONAL { ?s ocd:ruolo ?role }
  OPTIONAL { ?s <http://dati.camera.it/ocd/rif_leg> ?rif_leg }
  ${filters.join("\n  ")}
}
LIMIT ${input.limit}
OFFSET ${input.offset}`;

    const results = await cdQuery(query);
    const raw = flattenBindings(results);
    const rows = raw.map((r) => ({
      uri: r.s ?? "",
      label: r.label ?? "",
      deputy_uri: r.rif_deputato ?? "",
      group_uri: r.rif_gruppo ?? "",
      start_date: r.start_date ?? "",
      end_date: r.end_date ?? "",
      role: r.role ?? "",
      legislature_uri: r.rif_leg ?? "",
    }));
    return { rows, columns };
  },
};
