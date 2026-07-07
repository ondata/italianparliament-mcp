import { z } from "zod";
import { cdQuery, snQuery } from "../core/client.js";
import { OCD_PREFIXES, OSR_PREFIXES } from "../core/prefixes.js";
import { flattenBindings } from "../core/flatten.js";
import { currentLegislature } from "../core/current-legislature.js";
import type { Tool } from "./types.js";

const RDFS_LABEL = "http://www.w3.org/2000/01/rdf-schema#label";

const inputSchema = z.object({
  ddlUri: z
    .string()
    .url()
    .optional()
    .describe(
      "URI del DDL Senato (es. http://dati.senato.it/ddl/56260). Se presente, elenca le sedute in cui il DDL è stato trattato (modalità iter del provvedimento).",
    ),
  committeeUri: z
    .string()
    .url()
    .optional()
    .describe(
      "URI della commissione. Camera: http://dati.camera.it/ocd/organo.rdf/o19_3941, Senato: http://dati.senato.it/commissione/0-2. Elenca tutte le sedute di quella commissione.",
    ),
  committeeName: z
    .string()
    .optional()
    .describe(
      'Nome (o parte) della commissione da cercare (es. "giustizia", "femminicidio"). Risolve l\'URI prima di elencare le sedute. Usare insieme a --chamber e --legislature per evitare ambiguità.',
    ),
  chamber: z
    .enum(["camera", "senato", "both"])
    .default("both")
    .describe("Ramo del parlamento. Ignorato con --ddl-uri (sempre Senato). Default: both."),
  legislature: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Numero legislatura (es. 19). Default: 19."),
  dateFrom: z
    .string()
    .optional()
    .describe('Data iniziale (inclusiva). Senato: "AAAA-MM-GG"; Camera: "AAAAMMGG" o "AAAA-MM-GG".'),
  dateTo: z
    .string()
    .optional()
    .describe('Data finale (inclusiva). Senato: "AAAA-MM-GG"; Camera: "AAAAMMGG" o "AAAA-MM-GG".'),
  limit: z.number().int().min(1).max(1000).default(200),
  offset: z.number().int().min(0).default(0),
  countOnly: z
    .boolean()
    .optional()
    .describe(
      "Restituisce solo il numero di sedute invece dell'elenco completo. Ideale per conteggi rapidi (es. quante audizioni ha svolto una commissione) senza scaricare tutte le righe.",
    ),
});

const columns = [
  "chamber",
  "session_uri",
  "date",
  "committee",
  "committee_uri",
  "session_type",
  "interventions",
  "ddl_uri",
  "bulletin_url",
];

type SessionRow = {
  chamber: string;
  session_uri: string;
  date: string;
  committee: string;
  committee_uri: string;
  session_type: string;
  interventions: string;
  ddl_uri: string;
  bulletin_url: string;
};

// --- helpers ----------------------------------------------------------------

/** Normalizza una data di input in formato esteso AAAA-MM-GG. */
function toIso(d: string | undefined): string | undefined {
  if (!d) return undefined;
  const s = d.trim();
  // già ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // AAAAMMGG
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  return s;
}

/** Converte ISO in AAAAMMGG (formato data Camera). */
function isoToCompact(iso: string): string {
  return iso.replace(/-/g, "");
}

// --- Camera -----------------------------------------------------------------

async function resolveCameraOrgano(
  name: string,
  legislature: number,
): Promise<{ uri: string; label: string } | undefined> {
  const query = `${OCD_PREFIXES}
SELECT ?organo ?label WHERE {
  ?organo a ocd:organo ;
          <${RDFS_LABEL}> ?label ;
          ocd:rif_leg <http://dati.camera.it/ocd/legislatura.rdf/repubblica_${legislature}> .
  FILTER( CONTAINS(LCASE(?label), LCASE("${name.replace(/"/g, '\\"')}")) )
}
LIMIT 1`;
  const results = await cdQuery(query);
  const raw = flattenBindings(results);
  if (raw.length === 0) return undefined;
  return { uri: raw[0].organo ?? "", label: raw[0].label ?? "" };
}

/** Recupera l'etichetta di un organo Camera dato l'URI (caso --committee-uri senza --committee-name). */
async function fetchCameraOrganoLabel(uri: string): Promise<string> {
  const query = `${OCD_PREFIXES}
SELECT ?label WHERE {
  <${uri}> <${RDFS_LABEL}> ?label .
}
LIMIT 1`;
  const results = await cdQuery(query);
  const raw = flattenBindings(results);
  return raw[0]?.label ?? "";
}

