import { z } from "zod";
import { cdQuery, snQuery } from "../core/client.js";
import { flattenBindings } from "../core/flatten.js";
import { OCD_PREFIXES, OSR_PREFIXES } from "../core/prefixes.js";
import type { Tool } from "./types.js";

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
];

function sparqlEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
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
  const query = `${OCD_PREFIXES}
SELECT DISTINCT ?s ?label ?first_name ?last_name ?gender ?rif_leg
WHERE {
  ?s a <http://dati.camera.it/ocd/deputato> .
  ?s rdfs:label ?label .
  OPTIONAL { ?s foaf:firstName ?first_name }
  OPTIONAL { ?s foaf:surname ?last_name }
  OPTIONAL { ?s foaf:gender ?gender }
  OPTIONAL { ?s <http://dati.camera.it/ocd/rif_leg> ?rif_leg }
  FILTER(CONTAINS(LCASE(STR(?label)), LCASE("${sparqlEscape(name)}")))
  ${legFilter}
}
LIMIT ${limit}`;
  const results = await cdQuery(query);
  const raw = flattenBindings(results);
  return raw.map((r) => ({
    chamber: "camera",
    uri: r.s ?? "",
    label: r.label ?? "",
    first_name: r.first_name ?? "",
    last_name: r.last_name ?? "",
    gender: r.gender ?? "",
    legislature_uri: r.rif_leg ?? "",
  }));
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
  const escaped = sparqlEscape(name);

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
  FILTER(CONTAINS(LCASE(?fn), LCASE("${escaped}")) || CONTAINS(LCASE(?ln), LCASE("${escaped}")))
  ${legFilter}
  ${activeFilter}
}
ORDER BY ?ln ?fn
LIMIT ${limit}`;
  const results = await snQuery(query);
  const raw = flattenBindings(results);
  return raw.map((r) => ({
    chamber: "senato",
    uri: r.s ?? "",
    label: `${r.fn ?? ""} ${r.ln ?? ""}`.trim(),
    first_name: r.fn ?? "",
    last_name: r.ln ?? "",
    gender: r.gen ?? "",
    legislature_uri: r.leg ?? "",
  }));
}

export const searchTool: Tool<typeof inputSchema> = {
  name: "search",
  description:
    "[CAMERA+SENATO] Cerca parlamentari per nome/cognome in Camera, Senato o entrambi. Utile come primo passo per trovare l'URI di un parlamentare.",
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
    return { rows, columns };
  },
};
