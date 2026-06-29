import { z } from "zod";
import { snQuery } from "../core/client.js";
import { OSR_PREFIXES } from "../core/prefixes.js";
import { flattenBindings } from "../core/flatten.js";
import type { Tool } from "./types.js";

const inputSchema = z.object({
  legislature: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Numero legislatura Senato (es. 19)."),
  asOf: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe(
      "Data di riferimento YYYY-MM-DD (default: oggi). Per legislature passate usare l'ultima data della legislatura (es. 2022-10-12 per la XVIII).",
    ),
  limit: z.number().int().positive().max(1000).default(100),
});

const columns = ["uri", "title", "acronym", "members", "html_url"];

export const senatoGroupsTool: Tool<typeof inputSchema> = {
  name: "senato-groups",
  description:
    "[SENATO] Gruppi parlamentari del Senato con sigla e numero di componenti distinti. Filtrabile per legislatura. Mostra solo i gruppi con almeno un'adesione attiva (senza data fine).",
  inputSchema,
  examples: [
    "italianparliament senato-groups list --legislature 19",
    "italianparliament senato-groups list --legislature 18 --as-of 2022-10-12",
    "italianparliament senato-groups list --legislature 18 --as-of 2022-10-12 --format jsonl",
  ],
  async execute(input) {
    const asOf = input.asOf ?? new Date().toISOString().split("T")[0];
    const legFilter =
      input.legislature !== undefined
        ? `FILTER(STR(?leg) = "${input.legislature}")`
        : "";

    const query = `${OSR_PREFIXES}
SELECT ?gruppo ?titolo ?sigla (COUNT(DISTINCT ?sen) AS ?componenti) WHERE {
  ?sen ocd:aderisce ?ad .
  ?ad  a            ocd:adesioneGruppo ;
       osr:legislatura ?leg ;
       osr:gruppo    ?gruppo ;
       osr:inizio    ?inizio .
  OPTIONAL { ?ad osr:fine ?fine }
  ${legFilter}
  FILTER(STR(?inizio) <= "${asOf}")
  FILTER(!BOUND(?fine) || STR(?fine) >= "${asOf}")

  ?gruppo osr:denominazione ?den .
  ?den osr:titolo ?titolo ; osr:titoloBreve ?sigla .
  FILTER(STR(?den_inizio) <= "${asOf}")
  FILTER(!BOUND(?den_fine) || STR(?den_fine) >= "${asOf}")
  ?den osr:inizio ?den_inizio .
  OPTIONAL { ?den osr:fine ?den_fine }
}
GROUP BY ?gruppo ?titolo ?sigla
ORDER BY DESC(?componenti)
LIMIT ${input.limit}`;

    const results = await snQuery(query);
    const raw = flattenBindings(results);
    const rows = raw.map((r) => {
      const uri = r.gruppo ?? "";
      const idMatch = uri.match(/\/gruppo\/(\d+)$/);
      const html_url = idMatch
        ? `https://www.senato.it/composizione/gruppi-parlamentari/riepilogo-della-composizione/composizione?did=${idMatch[1]}`
        : "";
      return {
        uri,
        title: r.titolo ?? "",
        acronym: r.sigla ?? "",
        members: r.componenti ?? "",
        html_url,
      };
    });
    return { rows, columns };
  },
};
