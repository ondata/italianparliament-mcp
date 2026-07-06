---
type: Gotcha
title: Trappole Virtuoso — Senato (OSR)
description: Quirk dell'endpoint SPARQL del Senato (Virtuoso) e del modello OSR.
resource: https://dati.senato.it/sparql
tags: [senato, osr, virtuoso, trappole]
timestamp: 2026-07-01
---

Quirk noti dell'endpoint Senato (`dati.senato.it/sparql`, triplestore Virtuoso) e del modello OSR. Ignorarli produce 0 risultati muti o errori.

# Query e sintassi

| Trappola | Dettaglio |
|----------|-----------|
| `curl` diretto → comportamento **non stabile** | In precedenza l'endpoint poteva rispondere 403 a richieste grezze; alla verifica del 2026-07-01 `curl` semplice restituisce invece 200 (XML o JSON a seconda del `format`). Non assumere più il 403 come proprietà stabile dell'endpoint. |
| **`BIND` non supportato** | Virtuoso Senato rifiuta `BIND(...)`. Portare la logica nel `SELECT`/`FILTER` o usare triple dirette. |
| **`CONCAT` dentro `FILTER` invece funziona** | Verificato 2026-07-01: `FILTER(CONTAINS(LCASE(CONCAT(?fn," ",?ln)), q))` è valido ed è il modo per matchare nome+cognome insieme. |
| **Legislatura come integer nudo** | Filtrare con `FILTER(?leg = 19)` (integer), non stringa né URI. |
| **Subquery aggregate fragili** | Alcune subquery con `COUNT` funzionano, altre no o danno risultati vuoti/inaffidabili a seconda della forma. Non fare affidamento su subquery aggregate complesse: preferire `GROUP BY` + `MIN`/`MAX`/`COUNT` al livello esterno quando possibile. |
| **`osr:dataPresentazione` è `xsd:date` tipizzato** | I `FILTER` sulle date Senato richiedono `"AAAA-MM-GG"^^xsd:date` (la Camera usa stringhe `AAAAMMGG` plain). |
| **`SUBSTR` fuori range aborta; `>=`/`<=` su funzioni stringa è numerico** | Trappole del motore Virtuoso comuni a entrambi gli endpoint: vedi [Trappole Virtuoso — funzioni stringa](../trappole-virtuoso-funzioni-stringa.md). |

# Matching nomi parlamentari

`foaf:firstName` e `foaf:lastName` sono **campi separati**: un `FILTER(CONTAINS(?fn, q) || CONTAINS(?ln, q))` **non matcha** una query che contiene nome+cognome insieme (es. `"Ignazio La Russa"` fallisce, `"La Russa"` funziona). Serve il match sulla concatenazione nei due ordini:

```sparql
FILTER( CONTAINS(LCASE(CONCAT(?fn, " ", ?ln)), q)
     || CONTAINS(LCASE(CONCAT(?ln, " ", ?fn)), q) )
```

Vedi issue #20. La Camera non ha il problema perché matcha su `rdfs:label` intero.

# Performance

Quando la legislatura è codificata **solo nell'URI**, un range filter su `?s` + `ORDER BY DESC(?s)` + `GROUP BY` è molto più veloce di `STRSTARTS` (es. `speeches` 6s → 1.8s).

# Citations

[1] Verifica `CONCAT`/matching nomi (2026-07-01): `sparql query --endpoint senato` su `"Ignazio La Russa"` → `senatore/1275`.
[2] Issue matching nomi: https://github.com/aborruso/italianparliament-mcp/issues/20
