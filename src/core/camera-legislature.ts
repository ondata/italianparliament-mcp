import { cdQuery } from "./client.js";
import { flattenBindings } from "./flatten.js";
import { OCD_PREFIXES } from "./prefixes.js";

/**
 * Mappa data → legislatura per il grafo Camera.
 *
 * Le legislature espongono l'intervallo in `dc:date` come `"20180323-20221012"`
 * (quella in corso solo l'inizio: `"20221013"`), quindi bastano una query
 * leggera sulla sola classe `ocd:legislatura` e un confronto di stringhe
 * `AAAAMMGG` — lo stesso formato con cui il grafo Camera scrive le date, senza
 * conversioni intermedie.
 */
export type LegislatureRange = { legislature: number; from: string; to?: string };

/**
 * Solo le legislature repubblicane: il grafo contiene anche quelle del Regno
 * d'Italia, che nessun tool interroga e che porterebbero rumore nelle
 * deduzioni. Le righe senza `date` o con un intervallo malformato vengono
 * scartate invece di essere indovinate.
 */
export function parseLegislatureRanges(
  rows: Array<Record<string, string>>,
): LegislatureRange[] {
  const out: LegislatureRange[] = [];
  for (const r of rows) {
    const n = Number(/repubblica_(\d+)$/.exec(r.uri ?? "")?.[1]);
    if (!Number.isInteger(n) || n <= 0) continue;
    const m = /^(\d{8})(?:-(\d{8}))?$/.exec((r.date ?? "").trim());
    if (!m) continue;
    out.push({ legislature: n, from: m[1], to: m[2] });
  }
  return out.sort((a, b) => a.legislature - b.legislature);
}

/**
 * Legislature che intersecano l'intervallo richiesto. Un estremo assente vale
 * "aperto da quel lato": `--date-from` senza `--date-to` copre tutto ciò che
 * viene dopo, ed è il caso in cui l'intervallo finisce più facilmente a cavallo
 * di due legislature. Date in formato `AAAAMMGG`.
 */
export function legislaturesForDateRange(
  ranges: LegislatureRange[],
  dateFrom?: string,
  dateTo?: string,
): number[] {
  return ranges
    .filter((r) => {
      if (dateTo && dateTo < r.from) return false;
      if (dateFrom && r.to && dateFrom > r.to) return false;
      return true;
    })
    .map((r) => r.legislature);
}

let cached: Promise<LegislatureRange[]> | undefined;

/** Elenco legislature con intervallo, una volta sola per processo. */
export async function cameraLegislatureRanges(): Promise<LegislatureRange[]> {
  cached ??= (async () => {
    const rows = flattenBindings(
      await cdQuery(`${OCD_PREFIXES}
SELECT DISTINCT ?uri ?date WHERE {
  ?uri a <http://dati.camera.it/ocd/legislatura> ; dc:date ?date .
}`),
    );
    return parseLegislatureRanges(rows);
  })();
  return cached;
}
