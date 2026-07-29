import { z } from "zod";
import { cdQuery, snQuery } from "../core/client.js";
import { flattenBindings } from "../core/flatten.js";
import type { Tool } from "./types.js";

const inputSchema = z.object({
  query: z.string().min(1).describe("Query SPARQL SELECT da eseguire"),
  endpoint: z
    .enum(["camera", "senato"])
    .describe("Endpoint su cui eseguire la query: camera (dati.camera.it) o senato (dati.senato.it)"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .default(25)
    .describe("Numero massimo di righe (iniettato come LIMIT se assente nella query)"),
});

/**
 * Rimuove i commenti SPARQL (da `#` a fine riga), ignorando i `#` dentro un
 * IRI (es. `<http://www.w3.org/2000/01/rdf-schema#>`): i prefissi standard
 * rdfs/rdf/owl/xsd terminano in `#`, e su query scritte su una sola riga un
 * replace ingenuo tronca tutto il resto della query, "SELECT" incluso.
 */
function stripComments(query: string): string {
  let result = "";
  let inIri = false;
  for (let i = 0; i < query.length; i++) {
    const ch = query[i];
    if (ch === "<") inIri = true;
    else if (ch === ">") inIri = false;
    if (ch === "#" && !inIri) {
      const nl = query.indexOf("\n", i);
      if (nl === -1) break;
      i = nl - 1;
      continue;
    }
    result += ch;
  }
  return result;
}

function validateSelectQuery(query: string): void {
  const stripped = stripComments(query);
  if (!/\bSELECT\b/i.test(stripped)) {
    throw new Error(
      "Solo query SELECT supportate (non CONSTRUCT, ASK, DESCRIBE o operazioni di scrittura).",
    );
  }
}

function injectLimit(query: string, limit: number): string {
  if (/\bLIMIT\b/i.test(query)) return query;
  return `${query.trimEnd()}\nLIMIT ${limit}`;
}

export const sparqlTool: Tool<typeof inputSchema> = {
  name: "sparql",
  description:
    "[CAMERA+SENATO] Esegui una query SPARQL SELECT libera sugli endpoint del Parlamento italiano. " +
    "Utile per esplorare dati non coperti dagli altri tool, verificare proprieta RDF, " +
    "fare conteggi, aggregazioni o join personalizzati. " +
    "Endpoint Camera: dati.camera.it/sparql (prefisso ocd:). " +
    "Endpoint Senato: dati.senato.it/sparql (prefisso osr:). " +
    "Solo query SELECT (read-only). Timeout 60s.",
  inputSchema,
  examples: [
    'italianparliament sparql query --endpoint camera --query "PREFIX ocd: <http://dati.camera.it/ocd/> SELECT (COUNT(?s) AS ?n) WHERE { ?s a ocd:deputato }"',
    'italianparliament sparql query --endpoint senato --query "PREFIX osr: <http://dati.senato.it/osr/> SELECT DISTINCT ?type WHERE { ?s a ?type } LIMIT 20"',
    'italianparliament sparql query --endpoint camera --query "PREFIX ocd: <http://dati.camera.it/ocd/> SELECT ?p ?o WHERE { <http://dati.camera.it/ocd/deputato.rdf/d302103_19> ?p ?o }" --limit 50',
  ],
  async execute(input) {
    validateSelectQuery(input.query);
    const limitedQuery = injectLimit(input.query, input.limit);

    const queryFn = input.endpoint === "camera" ? cdQuery : snQuery;
    const results = await queryFn(limitedQuery);
    const raw = flattenBindings(results);

    if (raw.length === 0) {
      return { rows: [], columns: [] };
    }
    const columns = Object.keys(raw[0]);
    // Se la query porta già il suo LIMIT, `--limit` non è stato applicato: il
    // confronto `rows.length >= limit` parlerebbe di un taglio che non c'è
    // (o citerebbe il numero sbagliato). Il troncamento lo dichiara chi sa se
    // il limite è stato davvero iniettato (cfr. core/truncation.ts).
    const injected = limitedQuery !== input.query;
    return { rows: raw, columns, truncated: injected && raw.length >= input.limit };
  },
};
