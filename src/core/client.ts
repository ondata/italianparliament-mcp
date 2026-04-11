import axios, { AxiosError } from "axios";
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
      const res = await axios.get<SparqlResults>(endpoint, {
        params: { query, format: "application/json" },
        headers: {
          Accept: "application/json",
          "User-Agent": "italianparliament-mcp/0.0.1",
        },
        timeout: timeoutMs,
        responseType: "json",
      });
      return res.data;
    } catch (err) {
      lastErr = err;
      const ax = err as AxiosError;
      const status = ax.response?.status;
      if (status && status >= 400 && status < 500 && status !== 429) {
        throw new SparqlError(
          `SPARQL request failed with status ${status}`,
          endpoint,
          status,
          err,
        );
      }
      if (attempt === maxRetries) break;
      await new Promise((r) => setTimeout(r, 500 * attempt));
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
