# Analisi — la specifica MCP 2026-07-28 e questo progetto

Data: 2026-08-09. Il 28 luglio 2026 è uscita `2026-07-28`, la revisione più grande dello standard MCP dal lancio: protocollo stateless, handshake `initialize` rimosso, sessioni abolite, Tasks spostati in extension, tre funzionalità deprecate. Questa nota risponde a una domanda sola: quanto ci riguarda.

## Verdetto

**Quasi per niente, e comunque non oggi.** Due ragioni indipendenti, ciascuna sufficiente.

La prima è che l'SDK TypeScript ufficiale **non parla ancora la nuova specifica**. Verificato sul pacchetto pubblicato, non dedotto: `@modelcontextprotocol/sdk@1.30.0` (27 luglio 2026, l'ultima, nessun tag `next` o `beta`) ha `LATEST_PROTOCOL_VERSION = '2025-11-25'`. Il blog dei maintainer annuncia che i quattro SDK Tier 1 parlano `2026-07-28` dal giorno della pubblicazione; su npm, per TypeScript, questo non è ancora vero. Finché non lo è, l'adozione non è una scelta ma un'attesa.

La seconda è che **la rottura più grossa della specifica è quella che questo progetto ha già scavalcato per costruzione**. Il cambiamento portante di `2026-07-28` è rendere MCP stateless: via le sessioni, via l'header `Mcp-Session-Id`, via l'handshake. Il nostro Worker è nato stateless — `new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined })`, un server istanziato per richiesta, nessuno store condiviso, nessuna sticky routing. Il lavoro di migrazione che la nuova specifica impone a chi ha costruito su sessioni qui non esiste.

## Cambiamento per cambiamento

| Novità `2026-07-28` | Impatto qui | Perché |
|---|---|---|
| Sessioni e `Mcp-Session-Id` rimossi (SEP-2567) | **nullo** | Il Worker è già stateless per costruzione |
| Handshake `initialize` rimosso, `_meta` per richiesta (SEP-2575) | **nullo, a carico dell'SDK** | Nessuna riga applicativa nostra tocca il lifecycle |
| `server/discover` obbligatorio | **nullo, a carico dell'SDK** | Idem |
| `resultType` obbligatorio su ogni risultato (SEP-2322) | **nullo, a carico dell'SDK** | I nostri handler restituiscono `content`, non il risultato JSON-RPC |
| Header `Mcp-Method` / `Mcp-Name` (SEP-2243) | **nullo** | Li impone il client; semmai è il nostro Worker a poterli usare per instradare, non oggi |
| Multi Round-Trip Requests | **nullo** | Nessun tool chiede input a metà strada |
| Tasks spostati in extension (SEP-2663) | **nullo oggi** | Non li usiamo. Vedi sotto, unica ipotesi futura |
| Roots, Sampling, Logging deprecati (SEP-2577) | **nullo** | Non ne usiamo nessuno: il server espone solo `tools` |
| Trasporto HTTP+SSE legacy deprecato (SEP-2596) | **nullo** | Usiamo Streamable HTTP, che è quello che resta |
| Tutto il capitolo autorizzazione (CIMD, DCR deprecata, XAA, `iss`, scope) | **nullo** | Server authless: dati pubblici, nessuna autenticazione |
| `ttlMs` / `cacheScope` su `tools/list` (SEP-2549) | **utile, non attuabile** | Vedi sotto |
| Ordine deterministico di `tools/list` | **già conforme** | Il loop di `registerAll` itera un array statico |
| Formato dei nomi dei tool (SEP-986) | **già conforme** | Verificato: 0 nomi su 43 fuori dai caratteri ammessi, il più lungo è `senator-group-members` con 21 caratteri su 64 (o 128) consentiti. I trattini sono esplicitamente ammessi |

## Le uniche tre cose che valgono qualcosa

**1. `icons` sui tool — fattibile subito.** È della `2025-11-25` (SEP-973), cioè della specifica che il nostro SDK già parla. Ogni tool può esporre `icons` accanto a `name`, `title` e `description`. Non cambia nulla nel comportamento, migliora come il server si presenta nei client e nella scheda di Directory. Costo basso, valore cosmetico ma reale in un contesto dove la scheda è la vetrina.

**2. `ttlMs` / `cacheScope` su `tools/list` — da tenere in lista, non ora.** È il cambiamento della `2026-07-28` che ci gioverebbe davvero: la nostra lista di 43 tool è statica fra un deploy e l'altro, quindi un TTL generoso con `cacheScope: "public"` risparmierebbe traffico a ogni client. Richiede l'SDK aggiornato: se ne riparla quando esce.

**3. Tasks, solo come ipotesi.** Alcune query SPARQL pesanti sfiorano il limite di pazienza dei client. I Tasks — chiamata ora, risultato dopo — sarebbero la risposta protocollare giusta. Ma sono passati da sperimentali nel core a extension `io.modelcontextprotocol/tasks`, e un'extension serve a poco finché i client non la implementano. Da riguardare fra sei mesi, non prima.

## Cosa non fare

- **Non inseguire `2026-07-28` a mano.** Implementare `server/discover`, `_meta` per richiesta e `resultType` aggirando l'SDK significa riscrivere il livello di protocollo che oggi non ci costa niente, per poi buttarlo quando l'SDK arriva.
- **Non allarmarsi per le deprecazioni.** La specifica introduce una politica formale che garantisce almeno dodici mesi prima di ogni rimozione, e nessuna delle funzionalità deprecate è usata qui.
- **Non alzare il floor dell'SDK senza motivo.** `package.json` chiede `^1.27.1`, in locale gira 1.29.0, l'ultima è 1.30.0: tutte parlano `2025-11-25`. L'aggiornamento è ordinaria manutenzione, non una migrazione.

## Quando riguardare

Quando `@modelcontextprotocol/sdk` pubblica una versione con `LATEST_PROTOCOL_VERSION = '2026-07-28'`. Il controllo è una riga:

```bash
curl -s "https://unpkg.com/@modelcontextprotocol/sdk@latest/dist/esm/types.js" | grep -m1 LATEST_PROTOCOL_VERSION
```

A quel punto l'aggiornamento sarà, con ogni probabilità, un bump di dipendenza e una rilettura di questa tabella — non un progetto.

## Fonti

- [Changelog `2026-07-28`](https://modelcontextprotocol.io/specification/2026-07-28/changelog) e [annuncio dei maintainer](https://blog.modelcontextprotocol.io/posts/2026-07-28/)
- [Changelog `2025-11-25`](https://modelcontextprotocol.io/specification/2025-11-25/changelog)
- [SEP-986, formato dei nomi dei tool](https://modelcontextprotocol.io/seps/986-specify-format-for-tool-names)
- Verifiche locali: `npm view @modelcontextprotocol/sdk dist-tags`, `LATEST_PROTOCOL_VERSION` in 1.29.0 e 1.30.0, `tools/list` sul server locale e sul Worker
