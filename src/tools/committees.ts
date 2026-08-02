import { z } from "zod";
import { cdQuery, snQuery } from "../core/client.js";
import { OCD_PREFIXES, OSR_PREFIXES } from "../core/prefixes.js";
import { flattenBindings } from "../core/flatten.js";
import { currentLegislature } from "../core/current-legislature.js";
import type { Tool } from "./types.js";

const RDFS_LABEL = "http://www.w3.org/2000/01/rdf-schema#label";

const inputSchema = z.object({
  chamber: z
    .enum(["camera", "senato", "both"])
    .default("both")
    .describe("Ramo del parlamento: camera, senato o both."),
  legislature: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe(
      "Numero legislatura. Camera: le commissioni sono istanze per-legislatura, default 19. Senato: opzionale, senza filtro mostra tutte le commissioni storiche (nessun session_count); con filtro mostra gli organi attivi in quella legislatura, con il numero di sedute (0 per quelli che nel LOD non ne hanno, come le Giunte).",
    ),
  limit: z.number().int().min(1).max(1000).default(300),
});

const columns = [
  "chamber",
  "uri",
  "title",
  "short_title",
  "subtitle",
  "category",
  "session_count",
];

type Row = {
  chamber: string;
  uri: string;
  title: string;
  short_title: string;
  subtitle: string;
  category: string;
  session_count: string;
};

// --- Camera -------------------------------------------------------------

async function queryCamera(legislature: number, limit: number): Promise<Row[]> {
  const query = `${OCD_PREFIXES}
SELECT ?o (MIN(?label) AS ?title) (MIN(?type) AS ?category) (COUNT(DISTINCT ?seduta) AS ?n_sedute)
WHERE {
  ?o a ocd:organo ;
     <${RDFS_LABEL}> ?label ;
     ocd:rif_leg <http://dati.camera.it/ocd/legislatura.rdf/repubblica_${legislature}> .
  OPTIONAL { ?o dc:type ?type }
  OPTIONAL { ?seduta a ocd:seduta ; ocd:rif_organo ?o }
}
GROUP BY ?o
ORDER BY ?title
LIMIT ${limit}`;
  const results = await cdQuery(query);
  const raw = flattenBindings(results);
  return raw.map((r) => ({
    chamber: "camera",
    uri: r.o ?? "",
    title: r.title ?? "",
    short_title: "",
    subtitle: "",
    category: r.category ?? "",
    session_count: r.n_sedute ?? "",
  }));
}

// --- Senato ---------------------------------------------------------------

// Mappatura comune alle query Senato: i nomi di variabile coincidono, cambia
// solo quali sono valorizzate (le sedute danno `n_sedute`, l'anagrafica i
// titoli). I campi assenti restano stringa vuota.
function toRows(raw: Record<string, string | undefined>[]): Row[] {
  return raw.map((r) => ({
    chamber: "senato",
    uri: r.comm ?? "",
    title: r.titolo ?? "",
    short_title: r.titoloBreve ?? "",
    subtitle: r.sottotitolo ?? "",
    category: r.cat ?? r.categoria ?? "",
    session_count: r.n_sedute ?? "",
  }));
}

// Intervallo di date coperto da una legislatura, ricavato dalle sedute di
// commissione: il grafo Senato non espone inizio/fine legislatura, ma le date
// delle sedute la delimitano con precisione sufficiente a filtrare gli organi.
async function senatoLegislatureRange(
  legislature: number,
): Promise<{ from: string; to: string } | null> {
  const query = `${OSR_PREFIXES}
SELECT (MIN(?d) AS ?dal) (MAX(?d) AS ?al)
WHERE {
  ?s a osr:SedutaCommissione .
  ?s osr:legislatura ${legislature} .
  ?s osr:dataSeduta ?d
}`;
  const raw = flattenBindings(await snQuery(query));
  const from = raw[0]?.dal;
  const to = raw[0]?.al;
  return from && to ? { from, to } : null;
}

/**
 * Unisce gli organi con sedute nella legislatura e quelli descritti come
 * attivi nel suo periodo. Sono due insiemi che si intersecano solo in parte,
 * e nessuno dei due basta da solo (#82): le Giunte non hanno sedute nel LOD,
 * e 16 organi con sedute — incluso il secondo più attivo della leg. 19 — non
 * esistono come risorse, quindi non hanno né titolo né categoria.
 * I campi vuoti restano vuoti: il nome mancante è un buco della fonte, non
 * qualcosa da riempire a valle.
 */
export function mergeSenatoCommittees(withSessions: Row[], described: Row[]): Row[] {
  const byUri = new Map<string, Row>();
  for (const r of withSessions) byUri.set(r.uri, { ...r });
  for (const d of described) {
    const seen = byUri.get(d.uri);
    if (!seen) {
      byUri.set(d.uri, { ...d, session_count: "0" });
      continue;
    }
    // L'anagrafica della risorsa è più ricca del solo titoloBreve aggregato
    // sulle sedute: completa i campi mancanti senza toccare il conteggio.
    seen.title ||= d.title;
    seen.short_title ||= d.short_title;
    seen.subtitle ||= d.subtitle;
    seen.category ||= d.category;
  }
  return [...byUri.values()].sort(
    (a, b) =>
      Number(b.session_count || 0) - Number(a.session_count || 0) ||
      a.short_title.localeCompare(b.short_title),
  );
}

