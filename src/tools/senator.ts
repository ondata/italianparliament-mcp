import { z } from "zod";
import { snQuery } from "../core/client.js";
import { OSR_PREFIXES } from "../core/prefixes.js";
import { flattenBindings } from "../core/flatten.js";
import type { Tool } from "./types.js";

const inputSchema = z.object({
  uri: z.string().url().describe("URI completo del senatore"),
});

const columns = [
  "uri",
  "label",
  "first_name",
  "last_name",
  "gender",
  "birth_date",
  "birth_city",
  "photo",
];

export const senatorTool: Tool<typeof inputSchema> = {
  name: "senator",
  description:
    "[SENATO] Scheda di un singolo senatore: nome, cognome, genere, data/luogo nascita, foto.",
  inputSchema,
  examples: [
    "italianparliament senator show --uri http://dati.senato.it/senatore/29110",
    "italianparliament senator show --uri http://dati.senato.it/senatore/29110 --format jsonl",
  ],
  async execute(input) {
    const query = `${OSR_PREFIXES}
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
SELECT ?label ?firstName ?lastName ?gender ?birthDate ?birthCity ?photo
WHERE {
  <${input.uri}> rdfs:label ?label .
  OPTIONAL { <${input.uri}> foaf:firstName ?firstName }
  OPTIONAL { <${input.uri}> foaf:lastName ?lastName }
  OPTIONAL { <${input.uri}> foaf:gender ?gender }
  OPTIONAL { <${input.uri}> osr:dataNascita ?birthDate }
  OPTIONAL { <${input.uri}> osr:luogoNascita ?birthCity }
  OPTIONAL { <${input.uri}> foaf:depiction ?photo }
}
LIMIT 1`;

    const results = await snQuery(query);
    const raw = flattenBindings(results);
    if (raw.length === 0) {
      throw new Error(`Nessun senatore trovato per URI: ${input.uri}`);
    }
    const r = raw[0];
    const rows = [
      {
        uri: input.uri,
        label: r.label ?? "",
        first_name: r.firstName ?? "",
        last_name: r.lastName ?? "",
        gender: r.gender ?? "",
        birth_date: r.birthDate ?? "",
        birth_city: r.birthCity ?? "",
        photo: r.photo ?? "",
      },
    ];
    return { rows, columns };
  },
};
