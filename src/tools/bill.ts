import { z } from "zod";
import { cdQuery } from "../core/client.js";
import { OCD_PREFIXES } from "../core/prefixes.js";
import { flattenBindings } from "../core/flatten.js";
import type { Tool } from "./types.js";

const inputSchema = z.object({
  uri: z.string().url().describe("URI completo dell'atto Camera"),
});

const columns = [
  "uri",
  "label",
  "title",
  "type",
  "date",
  "description",
  "initiative",
  "identifier",
  "sponsor_uri",
  "legislature_uri",
  "url",
];

export const billTool: Tool<typeof inputSchema> = {
  name: "bill",
  description:
    "[CAMERA] Scheda di un singolo atto della Camera: titolo, tipo, data, iniziativa, firmatario, stato.",
  inputSchema,
  examples: [
    "italianparliament bill show --uri http://dati.camera.it/ocd/attocamera.rdf/ac19_1234",
    "italianparliament bill show --uri http://dati.camera.it/ocd/attocamera.rdf/ac19_1 --format jsonl",
  ],
  async execute(input) {
    const query = `${OCD_PREFIXES}
SELECT ?label ?title ?type ?date ?description ?initiative
       ?identifier ?primo_firmatario ?rif_leg ?url
WHERE {
  <${input.uri}> rdfs:label ?label .
  OPTIONAL { <${input.uri}> dc:title ?title }
  OPTIONAL { <${input.uri}> dc:type ?type }
  OPTIONAL { <${input.uri}> dc:date ?date }
  OPTIONAL { <${input.uri}> dc:description ?description }
  OPTIONAL { <${input.uri}> ocd:iniziativa ?initiative }
  OPTIONAL { <${input.uri}> dc:identifier ?identifier }
  OPTIONAL { <${input.uri}> ocd:primo_firmatario ?primo_firmatario }
  OPTIONAL { <${input.uri}> ocd:rif_leg ?rif_leg }
  OPTIONAL { <${input.uri}> dcterms:isReferencedBy ?url }
}
LIMIT 1`;

    const results = await cdQuery(query);
    const raw = flattenBindings(results);
    if (raw.length === 0) {
      throw new Error(`Nessun atto trovato per URI: ${input.uri}`);
    }
    const r = raw[0];
    const rows = [
      {
        uri: input.uri,
        label: r.label ?? "",
        title: r.title ?? "",
        type: r.type ?? "",
        date: r.date ?? "",
        description: r.description ?? "",
        initiative: r.initiative ?? "",
        identifier: r.identifier ?? "",
        sponsor_uri: r.primo_firmatario ?? "",
        legislature_uri: r.rif_leg ?? "",
        url: r.url ?? "",
      },
    ];
    return { rows, columns };
  },
};
