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
      "Arricchisce ogni riga con i proponenti (primo firmatario e cofirmatari, nome e URI " +
        "persona) estratti dal testo AKN del bulk GitHub del Senato: un fetch puntuale per " +
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
  "sede",
  "date",
  "legislature",
  "ddl_uri",
  "ddl_html_url",
  "rss_url",
  "url",
  "akn_xml_url",
  "source",
  "first_proponent",
  "first_proponent_uri",
  "proponents",
  "proponents_uri",
];

// Il dataset osr:Emendamento del LOD può avere lunghi periodi senza aggiornamenti
// (wiki senato/emendamenti-freschezza.md): quando vuoto con ddlUri il fallback è il
// bulk AKN su GitHub (wiki senato/akn-bulk-data.md, issue #45).
const PROPONENT_CONCURRENCY = 4;
// withProponents fa un fetch per riga: con limit fino a 1000 (max schema) sono
// centinaia/migliaia di richieste HTTP, rischio concreto di timeout/rate-limit
// specie sul Worker. Cap esplicito piuttosto che un timeout silenzioso a metà.
const WITH_PROPONENTS_MAX_LIMIT = 100;

type AknEntry = { file: string; committee: boolean };

// Arricchisce le righe con i proponenti dai file AKN (fetch puntuali, concorrenza
// limitata). Un fetch fallito su un singolo file non affossa la lista: campi
// vuoti (indistinguibile, per design, dai file stub della fonte che non hanno
// docProponent — parseAknAmendment non lancia mai su quelli). Ma se TUTTI i
// fetch della finestra falliscono, è quasi certamente un outage/irraggiungibilità
// di GitHub (es. dal Worker), non "nessun proponente": va segnalato esplicito,
// non restituito come un vuoto silenzioso indistinguibile dal caso legittimo.
// export solo per test unitario mirato (fallimento totale dei fetch).
export async function enrichProponents(rows: Row[]): Promise<void> {
  const targets = rows.filter((r) => r.akn_xml_url);
  if (targets.length === 0) return;
  let failures = 0;
  await mapLimit(targets, PROPONENT_CONCURRENCY, async (row) => {
    try {
      const xml = await fetchAknFile(String(row.akn_xml_url));
      const parsed = parseAknAmendment(xml);
      row.first_proponent = parsed.proponents[0]?.name ?? "";
      row.first_proponent_uri = parsed.proponents[0]?.uri ?? "";
      row.proponents = parsed.proponents.map((p) => p.name).join(" | ");
      row.proponents_uri = parsed.proponents.map((p) => p.uri).join(" | ");
      if (!row.number) row.number = parsed.number;
      if (!row.label)
        row.label = [parsed.name, parsed.number].filter(Boolean).join(" ");
      if (!row.date) row.date = parsed.date;
    } catch {
      failures++; // file mancante/non raggiungibile: la riga resta senza proponenti
    }
  });
  if (failures === targets.length) {
    throw new Error(
      `withProponents: tutti i ${targets.length} fetch al bulk AKN GitHub sono falliti ` +
        `(rete o outage, non "nessun proponente presente"). Riprovare, oppure ripetere ` +
        `senza --with-proponents per ottenere comunque le righe senza proponenti.`,
    );
  }
}

