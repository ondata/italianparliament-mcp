import { z } from "zod";
import { cdQuery, snQuery } from "../core/client.js";
import { OCD_PREFIXES } from "../core/prefixes.js";
import { flattenBindings } from "../core/flatten.js";
import type { Row } from "../core/types.js";
import type { Tool } from "./types.js";

const inputSchema = z.object({
  uri: z
    .string()
    .url()
    .describe(
      "URI dell'atto: Camera (http://dati.camera.it/ocd/attocamera.rdf/ac19_1234) o Senato (http://dati.senato.it/ddl/55479)",
    ),
});

const columns = ["chamber", "kind", "format", "auth", "url", "description"];

async function senatoRows(uri: string): Promise<Row[]> {
  const m = uri.match(/\/ddl\/(\d+)$/);
  if (!m) throw new Error(`URI DDL Senato non valido: ${uri}`);
  const n = m[1];
  const query = `PREFIX osr: <http://dati.senato.it/osr/>
SELECT ?legislatura ?testo WHERE {
  <${uri}> osr:legislatura ?legislatura .
  OPTIONAL { <${uri}> osr:testoPresentato ?testo }
} LIMIT 1`;
  const r = flattenBindings(await snQuery(query))[0];
  if (!r) throw new Error(`Nessun DDL Senato trovato per URI: ${uri}`);
  const leg = r.legislatura ?? "19";
  const rows: Row[] = [
    {
      chamber: "senato",
      kind: "testi",
      format: "html",
      auth: "browser",
      url: `https://www.senato.it/leggi-e-documenti/disegni-di-legge/scheda-ddl?tab=testiEmendamenti&did=${n}`,
      description:
        "Pagina 'Testi ed emendamenti': elenca i PDF dei singoli testi (Testo DDL, Relazione, testi successivi). Sito dietro AWS WAF: serve un browser.",
    },
    {
      chamber: "senato",
      kind: "fascicolo",
      format: "pdf",
      auth: "browser",
      url: `https://www.senato.it/leg/${leg}/BGT/Schede/FascicoloSchedeDDL/ebook/${n}.pdf`,
      description:
        "Fascicolo iter completo (articolato + relazioni + resoconti commissioni e aula). PDF unico, anche centinaia/migliaia di pagine. Sito dietro AWS WAF: serve un browser.",
    },
    {
      chamber: "senato",
      kind: "scheda",
      format: "html",
      auth: "browser",
      url: `https://www.senato.it/leggi-e-documenti/disegni-di-legge/scheda-ddl?did=${n}`,
      description: "Scheda DDL (dati generali e iter). Sito dietro AWS WAF: serve un browser.",
    },
  ];
  if (r.testo) {
    rows.push({
      chamber: "senato",
      kind: "urn",
      format: "urn",
      auth: "none",
      url: r.testo,
      description: "URN NIR del testo presentato (identificatore, non un documento scaricabile).",
    });
  }
  rows.push({
    chamber: "senato",
    kind: "come-scaricare",
    format: "cli",
    auth: "cli-locale",
    url: `italianparliament bill-text fetch --did ${n}`,
    description:
      "I link Senato qui sopra (auth=browser) NON sono scaricabili con un fetch normale (AWS WAF → HTTP 202). Per ottenere il testo in markdown serve questo comando CLI locale, che apre un browser reale, supera il WAF e converte il PDF con lit. Prerequisiti: pacchetto '@aborruso/italianparliament-mcp' (CLI 'italianparliament'), 'agent-browser' e 'lit' (liteparse) installati. Se usi solo il server MCP remoto la CLI va installata a parte (npm i -g @aborruso/italianparliament-mcp), oppure apri tu i link in un browser.",
  });
  return rows;
}

async function cameraRows(uri: string): Promise<Row[]> {
  const query = `${OCD_PREFIXES}
SELECT ?ref WHERE {
  <${uri}> rdfs:label ?label .
  OPTIONAL { <${uri}> dcterms:isReferencedBy ?ref }
} LIMIT 1`;
  const r = flattenBindings(await cdQuery(query))[0];
  if (!r) throw new Error(`Nessun atto Camera trovato per URI: ${uri}`);
  const m = uri.match(/ac(\d+)_(\d+)$/);
  const rows: Row[] = [];
  if (m) {
    rows.push({
      chamber: "camera",
      kind: "scheda",
      format: "html",
      auth: "none",
      url: `https://www.camera.it/leg${m[1]}/126?leg=${m[1]}&idDocumento=${m[2]}`,
      description:
        "Scheda dell'atto sul sito Camera (testo, iter, firmatari). Pagina fetchabile direttamente (no WAF).",
    });
  }
  if (r.ref) {
    rows.push({
      chamber: "camera",
      kind: "riferimento",
      format: "html",
      auth: "none",
      url: r.ref,
      description: "Risorsa collegata (es. scheda d'archivio storico).",
    });
  }
  if (rows.length === 0) {
    throw new Error(`Impossibile costruire link per l'atto Camera: ${uri}`);
  }
  return rows;
}

export const billTextTool: Tool<typeof inputSchema> = {
  name: "bill-text",
  description:
    "[CAMERA+SENATO] Link diretti al testo di un DDL, con tipo di risorsa (html/pdf/urn) e se serve un browser per scaricarli (campo auth). Pensato per dare a un orchestratore le risorse da leggere. NB: il testo integrale non è nei dati SPARQL, sta in queste pagine/PDF. Per scaricare e convertire i PDF del Senato (protetti da AWS WAF) usare la CLI 'bill-text fetch'.",
  inputSchema,
  examples: [
    "italianparliament bill-text links --uri http://dati.senato.it/ddl/55479",
    "italianparliament bill-text links --uri http://dati.camera.it/ocd/attocamera.rdf/ac19_1234",
    "italianparliament bill-text links --uri http://dati.senato.it/ddl/59294 --format jsonl",
  ],
  async execute(input) {
    const isSenato = /dati\.senato\.it\/ddl\//.test(input.uri);
    const isCamera = /dati\.camera\.it\//.test(input.uri);
    if (!isSenato && !isCamera) {
      throw new Error(
        `URI non riconosciuto: ${input.uri}. Atteso un URI di dati.senato.it/ddl/ o dati.camera.it/.`,
      );
    }
    const rows = isSenato ? await senatoRows(input.uri) : await cameraRows(input.uri);
    return { rows, columns };
  },
};
