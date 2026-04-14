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
  "election_region",
  "election_district",
  "election_type",
  "mandate_start",
  "mandate_end",
  "photo_url",
  "profile_url",
  "html_url",
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
       ?startDate ?endDate ?electionRegion ?electionDistrict ?electionType
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
  OPTIONAL {
    <${uri}> ocd:rif_mandatoCamera ?mandato .
    OPTIONAL { ?mandato ocd:startDate ?startDate }
    OPTIONAL { ?mandato ocd:endDate ?endDate }
    OPTIONAL {
      ?mandato ocd:rif_elezione ?el .
      OPTIONAL { ?el dc:coverage ?electionRegion }
      OPTIONAL { ?el dcterms:spatial ?electionDistrict }
      OPTIONAL { ?el ocd:tipoElezione ?electionType }
    }
  }
}
LIMIT 1`;

    const results = await cdQuery(query);
    const raw = flattenBindings(results);
    if (raw.length === 0) {
      throw new Error(`Nessun deputato trovato per URI: ${uri}`);
    }
    const r = raw[0];
    const match = uri.match(/\/d(\d+)_(\d+)$/);
    const html_url = match
      ? `https://www.camera.it/deputati/elenco/${match[2]}-${match[1]}`
      : "";
    const rows = [
      {
        uri,
        label: r.label ?? "",
        first_name: r.firstName ?? "",
        last_name: r.surname ?? "",
        gender: r.gender ?? "",
        description: r.description ?? "",
        legislature_uri: r.rif_leg ?? "",
        election_region: r.electionRegion ?? "",
        election_district: r.electionDistrict ?? "",
        election_type: r.electionType ?? "",
        mandate_start: r.startDate ?? "",
        mandate_end: r.endDate ?? "",
        photo_url: r.depiction ?? "",
        profile_url: r.isReferencedBy ?? "",
        html_url,
        modified: r.modified ?? "",
      },
    ];
    return { rows, columns };
  },
};
