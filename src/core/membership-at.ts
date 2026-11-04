/**
 * Gruppo di un parlamentare a una data: risoluzione in TypeScript sulle
 * adesioni scaricate, non nel FILTER SPARQL. La data cambia firmatario per
 * firmatario (al Senato ogni firma ha la sua `dataAggiuntaFirma`) e il
 * Virtuoso del Senato non ha BIND: una query per gruppo di firmatari più il
 * confronto qui è più semplice e testabile.
 */

export interface Membership {
  group_uri: string;
  group_label: string;
  /** ISO YYYY-MM-DD */
  start: string;
  /** ISO YYYY-MM-DD, "" se in corso */
  end: string;
}

/**
 * Porta a ISO `YYYY-MM-DD` le forme viste alla fonte: Camera `YYYYMMDD`
 * (`20130515`), Senato `xsd:date` (`2023-01-13`) e datetime stringa
 * (`2023-01-13 00:00:00.0`, le date di firma). Altro: invariato.
 */
export function isoDate(raw: string | undefined): string {
  const d = (raw ?? "").trim();
  if (/^\d{8}$/.test(d)) return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(d);
  return m ? m[1] : d;
}

/**
 * Adesioni valide alla data: `start <= date` e (`end` vuota o `end >= date`),
 * confronto lessicografico su ISO. Dedupe su (gruppo, inizio, fine): al Senato
 * la stessa adesione compare su due nodi identici. Più di una valida (cambio
 * di gruppo il giorno della firma): si espongono tutte con `;`, senza
 * sceglierne una.
 */
export function pickMembershipAt(
  memberships: Membership[],
  date: string,
): { group_uri: string; group_label: string } {
  if (!date) return { group_uri: "", group_label: "" };
  const seen = new Set<string>();
  const valid: Membership[] = [];
  for (const m of memberships) {
    if (!m.start || m.start > date || (m.end && m.end < date)) continue;
    const key = `${m.group_uri}|${m.start}|${m.end}`;
    if (seen.has(key)) continue;
    seen.add(key);
    valid.push(m);
  }
  return {
    group_uri: valid.map((m) => m.group_uri).join(";"),
    group_label: valid.map((m) => m.group_label).join(";"),
  };
}

/** Denominazione di un gruppo Senato a una data; se nessuna copre la data, l'ultima iniziata. */
export function pickDenominationAt(
  denominations: { title: string; start: string; end: string }[],
  date: string,
): string {
  const at = denominations.filter(
    (d) => d.start && d.start <= date && (!d.end || d.end >= date),
  );
  if (at.length > 0) return at[0].title;
  const sorted = [...denominations].sort((a, b) => (a.start < b.start ? 1 : -1));
  return sorted[0]?.title ?? "";
}

/** Spezza una lista in blocchi finché `fits(blocco)` resta vero (almeno un elemento per blocco). */
export function chunkWhile<T>(items: T[], fits: (chunk: T[]) => boolean): T[][] {
  const out: T[][] = [];
  let cur: T[] = [];
  for (const it of items) {
    if (cur.length > 0 && !fits([...cur, it])) {
      out.push(cur);
      cur = [];
    }
    cur.push(it);
  }
  if (cur.length > 0) out.push(cur);
  return out;
}
