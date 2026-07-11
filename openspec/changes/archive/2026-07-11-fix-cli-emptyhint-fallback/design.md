## Context

I tool del progetto espongono opzionalmente un `emptyHint?: string` statico (definito in `src/tools/*.ts`, tipizzato in `src/tools/types.ts`) e possono restituire un `hint?: string` dinamico nel `ToolResult`. Il server MCP li unisce con la precedenza `result.hint ?? emptyHint ?? DEFAULT_EMPTY` (`src/server.ts`). La CLI invece, in `emit()` (`src/cli.ts`), scrive su stderr solo `result.hint`, ignorando l'`emptyHint` statico. `emit(result, format)` non riceve il tool, quindi non ha accesso all'`emptyHint`; viene inoltre invocato da ~50 call site, ciascuno preceduto da `runTool(<tool>, input)`. `runTool()` invece riceve già l'oggetto tool.

## Goals / Non-Goals

**Goals:**
- Allineare la CLI al path MCP: su risultato vuoto senza hint dinamico, comunicare l'`emptyHint` statico del tool su stderr.
- Fix a punto singolo, senza modificare i ~50 call site di `emit()`.
- Preservare stdout parsabile (CSV/JSONL) ed exit code.

**Non-Goals:**
- Modificare le stringhe di `emptyHint` esistenti o aggiungerne di nuove.
- Cambiare il comportamento del server MCP (già corretto).
- Introdurre un `DEFAULT_EMPTY` lato CLI: se non c'è né hint dinamico né `emptyHint`, la CLI resta silenziosa su stderr (comportamento attuale).

## Decisions

- **Applicare il fallback in `runTool()`, non in `emit()`.** `runTool()` ha già il tool in mano; `emit()` no. Allargare la firma di `runTool` per includere `emptyHint?: string` e, dopo `tool.execute(parsed)`, se `result.rows.length === 0 && result.hint == null && tool.emptyHint`, restituire `{ ...result, hint: tool.emptyHint }`. `emit()` resta invariato: già scrive `result.hint` su stderr quando il risultato è vuoto. Un solo punto di modifica, nessun tocco ai call site.
- **Precedenza identica al server**: l'hint dinamico vince sull'`emptyHint` statico (`result.hint ?? emptyHint`), replicata dalla guardia `result.hint == null` (nullish, non truthy `!result.hint`: così un hint dinamico stringa vuota non viene sovrascritto, restando fedele al `??`).
- **Immutabilità del risultato**: si restituisce un nuovo oggetto (`{ ...result, hint }`) invece di mutare `result`, coerente con lo stile del codice.

## Risks / Trade-offs

- **Rischio basso**: la modifica tocca solo il ramo "risultato vuoto"; il flusso con righe è invariato. stdout ed exit code non cambiano.
- **Trade-off**: si aggiunge `emptyHint?` alla firma inline di `runTool`; accettabile e coerente con `Tool<>` in `types.ts`. In alternativa si sarebbe potuto tipizzare `runTool` sul tipo `Tool`, ma la firma inline attuale è minima e la si estende di un solo campo per non allargare la superficie del cambiamento.
- **Verifica**: serve un test che copra i quattro casi (vuoto+emptyHint→stderr; vuoto+hint dinamico→precede; non vuoto→niente; vuoto+niente→silenzio) e la parità con MCP, per evitare regressioni future su questo scollamento.
