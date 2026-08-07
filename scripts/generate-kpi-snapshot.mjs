#!/usr/bin/env node
/**
 * Genera lo snapshot statico dei KPI per site/data/kpi.json, passando
 * dalla CLI reale (dist/cli.js) — non da import diretti di src/dist
 * interni, per usare esattamente lo stesso percorso di un consumer
 * esterno e non dipendere da artefatti di build non garantiti.
 *
 * Va lanciato a mano quando serve aggiornare i KPI (non da GitHub
 * Actions: gli endpoint SPARQL di Camera/Senato bloccano sistematicamente
 * le richieste dai runner CI, v. commento in .github/workflows/ci.yml).
 *
 * Uso:
 *   npm run build && node scripts/generate-kpi-snapshot.mjs
 *   git add site/data/kpi.json && git commit -m "chore: aggiorna snapshot KPI"
 */

import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CLI = join(ROOT, "dist", "cli.js");
const OUT = join(ROOT, "site", "data", "kpi.json");
const LEGISLATURE = 19;
const MAX_LIMIT = 1000;

function runCli(args) {
  const out = execFileSync("node", [CLI, ...args], { encoding: "utf8" });
  return out
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

/** Pagina un comando list finché non torna meno di MAX_LIMIT righe (ultima pagina). */
function runCliAllPages(args) {
  const rows = [];
  let offset = 0;
  for (;;) {
    const page = runCli([...args, "--limit", String(MAX_LIMIT), "--offset", String(offset), "--format", "jsonl"]);
    rows.push(...page);
    if (page.length < MAX_LIMIT) break;
    offset += MAX_LIMIT;
  }
  return rows;
}

/** Card "gruppi": totale (countOnly) + classifica gruppi (group-rank, tutti — non solo il top N, il toggle client-side ha bisogno del campione intero). */
function buildGroupCard(totalCommand, rankByValue) {
  const totalRows = runCli([...totalCommand, "--legislature", String(LEGISLATURE), "--count-only", "--format", "jsonl"]);
  const rankRows = runCli(["group-rank", "list", "--rank-by", rankByValue, "--legislature", String(LEGISLATURE), "--limit", "30", "--format", "jsonl"]);
  return {
    total: Number(totalRows[0]?.count || 0),
    rank: rankRows.map((r) => ({
      rank: Number(r.rank),
      group_uri: r.group_uri,
      group_label: r.group_label,
      group_acronym: r.group_acronym,
      count: Number(r.count || 0),
      members: r.members ? Number(r.members) : null,
      count_per_member: r.count_per_member ? Number(r.count_per_member) : null,
    })),
  };
}

/** Rappresentanza di genere: quota donne, Camera e Senato (deputies/senators non hanno --count-only, contiamo le righe). */
function buildGenderCard() {
  const camFemale = runCliAllPages(["deputies", "list", "--legislature", String(LEGISLATURE), "--gender", "female"]).length;
  const camTotal = runCliAllPages(["deputies", "list", "--legislature", String(LEGISLATURE)]).length;
  const senFemale = runCliAllPages(["senators", "list", "--legislature", String(LEGISLATURE), "--gender", "female"]).length;
  const senTotal = runCliAllPages(["senators", "list", "--legislature", String(LEGISLATURE)]).length;
  return {
    camera: { female: camFemale, total: camTotal },
    senato: { female: senFemale, total: senTotal },
  };
}

/**
 * Partecipazione al voto: media del campo `present` (letto da ocd:presenti,
 * un conteggio di presenza reale della fonte, non dedotto da noi) sulle
 * votazioni più recenti. Non su tutta la legislatura (19.427 votazioni,
 * paginare tutto sarebbe pesante per un dato aggregato): campione dichiarato
 * nel nome del campo, non un totale silenzioso.
 */
function buildAttendanceCard() {
  const rows = runCli(["votes", "list", "--legislature", String(LEGISLATURE), "--limit", String(MAX_LIMIT), "--format", "jsonl"]);
  const present = rows.map((r) => Number(r.present || 0)).filter((n) => n > 0);
  const avg = present.reduce((a, b) => a + b, 0) / present.length;
  return {
    sampleSize: present.length,
    seats: 400,
    avgPresent: Math.round(avg * 10) / 10,
    avgPresentPct: Math.round((avg / 400) * 1000) / 10,
    minPresent: Math.min(...present),
    maxPresent: Math.max(...present),
  };
}

/** Performance commissioni: audizioni totali + top commissioni per numero di audizioni (tutte le pagine, non solo le prime 1000). */
function buildCommitteeCard() {
  const rows = runCliAllPages(["audizioni", "list", "--legislature", String(LEGISLATURE)]);
  const byCommittee = new Map();
  for (const r of rows) {
    const key = r.committee || "—";
    byCommittee.set(key, (byCommittee.get(key) || 0) + 1);
  }
  const rank = [...byCommittee.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([committee, count], i) => ({ rank: i + 1, committee, count }));
  return { total: rows.length, rank };
}

const snapshot = {
  generatedAt: new Date().toISOString(),
  legislature: LEGISLATURE,
  cards: {
    bills: buildGroupCard(["bills", "list"], "bills"),
    aic: buildGroupCard(["aic", "list"], "aic"),
    gender: buildGenderCard(),
    attendance: buildAttendanceCard(),
    committees: buildCommitteeCard(),
  },
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(snapshot, null, 2) + "\n");
console.log(`Scritto ${OUT}`);
console.log(`bills: totale ${snapshot.cards.bills.total}, ${snapshot.cards.bills.rank.length} gruppi`);
console.log(`aic: totale ${snapshot.cards.aic.total}, ${snapshot.cards.aic.rank.length} gruppi`);
console.log(`gender: camera ${snapshot.cards.gender.camera.female}/${snapshot.cards.gender.camera.total}, senato ${snapshot.cards.gender.senato.female}/${snapshot.cards.gender.senato.total}`);
console.log(`attendance: media ${snapshot.cards.attendance.avgPresent}/${snapshot.cards.attendance.seats} su ${snapshot.cards.attendance.sampleSize} votazioni`);
console.log(`committees: ${snapshot.cards.committees.total} audizioni, ${snapshot.cards.committees.rank.length} commissioni`);
