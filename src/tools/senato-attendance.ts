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
  "presenze",
  "assenze",
  "votazioni_periodo",
  "presenze_pct",
  "missioni_pct",
  "assenze_pct",
];

export const senatoAttendanceTool: Tool<typeof inputSchema> = {
  name: "senato-attendance",
  title: "Partecipazione al voto di un senatore",
  description:
    "[SENATO] Presenze e assenze di un senatore nelle votazioni d'Assemblea di una legislatura. Conteggi per categoria (favorevole/contrario/astenuto/presente non votante/in congedo o missione) e, con la formula di Openpolis, presenze (voti espressi + presente non votante), assenze e le tre percentuali presenze_pct/missioni_pct/assenze_pct. Il denominatore (votazioni_periodo) è il numero di votazioni della legislatura cadute dentro il mandato di quel senatore, quindi chi subentra o cessa a metà non risulta assente per il periodo in cui non era in carica. ATTENZIONE: il dato Senato non registra l'assenza semplice, che è ricavata come differenza; le percentuali sono confrontabili con quelle di Openpolis e dei tabulati giornalistici entro circa un punto percentuale (scarti misurati: 0,1-1,2 pp), perché Openpolis scarta alcune votazioni dal denominatore e fotografa i dati in un momento diverso. Non presentarle quindi come cifre identiche a quelle di Openpolis. Se le percentuali sono vuote il periodo di mandato non spiega tutti i voti registrati (o il mandato non è nel grafo): usare i soli conteggi. Richiede l'URI del senatore; la legislatura è facoltativa (se omessa si deduce da quelle in cui il senatore ha voti registrati: per chi non siede più in Senato si ottiene il suo ultimo mandato invece di un vuoto).",
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

    // Denominatore: le votazioni d'Assemblea della legislatura cadute DENTRO il
    // mandato di questo senatore. È il numero rispetto a cui Openpolis e i
    // tabulati calcolano le percentuali, e senza il vincolo di periodo chi
    // subentra a metà legislatura risulterebbe assente per i mesi in cui non
    // era in carica. COUNT(DISTINCT ?v) regge anche i mandati spezzati (chi
    // decade e rientra ha più di un mandato nella stessa legislatura: la stessa
    // votazione non va contata due volte).
    const denominatorQuery = `${OSR_PREFIXES}
SELECT (COUNT(DISTINCT ?v) AS ?n) WHERE {
  <${input.senatorUri}> osr:mandato ?m .
  ?m osr:legislatura ${legislature} ; osr:inizio ?i .
  OPTIONAL { ?m osr:fine ?f }
  ?v a osr:Votazione ; osr:legislatura ${legislature} ; osr:seduta ?s .
  ?s osr:dataSeduta ?d .
  FILTER(?d >= ?i && (!BOUND(?f) || ?d <= ?f))
}`;

    const [nameResults, counts, denominatore] = await Promise.all([
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
      // Accessoria: se il mandato non è nel grafo o l'endpoint non risponde, il
      // tool continua a dare i conteggi e lascia vuote le sole percentuali.
      snQuery(denominatorQuery)
        .then((r) => Number(flattenBindings(r)[0]?.n ?? 0))
        .catch(() => 0),
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

    // Formula di Openpolis: presenze = voti espressi + presenze non votanti;
    // le missioni sono una categoria a sé (non contano come assenza); l'assenza
    // è ciò che resta del denominatore, perché il dato Senato non registra
    // l'assente semplice. Verificato in leg. 19 contro Openparlamento: Pera
    // 41,1/22,7/36,2 contro 41,5/22,6/35,8; Renzi 51,3/16,5/32,2 contro
    // 52,5/16,3/31,3. Gli scarti (0,1-1,2 pp) vengono dal sottoinsieme di
    // votazioni che Openpolis scarta e dal diverso momento dello snapshot.
    const missioni = counts[CATEGORIES.findIndex((c) => c.prop === "inCongedoMissione")];
    const presenze = totale - missioni;
    // Un totale oltre il denominatore vorrebbe dire che il periodo di mandato
    // non spiega tutti i voti registrati: meglio nessuna percentuale che una
    // percentuale sopra il 100% o un'assenza negativa.
    const usable = denominatore >= totale && denominatore > 0;
    const pct = (n: number): string =>
      usable ? ((n / denominatore) * 100).toFixed(2) : "";

    const row: Record<string, string> = {
      senator_uri: input.senatorUri,
      senator_name,
      html_url: personHtmlUrl(input.senatorUri),
      legislature: String(legislature),
      totale: String(totale),
      presenze: String(presenze),
      assenze: usable ? String(denominatore - totale) : "",
      votazioni_periodo: denominatore > 0 ? String(denominatore) : "",
      presenze_pct: pct(presenze),
      missioni_pct: pct(missioni),
      assenze_pct: pct(denominatore - totale),
    };
    CATEGORIES.forEach((cat, i) => {
      row[cat.column] = String(counts[i]);
    });

    return { rows: [row], columns };
  },
};
