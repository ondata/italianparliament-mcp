import { z } from "zod";
import { snQuery } from "../core/client.js";
import { OSR_PREFIXES } from "../core/prefixes.js";
import { flattenBindings } from "../core/flatten.js";
import { actHtmlUrl, ddlRssUrl } from "../core/html-url.js";
import {
  aknAttoPath,
  aknEmendRawUrlFromTestoXml,
  aknRawUrl,
  fetchAknFile,
  listAknDir,
  mapLimit,
  parseAknAmendment,
} from "../core/akn.js";
import type { Tool } from "./types.js";
import type { Row } from "../core/types.js";

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
  withProponents: z
    .boolean()
    .optional()
    .describe(
      "Arricchisce ogni riga con i proponenti (primo firmatario e cofirmatari) " +
        "estratti dal testo AKN del bulk GitHub del Senato: un fetch puntuale per " +
        "emendamento, quindi più lento. Il proponente NON è nel LOD.",
    ),
  limit: z.number().int().min(1).max(1000).default(100),
  offset: z.number().int().min(0).default(0),
});

const columns = [
  "uri",
  "label",
  "number",
  "type",
  "date",
  "legislature",
  "ddl_uri",
  "ddl_html_url",
  "rss_url",
  "url",
  "akn_xml_url",
  "source",
  "first_proponent",
  "proponents",
];

// Il dataset osr:Emendamento del LOD è fermo al 2024-08-09 (wiki
// senato/emendamenti-freschezza.md): oltre quella data il fallback è il bulk
// AKN su GitHub (wiki senato/akn-bulk-data.md, issue #45).
const PROPONENT_CONCURRENCY = 4;

type AknEntry = { file: string; committee: boolean };

// Arricchisce le righe con i proponenti dai file AKN (fetch puntuali, concorrenza
// limitata). Un errore su un singolo file non affossa la lista: campi vuoti.
async function enrichProponents(rows: Row[]): Promise<void> {
  const targets = rows.filter((r) => r.akn_xml_url);
  await mapLimit(targets, PROPONENT_CONCURRENCY, async (row) => {
    try {
      const xml = await fetchAknFile(String(row.akn_xml_url));
      const parsed = parseAknAmendment(xml);
      row.first_proponent = parsed.proponents[0]?.name ?? "";
      row.proponents = parsed.proponents.map((p) => p.name).join(" | ");
      if (!row.number) row.number = parsed.number;
      if (!row.label)
        row.label = [parsed.name, parsed.number].filter(Boolean).join(" ");
      if (!row.date) row.date = parsed.date;
    } catch {
      // file mancante o non parsabile: la riga resta senza proponenti
    }
  });
}

