import { z } from "zod";
import { snQuery } from "../core/client.js";
import { OSR_PREFIXES } from "../core/prefixes.js";
import { flattenBindings } from "../core/flatten.js";
import { personHtmlUrl } from "../core/html-url.js";
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

const columns = ["senator_uri", "senator_name", "group_label", "vote", "html_url"];

// Data della seduta della votazione: serve per agganciare il gruppo del senatore
// attivo in quel giorno. Query separata, indipendente dai conteggi del voto.
async function fetchVoteDate(voteUri: string): Promise<string | null> {
  const query = `${OSR_PREFIXES}
SELECT ?date WHERE { <${voteUri}> osr:seduta ?s . ?s osr:dataSeduta ?date } LIMIT 1`;
  const raw = flattenBindings(await snQuery(query));
  return raw[0]?.date ?? null;
}

// Mappa senatore_uri → etichetta gruppo attiva alla data del voto. Costruita con
// una sola query (logica di senator-group-members con asOf = data voto), poi
// unita in JS ai risultati per categoria: i conteggi del voto restano intatti.
async function fetchGroupMap(asOf: string): Promise<Map<string, string>> {
  const query = `${OSR_PREFIXES}
PREFIX ocd: <http://dati.camera.it/ocd/>
SELECT DISTINCT ?senator_uri ?group_label WHERE {
  ?senator_uri a osr:Senatore ; ocd:aderisce ?m .
  ?m a ocd:adesioneGruppo ; osr:gruppo ?g ; osr:inizio ?ini .
  OPTIONAL { ?m osr:fine ?fine }
  ?g osr:denominazione ?den .
  ?den osr:titolo ?group_label ; osr:inizio ?dini .
  OPTIONAL { ?den osr:fine ?dfine }
  FILTER(str(?ini) <= "${asOf}")
  FILTER(!BOUND(?fine) || str(?fine) >= "${asOf}")
  FILTER(str(?dini) <= "${asOf}")
  FILTER(!BOUND(?dfine) || str(?dfine) >= "${asOf}")
}`;
  const raw = flattenBindings(await snQuery(query));
  const map = new Map<string, string>();
  for (const r of raw) {
    if (r.senator_uri && r.group_label && !map.has(r.senator_uri)) {
      map.set(r.senator_uri, r.group_label);
    }
  }
  return map;
}

export const senatoVoteDetailTool: Tool<typeof inputSchema> = {
  name: "senato-vote-detail",
  description:
    "[SENATO] Voto individuale di ogni senatore in una singola votazione d'Assemblea: come ha votato (Favorevole, Contrario, Astenuto, Presente non votante, In congedo/missione), con nome e gruppo di appartenenza alla data del voto. Richiede l'URI della votazione (da senato-votes). ATTENZIONE: la scelta espressa (Favorevole, Contrario, Astenuto) è registrata solo per i voti di merito (type 'elettronica', 'nominale con appello', 'controprova'). Per i voti 'segreta' (voto segreto) e 'verifica numero legale' (conteggio del quorum) il tool restituisce SOLO le presenze (Presente non votante, In congedo/missione) e MAI una scelta espressa (né Favorevole, né Contrario, né Astenuto) — è corretto così, non dedurre né inventare il voto del singolo senatore su queste due modalità.",
  inputSchema,
  examples: [
    "italianparliament senato-vote-detail show --vote-uri http://dati.senato.it/votazione/19-167-42",
    "italianparliament senato-vote-detail show --vote-uri http://dati.senato.it/votazione/19-167-42 --vote-type Contrario --format jsonl",
  ],
  async execute(input) {
    const wanted = input.voteType
      ? CATEGORIES.filter((c) => c.label === input.voteType)
      : CATEGORIES;

    // Conteggi del voto (5 query invariate) e mappa gruppi in parallelo.
    const voteDate = await fetchVoteDate(input.voteUri);
    const [groupMap, results] = await Promise.all([
      voteDate ? fetchGroupMap(voteDate) : Promise.resolve(new Map<string, string>()),
      Promise.all(
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
            group_label: "",
            vote: cat.label,
          }));
        }),
      ),
    ]);

    const rows = results.flat().map((row) => ({
      ...row,
      group_label: groupMap.get(row.senator_uri) ?? "",
      html_url: personHtmlUrl(row.senator_uri),
    }));
    if (rows.length === 0) {
      throw new Error(`Nessun voto trovato per la votazione: ${input.voteUri}`);
    }
    return { rows, columns };
  },
};
