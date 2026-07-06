import { z } from "zod";
import { cdQuery, snQuery } from "../core/client.js";
import { flattenBindings } from "../core/flatten.js";
import { OCD_PREFIXES, OSR_PREFIXES } from "../core/prefixes.js";
import { personHtmlUrl } from "../core/html-url.js";
import { toTitleCase, normalizeGender } from "../core/normalize.js";
import { currentLegislature } from "../core/current-legislature.js";
import type { Tool } from "./types.js";

const SENATO_LEG_BASE = "http://dati.senato.it/legislatura/";

const inputSchema = z.object({
  name: z.string().min(1).describe("Nome o cognome da cercare"),
  chamber: z
    .enum(["camera", "senato", "both"])
    .default("both")
    .describe("Ramo del parlamento in cui cercare"),
  legislature: z.number().int().positive().optional(),
  activeOnly: z.boolean().optional(),
  limit: z.number().int().positive().max(500).default(50),
});

const columns = [
  "chamber",
  "uri",
  "label",
  "first_name",
  "last_name",
  "gender",
  "legislature_uri",
  "html_url",
];

function sparqlEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Spezza la stringa in token su spazi (scartando i vuoti). */
function tokenize(name: string): string[] {
  return name.trim().split(/\s+/).filter(Boolean);
}

async function searchCamera(
  name: string,
  legislature: number | undefined,
  limit: number,
) {
  const legFilter =
    legislature !== undefined
      ? `FILTER(?rif_leg = <http://dati.camera.it/ocd/legislatura.rdf/repubblica_${legislature}>)`
      : "";
  // AND per token: ogni parola deve comparire nell'etichetta (che è il nome
  // anagrafico completo). Così "Elena Schlein" trova "Elena Ethel Schlein" e
  // l'ordine ("Schlein Elena") è indifferente.
  const nameFilters = tokenize(name)
    .map(
      (t) =>
        `FILTER(CONTAINS(LCASE(STR(?label)), LCASE("${sparqlEscape(t)}")))`,
    )
    .join("\n  ");
  const query = `${OCD_PREFIXES}
SELECT DISTINCT ?s ?label ?first_name ?last_name ?gender ?rif_leg
WHERE {
  ?s a <http://dati.camera.it/ocd/deputato> .
  ?s rdfs:label ?label .
  OPTIONAL { ?s foaf:firstName ?first_name }
  OPTIONAL { ?s foaf:surname ?last_name }
  OPTIONAL { ?s foaf:gender ?gender }
  OPTIONAL { ?s <http://dati.camera.it/ocd/rif_leg> ?rif_leg }
  ${nameFilters}
  ${legFilter}
}
LIMIT ${limit}`;
  const results = await cdQuery(query);
  const raw = flattenBindings(results);
  return raw.map((r) => {
    const first_name = toTitleCase(r.first_name ?? "");
    const last_name = toTitleCase(r.last_name ?? "");
    return {
      chamber: "camera",
      uri: r.s ?? "",
      label: `${first_name} ${last_name}`.trim(),
      first_name,
      last_name,
      gender: normalizeGender(r.gender ?? ""),
      legislature_uri: r.rif_leg ?? "",
      html_url: personHtmlUrl(r.s),
    };
  });
}

async function searchSenato(
  name: string,
  legislature: number | undefined,
  activeOnly: boolean | undefined,
  limit: number,
) {
  const effectiveActive =
    activeOnly ?? legislature === undefined;
  const legFilter =
    legislature !== undefined ? `FILTER(?leg=${legislature})` : "";
  const activeFilter = effectiveActive ? "FILTER(!bound(?me))" : "";
  // AND per token su "nome cognome": ogni parola deve comparire. L'ordine è
  // indifferente (il token match non dipende dalla sequenza), quindi non serve
  // più il doppio CONCAT nome/cognome + cognome/nome.
  const nameFilters = tokenize(name)
    .map(
      (t) =>
        `FILTER(CONTAINS(LCASE(CONCAT(?fn, " ", ?ln)), LCASE("${sparqlEscape(t)}")))`,
    )
    .join("\n  ");

  const query = `${OSR_PREFIXES}
SELECT DISTINCT ?s ?fn ?ln ?leg ?me ?gen
WHERE {
  ?s a osr:Senatore .
  ?s <http://xmlns.com/foaf/0.1/firstName> ?fn .
  ?s <http://xmlns.com/foaf/0.1/lastName> ?ln .
  ?s osr:mandato ?m .
  ?m osr:legislatura ?leg .
  OPTIONAL { ?m osr:fine ?me }
  OPTIONAL { ?s <http://xmlns.com/foaf/0.1/gender> ?gen }
  ${nameFilters}
  ${legFilter}
  ${activeFilter}
}
ORDER BY ?ln ?fn
LIMIT ${limit}`;
  const results = await snQuery(query);
  const raw = flattenBindings(results);
  return raw.map((r) => {
    const first_name = toTitleCase(r.fn ?? "");
    const last_name = toTitleCase(r.ln ?? "");
    return {
      chamber: "senato",
      uri: r.s ?? "",
      label: `${first_name} ${last_name}`.trim(),
      first_name,
      last_name,
      gender: normalizeGender(r.gen ?? ""),
      legislature_uri: r.leg ? `${SENATO_LEG_BASE}${r.leg}` : "",
      html_url: personHtmlUrl(r.s),
    };
  });
}

