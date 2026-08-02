import { z } from "zod";
import { snQuery } from "../core/client.js";
import { OSR_PREFIXES } from "../core/prefixes.js";
import { flattenBindings } from "../core/flatten.js";
import { personHtmlUrl } from "../core/html-url.js";
import {
  CURRENT_LEGISLATURE,
  formatLegislatureList,
} from "../core/legislature-choice.js";
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
    .min(1)
    .optional()
    .describe("Numero legislatura Senato. L'URI del senatore non la contiene, ma se omessa viene dedotta dalle legislature in cui quel senatore ha voti registrati: per chi non siede nella legislatura in corso si ottiene comunque il suo mandato invece di un vuoto."),
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
    "[SENATO] Conteggio aggregato dei voti espressi da un senatore in tutte le votazioni d'Assemblea di una legislatura (favorevole/contrario/astenuto/presente non votante/in congedo o missione). Richiede l'URI del senatore; la legislatura è facoltativa (se omessa si deduce da quelle in cui il senatore ha voti registrati: per chi non siede più in Senato si ottiene il suo ultimo mandato invece di un vuoto). Per un senatore attivo per l'intera legislatura, totale è prossimo (non sempre identico: piccolo residuo di voti non tracciati in nessuna categoria) al numero di votazioni della legislatura (senato-votes --count-only); per un senatore a vita o subentrato a mandato, totale è naturalmente inferiore.",
  inputSchema,
  examples: [
    "italianparliament senato-attendance show --senator-uri http://dati.senato.it/senatore/3900 --legislature 19",
    "italianparliament senato-attendance show --senator-uri http://dati.senato.it/senatore/32609",
    "italianparliament senato-attendance show --senator-uri http://dati.senato.it/senatore/3900 --legislature 19 --format jsonl",
  ],
  async execute(input) {
    // Legislature in cui il senatore ha voti registrati, cercate con lo stesso
    // pattern che il tool poi conta: una legislatura di mandato senza voti nel
    // grafo porterebbe comunque a un risultato vuoto, quindi è questa la
    // domanda giusta. Serve sia a scegliere la legislatura quando non è
    // indicata, sia a spiegare un totale a zero.
    const votedLegislatures = async (): Promise<number[]> => {
      const union = CATEGORIES.map(
        (c) => `{ ?v osr:${c.prop} <${input.senatorUri}> }`,
      ).join(" UNION ");
      const q = `${OSR_PREFIXES}
SELECT DISTINCT ?leg WHERE { ${union} ?v osr:legislatura ?leg }`;
      return flattenBindings(await snQuery(q))
        .map((r) => Number(r.leg))
        .filter((n) => Number.isInteger(n) && n > 0)
        .sort((a, b) => a - b);
    };

    let voted: number[] | undefined;
    let legislature = input.legislature;
    if (legislature === undefined) {
      voted = await votedLegislatures().catch(() => undefined);
      if (voted === undefined) {
        // Sonda fallita: si torna al comportamento storico invece di bloccare.
        legislature = CURRENT_LEGISLATURE;
      } else if (voted.length === 0) {
        throw new Error(
          `Nessun voto d'Assemblea risulta per ${input.senatorUri} in NESSUNA legislatura: verifica l'URI del senatore con "search find --name <cognome> --chamber senato", aggiungendo "--legislature <n>" se non è più in carica (senza, la ricerca al Senato guarda solo i senatori in carica). Un URI valido di chi non ha mai votato in Aula è possibile ma raro.`,
        );
      } else if (voted.includes(CURRENT_LEGISLATURE)) {
        // Chi siede nella legislatura in corso: resta il comportamento atteso,
        // senza obbligare a indicarla.
        legislature = CURRENT_LEGISLATURE;
      } else if (voted.length === 1) {
        legislature = voted[0];
      } else {
        throw new Error(
          `${input.senatorUri} non ha voti nella legislatura in corso ma ne ha in più legislature passate (${formatLegislatureList(voted)}): indica quale con --legislature.`,
        );
      }
    }

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
  ?v osr:${cat.prop} <${input.senatorUri}> ; osr:legislatura ${legislature} .
}`;
          const raw = flattenBindings(await snQuery(query));
          return Number(raw[0]?.n ?? 0);
        }),
      ),
    ]);

    const totale = counts.reduce((a, b) => a + b, 0);
    if (totale === 0) {
      // Il vuoto quasi sempre significa "non era in carica in quella
      // legislatura", non "non ha votato": dirlo, e dire dove guardare.
      voted ??= await votedLegislatures().catch(() => undefined);
      const altrove = voted?.filter((l) => l !== legislature) ?? [];
      throw new Error(
        `Nessun voto trovato per il senatore ${input.senatorUri} in legislatura ${legislature}.` +
          (altrove.length
            ? ` Ha però voti registrati nelle legislature ${formatLegislatureList(altrove)}: probabilmente non sedeva in Senato nella ${legislature}. Rilancia con --legislature ${altrove[altrove.length - 1]}.`
            : ""),
      );
    }

    const nameRow = flattenBindings(nameResults)[0];
    const senator_name = `${nameRow?.nome ?? ""} ${nameRow?.cognome ?? ""}`.trim();

    const row: Record<string, string> = {
      senator_uri: input.senatorUri,
      senator_name,
      html_url: personHtmlUrl(input.senatorUri),
      legislature: String(legislature),
      totale: String(totale),
    };
    CATEGORIES.forEach((cat, i) => {
      row[cat.column] = String(counts[i]);
    });

    return { rows: [row], columns };
  },
};
