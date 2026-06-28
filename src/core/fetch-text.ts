// Recupero locale del testo dei DDL Senato.
// www.senato.it è dietro AWS WAF: un fetch diretto torna HTTP 202 a 0 byte.
// Strategia: un vero browser (agent-browser) supera il challenge, ne estraiamo
// il cookie aws-waf-token + lo User-Agent, e con quelli scarichiamo i PDF.
// I PDF vengono convertiti in markdown con `lit` (liteparse).
//
// Solo-locale: usa child_process e fs, non va incluso nel Worker.

import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { decodeHtml } from "./decode-html.js";

const exec = promisify(execFile);

// I PDF del Senato sono sillabati: lit emette "ter&shy; ritorio".
// Rimuovere il soft hyphen + lo spazio successivo ricongiunge la parola.
// Poi decodifica le entità HTML residue (&quot;, &laquo;, &amp;, ...).
function cleanPdfMarkdown(s: string): string {
  return decodeHtml(s.replace(/(?:&shy;|\u00AD)\s*/g, ""));
}

export type TextDoc = {
  label: string;
  url: string;
};

export type FetchTextOptions = {
  did: string;
  which?: string; // sottostringa per scegliere il testo (es. "Testo DDL", "Relazione"); default: primo
  fascicolo?: boolean; // scarica il fascicolo iter completo invece del singolo testo
  all?: boolean; // concatena tutti i testi disponibili
  leg?: string; // legislatura per l'URL del fascicolo (default 19)
};

export type FetchTextResult = {
  markdown: string;
  sources: { label: string; url: string }[];
};

class FetchTextError extends Error {}

async function assertDep(bin: string, hint: string): Promise<void> {
  try {
    await exec(bin, ["--version"]);
  } catch {
    throw new FetchTextError(
      `Dipendenza mancante: '${bin}' non eseguibile. ${hint}`,
    );
  }
}

async function ab(args: string[]): Promise<string> {
  const { stdout } = await exec("agent-browser", args, {
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout;
}

// Estrae <li> da <ol class="schede">: label (primo <span>) + link PDFServer.
export function parseTextList(html: string): TextDoc[] {
  const docs: TextDoc[] = [];
  const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let m: RegExpExecArray | null;
  while ((m = liRe.exec(html)) !== null) {
    const li = m[1];
    const pdf = li.match(/href="(\/\/[^"]*PDFServer\/[^"]+\.pdf)"/i);
    if (!pdf) continue;
    const span = li.match(/<span[^>]*>([\s\S]*?)<\/span>/i);
    const label = span ? span[1].replace(/<[^>]+>/g, "").trim() : "Testo";
    docs.push({ label, url: `https:${pdf[1]}` });
  }
  return docs;
}

export async function fetchSenatoText(
  opts: FetchTextOptions,
): Promise<FetchTextResult> {
  await assertDep(
    "agent-browser",
    "Installa con: npm i -g agent-browser && agent-browser install",
  );
  await assertDep("lit", "Installa liteparse (CLI 'lit'/'liteparse').");

  const leg = opts.leg ?? "19";
  const schedaUrl = `https://www.senato.it/leggi-e-documenti/disegni-di-legge/scheda-ddl?tab=testiEmendamenti&did=${opts.did}`;

  let workdir = "";
  try {
    // 1) Apri la scheda nel browser reale per superare il WAF e ottenere il token.
    await ab(["open", schedaUrl]);
    await ab(["wait", "--load", "networkidle"]);
    const ua = (await ab(["eval", "navigator.userAgent"])).trim().split("\n").pop() ?? "";
    const cookies = (await ab(["cookies", "get"]))
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .join("; ");
    if (!/aws-waf-token=/.test(cookies)) {
      throw new FetchTextError(
        "Token AWS WAF non ottenuto dal browser. Riprova; se persiste, apri manualmente la pagina del Senato.",
      );
    }
    const pageHtml = await ab(["get", "html", "body", "--max-output", "20000000"]);

    // 2) Determina i PDF da scaricare.
    let targets: TextDoc[];
    if (opts.fascicolo) {
      targets = [
        {
          label: "Fascicolo iter completo",
          url: `https://www.senato.it/leg/${leg}/BGT/Schede/FascicoloSchedeDDL/ebook/${opts.did}.pdf`,
        },
      ];
    } else {
      const docs = parseTextList(pageHtml);
      if (docs.length === 0) {
        throw new FetchTextError(
          `Nessun testo PDF trovato nella scheda did=${opts.did}. Il DDL potrebbe non avere ancora un testo pubblicato.`,
        );
      }
      if (opts.all) {
        targets = docs;
      } else if (opts.which) {
        const w = opts.which.toLowerCase();
        const hit = docs.find((d) => d.label.toLowerCase().includes(w));
        if (!hit) {
          const avail = docs.map((d) => d.label).join(", ");
          throw new FetchTextError(
            `Nessun testo corrisponde a "${opts.which}". Disponibili: ${avail}.`,
          );
        }
        targets = [hit];
      } else {
        targets = [docs[0]];
        if (docs.length > 1) {
          const others = docs.slice(1).map((d) => d.label).join(", ");
          process.stderr.write(
            `Nota: scaricato solo "${docs[0].label}" (il primo). Altri testi disponibili: ${others}. Usa --which "<etichetta>" o --all. Per un DDL emendato/assorbito il testo operativo è spesso uno dei successivi.\n`,
          );
        }
      }
    }

    // 3) Scarica i PDF col cookie+UA del browser e convertili con lit.
    workdir = await mkdtemp(join(tmpdir(), "billtext-"));
    const parts: string[] = [];
    const sources: { label: string; url: string }[] = [];
    for (const [i, t] of targets.entries()) {
      const pdfPath = join(workdir, `doc${i}.pdf`);
      await downloadPdf(t.url, ua, cookies, pdfPath);
      const { stdout } = await exec(
        "lit",
        ["parse", pdfPath, "--format", "markdown", "-q"],
        { maxBuffer: 64 * 1024 * 1024 },
      );
      const md = cleanPdfMarkdown(stdout);
      parts.push(targets.length > 1 ? `## ${t.label}\n\n${md}` : md);
      sources.push(t);
    }
    return { markdown: parts.join("\n\n---\n\n"), sources };
  } finally {
    await ab(["close", "--all"]).catch(() => {});
    if (workdir) await rm(workdir, { recursive: true, force: true }).catch(() => {});
  }
}

async function downloadPdf(
  url: string,
  ua: string,
  cookies: string,
  out: string,
): Promise<void> {
  const res = await fetch(url, {
    headers: { "User-Agent": ua, Cookie: cookies },
    redirect: "follow",
  });
  const buf = Buffer.from(await res.arrayBuffer());
  const ct = res.headers.get("content-type") ?? "";
  if (res.status !== 200 || !ct.includes("pdf")) {
    throw new FetchTextError(
      `Download fallito (${res.status}, ${ct || "?"}) per ${url}. Il token WAF potrebbe essere scaduto: riprova.`,
    );
  }
  await writeFile(out, buf);
  // sanity: i PDF iniziano con %PDF
  const head = (await readFile(out)).subarray(0, 4).toString("latin1");
  if (head !== "%PDF") {
    throw new FetchTextError(`Il file scaricato da ${url} non è un PDF valido.`);
  }
}
