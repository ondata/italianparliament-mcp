# LOG

## 2026-04-11

- Repo creato. Fase 0 completata.
- Struttura: `src/core/`, `src/tools/`, entrypoint previsti `src/cli.ts`, `src/index.ts`, `src/worker.ts`.
- Stack: TypeScript + citty + axios + zod + @modelcontextprotocol/sdk.
- Scripts `package.json` clonati da `ckan-mcp-server`: build (esbuild cli+index), build:worker, build:dxt, pack:skill, deploy.
- Paradigma vincolante: CLI agent-friendly (non-interattiva, flag+stdin, errori actionable, output machine-readable, no emoji).
- Naming CLI: `italianparliament <resource> <verb>`.
- Fase 1 COMPLETATA: `src/core/` con `endpoints.ts`, `prefixes.ts` (OCD/OSR copiati da italyParlR), `types.ts` (SparqlResults, Row), `flatten.ts` (flattenBindings), `client.ts` (cdQuery/snQuery con axios, retry, SparqlError), `format.ts` (toCsv/toJsonl), `index.ts` barrel.
- Endpoint: Camera `https://dati.camera.it/sparql`, Senato `http://dati.senato.it/sparql`. Timeout 60s, retry 3.
- Test vitest: 10/10 passati (flatten + format). Type check pulito.
- Smoke test reale contro Camera SPARQL (SELECT ?s ?label WHERE Person LIMIT 3) → OK end-to-end.
- Fase 2 COMPLETATA: 5 tool MVP in `src/tools/` (deputies, senators, bills, votes, search) + `types.ts` (Tool interface con name, description, inputSchema Zod, examples, execute) + `index.ts` (barrel + toolsByName).
- Ogni tool: schema Zod per input, lista `columns` per output stabile, `execute()` che chiama cdQuery/snQuery → flattenBindings → riga rinominata secondo naming coerente (uri invece di s, legislature_uri invece di rif_leg, in_favour/against/abstentions per i voti, ecc.).
- Fix importanti scoperti durante smoke test:
  - Endpoint Senato aggiornato a HTTPS (il vecchio http://dati.senato.it/sparql redirige e il redirect mangia le `{}` della query).
  - Formato response: `format=application/json` + `Accept: application/json` (il vecchio `application/sparql-results+json` restituisce 406 su Senato).
  - `User-Agent` custom obbligatorio su Senato (default axios → 403 CloudFront).
- Smoke test reale verde su Camera (deputies leg 19), Senato (senators leg 19), search (Camera "meloni"). 10/10 vitest ancora verdi, type check pulito.
- Fase 3 COMPLETATA: `src/cli.ts` con citty. Pattern `italianparliament <resource> <verb>`: `deputies list`, `senators list`, `bills list`, `votes list`, `search find`. `--help` per ogni subcommand include sezione Examples con invocazioni copiabili. `--format csv|jsonl` su tutti (default csv, machine-readable, no colori/emoji). Errori fail-fast: `--limit abc` → "Invalid --limit value. Expected a positive integer", argomento required mancante → citty mostra help + errore. Catch top-level gestisce `SparqlError` con endpoint/status.
- Test reali verdi: deputies, senators, search, jsonl output, error handling.
- Fase 4 COMPLETATA: `src/index.ts` — MCP stdio server con @modelcontextprotocol/sdk. `McpServer` + `StdioServerTransport`. Registrazione esplicita (non loop) dei 5 tool via `registerTool(name, {description, inputSchema: tool.inputSchema.shape}, handler)`. Helper `makeHandler` generic per catturare SparqlError/Error e restituire `isError: true`. Output in formato JSONL via `toJsonl`.
- Nota TS2589: il loop generico su `tools[]` generava "Type instantiation is excessively deep". Fix: chiamate registerTool esplicite per ogni tool.
- Test stdio end-to-end: initialize + tools/list → 5 tool con JSON Schema completo da Zod (properties, required, default, enum). tools/call `search {name:"meloni",chamber:"camera",limit:2}` → 2 righe JSONL da Camera SPARQL reale.
- Prossimo: Fase 5 — Cloudflare Worker (`src/worker.ts` con MCP HTTP server clonando pattern da ckan-mcp-server).
