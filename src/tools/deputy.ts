import { z } from "zod";
import { cdQuery } from "../core/client.js";
import { OCD_PREFIXES } from "../core/prefixes.js";
import { flattenBindings } from "../core/flatten.js";
import type { Tool } from "./types.js";

const inputSchema = z.object({
  uri: z.string().url().optional().describe("URI completo del deputato"),
  id: z.number().int().positive().optional().describe("ID numerico deputato"),
  legislature: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Numero legislatura (richiesta con --id)"),
});

const columns = [
  "uri",
  "label",
  "first_name",
  "last_name",
  "gender",
  "description",
  "legislature_uri",
  "photo_url",
  "profile_url",
  "modified",
];

export const deputyTool: Tool<typeof inputSchema> = {
  name: "deputy",
  description:
    "[CAMERA] Scheda di un singolo deputato: nome, cognome, genere, foto, profilo Camera. Input per URI o per id+legislature.",
  inputSchema,
  examples: [
    "italianparliament deputy show --uri http://dati.camera.it/ocd/deputato.rdf/d306921_17",
    "italianparliament deputy show --id 306921 --legislature 17",
    "italianparliament deputy show --uri http://dati.camera.it/ocd/deputato.rdf/d307926_18 --format jsonl",
  ],
  async execute(input) {
    if (!input.uri && (input.id === undefined || input.legislature === undefined)) {
      throw new Error(
        "Passare --uri oppure --id e --legislature insieme.",
      );
    }
    const uri =
      input.uri ??
      `http://dati.camera.it/ocd/deputato.rdf/d${input.id}_${input.legislature}`;

    const query = `${OCD_PREFIXES}
SELECT ?label ?firstName ?surname ?gender ?description
       ?rif_leg ?depiction ?isReferencedBy ?modified
WHERE {
  <${uri}> rdfs:label ?label .
  OPTIONAL { <${uri}> foaf:firstName ?firstName }
  OPTIONAL { <${uri}> foaf:surname ?surname }
  OPTIONAL { <${uri}> foaf:gender ?gender }
  OPTIONAL { <${uri}> dc:description ?description }
  OPTIONAL { <${uri}> ocd:rif_leg ?rif_leg }
  OPTIONAL { <${uri}> foaf:depiction ?depiction }
  OPTIONAL { <${uri}> dcterms:isReferencedBy ?isReferencedBy }
  OPTIONAL { <${uri}> ods:modified ?modified }
}
LIMIT 1`;

    const results = await cdQuery(query);
    const raw = flattenBindings(results);
    if (raw.length === 0) {
      throw new Error(`Nessun deputato trovato per URI: ${uri}`);
    }
    const r = raw[0];
    const rows = [
      {
        uri,
        label: r.label ?? "",
        first_name: r.firstName ?? "",
        last_name: r.surname ?? "",
        gender: r.gender ?? "",
        description: r.description ?? "",
        legislature_uri: r.rif_leg ?? "",
        photo_url: r.depiction ?? "",
        profile_url: r.isReferencedBy ?? "",
        modified: r.modified ?? "",
      },
    ];
    return { rows, columns };
  },
};
