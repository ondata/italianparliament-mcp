import { z } from "zod";
import { snQuery } from "../core/client.js";
import { OSR_PREFIXES } from "../core/prefixes.js";
import { flattenBindings } from "../core/flatten.js";
import type { Tool } from "./types.js";

// Categorie di voto del Senato (proprietà osr → etichetta leggibile).
// Virtuoso non supporta VALUES/BIND, quindi una query per categoria.
const CATEGORIES: { prop: string; label: string }[] = [
  { prop: "favorevole", label: "Favorevole" },
  { prop: "contrario", label: "Contrario" },
  { prop: "astenuto", label: "Astenuto" },
  { prop: "presenteNonVotante", label: "Presente non votante" },
  { prop: "inCongedoMissione", label: "In congedo/missione" },
];

const inputSchema = z.object({
  voteUri: z
    .string()
    .url()
    .describe("URI della votazione Senato (es. http://dati.senato.it/votazione/19-167-42), da senato-votes"),
  voteType: z
    .enum(["Favorevole", "Contrario", "Astenuto", "Presente non votante", "In congedo/missione"])
    .optional()
    .describe("Filtra per tipo di voto"),
});

const columns = ["senator_uri", "senator_name", "vote"];

export const senatoVoteDetailTool: Tool<typeof inputSchema> = {
  name: "senato-vote-detail",
  description:
    "[SENATO] Voto individuale di ogni senatore in una singola votazione d'Assemblea: come ha votato (Favorevole, Contrario, Astenuto, Presente non votante, In congedo/missione) con nome. Richiede l'URI della votazione (da senato-votes). Il gruppo non è incluso: incrociare con senator-group-members.",
  inputSchema,
  examples: [
    "italianparliament senato-vote-detail show --vote-uri http://dati.senato.it/votazione/19-167-42",
    "italianparliament senato-vote-detail show --vote-uri http://dati.senato.it/votazione/19-167-42 --vote-type Contrario --format jsonl",
  ],
  async execute(input) {
    const wanted = input.voteType
      ? CATEGORIES.filter((c) => c.label === input.voteType)
      : CATEGORIES;

    const results = await Promise.all(
      wanted.map(async (cat) => {
        const query = `${OSR_PREFIXES}
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
SELECT DISTINCT ?sen ?nome ?cognome WHERE {
  <${input.voteUri}> osr:${cat.prop} ?sen .
  OPTIONAL { ?sen foaf:firstName ?nome }
  OPTIONAL { ?sen foaf:lastName ?cognome }
}`;
        const raw = flattenBindings(await snQuery(query));
        return raw.map((r) => ({
          senator_uri: r.sen ?? "",
          senator_name: `${r.nome ?? ""} ${r.cognome ?? ""}`.trim(),
          vote: cat.label,
        }));
      }),
    );

    const rows = results.flat();
    if (rows.length === 0) {
      throw new Error(`Nessun voto trovato per la votazione: ${input.voteUri}`);
    }
    return { rows, columns };
  },
};
