import { z } from "zod";
import { snQuery } from "../core/client.js";
import { OSR_PREFIXES } from "../core/prefixes.js";
import { flattenBindings } from "../core/flatten.js";
import type { Tool } from "./types.js";

const inputSchema = z.object({
  uri: z.string().url().describe("URI completo del senatore"),
  legislature: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Numero legislatura (default: 19 corrente)"),
});

const columns = [
  "uri",
  "label",
  "first_name",
  "last_name",
  "gender",
  "birth_date",
  "birth_city",
  "election_region",
  "election_type",
  "mandate_start",
  "mandate_end",
  "photo",
  "html_url",
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
    const leg = input.legislature ?? 19;
    const query = `${OSR_PREFIXES}
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
SELECT ?label ?firstName ?lastName ?gender ?birthDate ?birthCity ?photo
       ?electionRegion ?electionType ?mandateStart ?mandateEnd
WHERE {
  <${input.uri}> rdfs:label ?label .
  OPTIONAL { <${input.uri}> foaf:firstName ?firstName }
  OPTIONAL { <${input.uri}> foaf:lastName ?lastName }
  OPTIONAL { <${input.uri}> foaf:gender ?gender }
  OPTIONAL { <${input.uri}> osr:dataNascita ?birthDate }
  OPTIONAL { <${input.uri}> osr:luogoNascita ?birthCity }
  OPTIONAL { <${input.uri}> foaf:depiction ?photo }
  OPTIONAL {
    <${input.uri}> osr:mandato ?m .
    ?m osr:legislatura ${leg} .
    ?m a <http://dati.camera.it/ocd/mandatoSenato> .
    OPTIONAL { ?m osr:regioneElezione ?electionRegion }
    OPTIONAL { ?m osr:tipoElezione ?electionType }
    OPTIONAL { ?m osr:inizio ?mandateStart }
    OPTIONAL { ?m osr:fine ?mandateEnd }
  }
}
LIMIT 1`;

    const results = await snQuery(query);
    const raw = flattenBindings(results);
    if (raw.length === 0) {
      throw new Error(`Nessun senatore trovato per URI: ${input.uri}`);
    }
    const r = raw[0];
    const idMatch = input.uri.match(/\/senatore\/(\d+)$/);
    const senId = idMatch ? idMatch[1] : "";
    const html_url = senId
      ? leg === 19
        ? `https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did=${senId.padStart(8, "0")}`
        : `https://www.senato.it/legislature/${leg}/composizione/senatori/elenco-alfabetico/scheda-attivita?did=${senId}`
      : "";
    const rows = [
      {
        uri: input.uri,
        label: r.label ?? "",
        first_name: r.firstName ?? "",
        last_name: r.lastName ?? "",
        gender: r.gender ?? "",
        birth_date: r.birthDate ?? "",
        birth_city: r.birthCity ?? "",
        election_region: r.electionRegion ?? "",
        election_type: r.electionType ?? "",
        mandate_start: r.mandateStart ?? "",
        mandate_end: r.mandateEnd ?? "",
        photo: r.photo ?? "",
        html_url,
      },
    ];
    return { rows, columns };
  },
};
