import { z } from "zod";
import { cdQuery } from "../core/client.js";
import { OCD_PREFIXES } from "../core/prefixes.js";
import { flattenBindings } from "../core/flatten.js";
import { decodeHtml } from "../core/decode-html.js";
import { cleanGroupLabel } from "../core/group-label.js";
import type { Tool } from "./types.js";

const inputSchema = z.object({
  uri: z
    .string()
    .url()
    .describe(
      "URI di un deputato (http://dati.camera.it/ocd/deputato.rdf/d302103_19) o di una persona (.../persona.rdf/p302103). Da search o deputy.",
    ),
});

const columns = [
  "kind",
  "chamber",
  "legislature",
  "role",
  "start_date",
  "end_date",
  "uri",
];

const PERSONA_BASE = "http://dati.camera.it/ocd/persona.rdf/";

function personId(uri: string): string {
  const m = uri.match(/\/(?:deputato\.rdf\/d|persona\.rdf\/p)(\d+)(?:_\d+)?$/);
  return m ? m[1] : "";
}

function legNum(legUri: string): string {
  const m = legUri.match(/repubblica_(\d+)$/);
  return m ? m[1] : legUri;
}

export const personCareerTool: Tool<typeof inputSchema> = {
  name: "person-career",
  title: "Carriera di una persona (Camera)",
  description:
    "[CAMERA] Carriera unificata di una persona attraverso le legislature e il governo, a partire dall'entità persona della Camera (che unifica i mandati da deputato in tutte le legislature e gli incarichi di governo). Risolve 'doppio incarico parlamento+governo' e 'carriera multi-legislatura'. NB: il collegamento Camera↔Senato non è esposto nei dati (namespace separati, nessun ID condiviso); va fatto per nome + data di nascita.",
  inputSchema,
  examples: [
    "italianparliament person-career show --uri http://dati.camera.it/ocd/deputato.rdf/d302103_19",
    "italianparliament person-career show --uri http://dati.camera.it/ocd/persona.rdf/p302103 --format jsonl",
  ],
  async execute(input) {
    const id = personId(input.uri);
    if (!id) {
      throw new Error(
        `URI non riconosciuto: ${input.uri}. Atteso un deputato (.../deputato.rdf/d{id}_{leg}) o una persona (.../persona.rdf/p{id}).`,
      );
    }
    const persona = `${PERSONA_BASE}p${id}`;

    const query = `${OCD_PREFIXES}
PREFIX owl: <http://www.w3.org/2002/07/owl#>
SELECT ?kind ?leg ?role ?start ?end ?uri ?name ?wikidata WHERE {
  <${persona}> rdfs:label ?name .
  OPTIONAL { <${persona}> owl:sameAs ?wikidata . FILTER(CONTAINS(STR(?wikidata), "wikidata.org")) }
  {
    <${persona}> ocd:rif_mandatoCamera ?m .
    ?uri a ocd:deputato ; ocd:rif_mandatoCamera ?m ; ocd:rif_leg ?leg .
    BIND("mandato-camera" AS ?kind)
  } UNION {
    <${persona}> ocd:rif_mandatoCamera ?m2 .
    ?depU a ocd:deputato ; ocd:rif_mandatoCamera ?m2 .
    ?uri a ocd:gruppoParlamentare ; rdfs:label ?role ; ocd:siComponeDi ?gm ; ocd:rif_leg ?leg .
    ?gm ocd:rif_deputato ?depU .
    OPTIONAL { ?gm dc:date ?start }
    OPTIONAL { ?gm ocd:dataFine ?end }
    BIND("gruppo" AS ?kind)
  } UNION {
    <${persona}> ocd:rif_membroGoverno ?uri .
    ?uri rdfs:label ?role .
    OPTIONAL { ?uri ocd:startDate ?start }
    OPTIONAL { ?uri ocd:endDate ?end }
    BIND("governo" AS ?kind)
  }
}`;

    const raw = flattenBindings(await cdQuery(query));
    if (raw.length === 0) {
      throw new Error(`Nessuna carriera trovata per la persona p${id} (URI: ${input.uri}).`);
    }

    const name = decodeHtml(raw[0].name ?? "");
    const wikidata = raw.find((r) => r.wikidata)?.wikidata ?? "";

    const rows: Record<string, string>[] = [
      {
        kind: "persona",
        chamber: "",
        legislature: "",
        role: name,
        start_date: "",
        end_date: "",
        uri: wikidata || persona,
      },
    ];

    for (const r of raw) {
      if (r.kind === "mandato-camera") {
        rows.push({
          kind: "mandato-camera",
          chamber: "camera",
          legislature: legNum(r.leg ?? ""),
          role: "Deputato",
          start_date: "",
          end_date: "",
          uri: r.uri ?? "",
        });
      } else if (r.kind === "gruppo") {
        // dc:date = "YYYYMMDD-YYYYMMDD" (inizio-fine concatenati) o "YYYYMMDD-".
        const parts = (r.start ?? "").split("-");
        rows.push({
          kind: "gruppo",
          chamber: "camera",
          legislature: legNum(r.leg ?? ""),
          role: cleanGroupLabel(r.role ?? ""),
          start_date: parts[0] ?? "",
          end_date: r.end || parts[1] || "",
          uri: r.uri ?? "",
        });
      } else if (r.kind === "governo") {
        rows.push({
          kind: "governo",
          chamber: "governo",
          legislature: "",
          role: decodeHtml(r.role ?? ""),
          start_date: r.start ?? "",
          end_date: r.end ?? "",
          uri: r.uri ?? "",
        });
      }
    }
    // dedup (le righe ripetono name/wikidata → possibili duplicati esatti)
    const seen = new Set<string>();
    const deduped = rows.filter((r) => {
      const k = `${r.kind}|${r.legislature}|${r.uri}|${r.role}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    // Ordine leggibile: persona, poi mandati, gruppi e governo; entro ogni
    // categoria in ordine cronologico di inizio.
    const kindOrder: Record<string, number> = {
      persona: 0,
      "mandato-camera": 1,
      gruppo: 2,
      governo: 3,
    };
    deduped.sort((a, b) => {
      const ko = (kindOrder[a.kind] ?? 9) - (kindOrder[b.kind] ?? 9);
      if (ko !== 0) return ko;
      return (a.start_date || "").localeCompare(b.start_date || "");
    });
    return { rows: deduped, columns };
  },
};
