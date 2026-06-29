import { z } from "zod";
import { cdQuery } from "../core/client.js";
import { OCD_PREFIXES } from "../core/prefixes.js";
import { flattenBindings } from "../core/flatten.js";
import { personHtmlUrl } from "../core/html-url.js";
import type { Tool } from "./types.js";

const inputSchema = z.object({
  voteUri: z
    .string()
    .url()
    .describe("URI completo della votazione (es. http://dati.camera.it/ocd/votazione.rdf/vs19_001_001)"),
  groupAcronym: z
    .string()
    .optional()
    .describe("Filtra per sigla gruppo (es. 'FDI', 'PD-IDP', 'M5S'). Case-sensitive."),
  voteType: z
    .enum(["Favorevole", "Contrario", "Astenuto", "Non ha votato"])
    .optional()
    .describe("Filtra per tipo di voto"),
  limit: z.number().int().min(1).max(1000).default(700),
});

const RDFS_LABEL = "http://www.w3.org/2000/01/rdf-schema#label";

function stripLegLabel(label: string): string {
  return label.replace(/,\s*.* Legislatura della Repubblica\s*$/, "").trim();
}

const columns = ["deputy_uri", "deputy_name", "vote", "group_uri", "group_acronym", "html_url"];

export const voteDetailTool: Tool<typeof inputSchema> = {
  name: "vote-detail",
  description:
    "[CAMERA] Voto individuale di ogni deputato in una singola votazione: come ha votato (Favorevole, Contrario, Astenuto, Non ha votato) con gruppo parlamentare. Richiede l'URI della votazione (ottenibile da votes list).",
  inputSchema,
  examples: [
    "italianparliament vote-detail show --vote-uri http://dati.camera.it/ocd/votazione.rdf/vs19_047_005",
    "italianparliament vote-detail show --vote-uri http://dati.camera.it/ocd/votazione.rdf/vs18_100_005 --format jsonl",
    "italianparliament vote-detail show --vote-uri http://dati.camera.it/ocd/votazione.rdf/vs19_010_003 --limit 50",
    "italianparliament vote-detail show --vote-uri http://dati.camera.it/ocd/votazione.rdf/vs19_641_046 --group-acronym FDI --vote-type Contrario",
  ],
  async execute(input) {
    const filters: string[] = [];
    if (input.groupAcronym) filters.push(`?v ocd:siglaGruppo ?_sg . FILTER(STR(?_sg) = "${input.groupAcronym}")`);
    if (input.voteType) filters.push(`FILTER(?type = "${input.voteType}")`);

    const query = `${OCD_PREFIXES}
SELECT DISTINCT ?deputy_uri ?deputy_label ?type ?rif_gruppoParlamentare ?siglaGruppo
WHERE {
  ?v a ocd:voto .
  ?v ocd:rif_votazione <${input.voteUri}> .
  ?v ocd:rif_deputato ?deputy_uri .
  ?v dc:type ?type .
  ${filters.join("\n  ")}
  OPTIONAL { ?deputy_uri <${RDFS_LABEL}> ?deputy_label }
  OPTIONAL { ?v ocd:rif_gruppoParlamentare ?rif_gruppoParlamentare }
  OPTIONAL { ?v ocd:siglaGruppo ?siglaGruppo }
}
LIMIT ${input.limit}`;

    const results = await cdQuery(query);
    const raw = flattenBindings(results);
    const rows = raw.map((r) => ({
      deputy_uri: r.deputy_uri ?? "",
      deputy_name: stripLegLabel(r.deputy_label ?? ""),
      vote: r.type ?? "",
      group_uri: r.rif_gruppoParlamentare ?? "",
      group_acronym: r.siglaGruppo ?? "",
      html_url: personHtmlUrl(r.deputy_uri),
    }));
    return { rows, columns };
  },
};
