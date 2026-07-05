import { z } from "zod";
import { snQuery } from "../core/client.js";
import { OSR_PREFIXES } from "../core/prefixes.js";
import { flattenBindings } from "../core/flatten.js";
import { actHtmlUrl, ddlRssUrl } from "../core/html-url.js";
import { extractBillNumber } from "../core/bill-number.js";
import type { Tool } from "./types.js";

const inputSchema = z.object({
  legislature: z
    .number()
    .int()
    .positive()
    .default(19)
    .describe("Numero legislatura Senato (default 19)"),
  ddlUri: z
    .string()
    .url()
    .optional()
    .describe("Filtra le votazioni collegate a un DDL (es. http://dati.senato.it/ddl/58039)"),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Data inizio seduta (YYYY-MM-DD)"),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Data fine seduta (YYYY-MM-DD)"),
  countOnly: z
    .boolean()
    .optional()
    .describe("Se true, restituisce solo il numero totale di votazioni (colonna count)"),
  limit: z.number().int().positive().max(1000).default(100),
  offset: z.number().int().nonnegative().default(0),
});

const columns = [
  "uri",
  "date",
  "number",
  "type",
  "label",
  "outcome",
  "in_favour",
  "against",
  "abstentions",
  "present",
  "voters",
  "majority",
  "bill_number",
  "ddl_uri",
  "ddl_html_url",
  "rss_url",
  "object_uri",
];

