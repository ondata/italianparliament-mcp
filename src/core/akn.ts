// Bulk data Akoma Ntoso del Senato su GitHub (SenatoDellaRepubblica/AkomaNtosoBulkData,
// CC BY 4.0, aggiornato quotidianamente, legislature 13-19). Fonte complementare al LOD
// SENZA WAF: i file si scaricano da raw.githubusercontent.com con un fetch semplice,
// quindi funziona sia nella CLI sia nel Worker Cloudflare. Vedi
// docs/lod-wiki/senato/akn-bulk-data.md e issue #45.
//
// Vincolo di progetto: MAI download bulk (repo ~1,7 GB) — solo listing per-cartella e
// fetch puntuali per-file, con throttle prudenziale sull'endpoint di listing (non
// documentato: è il JSON della web UI di GitHub, fuori dal rate limit dell'API REST).

const AKN_REPO = "SenatoDellaRepubblica/AkomaNtosoBulkData";
const UA = "italianparliament-mcp (+https://github.com/ondata/italianparliament-mcp)";

/** Path della cartella dell'atto nel repo bulk: Leg<leg>/Atto<id zero-padded a 8>. */
export function aknAttoPath(ddlUri: string, legislature: number | string): string {
  const id = ddlUri.match(/\/ddl\/(\d+)/)?.[1];
  if (!id) {
    throw new Error(
      `URI DDL Senato non riconosciuto per il bulk AKN: "${ddlUri}" (atteso un URI con ` +
        `"/ddl/<n>", es. http://dati.senato.it/ddl/60233)`,
    );
  }
  return `Leg${legislature}/Atto${id.padStart(8, "0")}`;
}

/** URL raw (senza WAF) di un file nel repo bulk. */
export function aknRawUrl(path: string): string {
  return `https://raw.githubusercontent.com/${AKN_REPO}/master/${path}`;
}

export type AknDirListing = {
  /** Nomi file nella cartella (max 1000 dal listing web UI). */
  names: string[];
  /** Totale reale dei file: se > names.length il listing è troncato. */
  totalCount: number;
};

/**
 * Lista i file di una cartella del repo bulk via endpoint JSON della web UI di GitHub
 * (GET github.com/.../tree/master/<path> con Accept: application/json). Niente token,
 * fuori dal rate limit REST. Cartella inesistente → listing vuoto (non è un errore:
 * molti atti non hanno emendamenti). Il listing è troncato a 1000 voci: totalCount
 * permette al chiamante di segnalarlo invece di tacere.
 */
export async function listAknDir(path: string): Promise<AknDirListing> {
  const url = `https://github.com/${AKN_REPO}/tree/master/${path}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": UA },
    redirect: "follow",
  });
  if (res.status === 404) return { names: [], totalCount: 0 };
  if (!res.ok) {
    throw new Error(`Listing bulk AKN fallito (${res.status}) su ${url}`);
  }
  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    payload = undefined;
  }
  // Endpoint non documentato: se GitHub cambia la forma della risposta meglio un
  // errore esplicito che un vuoto scambiabile per "nessun emendamento".
  const tree = (payload as { payload?: { codeViewTreeRoute?: { tree?: unknown } } })
    ?.payload?.codeViewTreeRoute?.tree as
    | { items?: { name?: string }[]; totalCount?: number }
    | undefined;
  if (!tree || !Array.isArray(tree.items)) {
    throw new Error(
      `Listing bulk AKN in formato inatteso su ${url}: l'endpoint JSON della web UI ` +
        `di GitHub potrebbe essere cambiato. Fallback manuale: sfogliare ` +
        `https://github.com/${AKN_REPO}/tree/master/${path}`,
    );
  }
  // L'ordine di tree.items non è un contratto garantito dell'endpoint (non
  // documentato): senza un sort esplicito, offset/limit sui chiamanti
  // rischiano duplicati/salti tra esecuzioni diverse.
  const names = tree.items
    .map((i) => i.name ?? "")
    .filter((n) => n.length > 0)
    .sort();
  return { names, totalCount: tree.totalCount ?? names.length };
}

export type AknAmendment = {
  /** Numero dell'emendamento (an:FRBRnumber, es. "1.0.5" o "QP1"). */
  number: string;
  /** Denominazione del tipo (an:FRBRname, es. "Emendamento", "Questione pregiudiziale"). */
  name: string;
  /** Data di presentazione (an:FRBRdate name="presentazione", ISO). */
  date: string;
  /** Proponenti nell'ordine del documento (il primo è il primo firmatario). */
  proponents: { name: string; uri: string }[];
};