async function queryCamera(
  organoUri: string,
  opts: {
    committeeName?: string;
    dateFrom?: string;
    dateTo?: string;
    limit: number;
    offset: number;
  },
): Promise<SessionRow[]> {
  const filters: string[] = [];
  const fromIso = toIso(opts.dateFrom);
  const toIso2 = toIso(opts.dateTo);
  // STR() obbligatorio: Virtuoso non confronta il dc:date Camera (literal
  // YYYYMMDD) come stringa lessicografica senza STR() — con confronto nudo il
  // range restituisce risultati errati o vuoti silenziosi.
  if (fromIso) filters.push(`FILTER(STR(?date) >= "${isoToCompact(fromIso)}")`);
  if (toIso2) filters.push(`FILTER(STR(?date) <= "${isoToCompact(toIso2)}")`);

  const query = `${OCD_PREFIXES}
SELECT ?seduta ?date (GROUP_CONCAT(DISTINCT ?rel; separator="|") AS ?bulletins)
WHERE {
  ?seduta a ocd:seduta ;
          ocd:rif_organo <${organoUri}> ;
          dc:date ?date .
  OPTIONAL { ?seduta dc:relation ?rel . }
  ${filters.join("\n  ")}
}
GROUP BY ?seduta ?date
ORDER BY DESC(?date)
LIMIT ${opts.limit}
OFFSET ${opts.offset}`;

  const results = await cdQuery(query);
  const raw = flattenBindings(results);
  // Camera non ha "tipo seduta" né conteggio interventi diretto; bollettino = contenuto.
  return raw.map((r) => {
    const bulletins = (r.bulletins ?? "").split("|").filter(Boolean);
    return {
      chamber: "camera",
      session_uri: r.seduta ?? "",
      date: r.date ?? "",
      committee: opts.committeeName ?? "",
      committee_uri: organoUri,
      session_type: "",
      interventions: "",
      ddl_uri: "",
      bulletin_url: bulletins[0] ?? "",
    };
  });
}

/** Conteggio sedute Camera (query leggera: niente OPTIONAL/GROUP_CONCAT). */
async function countCamera(
  organoUri: string,
  opts: { dateFrom?: string; dateTo?: string },
): Promise<string> {
  const filters: string[] = [];
  const fromIso = toIso(opts.dateFrom);
  const toIso2 = toIso(opts.dateTo);
  // STR() obbligatorio: Virtuoso non confronta il dc:date Camera (literal
  // YYYYMMDD) come stringa lessicografica senza STR() — con confronto nudo il
  // range restituisce risultati errati o vuoti silenziosi.
  if (fromIso) filters.push(`FILTER(STR(?date) >= "${isoToCompact(fromIso)}")`);
  if (toIso2) filters.push(`FILTER(STR(?date) <= "${isoToCompact(toIso2)}")`);

  const query = `${OCD_PREFIXES}
SELECT (COUNT(DISTINCT ?seduta) AS ?count)
WHERE {
  ?seduta a ocd:seduta ;
          ocd:rif_organo <${organoUri}> ;
          dc:date ?date .
  ${filters.join("\n  ")}
}`;
  const results = await cdQuery(query);
  return flattenBindings(results)[0]?.count ?? "0";
}

// --- Senato -----------------------------------------------------------------

async function resolveSenatoCommissione(
  name: string,
): Promise<{ uri: string; label: string } | undefined> {
  const query = `${OSR_PREFIXES}
SELECT ?commissione (MIN(?tb) AS ?label) WHERE {
  ?commissione a osr:Commissione ; osr:titoloBreve ?tb .
  FILTER( CONTAINS(LCASE(?tb), LCASE("${name.replace(/"/g, '\\"')}")) )
}
GROUP BY ?commissione
LIMIT 1`;
  const results = await snQuery(query);
  const raw = flattenBindings(results);
  if (raw.length === 0) return undefined;
  return { uri: raw[0].commissione ?? "", label: raw[0].label ?? "" };
}

/** Modalità "iter di un DDL": sedute in cui il DDL è stato trattato (query originale). */
async function querySenatoByDdl(
  ddlUri: string,
  opts: { limit: number; offset: number },
): Promise<SessionRow[]> {
  const query = `${OSR_PREFIXES}
SELECT ?seduta ?date ?tipo ?comm (MIN(?tb) AS ?commName) (COUNT(DISTINCT ?int) AS ?interventi)
WHERE {
  ?int a osr:Intervento ; osr:oggetto ?o ; osr:seduta ?seduta .
  ?o osr:relativoA <${ddlUri}> .
  ?seduta osr:dataSeduta ?date .
  OPTIONAL { ?seduta osr:tipoSeduta ?tipo }
  OPTIONAL { ?seduta osr:commissione ?comm . OPTIONAL { ?comm osr:titoloBreve ?tb } }
}
GROUP BY ?seduta ?date ?tipo ?comm
ORDER BY ?date
LIMIT ${opts.limit}
OFFSET ${opts.offset}`;
  const results = await snQuery(query);
  const raw = flattenBindings(results);
  if (raw.length === 0) return [];
  return raw.map((r) => ({
    chamber: "senato",
    session_uri: r.seduta ?? "",
    date: r.date ?? "",
    committee: r.commName ?? "",
    committee_uri: r.comm ?? "",
    session_type: r.tipo ?? "",
    interventions: r.interventi ?? "",
    ddl_uri: ddlUri,
    bulletin_url: "",
  }));
}

