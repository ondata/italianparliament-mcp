import { z } from "zod";
import { snQuery, cdQuery } from "../core/client.js";
import { OSR_PREFIXES, OCD_PREFIXES } from "../core/prefixes.js";
import { flattenBindings } from "../core/flatten.js";
import { decodeHtml } from "../core/decode-html.js";
import { htmlEntityKeywordVariants } from "../core/html-entity-variants.js";
import { ddlRssUrl } from "../core/html-url.js";
import { currentLegislature } from "../core/current-legislature.js";
import { sparqlStringLiteral } from "../core/sparql-literal.js";
import type { Tool } from "./types.js";

const inputSchema = z.object({
  ddlUri: z
    .string()
    .url()
    .optional()
    .describe("URI del DDL Senato (es. http://dati.senato.it/ddl/25597)"),
  uri: z
    .string()
    .url()
    .optional()
    .describe(
      "URI di un atto Camera (es. http://dati.camera.it/ocd/attocamera.rdf/ac19_2822): restituisce la cronologia completa dell'iter (timeline degli stati)",
    ),
  keyword: z
    .string()
    .optional()
    .describe("Cerca nel titolo del DDL (match case-insensitive, es. 'autonomia', 'lavoro')"),
  number: z
    .string()
    .regex(/^\d+$/)
    .optional()
    .describe(
      "Numero dell'atto (es. 1809), da usare insieme al campo branch. Con branch=S interroga il repertorio Senato (S.1809); con branch=C risolve l'atto Camera C.1809 e ne restituisce la timeline degli stati. Per branch=S include automaticamente le letture successive della navetta con suffisso (es. number=1353 torna S.1353 e S.1353-B). Se legislature è assente, con number si usa di default la legislatura corrente (risolta dinamicamente dall'endpoint Camera) per ridurre omonimi storici. Lo stesso numero può esistere in entrambi i rami come atti DIVERSI (C.1809 e S.1809): il numero NON si conserva nel passaggio da un ramo all'altro. Se con branch=S il numero di un atto Camera non dà nulla, il tool cerca da sé la fase C.<numero> nel repertorio Senato e restituisce tutte le fasi dello stesso DDL (vedi description).",
    ),
  branch: z
    .enum(["S", "C"])
    .optional()
    .describe(
      "Ramo usato insieme al campo number. S (default): repertorio Senato, restituisce lo stato corrente del DDL (una riga). C: atto Camera, restituisce la timeline completa degli stati attraversati (una riga per stato, con date). L'asimmetria riflette la fonte: la Camera pubblica lo storico degli stati, il Senato solo lo stato corrente (la sua timeline vive nel feed RSS).",
    ),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe(
      "Data inizio filtro (YYYY-MM-DD): su Senato filtra la data presentazione; su Camera (timeline) filtra la data dello stato iter",
    ),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe(
      "Data fine filtro (YYYY-MM-DD): su Senato filtra la data presentazione; su Camera (timeline) filtra la data dello stato iter",
    ),
  legislature: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Numero legislatura"),
  limit: z.number().int().min(1).max(1000).default(100),
  offset: z.number().int().min(0).default(0),
});

const columns = [
  "ddl_uri",
  "title",
  "status",
  "status_date",
  "presentation_date",
  "initiative_description",
  "nature",
  "legislature",
  "phase",
  "phase_number",
  "html_url",
  "rss_url",
];

