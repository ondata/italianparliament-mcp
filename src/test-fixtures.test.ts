import { describe, it, expect } from "vitest";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

// Una fixture mancante va registrata anche quando il chiamante intercetta
// l'errore e prosegue (es. withGroups che lascia i gruppi vuoti): è da qui che
// `scripts/fixtures.mjs check` fa fallire la replay (#120, rilievo Greptile).
describe("fixtureFetch in replay: la fixture mancante resta registrata", () => {
  it("anche se l'errore viene intercettato, la richiesta finisce nell'elenco delle mancanti", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fixtures-"));
    const logs = { used: join(dir, "used.txt"), missing: join(dir, "missing.txt") };
    const noNet = (async () => {
      throw new Error("la replay non deve andare in rete");
    }) as typeof fetch;
    const f = fixtureFetch("replay", noNet, logs);
    const query = "SELECT ?mai_registrata WHERE { ?s ?p ?o } # test-fixtures.test.ts";
    const swallowed = await f(`${SENATO_ENDPOINT}?query=${encodeURIComponent(query)}`).then(
      () => "risolta",
      () => "intercettata",
    );
    expect(swallowed).toBe("intercettata");
    expect(readFileSync(logs.missing, "utf8")).toContain("?mai_registrata");
    expect(existsSync(logs.used)).toBe(false);
  });
});
