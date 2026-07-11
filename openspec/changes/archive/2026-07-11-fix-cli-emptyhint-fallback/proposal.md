## Why

Sei tool definiscono un `emptyHint` statico — un messaggio che spiega perché un risultato potrebbe essere vuoto (es. gap noto del dataset, filtro da riformulare). Il server MCP lo mostra (`src/server.ts` usa `result.hint ?? emptyHint ?? DEFAULT_EMPTY`), ma la CLI no: `emit()` in `src/cli.ts` scrive solo l'hint dinamico (`result.hint`) e non arriva mai all'`emptyHint` statico del tool. Chi usa la CLI su una finestra vuota (caso reale: le fiducie COVID 2020 assenti dal LOD Senato) riceve un output vuoto, exit code 0, senza alcuna spiegazione — pur avendola già scritta nel codice. È uno scollamento CLI/MCP che viola la convenzione di progetto "CLI e MCP allineati".

## What Changes

- La CLI, quando un risultato è vuoto e il tool non fornisce un hint dinamico, usa come fallback l'`emptyHint` statico del tool e lo scrive su stderr (stessa semantica del path MCP: `result.hint ?? emptyHint`).
- Il fallback resta su **stderr**, così l'output parsabile (CSV/JSONL) su stdout di pipeline e redirezioni non viene sporcato; l'exit code non cambia.
- Beneficiano i 6 tool con `emptyHint` statico: `senato-votes`, `bill-progress`, `amendments`, `bills`, `sindacato-ispettivo`, `votes`.
- Nessun cambio di comportamento quando il risultato non è vuoto o quando esiste già un hint dinamico (che mantiene la precedenza).

## Capabilities

### New Capabilities
- `cli-empty-result-hint`: comportamento della CLI nel comunicare, su risultato vuoto, il messaggio esplicativo del tool (hint dinamico se presente, altrimenti `emptyHint` statico) su stderr, allineandolo al path MCP.

### Modified Capabilities
<!-- Nessuna spec esistente in openspec/specs/: nessuna capability modificata. -->

## Impact

- Codice: `src/cli.ts` — funzione `runTool()` (fallback dell'hint) e/o `emit()`. Nessuna modifica ai ~50 call site di `emit()`.
- Nessun impatto su `src/server.ts` (già corretto) né sulle definizioni dei tool (l'`emptyHint` esiste già).
- Nessun breaking change: stdout invariato, exit code invariato; cambia solo un messaggio informativo su stderr in caso di risultato vuoto.
- Test: aggiungere copertura sul fallback CLI (risultato vuoto → `emptyHint` su stderr; hint dinamico ha precedenza; risultato non vuoto → nessun hint).
