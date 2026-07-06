---
type: Mechanism
title: Legislatura corrente dinamica
description: Come la CLI risolve la legislatura corrente senza hardcodare 19.
tags: [core, current_legislature, endpoint, camera, sparql]
timestamp: 2026-07-06
---

# Legislatura corrente dinamica

## Perché

Hardcodare `19` come default funziona fino alla prossima legislatura. La helper `src/core/current-legislature.ts` interroga l'endpoint Camera per ottenere il numero della legislatura corrente in modo dinamico.

## Query

```sparql
PREFIX ocd: <http://dati.camera.it/ocd/>
PREFIX dc: <http://purl.org/dc/elements/1.1/>

SELECT ?s WHERE {
  ?s a ocd:legislatura .
  ?s dc:date ?d .
  FILTER(CONTAINS(STR(?s), "repubblica_"))
}
ORDER BY DESC(?d)
LIMIT 1
```

L'ultima legislatura della Repubblica per `dc:date` è la corrente.

## Cache

Il valore viene cachato in memoria per la durata del processo. Se la query fallisce, si ripiega su `CURRENT_LEGISLATURE_FALLBACK = 19` con un warning su stderr.

## Tool che lo usano

- `bill-progress` (default legislatura per `--number`)
- `committees` (default Camera)
- `committee-sessions` (default)
- `senator` (default + logica condizionale URL scheda)
- `bill-text` (fallback)
- `search` (ranking)
