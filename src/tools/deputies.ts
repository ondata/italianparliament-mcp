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
  offset: z.number().int().nonnegative().default(0),
});

const columns = [
  "uri",
  "label",
  "first_name",
  "last_name",
  "gender",
  "description",
  "photo_url",
  "profile_url",
  "legislature_uri",
  "mandate_uri",
  "mandate_start",
  "mandate_end",
  "mandate_termination_reason",
  "mandate_validation",
  "election_uri",
  "election_label",
];

export const deputiesTool: Tool<typeof inputSchema> = {
  name: "deputies",
  description:
    "[CAMERA] Lista deputati della Camera dei Deputati. Filtrabile per legislatura. Restituisce nome, cognome, genere, foto, profilo, mandato, elezione.",
  inputSchema,
  examples: [
    "italianparliament deputies list --legislature 19 --limit 50",
    "italianparliament deputies list --limit 200 --offset 100",
    "italianparliament deputies list --format jsonl",
  ],
  async execute(input) {
    const legFilter =
      input.legislature !== undefined
        ? `FILTER(?rif_leg = <http://dati.camera.it/ocd/legislatura.rdf/repubblica_${input.legislature}>)`
        : "";

    const query = `${OCD_PREFIXES}
SELECT DISTINCT ?s ?label ?first_name ?last_name ?gender ?description
                ?photo_url ?profile_url ?rif_leg
                ?mandate_uri ?mandate_start ?mandate_end ?mandate_termination_reason
                ?mandate_validation ?election_uri ?election_label
WHERE {
  ?s a <http://dati.camera.it/ocd/deputato> .
  ?s rdfs:label ?label .
  OPTIONAL { ?s foaf:firstName ?first_name }
  OPTIONAL { ?s foaf:surname ?last_name }
  OPTIONAL { ?s foaf:gender ?gender }
  OPTIONAL { ?s dc:description ?description }
  OPTIONAL { ?s foaf:depiction ?photo_url }
  OPTIONAL { ?s dcterms:isReferencedBy ?profile_url }
  OPTIONAL { ?s <http://dati.camera.it/ocd/rif_leg> ?rif_leg }
  OPTIONAL {
    ?s <http://dati.camera.it/ocd/rif_mandatoCamera> ?mandate_uri .
    OPTIONAL { ?mandate_uri <http://dati.camera.it/ocd/startDate> ?mandate_start }
    OPTIONAL { ?mandate_uri <http://dati.camera.it/ocd/endDate> ?mandate_end }
    OPTIONAL { ?mandate_uri <http://dati.camera.it/ocd/motivoTermine> ?mandate_termination_reason }
    OPTIONAL { ?mandate_uri <http://dati.camera.it/ocd/convalida> ?mandate_validation }
    OPTIONAL {
      ?mandate_uri <http://dati.camera.it/ocd/rif_elezione> ?election_uri .
      ?election_uri rdfs:label ?election_label
    }
  }
  ${legFilter}
}
LIMIT ${input.limit}
OFFSET ${input.offset}`;

    const results = await cdQuery(query);
    const raw = flattenBindings(results);
    const rows = raw.map((r) => {
      const { s, rif_leg, ...rest } = r;
      return { uri: s ?? "", legislature_uri: rif_leg ?? "", ...rest };
    });
    return { rows, columns };
  },
};
