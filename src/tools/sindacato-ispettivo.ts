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
  type: z
    .string()
    .optional()
    .describe(
      "Filtro sul tipo di atto (match case-insensitive). Valori: 'Interrogazione', " +
        "'Interrogazione con richiesta di risposta scritta', 'Interpellanza', 'Mozione', 'Risoluzione in Assemblea'",
    ),
  keyword: z
    .string()
    .optional()
    .describe(
      "Cerca nel testo disponibile: label, tipo e numero dell'atto (case-insensitive). " +
        "Nota: il testo/oggetto completo dell'atto non è disponibile via SPARQL Senato.",
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
  countOnly: z
    .boolean()
    .optional()
    .describe("Se true, restituisce solo il numero totale di risultati (colonna count)"),
  limit: z.number().int().min(1).max(1000).default(100),
  offset: z.number().int().min(0).default(0),
});

const columns = [
  "uri",
  "label",
  "type",
  "identifier",
  "date",
  "legislature",
  "sponsor_uri",
  "presentatore",
  "esito",
  "url",
];

export const sindacatoIspettivoTool: Tool<typeof inputSchema> = {
  name: "sindacato-ispettivo",
  description:
    "[SENATO] Atti di sindacato ispettivo del Senato: interrogazioni (orali e scritte), " +
    "interpellanze, mozioni, risoluzioni. Equivalente Senato degli AIC Camera. " +
    "Filtrabile per legislatura, senatore firmatario, tipo di atto e keyword.",
  inputSchema,
  examples: [
    "italianparliament sindacato-ispettivo list --legislature 19 --limit 10",
    "italianparliament sindacato-ispettivo list --senator-uri http://dati.senato.it/senatore/29110 --legislature 19",
    "italianparliament sindacato-ispettivo list --legislature 19 --type Interpellanza --limit 20",
    "italianparliament sindacato-ispettivo list --legislature 19 --keyword xylella",
    "italianparliament sindacato-ispettivo list --legislature 19 --format jsonl",
  ],
  async execute(input) {
    const required: string[] = [];
    const filters: string[] = [];

    if (input.legislature) {
      required.push(`?s osr:legislatura ${input.legislature} .`);
    }
    if (input.type) {
      filters.push(`FILTER(CONTAINS(LCASE(?tipo_), LCASE("${input.type}")))`);
    }
    if (input.keyword !== undefined) {
      const kw = input.keyword.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      filters.push(
        `FILTER(CONTAINS(LCASE(COALESCE(STR(?label_), "")), LCASE("${kw}")) || ` +
          `CONTAINS(LCASE(COALESCE(STR(?tipo_), "")), LCASE("${kw}")) || ` +
          `CONTAINS(LCASE(COALESCE(STR(?numero_), "")), LCASE("${kw}")))`,
      );
    }
    if (input.dateFrom) {
      filters.push(`FILTER(?data_ >= "${input.dateFrom}"^^xsd:date)`);
    }
    if (input.dateTo) {
      filters.push(`FILTER(?data_ <= "${input.dateTo}"^^xsd:date)`);
    }

    const mapRow = (r: Record<string, string>) => ({
      uri: r.s ?? "",
      label: r.label ?? "",
      type: r.tipo ?? "",
      identifier: r.numero ?? "",
      date: r.data ?? "",
      legislature: String(r.legislatura ?? ""),
      sponsor_uri: r.senatore_uri ?? "",
      presentatore: (r.presentatore ?? "").replace(/^Sen\.\s*/i, ""),
      esito: r.esito ?? "",
      url: r.url ?? "",
    });

    if (input.countOnly) {
      const senFiltersCount = filters.map((f) =>
        f
          .replace(/\?tipo_/g, "?tipo_")
          .replace(/\?data_/g, "?data_")
          .replace(/\?label_/g, "?label_"),
      );
      const senatorJoin = input.senatorUri
        ? `?s osr:iniziativa ?iniz . ?iniz osr:senatore ?senatore_uri .
  FILTER(?senatore_uri = <${input.senatorUri}>)`
        : "";
      const countQuery = `${OSR_PREFIXES}
SELECT (COUNT(DISTINCT ?s) AS ?count)
WHERE {
  ?s a osr:SindacatoIspettivo .
  ${required.join("\n  ")}
  ${senatorJoin}
  OPTIONAL { ?s <http://www.w3.org/2000/01/rdf-schema#label> ?label_ }
  OPTIONAL { ?s osr:tipo ?tipo_ }
  OPTIONAL { ?s osr:numero ?numero_ }
  OPTIONAL { ?s osr:dataPresentazione ?data_ }
  ${senFiltersCount.join("\n  ")}
}`;
      const results = await snQuery(countQuery);
      const c = flattenBindings(results)[0]?.count ?? "0";
      return { rows: [{ count: c }], columns: ["count"] };
    }

    // When filtering by senator, use direct join (returns only that senator's acts)
    // Otherwise, use GROUP BY + MIN to get the first signer without duplicating rows
    if (input.senatorUri) {
      const senFilters = filters.map((f) =>
        f
          .replace(/\?tipo_/g, "?tipo")
          .replace(/\?data_/g, "?data")
          .replace(/\?label_/g, "?label")
          .replace(/\?numero_/g, "?numero"),
      );
      const coreQuery = `${OSR_PREFIXES}
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
  ?s osr:iniziativa ?iniz .
  ?iniz osr:senatore ?senatore_uri ; osr:presentatore ?presentatore .
  FILTER(?senatore_uri = <${input.senatorUri}>)
  ${senFilters.join("\n  ")}
}
ORDER BY DESC(?data)
LIMIT ${input.limit}
OFFSET ${input.offset}`;

      const results = await snQuery(coreQuery);
      return { rows: flattenBindings(results).map(mapRow), columns };
    }

    // No senator filter: GROUP BY + MIN to get first signer without duplicates
    const groupQuery = `${OSR_PREFIXES}
SELECT ?s (MIN(?label_) AS ?label) (MIN(?tipo_) AS ?tipo) (MIN(?numero_) AS ?numero)
       (MIN(?data_) AS ?data) (MIN(?legislatura_) AS ?legislatura)
       (MIN(?p) AS ?presentatore) (MIN(?sen) AS ?senatore_uri)
       (MIN(?esito_) AS ?esito) (MIN(?url_) AS ?url)
WHERE {
  ?s a osr:SindacatoIspettivo .
  ${required.join("\n  ")}
  OPTIONAL { ?s <http://www.w3.org/2000/01/rdf-schema#label> ?label_ }
  OPTIONAL { ?s osr:tipo ?tipo_ }
  OPTIONAL { ?s osr:numero ?numero_ }
  OPTIONAL { ?s osr:dataPresentazione ?data_ }
  OPTIONAL { ?s osr:legislatura ?legislatura_ }
  OPTIONAL { ?s osr:esito ?esito_ }
  OPTIONAL { ?s osr:URLTesto ?url_ }
  OPTIONAL { ?s osr:iniziativa ?iniz . ?iniz osr:presentatore ?p . ?iniz osr:senatore ?sen . }
  ${filters.join("\n  ")}
}
GROUP BY ?s
ORDER BY DESC(?data)
LIMIT ${input.limit}
OFFSET ${input.offset}`;

    const results = await snQuery(groupQuery);
    return { rows: flattenBindings(results).map(mapRow), columns };
  },
};
