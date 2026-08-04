import { z } from "zod";
import { cdQuery, snQuery } from "../core/client.js";
import { OCD_PREFIXES, OSR_PREFIXES } from "../core/prefixes.js";
import { flattenBindings } from "../core/flatten.js";
import { personHtmlUrl } from "../core/html-url.js";
import type { Tool } from "./types.js";

const inputSchema = z.object({
  billUri: z
    .string()
    .url()
    .describe(
      "URI del DDL. Camera (es. http://dati.camera.it/ocd/attocamera.rdf/ac19_2807) o Senato (es. http://dati.senato.it/ddl/59313). Il ramo è rilevato dall'URI.",
    ),
  limit: z.number().int().min(1).max(500).default(100),
});

const columns = [
  "rapporteur_name",
  "rapporteur_type",
  "committee",
  "date",
  "deputy_uri",
  "html_url",
];

const RDFS_LABEL = "http://www.w3.org/2000/01/rdf-schema#label";

// Camera: due sorgenti DISGIUNTE, da unire.
//
// L'atto porta un `ocd:rif_relatore` diretto (nodi `rel19_11378`), e ogni
// discussione ne porta uno suo (nodi `rel19_307641_198615`). Non sono gli
// stessi nodi e non coincidono nemmeno nel contenuto: su C.2822 solo la prima
// sorgente conosce COLUCCI, solo la seconda conosce commissione e data; su
// C.687 la prima ha il solo LEPRI e la seconda dieci relatori fra cui DE
// MARTINI. Anche le label divergono ("COLUCCI Alessandro" contro "Igor IEZZI").
//
// La versione precedente leggeva solo la seconda, e questo la rendeva vuota su
// tutti gli atti recenti: `ocd:dibattito`/`ocd:discussione`/`ocd:seduta` sono
// pubblicate con settimane di ritardo rispetto a `ocd:relatore` (al 2026-08-03:
// lotto 18/06 contro 01/08), quindi un atto la cui relazione parte dopo
// l'ultimo lotto dei lavori d'Aula non ha alcun dibattito su cui agganciarsi.
// Leggere solo la prima non è un'alternativa: perderebbe relatori e insieme
// commissione e data. Da qui la UNION, più l'OPTIONAL che arricchisce ogni
// relatore con il dibattito in cui ha riferito, quando quel dibattito c'è.
function cameraQuery(billUri: string, limit: number): string {
  return `${OCD_PREFIXES}
SELECT DISTINCT ?relatoreLabel ?relatoreType ?dibattitoLabel ?startDate ?deputatoUri
WHERE {
  { <${billUri}> ocd:rif_relatore ?rel }
  UNION
  {
    <${billUri}> ocd:rif_dibattito ?dibSrc .
    ?dibSrc ocd:rif_discussione ?discSrc .
    ?discSrc ocd:rif_relatore ?rel .
  }
  ?rel <${RDFS_LABEL}> ?relatoreLabel .
  OPTIONAL { ?rel ocd:rif_deputato ?deputatoUri }
  OPTIONAL { ?rel dc:type ?relatoreType }
  OPTIONAL {
    <${billUri}> ocd:rif_dibattito ?dib .
    ?dib ocd:rif_discussione ?disc .
    ?disc ocd:rif_relatore ?rel .
    ?dib <${RDFS_LABEL}> ?dibattitoLabel .
    OPTIONAL { ?dib ocd:startDate ?startDate }
  }
}
ORDER BY ?startDate ?relatoreLabel
LIMIT ${limit}`;
}

// Senato: relatori via osr:relatore (blank node con label, tipoRelatore, organo,
// dataNomina, senatore). Mappati sulle stesse colonne della Camera.
function senatoQuery(billUri: string, limit: number): string {
  return `${OSR_PREFIXES}
SELECT DISTINCT ?relatoreLabel ?tipoRelatore ?organo ?dataNomina ?senatoreUri
WHERE {
  <${billUri}> osr:relatore ?rel .
  ?rel <${RDFS_LABEL}> ?relatoreLabel .
  OPTIONAL { ?rel osr:tipoRelatore ?tipoRelatore }
  OPTIONAL { ?rel osr:organo ?organo }
  OPTIONAL { ?rel osr:dataNomina ?dataNomina }
  OPTIONAL { ?rel osr:senatore ?senatoreUri }
}
ORDER BY ?dataNomina ?relatoreLabel
LIMIT ${limit}`;
}

