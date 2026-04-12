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
    .optional()
    .describe("Numero legislatura"),
  senatorUri: z
    .string()
    .url()
    .optional()
    .describe("URI completo del senatore firmatario (es. http://dati.senato.it/senatore/29110)"),
  tipo: z
    .string()
    .optional()
    .describe(
      "Filtro sul tipo di atto (match case-insensitive). Valori: 'Interrogazione', " +
        "'Interrogazione con richiesta di risposta scritta', 'Interpellanza', 'Mozione', 'Risoluzione in Assemblea'",
    ),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Data inizio (YYYY-MM-DD)"),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Data fine (YYYY-MM-DD)"),
  limit: z.number().int().min(1).max(1000).default(100),
  offset: z.number().int().min(0).default(0),
});

const columns = [
  "uri",
  "label",
  "tipo",
  "numero",
  "data",
  "legislatura",
  "senatore_uri",
  "presentatore",
  "esito",
  "url",
];

export const sindacatoIspettivoTool: Tool<typeof inputSchema> = {
  name: "sindacato-ispettivo",
  description:
    "[SENATO] Atti di sindacato ispettivo del Senato: interrogazioni (orali e scritte), " +
    "interpellanze, mozioni, risoluzioni. Equivalente Senato degli AIC Camera. " +
    "Filtrabile per legislatura, senatore firmatario e tipo di atto.",
  inputSchema,
  examples: [
    "italianparliament sindacato-ispettivo list --legislature 19 --limit 10",
    "italianparliament sindacato-ispettivo list --senator-uri http://dati.senato.it/senatore/29110 --legislature 19",
    "italianparliament sindacato-ispettivo list --legislature 19 --tipo Interpellanza --limit 20",
    "italianparliament sindacato-ispettivo list --legislature 19 --format jsonl",
  ],
  async execute(input) {
    const required: string[] = [];
    const filters: string[] = [];

    if (input.legislature) {
      required.push(`?s osr:legislatura ${input.legislature} .`);
    }
    if (input.tipo) {
      filters.push(`FILTER(CONTAINS(LCASE(?tipo), LCASE("${input.tipo}")))`);
    }
    if (input.dateFrom) {
      filters.push(`FILTER(?data >= "${input.dateFrom}"^^xsd:date)`);
    }
    if (input.dateTo) {
      filters.push(`FILTER(?data <= "${input.dateTo}"^^xsd:date)`);
    }

    const senatorPattern = input.senatorUri
      ? `?s osr:iniziativa ?iniz .
  ?iniz osr:senatore ?senatore_uri ; osr:presentatore ?presentatore .
  FILTER(?senatore_uri = <${input.senatorUri}>)`
      : ``;

    const query = `${OSR_PREFIXES}
SELECT DISTINCT ?s ?label ?tipo ?numero ?data ?legislatura ?senatore_uri ?presentatore ?esito ?url
WHERE {
  ?s a osr:SindacatoIspettivo .
  ${required.join("\n  ")}
  OPTIONAL { ?s <http://www.w3.org/2000/01/rdf-schema#label> ?label }
  OPTIONAL { ?s osr:tipo ?tipo }
  OPTIONAL { ?s osr:numero ?numero }
  OPTIONAL { ?s osr:dataPresentazione ?data }
  OPTIONAL { ?s osr:legislatura ?legislatura }
  OPTIONAL { ?s osr:esito ?esito }
  OPTIONAL { ?s osr:URLTesto ?url }
  ${senatorPattern}
  ${filters.join("\n  ")}
}
ORDER BY DESC(?data)
LIMIT ${input.limit}
OFFSET ${input.offset}`;

    const results = await snQuery(query);
    const raw = flattenBindings(results);
    const rows = raw.map((r) => ({
      uri: r.s ?? "",
      label: r.label ?? "",
      tipo: r.tipo ?? "",
      numero: r.numero ?? "",
      data: r.data ?? "",
      legislatura: r.legislatura ?? "",
      senatore_uri: r.senatore_uri ?? "",
      presentatore: (r.presentatore ?? "").replace(/^Sen\.\s*/i, ""),
      esito: r.esito ?? "",
      url: r.url ?? "",
    }));
    return { rows, columns };
  },
};
