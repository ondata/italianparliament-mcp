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
    .positive()
    .optional()
    .describe(
      "Numero legislatura. Camera: le commissioni sono istanze per-legislatura, default 19. Senato: opzionale, senza filtro mostra tutte le commissioni storiche (nessun session_count); con filtro mostra solo quelle attive con numero di sedute.",
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

async function querySenato(
  legislature: number | undefined,
  limit: number,
): Promise<Row[]> {
  let query: string;
  if (legislature) {
    // Filtrate per legislatura via SedutaCommissione, con conteggio sedute.
    query = `${OSR_PREFIXES}
SELECT ?comm (MIN(?titoloBreve) AS ?titoloBreve) (MIN(?cat) AS ?categoria) (COUNT(DISTINCT ?seduta) AS ?n_sedute)
WHERE {
  ?seduta a osr:SedutaCommissione .
  ?seduta osr:commissione ?comm .
  ?seduta osr:legislatura ${legislature} .
  ?comm osr:titoloBreve ?titoloBreve .
  OPTIONAL { ?comm osr:categoriaCommissione ?cat }
}
GROUP BY ?comm
ORDER BY DESC(?n_sedute)
LIMIT ${limit}`;
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
  const results = await snQuery(query);
  const raw = flattenBindings(results);
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

export const committeesTool: Tool<typeof inputSchema> = {
  name: "committees",
  description:
    "[CAMERA+SENATO] Commissioni parlamentari (permanenti, speciali, d'inchiesta monocamerali e bicamerali, giunte, comitati). " +
    "Camera: filtrata per legislatura (default 19; le commissioni sono istanze per-legislatura), con dc:type come categoria. " +
    "Senato: senza --legislature mostra tutte le commissioni storiche (nessun session_count); con --legislature filtra le attive e aggiunge il numero di sedute.",
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
