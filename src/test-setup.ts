/**
 * Scrive quante richieste SPARQL la suite ha mandato, per endpoint, in
 * `tmp/sparql-requests.json`. Il contatore sta in `src/core/client.ts` e conta
 * i tentativi HTTP, cioè ciò che l'endpoint vede: è il volume su cui il Senato
 * blocca l'IP. La suite gira in un solo processo con moduli condivisi (vedi
 * `vitest.config.ts`), quindi il contatore è cumulativo e l'`afterAll` di ogni
 * file sovrascrive il file col totale raggiunto fin lì: l'ultimo scrive il
 * totale della run. (Un hook su `process.exit` non scatta: vitest termina il
 * worker senza passarci.)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll } from "vitest";
import { requestCounts } from "./core/client.js";

afterAll(() => {
  const dir = resolve(process.cwd(), "tmp");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    resolve(dir, "sparql-requests.json"),
    JSON.stringify({ ...requestCounts, at: new Date().toISOString() }, null, 2) + "\n",
  );
});
