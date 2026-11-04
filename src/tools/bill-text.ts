import { z } from "zod";
import { cdQuery, snQuery } from "../core/client.js";
import { OCD_PREFIXES } from "../core/prefixes.js";
import { flattenBindings } from "../core/flatten.js";
import { currentLegislature } from "../core/current-legislature.js";
import { actHtmlUrl } from "../core/html-url.js";
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

const columns = ["chamber", "kind", "format", "auth", "url", "date", "description"];

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
  const leg = r.legislatura ?? String(await currentLegislature());
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

// Versioni del testo di un atto Camera (presentato, testo della commissione
// `_A`, ...). Il link getDocumento.ashx porta a una pagina HTML senza WAF, con
// la relazione sotto `#RL` e l'articolato sotto `#PD`. La lettura successiva
// della navetta (`-B`) sta sull'atto variante, non qui. DISTINCT: i nodi
// versione compaiono in più named graph.
async function cameraVersionRows(uri: string): Promise<Row[]> {
  const query = `${OCD_PREFIXES}
SELECT DISTINCT ?date ?title ?url WHERE {
  <${uri}> ocd:rif_versioneTestoAtto ?v .
  ?v dcterms:isReferencedBy ?url .
  OPTIONAL { ?v dc:date ?date }
  OPTIONAL { ?v dc:title ?title }
}
ORDER BY ?date`;
  return flattenBindings(await cdQuery(query)).map((v) => ({
    chamber: "camera",
    kind: "versione",
    format: "html",
    auth: "none",
    url: v.url,
    date: isoDate(v.date ?? ""),
    description: `${v.title || "Versione del testo"}. Pagina HTML fetchabile direttamente: relazione sotto l'ancora #RL, articolato sotto #PD.`,
  }));
}

function isoDate(d: string): string {
  return /^\d{8}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : d;
}

async function cameraRows(uri: string): Promise<Row[]> {
  const query = `${OCD_PREFIXES}
SELECT ?ref WHERE {
  <${uri}> rdfs:label ?label .
  OPTIONAL { <${uri}> dcterms:isReferencedBy ?ref }
} LIMIT 1`;
  const r = flattenBindings(await cdQuery(query))[0];
  if (!r) throw new Error(`Nessun atto Camera trovato per URI: ${uri}`);
  // Anche gli atti variante (ac19_703-B) hanno la loro scheda: con il vecchio
  // pattern `_(\d+)$` la riga "scheda" spariva proprio per la lettura che porta
  // l'approvazione definitiva.
  const schedaUrl = actHtmlUrl(uri);
  const rows: Row[] = [];
  if (schedaUrl) {
    rows.push({
      chamber: "camera",
      kind: "scheda",
      format: "html",
      auth: "none",
      url: schedaUrl,
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
  rows.push(...(await cameraVersionRows(uri)));
  if (rows.length === 0) {
    throw new Error(`Impossibile costruire link per l'atto Camera: ${uri}`);
  }
  return rows;
}

export const billTextTool: Tool<typeof inputSchema> = {
  name: "bill-text",
  title: "Link al testo di un DDL",
  description:
    "[CAMERA+SENATO] Link diretti al testo di un DDL, con tipo di risorsa (html/pdf/urn) e se serve un browser per scaricarli (campo auth). Pensato per dare a un orchestratore le risorse da leggere. Camera: una riga kind=versione per ogni versione del testo (presentato, testo della commissione, ...) con data (dalla leg. 16; le leg. 14-15 non le hanno nel LOD), pagina HTML senza WAF con relazione sotto #RL e articolato sotto #PD; la lettura successiva della navetta (C.703-B) sta sull'URI dell'atto variante. NB: il testo integrale non è nei dati SPARQL, sta in queste pagine/PDF: se non lo recuperi e leggi davvero, NON descrivere il contenuto della legge (articoli, soglie, importi, sanzioni) — non è un dato disponibile qui. Per scaricare e convertire i PDF del Senato (protetti da AWS WAF) usare la CLI 'bill-text fetch'.",
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
    const raw = isSenato ? await senatoRows(input.uri) : await cameraRows(input.uri);
    // Stesse chiavi su tutte le righe: in JSONL `date` c'è anche dove è vuota.
    const rows = raw.map((r) => Object.fromEntries(columns.map((c) => [c, r[c] ?? ""])));
    return { rows, columns };
  },
};
