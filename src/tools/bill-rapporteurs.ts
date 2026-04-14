import { z } from "zod";
import { cdQuery } from "../core/client.js";
import { OCD_PREFIXES } from "../core/prefixes.js";
import { flattenBindings } from "../core/flatten.js";
import type { Tool } from "./types.js";

const inputSchema = z.object({
  billUri: z
    .string()
    .url()
    .describe("URI del DDL Camera (es. http://dati.camera.it/ocd/attocamera.rdf/ac19_2807)"),
  limit: z.number().int().min(1).max(500).default(100),
});

const columns = [
  "rapporteur_name",
  "rapporteur_type",
  "committee",
  "date",
  "deputy_uri",
];

const RDFS_LABEL = "http://www.w3.org/2000/01/rdf-schema#label";

export const billRapporteursTool: Tool<typeof inputSchema> = {
  name: "bill-rapporteurs",
  description:
    "[CAMERA] Relatori di un DDL Camera per commissione: nome, tipo (Relatore / Relatore f.f.), commissione assegnata e data inizio esame.",
  inputSchema,
  examples: [
    "italianparliament bill-rapporteurs list --bill-uri http://dati.camera.it/ocd/attocamera.rdf/ac19_2807",
    "italianparliament bill-rapporteurs list --bill-uri http://dati.camera.it/ocd/attocamera.rdf/ac19_1665",
  ],
  async execute(input) {
    const query = `${OCD_PREFIXES}
SELECT DISTINCT ?relatoreLabel ?relatoreType ?dibattitoLabel ?startDate ?deputatoUri
WHERE {
  <${input.billUri}> ocd:rif_dibattito ?dib .
  ?dib <${RDFS_LABEL}> ?dibattitoLabel .
  OPTIONAL { ?dib ocd:startDate ?startDate }
  ?dib ocd:rif_discussione ?disc .
  ?disc ocd:rif_relatore ?rel .
  ?rel <${RDFS_LABEL}> ?relatoreLabel .
  OPTIONAL { ?rel ocd:rif_deputato ?deputatoUri }
  OPTIONAL { ?rel dc:type ?relatoreType }
}
ORDER BY ?startDate ?dibattitoLabel
LIMIT ${input.limit}`;

    const results = await cdQuery(query);
    const raw = flattenBindings(results);
    const rows = raw.map((r) => ({
      rapporteur_name: r.relatoreLabel ?? "",
      rapporteur_type: r.relatoreType ?? "",
      committee: r.dibattitoLabel ?? "",
      date: r.startDate ?? "",
      deputy_uri: r.deputatoUri ?? "",
    }));
    return { rows, columns };
  },
};
