import { z } from "zod";
import { cdQuery } from "../core/client.js";
import { OCD_PREFIXES } from "../core/prefixes.js";
import { flattenBindings } from "../core/flatten.js";
import type { Tool } from "./types.js";

const inputSchema = z.object({
  voteUri: z
    .string()
    .url()
    .describe("URI completo della votazione (es. http://dati.camera.it/ocd/votazione.rdf/vs19_001_001)"),
  limit: z.number().int().min(1).max(1000).default(700),
});

const columns = ["deputy_uri", "vote", "group_uri", "group_acronym"];

export const voteDetailTool: Tool<typeof inputSchema> = {
  name: "vote-detail",
  description:
    "[CAMERA] Voto individuale di ogni deputato in una singola votazione: come ha votato (Favorevole, Contrario, Astenuto, Non ha votato) con gruppo parlamentare. Richiede l'URI della votazione (ottenibile da votes list).",
  inputSchema,
  examples: [
    "italianparliament vote-detail show --vote-uri http://dati.camera.it/ocd/votazione.rdf/vs19_047_005",
    "italianparliament vote-detail show --vote-uri http://dati.camera.it/ocd/votazione.rdf/vs18_100_005 --format jsonl",
    "italianparliament vote-detail show --vote-uri http://dati.camera.it/ocd/votazione.rdf/vs19_010_003 --limit 50",
  ],
  async execute(input) {
    const query = `${OCD_PREFIXES}
SELECT DISTINCT ?deputy_uri ?type ?rif_gruppoParlamentare ?siglaGruppo
WHERE {
  ?v a ocd:voto .
  ?v ocd:rif_votazione <${input.voteUri}> .
  ?v ocd:rif_deputato ?deputy_uri .
  ?v dc:type ?type .
  OPTIONAL { ?v ocd:rif_gruppoParlamentare ?rif_gruppoParlamentare }
  OPTIONAL { ?v ocd:siglaGruppo ?siglaGruppo }
}
LIMIT ${input.limit}`;

    const results = await cdQuery(query);
    const raw = flattenBindings(results);
    const rows = raw.map((r) => ({
      deputy_uri: r.deputy_uri ?? "",
      vote: r.type ?? "",
      group_uri: r.rif_gruppoParlamentare ?? "",
      group_acronym: r.siglaGruppo ?? "",
    }));
    return { rows, columns };
  },
};