export const billProgressTool: Tool<typeof inputSchema> = {
  name: "bill-progress",
  description:
    "Iter legislativo di un disegno di legge. È la SPINA DORSALE per ricostruire l'iter completo di una legge: usalo per le date reali di ogni fase, non generare la timeline a memoria. [SENATO] senza --uri: lista DDL al Senato con stato corrente dell'iter (assegnato, esame in commissione, approvato, ecc.), filtrabile per legislatura, numero atto (--number 1809 --branch S), parola chiave nel titolo e intervallo date. Con --number ma senza --legislature, il default è la legislatura corrente per evitare omonimi storici rumorosi. [CAMERA] cronologia completa (timeline) di tutti gli stati attraversati dall'atto, in ordine cronologico, in DUE modi: con --uri <atto Camera>, oppure con --number <n> --branch C (risolve l'atto Camera ac<leg>_<n>). Stesse colonne in entrambi i casi. NB: --branch C dà la timeline Camera (una riga per stato), --branch S dà lo stato corrente del DDL al Senato (una riga): l'asimmetria riflette ciò che le due fonti pubblicano. Per seguire un atto da un ramo all'altro NON usare il numero dell'altro ramo: la numerazione non si conserva (il DDL nucleare è C.2669 alla Camera e S.1924 al Senato). Il legame è nel dato: le fasi dello stesso DDL condividono osr:idDdl, e il repertorio Senato contiene anche le fasi Camera (osr:ramo=\"C\"). Perciò --number <n> --branch S, se non trova un DDL S.<n>, cerca da sé la fase C.<n> e restituisce TUTTE le fasi di quel DDL nei due rami, in ordine di iter: è il modo per passare da un atto Camera alla sua lettura al Senato e per ricostruire una navetta a più letture.",
  emptyHint:
    "Nessun DDL trovato. Se cercavi il DDL Senato di un atto Camera: il numero NON si conserva tra i due rami, quindi il numero Camera non ha un DDL S. omonimo (il tool prova già da sé la fase C.<numero>). Cercalo per titolo con --keyword sul repertorio Senato, oppure parti dal ramo Camera con --number <n> --branch C. Se usavi --keyword, prova il termine normativo o una radice più corta. Non dedurre l'iter: se non torna, non inventare fasi, date o esiti.",
  inputSchema,
  examples: [
    "italianparliament bill-progress list --legislature 19 --limit 20",
    "italianparliament bill-progress list --number 1809 --branch S",
    "italianparliament bill-progress list --number 1809 --branch S --legislature 19",
    "italianparliament bill-progress list --number 2617 --branch C --legislature 18",
    "italianparliament bill-progress list --ddl-uri http://dati.senato.it/ddl/25597",
    "italianparliament bill-progress list --legislature 19 --keyword autonomia --limit 20",
    "italianparliament bill-progress list --legislature 19 --date-from 2026-04-01 --date-to 2026-04-13",
    "italianparliament bill-progress list --uri http://dati.camera.it/ocd/attocamera.rdf/ac19_2822",
    "italianparliament bill-progress list --uri http://dati.camera.it/ocd/attocamera.rdf/ac19_2822 --format jsonl",
  ],
  async execute(input) {
    const cameraEmptyHint =
      "Nessuno stato iter Camera trovato per l'atto richiesto. Verifica il pairing legislature+number (o l'URI) e, se hai usato dei filtri (keyword, intervallo di date) o la paginazione (limit/offset), prova ad allargarli. Non dedurre assenza di iter dal vuoto: senza evidenza non inventare stati, date o conclusioni.";

    // Routing per host: un URI Camera attiva il ramo "timeline iter".
    const isCamera = (u?: string): u is string =>
      !!u && u.includes("dati.camera.it");
    const cameraUri = isCamera(input.uri)
      ? input.uri
      : isCamera(input.ddlUri)
        ? input.ddlUri
        : undefined;
    if (cameraUri) {
      return cameraIterTimeline(cameraUri, columns, {
        keyword: input.keyword,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        limit: input.limit,
        offset: input.offset,
        emptyHint: cameraEmptyHint,
      });
    }

    // --number con --branch C: l'utente vuole l'iter dell'atto Camera C.<num>,
    // non il record di rimando lato Senato (osr:ramo="C" = una sola riga con lo
    // stato corrente, senza timeline né date). Risolviamo l'URI dell'atto Camera
    // (ac<leg>_<num>) e restituiamo la cronologia completa degli stati, come per
    // --uri. Il ramo S resta sul repertorio Senato (stato corrente).
    if (input.number && input.branch === "C") {
      const leg = input.legislature ?? (await currentLegislature());
      const cUri = `http://dati.camera.it/ocd/attocamera.rdf/ac${leg}_${input.number}`;
      return cameraIterTimeline(cUri, columns, {
        keyword: input.keyword,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        limit: input.limit,
        offset: input.offset,
        emptyHint: cameraEmptyHint,
      });
    }

    // Se un URI Senato è passato via --uri, trattalo come ddlUri.
    const senatoDdlUri =
      input.ddlUri ??
      (input.uri && input.uri.includes("dati.senato.it")
        ? input.uri
        : undefined);

    const filters: string[] = [];
    if (senatoDdlUri) {
      filters.push(`FILTER(?s = <${senatoDdlUri}>)`);
    }
    if (input.keyword) {
      filters.push(
        `FILTER(${htmlEntityKeywordVariants(input.keyword)
          .map((variant) => `CONTAINS(LCASE(STR(?titolo)), LCASE(${sparqlStringLiteral(variant)}))`)
          .join(" || ")})`,
      );
    }
    if (input.number) {
      // numeroFase è tipizzato → confronto via STR(); il ramo (osr:ramo S/C) è
      // obbligatorio perché lo stesso numero esiste in entrambi (C.1809 e S.1809).
      // Match sul numero base E sulle letture successive con suffisso (1353, 1353-B,
      // 1353-C…) così la navetta a più letture torna completa da un solo --number.
      const branch = input.branch ?? "S";
      filters.push(`FILTER(REGEX(STR(?numeroFase), "^${input.number}(-[A-Z])?$"))`);
      filters.push(`?s osr:ramo ?ramoFiltro . FILTER(STR(?ramoFiltro) = "${branch}")`);
    }
    const effectiveLegislature =
      input.legislature ?? (input.number ? await currentLegislature() : undefined);
    if (effectiveLegislature) {
      filters.push(`?s osr:legislatura ${effectiveLegislature} .`);
    }
    if (input.dateFrom) {
      filters.push(`FILTER(STR(?dataPresentazione) >= "${input.dateFrom}")`);
    }
    if (input.dateTo) {
      filters.push(`FILTER(STR(?dataPresentazione) <= "${input.dateTo}")`);
    }

    const rows = await runSenatoDdlQuery(filters, {
      limit: input.limit,
      offset: input.offset,
    });

    // Aggancio cross-ramo. Chi parte da un atto Camera prova istintivamente il
    // numero Camera sul ramo S, ma la numerazione NON si conserva nel passaggio
    // (C.2669 diventa S.1924): il vuoto che ne segue è stato letto come "il
    // Senato non ha ancora numerato l'atto" in un report del 29/07/2026, mentre
    // il DDL era lì. Il legame esiste nel dato: le fasi dello stesso DDL
    // condividono osr:idDdl, e il repertorio Senato contiene anche le fasi
    // Camera (osr:ramo="C"). Quindi invece di restituire un vuoto ambiguo si
    // risale all'idDdl dalla fase C.<numero> e si mostrano tutte le fasi.
    // `offset === 0`: oltre la prima pagina un risultato vuoto significa "pagina
    // finita", non "numero inesistente al Senato". Senza questa guardia
    // `--number 1809 --branch S --offset 50` mostrerebbe le fasi cross-ramo come
    // se il numero non esistesse.
    if (
      rows.length === 0 &&
      input.number &&
      (input.branch ?? "S") === "S" &&
      input.offset === 0
    ) {
      const cross = await crossBranchPhases(
        input.number,
        effectiveLegislature,
        input.limit,
      );
      if (cross) return cross;
    }

    return { rows, columns };
  },
};

