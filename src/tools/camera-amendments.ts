import { z } from "zod";
// cheerio/slim: stesso parser (htmlparser2) e selettori, ma SENZA encoding-sniffer
// (iconv-lite → require dinamico di "buffer" che rompe il bundle ESM e gonfia il
// Worker). Le pagine sono UTF-8 e vengono già decodificate da res.text().
import * as cheerio from "cheerio/slim";
import { actHtmlUrl } from "../core/html-url.js";
import type { Tool } from "./types.js";

// Gli emendamenti della Camera NON esistono nel LOD OCD (a differenza del
// Senato, osr:Emendamento). Sono però pubblicati dall'app HTML
// `getProposteEmendative.aspx`, per singolo atto e per sede (referente /
// Assemblea), con articolo, numero, primo firmatario ed esito. Questo tool
// li recupera via scraping (cheerio): la fonte è HTML, non dati aperti, quindi
// dipende dalla struttura delle pagine — i test-sentinella fissano i conteggi
// noti per accorgersi di eventuali cambi di markup.

const EME_BASE = "https://documenti.camera.it/apps/emendamenti/";
const UA = "Mozilla/5.0 (italianparliament-mcp; +https://github.com/aborruso/italianparliament-mcp)";

const inputSchema = z.object({
  billUri: z
    .string()
    .url()
    .describe(
      "URI dell'atto Camera (es. http://dati.camera.it/ocd/attocamera.rdf/ac19_2696). Ottenibile da bill-progress/bills.",
    ),
  countOnly: z
    .boolean()
    .default(false)
    .describe("Restituisce solo il conteggio degli emendamenti per sede (referente/Assemblea)."),
  limit: z.number().int().min(1).max(5000).default(2000),
});

// Nota: l'esito (approvato/respinto/ritirato) NON è nelle liste cumulative
// "in ordine di pubblicazione" (cella vuota); vive nella vista per-seduta
// (getProposteEmendativeSeduta). Estrarlo è un possibile Phase 2, non incluso
// qui per non esporre una colonna sistematicamente vuota.
const columns = [
  "sede",
  "article",
  "number",
  "first_signatory",
  "person_id",
  "identical",
  "text_url",
];
const countColumns = ["sede", "count", "list_url"];

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "it-IT,it;q=0.9,en;q=0.8",
    },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`Recupero fallito (${res.status}) su ${url}`);
  }
  return res.text();
}

// Etichetta della sede a partire dall'URL della lista emendamenti.
function sedeLabel(url: string): string {
  const s = url.match(/sedeEsame=([^&]+)/)?.[1];
  if (s && s !== "null") return decodeURIComponent(s);
  if (/:ass:/.test(url)) return "assemblea";
  return "n.d.";
}

// Righe emendamento di una singola pagina getProposteEmendative.
function parseList(html: string, sede: string): Record<string, string>[] {
  const $ = cheerio.load(html);
  const rows: Record<string, string>[] = [];
  let article = "";
  $("tr").each((_, tr) => {
    const $tr = $(tr);
    const cls = $tr.attr("class") ?? "";
    const id = $tr.attr("id") ?? "";
    // Intestazione articolo: <tr class="rigaArticolo..." id="cmd.art..<ART>.<n>">
    if (cls.includes("rigaArticolo")) {
      const m = id.match(/cmd\.art\.\.(\d+)\./);
      if (m) article = m[1];
      return;
    }
    // Riga emendamento: <tr class="normale" id="tr.id....">
    if (!id.startsWith("tr.id.")) return;
    const numLink = $tr.find('a[href*="idPropostaEmendativa="]').first();
    const number = numLink.text().trim().replace(/\.$/, "");
    let textUrl = (numLink.attr("href") ?? "").replace(/\s+/g, "");
    if (textUrl && !/^https?:/.test(textUrl)) textUrl = EME_BASE + textUrl;
    const sig = $tr.find('a[href*="idPersona="]').first();
    const firstSignatory = sig.text().trim();
    const personId = (sig.attr("href") ?? "").match(/idPersona=(\d+)/)?.[1] ?? "";
    const identical = $tr
      .find(".emendamentiIdentici")
      .text()
      .replace(/\s+/g, " ")
      .replace(/\(\s*ident\.\s*/i, "(ident. ")
      .replace(/\s+\)/g, ")")
      .trim();
    rows.push({
      sede,
      article,
      number,
      first_signatory: firstSignatory,
      person_id: personId,
      identical,
      text_url: textUrl,
    });
  });
  return rows;
}

