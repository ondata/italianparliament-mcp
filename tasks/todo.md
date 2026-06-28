# italianparliament-mcp — stato lavori

Porting di `italyParlR_cli` (R) in TypeScript, con un unico core che alimenta CLI, MCP stdio server e (futuro) Cloudflare Worker.

## Decisioni di progetto

- **Stack**: TypeScript/Node, template architetturale `ckan-mcp-server`
- **CLI lib**: `citty`
- **HTTP client**: `axios`
- **MCP SDK**: `@modelcontextprotocol/sdk`
- **Validation / schema**: `zod`
- **Licenza**: MIT
- **Distribuzione prevista**: npm + skill Claude (`pack:skill`) + pacchetto `.dxt` Claude Desktop
- **Output parity con la versione R**: no, libertà di design TS (colonne rinominabili, purché semanticamente corretto)
- **Paradigma CLI**: agent-friendly non negoziabile (non-interattivo, flag per tutto, `--help` con `Examples:`, errori actionable, output machine-readable, niente emoji/decorazioni)

## Fase 0 — Setup repo ✅

- [x] Directory `/home/aborruso/git/idee/italianparliament-mcp` + `git init`
- [x] `package.json` (type: module, due bin: `italianparliament` CLI + `italianparliament-mcp` stdio)
- [x] `tsconfig.json` strict
- [x] `.gitignore`, `LICENSE` MIT, `README.md` stub, `LOG.md`
- [x] Struttura `src/core/`, `src/tools/`
- [x] `npm install`

## Fase 1 — Core SPARQL ✅

