import { describe, it, expect } from "vitest";
import { fixtureFetch } from "./test-fixtures.js";
import { CAMERA_ENDPOINT, SENATO_ENDPOINT } from "./core/endpoints.js";

// Il Senato blocca l'IP per volume totale: in record, dopo il primo 403 non gli
// si manda più nulla nella stessa run (#117). Fetch finto, zero rete; solo
// risposte 403, quindi nessuna fixture scritta.
describe("fixtureFetch in record: stop dopo un 403 del Senato", () => {
  it("dopo un 403 il Senato non riceve altre richieste, la Camera sì", async () => {
    const seen: string[] = [];
    const fake = (async (input: Parameters<typeof fetch>[0]) => {
      const url = String(input);
      seen.push(url.startsWith(SENATO_ENDPOINT) ? "senato" : "camera");
      return new Response("blocked", { status: 403 });
    }) as typeof fetch;
    const f = fixtureFetch("record", fake);
    const senato = `${SENATO_ENDPOINT}?query=${encodeURIComponent("SELECT ?a WHERE {}")}`;
    const camera = `${CAMERA_ENDPOINT}?query=${encodeURIComponent("SELECT ?b WHERE {}")}`;

    expect((await f(senato)).status).toBe(403);
    expect((await f(senato)).status).toBe(403);
    expect((await f(camera)).status).toBe(403);
    expect(seen).toEqual(["senato", "camera"]);
  });
});