/** Modalità "segui commissione": tutte le sedute di una commissione per data. */
async function querySenatoByCommission(
  commissioneUri: string,
  opts: {
    dateFrom?: string;
    dateTo?: string;
    limit: number;
    offset: number;
  },
): Promise<SessionRow[]> {
  const filters: string[] = [];
  const fromIso = toIso(opts.dateFrom);
  const toIso2 = toIso(opts.dateTo);
  if (fromIso)
    filters.push(
      `FILTER(?date >= "${fromIso}"^^<http://www.w3.org/2001/XMLSchema#date>)`,
    );
  if (toIso2)
    filters.push(
      `FILTER(?date <= "${toIso2}"^^<http://www.w3.org/2001/XMLSchema#date>)`,
    );

  const query = `${OSR_PREFIXES}
SELECT ?seduta ?date ?tipo (MIN(?tb) AS ?commName) (COUNT(DISTINCT ?int) AS ?interventi)
WHERE {
  ?seduta a osr:SedutaCommissione ;
          osr:commissione <${commissioneUri}> ;
          osr:dataSeduta ?date .
  OPTIONAL { ?seduta osr:tipoSeduta ?tipo }
  OPTIONAL { <${commissioneUri}> osr:titoloBreve ?tb }
  OPTIONAL { ?int a osr:Intervento ; osr:seduta ?seduta . }
  ${filters.join("\n  ")}
}
GROUP BY ?seduta ?date ?tipo
ORDER BY DESC(?date)
LIMIT ${opts.limit}
OFFSET ${opts.offset}`;
  const results = await snQuery(query);
  const raw = flattenBindings(results);
  return raw.map((r) => ({
    chamber: "senato",
    session_uri: r.seduta ?? "",
    date: r.date ?? "",
    committee: r.commName ?? "",
    committee_uri: commissioneUri,
    session_type: r.tipo ?? "",
    interventions: r.interventi ?? "",
    ddl_uri: "",
    bulletin_url: "",
  }));
}

/** Conteggio sedute in cui un DDL è stato trattato (modalità iter). */
async function countSenatoByDdl(ddlUri: string): Promise<string> {
  const query = `${OSR_PREFIXES}
SELECT (COUNT(DISTINCT ?seduta) AS ?count)
WHERE {
  ?int a osr:Intervento ; osr:oggetto ?o ; osr:seduta ?seduta .
  ?o osr:relativoA <${ddlUri}> .
}`;
  const results = await snQuery(query);
  return flattenBindings(results)[0]?.count ?? "0";
}

/** Conteggio sedute di una commissione Senato. */
async function countSenatoByCommission(
  commissioneUri: string,
  opts: { dateFrom?: string; dateTo?: string },
): Promise<string> {
  const filters: string[] = [];
  const fromIso = toIso(opts.dateFrom);
  const toIso2 = toIso(opts.dateTo);
  if (fromIso)
    filters.push(
      `FILTER(?date >= "${fromIso}"^^<http://www.w3.org/2001/XMLSchema#date>)`,
    );
  if (toIso2)
    filters.push(
      `FILTER(?date <= "${toIso2}"^^<http://www.w3.org/2001/XMLSchema#date>)`,
    );

  const query = `${OSR_PREFIXES}
SELECT (COUNT(DISTINCT ?seduta) AS ?count)
WHERE {
  ?seduta a osr:SedutaCommissione ;
          osr:commissione <${commissioneUri}> ;
          osr:dataSeduta ?date .
  ${filters.join("\n  ")}
}`;
  const results = await snQuery(query);
  return flattenBindings(results)[0]?.count ?? "0";
}

// --- orchestration ----------------------------------------------------------

