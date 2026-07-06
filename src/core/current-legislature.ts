import { cdQuery } from "./client.js";
import { flattenBindings } from "./flatten.js";

/**
 * Numero della legislatura corrente, ricavato dinamicamente dall'endpoint
 * Camera (l'ultima legislatura "repubblica_*" per dc:date). Hardcodare 19 si
 * romperebbe alla prima legislatura successiva.
 *
 * Cache in-memory per la durata del processo: un valore che cambia una volta
 * ogni ~5 anni non va ribuscato a ogni chiamata. Se la query fallisce, si
 * ripiega su CURRENT_LEGISLATURE_FALLBACK con un warning su stderr (la CLI non
 * deve bloccarsi per un problema transitorio dell'endpoint).
 */

export const CURRENT_LEGISLATURE_FALLBACK = 19;

let cached: number | undefined;
let inflight: Promise<number> | undefined;

export async function currentLegislature(): Promise<number> {
  if (cached !== undefined) return cached;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const query = `PREFIX ocd: <http://dati.camera.it/ocd/>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
SELECT ?s WHERE {
  ?s a ocd:legislatura .
  ?s dc:date ?d .
  FILTER(CONTAINS(STR(?s), "repubblica_"))
}
ORDER BY DESC(?d)
LIMIT 1`;
      const results = await cdQuery(query);
      const raw = flattenBindings(results);
      const uri = raw[0]?.s ?? "";
      const m = uri.match(/repubblica_(\d+)$/);
      const n = m ? Number(m[1]) : NaN;
      if (Number.isInteger(n) && n > 0) {
        cached = n;
        return n;
      }
      process.stderr.write(
        `warning: currentLegislature: risposta SPARQL non interpretabile (${uri || "vuota"}); uso il fallback ${CURRENT_LEGISLATURE_FALLBACK}\n`,
      );
      return CURRENT_LEGISLATURE_FALLBACK;
    } catch (e) {
      process.stderr.write(
        `warning: currentLegislature: query fallita (${e instanceof Error ? e.message : String(e)}); uso il fallback ${CURRENT_LEGISLATURE_FALLBACK}\n`,
      );
      return CURRENT_LEGISLATURE_FALLBACK;
    } finally {
      inflight = undefined;
    }
  })();

  return inflight;
}
