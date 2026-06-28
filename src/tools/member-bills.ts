import { z } from "zod";
import { cdQuery, snQuery } from "../core/client.js";
import { OCD_PREFIXES, OSR_PREFIXES } from "../core/prefixes.js";
import { flattenBindings } from "../core/flatten.js";
import { decodeHtml } from "../core/decode-html.js";
import type { Tool } from "./types.js";

const inputSchema = z.object({
  memberUri: z
    .string()
    .url()
    .describe("URI deputato (dati.camera.it) o senatore (dati.senato.it)"),
  legislature: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Numero legislatura (default: 19)"),
  limit: z.number().int().min(1).max(1000).default(100),
  offset: z.number().int().min(0).default(0),
});

const columns = [
  "uri",
  "title",
  "date",
  "initiative_type",
  "status",
  "identifier",
  "chamber",
];

export const memberBillsTool: Tool<typeof inputSchema> = {
  name: "member-bills",
  description:
    "[CAMERA+SENATO] DDL/proposte di legge presentati come primo firmatario da un deputato o senatore. Rilevamento automatico della camera dall'URI.",
  inputSchema,
  examples: [
    "italianparliament member-bills list --member-uri http://dati.camera.it/ocd/deputato.rdf/d308920_19",
    "italianparliament member-bills list --member-uri http://dati.senato.it/senatore/32 --legislature 19",
    "italianparliament member-bills list --member-uri http://dati.senato.it/senatore/32 --limit 20 --format jsonl",
  ],
  async execute(input) {
    const leg = input.legislature ?? 19;
    const isCamera = input.memberUri.includes("dati.camera.it");

    if (isCamera) {
      return executeCamera(input.memberUri, leg, input.limit, input.offset);
    } else {
      return executeSenato(input.memberUri, leg, input.limit, input.offset);
    }
  },
};

async function executeCamera(
  deputyUri: string,
  leg: number,
  limit: number,
  offset: number,
) {
  const legUri = `http://dati.camera.it/ocd/legislatura.rdf/repubblica_${leg}`;
  const query = `${OCD_PREFIXES}
SELECT DISTINCT ?uri ?title ?date ?type ?initiative ?identifier WHERE {
  ?uri ocd:primo_firmatario <${deputyUri}> .
  ?uri ocd:rif_leg <${legUri}> .
  ?uri a ocd:atto .
  OPTIONAL { ?uri dc:title ?title }
  OPTIONAL { ?uri dc:date ?date }
  OPTIONAL { ?uri dc:type ?type }
  OPTIONAL { ?uri ocd:iniziativa ?initiative }
  OPTIONAL { ?uri dc:identifier ?identifier }
  FILTER(!BOUND(?type) || ?type = "Progetto di Legge" || ?type = "Proposta di Legge")
} ORDER BY DESC(?date) LIMIT ${limit} OFFSET ${offset}`;

  const results = await cdQuery(query);
  const rows = flattenBindings(results).map((r) => ({
    uri: r.uri ?? "",
    title: decodeHtml(r.title ?? ""),
    date: r.date ?? "",
    initiative_type: r.initiative ?? "",
    status: "",
    identifier: r.identifier ?? "",
    chamber: "camera",
  }));
  return { rows, columns };
}

async function executeSenato(
  senatorUri: string,
  leg: number,
  limit: number,
  offset: number,
) {
  const idMatch = senatorUri.match(/\/senatore\/(\d+)$/);
  if (!idMatch) throw new Error(`URI senatore non valido: ${senatorUri}`);
  const senId = idMatch[1];

  const query = `${OSR_PREFIXES}
SELECT DISTINCT ?ddl ?titolo ?data ?tipo ?stato ?idDdl WHERE {
  ?ddl a osr:Ddl .
  ?ddl osr:legislatura ?leg . FILTER(STR(?leg) = "${leg}")
  ?ddl osr:iniziativa ?init .
  FILTER(REGEX(STR(?init), "[^0-9]${senId}$"))
  ?init osr:primoFirmatario ?pf . FILTER(STR(?pf) = "1")
  OPTIONAL { ?ddl osr:titolo ?titolo }
  OPTIONAL { ?ddl osr:dataPresentazione ?data }
  OPTIONAL { ?init osr:tipoIniziativa ?tipo }
  OPTIONAL { ?ddl osr:statoDdl ?stato }
  OPTIONAL { ?ddl osr:idDdl ?idDdl }
} ORDER BY DESC(?data) LIMIT ${limit} OFFSET ${offset}`;

  const results = await snQuery(query);
  const rows = flattenBindings(results).map((r) => ({
    uri: r.ddl ?? "",
    title: decodeHtml(r.titolo ?? ""),
    date: r.data ?? "",
    initiative_type: r.tipo ?? "",
    status: r.stato ?? "",
    identifier: r.idDdl ?? "",
    chamber: "senato",
  }));
  return { rows, columns };
}