- [x] `src/core/endpoints.ts` — `CAMERA_ENDPOINT` (https://dati.camera.it/sparql), `SENATO_ENDPOINT` (https://dati.senato.it/sparql), timeout/retry defaults
- [x] `src/core/prefixes.ts` — `OCD_PREFIXES`, `OSR_PREFIXES`
- [x] `src/core/types.ts` — `SparqlBindingValue`, `SparqlBinding`, `SparqlResults`, `Row`
- [x] `src/core/client.ts` — `cdQuery`/`snQuery` con axios, retry backoff, classe `SparqlError`
- [x] `src/core/flatten.ts` — `flattenBindings(results)`
- [x] `src/core/format.ts` — `toCsv` (RFC 4180), `toJsonl`, `formatRows`
- [x] `src/core/index.ts` — barrel export
- [x] Test vitest: 10/10 verdi (flatten + format)
- [x] Type check pulito
- [x] Smoke test reale contro Camera SPARQL

### Fix critici scoperti

1. **Endpoint Senato è passato a HTTPS** (il vecchio `http://dati.senato.it/sparql` del pacchetto R redirige via CloudFront e il redirect mangia le `{}` della query SPARQL)
2. **Response format**: usare `format=application/json` + `Accept: application/json` (il vecchio `application/sparql-results+json` → 406 Not Acceptable su Senato)
3. **User-Agent custom obbligatorio su Senato** (default axios → 403 CloudFront con pagina HTML)

## Fase 2 — MVP 5 tool ✅

Ogni tool è un file in `src/tools/<nome>.ts` che esporta schema Zod input + description + `examples` + `execute(input) → { rows, columns }`. Stessa struttura riusata da CLI, MCP stdio e (futuro) Worker.

- [x] `deputies` — Camera, filtro legislatura (16 colonne)
- [x] `senators` — Senato, filtri legislatura + activeOnly (14 colonne)
- [x] `bills` — Camera, filtri legislatura + type (case-insensitive)
- [x] `votes` — Camera, filtri legislatura + approved, con mapping booleani
- [x] `search` — dual-endpoint Camera/Senato/both, output unificato con colonna `chamber`
- [x] `types.ts` — interfaccia `Tool` condivisa
- [x] `index.ts` — barrel + `toolsByName`
- [x] Smoke test end-to-end reali verdi

## Fase 3 — Entrypoint CLI ✅

- [x] `src/cli.ts` con `citty`
- [x] Pattern `italianparliament <resource> <verb>`: `deputies list`, `senators list`, `bills list`, `votes list`, `search find`
- [x] `--help` per ogni subcommand con sezione `Examples:` (3 invocazioni copiabili)
- [x] `--format csv|jsonl` (default csv, machine-readable)
- [x] Errori fail-fast actionable (`parseIntFlag`, `parseFormat`, chamber enum)
- [x] Required flag validation via citty
- [x] Top-level catch per `SparqlError` con endpoint/status
- [x] Smoke test CLI reali: deputies/senators/search + error cases

## Fase 4 — Entrypoint MCP stdio ✅

- [x] `src/index.ts` con `McpServer` + `StdioServerTransport`
- [x] Registrazione esplicita dei 5 tool (loop generico causava TS2589)
- [x] `inputSchema` = Zod shape → JSON Schema auto-generato dall'SDK
- [x] Handler con catch per `SparqlError` → `isError: true`
- [x] Test stdio reali: `initialize` + `tools/list` + `tools/call search` verdi end-to-end
- [ ] Registrazione manuale in Claude Code / Claude Desktop (compito utente, dopo `npm run build`)

## Fase 5 — Cloudflare Worker ⏳ (da fare)

- [ ] `src/worker.ts` — MCP HTTP server, clonare pattern da `ckan-mcp-server/src/worker.ts`
- [ ] `wrangler.toml`
- [ ] Verificare che il bundle browser-compatible usi `fetch` al posto di axios (axios non gira su Workers), oppure `undici`/`ofetch`
- [ ] Script `build:worker` è già in `package.json`; aggiungere `deploy`
- [ ] Deploy test su `workers.dev`

## Fase 6 — Porting comandi rimanenti ⏳ (da fare)

19 comandi dalla CLI R da portare, mantenendo nomi e semantica argomenti per continuità. Ogni comando = un file in `src/tools/` con schema Zod + execute, più subcommand in `src/cli.ts`, più registrazione in `src/index.ts`.

- [x] `groups` — gruppi parlamentari Camera
- [x] `sessions` — sedute Camera con filtro date
- [x] `governments` — governi
- [x] `legislatures` — elenco legislature
- [x] `senator` — dettaglio singolo senatore (property/value)
- [x] `deputy` — dettaglio singolo deputato (property/value, --uri o --id+--legislature)
- [x] `bill` — dettaglio singolo atto Camera (property/value)
- [x] `roles` — incarichi parlamentari Camera (filtri deputy/group/legislature)
- [x] `speeches` — interventi in aula
- [x] `aic` — atti di indirizzo e controllo
- [x] `vote-detail` — voto individuale per ogni deputato in una votazione
- [x] `group-members` — membri di un gruppo parlamentare
- [x] `committees` — commissioni Senato
- [x] `bill-progress` — iter legislativo DDL Senato
- [x] `bill-signatories` — firmatari DDL Senato
- [x] `amendments` — emendamenti Senato
- [x] `documents` — Camera ha 0 istanze; implementato da Senato `osr:Documento` (48K)
- [x] `gov-members` — membri del governo con ricerca per nome

Nota: nella versione R alcuni endpoint Camera risultano vuoti (`roles`, `speeches` cd, `vote-detail`) per limiti dei dati; il bug upstream `bill-signatories` di `italyParlR` qui non si applica, riscriviamo la query da zero.

## Fase 7 — Distribuzione ⏳ (da fare)

- [ ] `README.md` completo con esempi verificati e sezione MCP setup
- [ ] Pubblicazione su npm come `@aborruso/italianparliament-mcp`
- [ ] Pacchetto `.dxt` per Claude Desktop (clonare `build:dxt` + `pack:dxt` da ckan-mcp-server, serve `manifest.json`)
- [ ] Skill Claude via `pack:skill` (serve directory `skills/italianparliament-mcp/SKILL.md`)
- [ ] Workflow CI (opzionale)

## Cose da NON dimenticare

- Primo commit git ancora da fare (tutto untracked nel repo)
- La dipendenza `axios` non gira sui Cloudflare Workers: per Fase 5 servirà `fetch` o `ofetch`
- Il `User-Agent` custom nel client (`italianparliament-mcp/0.0.1`) è necessario per evitare 403 su Senato — non rimuoverlo
- `SENATO_ENDPOINT` deve restare HTTPS, mai tornare a `http://`
- Response format `application/json` in query string + `Accept: application/json` in header, mai `application/sparql-results+json` (rompe il Senato)

## Metriche correnti

- File sorgente: `src/core/` (7 file), `src/tools/` (16 file), `src/cli.ts`, `src/index.ts`
- Tool implementati: **23** (tutti completati)
- Test: **10/10** vitest verdi
- Type check: pulito
- Smoke test reali verdi su entrambi gli endpoint + CLI + MCP stdio

---

## Task 2026-06-28 — Link al testo dei DDL (+ spunti printing-press)

### Scoperte verificate
- Testo integrale DDL NON nei dati SPARQL (solo metadati + URN `osr:testoPresentato`).
- Senato www.senato.it: anti-bot Akamai → fetch server-side = HTTP 202, 0 byte. Camera www.camera.it: HTTP 200.
- Pattern URL testo Senato (Wayback + dati): `https://www.senato.it/leg/{LEG}/BGT/Schede/Ddliter/testi/{N}_testi.htm`, `{N}` = numero in `dati.senato.it/ddl/{N}` (non idDdl). Solo se esiste `osr:testoPresentato`.
- printing-press library reale: `/home/aborruso/printing-press/library` (giustizia-amministrativa, ars-sicilia...). Pattern HTML→Markdown in `giustizia-amministrativa/internal/gaclient/markdown.go`.

### Fase 1 — Tool `bill-text` (link + tipo) ✅
- [x] `bill-text` (MCP+CLI+Worker): input `uri`, autodetect Camera/Senato. Output `chamber, kind, format(html|pdf|urn|cli), auth(none|browser|cli-locale), url, description`.
- [x] Senato: testi (html), fascicolo (pdf), scheda (html), urn (se testoPresentato), riga "come-scaricare" con comando CLI + prerequisiti. Camera: scheda (html), riferimento (html).
- [x] Registrato in MCP (`server.ts`, anche `member-bills` che mancava), barrel, CLI `bill-text links`. Tot MCP: 31.
- [x] Testato su Senato (S.596) + Camera. README + LOG + skill aggiornati.

### Fase 2 — `bill-text fetch` (testo vero Senato) ✅
- [x] Browser-sniff: confermato che `www.senato.it` è dietro AWS WAF; testo recuperabile con cookie `aws-waf-token` da browser reale.
- [x] `src/core/fetch-text.ts`: agent-browser (token+UA) → scrape `<ol class="schede">` → download PDF per-testo (o `--fascicolo`) → `lit` → markdown. Pulizia `&shy;`. Token preso fresco a ogni run. Check dipendenze con errori azionabili.
- [x] CLI `bill-text fetch --did N [--which|--all|--fascicolo|--out]`. Testato end-to-end su S.596 (articolato art.19 L.157/92). Test unitario `parseTextList`.

### Note
- `bill-text fetch` è CLI-only (no Worker: serve un browser). L'utente MCP è guidato via la riga "come-scaricare" nell'output del tool.
- Camera: il testo è sulla pagina (no WAF) ma l'estrazione automatica Camera non è stata implementata (solo link). Eventuale Fase 3.