type RapporteurRow = {
  rapporteur_name: string;
  rapporteur_type: string;
  committee: string;
  date: string;
  deputy_uri: string;
  html_url: string;
};

/**
 * La UNION fa arrivare la stessa persona da entrambe le sorgenti: dal lato atto
 * come riga senza commissione né data (e spesso senza tipo), dal lato
 * discussione come riga completa. La prima allora non aggiunge nulla e si
 * leggerebbe come un relatore in più, per giunta con il nome in un'altra forma.
 *
 * Si scarta solo ciò che è vuoto su tutti e tre i campi. Il tipo va incluso nel
 * test perché non è un dettaglio raro: 35.708 nodi `ocd:relatore` su 42.250 lo
 * portano (misura del 2026-08-04), e fra i sei valori ci sono
 * maggioranza/minoranza nelle due grafie, ~2.800 nodi in tutto. Sono la
 * distinzione politicamente più significativa del tool — il relatore di
 * minoranza è il contraddittorio — e senza questa clausola sparirebbero ogni
 * volta che la stessa persona arriva anche dal lato discussione.
 *
 * Quando poi le righe spoglie sono l'unica risposta — gli atti in corso, con i
 * lavori d'Aula non ancora pubblicati — vanno tenute: sono esattamente il vuoto
 * che questo tool ha smesso di produrre.
 */
export function dropBareDuplicates(rows: RapporteurRow[]): RapporteurRow[] {
  const key = (r: RapporteurRow) => r.deputy_uri || r.rapporteur_name.trim().toUpperCase();
  const bare = (r: RapporteurRow) =>
    r.committee === "" && r.date === "" && r.rapporteur_type === "";
  const informative = new Set(rows.filter((r) => !bare(r)).map(key));
  return rows.filter((r) => !bare(r) || !informative.has(key(r)));
}

export const billRapporteursTool: Tool<typeof inputSchema> = {
  name: "bill-rapporteurs",
  description:
    "[CAMERA/SENATO] Relatori di un DDL: nome, tipo (Relatore / f.f.), commissione/organo assegnato e data. Il ramo (Camera o Senato) è rilevato automaticamente dall'URI del DDL. CAMERA: `committee`, `date` e `rapporteur_type` provengono dai lavori d'Aula, area del LOD pubblicata con settimane di ritardo — sugli atti in corso possono essere vuote mentre il nome del relatore è corretto e aggiornato. Colonne vuote NON significano relatore incerto.",
  inputSchema,
  examples: [
    "italianparliament bill-rapporteurs list --bill-uri http://dati.camera.it/ocd/attocamera.rdf/ac19_2807",
    "italianparliament bill-rapporteurs list --bill-uri http://dati.senato.it/ddl/59313",
  ],
  async execute(input) {
    const isSenato = input.billUri.includes("dati.senato.it");

    if (isSenato) {
      const raw = flattenBindings(await snQuery(senatoQuery(input.billUri, input.limit)));
      const rows = raw.map((r) => ({
        rapporteur_name: r.relatoreLabel ?? "",
        rapporteur_type: r.tipoRelatore ?? "",
        committee: r.organo ?? "",
        date: r.dataNomina ?? "",
        deputy_uri: r.senatoreUri ?? "",
        html_url: personHtmlUrl(r.senatoreUri),
      }));
      return { rows, columns };
    }

    const raw = flattenBindings(await cdQuery(cameraQuery(input.billUri, input.limit)));
    const rows = dropBareDuplicates(
      raw.map((r) => ({
        rapporteur_name: r.relatoreLabel ?? "",
        rapporteur_type: r.relatoreType ?? "",
        committee: r.dibattitoLabel ?? "",
        date: r.startDate ?? "",
        deputy_uri: r.deputatoUri ?? "",
        html_url: personHtmlUrl(r.deputatoUri),
      })),
    );
    // Il troncamento va misurato sulle righe grezze: dopo il dedup
    // `rows.length` può essere sceso sotto il limite pur avendo la query
    // riempito il LIMIT (cfr. core/truncation.ts).
    return { rows, columns, truncated: raw.length >= input.limit };
  },
};
