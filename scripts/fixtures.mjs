#!/usr/bin/env node
/**
 * Gestione delle fixture SPARQL (#117), usato dagli script npm:
 *
 *   node scripts/fixtures.mjs start   prima di una registrazione completa: cancella
 *                                     le fixture e scrive la nuova data nel manifest
 *   node scripts/fixtures.mjs reset   prima di un replay completo: azzera gli elenchi
 *                                     delle fixture usate e mancanti (tmp/fixtures-*.txt)
 *   node scripts/fixtures.mjs check   dopo un replay completo: fallisce se una richiesta
 *                                     non ha trovato la sua fixture (anche se il
 *                                     chiamante ha intercettato l'errore e il test è
 *                                     passato) o se ci sono fixture che nessun test ha usato
 *   node scripts/fixtures.mjs check --prune
 *                                     dopo un record completo: le cancella invece di
 *                                     fallire. Sono le query dei test che in replay si
 *                                     saltano (NET_BLOCKED): il record le salva, la
 *                                     replay non le legge mai.
 *
 * Il controllo delle inutilizzate ha senso solo sulla suite intera: con
 * `test:tool` le fixture degli altri tool restano fuori per costruzione.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";

const DIR = resolve(process.cwd(), "test/fixtures/sparql");
const MANIFEST = resolve(DIR, "manifest.json");
const USED = resolve(process.cwd(), "tmp/fixtures-used.txt");
const MISSING = resolve(process.cwd(), "tmp/fixtures-missing.txt");
const ENDPOINTS = ["camera", "senato"];

const cmd = process.argv[2];
if (cmd === "start") {
  for (const e of ENDPOINTS) rmSync(resolve(DIR, e), { recursive: true, force: true });
  mkdirSync(DIR, { recursive: true });
  writeFileSync(MANIFEST, JSON.stringify({ recordedAt: new Date().toISOString() }, null, 2) + "\n");
  console.log(`fixture cancellate, nuova data di registrazione in ${MANIFEST}`);
} else if (cmd === "reset") {
  rmSync(USED, { force: true });
  rmSync(MISSING, { force: true });
} else if (cmd === "check") {
  const missing = existsSync(MISSING) ? readFileSync(MISSING, "utf8").split("\n").filter(Boolean) : [];
  if (missing.length > 0) {
    console.error(`${missing.length} richieste senza fixture (registrarle con SPARQL_FIXTURES=record):`);
    for (const line of [...new Set(missing)]) {
      const [endpoint, , query] = line.split("\t");
      console.error(`  ${endpoint}  «${query.replace(/PREFIX\s+\S*\s*<[^>]*>/gi, "").trim().slice(0, 100)}»`);
    }
    process.exit(1);
  }
  const used = new Set(existsSync(USED) ? readFileSync(USED, "utf8").split("\n").filter(Boolean) : []);
  const unused = [];
  for (const e of ENDPOINTS) {
    const d = resolve(DIR, e);
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d)) {
      const p = resolve(d, f);
      if (!used.has(p)) unused.push(p);
    }
  }
  if (unused.length > 0 && process.argv[3] === "--prune") {
    for (const p of unused) rmSync(p);
    console.log(`fixture: ${unused.length} mai lette in replay, cancellate; ${used.size} restano`);
  } else if (unused.length > 0) {
    console.error(`${unused.length} fixture mai usate dalla suite (query cambiate o test tolti), da cancellare o riregistrare:`);
    for (const p of unused) {
      const { query } = JSON.parse(gunzipSync(readFileSync(p)).toString("utf8"));
      console.error(`  ${p.slice(DIR.length + 1)}  «${query.replace(/PREFIX\s+\S*\s*<[^>]*>/gi, "").replace(/\s+/g, " ").trim().slice(0, 100)}»`);
    }
    process.exit(1);
  } else {
    console.log(`fixture: tutte usate (${used.size})`);
  }
} else {
  console.error("uso: node scripts/fixtures.mjs start|reset|check");
  process.exit(2);
}