export const searchTool: Tool<typeof inputSchema> = {
  name: "search",
  description:
    "[CAMERA+SENATO] Cerca parlamentari per nome/cognome in Camera, Senato o entrambi. Utile come primo passo per trovare l'URI di un parlamentare. Ranking dei risultati: match esatto sul cognome/token finale e preferenza per la legislatura corrente (19) portano in cima il parlamentare più pertinente (es. 'boschi' → Maria Elena Boschi leg.19 prima degli omonimi storici e delle sottostringhe come 'Tiraboschi').",
  inputSchema,
  examples: [
    'italianparliament search find --name "rossi"',
    'italianparliament search find --name "meloni" --chamber camera',
    'italianparliament search find --name "schlein" --chamber both --legislature 19',
  ],
  async execute(input) {
    const rows = [];
    if (input.chamber === "camera" || input.chamber === "both") {
      rows.push(
        ...(await searchCamera(input.name, input.legislature, input.limit)),
      );
    }
    if (input.chamber === "senato" || input.chamber === "both") {
      rows.push(
        ...(await searchSenato(
          input.name,
          input.legislature,
          input.activeOnly,
          input.limit,
        )),
      );
    }
    // Ranking lato TS: match esatto cognome/token finale + preferenza per la
    // legislatura corrente (risolta dinamicamente dall'endpoint Camera).
    // Porta in cima il parlamentare più pertinente anche quando la query per
    // cognome matcha omonimi storici o sottostringhe
    // (es. 'boschi' → Maria Elena Boschi leg. corrente prima di 'Tiraboschi').
    const currentLeg = await currentLegislature();
    rows.sort(
      (a, b) => scoreRow(b, input.name, currentLeg) - scoreRow(a, input.name, currentLeg),
    );
    return { rows, columns };
  },
};

/**
 * Score per il ranking dei risultati di ricerca.
 * - match esatto sul cognome (token finale della query): batte le sottostringhe
 *   ('Boschi' batte 'Tiraboschi')
 * - match esatto su nome completo quando la query è multi-token
 * - preferenza per la legislatura corrente
 * - tie-break: Camera prima di Senato
 */
function scoreRow(
  row: {
    chamber: string;
    first_name: string;
    last_name: string;
    legislature_uri: string;
  },
  query: string,
  currentLeg: number,
): number {
  const q = tokenize(query).map((t) => t.toLowerCase());
  const last = toTitleCase(row.last_name ?? "").toLowerCase().trim();
  const first = toTitleCase(row.first_name ?? "").toLowerCase().trim();
  let score = 0;

  if (q.length === 1) {
    // query singolo token: valuta come cognome
    const token = q[0];
    if (last === token) score += 100;
    else if (last.includes(token)) score += 50;
    if (first === token) score += 80;
  } else {
    // query multi-token: match esatto cognome sull'ultimo token
    // (es. 'Maria Elena Boschi' → 'Boschi') + nome completo
    const lastToken = q[q.length - 1];
    if (last === lastToken) score += 100;
    else if (last.includes(lastToken)) score += 50;
    const allLast = q.every((t) => last.includes(t));
    const allFirst = q.every((t) => first.includes(t));
    if (allLast && allFirst) score += 80;
  }

  // preferenza legislatura corrente
  const leg = row.legislature_uri ?? "";
  if (leg.endsWith(`_${currentLeg}`) || leg.endsWith(`/${currentLeg}`)) score += 30;

  // tie-break: Camera prima di Senato (ramo di default per ricerche d'aula)
  if (row.chamber === "camera") score += 5;

  return score;
}
