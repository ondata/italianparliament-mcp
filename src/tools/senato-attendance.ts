import { z } from "zod";
import { snQuery } from "../core/client.js";
import { OSR_PREFIXES } from "../core/prefixes.js";
import { flattenBindings } from "../core/flatten.js";
import { personHtmlUrl } from "../core/html-url.js";
import type { Tool } from "./types.js";

// Stesse categorie di senato-vote-detail.ts (proprietà osr inverse voto→senatore).
const CATEGORIES: { prop: string; column: string }[] = [
  { prop: "favorevole", column: "favorevole" },
  { prop: "contrario", column: "contrario" },
  { prop: "astenuto", column: "astenuto" },
  { prop: "presenteNonVotante", column: "presente_non_votante" },
  { prop: "inCongedoMissione", column: "in_congedo_missione" },
];

const inputSchema = z.object({
  senatorUri: z
    .string()
    .url()
    .describe("URI completo del senatore (es. http://dati.senato.it/senatore/3900)"),
  legislature: z
    .number()
    .int()
    .positive()
    .default(19)
    .describe("Numero legislatura Senato (default 19). L'URI senatore non è legata alla legislatura, quindi va indicata a parte."),
});

const columns = [
  "senator_uri",
  "senator_name",
  "html_url",
  "legislature",
  "favorevole",
  "contrario",
  "astenuto",
  "presente_non_votante",
  "in_congedo_missione",
  "totale",
];

export const senatoAttendanceTool: Tool<typeof inputSchema> = {
  name: "senato-attendance",
  description:
    "[SENATO] Conteggio aggregato dei voti espressi da un senatore in tutte le votazioni d'Assemblea di una legislatura (favorevole/contrario/astenuto/presente non votante/in congedo o missione). Richiede l'URI del senatore e la legislatura (l'URI non la contiene). Per un senatore attivo per l'intera legislatura, totale è prossimo (non sempre identico: piccolo residuo di voti non tracciati in nessuna categoria) al numero di votazioni della legislatura (senato-votes --count-only); per un senatore a vita o subentrato a mandato, totale è naturalmente inferiore.",
  inputSchema,
  examples: [
    "italianparliament senato-attendance show --senator-uri http://dati.senato.it/senatore/3900 --legislature 19",
    "italianparliament senato-attendance show --senator-uri http://dati.senato.it/senatore/3900 --legislature 19 --format jsonl",
  ],
  async execute(input) {
    const nameQuery = `${OSR_PREFIXES}
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
SELECT ?nome ?cognome WHERE {
  OPTIONAL { <${input.senatorUri}> foaf:firstName ?nome }
  OPTIONAL { <${input.senatorUri}> foaf:lastName ?cognome }
} LIMIT 1`;

    const [nameResults, counts] = await Promise.all([
      snQuery(nameQuery),
      Promise.all(
        CATEGORIES.map(async (cat) => {
          const query = `${OSR_PREFIXES}
SELECT (COUNT(?v) AS ?n) WHERE {
  ?v osr:${cat.prop} <${input.senatorUri}> ; osr:legislatura ${input.legislature} .
}`;
          const raw = flattenBindings(await snQuery(query));
          return Number(raw[0]?.n ?? 0);
        }),
      ),
    ]);

    const totale = counts.reduce((a, b) => a + b, 0);
    if (totale === 0) {
      throw new Error(
        `Nessun voto trovato per il senatore ${input.senatorUri} in legislatura ${input.legislature}.`,
      );
    }

    const nameRow = flattenBindings(nameResults)[0];
    const senator_name = `${nameRow?.nome ?? ""} ${nameRow?.cognome ?? ""}`.trim();

    const row: Record<string, string> = {
      senator_uri: input.senatorUri,
      senator_name,
      html_url: personHtmlUrl(input.senatorUri),
      legislature: String(input.legislature),
      totale: String(totale),
    };
    CATEGORIES.forEach((cat, i) => {
      row[cat.column] = String(counts[i]);
    });

    return { rows: [row], columns };
  },
};
