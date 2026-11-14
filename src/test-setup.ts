/**
 * Scrive quante richieste SPARQL la suite ha mandato, per endpoint, in
 * `tmp/sparql-requests.json`. Il contatore sta in `src/core/client.ts` e conta
 * i tentativi HTTP, cioè ciò che l'endpoint vede: è il volume su cui il Senato
 * blocca l'IP. La suite gira in un solo processo con moduli condivisi (vedi
 * `vitest.config.ts`), quindi il contatore è cumulativo e l'`afterAll` di ogni
 * file sovrascrive il file col totale raggiunto fin lì: l'ultimo scrive il
 * totale della run. (Un hook su `process.exit` non scatta: vitest termina il
 * worker senza passarci.) In replay delle fixture il contatore conta le
 * risposte rigiocate, non richieste in rete: il campo `fixtures` lo dice.
 *
 * Con `SPARQL_FIXTURES=record|replay` installa anche il `fetch` delle fixture
 * (`src/test-fixtures.ts`, #117) e congela `Date` alla data di registrazione.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, vi } from "vitest";
import { requestCounts, setSenatoMinIntervalForTests } from "./core/client.js";
import { fixtureFetch, fixtureMode, recordedAt } from "./test-fixtures.js";

const mode = fixtureMode();
if (mode) {
  // Il setup gira per ogni file, ma i moduli sono condivisi: si installa una volta sola.
  const g = globalThis as { __fixtureFetchInstalled?: boolean };
  if (!g.__fixtureFetchInstalled) {
    mkdirSync(resolve(process.cwd(), "tmp"), { recursive: true });
    globalThis.fetch = fixtureFetch(mode, globalThis.fetch);
    g.__fixtureFetchInstalled = true;
  }
  vi.useFakeTimers({ toFake: ["Date"], now: new Date(recordedAt()) });
  if (mode === "replay") setSenatoMinIntervalForTests(0);
}

afterAll(() => {
  const dir = resolve(process.cwd(), "tmp");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    resolve(dir, "sparql-requests.json"),
    JSON.stringify({ ...requestCounts, fixtures: mode ?? null, at: new Date().toISOString() }, null, 2) + "\n",
  );
});