/**
 * Esegue la query sul repertorio DDL del Senato con i filtri dati.
 * Estratta per essere riusata dall'aggancio cross-ramo, che cambia solo i
 * filtri e l'ordinamento.
 */
async function runSenatoDdlQuery(
  filters: string[],
  opts: { limit: number; offset?: number; orderBy?: string },
) {
  const query = `${OSR_PREFIXES}
PREFIX dc: <http://purl.org/dc/elements/1.1/>
SELECT ?s ?titolo ?statoDdl ?dataStatoDdl ?dataPresentazione
       ?descrIniziativa ?natura ?legislatura ?fase ?numeroFase
WHERE {
  ?s a osr:Ddl .
  OPTIONAL { ?s osr:titolo ?titolo }
  OPTIONAL { ?s osr:statoDdl ?statoDdl }
  OPTIONAL { ?s osr:dataStatoDdl ?dataStatoDdl }
  OPTIONAL { ?s osr:dataPresentazione ?dataPresentazione }
  OPTIONAL { ?s osr:descrIniziativa ?descrIniziativa }
  OPTIONAL { ?s osr:natura ?natura }
  OPTIONAL { ?s osr:legislatura ?legislatura }
  OPTIONAL { ?s osr:fase ?fase }
  OPTIONAL { ?s osr:numeroFase ?numeroFase }
  ${filters.join("\n  ")}
}
ORDER BY ${opts.orderBy ?? "DESC(?dataPresentazione)"}
LIMIT ${opts.limit}
OFFSET ${opts.offset ?? 0}`;

  const raw = flattenBindings(await snQuery(query));
  return raw.map((r) => {
    const ddl_uri = r.s ?? "";
    const idMatch = ddl_uri.match(/\/ddl\/(\d+)$/);
    const html_url = idMatch
      ? `https://www.senato.it/leggi-e-documenti/disegni-di-legge/scheda-ddl?tab=datiGenerali&did=${idMatch[1]}`
      : "";
    return {
      ddl_uri,
      title: r.titolo ?? "",
      status: r.statoDdl ?? "",
      status_date: r.dataStatoDdl ?? "",
      presentation_date: r.dataPresentazione ?? "",
      initiative_description: r.descrIniziativa ?? "",
      nature: r.natura ?? "",
      legislature: r.legislatura ?? "",
      phase: r.fase ?? "",
      phase_number: r.numeroFase ?? "",
      html_url,
      rss_url: ddlRssUrl(ddl_uri, r.legislatura),
    };
  });
}

