# Analisi — la specifica MCP 2026-07-28 e questo progetto

Data: 2026-08-09. Il 28 luglio 2026 è uscita `2026-07-28`, la revisione più grande dello standard MCP dal lancio: protocollo stateless, handshake `initialize` rimosso, sessioni abolite, Tasks spostati in extension, tre funzionalità deprecate. Questa nota risponde a una domanda sola: quanto ci riguarda.

> **Errata (stessa giornata).** La prima stesura concludeva che l'adozione non fosse possibile perché «l'SDK TypeScript non parla ancora la nuova specifica», basandosi sul fatto che `@modelcontextprotocol/sdk@1.30.0` dichiara `LATEST_PROTOCOL_VERSION = '2025-11-25'`. Era il pacchetto sbagliato: **la v2 dell'SDK è uscita stabile il 27 luglio 2026 sotto pacchetti scoped nuovi** (`@modelcontextprotocol/server`, `/client`, `/core`, più gli adapter `/node`, `/hono`, `/express`, `/fastify`), e `@modelcontextprotocol/sdk` è rimasto il nome della sola linea v1. Il verdetto sostanziale non cambia — l'impatto sul nostro dominio applicativo resta minimo — ma la ragione sì: **si può fare oggi**, ed è una migrazione di piattaforma, non un'attesa.

## Verdetto

Due affermazioni distinte, da non confondere.

**Sul nostro codice l'impatto è minimo**, e non per fortuna: la rottura portante di `2026-07-28` è rendere MCP stateless — via le sessioni, via `Mcp-Session-Id`, via l'handshake — e il nostro Worker è nato stateless (`sessionIdGenerator: undefined`, un server istanziato per richiesta, nessuno store condiviso, nessuna sticky routing). Il lavoro che la specifica impone a chi ha costruito su sessioni qui non esiste. Analogamente, la superficie che usiamo è la più stretta possibile — solo `tools`, nessuna auth — e quindi tocca quasi nulla di ciò che è cambiato.

**Sulla piattaforma, invece, c'è un lavoro reale**: passare da `@modelcontextprotocol/sdk` (v1) ai pacchetti v2. Non è obbligatorio subito, ma è la linea su cui lo sviluppo prosegue, e prima si fa meno costa.

## I due passi, distinti

Il repo dell'SDK li tiene separati, e conviene tenerli separati anche qui.

**Passo 1 — v1 → v2** (`docs/migration/upgrade-to-v2.md`). Esiste un codemod ufficiale:

```bash
npx @modelcontextprotocol/codemod@latest v1-to-v2 .
```

Riscrive gli import, le dipendenze in `package.json`, i rename di simboli (`McpError` → `ProtocolError`), e marca con `@mcp-codemod-error` ciò che non sa risolvere. Per noi i punti che contano:

- `registerTool` **resta** la API di registrazione: il lavoro appena fatto su `title` e `annotations` sopravvive alla migrazione.
- Il Worker usa `WebStandardStreamableHTTPServerTransport`, che in v2 vive in `@modelcontextprotocol/server` — è un cambio di import, non di architettura. La guida lo dice esplicitamente: chi riceve un `Request` web-standard e restituisce una `Response` (Cloudflare Workers, Deno, Bun) usa `@modelcontextprotocol/server`; chi maneggia `IncomingMessage`/`ServerResponse` usa `@modelcontextprotocol/node`.
- Prerequisito Node 20+. v2 è ESM-first ma pubblica anche CommonJS, quindi il bundle `.mcpb` (che gira CJS) non è un ostacolo.

**Passo 2 — adottare `2026-07-28`** (`docs/migration/support-2026-07-28.md`). Da valutare dopo, con il passo 1 in produzione.

## Cambiamento per cambiamento

