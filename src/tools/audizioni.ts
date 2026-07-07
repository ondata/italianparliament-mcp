import { z } from "zod";
import { cdQuery } from "../core/client.js";
import { OCD_PREFIXES } from "../core/prefixes.js";
import { flattenBindings } from "../core/flatten.js";
import { decodeHtml } from "../core/decode-html.js";
import type { Tool } from "./types.js";

const RDFS_LABEL = "http://www.w3.org/2000/01/rdf-schema#label";

// Riconosce le audizioni *reali* nel titolo, evitando le menzioni d'agenda
// (es. "Comunicazioni del Presidente ... allo svolgimento di un'audizione").
// Cattura "Audizione di/del/dei/della/…", "Audizione, in …", "Audizioni informali …".
const AUDIZIONE_REGEX =
  "audizion[ei][ ,]+(di |del|dei |della|dell|degli|delle|in |informal)";

const inputSchema = z.object({
  legislature: z
    .number()
    .int()
    .positive()
    .default(19)
    .describe(
      "Numero legislatura (default 19). Leg. 19 usa il titolo della discussione; leg. 14 usa il dc:type storico. Altre legislature: via titolo discussione (best-effort).",
    ),
  committeeName: z
    .string()
    .optional()
    .describe(
      'Nome (o parte) della commissione, es. "giustizia", "femminicidio", "periferie" (case-insensitive).',
    ),
  keyword: z
    .string()
    .optional()
    .describe(
      'Parola chiave da cercare nel TITOLO dell\'audizione, es. "prefetto", "Enel", "Confindustria" (case-insensitive). ' +
        "ATTENZIONE: significa solo che la parola compare nel titolo, NON che quel soggetto sia stato audito — potrebbe essere l'oggetto dell'indagine, un ente citato, o parte del contesto. Verificare sempre il titolo completo.",
    ),
  dateFrom: z
    .string()
    .optional()
    .describe('Data iniziale inclusiva. "AAAAMMGG" o "AAAA-MM-GG".'),
  dateTo: z
    .string()
    .optional()
    .describe('Data finale inclusiva. "AAAAMMGG" o "AAAA-MM-GG".'),
  limit: z.number().int().min(1).max(1000).default(200),
  offset: z.number().int().min(0).default(0),
});

const columns = [
  "chamber",
  "legislature",
  "date",
  "committee",
  "title",
  "bill_codes",
  "bill_uris",
  "bulletin_url",
  "discussion_uri",
  "dibattito_uri",
];

type AudizioneRow = {
  chamber: string;
  legislature: string;
  date: string;
  committee: string;
  title: string;
  bill_codes: string;
  bill_uris: string;
  bulletin_url: string;
  discussion_uri: string;
  dibattito_uri: string;
};

// --- helpers ----------------------------------------------------------------

/** AAAAMMGG → AAAA-MM-GG; passa attraverso ISO già formato. */
function toIso(d: string): string {
  const s = d.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  return s;
}

/** AAAA-MM-GG o AAAAMMGG → AAAAMMGG (per confronto con dc:date Camera). */
function toCompact(d: string): string {
  return d.replace(/-/g, "");
}

/** Estrae i codici atto ("C. 743") dal testo del titolo. */
function billCodesFromTitle(title: string): string[] {
  const codes = new Set<string>();
  const re = /\b([CS])\.\s*(\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(title)) !== null) {
    codes.add(`${m[1]}. ${m[2]}`);
  }
  return [...codes];
}

/** Estrae la data AAAAMMGG dal suffisso dell'URI discussione (leg. 14, senza dc:date). */
function dateFromDiscussionUri(uri: string): string {
  const m = uri.match(/_(\d{8})$/);
  return m ? toIso(m[1]) : "";
}

function sqlEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// --- leg. 19 (e altre non-storiche): via titolo della discussione -----------

