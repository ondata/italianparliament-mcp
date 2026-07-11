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
voto 19-434-3 (risoluzione)    → ddl_uri = ddl/60233 (propagato ma estraneo)
```

## Vincolo

Se la stessa data ha più DDL diversi (testi unificati), il fallback **non** propaga per non collegare la fiducia al DDL sbagliato.

## Recupero di `bill_number` dopo la propagazione (refuso)

Sul refuso il primo fallback azzera `bill_number` (il numero del label non risolve). Ma una volta che il secondo fallback ha risolto `ddl_uri`, un **backfill** finale (`senato-votes.ts`, blocco `missingNum`) rilegge il numero **vero** dalla `osr:fase` del DDL risolto. Esito per il Piano Casa: `label` resta verbatim col refuso (`"DDL  n. 1994. Votazione questione di fiducia"`), ma `bill_number` è autoritativo e corretto (`1944`), `ddl_uri` = `ddl/60233`.

Conseguenza pratica: **non fidarsi del numero nel testo del `label`** (può contenere refusi della fonte); il campo strutturato `bill_number` (e `ddl_uri`) è quello verificato. Il tool non emette mai il refuso come `bill_number`: o è il numero corretto, o è vuoto (quando neppure la propagazione risolve il DDL). Regressione coperta dagli assert sul caso Piano Casa nel test `senato-votes: --ddl-uri includes the fiducia (no osr:oggetto) and excludes same-day extraneous votes`.

## Discovery tematica: `--keyword` e le fiducie

Il match keyword sul titolo del DDL collegato (v0.20.0) passa in SPARQL da `osr:oggetto → osr:relativoA → osr:titolo`: sulle fiducie `?ddlTitolo` resta unbound e il filtro le escludeva anche quando il tema cercato era nel titolo del DDL citato per numero nel label (es. `--keyword sicurezza` non trovava la fiducia 19-312-1 sul DDL 59201 "…sicurezza pubblica…"). Dal 2026-07-10 un **supplemento fiducie** le recupera a parte (set piccolo, ~55 nell'intera leg. 19): risolve il numero citato nel label via `osr:fase` leggendo anche `osr:titolo`, e tiene solo quelle il cui titolo matcha la keyword. Residuo: le fiducie con refuso nel numero (es. "DDL n. 1994" per S.1944) non sono recuperabili per keyword — il supplemento usa solo il Fallback 1, non la propagazione intra-seduta.

## Filtro per `--ddl-uri`

Il filtro diretto `osr:relativoA` escluderebbe le fiducie (prive di `osr:oggetto`). Perciò `--ddl-uri` prima **risolve le date delle sedute** in cui il DDL è stato votato, poi interroga per quelle date e applica i due fallback sopra.

In post-filtro tiene i voti collegati al DDL **e** (fortemente collegati _oppure_ fiducie): sono forti i link diretti `osr:relativoA` e quelli risolti dal Fallback 1. La propagazione per data (Fallback 2) è debole e aggancia anche voti estranei votati la stessa seduta (es. la risoluzione 19-434-3): quelli, non essendo fiducie, vengono **scartati**. Risultato per il Piano Casa: pregiudiziale + fiducia, senza la risoluzione.
