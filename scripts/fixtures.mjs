#!/usr/bin/env node
/**
 * Gestione delle fixture SPARQL (#117), usato dagli script npm:
 *
 *   node scripts/fixtures.mjs start   prima di una registrazione completa: cancella
 *                                     le fixture e scrive la nuova data nel manifest
 *   node scripts/fixtures.mjs reset   prima di un replay completo: azzera l'elenco
 *                                     delle fixture usate (tmp/fixtures-used.txt)
 *   node scripts/fixtures.mjs check   dopo un replay completo: fallisce se ci sono
 *                                     fixture che nessun test ha usato
 *
 * Il controllo delle inutilizzate ha senso solo sulla suite intera: con
 * `test:tool` le fixture degli altri tool restano fuori per costruzione.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const DIR = resolve(process.cwd(), "test/fixtures/sparql");
const MANIFEST = resolve(DIR, "manifest.json");
const USED = resolve(process.cwd(), "tmp/fixtures-used.txt");
const ENDPOINTS = ["camera", "senato"];

const cmd = process.argv[2];
if (cmd === "start") {
  for (const e of ENDPOINTS) rmSync(resolve(DIR, e), { recursive: true, force: true });
  mkdirSync(DIR, { recursive: true });
  writeFileSync(MANIFEST, JSON.stringify({ recordedAt: new Date().toISOString() }, null, 2) + "\n");
  console.log(`fixture cancellate, nuova data di registrazione in ${MANIFEST}`);
} else if (cmd === "reset") {
  rmSync(USED, { force: true });
} else if (cmd === "check") {
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
  if (unused.length > 0) {
    console.error(`${unused.length} fixture mai usate dalla suite (query cambiate o test tolti), da cancellare o riregistrare:`);
    for (const p of unused) {
      const { query } = JSON.parse(readFileSync(p, "utf8"));
      console.error(`  ${p.slice(DIR.length + 1)}  «${query.replace(/PREFIX\s+\S*\s*<[^>]*>/gi, "").replace(/\s+/g, " ").trim().slice(0, 100)}»`);
    }
    process.exit(1);
  }
  console.log(`fixture: tutte usate (${used.size})`);
} else {
  console.error("uso: node scripts/fixtures.mjs start|reset|check");
  process.exit(2);
}
