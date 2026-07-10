# Istruzioni Copilot — italianparliament-mcp

## Cos'è il progetto

Server MCP + CLI in TypeScript per interrogare i dati aperti del Parlamento italiano: Camera dei Deputati (`dati.camera.it`) e Senato della Repubblica (`dati.senato.it`), entrambi endpoint SPARQL Virtuoso. Un singolo codice espone ogni funzionalità sia come tool MCP sia come subcommand CLI; il deploy remoto è un Cloudflare Worker. Il pubblico primario sono i giornalisti parlamentari, non gli sviluppatori: la correttezza e la non-confabulazione dei dati vengono prima di ogni altra cosa.

## Stack e comandi

- **Linguaggio**: TypeScript (ESM), Node. Schema input con `zod`, CLI con `citty`, server con `@modelcontextprotocol/sdk`.
- **Build**: `npm run build` (esbuild bundle). Worker: `npm run deploy` (wrangler).
- **Type check**: `NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit`. Il flag di heap è **obbligatorio**: senza, `tsc` va in OOM per la type inference dell'MCP SDK. Il type check deve restare pulito.
- **Test**: `npm test -- --run`. Il flag `--run` è **obbligatorio**: senza, `vitest` resta in watch mode e blocca. I test sono di integrazione, colpiscono gli endpoint SPARQL reali (lenti, timeout 30s per test): una modifica a una query va sempre validata anche dal vivo, non solo compilata.

## Architettura

- `src/tools/<nome>.ts` — un file per tool. Ognuno esporta un oggetto `Tool` con `name`, `description`, `inputSchema` (zod), `examples`, opzionale `emptyHint`, e `execute()`. Le trappole SPARQL specifiche di questi file sono in `.github/instructions/tools.instructions.md`.
- `src/core/` — client SPARQL, prefissi, flatten dei binding, helper di decodifica/normalizzazione riusabili.
- `src/cli.ts`, `src/server.ts`, `src/worker.ts` — i tre entrypoint (CLI, MCP stdio, Worker) che registrano gli stessi tool.

## Regole di design dei tool

- **CLI e MCP sempre allineati**: ogni tool deve avere sia il subcommand CLI sia la registrazione MCP, e vanno testati entrambi. Non aggiungere un tool o un flag a un solo lato.
- **Niente nuovi tool se il risultato è derivabile** componendo i tool esistenti in una pipeline: in quel caso va documentata la pipeline, non aggiunto codice. I nuovi tool si giustificano solo per dati non altrimenti raggiungibili.
- **Vuoto mai muto quando il rischio è confabulazione**: usa `emptyHint` (statico, in `Tool`) per direzionare su un vuoto ambiguo, e `ToolResult.hint` (dinamico, calcolato a runtime sull'input) quando la nota dipende dai parametri. Un dato assente è il momento di massimo rischio di invenzione: la nota deve dire "non trovato non significa non avvenuto" e "non inventare numeri/date/esiti".
- **CLI agent-friendly**: niente stack trace, gli errori sono solo il messaggio; pattern `<risorsa> <verbo>`.
- **Prima i tool specifici, poi lo SPARQL generico**: il tool `sparql` è l'ultima risorsa per dati non coperti da un tool dedicato.
- Prima di concludere che un dato è assente, verifica **entrambe le camere** sondando le proprietà da un'istanza nota su ciascun endpoint: il "non trovato" è spesso un gap di tooling, non del dataset.

## Workflow di contribuzione

- Il repo è sotto l'organizzazione `ondata`. Le modifiche di **codice** passano sempre da **branch + Pull Request**, mai push diretto su `main`. Eccezioni: sola documentazione, o richiesta esplicita di push diretto.
- Messaggi di commit concisi, brevità sopra la grammatica.
- Aggiorna `LOG.md` a ogni modifica significativa: bullet ad alto segnale, intestazioni data in formato `YYYY-MM-DD`, voce più recente in alto.
