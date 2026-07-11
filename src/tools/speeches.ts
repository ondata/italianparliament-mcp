import { z } from "zod";
import { cdQuery, snQuery } from "../core/client.js";
import { OCD_PREFIXES, OSR_PREFIXES } from "../core/prefixes.js";
import { flattenBindings } from "../core/flatten.js";
import type { Tool } from "./types.js";

const inputSchema = z.object({
  chamber: z
    .enum(["camera", "senato"])
    .optional()
    .default("camera")
    .describe("Ramo del parlamento: camera o senato"),
  legislature: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Numero legislatura"),
  deputyUri: z
    .string()
    .url()
    .optional()
    .describe(
      "URI completo del parlamentare (Camera: http://dati.camera.it/ocd/deputato.rdf/..., Senato: http://dati.senato.it/senatore/...)",
    ),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe(
      "Data inizio (YYYY-MM-DD): filtra per data dell'intervento. Camera: data della seduta in cui è stato pronunciato; Senato: data della seduta.",
    ),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Data fine (YYYY-MM-DD): vedi date-from."),
  countOnly: z
    .boolean()
    .optional()
    .default(false)
    .describe("Se true, restituisce solo il conteggio totale degli interventi"),
  limit: z.number().int().min(1).max(1000).default(100),
  offset: z.number().int().min(0).default(0),
});

const cameraColumns = [
  "uri",
  "label",
  "deputy_uri",
  "date",
  "document_url",
  "modified",
];

const senatoColumns = [
  "uri",
  "label",
  "senator_uri",
  "date",
  "session_number",
  "topic_uri",
];

export const speechesTool: Tool<typeof inputSchema> = {
  name: "speeches",
  description:
    "[CAMERA+SENATO] Interventi in aula con link al documento ufficiale e data (colonna date, YYYY-MM-DD). Camera: stenografico/bollettino, Senato: seduta e argomento. Filtrabile per legislatura, parlamentare e intervallo di date (dateFrom/dateTo, CLI --date-from/--date-to, sulla data della seduta). Supporta conteggio rapido con countOnly (il filtro data vale anche per il conteggio). Per la Camera il filtro data richiede il parametro legislature (CLI: --legislature) come àncora dell'indice: senza, la query è molto più lenta.",
  inputSchema,
  examples: [
    "italianparliament speeches list --legislature 19 --limit 10",
    "italianparliament speeches list --chamber senato --legislature 19 --limit 10",
    "italianparliament speeches list --legislature 19 --date-from 2026-06-17 --date-to 2026-06-17",
    "italianparliament speeches list --chamber senato --legislature 19 --date-from 2025-01-01 --date-to 2025-03-31 --format jsonl",
    "italianparliament speeches list --deputy-uri http://dati.camera.it/ocd/deputato.rdf/d306921_17",
    "italianparliament speeches list --deputy-uri http://dati.senato.it/senatore/32726 --chamber senato --count-only",
    "italianparliament speeches list --deputy-uri http://dati.camera.it/ocd/deputato.rdf/d306921_17 --count-only",
    "italianparliament speeches list --legislature 18 --format jsonl",
  ],
  async execute(input) {
    if (input.chamber === "senato") {
      return executeSenato(input);
    }
    return executeCamera(input);
  },
};

/* ── Camera ─────────────────────────────────────────────────────────── */