export const amendmentsTool: Tool<typeof inputSchema> = {
  name: "amendments",
  description:
    "[SENATO] Emendamenti presentati al Senato con numero, tipo, DDL collegato e link al testo ufficiale. " +
    "Filtrabile per legislatura e per DDL (utile per contare/leggere gli emendamenti a un provvedimento). " +
    "Se il LOD è indietro (è rimasto fermo per lunghi periodi), con ddlUri il tool passa in automatico " +
    "al bulk AKN GitHub del Senato (aggiornato quotidianamente); con withProponents aggiunge primo " +
    "firmatario e cofirmatari dal testo AKN.",
  emptyHint:
    "Nessun emendamento trovato. Il LOD osr:Emendamento ha avuto lunghi periodi senza aggiornamenti: " +
    "senza ddlUri il fallback sul bulk AKN GitHub non si attiva, quindi per un provvedimento specifico " +
    "ripetere la ricerca passando ddlUri. Un vuoto qui non basta a concludere che non esistano emendamenti.",
  inputSchema,
  examples: [
    "italianparliament amendments list --legislature 19 --limit 20",
    "italianparliament amendments list --ddl-uri http://dati.senato.it/ddl/56260 --format jsonl",
    "italianparliament amendments list --ddl-uri http://dati.senato.it/ddl/60233 --with-proponents --limit 20",
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
SELECT DISTINCT ?s ?label ?numero ?tipo ?legislatura ?ddl ?url ?urlXml ?flagComm
WHERE {
  ?s a osr:Emendamento .
  OPTIONAL { ?s rdfs:label ?label }
  OPTIONAL { ?s osr:numero ?numero }
  OPTIONAL { ?s osr:tipo ?tipo }
  OPTIONAL { ?s osr:legislatura ?legislatura }
  OPTIONAL { ?s osr:URLTesto ?url }
  OPTIONAL { ?s osr:URLTestoXml ?urlXml }
  OPTIONAL { ?s osr:flagCommissione ?flagComm }
  ${ddlPattern}
  ${legFilter}
}
LIMIT ${input.limit}
OFFSET ${input.offset}`;

    const results = await snQuery(query);
    const raw = flattenBindings(results);
    const rows: Row[] = raw.map((r) => {
      const leg = r.legislatura || String(input.legislature ?? "");
      return {
        uri: r.s ?? "",
        label: r.label ?? "",
        number: r.numero ?? "",
        type: r.tipo ?? "",
        date: "",
        legislature: leg,
        ddl_uri: r.ddl ?? "",
        ddl_html_url: actHtmlUrl(r.ddl),
        rss_url: ddlRssUrl(r.ddl, leg),
        url: r.url ?? "",
        // URL raw equivalente nel bulk AKN (pura sostituzione di stringa dal
        // link WAF-ato del LOD): è la via al testo/proponenti senza browser.
        akn_xml_url:
          r.urlXml && r.ddl
            ? aknEmendRawUrlFromTestoXml(r.urlXml, r.ddl, leg, r.flagComm === "1")
            : "",
        source: "lod",
        first_proponent: "",
        proponents: "",
      };
    });

    if (rows.length > 0) {
      if (input.withProponents) await enrichProponents(rows);
      return { rows, columns };
    }

    // Fallback bulk AKN: solo con ddlUri (serve l'atto per costruire il path).
    if (!input.ddlUri) return { rows, columns };

    const legislature = input.legislature
      ? String(input.legislature)
      : await ddlLegislature(input.ddlUri);
    if (!legislature) {
      return {
        rows,
        columns,
        hint:
          "Nessun emendamento nel LOD e legislatura del DDL non determinabile: il fallback " +
          "sul bulk AKN GitHub richiede la legislatura. Ripetere passando legislature.",
      };
    }

    const attoPath = aknAttoPath(input.ddlUri, legislature);
    // Due listing (Assemblea + Commissione), sequenziali: throttle prudenziale
    // sull'endpoint non documentato della web UI GitHub.
    const aula = await listAknDir(`${attoPath}/emend`);
    const comm = await listAknDir(`${attoPath}/emendc`);
    const entries: AknEntry[] = [
      ...aula.names.map((file) => ({ file, committee: false })),
      ...comm.names.map((file) => ({ file, committee: true })),
    ];

    // Il listing web UI tronca a 1000 voci per cartella: se la finestra richiesta
    // cade oltre il visibile, meglio fallire esplicito che paginare su dati sbagliati.
    const truncated =
      aula.totalCount > aula.names.length || comm.totalCount > comm.names.length;
    if (truncated && input.offset + input.limit > entries.length) {
      throw new Error(
        `Il bulk AKN elenca ${aula.totalCount + comm.totalCount} emendamenti per questo DDL ma il ` +
          `listing è troncato a ${entries.length}: la finestra richiesta (offset ${input.offset}, ` +
          `limit ${input.limit}) non è raggiungibile. Restringere la finestra o sfogliare ` +
          `https://github.com/SenatoDellaRepubblica/AkomaNtosoBulkData/tree/master/${attoPath}`,
      );
    }

    const page = entries.slice(input.offset, input.offset + input.limit);
    const aknRows: Row[] = page.map((e) => ({
      uri: "",
      label: "",
      number: "",
      type: e.committee ? "commissione" : "assemblea",
      date: "",
      legislature,
      ddl_uri: input.ddlUri ?? "",
      ddl_html_url: actHtmlUrl(input.ddlUri),
      rss_url: ddlRssUrl(input.ddlUri, legislature),
      url: "",
      akn_xml_url: aknRawUrl(
        `${attoPath}/${e.committee ? "emendc" : "emend"}/${e.file}`,
      ),
      source: "akn",
      first_proponent: "",
      proponents: "",
    }));
    if (input.withProponents) await enrichProponents(aknRows);

    if (aknRows.length === 0) {
      return {
        rows: aknRows,
        columns,
        hint:
          "Nessun emendamento per questo DDL né nel LOD né nel bulk AKN GitHub del Senato " +
          "(aggiornato quotidianamente). Con entrambe le fonti vuote l'assenza di emendamenti " +
          "PRESENTATI è plausibile, ma va confermata sulla scheda del DDL su senato.it.",
      };
    }
    return { rows: aknRows, columns };
  },
};

// Legislatura di un DDL Senato (triple diretto osr:legislatura, integer nudo).
async function ddlLegislature(ddlUri: string): Promise<string> {
  const query = `${OSR_PREFIXES}
SELECT ?leg WHERE { <${ddlUri}> osr:legislatura ?leg } LIMIT 1`;
  const results = await snQuery(query);
  return flattenBindings(results)[0]?.leg ?? "";
}
