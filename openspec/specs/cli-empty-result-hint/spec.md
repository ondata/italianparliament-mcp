# cli-empty-result-hint Specification

## Purpose
Garantire che la CLI, su un risultato vuoto, comunichi lo stesso messaggio esplicativo del server MCP: l'hint dinamico se presente, altrimenti l'`emptyHint` statico del tool. Evita che l'utente CLI riceva un output vuoto senza spiegazione (es. gap noto del dataset) e mantiene allineati i due path (CLI e MCP).

## Requirements
### Requirement: La CLI comunica il messaggio esplicativo su risultato vuoto

Quando l'esecuzione di un comando produce un risultato senza righe, la CLI SHALL scrivere su stderr un messaggio esplicativo, senza alterare l'output su stdout né l'exit code. La sorgente del messaggio SHALL seguire la precedenza: l'hint dinamico del risultato (`result.hint`) se presente, altrimenti l'`emptyHint` statico definito dal tool. Se nessuno dei due è disponibile, la CLI SHALL non scrivere alcun messaggio — a differenza del server MCP, la CLI non applica un messaggio di default. La **precedenza** tra hint dinamico ed `emptyHint` statico SHALL coincidere con quella del server MCP (`result.hint ?? emptyHint`, nullish); il default finale del path MCP (`?? DEFAULT_EMPTY`) resta specifico dell'MCP e fuori da questo requisito.

#### Scenario: Risultato vuoto senza hint dinamico usa l'emptyHint statico

- **WHEN** un comando la cui definizione tool espone un `emptyHint` statico restituisce zero righe e nessun `result.hint`
- **THEN** la CLI scrive l'`emptyHint` statico del tool su stderr
- **AND** stdout contiene solo l'output vuoto formattato (CSV/JSONL), senza il messaggio
- **AND** l'exit code resta invariato

#### Scenario: L'hint dinamico ha precedenza sull'emptyHint statico

- **WHEN** un comando restituisce zero righe e un `result.hint` dinamico valorizzato, e il tool espone anche un `emptyHint` statico
- **THEN** la CLI scrive su stderr l'hint dinamico
- **AND** non scrive l'`emptyHint` statico

#### Scenario: Risultato non vuoto non produce alcun messaggio

- **WHEN** un comando restituisce almeno una riga
- **THEN** la CLI non scrive alcun hint su stderr, indipendentemente dalla presenza di `emptyHint` statico o `result.hint`

#### Scenario: Nessun hint disponibile non produce messaggio

- **WHEN** un comando restituisce zero righe, senza `result.hint` dinamico e senza `emptyHint` statico definito dal tool
- **THEN** la CLI non scrive alcun messaggio su stderr

#### Scenario: Parità di comportamento tra CLI e MCP

- **WHEN** lo stesso tool con `emptyHint` statico produce un risultato vuoto senza hint dinamico
- **THEN** il messaggio comunicato dalla CLI su stderr coincide con quello restituito dal server MCP