async function executeCamera(input: z.infer<typeof inputSchema>) {
  // Il filtro data richiede la legislatura: senza il range filter sul soggetto
  // (unico àncora d'indice, vedi sotto) il join sulla discussione con FILTER
  // sulle date scansiona tutti gli interventi e può andare in timeout. Il
  // contratto è documentato (description/help/skill/wiki); qui lo si impone con
  // un errore chiaro invece di lasciar degradare la query.
  if ((input.dateFrom || input.dateTo) && !input.legislature) {
    throw new Error(
      "Il filtro data per la Camera richiede il parametro legislature (CLI: --legislature): àncora l'indice sul soggetto. Specifica la legislatura.",
    );
  }
  // Gli interventi Camera non hanno ocd:rif_leg: la legislatura è solo nel
  // pattern URI. Filtrare con STRSTARTS impedisce a Virtuoso di usare l'indice
  // sul soggetto e forza la materializzazione/ordinamento di tutti gli interventi
  // della legislatura (~250k) prima del LIMIT. Riscritto come range filter
  // (?s >= in19_ && ?s < in19_z): Virtuoso percorre l'indice e si ferma al LIMIT.
  // Ordinamento per ?s DESC = ordine di creazione (gli ID sono incrementali e a
  // lunghezza costante per legislatura), proxy della cronologia reale e index-friendly
  // (ods:modified è il timestamp di modifica del record, non la data dell'intervento).
  const filters: string[] = [];
  if (input.legislature) {
    const base = `http://dati.camera.it/ocd/intervento.rdf/in${input.legislature}_`;
    filters.push(`FILTER(?s >= <${base}> && ?s < <${base}z>)`);
  }
  if (input.deputyUri) {
    filters.push(`?s ocd:rif_deputato <${input.deputyUri}> .`);
  }
  // La data reale dell'intervento non è sull'intervento (ods:modified è il
  // timestamp di modifica del record). Vive sulla ocd:discussione che lo
  // raggruppa: `?disc ocd:rif_intervento ?s ; dc:date ?d`, con dc:date plain
  // "YYYYMMDD" (verificato: sia interventi d'Aula/stenografico sia di
  // commissione/bollettino, cardinalità 1 per intervento). Confronto
  // lessicografico (8 cifre fisse) forzato con STR(): su Virtuoso Camera i
  // range su dc:date senza STR() rischiano il confronto numerico spurio →
  // vuoti muti (stessa convenzione di votes/sessions/aic). Il join va DENTRO
  // la subquery così il FILTER precede il LIMIT.
  const dFrom = input.dateFrom?.replace(/-/g, "");
  const dTo = input.dateTo?.replace(/-/g, "");
  const dateJoin =
    dFrom || dTo
      ? `?disc ocd:rif_intervento ?s ; dc:date ?d .
      FILTER(${[dFrom ? `STR(?d) >= "${dFrom}"` : "", dTo ? `STR(?d) <= "${dTo}"` : ""].filter(Boolean).join(" && ")})`
      : "";

  if (input.countOnly) {
    const countQuery = `${OCD_PREFIXES}
SELECT (COUNT(DISTINCT ?s) AS ?n)
WHERE {
  ?s a ocd:intervento .
  ${filters.join("\n  ")}
  ${dateJoin}
}`;
    const results = await cdQuery(countQuery);
    const raw = flattenBindings(results);
    const count = String(Number(raw[0]?.n ?? 0));
    return { rows: [{ count }], columns: ["count"] };
  }

  // Subquery-first: l'interna seleziona/ordina/limita i soli ?s (poche righe),
  // l'esterna aggancia label e le OPTIONAL solo a quelle. ods:modified e
  // dc:relation sono multi-valore su molti interventi → dedup per uri in TS.
  // GROUP BY ?s nell'interna (non DISTINCT): la tripla `?s a ocd:intervento` è
  // duplicata alla fonte (presente 2× per ogni intervento), quindi senza dedup
  // il LIMIT conterebbe doppioni; GROUP BY collassa ed è ~2× più veloce di DISTINCT.
  const query = `${OCD_PREFIXES}
SELECT ?s ?label ?rif_deputato ?relation ?modified ?date
WHERE {
  {
    SELECT ?s WHERE {
      ?s a ocd:intervento .
      ${filters.join("\n      ")}
      ${dateJoin}
    }
    GROUP BY ?s
    ORDER BY DESC(?s)
    LIMIT ${input.limit}
    OFFSET ${input.offset}
  }
  ?s rdfs:label ?label .
  OPTIONAL { ?s ocd:rif_deputato ?rif_deputato }
  OPTIONAL { ?s dc:relation ?relation }
  OPTIONAL { ?s ods:modified ?modified }
  OPTIONAL { ?discD ocd:rif_intervento ?s ; dc:date ?date }
}
ORDER BY DESC(?s)`;

  const results = await cdQuery(query);
  const raw = flattenBindings(results);
  const seen = new Set<string>();
  const rows = [];
  for (const r of raw) {
    const uri = r.s ?? "";
    if (seen.has(uri)) continue;
    seen.add(uri);
    const d = r.date ?? "";
    rows.push({
      uri,
      label: r.label ?? "",
      deputy_uri: r.rif_deputato ?? "",
      date: d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : d,
      document_url: r.relation ?? "",
      modified: r.modified ?? "",
    });
  }
  return { rows, columns: cameraColumns };
}