async function queryByDiscussion(
  legislature: number,
  opts: {
    committeeName?: string;
    keyword?: string;
    dateFrom?: string;
    dateTo?: string;
    limit: number;
    offset: number;
  },
): Promise<AudizioneRow[]> {
  const filters: string[] = [
    `FILTER(REGEX(?title, "${AUDIZIONE_REGEX}", "i"))`,
  ];
  if (opts.committeeName)
    filters.push(
      `FILTER(CONTAINS(LCASE(?committee), LCASE("${sqlEscape(opts.committeeName)}")))`,
    );
  if (opts.keyword)
    filters.push(
      `FILTER(CONTAINS(LCASE(?title), LCASE("${sqlEscape(opts.keyword)}")))`,
    );
  // STR() obbligatorio: Virtuoso non confronta il dc:date Camera (literal
  // YYYYMMDD) come stringa lessicografica senza STR() — con confronto nudo il
  // range restituisce risultati errati o vuoti silenziosi.
  if (opts.dateFrom) filters.push(`FILTER(STR(?date) >= "${toCompact(toIso(opts.dateFrom))}")`);
  if (opts.dateTo) filters.push(`FILTER(STR(?date) <= "${toCompact(toIso(opts.dateTo))}")`);

  const query = `${OCD_PREFIXES}
SELECT ?dib ?d ?date ?committee ?title
       (GROUP_CONCAT(DISTINCT ?atto; separator="|") AS ?bills)
       (GROUP_CONCAT(DISTINCT ?rel; separator="|") AS ?bulletins)
WHERE {
  ?dib a ocd:dibattito ;
       ocd:rif_leg <http://dati.camera.it/ocd/legislatura.rdf/repubblica_${legislature}> ;
       dc:title ?committee ;
       ocd:rif_discussione ?d .
  ?d dc:title ?title ; dc:date ?date .
  OPTIONAL { ?dib ocd:rif_attoCamera ?atto }
  OPTIONAL { ?d dc:relation ?rel }
  ${filters.join("\n  ")}
}
GROUP BY ?dib ?d ?date ?committee ?title
ORDER BY DESC(?date)
LIMIT ${opts.limit}
OFFSET ${opts.offset}`;

  const raw = flattenBindings(await cdQuery(query));
  return raw.map((r) => {
    const title = decodeHtml(r.title ?? "");
    const bulletins = (r.bulletins ?? "").split("|").filter(Boolean);
    return {
      chamber: "camera",
      legislature: String(legislature),
      date: toIso(r.date ?? ""),
      committee: decodeHtml(r.committee ?? ""),
      title,
      bill_codes: billCodesFromTitle(title).join("|"),
      bill_uris: r.bills ?? "",
      bulletin_url: bulletins[0] ?? "",
      discussion_uri: r.d ?? "",
      dibattito_uri: r.dib ?? "",
    };
  });
}

// --- leg. 14 (storica): via dc:type "Audizioni informali" -------------------

