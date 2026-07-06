---
type: Mechanism
title: Fallback fiducia Senato — propagazione intra-seduta
description: Come senato-votes risolve i ddl_uri delle fiducie quando il bill_number è un refuso della fonte.
tags: [senato, osr, fiducia, fallback, votazione]
timestamp: 2026-07-06
---

# Fallback fiducia Senato — propagazione intra-seduta

## Problema

I voti di fiducia al Senato non hanno `osr:oggetto` (nessun DDL collegato via grafo). Il primo fallback `bill_number`→`osr:fase` risolve il numero citato nella `label`, ma quando la fonte ha un refuso (es. "DDL n. 1994" per S.1944 / Piano Casa), il numero non corrisponde ad alcun DDL e `bill_number` viene azzerato per difesa.

## Soluzione

Un **secondo fallback** (`senato-votes.ts`, loop `unlinked`) propaga il `ddl_uri` dai voti sorelli della stessa seduta d'Assemblea:

```
voto 19-434-1 (pregiudiziale) → ddl_uri = ddl/60233 (Piano Casa)
voto 19-434-2 (fiducia)        → ddl_uri vuota, date = 2026-07-01
→ Fallback 2: 2026-07-01 ha ddl_uri unico → propaga ddl/60233
voto 19-434-3 (risoluzione)    → ddl_uri = ddl/60233
```

## Vincolo

Se la stessa data ha più DDL diversi (testi unificati), il fallback **non** propaga per non collegare la fiducia al DDL sbagliato.
