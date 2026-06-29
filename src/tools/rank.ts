import { z } from "zod";
import { cdQuery, snQuery } from "../core/client.js";
import { OCD_PREFIXES, OSR_PREFIXES } from "../core/prefixes.js";
import { flattenBindings } from "../core/flatten.js";
import { personHtmlUrl } from "../core/html-url.js";
import type { Tool } from "./types.js";

const RANK_BY = z.enum([
  "aic-primo-firmatario",
  "aic-cofirmatario",
  "bills-primo-firmatario",
  "bills-cofirmatario",
  "speeches",
  "sindacato-ispettivo",
  "ddl-senato",
]);

type RankBy = z.infer<typeof RANK_BY>;

const CAMERA_DIMENSIONS = new Set([
  "aic-primo-firmatario",
  "aic-cofirmatario",
  "bills-primo-firmatario",
  "bills-cofirmatario",
  "speeches",
]);

const inputSchema = z.object({
  rankBy: RANK_BY.describe(
    "Dimensione di ranking. Camera: " +
      "aic-primo-firmatario, aic-cofirmatario, bills-primo-firmatario, bills-cofirmatario, speeches. " +
      "Senato: sindacato-ispettivo (interrogazioni/interpellanze/mozioni), ddl-senato (disegni di legge).",
  ),
  legislature: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Numero legislatura (es. 19). Se omesso, conta su tutte le legislature."),
  order: z
    .enum(["desc", "asc"])
    .default("desc")
    .describe("Ordinamento: desc (i piu attivi) o asc (i meno attivi)"),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

const columns = ["rank", "chamber", "person_uri", "name", "count", "rank_by", "legislature", "html_url"];

const LEG_BASE = "http://dati.camera.it/ocd/legislatura.rdf/repubblica_";
const RDFS_LABEL = "http://www.w3.org/2000/01/rdf-schema#label";

function stripLegLabel(label: string): string {
  return label.replace(/,\s*.* Legislatura della Repubblica\s*$/, "").trim();
}

function stripSenPrefix(name: string): string {
  return name.replace(/^Sen\.\s*/i, "");
}

function buildCameraQuery(rankBy: RankBy, legislature: number | undefined, order: "desc" | "asc", limit: number, offset: number): string {
  const legFilter = legislature
    ? `?person a ocd:deputato .\n  ?person ocd:rif_leg <${LEG_BASE}${legislature}> .`
    : `?person a ocd:deputato .`;

  let pattern: string;
  switch (rankBy) {
    case "aic-primo-firmatario":
      pattern = `?item a ocd:aic ; ocd:primo_firmatario ?person .`;
      break;
    case "aic-cofirmatario":
      pattern = `?item a ocd:aic ; ocd:altro_firmatario ?person .`;
      break;
    case "bills-primo-firmatario":
      pattern = `?item a ocd:atto ; ocd:primo_firmatario ?person .`;
      break;
    case "bills-cofirmatario":
      pattern = `?item a ocd:atto ; ocd:altro_firmatario ?person .`;
      break;
    case "speeches":
      pattern = `?item a ocd:intervento ; ocd:rif_deputato ?person .`;
      break;
    default:
      throw new Error(`Camera rank does not support ${rankBy}`);
  }

  return `${OCD_PREFIXES}
SELECT ?person ?label (COUNT(?item) AS ?n)
WHERE {
  ${pattern}
  ${legFilter}
  ?person <${RDFS_LABEL}> ?label .
}
GROUP BY ?person ?label
ORDER BY ${order === "asc" ? "ASC" : "DESC"}(?n)
LIMIT ${limit}
OFFSET ${offset}`;
}

function buildSenatoQuery(rankBy: RankBy, legislature: number | undefined, order: "desc" | "asc", limit: number, offset: number): string {
  const legFilter = legislature ? `?s osr:legislatura ${legislature} .` : "";

  let itemType: string;
  switch (rankBy) {
    case "sindacato-ispettivo":
      itemType = "osr:SindacatoIspettivo";
      break;
    case "ddl-senato":
      itemType = "osr:Ddl";
      break;
    default:
      throw new Error(`Senato rank does not support ${rankBy}`);
  }

  return `${OSR_PREFIXES}
SELECT ?person (MIN(?nome) AS ?label) (COUNT(DISTINCT ?s) AS ?n)
WHERE {
  ?s a ${itemType} .
  ${legFilter}
  ?s osr:iniziativa ?iniz .
  ?iniz osr:senatore ?person .
  ?iniz osr:presentatore ?nome .
}
GROUP BY ?person
ORDER BY ${order === "asc" ? "ASC" : "DESC"}(?n)
LIMIT ${limit}
OFFSET ${offset}`;
}

export const rankTool: Tool<typeof inputSchema> = {
  name: "rank",
  description:
    "[CAMERA+SENATO] Classifica parlamentari per attivita. " +
    "Camera: AIC (primo firmatario o co-firma), disegni di legge (primo firmatario o co-firma), interventi in aula. " +
    "Senato: sindacato ispettivo (interrogazioni/interpellanze/mozioni), DDL. " +
    "Una sola chiamata restituisce la top-N. Filtrabile per legislatura.",
  inputSchema,
  examples: [
    "italianparliament rank list --rank-by aic-primo-firmatario --legislature 19",
    "italianparliament rank list --rank-by speeches --legislature 19 --limit 10",
    "italianparliament rank list --rank-by speeches --legislature 19 --order asc --limit 10",
    "italianparliament rank list --rank-by sindacato-ispettivo --legislature 19 --limit 10",
    "italianparliament rank list --rank-by ddl-senato --legislature 19 --limit 10",
    "italianparliament rank list --rank-by bills-primo-firmatario --legislature 18 --limit 20",
    "italianparliament rank list --rank-by aic-cofirmatario --legislature 19",
  ],
  async execute(input) {
    const isCamera = CAMERA_DIMENSIONS.has(input.rankBy);
    const chamber = isCamera ? "camera" : "senato";

    const query = isCamera
      ? buildCameraQuery(input.rankBy, input.legislature, input.order, input.limit, input.offset)
      : buildSenatoQuery(input.rankBy, input.legislature, input.order, input.limit, input.offset);

    const results = isCamera ? await cdQuery(query) : await snQuery(query);
    const raw = flattenBindings(results);
    const rows = raw.map((r, i) => ({
      rank: String(input.offset + i + 1),
      chamber,
      person_uri: r.person ?? "",
      name: isCamera ? stripLegLabel(r.label ?? "") : stripSenPrefix(r.label ?? ""),
      count: r.n ?? "",
      rank_by: input.rankBy,
      legislature: input.legislature ? String(input.legislature) : "",
      html_url: personHtmlUrl(r.person),
    }));
    return { rows, columns };
  },
};
