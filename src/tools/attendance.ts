import { z } from "zod";
import { cdQuery } from "../core/client.js";
import { OCD_PREFIXES } from "../core/prefixes.js";
import { flattenBindings } from "../core/flatten.js";
import { personHtmlUrl } from "../core/html-url.js";
import type { Tool } from "./types.js";

function stripLegLabel(label: string): string {
  return label.replace(/,\s*.* Legislatura della Repubblica\s*$/, "").trim();
}

const inputSchema = z.object({
  uri: z.string().url().optional().describe("URI completo del deputato"),
  id: z.number().int().positive().optional().describe("ID numerico deputato"),
  legislature: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Numero legislatura (richiesta con --id)"),
});

const columns = [
  "deputy_uri",
  "deputy_name",
  "html_url",
  "favorevole",
  "contrario",
  "astensione",
  "non_ha_votato",
  "ha_votato",
  "altro",
  "totale",
];

export const attendanceTool: Tool<typeof inputSchema> = {
  name: "attendance",
  description:
    "[CAMERA] Conteggio aggregato dei voti espressi da un deputato in tutte le votazioni della sua legislatura (favorevole/contrario/astensione/non ha votato/ha votato in scrutinio segreto). L'URI del deputato è già specifico di una legislatura (es. .../deputato.rdf/d306921_17), quindi il conteggio è già delimitato senza bisogno di un filtro separato. Input per URI o per id+legislature.",
  inputSchema,
  examples: [
    "italianparliament attendance show --uri http://dati.camera.it/ocd/deputato.rdf/d302103_19",
    "italianparliament attendance show --id 302103 --legislature 19",
    "italianparliament attendance show --uri http://dati.camera.it/ocd/deputato.rdf/d306921_17 --format jsonl",
  ],
  async execute(input) {
    if (!input.uri && (input.id === undefined || input.legislature === undefined)) {
      throw new Error("Passare --uri oppure --id e --legislature insieme.");
    }
    const uri =
      input.uri ??
      `http://dati.camera.it/ocd/deputato.rdf/d${input.id}_${input.legislature}`;

    const query = `${OCD_PREFIXES}
SELECT ?type (COUNT(?v) AS ?n) WHERE {
  ?v a ocd:voto ; ocd:rif_deputato <${uri}> ; dc:type ?type .
} GROUP BY ?type`;

    const labelQuery = `${OCD_PREFIXES}
SELECT ?label WHERE { <${uri}> rdfs:label ?label } LIMIT 1`;

    const [results, labelResults] = await Promise.all([
      cdQuery(query),
      cdQuery(labelQuery),
    ]);
    const raw = flattenBindings(results);
    if (raw.length === 0) {
      throw new Error(`Nessun voto trovato per il deputato: ${uri}`);
    }

    // Valori noti di dc:type sul voto (verificati su leg. 17 e 19): 4 esiti +
    // "Ha votato", marcatore di partecipazione per gli scrutini segreti dove la
    // scelta individuale non è tracciata (non è un'assenza).
    const KNOWN: Record<string, string> = {
      Favorevole: "favorevole",
      Contrario: "contrario",
      Astensione: "astensione",
      "Non ha votato": "non_ha_votato",
      "Ha votato": "ha_votato",
    };
    const counts: Record<string, number> = {
      favorevole: 0,
      contrario: 0,
      astensione: 0,
      non_ha_votato: 0,
      ha_votato: 0,
      altro: 0,
    };
    let totale = 0;
    for (const r of raw) {
      const n = Number(r.n ?? 0);
      const key = KNOWN[r.type ?? ""] ?? "altro";
      counts[key] += n;
      totale += n;
    }

    const label = flattenBindings(labelResults)[0]?.label ?? "";
    const rows = [
      {
        deputy_uri: uri,
        deputy_name: stripLegLabel(label),
        html_url: personHtmlUrl(uri),
        favorevole: String(counts.favorevole),
        contrario: String(counts.contrario),
        astensione: String(counts.astensione),
        non_ha_votato: String(counts.non_ha_votato),
        ha_votato: String(counts.ha_votato),
        altro: String(counts.altro),
        totale: String(totale),
      },
    ];
    return { rows, columns };
  },
};