| Novità `2026-07-28` | Impatto qui | Perché |
|---|---|---|
| Sessioni e `Mcp-Session-Id` rimossi (SEP-2567) | **nullo** | Il Worker è già stateless per costruzione |
| Handshake `initialize` rimosso, `_meta` per richiesta (SEP-2575) | **a carico dell'SDK** | Nessuna riga applicativa nostra tocca il lifecycle |
| `server/discover` obbligatorio | **a carico dell'SDK** | Idem |
| `resultType` obbligatorio (SEP-2322) | **a carico dell'SDK** | I nostri handler restituiscono `content`, non il risultato JSON-RPC |
| Header `Mcp-Method` / `Mcp-Name` (SEP-2243) | **nullo** | Li impone il client |
| Multi Round-Trip Requests | **nullo** | Nessun tool chiede input a metà strada |
| Tasks spostati in extension (SEP-2663) | **nullo oggi** | Non li usiamo. Unica ipotesi futura, sotto |
| Roots, Sampling, Logging deprecati (SEP-2577) | **nullo** | Il server espone solo `tools` |
| Trasporto HTTP+SSE legacy deprecato (SEP-2596) | **nullo** | Usiamo Streamable HTTP, che è quello che resta |
| Autorizzazione (CIMD, DCR deprecata, XAA, `iss`, scope) | **nullo** | Server authless su dati pubblici |
| `ttlMs` / `cacheScope` su `tools/list` (SEP-2549) | **da prendere col passo 2** | Vedi sotto |
| Ordine deterministico di `tools/list` | **già conforme** | Il loop di `registerAll` itera un array statico |
| Formato dei nomi dei tool (SEP-986) | **già conforme** | 0 nomi su 43 fuori dai caratteri ammessi; il più lungo, `senator-group-members`, sta a 21 caratteri su 64. I trattini sono esplicitamente ammessi |

## Le tre cose che valgono qualcosa

**1. `icons` sui tool — fattibile subito, anche restando su v1.** È della `2025-11-25` (SEP-973), che l'SDK attuale già parla. Non cambia il comportamento, migliora come il server si presenta nei client e nella scheda di Directory.

**2. `ttlMs` / `cacheScope` su `tools/list` — con il passo 2.** La nostra lista di 43 tool è statica fra un deploy e l'altro: è il caso da manuale per un TTL generoso con `cacheScope: "public"`, che risparmierebbe traffico a ogni client.

**3. Tasks — solo come ipotesi.** Alcune query SPARQL pesanti sfiorano la pazienza dei client, e «chiama ora, risultato dopo» sarebbe la risposta protocollare giusta. Ma sono passati da sperimentali nel core a extension `io.modelcontextprotocol/tasks`, e un'extension serve a poco finché i client non la implementano.

## Cosa non fare

- **Non implementare `2026-07-28` a mano.** Scrivere `server/discover`, `_meta` per richiesta e `resultType` aggirando l'SDK significa riscrivere un livello che v2 dà già fatto.
- **Non fare i due passi insieme.** Prima v1 → v2 con la stessa specifica di adesso, verificando che i 43 tool rispondano come prima; poi, separatamente, l'adozione della nuova revisione.
- **Non allarmarsi per le deprecazioni.** La specifica introduce una politica formale che garantisce almeno dodici mesi prima di ogni rimozione, e nessuna delle funzionalità deprecate è usata qui.

## Fonti

- [Changelog `2026-07-28`](https://modelcontextprotocol.io/specification/2026-07-28/changelog) e [annuncio dei maintainer](https://blog.modelcontextprotocol.io/posts/2026-07-28/)
- [Guida di migrazione v1 → v2](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/migration/upgrade-to-v2.md) e [adozione della 2026-07-28](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/migration/support-2026-07-28.md)
- [SEP-986, formato dei nomi dei tool](https://modelcontextprotocol.io/seps/986-specify-format-for-tool-names)
- Verifiche locali: release del repo `modelcontextprotocol/typescript-sdk`, `npm view` sui pacchetti v2 (tutti `2.0.0`, 27 luglio 2026), contenuto di `@modelcontextprotocol/core@2.0.0`, `tools/list` sul server locale e sul Worker
