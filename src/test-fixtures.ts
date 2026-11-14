/**
 * Fixture SPARQL registrate e rigiocate (#117). Usato solo da
 * `src/test-setup.ts`: il codice di produzione e il bundle Worker non lo
 * importano, quindi niente `node:fs` fuori dai test.
 *
 * `SPARQL_FIXTURES=record`: le richieste ai due endpoint SPARQL vanno in rete e
 * ogni risposta 200 si salva in `test/fixtures/sparql/<camera|senato>/<sha256(query)>.json`.
 * `SPARQL_FIXTURES=replay`: le risposte si leggono da lì; una fixture mancante
 * è un errore, mai un ripiego sulla rete. Anche le altre richieste (HTML
 * Camera, AKN su GitHub) sono rifiutate: i test che ne hanno bisogno si
 * marcano con `it.skipIf(NET_BLOCKED)` e in replay si saltano.
 * Assente: tutto come prima.
 *
 * La data di registrazione è una sola, in `manifest.json`, e `Date` resta
 * congelata a quella sia in replay sia in record: le query costruite su "oggi"
 * (asOf di default, legislatura corrente) devono dare lo stesso hash in
 * entrambi i modi. Solo `npm run test:record` (registrazione completa) la
 * aggiorna.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { CAMERA_ENDPOINT, SENATO_ENDPOINT } from "./core/endpoints.js";

export type FixtureMode = "record" | "replay";

export const FIXTURES_DIR = resolve(process.cwd(), "test/fixtures/sparql");
export const MANIFEST_PATH = resolve(FIXTURES_DIR, "manifest.json");
export const USED_PATH = resolve(process.cwd(), "tmp/fixtures-used.txt");

export function fixtureMode(): FixtureMode | undefined {
  const v = process.env.SPARQL_FIXTURES;
  if (v === undefined || v === "") return undefined;
  if (v === "record" || v === "replay") return v;
  throw new Error(`SPARQL_FIXTURES="${v}" non valido: usare record o replay`);
}

export function recordedAt(): string {
  if (!existsSync(MANIFEST_PATH)) {
    throw new Error(
      `manca ${MANIFEST_PATH}: lanciare prima una registrazione completa (npm run test:record)`,
    );
  }
  return (JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as { recordedAt: string }).recordedAt;
}

export function fixturePath(endpoint: "camera" | "senato", query: string): string {
  const hash = createHash("sha256").update(query).digest("hex");
  return resolve(FIXTURES_DIR, endpoint, `${hash}.json`);
}

function endpointOf(url: string): "camera" | "senato" | undefined {
  if (url.startsWith(`${CAMERA_ENDPOINT}?`)) return "camera";
  if (url.startsWith(`${SENATO_ENDPOINT}?`)) return "senato";
  return undefined;
}

function urlOf(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

/**
 * Il `fetch` dei test. Si assegna a `globalThis.fetch` direttamente, non con
 * `vi.stubGlobal`: così un test che fa il proprio stub e poi
 * `vi.unstubAllGlobals()` ritrova questo, non quello di rete.
 */
export function fixtureFetch(mode: FixtureMode, realFetch: typeof fetch): typeof fetch {
  let senatoBlocked = false;
  return async (input, init) => {
    const url = urlOf(input);
    const endpoint = endpointOf(url);
    if (!endpoint) {
      if (mode === "replay") {
        throw new Error(
          `SPARQL_FIXTURES=replay: richiesta fuori dalle fixture rifiutata (${url.slice(0, 120)}). Marcare il test con it.skipIf(NET_BLOCKED).`,
        );
      }
      return realFetch(input, init);
    }
    const query = new URL(url).searchParams.get("query") ?? "";
    const path = fixturePath(endpoint, query);

    if (mode === "replay") {
      if (!existsSync(path)) {
        throw new Error(
          `SPARQL_FIXTURES=replay: manca la fixture ${endpoint} per la query che inizia con «${query.replace(/PREFIX\s+\S*\s*<[^>]*>/gi, "").replace(/\s+/g, " ").trim().slice(0, 160)}». Registrarla con SPARQL_FIXTURES=record.`,
        );
      }
      writeFileSync(USED_PATH, `${path}\n`, { flag: "a" });
      const { body } = JSON.parse(readFileSync(path, "utf8")) as { body: unknown };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/sparql-results+json" },
      });
    }

    // record. Dopo un 403 del Senato non si manda più nulla al Senato in
    // questa run: il blocco è per volume, ogni richiesta in più lo allunga.
    if (endpoint === "senato" && senatoBlocked) {
      return new Response("403 già ricevuto in questa run, richiesta non inviata", { status: 403 });
    }
    const res = await realFetch(input, init);
    if (res.status === 403 && endpoint === "senato") senatoBlocked = true;
    if (res.status !== 200) return res;
    const body = await res.json();
    mkdirSync(resolve(FIXTURES_DIR, endpoint), { recursive: true });
    writeFileSync(path, JSON.stringify({ query, body }, null, 1) + "\n");
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/sparql-results+json" },
    });
  };
}

/**
 * Vero in replay. I test che fanno richieste fuori dalle fixture si scrivono
 * `it.skipIf(NET_BLOCKED)(...)`: in replay si saltano, in record e live girano.
 */
export const NET_BLOCKED = fixtureMode() === "replay";
