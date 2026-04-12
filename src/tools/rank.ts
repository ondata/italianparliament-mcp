import { z } from "zod";
import { cdQuery } from "../core/client.js";
import { OCD_PREFIXES } from "../core/prefixes.js";
import { flattenBindings } from "../core/flatten.js";
import type { Tool } from "./types.js";

const RANK_BY = z.enum([
  "aic-primo-firmatario",
  "aic-cofirmatario",
  "bills-primo-firmatario",
  "bills-cofirmatario",
  "speeches",
]);

type RankBy = z.infer<typeof RANK_BY>;

const inputSchema = z.object({
  rankBy: RANK_BY.describe(
    "Dimensione di ranking: " +
      "aic-primo-firmatario (chi presenta più interrogazioni come primo firmatario), " +
      "aic-cofirmatario (chi co-firma più interrogazioni), " +
      "bills-primo-firmatario (chi presenta più disegni di legge come primo firmatario), " +
      "bills-cofirmatario (chi co-firma più disegni di legge), " +
      "speeches (chi interviene più volte in aula)",
  ),
  legislature: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Numero legislatura (es. 19). Se omesso, conta su tutte le legislature."),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

const columns = ["rank", "person_uri", "name", "count", "rank_by", "legislature"];

const LEG_BASE = "http://dati.camera.it/ocd/legislatura.rdf/repubblica_";
const RDFS_LABEL = "http://www.w3.org/2000/01/rdf-schema#label";

function stripLegLabel(label: string): string {
  return label.replace(/,\s*.* Legislatura della Repubblica\s*$/, "").trim();
}

function buildQuery(rankBy: RankBy, legislature: number | undefined, limit: number, offset: number): string {
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
  }

  if (legislature) {
    return `${OCD_PREFIXES}
SELECT ?person ?label (COUNT(?item) AS ?n)
WHERE {
  ${pattern}
  ${legFilter}
  ?person <${RDFS_LABEL}> ?label .
}
GROUP BY ?person ?label
ORDER BY DESC(?n)
LIMIT ${limit}
OFFSET ${offset}`;
  }

  // Senza legislatura: non si può filtrare tramite rif_leg sul deputato
  // (coprirebbe più mandati). Contiamo su tutti i dati.
  return `${OCD_PREFIXES}
SELECT ?person ?label (COUNT(?item) AS ?n)
WHERE {
  ${pattern}
  ?person <${RDFS_LABEL}> ?label .
}
GROUP BY ?person ?label
ORDER BY DESC(?n)
LIMIT ${limit}
OFFSET ${offset}`;
}

export const rankTool: Tool<typeof inputSchema> = {
  name: "rank",
  description:
    "[CAMERA] Classifica deputati per attività parlamentare: AIC (primo firmatario o co-firma), " +
    "disegni di legge (primo firmatario o co-firma), interventi in aula. " +
    "Una sola chiamata restituisce la top-N senza dover paginare migliaia di righe grezze. " +
    "Filtrabile per legislatura.",
  inputSchema,
  examples: [
    "italianparliament rank list --rank-by aic-primo-firmatario --legislature 19",
    "italianparliament rank list --rank-by speeches --legislature 19 --limit 10",
    "italianparliament rank list --rank-by bills-primo-firmatario --legislature 18 --limit 20",
    "italianparliament rank list --rank-by aic-cofirmatario --legislature 19",
  ],
  async execute(input) {
    const query = buildQuery(input.rankBy, input.legislature, input.limit, input.offset);
    const results = await cdQuery(query);
    const raw = flattenBindings(results);
    const rows = raw.map((r, i) => ({
      rank: String(input.offset + i + 1),
      person_uri: r.person ?? "",
      name: stripLegLabel(r.label ?? ""),
      count: r.n ?? "",
      rank_by: input.rankBy,
      legislature: input.legislature ? String(input.legislature) : "",
    }));
    return { rows, columns };
  },
};