/**
 * Dato un numero d'atto Camera, restituisce tutte le fasi del DDL a cui
 * appartiene (Camera e Senato), in ordine di iter.
 *
 * Due query piccole invece di una con anchor: su Virtuoso Senato un URI di
 * richiesta oltre ~2047 byte torna 403, e la query del repertorio è già lunga.
 * La prima risolve l'idDdl, la seconda riusa la query principale.
 * `undefined` quando la fase C.<numero> non esiste: lì il vuoto è genuino e
 * deve restare vuoto, con l'emptyHint statico.
 */
async function crossBranchPhases(
  number: string,
  legislature: number | undefined,
  limit: number,
) {
  const legFilter = legislature ? `?a osr:legislatura ${legislature} .` : "";
  const idQuery = `${OSR_PREFIXES}
SELECT DISTINCT ?id WHERE {
  ?a osr:idDdl ?id ; osr:numeroFase ?n ; osr:ramo ?r .
  ${legFilter}
  FILTER(REGEX(STR(?n), "^${number}(-[A-Z])?$") && STR(?r) = "C")
}
LIMIT 5`;
  const ids = flattenBindings(await snQuery(idQuery))
    .map((r) => r.id)
    .filter((v): v is string => !!v);
  if (ids.length === 0) return undefined;

  // Più di un idDdl significa numeri Camera omonimi in legislature diverse
  // (possibile quando legislature è assente): si tengono tutti, l'utente vede
  // le legislature nella colonna e può restringere.
  const idFilter = `?s osr:idDdl ?idd . FILTER(${ids
    .map((id) => `STR(?idd) = "${id.replace(/"/g, "")}"`)
    .join(" || ")})`;
  const rows = await runSenatoDdlQuery([idFilter], {
    limit,
    orderBy: "?dataPresentazione ?fase",
  });
  if (rows.length === 0) return undefined;

  const senatoPhases = rows.filter((r) => r.phase.startsWith("S."));
  const elenco = rows
    .map((r) => `${r.phase} (${r.status || "stato non dichiarato"}${r.status_date ? `, ${r.status_date}` : ""})`)
    .join(" → ");
  // Il notice NON deve promettere completezza quando la pagina è piena: con
  // `--limit 1` su una navetta a quattro letture si vedrebbe una fase sola
  // sotto la dicitura "TUTTE le fasi", e un iter incompleto letto come completo
  // è esattamente l'errore che questo tool esiste per evitare.
  const maybeTruncated = rows.length >= limit;
  const insieme = maybeTruncated
    ? `Le righe qui sopra sono fasi dello stesso DDL (osr:idDdl ${ids.join(", ")}), nei due rami e in ordine di iter, ma l'elenco è tagliato dal limite di ${limit} righe: NON dedurne l'iter completo, rilancia con --limit più alto prima di ricostruire la timeline. Fasi mostrate: ${elenco}.`
    : `Le righe qui sopra sono TUTTE le fasi dello stesso DDL (osr:idDdl ${ids.join(", ")}), nei due rami e in ordine di iter: ${elenco}.`;
  // La lettura al Senato si può affermare solo su un elenco completo: su una
  // pagina tagliata l'assenza di fasi S. non significa che non ce ne siano.
  const letturaSenato =
    senatoPhases.length > 0
      ? ` La lettura al Senato è ${senatoPhases.map((r) => r.phase).join(", ")}.`
      : maybeTruncated
        ? ""
        : " Nessuna fase al Senato risulta ancora aperta per questo DDL.";
  // `notice` e non `hint`: qui le righe ci sono, e `hint` per contratto parla
  // solo sul risultato vuoto (vedi ToolResult). Senza spiegazione l'utente
  // vedrebbe righe C.<numero> senza capire perché il ramo chiesto era S.
  const notice = `NOTA: al Senato non esiste un DDL S.${number}. ${number} è il numero dell'atto alla CAMERA e la numerazione non si conserva nel passaggio tra i due rami, quindi il ramo S per quel numero è vuoto. ${insieme}${letturaSenato}`;
  return { rows, columns, notice };
}

