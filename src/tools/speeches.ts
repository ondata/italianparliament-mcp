import { z } from "zod";
import { cdQuery, snQuery } from "../core/client.js";
import { OCD_PREFIXES, OSR_PREFIXES } from "../core/prefixes.js";
import { flattenBindings } from "../core/flatten.js";
import type { Tool } from "./types.js";

const inputSchema = z.object({
  chamber: z
    .enum(["camera", "senato"])
    .optional()
    .default("camera")
    .describe("Ramo del parlamento: camera o senato"),
  legislature: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Numero legislatura"),
  deputyUri: z
    .string()
    .url()
    .optional()
    .describe(
      "URI completo del parlamentare (Camera: http://dati.camera.it/ocd/deputato.rdf/..., Senato: http://dati.senato.it/senatore/...)",
    ),
  countOnly: z
    .boolean()
    .optional()
    .default(false)
    .describe("Se true, restituisce solo il conteggio totale degli interventi"),
  limit: z.number().int().min(1).max(1000).default(100),
  offset: z.number().int().min(0).default(0),
});

const cameraColumns = [
  "uri",
  "label",
  "deputy_uri",
  "document_url",
  "modified",
];

const senatoColumns = [
  "uri",
  "label",
  "senator_uri",
  "session_date",
  "session_number",
  "topic_uri",
];

export const speechesTool: Tool<typeof inputSchema> = {
  name: "speeches",
  description:
    "[CAMERA+SENATO] Interventi in aula con link al documento ufficiale. Camera: stenografico/bollettino, Senato: seduta e argomento. Filtrabile per legislatura e parlamentare. Supporta conteggio rapido con countOnly.",
  inputSchema,
  examples: [
    "italianparliament speeches list --legislature 19 --limit 10",
    "italianparliament speeches list --chamber senato --legislature 19 --limit 10",
    "italianparliament speeches list --deputy-uri http://dati.camera.it/ocd/deputato.rdf/d306921_17",
    "italianparliament speeches list --deputy-uri http://dati.senato.it/senatore/32726 --chamber senato --count-only",
    "italianparliament speeches list --deputy-uri http://dati.camera.it/ocd/deputato.rdf/d306921_17 --count-only",
    "italianparliament speeches list --legislature 18 --format jsonl",
  ],
  async execute(input) {
    if (input.chamber === "senato") {
      return executeSenato(input);
    }
    return executeCamera(input);
  },
};

/* ── Camera ─────────────────────────────────────────────────────────── */

async function executeCamera(input: z.infer<typeof inputSchema>) {
  const filters: string[] = [];
  if (input.legislature) {
    filters.push(
      `FILTER(STRSTARTS(STR(?s), "http://dati.camera.it/ocd/intervento.rdf/in${input.legislature}_"))`,
    );
  }
  if (input.deputyUri) {
    filters.push(`?s ocd:rif_deputato <${input.deputyUri}> .`);
  }

  if (input.countOnly) {
    const countQuery = `${OCD_PREFIXES}
SELECT (COUNT(DISTINCT ?s) AS ?n)
WHERE {
  ?s a ocd:intervento .
  ${filters.join("\n  ")}
}`;
    const results = await cdQuery(countQuery);
    const raw = flattenBindings(results);
    const count = Number(raw[0]?.n ?? 0);
    return { rows: [{ count }], columns: ["count"] };
  }

  const query = `${OCD_PREFIXES}
SELECT DISTINCT ?s ?label ?rif_deputato ?relation ?modified
WHERE {
  ?s a ocd:intervento .
  ?s rdfs:label ?label .
  OPTIONAL { ?s ocd:rif_deputato ?rif_deputato }
  OPTIONAL { ?s dc:relation ?relation }
  OPTIONAL { ?s ods:modified ?modified }
  ${filters.join("\n  ")}
}
ORDER BY DESC(?modified)
LIMIT ${input.limit}
OFFSET ${input.offset}`;

  const results = await cdQuery(query);
  const raw = flattenBindings(results);
  const rows = raw.map((r) => ({
    uri: r.s ?? "",
    label: r.label ?? "",
    deputy_uri: r.rif_deputato ?? "",
    document_url: r.relation ?? "",
    modified: r.modified ?? "",
  }));
  return { rows, columns: cameraColumns };
}

/* ── Senato ─────────────────────────────────────────────────────────── */

async function executeSenato(input: z.infer<typeof inputSchema>) {
  const filters: string[] = [];
  if (input.legislature) {
    filters.push(`?sed osr:legislatura ${input.legislature} .`);
  }
  if (input.deputyUri) {
    filters.push(`<${input.deputyUri}> osr:interviene ?i .`);
  }

  if (input.countOnly) {
    const countQuery = `${OSR_PREFIXES}
SELECT (COUNT(DISTINCT ?i) AS ?n)
WHERE {
  ?i a osr:Intervento .
  ?i osr:seduta ?sed .
  ${filters.join("\n  ")}
}`;
    const results = await snQuery(countQuery);
    const raw = flattenBindings(results);
    const count = Number(raw[0]?.n ?? 0);
    return { rows: [{ count }], columns: ["count"] };
  }

  const query = `${OSR_PREFIXES}
SELECT DISTINCT ?i ?lbl ?ds ?ns ?obj
WHERE {
  ?i a osr:Intervento .
  ?i rdfs:label ?lbl .
  ?i osr:seduta ?sed .
  ?sed osr:dataSeduta ?ds .
  ?sed osr:numeroSeduta ?ns .
  ${input.deputyUri ? `<${input.deputyUri}> osr:interviene ?i .` : ""}
  OPTIONAL { ?i osr:oggetto ?obj }
  ${filters.filter((f) => !f.includes("osr:interviene")).join("\n  ")}
}
ORDER BY DESC(?ds) DESC(?ns)
LIMIT ${input.limit}
OFFSET ${input.offset}`;

  const results = await snQuery(query);
  const raw = flattenBindings(results);
  const rows = raw.map((r) => ({
    uri: r.i ?? "",
    label: r.lbl ?? "",
    senator_uri: input.deputyUri ?? "",
    session_date: r.ds ?? "",
    session_number: r.ns ?? "",
    topic_uri: r.obj ?? "",
  }));
  return { rows, columns: senatoColumns };
}
