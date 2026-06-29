import { z } from "zod";
import { snQuery, cdQuery } from "../core/client.js";
import { OSR_PREFIXES, OCD_PREFIXES } from "../core/prefixes.js";
import { flattenBindings } from "../core/flatten.js";
import type { Tool } from "./types.js";

const inputSchema = z.object({
  ddlUri: z
    .string()
    .url()
    .optional()
    .describe("URI del DDL Senato (es. http://dati.senato.it/ddl/25597)"),
  uri: z
    .string()
    .url()
    .optional()
    .describe(
      "URI di un atto Camera (es. http://dati.camera.it/ocd/attocamera.rdf/ac19_2822): restituisce la cronologia completa dell'iter (timeline degli stati)",
    ),
  keyword: z
    .string()
    .optional()
    .describe("Cerca nel titolo del DDL (match case-insensitive, es. 'autonomia', 'lavoro')"),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Data inizio presentazione (YYYY-MM-DD)"),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Data fine presentazione (YYYY-MM-DD)"),
  legislature: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Numero legislatura"),
  limit: z.number().int().min(1).max(1000).default(100),
  offset: z.number().int().min(0).default(0),
});

const columns = [
  "ddl_uri",
  "title",
  "status",
  "status_date",
  "presentation_date",
  "initiative_description",
  "nature",
  "legislature",
  "phase",
  "phase_number",
  "html_url",
];

export const billProgressTool: Tool<typeof inputSchema> = {
  name: "bill-progress",
  description:
    "Iter legislativo di un disegno di legge. [SENATO] senza --uri: lista DDL al Senato con stato corrente dell'iter (assegnato, esame in commissione, approvato, ecc.), filtrabile per legislatura, parola chiave nel titolo e intervallo date. [CAMERA] con --uri <atto Camera>: cronologia completa (timeline) di tutti gli stati attraversati dall'atto, in ordine cronologico. Stesse colonne in entrambi i casi.",
  inputSchema,
  examples: [
    "italianparliament bill-progress list --legislature 19 --limit 20",
    "italianparliament bill-progress list --ddl-uri http://dati.senato.it/ddl/25597",
    "italianparliament bill-progress list --legislature 19 --keyword autonomia --limit 20",
    "italianparliament bill-progress list --legislature 19 --date-from 2026-04-01 --date-to 2026-04-13",
    "italianparliament bill-progress list --uri http://dati.camera.it/ocd/attocamera.rdf/ac19_2822",
    "italianparliament bill-progress list --uri http://dati.camera.it/ocd/attocamera.rdf/ac19_2822 --format jsonl",
  ],
  async execute(input) {
    // Routing per host: un URI Camera attiva il ramo "timeline iter".
    const isCamera = (u?: string): u is string =>
      !!u && u.includes("dati.camera.it");
    const cameraUri = isCamera(input.uri)
      ? input.uri
      : isCamera(input.ddlUri)
        ? input.ddlUri
        : undefined;
    if (cameraUri) {
      return cameraIterTimeline(cameraUri, columns);
    }

    // Se un URI Senato è passato via --uri, trattalo come ddlUri.
    const senatoDdlUri =
      input.ddlUri ??
      (input.uri && input.uri.includes("dati.senato.it")
        ? input.uri
        : undefined);

    const filters: string[] = [];
    if (senatoDdlUri) {
      filters.push(`FILTER(?s = <${senatoDdlUri}>)`);
    }
    if (input.keyword) {
      const escaped = input.keyword.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      filters.push(`FILTER(CONTAINS(LCASE(STR(?titolo)), LCASE("${escaped}")))`);
    }
    if (input.legislature) {
      filters.push(`?s osr:legislatura ${input.legislature} .`);
    }
    if (input.dateFrom) {
      filters.push(`FILTER(STR(?dataPresentazione) >= "${input.dateFrom}")`);
    }
    if (input.dateTo) {
      filters.push(`FILTER(STR(?dataPresentazione) <= "${input.dateTo}")`);
    }

    const query = `${OSR_PREFIXES}
PREFIX dc: <http://purl.org/dc/elements/1.1/>
SELECT ?s ?titolo ?statoDdl ?dataStatoDdl ?dataPresentazione
       ?descrIniziativa ?natura ?legislatura ?fase ?numeroFase
WHERE {
  ?s a osr:Ddl .
  OPTIONAL { ?s osr:titolo ?titolo }
  OPTIONAL { ?s osr:statoDdl ?statoDdl }
  OPTIONAL { ?s osr:dataStatoDdl ?dataStatoDdl }
  OPTIONAL { ?s osr:dataPresentazione ?dataPresentazione }
  OPTIONAL { ?s osr:descrIniziativa ?descrIniziativa }
  OPTIONAL { ?s osr:natura ?natura }
  OPTIONAL { ?s osr:legislatura ?legislatura }
  OPTIONAL { ?s osr:fase ?fase }
  OPTIONAL { ?s osr:numeroFase ?numeroFase }
  ${filters.join("\n  ")}
}
ORDER BY DESC(?dataPresentazione)
LIMIT ${input.limit}
OFFSET ${input.offset}`;

    const results = await snQuery(query);
    const raw = flattenBindings(results);
    const rows = raw.map((r) => {
      const ddl_uri = r.s ?? "";
      const idMatch = ddl_uri.match(/\/ddl\/(\d+)$/);
      const html_url = idMatch
        ? `https://www.senato.it/leggi-e-documenti/disegni-di-legge/scheda-ddl?tab=datiGenerali&did=${idMatch[1]}`
        : "";
      return {
        ddl_uri,
        title: r.titolo ?? "",
        status: r.statoDdl ?? "",
        status_date: r.dataStatoDdl ?? "",
        presentation_date: r.dataPresentazione ?? "",
        initiative_description: r.descrIniziativa ?? "",
        nature: r.natura ?? "",
        legislature: r.legislatura ?? "",
        phase: r.fase ?? "",
        phase_number: r.numeroFase ?? "",
        html_url,
      };
    });
    return { rows, columns };
  },
};

/**
 * Camera: cronologia completa dell'iter di un atto via `ocd:rif_statoIter`.
 * Una riga per stato attraversato, in ordine cronologico, mappata sullo
 * stesso schema colonne del ramo Senato (colonne non pertinenti vuote).
 */
async function cameraIterTimeline(uri: string, cols: string[]) {
  const query = `${OCD_PREFIXES}
SELECT DISTINCT ?titolo ?date ?stato WHERE {
  <${uri}> ocd:rif_statoIter ?st .
  OPTIONAL { <${uri}> dc:title ?titolo }
  ?st dc:date ?date .
  ?st dc:title ?stato .
}
ORDER BY ?date`;

  const results = await cdQuery(query);
  const raw = flattenBindings(results);

  const idMatch = uri.match(/ac(\d+)_(\d+)$/);
  const leg = idMatch ? idMatch[1] : "";
  const id = idMatch ? idMatch[2] : "";
  const html_url = idMatch
    ? `https://www.camera.it/leg${leg}/126?leg=${leg}&idDocumento=${id}`
    : "";

  const fmtDate = (d?: string): string =>
    d && /^\d{8}$/.test(d)
      ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`
      : (d ?? "");

  const rows = raw.map((r) => ({
    ddl_uri: uri,
    title: r.titolo ?? "",
    status: r.stato ?? "",
    status_date: fmtDate(r.date),
    presentation_date: "",
    initiative_description: "",
    nature: "",
    legislature: leg,
    phase: id ? `C.${id}` : "",
    phase_number: id,
    html_url,
  }));
  return { rows, columns: cols };
}