/* ── Senato ─────────────────────────────────────────────────────────── */

async function executeSenato(input: z.infer<typeof inputSchema>) {
  const filters: string[] = [];
  if (input.legislature) {
    filters.push(`?sed osr:legislatura ${input.legislature} .`);
  }
  if (input.deputyUri) {
    filters.push(`<${input.deputyUri}> osr:interviene ?i .`);
  }
  // osr:dataSeduta è xsd:date ISO (YYYY-MM-DD). Confronto via STR() così il
  // filtro regge sia se tipizzato xsd:date sia xsd:string (evita la trappola
  // del typed literal su Virtuoso): il formato ISO rende lessicografico =
  // cronologico.
  const senDateFilter =
    input.dateFrom || input.dateTo
      ? `FILTER(${[input.dateFrom ? `STR(?ds) >= "${input.dateFrom}"` : "", input.dateTo ? `STR(?ds) <= "${input.dateTo}"` : ""].filter(Boolean).join(" && ")})`
      : "";

  if (input.countOnly) {
    const countQuery = `${OSR_PREFIXES}
SELECT (COUNT(DISTINCT ?i) AS ?n)
WHERE {
  ?i a osr:Intervento .
  ?i osr:seduta ?sed .
  ${senDateFilter ? `?sed osr:dataSeduta ?ds .\n  ${senDateFilter}` : ""}
  ${filters.join("\n  ")}
}`;
    const results = await snQuery(countQuery);
    const raw = flattenBindings(results);
    const count = String(Number(raw[0]?.n ?? 0));
    return { rows: [{ count }], columns: ["count"] };
  }

  // ?sen osr:interviene ?i è la relazione INVERSA senatore→intervento (l'URI
  // dell'intervento non contiene l'ID del senatore), 1:1. Selezionandola,
  // senator_uri è valorizzata per riga anche senza --deputy-uri; quando il
  // filtro c'è, ?sen coincide col senatore filtrato.
  const query = `${OSR_PREFIXES}
SELECT DISTINCT ?i ?lbl ?ds ?ns ?obj ?sen
WHERE {
  ?i a osr:Intervento .
  ?i rdfs:label ?lbl .
  ?i osr:seduta ?sed .
  ?sed osr:dataSeduta ?ds .
  ?sed osr:numeroSeduta ?ns .
  ${input.deputyUri ? `<${input.deputyUri}> osr:interviene ?i .` : ""}
  OPTIONAL { ?sen osr:interviene ?i }
  OPTIONAL { ?i osr:oggetto ?obj }
  ${filters.filter((f) => !f.includes("osr:interviene")).join("\n  ")}
  ${senDateFilter}
}
ORDER BY DESC(?ds) DESC(?ns)
LIMIT ${input.limit}
OFFSET ${input.offset}`;

  const results = await snQuery(query);
  const raw = flattenBindings(results);
  const rows = raw.map((r) => ({
    uri: r.i ?? "",
    label: r.lbl ?? "",
    senator_uri: r.sen ?? input.deputyUri ?? "",
    date: r.ds ?? "",
    session_number: r.ns ?? "",
    topic_uri: r.obj ?? "",
  }));
  return { rows, columns: senatoColumns };
}