export const senatoVotesTool: Tool<typeof inputSchema> = {
  name: "senato-votes",
  description:
    "[SENATO] Lista votazioni dell'Assemblea del Senato con esito, contatori (favorevoli, contrari, astenuti, presenti, votanti), tipo, data seduta e DDL collegato. Filtrabile per legislatura, data e DDL. Per il voto del singolo senatore usare senato-vote-detail.",
  inputSchema,
  examples: [
    "italianparliament senato-votes list --legislature 19 --limit 50",
    "italianparliament senato-votes list --legislature 19 --date-from 2026-01-01 --date-to 2026-03-31",
    "italianparliament senato-votes list --ddl-uri http://dati.senato.it/ddl/58039 --format jsonl",
  ],
  async execute(input) {
    const ddlPattern = input.ddlUri
      ? `?v osr:oggetto ?oggetto . ?oggetto osr:relativoA <${input.ddlUri}> .`
      : `OPTIONAL { ?v osr:oggetto ?oggetto . OPTIONAL { ?oggetto osr:relativoA ?ddl } }`;
    const dateFromFilter = input.dateFrom
      ? `FILTER(?date >= "${input.dateFrom}"^^xsd:date)`
      : "";
    const dateToFilter = input.dateTo
      ? `FILTER(?date <= "${input.dateTo}"^^xsd:date)`
      : "";

    const coreSelect = `SELECT DISTINCT ?v ?date ?numero ?tipo ?label ?esito
                ?favorevoli ?contrari ?astenuti ?presenti ?votanti ?maggioranza
                ?ddl ?oggetto
WHERE {
  ?v a osr:Votazione ; osr:legislatura ${input.legislature} ; osr:seduta ?s .
  OPTIONAL { ?s osr:dataSeduta ?date }
  OPTIONAL { ?v rdfs:label ?label }
  OPTIONAL { ?v osr:numero ?numero }
  OPTIONAL { ?v osr:tipoVotazione ?tipo }
  OPTIONAL { ?v osr:esito ?esito }
  OPTIONAL { ?v osr:favorevoli ?favorevoli }
  OPTIONAL { ?v osr:contrari ?contrari }
  OPTIONAL { ?v osr:astenuti ?astenuti }
  OPTIONAL { ?v osr:presenti ?presenti }
  OPTIONAL { ?v osr:votanti ?votanti }
  OPTIONAL { ?v osr:maggioranza ?maggioranza }
  ${ddlPattern}
  ${dateFromFilter}
  ${dateToFilter}
}`;

    // Count minimale (solo pattern vincolanti): il wrap dell'intero SELECT con
    // gli OPTIONAL su ~64k votazioni manda Virtuoso in timeout.
    const countWhere = [`?v a osr:Votazione ; osr:legislatura ${input.legislature} .`];
    if (input.ddlUri)
      countWhere.push(`?v osr:oggetto ?oggetto . ?oggetto osr:relativoA ?ddl . FILTER(?ddl = <${input.ddlUri}>)`);
    if (input.dateFrom || input.dateTo)
      countWhere.push(`?v osr:seduta ?sed . ?sed osr:dataSeduta ?date . ${dateFromFilter} ${dateToFilter}`);

    const query = input.countOnly
      ? `${OSR_PREFIXES}\nSELECT (COUNT(DISTINCT ?v) AS ?count) WHERE {\n${countWhere.join("\n  ")}\n}`
      : `${OSR_PREFIXES}\n${coreSelect}\nORDER BY DESC(?date) DESC(?numero)\nLIMIT ${input.limit}\nOFFSET ${input.offset}`;

    const results = await snQuery(query);
    if (input.countOnly) {
      const c = flattenBindings(results)[0]?.count ?? "0";
      return { rows: [{ count: c }], columns: ["count"] };
    }
    const raw = flattenBindings(results);
    // Un voto su DDL unificati è collegato a più ddl via osr:relativoA:
    // il join moltiplica le righe. Collassiamo per URI votazione e
    // concateniamo i DDL distinti.
    const byUri = new Map<string, Record<string, string>>();
    for (const r of raw) {
      const uri = r.v ?? "";
      const ddl = r.ddl ?? "";
      const existing = byUri.get(uri);
      if (existing) {
        if (ddl && !existing.ddl_uri.split(" | ").includes(ddl)) {
          existing.ddl_uri = existing.ddl_uri ? `${existing.ddl_uri} | ${ddl}` : ddl;
        }
        continue;
      }
      byUri.set(uri, {
        uri,
        date: r.date ?? "",
        number: r.numero ?? "",
        type: r.tipo ?? "",
        label: r.label ?? "",
        outcome: r.esito ?? "",
        in_favour: r.favorevoli ?? "",
        against: r.contrari ?? "",
        abstentions: r.astenuti ?? "",
        present: r.presenti ?? "",
        voters: r.votanti ?? "",
        majority: r.maggioranza ?? "",
        bill_number: extractBillNumber(r.label),
        ddl_uri: ddl,
        object_uri: r.oggetto ?? "",
      });
    }
    // Fallback: alcuni voti (tipicamente le fiducie) non hanno osr:oggetto e
    // quindi nessun ddl_uri via grafo, ma citano il DDL nel label. Risolviamo il
    // numero → URI in un'unica query via osr:fase="S.<num>" (univoco intra-leg;
    // niente VALUES batch su Virtuoso → OR-chain). Solo per i label che citano
    // davvero un DDL (bill_number non vuoto).
    const needing = [...byUri.values()].filter((v) => !v.ddl_uri && v.bill_number);
    const nums = [...new Set(needing.map((v) => v.bill_number))];
    if (nums.length) {
      const filter = nums.map((n) => `STR(?f) = "S.${n}"`).join(" || ");
      const fbQuery = `${OSR_PREFIXES}
SELECT ?ddl ?f WHERE {
  ?ddl a osr:Ddl ; osr:legislatura ${input.legislature} ; osr:fase ?f .
  FILTER(${filter})
}`;
      const byFase = new Map<string, string>();
      for (const r of flattenBindings(await snQuery(fbQuery))) {
        const num = (r.f ?? "").replace(/^S\./, "");
        if (num && r.ddl && !byFase.has(num)) byFase.set(num, r.ddl);
      }
      for (const v of needing) {
        const ddl = byFase.get(v.bill_number);
        if (ddl) v.ddl_uri = ddl;
        // Difesa: il numero citato nel label non corrisponde ad alcun DDL della
        // legislatura (es. refuso nella fonte, "DDL n. 1994" per S.1944). Non
        // esporlo come identificativo interrogabile: il testo grezzo resta in
        // `label`, ma `bill_number` deve solo contenere numeri verificati.
        else v.bill_number = "";
      }
    }
    const joinMap = (ddl: string, fn: (u: string) => string): string =>
      ddl
        .split(" | ")
        .map((u) => fn(u.trim()))
        .filter(Boolean)
        .join(" | ");
    const rows = [...byUri.values()].map((v) => ({
      ...v,
      ddl_html_url: joinMap(v.ddl_uri, actHtmlUrl),
      rss_url: joinMap(v.ddl_uri, (u) => ddlRssUrl(u, input.legislature)),
    }));
    return { rows, columns };
  },
};
