import { z } from "zod";
import { snQuery, cdQuery } from "../core/client.js";
import { OSR_PREFIXES, OCD_PREFIXES } from "../core/prefixes.js";
import { flattenBindings } from "../core/flatten.js";
import { decodeHtml } from "../core/decode-html.js";
import type { Tool } from "./types.js";

const inputSchema = z.object({
  billUri: z
    .string()
    .url()
    .describe(
      "URI del DDL/atto. Camera (es. http://dati.camera.it/ocd/attocamera.rdf/ac19_2822) o Senato (es. http://dati.senato.it/ddl/59924). Il ramo è rilevato dall'URI.",
    ),
  limit: z.number().int().min(1).max(500).default(100),
});

const columns = [
  "chamber",
  "committee",
  "role",
  "committee_type",
  "date",
  "committee_uri",
];

const RDFS_LABEL = "http://www.w3.org/2000/01/rdf-schema#label";

// Senato: commissioni assegnate via osr:assegnazione (blank node con label,
// organo, sede — solo sulla referente —, tipoCommissione, dataAssegnazione).
function senatoQuery(billUri: string, limit: number): string {
  return `${OSR_PREFIXES}
SELECT DISTINCT ?label ?organo ?sede ?tipo ?data
WHERE {
  <${billUri}> osr:assegnazione ?a .
  OPTIONAL { ?a <${RDFS_LABEL}> ?label }
  OPTIONAL { ?a osr:organo ?organo }
  OPTIONAL { ?a osr:sede ?sede }
  OPTIONAL { ?a osr:tipoCommissione ?tipo }
  OPTIONAL { ?a osr:dataAssegnazione ?data }
}
ORDER BY ?data ?label
LIMIT ${limit}`;
}

// Camera: commissioni assegnate via ocd:rif_assegnazione (evento con
// rif_organo → label, ocd:sede, dc:date YYYYMMDD).
function cameraQuery(billUri: string, limit: number): string {
  return `${OCD_PREFIXES}
SELECT DISTINCT ?organo ?organoLabel ?sede ?date ?title
WHERE {
  <${billUri}> ocd:rif_assegnazione ?a .
  OPTIONAL { ?a ocd:rif_organo ?organo . OPTIONAL { ?organo <${RDFS_LABEL}> ?organoLabel } }
  OPTIONAL { ?a ocd:sede ?sede }
  OPTIONAL { ?a dc:date ?date }
  OPTIONAL { ?a dc:title ?title }
}
ORDER BY ?date
LIMIT ${limit}`;
}

const fmtCameraDate = (d?: string): string =>
  d && /^\d{8}$/.test(d)
    ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`
    : (d ?? "");

export const billCommitteesTool: Tool<typeof inputSchema> = {
  name: "bill-committees",
  title: "Commissioni assegnatarie di un DDL",
  description:
    "[CAMERA/SENATO] Commissioni a cui un DDL/atto è assegnato: nome commissione, sede/ruolo (Referente, Consultiva, Redigente, Deliberante), tipo, data di assegnazione e URI dell'organo. Il ramo è rilevato automaticamente dall'URI. Riproduce la sezione 'Commissioni a cui l'atto è stato assegnato' delle schede parlamentari.",
  inputSchema,
  examples: [
    "italianparliament bill-committees list --bill-uri http://dati.senato.it/ddl/59924",
    "italianparliament bill-committees list --bill-uri http://dati.camera.it/ocd/attocamera.rdf/ac19_2822",
  ],
  async execute(input) {
    const isSenato = input.billUri.includes("dati.senato.it");

    if (isSenato) {
      const raw = flattenBindings(await snQuery(senatoQuery(input.billUri, input.limit)));
      const rows = raw.map((r) => ({
        chamber: "senato",
        committee: decodeHtml(r.label ?? ""),
        // Ruolo: osr:sede (es. "referente") è presente solo sulla commissione
        // primaria; per le altre vale il tipoCommissione (es. "consultiva").
        role: r.sede || r.tipo || "",
        committee_type: r.tipo ?? "",
        date: r.data ?? "",
        committee_uri: r.organo ?? "",
      }));
      return { rows, columns };
    }

    const raw = flattenBindings(await cdQuery(cameraQuery(input.billUri, input.limit)));
    const rows = raw.map((r) => ({
      chamber: "camera",
      committee: decodeHtml(r.organoLabel ?? r.title ?? ""),
      role: r.sede ?? "",
      committee_type: "",
      date: fmtCameraDate(r.date),
      committee_uri: r.organo ?? "",
    }));
    return { rows, columns };
  },
};