async function queryByType(opts: {
  committeeName?: string;
  keyword?: string;
  limit: number;
  offset: number;
}): Promise<AudizioneRow[]> {
  const filters: string[] = [];
  if (opts.committeeName)
    filters.push(
      `FILTER(CONTAINS(LCASE(?organoLabel), LCASE("${sqlEscape(opts.committeeName)}")))`,
    );
  if (opts.keyword)
    filters.push(
      `FILTER(CONTAINS(LCASE(?title), LCASE("${sqlEscape(opts.keyword)}")))`,
    );

  const query = `${OCD_PREFIXES}
SELECT ?dib ?title ?d
       (GROUP_CONCAT(DISTINCT ?organoLabel; separator="|") AS ?committees)
       (GROUP_CONCAT(DISTINCT ?atto; separator="|") AS ?bills)
       (GROUP_CONCAT(DISTINCT ?ref; separator="|") AS ?refs)
WHERE {
  ?dib a ocd:dibattito ;
       dc:type ?type ;
       ocd:rif_leg <http://dati.camera.it/ocd/legislatura.rdf/repubblica_14> ;
       dc:title ?title .
  FILTER(?type IN ("Audizioni informali","AUDIZIONI INFORMALI"))
  OPTIONAL { ?dib ocd:rif_organo ?organo . OPTIONAL { ?organo <${RDFS_LABEL}> ?organoLabel } }
  OPTIONAL { ?dib ocd:rif_attoCamera ?atto }
  OPTIONAL { ?dib ocd:rif_discussione ?d }
  OPTIONAL { ?dib dcterms:isReferencedBy ?ref }
  ${filters.join("\n  ")}
}
GROUP BY ?dib ?title ?d
ORDER BY ?dib
LIMIT ${opts.limit}
OFFSET ${opts.offset}`;

  const raw = flattenBindings(await cdQuery(query));
  return raw.map((r) => {
    const title = decodeHtml(r.title ?? "");
    const refs = (r.refs ?? "").split("|").filter(Boolean);
    return {
      chamber: "camera",
      legislature: "14",
      date: dateFromDiscussionUri(r.d ?? ""),
      committee: decodeHtml((r.committees ?? "").split("|").filter(Boolean).join(" / ")),
      title,
      bill_codes: billCodesFromTitle(title).join("|"),
      bill_uris: r.bills ?? "",
      bulletin_url: refs[0] ?? "",
      discussion_uri: r.d ?? "",
      dibattito_uri: r.dib ?? "",
    };
  });
}

// --- orchestration ----------------------------------------------------------

export const audizioniTool: Tool<typeof inputSchema> = {
  name: "audizioni",
  description:
    "[CAMERA] Audizioni delle commissioni della Camera. Leg. 19 (dato vivo): via titolo della discussione — restituisce data, commissione, titolo (con nome/ruolo dell'audito), atti collegati e link al bollettino. " +
    "Leg. 14 (storica): via dc:type \"Audizioni informali\". " +
    "NOTA: il Senato non è coperto (via SPARQL non espone data né commissione delle audizioni). L'audito è testo nel titolo, non un'entità strutturata; il filtro è testuale (possibili falsi positivi/negativi).",
  inputSchema,
  examples: [
    "italianparliament audizioni list --legislature 19 --limit 50",
    "italianparliament audizioni list --legislature 19 --committee-name femminicidio",
    "italianparliament audizioni list --legislature 19 --keyword prefetto --date-from 2026-01-01",
    "italianparliament audizioni list --legislature 19 --committee-name periferie --format jsonl",
    "italianparliament audizioni list --legislature 14 --committee-name difesa",
  ],
  async execute(input) {
    const rows =
      input.legislature === 14
        ? await queryByType({
            committeeName: input.committeeName,
            keyword: input.keyword,
            limit: input.limit,
            offset: input.offset,
          })
        : await queryByDiscussion(input.legislature, {
            committeeName: input.committeeName,
            keyword: input.keyword,
            dateFrom: input.dateFrom,
            dateTo: input.dateTo,
            limit: input.limit,
            offset: input.offset,
          });

    // leg. 14: filtro date in post-processing (la data è nel suffisso URI).
    let filtered = rows;
    if (input.legislature === 14 && (input.dateFrom || input.dateTo)) {
      const from = input.dateFrom ? toIso(input.dateFrom) : undefined;
      const to = input.dateTo ? toIso(input.dateTo) : undefined;
      filtered = rows.filter((r) => {
        if (!r.date) return false;
        if (from && r.date < from) return false;
        if (to && r.date > to) return false;
        return true;
      });
    }

    if (filtered.length === 0) {
      throw new Error(
        "Nessuna audizione trovata per i criteri indicati (prova a variare --committee-name, --keyword, l'intervallo date o --legislature).",
      );
    }
    return { rows: filtered, columns };
  },
};
