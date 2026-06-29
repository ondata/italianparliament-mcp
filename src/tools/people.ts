import { z } from "zod";
import { cdQuery, snQuery } from "../core/client.js";
import { flattenBindings } from "../core/flatten.js";
import { personHtmlUrl } from "../core/html-url.js";
import type { Tool } from "./types.js";

const inputSchema = z.object({
  uris: z
    .array(z.string().url())
    .min(1)
    .max(500)
    .describe(
      "Lista di URI di persona, anche misti Camera (dati.camera.it) e Senato (dati.senato.it). La camera è rilevata dall'URI. Risolve i nomi in batch (una query per endpoint).",
    ),
});

const columns = ["uri", "first_name", "last_name", "label", "chamber", "html_url"];

const FOAF = "http://xmlns.com/foaf/0.1/";

function inList(uris: string[]): string {
  return uris.map((u) => `<${u}>`).join(", ");
}

// Camera: foaf:firstName / foaf:surname. Una query, FILTER(?s IN ...).
// (VALUES dà HTTP 400 sul Senato → si usa FILTER IN su entrambi per coerenza.)
async function resolveCamera(
  uris: string[],
): Promise<Map<string, { fn: string; ln: string }>> {
  const map = new Map<string, { fn: string; ln: string }>();
  if (!uris.length) return map;
  const query = `PREFIX foaf: <${FOAF}>
SELECT ?s ?fn ?sn WHERE {
  ?s foaf:firstName ?fn .
  OPTIONAL { ?s foaf:surname ?sn }
  FILTER(?s IN (${inList(uris)}))
}`;
  for (const r of flattenBindings(await cdQuery(query))) {
    if (r.s && !map.has(r.s)) map.set(r.s, { fn: r.fn ?? "", ln: r.sn ?? "" });
  }
  return map;
}

// Senato: foaf:firstName / foaf:lastName.
async function resolveSenato(
  uris: string[],
): Promise<Map<string, { fn: string; ln: string }>> {
  const map = new Map<string, { fn: string; ln: string }>();
  if (!uris.length) return map;
  const query = `PREFIX foaf: <${FOAF}>
SELECT ?s ?fn ?ln WHERE {
  ?s foaf:firstName ?fn .
  OPTIONAL { ?s foaf:lastName ?ln }
  FILTER(?s IN (${inList(uris)}))
}`;
  for (const r of flattenBindings(await snQuery(query))) {
    if (r.s && !map.has(r.s)) map.set(r.s, { fn: r.fn ?? "", ln: r.ln ?? "" });
  }
  return map;
}

function chamberOf(uri: string): string {
  if (uri.includes("dati.camera.it")) return "camera";
  if (uri.includes("dati.senato.it")) return "senato";
  return "";
}

export const peopleTool: Tool<typeof inputSchema> = {
  name: "people",
  description:
    "Risolve in batch una lista di URI di persona nei rispettivi nomi, anche misti Camera + Senato. Utile per dare i nominativi agli URI 'nudi' restituiti dai tool relazionali, evitando una chiamata deputy/senator per ciascuno. Output: uri, first_name, last_name, label, chamber, html_url.",
  inputSchema,
  examples: [
    "italianparliament people resolve --uris http://dati.senato.it/senatore/32,http://dati.camera.it/ocd/deputato.rdf/d308917_19",
    "italianparliament people resolve --uris http://dati.senato.it/senatore/32 --format jsonl",
  ],
  async execute(input) {
    const cameraUris = input.uris.filter((u) => chamberOf(u) === "camera");
    const senatoUris = input.uris.filter((u) => chamberOf(u) === "senato");

    const [cameraMap, senatoMap] = await Promise.all([
      resolveCamera(cameraUris),
      resolveSenato(senatoUris),
    ]);

    // Una riga per URI di input, nell'ordine ricevuto; nome vuoto se non risolto.
    const rows = input.uris.map((uri) => {
      const chamber = chamberOf(uri);
      const hit =
        chamber === "camera" ? cameraMap.get(uri) : senatoMap.get(uri);
      const first_name = hit?.fn ?? "";
      const last_name = hit?.ln ?? "";
      return {
        uri,
        first_name,
        last_name,
        label: `${first_name} ${last_name}`.trim(),
        chamber,
        html_url: personHtmlUrl(uri),
      };
    });
    return { rows, columns };
  },
};
