import { z } from "zod";
import { cdQuery } from "../core/client.js";
import { OCD_PREFIXES } from "../core/prefixes.js";
import { flattenBindings } from "../core/flatten.js";
import type { Tool } from "./types.js";

const RANK_BY = z.enum(["aic", "bills"]);

const inputSchema = z.object({
  rankBy: RANK_BY.describe(
    "Cosa contare per gruppo: aic (atti di indirizzo e controllo) o bills (disegni di legge), via il gruppo del primo firmatario.",
  ),
  legislature: z
    .number()
    .int()
    .min(1)
    .default(19)
    .describe(
      "Numero legislatura Camera (default 19). A differenza degli altri tool il default resta: qui non c'è alcun input (né date né atti) da cui dedurre una legislatura diversa, quindi è una scelta e non un ripiego — per una legislatura passata va indicata.",
    ),
  order: z
    .enum(["desc", "asc"])
    .default("desc")
    .describe("Ordinamento per conteggio assoluto: desc o asc"),
  limit: z.number().int().min(1).max(100).default(20),
});

const columns = [
  "rank",
  "group_uri",
  "group_label",
  "group_acronym",
  "count",
  "members",
  "count_per_member",
];

function cleanLabel(label: string): string {
  return label.replace(/\s*\(\d{2}\.\d{2}\.\d{4}.*$/, "").trim();
}

function acronym(label: string): string {
  const m = label.match(/\(([A-Z0-9À-Ù.\- ]{2,})\)/);
  return m ? m[1].trim() : "";
}

export const groupRankTool: Tool<typeof inputSchema> = {
  name: "group-rank",
  description:
    "[CAMERA] Classifica i gruppi parlamentari per attività (AIC o DDL come primo firmatario), con conteggio assoluto, numero di membri attuali del gruppo (iscrizioni senza data di fine, indipendente dal tipo di atto scelto) e media per membro (count_per_member). Utile per confrontare gruppi di dimensioni diverse: l'opposizione tipicamente presenta più atti, e il rapporto per membro evidenzia i gruppi più attivi a parità di dimensione.",
  inputSchema,
  examples: [
    "italianparliament group-rank list --rank-by aic --legislature 19",
    "italianparliament group-rank list --rank-by bills --legislature 19 --limit 10",
    "italianparliament group-rank list --rank-by aic --legislature 18 --format jsonl",
  ],
  async execute(input) {
    const itemPattern =
      input.rankBy === "aic" ? "ocd:aic" : "ocd:atto";
    const legUri = `http://dati.camera.it/ocd/legislatura.rdf/repubblica_${input.legislature}`;

    const query = `${OCD_PREFIXES}
SELECT ?group ?group_label ?n ?members WHERE {
  {
    SELECT ?group (COUNT(DISTINCT ?item) AS ?n)
    WHERE {
      ?item a ${itemPattern} ; ocd:primo_firmatario ?deputy ; ocd:rif_leg <${legUri}> .
      ?group a ocd:gruppoParlamentare ; ocd:rif_leg <${legUri}> ; ocd:siComponeDi ?m .
      ?m ocd:rif_deputato ?deputy .
    }
    GROUP BY ?group
  }
  ?group rdfs:label ?group_label .
  OPTIONAL {
    SELECT ?group (COUNT(DISTINCT ?activeDeputy) AS ?members)
    WHERE {
      ?group a ocd:gruppoParlamentare ; ocd:rif_leg <${legUri}> ; ocd:siComponeDi ?m2 .
      ?m2 ocd:rif_deputato ?activeDeputy ; dc:date ?d .
      FILTER(REGEX(STR(?d), "-$"))
    }
    GROUP BY ?group
  }
}
ORDER BY ${input.order === "asc" ? "ASC" : "DESC"}(?n)
LIMIT ${input.limit}`;

    const results = await cdQuery(query);
    const raw = flattenBindings(results);
    const rows = raw.map((r, i) => {
      const count = Number(r.n ?? 0);
      const members = Number(r.members ?? 0);
      const perMember = members > 0 ? (count / members).toFixed(1) : "";
      return {
        rank: String(i + 1),
        group_uri: r.group ?? "",
        group_label: cleanLabel(r.group_label ?? ""),
        group_acronym: acronym(r.group_label ?? ""),
        count: r.n ?? "",
        members: r.members ?? "",
        count_per_member: perMember,
      };
    });
    return { rows, columns };
  },
};