// Link distinti alle liste emendamenti (per sede) presenti nella scheda atto.
// Filtra getProposteEmendative.aspx (lista cumulativa), NON ...Seduta.
function schedaListUrls(html: string): string[] {
  const $ = cheerio.load(html);
  const urls = new Set<string>();
  $('a[href*="getProposteEmendative.aspx"]').each((_, a) => {
    let href = ($(a).attr("href") ?? "").replace(/\s+/g, "");
    if (!href) return;
    if (!/^https?:/.test(href)) href = EME_BASE + href;
    urls.add(href);
  });
  return [...urls];
}

export const cameraAmendmentsTool: Tool<typeof inputSchema> = {
  name: "camera-amendments",
  description:
    "[CAMERA] Emendamenti (proposte emendative) a un atto della Camera, per sede (referente/Assemblea): numero, articolo, primo firmatario, emendamenti identici e link al testo. Con --count-only restituisce il conteggio per sede. FONTE: app HTML documenti.camera.it (gli emendamenti Camera non sono nel LOD); per il Senato usare invece 'amendments'.",
  inputSchema,
  examples: [
    "italianparliament camera-amendments list --bill-uri http://dati.camera.it/ocd/attocamera.rdf/ac19_2696 --count-only",
    "italianparliament camera-amendments list --bill-uri http://dati.camera.it/ocd/attocamera.rdf/ac19_2696 --format jsonl",
  ],
  async execute(input) {
    if (!/attocamera\.rdf\/ac\d+_\d+/.test(input.billUri)) {
      throw new Error(
        `camera-amendments richiede un URI di atto Camera ` +
          `(es. http://dati.camera.it/ocd/attocamera.rdf/ac19_2696). ` +
          `Ricevuto: "${input.billUri}". Per gli emendamenti del Senato usare il tool 'amendments'.`,
      );
    }
    const schedaUrl = actHtmlUrl(input.billUri);
    if (!schedaUrl) {
      throw new Error(`Impossibile derivare la scheda atto da "${input.billUri}".`);
    }
    const scheda = await fetchHtml(schedaUrl);
    const listUrls = schedaListUrls(scheda);

    if (listUrls.length === 0) {
      // Distinzione: scheda valida senza emendamenti (legittimo) vs pagina non
      // valida (es. blocco anti-bot che serve un 200 "diverso" ai Worker
      // Cloudflare — la fonte camera.it è raggiungibile dalla CLI locale ma non
      // sempre da datacenter). Se mancano i marcatori di una scheda atto reale,
      // è il secondo caso: fallire chiaro invece di restituire un vuoto ingannevole.
      const looksValid = /idDocumento|proposte emendativ|scheda del progetto|EMENDAMENTI/i.test(
        scheda,
      );
      if (!looksValid) {
        throw new Error(
          `Fonte Camera non raggiungibile o pagina non valida per ${schedaUrl} ` +
            `(scheda di ${scheda.length} byte senza i marcatori attesi). ` +
            `Gli emendamenti Camera si recuperano via scraping HTML: alcune reti ` +
            `(es. Worker Cloudflare) possono ricevere una risposta anti-bot. ` +
            `Riprovare dalla CLI locale.`,
        );
      }
    }

    if (input.countOnly) {
      const rows: Record<string, string>[] = [];
      for (const url of listUrls) {
        const sede = sedeLabel(url);
        const count = parseList(await fetchHtml(url), sede).length;
        rows.push({ sede, count: String(count), list_url: url });
      }
      return { rows, columns: countColumns };
    }

    const all: Record<string, string>[] = [];
    for (const url of listUrls) {
      all.push(...parseList(await fetchHtml(url), sedeLabel(url)));
      if (all.length >= input.limit) break;
    }
    return { rows: all.slice(0, input.limit), columns };
  },
};