async function querySenato(
  legislature: number | undefined,
  limit: number,
): Promise<Row[]> {
  let query: string;
  if (legislature) {
    // Le due query lavorano su insiemi piccoli e noti (nella leg. 19: 27 organi
    // con sedute, 59 descritti attivi), quindi il `limit` dell'utente si applica
    // DOPO il merge: troncare prima toglierebbe righe che l'ordinamento finale
    // avrebbe messo in testa. Il tetto interno esiste solo come guardia.
    const cap = 1000;
    // Organi con sedute nella legislatura. `titoloBreve` è OPTIONAL: quando
    // manca l'organo va mostrato lo stesso, altrimenti sparisce in silenzio
    // proprio chi ha più sedute (#82).
    query = `${OSR_PREFIXES}
SELECT ?comm (MIN(?titoloBreve) AS ?titoloBreve) (MIN(?cat) AS ?categoria) (COUNT(DISTINCT ?seduta) AS ?n_sedute)
WHERE {
  ?seduta a osr:SedutaCommissione .
  ?seduta osr:commissione ?comm .
  ?seduta osr:legislatura ${legislature} .
  OPTIONAL { ?comm osr:titoloBreve ?titoloBreve }
  OPTIONAL { ?comm osr:categoriaCommissione ?cat }
}
GROUP BY ?comm
ORDER BY DESC(?n_sedute)
LIMIT ${cap}`;
    const withSessions = toRows(flattenBindings(await snQuery(query)));
    const range = await senatoLegislatureRange(legislature);
    if (!range) return withSessions;
    // Organi la cui denominazione è valida nel periodo della legislatura:
    // stesso pattern temporale dei gruppi (osr:denominazione con inizio/fine),
    // ed è l'unico modo per vedere le Giunte, che sedute nel LOD non ne hanno.
    const activeQuery = `${OSR_PREFIXES}
SELECT DISTINCT ?comm ?titolo ?titoloBreve ?sottotitolo ?cat
WHERE {
  ?comm a osr:Commissione .
  ?comm osr:denominazione ?den .
  ?den osr:inizio ?ini .
  OPTIONAL { ?den osr:fine ?fine }
  OPTIONAL { ?comm osr:titolo ?titolo }
  OPTIONAL { ?comm osr:titoloBreve ?titoloBreve }
  OPTIONAL { ?comm osr:sottotitolo ?sottotitolo }
  OPTIONAL { ?comm osr:categoriaCommissione ?cat }
  FILTER(str(?ini) <= "${range.to}")
  FILTER(!BOUND(?fine) || str(?fine) >= "${range.from}")
}
ORDER BY ?comm
LIMIT ${cap}`;
    const described = toRows(flattenBindings(await snQuery(activeQuery)));
    return mergeSenatoCommittees(withSessions, described).slice(0, limit);
  } else {
    // Tutte le commissioni storiche, nessun conteggio sedute.
    query = `${OSR_PREFIXES}
SELECT ?comm ?titolo ?titoloBreve ?sottotitolo ?cat
WHERE {
  ?comm a osr:Commissione .
  OPTIONAL { ?comm osr:titolo ?titolo }
  OPTIONAL { ?comm osr:titoloBreve ?titoloBreve }
  OPTIONAL { ?comm osr:sottotitolo ?sottotitolo }
  OPTIONAL { ?comm osr:categoriaCommissione ?cat }
}
ORDER BY ?titoloBreve
LIMIT ${limit}`;
  }
  return toRows(flattenBindings(await snQuery(query)));
}

export const committeesTool: Tool<typeof inputSchema> = {
  name: "committees",
  description:
    "[CAMERA+SENATO] Commissioni parlamentari (permanenti, speciali, d'inchiesta monocamerali e bicamerali, giunte, comitati). " +
    "Camera: filtrata per legislatura (default 19; le commissioni sono istanze per-legislatura), con dc:type come categoria. " +
    "Senato: senza --legislature mostra tutte le commissioni storiche (nessun session_count); con --legislature unisce due insiemi — gli organi con sedute in quella legislatura (con il conteggio) e quelli la cui denominazione risulta valida nel periodo (session_count 0). Serve entrambi perché le Giunte non hanno sedute nel LOD e comparirebbero solo nel secondo. " +
    "ATTENZIONE (limite della fonte, non del tool): alcuni organi del Senato con molte sedute — nella leg. 19 sedici, incluso il secondo più attivo — sono referenziati con URI 'commissione/2-*' che nel grafo non esistono come risorse: niente titolo, niente categoria. Le loro righe hanno i campi di testo VUOTI e solo uri + session_count. Non dedurre il nome dell'organo dall'URI o dal numero di sedute: non è ricavabile dal dato.",
  inputSchema,
  examples: [
    "italianparliament committees list --chamber camera --legislature 19",
    "italianparliament committees list --chamber senato --legislature 19",
    "italianparliament committees list --chamber both --legislature 19",
    "italianparliament committees list --chamber senato",
  ],
  async execute(input) {
    const rows: Row[] = [];
    if (input.chamber === "camera" || input.chamber === "both") {
      rows.push(
        ...(await queryCamera(
          input.legislature ?? (await currentLegislature()),
          input.limit,
        )),
      );
    }
    if (input.chamber === "senato" || input.chamber === "both") {
      rows.push(...(await querySenato(input.legislature, input.limit)));
    }
    return { rows, columns };
  },
};
