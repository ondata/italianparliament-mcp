import { snQuery } from "./client.js";
import { flattenBindings } from "./flatten.js";
import { senatoRequestUriLength, SENATO_MAX_REQUEST_URI } from "./senato-query-size.js";

/**
 * Legge nata da un DDL: numero, data e link a Normattiva.
 *
 * Il repertorio Senato porta `osr:numeroLegge` e `osr:dataLegge` come due
 * proprietà separate, ripetute su ogni fase dello stesso DDL (anche sulle fasi
 * Camera). Sulle leggi costituzionali il LOD aggiunge una seconda coppia con
 * data 2100-01-01 (es. ddl/49285: numeri 1 e 687, date 2020-10-19 e
 * 2100-01-01; ddl/58803: solo 690 e 2100-01-01). Le due proprietà non sono
 * legate fra loro, quindi una coppia si può affermare solo quando c'è
 * esattamente un numero e una data, e la data non è nel futuro. Negli altri
 * casi si espongono i valori grezzi e nessun link: scegliere il numero
 * "giusto" in codice sarebbe un'ipotesi, non un dato.
 */
export interface LawRef {
  law_number: string;
  law_date: string;
  law_url: string;
}

export const EMPTY_LAW: LawRef = { law_number: "", law_date: "", law_url: "" };

/**
 * Tipo di atto nell'URN Normattiva, da `osr:natura`. Nessun default: un URN
 * con il tipo sbagliato risponde 200 su un altro atto
 * (`legge:2020-10-19;1` apre il DL 1/2020, non la legge costituzionale 1/2020).
 */
const NORMATTIVA_ACT: Record<string, string> = {
  costituzionale: "legge.costituzionale",
  ordinaria: "legge",
  "di conversione di decreto-legge": "legge",
  "di approvazione di bilancio": "legge",
};

export function normattivaUrl(nature: string, date: string, number: string): string {
  const act = NORMATTIVA_ACT[nature.trim()];
  if (!act || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d+$/.test(number)) return "";
  return `https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:${act}:${date};${number}`;
}

export function pairLaw(
  numbers: Iterable<string>,
  dates: Iterable<string>,
  nature: string,
  today: string = new Date().toISOString().slice(0, 10),
): LawRef {
  const ns = [...new Set(numbers)].filter(Boolean).sort((a, b) => Number(a) - Number(b));
  const ds = [...new Set(dates)].filter(Boolean).sort();
  if (ns.length === 0 && ds.length === 0) return EMPTY_LAW;
  if (ns.length === 1 && ds.length === 1 && ds[0] <= today) {
    return { law_number: ns[0], law_date: ds[0], law_url: normattivaUrl(nature, ds[0], ns[0]) };
  }
  return { law_number: ns.join(";"), law_date: ds.join(";"), law_url: "" };
}

interface RawLaw {
  numbers: Set<string>;
  dates: Set<string>;
}

function lawQuery(ids: string[]): string {
  return `PREFIX osr: <http://dati.senato.it/osr/>
PREFIX ddl: <http://dati.senato.it/ddl/>
SELECT ?s ?n ?dl WHERE {
  ?s osr:numeroLegge ?n .
  OPTIONAL { ?s osr:dataLegge ?dl }
  FILTER(?s IN (${ids.map((id) => `ddl:${id}`).join(", ")}))
}`;
}

/**
 * Numero e data di legge per un insieme di DDL Senato. Query separata dalla
 * lista (e non OPTIONAL dentro di essa) perché i DDL con due coppie
 * moltiplicherebbero le righe e sfalserebbero limit/offset. Virtuoso Senato
 * non supporta VALUES: si usa FILTER IN con i nomi abbreviati `ddl:N`, a
 * blocchi che restano sotto il limite di request-URI.
 */
export async function senatoLawByUri(uris: string[]): Promise<Map<string, RawLaw>> {
  const ids = [...new Set(uris.map((u) => u.match(/\/ddl\/(\d+)$/)?.[1]).filter((x): x is string => !!x))];
  const out = new Map<string, RawLaw>();
  const batches: string[][] = [];
  let cur: string[] = [];
  for (const id of ids) {
    if (cur.length > 0 && senatoRequestUriLength(lawQuery([...cur, id])) > SENATO_MAX_REQUEST_URI) {
      batches.push(cur);
      cur = [];
    }
    cur.push(id);
  }
  if (cur.length > 0) batches.push(cur);
  for (const batch of batches) {
    for (const r of flattenBindings(await snQuery(lawQuery(batch)))) {
      if (!r.s) continue;
      const e = out.get(r.s) ?? { numbers: new Set<string>(), dates: new Set<string>() };
      if (r.n) e.numbers.add(r.n);
      if (r.dl) e.dates.add(r.dl);
      out.set(r.s, e);
    }
  }
  return out;
}
