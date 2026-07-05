import { z } from "zod";
import { snQuery } from "../core/client.js";
import { OSR_PREFIXES } from "../core/prefixes.js";
import { flattenBindings } from "../core/flatten.js";
import { actHtmlUrl, ddlRssUrl } from "../core/html-url.js";
import type { Tool } from "./types.js";

const inputSchema = z.object({
  legislature: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Numero legislatura"),
  ddlUri: z
    .string()
    .url()
    .optional()
    .describe(
      "Filtra gli emendamenti a un DDL Senato specifico (es. http://dati.senato.it/ddl/56260). " +
        "Solo Senato: gli emendamenti della Camera non sono nel LOD.",
    ),
  limit: z.number().int().min(1).max(1000).default(100),
  offset: z.number().int().min(0).default(0),
});

const columns = [
  "uri",
  "label",
  "number",
  "type",
  "legislature",
  "ddl_uri",
  "ddl_html_url",
  "rss_url",
  "url",
];

export const amendmentsTool: Tool<typeof inputSchema> = {
  name: "amendments",
  description:
    "[SENATO] Emendamenti presentati al Senato con numero, tipo, DDL collegato e link al testo ufficiale. Filtrabile per legislatura e per DDL (utile per contare/leggere gli emendamenti a un provvedimento).",
  inputSchema,
  examples: [
    "italianparliament amendments list --legislature 19 --limit 20",
    "italianparliament amendments list --ddl-uri http://dati.senato.it/ddl/56260 --format jsonl",
    "italianparliament amendments list --legislature 18 --format jsonl",
  ],
  async execute(input) {
    // amendments interroga solo l'endpoint Senato: un ddlUri della Camera
    // passerebbe il FILTER senza match, restituendo un CSV vuoto che si può
    // scambiare per "nessun emendamento". In realtà gli emendamenti della
    // Camera NON esistono come entità nel LOD OCD (nessuna classe emendamento):
    // l'unica traccia è testuale nelle descrizioni delle votazioni. Blocchiamo
    // esplicitamente per non trarre in inganno.
    if (input.ddlUri && !input.ddlUri.includes("dati.senato.it")) {
      throw new Error(
        `amendments è un tool solo-Senato: l'URI "${input.ddlUri}" non è del Senato ` +
          `(atteso http://dati.senato.it/ddl/...). Per gli emendamenti della Camera usa il ` +
          `tool 'camera-amendments' (fonte: app HTML documenti.camera.it, non LOD). Un ` +
          `risultato vuoto qui non significa assenza di emendamenti alla Camera.`,
      );
    }
    const legFilter = input.legislature
      ? `?s osr:legislatura ${input.legislature} .`
      : "";
    const ddlPattern = input.ddlUri
      ? `?s osr:oggetto ?oggetto . ?oggetto osr:relativoA ?ddl . FILTER(?ddl = <${input.ddlUri}>)`
      : `OPTIONAL { ?s osr:oggetto ?oggetto . ?oggetto osr:relativoA ?ddl }`;

    const query = `${OSR_PREFIXES}
SELECT DISTINCT ?s ?label ?numero ?tipo ?legislatura ?ddl ?url
WHERE {
  ?s a osr:Emendamento .
  OPTIONAL { ?s rdfs:label ?label }
  OPTIONAL { ?s osr:numero ?numero }
  OPTIONAL { ?s osr:tipo ?tipo }
  OPTIONAL { ?s osr:legislatura ?legislatura }
  OPTIONAL { ?s osr:URLTesto ?url }
  ${ddlPattern}
  ${legFilter}
}
LIMIT ${input.limit}
OFFSET ${input.offset}`;

    const results = await snQuery(query);
    const raw = flattenBindings(results);
    const rows = raw.map((r) => ({
      uri: r.s ?? "",
      label: r.label ?? "",
      number: r.numero ?? "",
      type: r.tipo ?? "",
      legislature: r.legislatura ?? "",
      ddl_uri: r.ddl ?? "",
      ddl_html_url: actHtmlUrl(r.ddl),
      rss_url: ddlRssUrl(r.ddl, r.legislatura ?? input.legislature),
      url: r.url ?? "",
    }));
    return { rows, columns };
  },
};
