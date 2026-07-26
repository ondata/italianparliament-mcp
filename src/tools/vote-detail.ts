import { z } from "zod";
import { cdQuery } from "../core/client.js";
import { OCD_PREFIXES } from "../core/prefixes.js";
import { flattenBindings } from "../core/flatten.js";
import { personHtmlUrl } from "../core/html-url.js";
import type { Tool } from "./types.js";

const inputSchema = z.object({
  voteUri: z
    .string()
    .url()
    .describe("URI completo della votazione (es. http://dati.camera.it/ocd/votazione.rdf/vs19_001_001)"),
  groupAcronym: z
    .string()
    .optional()
    .describe(
      "Filtra per sigla gruppo (es. 'FDI', 'M5S'). Le sigle sono quelle registrate sui voti, che non sempre coincidono con l'acronym di `groups list`, e il gruppo Misto può comparire disaggregato nelle sue componenti. Maiuscole/minuscole e punteggiatura sono irrilevanti; se la sigla non esiste in quella votazione il risultato è vuoto e l'elenco delle sigle presenti viene restituito come nota.",
    ),
  voteType: z
    .enum(["Favorevole", "Contrario", "Astensione", "Non ha votato"])
    .optional()
    .describe("Filtra per tipo di voto"),
  limit: z.number().int().min(1).max(1000).default(700),
});

const RDFS_LABEL = "http://www.w3.org/2000/01/rdf-schema#label";

function stripLegLabel(label: string): string {
  return label.replace(/,\s*.* Legislatura della Repubblica\s*$/, "").trim();
}

const columns = ["deputy_uri", "deputy_name", "vote", "group_uri", "group_acronym", "html_url"];