// Il listing web UI tronca a 1000 voci per cartella. entries concatena aula
// (Assemblea) e comm (Commissione): se SOLO aula è troncata, un offset che
// sconfina oltre aula.names.length verrebbe letto come "Commissione", ma
// potrebbe in realtà essere un elemento di Assemblea non visibile (la
// posizione reale nel bucket troncato non è determinabile) — un bug di
// correttezza, non solo di raggiungibilità. Le due troncature vanno quindi
// guardate separatamente, non sommando i due bucket in un unico controllo.
// export solo per test unitario mirato (offline, senza fetch live).
export function checkAknTruncation(
  aula: { totalCount: number; names: string[] },
  comm: { totalCount: number; names: string[] },
  entriesLength: number,
  offset: number,
  limit: number,
  attoPath: string,
): void {
  const aulaTruncated = aula.totalCount > aula.names.length;
  const commTruncated = comm.totalCount > comm.names.length;
  if (aulaTruncated && offset + limit > aula.names.length) {
    throw new Error(
      `Il bulk AKN elenca ${aula.totalCount} emendamenti d'Assemblea per questo DDL ma il ` +
        `listing è troncato a ${aula.names.length}: la finestra richiesta (offset ${offset}, ` +
        `limit ${limit}) supera la parte visibile e la posizione degli elementi oltre non è ` +
        `determinabile (potrebbero essere ancora d'Assemblea, non di Commissione). Restringere la ` +
        `finestra a offset+limit <= ${aula.names.length}, oppure sfogliare ` +
        `https://github.com/SenatoDellaRepubblica/AkomaNtosoBulkData/tree/master/${attoPath}`,
    );
  }
  if (commTruncated && offset + limit > entriesLength) {
    throw new Error(
      `Il bulk AKN elenca ${comm.totalCount} emendamenti di Commissione per questo DDL ma il ` +
        `listing è troncato a ${comm.names.length}: la finestra richiesta (offset ${offset}, ` +
        `limit ${limit}) non è raggiungibile. Restringere la finestra o sfogliare ` +
        `https://github.com/SenatoDellaRepubblica/AkomaNtosoBulkData/tree/master/${attoPath}`,
    );
  }
}

// entriesLength === 0: il bulk AKN non ha nulla per questo atto (come il LOD)
// — vuoto genuino. entriesLength > 0 con pagina vuota: l'offset richiesto
// pagina oltre la fine di un risultato non vuoto, non è un'assenza — hint
// distinto per non farlo leggere come "nessun emendamento" (Copilot review).
// export solo per test unitario mirato (offline).
export function aknEmptyHint(entriesLength: number, offset: number): string {
  if (entriesLength === 0) {
    return (
      "Nessun emendamento per questo DDL né nel LOD né nel bulk AKN GitHub del Senato " +
      "(aggiornato quotidianamente). Con entrambe le fonti vuote l'assenza di emendamenti " +
      "PRESENTATI è plausibile, ma va confermata sulla scheda del DDL su senato.it."
    );
  }
  return (
    `Nessun emendamento in questa pagina: il bulk AKN ne ha ${entriesLength} per questo DDL, ` +
    `ma offset ${offset} è oltre la fine. Riprovare con un offset più basso (0-${entriesLength - 1}).`
  );
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
    if (input.withProponents && input.limit > WITH_PROPONENTS_MAX_LIMIT) {
      throw new Error(
        `withProponents fa un fetch HTTP per ogni emendamento: con limit=${input.limit} sarebbero ` +
          `${input.limit} richieste, rischio concreto di timeout/rate-limit (specie dal Worker). ` +
          `Ripetere con limit<=${WITH_PROPONENTS_MAX_LIMIT}, eventualmente paginando con offset.`,
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
        sede:
          r.flagComm === "1" ? "commissione" : r.flagComm === "0" ? "assemblea" : "",
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
        first_proponent_uri: "",
        proponents: "",
        proponents_uri: "",
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
          "sul bulk AKN GitHub richiede la legislatura. Ripetere passando il numero di " +
          "legislatura (es. 19) nel parametro legislature (CLI: --legislature 19).",
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

    checkAknTruncation(aula, comm, entries.length, input.offset, input.limit, attoPath);

    const page = entries.slice(input.offset, input.offset + input.limit);
    const aknRows: Row[] = page.map((e) => ({
      uri: "",
      label: "",
      number: "",
      // type (E/G/Q, dominio osr:tipo) non è deducibile in modo affidabile dal
      // solo AKN: resta vuoto qui, si valorizza eventualmente via withProponents
      // (parsed.name può contenerlo come testo, es. "Questione pregiudiziale").
      type: "",
      sede: e.committee ? "commissione" : "assemblea",
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
      first_proponent_uri: "",
      proponents: "",
      proponents_uri: "",
    }));
    if (input.withProponents) await enrichProponents(aknRows);

    if (aknRows.length === 0) {
      return {
        rows: aknRows,
        columns,
        hint: aknEmptyHint(entries.length, input.offset),
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