/**
 * Camera: cronologia completa dell'iter di un atto via `ocd:rif_statoIter`.
 * Una riga per stato attraversato, in ordine cronologico, mappata sullo
 * stesso schema colonne del ramo Senato (colonne non pertinenti vuote).
 */
async function cameraIterTimeline(
  uri: string,
  cols: string[],
  opts: {
    keyword?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
    emptyHint?: string;
  } = {},
) {
  const filters: string[] = [];
  if (opts.keyword) {
    filters.push(
      `FILTER(BOUND(?titolo) && (${htmlEntityKeywordVariants(opts.keyword)
        .map((variant) => `CONTAINS(LCASE(STR(?titolo)), LCASE(${sparqlStringLiteral(variant)}))`)
        .join(" || ")}))`,
    );
  }
  if (opts.dateFrom) {
    filters.push(`FILTER(STR(?date) >= "${opts.dateFrom.replace(/-/g, "")}")`);
  }
  if (opts.dateTo) {
    filters.push(`FILTER(STR(?date) <= "${opts.dateTo.replace(/-/g, "")}")`);
  }

  // ?st NON è proiettato: entra in SELECT DISTINCT cambierebbe la chiave di
  // dedup (ogni risorsa-stato è unica) e reintrodurrebbe righe visivamente
  // duplicate quando due ?st hanno stessi titolo/date/stato. Serve solo come
  // tie-breaker deterministico in ORDER BY per stabilizzare la paginazione.
  // ?pres e ?ini invece si possono proiettare: sono proprietà dell'atto, non
  // dello stato, e hanno cardinalità 1 (verificato su leg. 17, 18 e 19: zero
  // atti con più di un dc:date o più di un ocd:iniziativa), quindi non
  // moltiplicano le righe della timeline.
  const query = `${OCD_PREFIXES}
SELECT DISTINCT ?titolo ?date ?stato ?pres ?ini WHERE {
  <${uri}> ocd:rif_statoIter ?st .
  OPTIONAL { <${uri}> dc:title ?titolo }
  OPTIONAL { <${uri}> dc:date ?pres }
  OPTIONAL { <${uri}> ocd:iniziativa ?ini }
  ?st dc:date ?date .
  ?st dc:title ?stato .
  ${filters.join("\n  ")}
}
ORDER BY ?date ?st
LIMIT ${opts.limit ?? 100}
OFFSET ${opts.offset ?? 0}`;

  const results = await cdQuery(query);
  const raw = flattenBindings(results);

  const idMatch = uri.match(/ac(\d+)_(\d+)$/);
  const leg = idMatch ? idMatch[1] : "";
  const id = idMatch ? idMatch[2] : "";
  const html_url = idMatch
    ? `https://www.camera.it/leg${leg}/126?leg=${leg}&idDocumento=${id}`
    : "";

  const fmtDate = (d?: string): string =>
    d && /^\d{8}$/.test(d)
      ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`
      : (d ?? "");

  const rows = raw.map((r) => ({
    ddl_uri: uri,
    title: decodeHtml(r.titolo ?? ""),
    status: decodeHtml(r.stato ?? ""),
    status_date: fmtDate(r.date),
    // dc:date dell'atto è la data di presentazione (formato YYYYMMDD come
    // ?date, quindi stesso fmtDate). Di norma coincide con il primo stato
    // dell'iter, ma non sempre: in leg. 19 divergono su 23 atti.
    presentation_date: fmtDate(r.pres),
    initiative_description: r.ini ?? "",
    nature: "",
    legislature: leg,
    phase: id ? `C.${id}` : "",
    phase_number: id,
    html_url,
    rss_url: "",
  }));
  if (rows.length === 0 && opts.emptyHint) {
    return { rows, columns: cols, hint: opts.emptyHint };
  }
  return { rows, columns: cols };
}