export const committeeSessionsTool: Tool<typeof inputSchema> = {
  name: "committee-sessions",
  description:
    "[CAMERA+SENATO] Attività delle commissioni. Due modalità: (1) iter di un DDL (--ddl-uri: sedute in cui il provvedimento è stato trattato, solo Senato); " +
    "(2) seguire una commissione (--committee-uri o --committee-name + --chamber: tutte le sedute di una commissione, filtrabili per data). " +
    "Camera mostra data + URL del bollettino; Senato mostra data, tipo e numero interventi. " +
    "Le commissioni bicamerali (es. inchiesta femminicidio) hanno composizione esposta da entrambi i rami, ma sedute/interventi solo dalla Camera.",
  inputSchema,
  examples: [
    "italianparliament committee-sessions list --ddl-uri http://dati.senato.it/ddl/56260",
    "italianparliament committee-sessions list --committee-uri http://dati.camera.it/ocd/organo.rdf/o19_3941 --chamber camera",
    "italianparliament committee-sessions list --committee-name femminicidio --chamber camera",
    "italianparliament committee-sessions list --committee-name femminicidio --chamber camera --count-only",
    "italianparliament committee-sessions list --committee-uri http://dati.senato.it/commissione/0-2 --chamber senato --date-from 2026-05-01 --date-to 2026-05-31",
    "italianparliament committee-sessions list --committee-name giustizia --chamber both --legislature 19",
  ],
  async execute(input) {
    // Modalità (1): iter di un DDL — retrocompatibile, sempre Senato.
    if (input.ddlUri) {
      if (input.countOnly) {
        const c = await countSenatoByDdl(input.ddlUri);
        return {
          rows: [{ chamber: "senato", count: c }],
          columns: ["chamber", "count"],
        };
      }
      const rows = await querySenatoByDdl(input.ddlUri, {
        limit: input.limit,
        offset: input.offset,
      });
      if (rows.length === 0) {
        throw new Error(
          `Nessuna seduta di commissione trovata per il DDL: ${input.ddlUri} (potrebbe non essere ancora stato esaminato in commissione).`,
        );
      }
      return { rows, columns };
    }

    // Modalità (2): seguire una commissione.
    if (!input.committeeUri && !input.committeeName) {
      throw new Error(
        "Specifica --ddl-uri (iter di un DDL) oppure --committee-uri / --committee-name (attività di una commissione).",
      );
    }

    const legislature = input.legislature ?? (await currentLegislature());
    const chamber = input.chamber;
    let rows: SessionRow[] = [];

    // Risoluzione nome → URI per ramo.
    let camUri = input.committeeUri;
    let senUri = input.committeeUri;
    let camName = "";

    if (input.committeeName) {
      const unresolved: string[] = [];
      if ((chamber === "camera" || chamber === "both") && !camUri) {
        const found = await resolveCameraOrgano(input.committeeName, legislature);
        if (found) {
          camUri = found.uri;
          camName = found.label;
        } else unresolved.push("camera");
      }
      if ((chamber === "senato" || chamber === "both") && !senUri) {
        const found = await resolveSenatoCommissione(input.committeeName);
        if (found) senUri = found.uri;
        else unresolved.push("senato");
      }
      if (
        unresolved.length === 2 ||
        (unresolved.length === 1 &&
          ((chamber === "camera" && !camUri) ||
            (chamber === "senato" && !senUri) ||
            (chamber === "both" && !camUri && !senUri)))
      ) {
        throw new Error(
          `Nessuna commissione trovata per il nome "${input.committeeName}" (chamber: ${unresolved.join(", ")}).`,
        );
      }
    }

    // Conteggio: una riga per ramo interrogato (query leggera, no elenco).
    if (input.countOnly) {
      const countRows: Array<{ chamber: string; count: string }> = [];
      if ((chamber === "camera" || chamber === "both") && camUri) {
        countRows.push({
          chamber: "camera",
          count: await countCamera(camUri, {
            dateFrom: input.dateFrom,
            dateTo: input.dateTo,
          }),
        });
      }
      if ((chamber === "senato" || chamber === "both") && senUri) {
        countRows.push({
          chamber: "senato",
          count: await countSenatoByCommission(senUri, {
            dateFrom: input.dateFrom,
            dateTo: input.dateTo,
          }),
        });
      }
      if (countRows.length === 0) {
        throw new Error(
          "Nessuna commissione risolta per il conteggio (verifica --committee-uri / --committee-name e --chamber).",
        );
      }
      return { rows: countRows, columns: ["chamber", "count"] };
    }

    if ((chamber === "camera" || chamber === "both") && camUri) {
      if (!camName) {
        camName = await fetchCameraOrganoLabel(camUri);
      }
      rows = rows.concat(
        await queryCamera(camUri, {
          committeeName: camName,
          dateFrom: input.dateFrom,
          dateTo: input.dateTo,
          limit: input.limit,
          offset: input.offset,
        }),
      );
    }
    if ((chamber === "senato" || chamber === "both") && senUri) {
      rows = rows.concat(
        await querySenatoByCommission(senUri, {
          dateFrom: input.dateFrom,
          dateTo: input.dateTo,
          limit: input.limit,
          offset: input.offset,
        }),
      );
    }

    if (rows.length === 0) {
      throw new Error(
        "Nessuna seduta trovata per i criteri indicati (prova ad allargare l'intervallo date o --legislature).",
      );
    }
    return { rows, columns };
  },
};
