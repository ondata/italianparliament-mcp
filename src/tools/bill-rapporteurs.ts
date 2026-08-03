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

// Camera: il relatore è un triple DIRETTO sull'atto (ocd:rif_relatore). La
// versione precedente lo raggiungeva solo via dibattito → discussione →
// relatore, e questo lo rendeva vuoto su tutti gli atti recenti: le classi
// `ocd:dibattito`/`ocd:discussione`/`ocd:seduta` sono pubblicate con settimane
// di ritardo rispetto a `ocd:relatore` (al 2026-08-03: lotto 18/06 contro
// 01/08), quindi un atto la cui relazione parte dopo l'ultimo lotto dei lavori
// d'Aula non ha alcun dibattito su cui agganciarsi. Il percorso indiretto resta
// come OPTIONAL, perché è l'unico che porta commissione e data: quando i
// lavori d'Aula non sono ancora caricati quelle colonne restano vuote, ma il
// nome del relatore — il dato che serve — esce comunque.
function cameraQuery(billUri: string, limit: number): string {
  return `${OCD_PREFIXES}
SELECT DISTINCT ?relatoreLabel ?relatoreType ?dibattitoLabel ?startDate ?deputatoUri
WHERE {
  <${billUri}> ocd:rif_relatore ?rel .
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
 * Un atto porta più nodi `ocd:relatore` per la stessa persona (C.2987 ne ha due
 * per FRASSINI, con `ods:modified` diversi). Se anche solo uno di quei nodi è
 * agganciato a un dibattito, l'OPTIONAL della query produce per lo stesso
 * deputato sia righe con commissione e data sia righe nude: le seconde non
 * aggiungono nulla e si leggerebbero come relatori distinti. Si scartano solo
 * in presenza di righe arricchite; quando l'atto è tutto sui lavori d'Aula non
 * ancora caricati, le righe nude sono l'unica risposta e vanno tenute.
 */
export function dropBareDuplicates(rows: RapporteurRow[]): RapporteurRow[] {
  const key = (r: RapporteurRow) => r.deputy_uri || r.rapporteur_name.trim().toUpperCase();
  const enriched = new Set(
    rows.filter((r) => r.committee !== "" || r.date !== "").map(key),
  );
  return rows.filter((r) => r.committee !== "" || r.date !== "" || !enriched.has(key(r)));
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