/**
 * Estrae i metadati utili da un file AKN di emendamento (-em.akn.xml). Parsing a
 * regex mirate sui tag an:* — niente parser XML: i campi sono piatti e stabili
 * (verificato su Leg18 e Leg19) e il bundle Worker resta magro.
 */
export function parseAknAmendment(xml: string): AknAmendment {
  const attr = (re: RegExp) => xml.match(re)?.[1]?.trim() ?? "";
  const number = attr(/<an:FRBRnumber[^>]*\bvalue="([^"]*)"/);
  const name = attr(/<an:FRBRname[^>]*\bvalue="([^"]*)"/);
  // Ordine degli attributi XML non garantito dallo standard: si isola il tag
  // FRBRdate della presentazione, poi si estrae date= indipendentemente da
  // dove compare rispetto a name=.
  const dateTagMatch = xml.match(
    /<an:FRBRdate\b[^>]*\bname="presentazione"[^>]*>/,
  );
  const date = dateTagMatch
    ? (dateTagMatch[0].match(/\bdate="([^"]*)"/)?.[1]?.trim() ?? "")
    : "";

  // an:TLCPerson mappa l'id interno del documento all'URI dati.senato.it della
  // persona; showAs è il nome (nei file di commissione è più completo del testo
  // del docProponent, es. "Bartolomeo Amidei" vs "Amidei"). Stessa cautela
  // sull'ordine attributi: si isola il tag, poi si estrae ogni attributo.
  const person = new Map<string, { uri: string; showAs: string }>();
  for (const m of xml.matchAll(/<an:TLCPerson\b[^>]*\/?>/g)) {
    const tag = m[0];
    const id = tag.match(/\bid="([^"]+)"/)?.[1];
    const uri = tag.match(/\bhref="([^"]*)"/)?.[1] ?? "";
    const showAs = tag.match(/\bshowAs="([^"]*)"/)?.[1] ?? "";
    if (id) person.set(id, { uri, showAs });
  }
  const proponents: { name: string; uri: string }[] = [];
  const seen = new Set<string>();
  // Il nome può essere testo diretto (file d'Assemblea) o annidato in an:span
  // (file di Commissione): si cattura tutto l'interno e si strippano i tag.
  for (const m of xml.matchAll(
    /<an:docProponent\b[^>]*\brefersTo="#([^"]+)"[^>]*>([\s\S]*?)<\/an:docProponent>/g,
  )) {
    const key = m[1];
    if (seen.has(key)) continue; // il preambolo può ripetere i proponenti
    seen.add(key);
    const inner = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const p = person.get(key);
    proponents.push({ name: p?.showAs || inner, uri: p?.uri ?? "" });
  }
  return { number, name, date, proponents };
}

/**
 * Converte l'URL WAF-ato del testo AKN esposto dal LOD (osr:URLTestoXml, es.
 * senato.it/leg/19/BGT/Testi/Emend/<lista>/<id>.akn) nell'URL raw equivalente del
 * repo bulk — pura sostituzione di stringa, zero listing (pattern verificato nel
 * wiki). Ritorna "" se l'input non è nel formato atteso.
 */
export function aknEmendRawUrlFromTestoXml(
  urlTestoXml: string,
  ddlUri: string,
  legislature: number | string,
  committee = false,
): string {
  const id = urlTestoXml.match(/\/(\d+)\.akn$/)?.[1];
  if (!id || !legislature) return "";
  let path: string;
  try {
    path = aknAttoPath(ddlUri, legislature);
  } catch {
    return "";
  }
  return aknRawUrl(`${path}/${committee ? "emendc" : "emend"}/${id}-em.akn.xml`);
}

/** Fetch di un singolo file raw del bulk (testo). Errore esplicito su non-200. */
export async function fetchAknFile(rawUrl: string): Promise<string> {
  const res = await fetch(rawUrl, {
    headers: { "User-Agent": UA },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`Download bulk AKN fallito (${res.status}) su ${rawUrl}`);
  }
  return res.text();
}

/** Esegue task async con concorrenza limitata, preservando l'ordine dei risultati. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  // limit<=0 andrebbe letto come "zero worker" ma produrrebbe un vuoto
  // silenzioso invece di processare items: si normalizza ad almeno 1.
  const workers = Array.from(
    { length: Math.max(1, Math.min(limit, items.length)) },
    async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i], i);
      }
    },
  );
  await Promise.all(workers);
  return results;
}