// Le sigle di `ocd:siglaGruppo` (sui voti) non coincidono con l'acronym di
// `groups list`: al 26/7/2026, in leg. 19, AZ-PER-RE → APERRE, IV-CR → IVICRE,
// e il Misto è disaggregato per componente (issue #77, segnalato al gestore del
// dato). Il confronto ignora quindi maiuscole e punteggiatura, ma le differenze
// restanti non sono derivabili da una regola: per quelle si mostra l'elenco
// delle sigle realmente presenti nel voto, senza codificarne nessuna qui.
function normalizeAcronym(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Sigla del dataset corrispondente a quella richiesta, o null se nessuna. */
export function resolveGroupAcronym(requested: string, available: string[]): string | null {
  const exact = available.find((a) => a === requested);
  if (exact) return exact;
  const ci = available.find((a) => a.toUpperCase() === requested.toUpperCase());
  if (ci) return ci;
  const norm = normalizeAcronym(requested);
  return available.find((a) => normalizeAcronym(a) === norm) ?? null;
}

/** Somiglianza di Dice sui bigrammi: ordina i suggerimenti, non decide il match. */
function similarity(a: string, b: string): number {
  const bigrams = (s: string) => {
    const out: string[] = [];
    for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
    return out;
  };
  const A = bigrams(a);
  const B = bigrams(b);
  if (A.length === 0 || B.length === 0) return a === b ? 1 : 0;
  const pool = [...B];
  let hits = 0;
  for (const g of A) {
    const i = pool.indexOf(g);
    if (i >= 0) {
      hits++;
      pool.splice(i, 1);
    }
  }
  return (2 * hits) / (A.length + B.length);
}

/** Nota mostrata quando la sigla richiesta non esiste in quella votazione. */
export function buildGroupAcronymHint(requested: string, available: string[]): string {
  if (available.length === 0) {
    return `Nessuna sigla di gruppo registrata in questa votazione: il filtro --group-acronym non è applicabile.`;
  }
  const norm = normalizeAcronym(requested);
  const ranked = [...available].sort(
    (x, y) => similarity(norm, normalizeAcronym(y)) - similarity(norm, normalizeAcronym(x)),
  );
  const best = ranked[0];
  const parts = [
    `Nessun gruppo con sigla "${requested}" in questa votazione.`,
    `Le sigle registrate sui voti non coincidono sempre con l'acronym di 'groups list'.`,
  ];
  if (similarity(norm, normalizeAcronym(best)) >= 0.4) {
    parts.push(`Forse cercavi "${best}".`);
  }
  parts.push(`Sigle presenti in questa votazione: ${ranked.join(", ")}.`);
  // Condizione sulla richiesta, non sulla forma delle sigle disponibili: è un
  // fatto su cosa ha chiesto l'utente, non un'assunzione sui dati della fonte.
  if (norm === "MISTO") {
    parts.push(`Il gruppo Misto può comparire disaggregato nelle sue componenti: cercale nell'elenco qui sopra.`);
  }
  return parts.join(" ");
}

/** Sigle di gruppo effettivamente presenti nella votazione (query leggera). */
async function fetchVoteAcronyms(voteUri: string): Promise<string[]> {
  const query = `${OCD_PREFIXES}
SELECT DISTINCT ?siglaGruppo
WHERE {
  ?v a ocd:voto .
  ?v ocd:rif_votazione <${voteUri}> .
  ?v ocd:siglaGruppo ?siglaGruppo .
}`;
  const raw = flattenBindings(await cdQuery(query));
  return raw.map((r) => r.siglaGruppo ?? "").filter((s) => s !== "");
}

export const voteDetailTool: Tool<typeof inputSchema> = {
  name: "vote-detail",
  description:
    "[CAMERA] Voto individuale di ogni deputato in una singola votazione: come ha votato (Favorevole, Contrario, Astensione, Non ha votato) con gruppo parlamentare. Richiede l'URI della votazione (ottenibile da votes list).",
  inputSchema,
  examples: [
    "italianparliament vote-detail show --vote-uri http://dati.camera.it/ocd/votazione.rdf/vs19_047_005",
    "italianparliament vote-detail show --vote-uri http://dati.camera.it/ocd/votazione.rdf/vs18_100_005 --format jsonl",
    "italianparliament vote-detail show --vote-uri http://dati.camera.it/ocd/votazione.rdf/vs19_010_003 --limit 50",
    "italianparliament vote-detail show --vote-uri http://dati.camera.it/ocd/votazione.rdf/vs19_641_046 --group-acronym FDI --vote-type Contrario",
    "italianparliament vote-detail show --vote-uri http://dati.camera.it/ocd/votazione.rdf/vs19_456_018 --group-acronym APERRE",
  ],
  async execute(input) {
    const filters: string[] = [];
    if (input.groupAcronym) {
      // La sigla richiesta va risolta contro quelle realmente presenti nel voto,
      // altrimenti un FILTER su una sigla inesistente restituirebbe zero righe
      // senza dire perché (issue #77).
      const available = await fetchVoteAcronyms(input.voteUri);
      const resolved = resolveGroupAcronym(input.groupAcronym, available);
      if (!resolved) {
        return { rows: [], columns, hint: buildGroupAcronymHint(input.groupAcronym, available) };
      }
      filters.push(`?v ocd:siglaGruppo ?_sg . FILTER(STR(?_sg) = "${resolved}")`);
    }
    if (input.voteType) filters.push(`FILTER(?type = "${input.voteType}")`);

    const query = `${OCD_PREFIXES}
SELECT DISTINCT ?deputy_uri ?deputy_label ?type ?rif_gruppoParlamentare ?siglaGruppo
WHERE {
  ?v a ocd:voto .
  ?v ocd:rif_votazione <${input.voteUri}> .
  ?v ocd:rif_deputato ?deputy_uri .
  ?v dc:type ?type .
  ${filters.join("\n  ")}
  OPTIONAL { ?deputy_uri <${RDFS_LABEL}> ?deputy_label }
  OPTIONAL { ?v ocd:rif_gruppoParlamentare ?rif_gruppoParlamentare }
  OPTIONAL { ?v ocd:siglaGruppo ?siglaGruppo }
}
LIMIT ${input.limit}`;

    const results = await cdQuery(query);
    const raw = flattenBindings(results);
    const rows = raw.map((r) => ({
      deputy_uri: r.deputy_uri ?? "",
      deputy_name: stripLegLabel(r.deputy_label ?? ""),
      vote: r.type ?? "",
      group_uri: r.rif_gruppoParlamentare ?? "",
      group_acronym: r.siglaGruppo ?? "",
      html_url: personHtmlUrl(r.deputy_uri),
    }));
    return { rows, columns };
  },
};
