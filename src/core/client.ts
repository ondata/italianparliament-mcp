import {
  CAMERA_ENDPOINT,
  SENATO_ENDPOINT,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_MAX_RETRIES,
} from "./endpoints.js";
import type { SparqlResults } from "./types.js";

export class SparqlError extends Error {
  constructor(
    message: string,
    public readonly endpoint: string,
    public readonly status?: number,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "SparqlError";
  }
}

async function sparqlRequest(
  endpoint: string,
  query: string,
  timeoutMs: number,
  maxRetries: number,
): Promise<SparqlResults> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const params = new URLSearchParams({
        query,
        format: "application/json",
      });
      const url = `${endpoint}?${params.toString()}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      let res: Response;
      try {
        res = await fetch(url, {
          method: "GET",
          headers: {
            Accept: "application/json",
            "User-Agent": "italianparliament-mcp/0.18.0",
          },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }
      if (!res.ok) {
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          throw new SparqlError(
            `SPARQL request failed with status ${res.status}`,
            endpoint,
            res.status,
          );
        }
        throw new Error(`HTTP ${res.status}`);
      }
      return (await res.json()) as SparqlResults;
    } catch (err) {
      if (err instanceof SparqlError) throw err;
      lastErr = err;
      if (attempt === maxRetries) break;
      // Backoff esponenziale con tetto a 2s: 250, 500, 1000, 2000ms (~4s totali
      // su 5 tentativi) per superare i flap transitori dell'endpoint Camera.
      const delayMs = Math.min(2000, 250 * 2 ** (attempt - 1));
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new SparqlError(
    `SPARQL request failed after ${maxRetries} attempts`,
    endpoint,
    undefined,
    lastErr,
  );
}

export function cdQuery(
  query: string,
  opts: { timeoutMs?: number; maxRetries?: number } = {},
): Promise<SparqlResults> {
  return sparqlRequest(
    CAMERA_ENDPOINT,
    query,
    opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    opts.maxRetries ?? DEFAULT_MAX_RETRIES,
  );
}

export function snQuery(
  query: string,
  opts: { timeoutMs?: number; maxRetries?: number } = {},
): Promise<SparqlResults> {
  return sparqlRequest(
    SENATO_ENDPOINT,
    query,
    opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    opts.maxRetries ?? DEFAULT_MAX_RETRIES,
  );
}
