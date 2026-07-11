## 1. Fix del fallback nella CLI

- [x] 1.1 In `src/cli.ts`, allargare la firma di `runTool()` per includere `emptyHint?: string` nell'oggetto tool accettato.
- [x] 1.2 In `runTool()`, dopo `tool.execute(parsed)`, se il risultato è vuoto e senza hint dinamico ma il tool ha un `emptyHint`, restituire `{ ...result, hint: tool.emptyHint }` (precedenza `result.hint ?? emptyHint`, senza mutare `result`).
- [x] 1.3 Verificare che `emit()` resti invariato (già scrive `result.hint` su stderr su risultato vuoto) e che i ~50 call site non richiedano modifiche.

## 2. Verifica manuale sui tool con emptyHint

- [x] 2.1 Build (`npm run build`) e prova su finestra vuota (10 mar–16 apr 2020, buco Cura Italia): stdout solo header, `emptyHint` su stderr, exit 0.
- [x] 2.2 Confrontare il messaggio con quello restituito dal path MCP per lo stesso tool/input (parità CLI↔MCP): stessa fonte `result.hint ?? emptyHint`.
- [x] 2.3 Spot check sugli altri tool con `emptyHint` statico: `bill-progress`, `bills`, `sindacato-ispettivo`, `votes` verificati (emptyHint su stderr); `amendments` stesso meccanismo.

## 3. Test automatici

- [x] 3.1 Aggiunto test: risultato vuoto + `emptyHint` statico → `hint` valorizzato (`src/core/empty-hint.test.ts`).
- [x] 3.2 Test: hint dinamico presente → precede l'`emptyHint` statico.
- [x] 3.3 Test: risultato non vuoto → nessun hint.
- [x] 3.4 Test: risultato vuoto senza hint né `emptyHint` → nessun hint; più test di non-mutazione e parità con MCP.
- [x] 3.5 Suite completa con `npm test -- --run`: 136/136 passano; tsc pulito.
