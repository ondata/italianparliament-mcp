import { cdQuery, snQuery } from "./client.js";
import { flattenBindings } from "./flatten.js";
import { OCD_PREFIXES, OSR_PREFIXES } from "./prefixes.js";
import { cleanGroupLabel } from "./group-label.js";
import { senatoRequestUriLength, SENATO_MAX_REQUEST_URI } from "./senato-query-size.js";
import { chunkWhile, isoDate, type Membership } from "./membership-at.js";

/**
 * Adesioni ai gruppi di un insieme di parlamentari, per URI persona. Due
 * fonti con lo stesso contratto, così `bill-signatories` risolve il gruppo
 * alla data della firma con `pickMembershipAt` (core/membership-at.ts).
 */
export type MembershipLookup = (personUris: string[]) => Promise<Map<string, Membership[]>>;

const CAMERA_BATCH = 40;

/**
 * Camera: `?dep ocd:aderisce ?ad` con `ocd:rif_gruppoParlamentare`,
 * `ocd:startDate`/`ocd:endDate` (`YYYYMMDD`). La label dell'adesione porta il
 * nome del gruppo **al tempo** («PER L'ITALIA (19.11.2014-22.03.2018)»),
 * mentre la risorsa gruppo porta il nome attuale («DEMOCRAZIA SOLIDALE -
 * CENTRO DEMOCRATICO (DES-CD)», verificato su gr1889): qui si usa la prima,
 * ripulita delle date, perché è quella che valeva alla firma.
 */
export const cameraMemberships: MembershipLookup = async (deputyUris) => {
  const out = new Map<string, Membership[]>();
  const uris = [...new Set(deputyUris.filter((u) => u.includes("dati.camera.it")))];
  for (let i = 0; i < uris.length; i += CAMERA_BATCH) {
    const batch = uris.slice(i, i + CAMERA_BATCH);
    const query = `${OCD_PREFIXES}
SELECT DISTINCT ?dep ?g ?lbl ?s ?e WHERE {
  ?dep ocd:aderisce ?ad .
  ?ad ocd:rif_gruppoParlamentare ?g ; ocd:startDate ?s .
  OPTIONAL { ?ad ocd:endDate ?e }
  OPTIONAL { ?ad rdfs:label ?lbl }
  FILTER(?dep IN (${batch.map((u) => `<${u}>`).join(", ")}))
}`;
    for (const r of flattenBindings(await cdQuery(query))) {
      if (!r.dep || !r.g) continue;
      const list = out.get(r.dep) ?? [];
      list.push({
        group_uri: r.g,
        group_label: cleanGroupLabel(r.lbl ?? ""),
        start: isoDate(r.s),
        end: isoDate(r.e),
      });
      out.set(r.dep, list);
    }
  }
  return out;
};

/**
 * Senato: `?s ocd:aderisce ?m` (sì, prefisso ocd) con `osr:gruppo`,
 * `osr:inizio`/`osr:fine` (`xsd:date`). Il nome del gruppo sta nelle
 * `osr:denominazione` con validità propria: si scaricano tutte quelle dei
 * gruppi trovati e la scelta per data la fa il chiamante (`pickDenominationAt`).
 * Nessun VALUES (non supportato): `FILTER IN` con `sen:N`, a blocchi sotto il
 * limite di request-URI del Senato.
 */
export async function senatoMembershipsRaw(
  senatorUris: string[],
): Promise<{
  memberships: Map<string, { group_uri: string; start: string; end: string }[]>;
  denominations: Map<string, { title: string; start: string; end: string }[]>;
}> {
  const memberships = new Map<string, { group_uri: string; start: string; end: string }[]>();
  const denominations = new Map<string, { title: string; start: string; end: string }[]>();
  const ids = [
    ...new Set(
      senatorUris.map((u) => u.match(/dati\.senato\.it\/senatore\/(\d+)$/)?.[1]).filter((x): x is string => !!x),
    ),
  ];
  const mq = (batch: string[]) => `${OSR_PREFIXES}
PREFIX ocd: <http://dati.camera.it/ocd/>
PREFIX sen: <http://dati.senato.it/senatore/>
SELECT ?s ?g ?i ?f WHERE {
  ?s ocd:aderisce ?m . ?m osr:gruppo ?g ; osr:inizio ?i .
  OPTIONAL { ?m osr:fine ?f }
  FILTER(?s IN (${batch.map((id) => `sen:${id}`).join(", ")}))
}`;
  for (const batch of chunkWhile(ids, (c) => senatoRequestUriLength(mq(c)) <= SENATO_MAX_REQUEST_URI)) {
    for (const r of flattenBindings(await snQuery(mq(batch)))) {
      if (!r.s || !r.g) continue;
      const list = memberships.get(r.s) ?? [];
      list.push({ group_uri: r.g, start: isoDate(r.i), end: isoDate(r.f) });
      memberships.set(r.s, list);
    }
  }
  const groupIds = [
    ...new Set(
      [...memberships.values()].flat().map((m) => m.group_uri.match(/\/gruppo\/(\d+)$/)?.[1]).filter((x): x is string => !!x),
    ),
  ];
  const dq = (batch: string[]) => `${OSR_PREFIXES}
PREFIX gr: <http://dati.senato.it/gruppo/>
SELECT ?g ?t ?i ?f WHERE {
  ?g osr:denominazione ?den . ?den osr:titolo ?t ; osr:inizio ?i .
  OPTIONAL { ?den osr:fine ?f }
  FILTER(?g IN (${batch.map((id) => `gr:${id}`).join(", ")}))
}`;
  for (const batch of chunkWhile(groupIds, (c) => senatoRequestUriLength(dq(c)) <= SENATO_MAX_REQUEST_URI)) {
    for (const r of flattenBindings(await snQuery(dq(batch)))) {
      if (!r.g || !r.t) continue;
      const list = denominations.get(r.g) ?? [];
      list.push({ title: r.t, start: isoDate(r.i), end: isoDate(r.f) });
      denominations.set(r.g, list);
    }
  }
  return { memberships, denominations };
}
