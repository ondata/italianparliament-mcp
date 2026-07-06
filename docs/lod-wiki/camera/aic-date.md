---
type: Gotcha
title: Date degli atti di sindacato ispettivo (aic) — presentazione vs conclusione
description: dc:date su ocd:aic è presentazione (o "presentazione-modifica"); la data di conclusione/trattazione è ocd:endDate. La seduta non è un link strutturato: il numero è solo nel testo di dc:description.
resource: https://dati.camera.it/sparql
tags: [camera, ocd, aic, interrogazioni, date, question-time]
timestamp: 2026-07-05
---

Gli atti di sindacato ispettivo (`ocd:aic`: interrogazioni, interpellanze, mozioni, ODG) hanno **due date distinte** con significato diverso. Confonderle produce falsi "0 risultati", tipico sul question time.

# `dc:date`: presentazione (a volte composta)

`dc:date` è la data di **presentazione** in formato `AAAAMMGG`. Sugli atti modificati dopo la presentazione diventa **composta**: `AAAAMMGG-AAAAMMGG` (presentazione-modifica). Es. l'interrogazione a risposta immediata 3/02760 (question time del 1 luglio 2026) ha `dc:date = "20260630-20260701"`: presentata il 30 giugno, trattata in Aula il 1 luglio.

Trappola: un filtro sull'intera stringa si rompe sui record compositi (~62% degli aic leg. 19). Isolare le due date con funzioni stringa: presentazione = `SUBSTR(STR(?date),1,8)`; modifica = secondo gruppo del composto, estratto con `REPLACE(STR(?date),"^([0-9]{8})-([0-9]{8}).*$","$2")` (sui formati semplici resta la presentazione). Un filtro sulla **sola** presentazione NON trova gli atti *trattati* il 1 luglio ma presentati il giorno prima: per il question time serve matchare **anche** la modifica.

Attenzione a due trappole Virtuoso su queste espressioni (vedi [Trappole Virtuoso — funzioni stringa](../trappole-virtuoso-funzioni-stringa.md)): (1) `SUBSTR` con range oltre la lunghezza **aborta** la query (niente short-circuit nell'`&&`) → estrarre la modifica con `REPLACE`, non con `SUBSTR(...,10,8)`; (2) `>=`/`<=` sul risultato di `SUBSTR`/`REPLACE` fa un confronto **numerico** che dà 0 righe → va forzato lessicografico con `STR(...)` attorno all'espressione.

# `ocd:endDate`: conclusione/trattazione (strutturata, filtrabile)

Esiste un campo strutturato `ocd:endDate` (`AAAAMMGG`) = data di **conclusione/risoluzione** dell'atto, accompagnato da `ocd:concluso = 1`. Per un'interrogazione a risposta immediata coincide con il giorno di trattazione in Aula. È il campo giusto per rispondere a "cosa è stato trattato/concluso intorno a una data".

Caveat semantico (verificato 2026-07-05): `ocd:endDate` **non è la data di una singola seduta**. Raggruppa tipi eterogenei chiusi nella stessa finestra: `endDate=20260701` leg.19 prende 194 atti (112 ODG, 38 interrogazioni in commissione, 20 orali, 10 mozioni, …). Anche restringendo alle sole "a risposta immediata" (58 atti) queste tracciano a **due sedute** distinte (n. 683 e 684), non una. È dunque una data di chiusura/aggiornamento, più grossolana del singolo evento d'Aula.

# La seduta NON è un link strutturato

Sull'`ocd:aic` **non esiste** un `ocd:rif_seduta` (né analogo) verso la seduta di trattazione. Il numero di seduta è presente **solo nel testo libero** di `dc:description` (es. «…modificato Mercoledì 1 luglio 2026, seduta n. 684…»). Un filtro pulito "atti della seduta del 1 luglio" richiede quindi di **parsare la description**, non è ottenibile via join RDF. È un limite reale del LOD, non di tooling.

# Regola per il tooling

- `--date-from/--date-to` combacia se cade nell'intervallo la **presentazione** (`SUBSTR(dc:date,1,8)`) **oppure** la **modifica** (secondo gruppo del composto, via `REPLACE`). Così il question time cercato per la sua data d'Aula (= modifica) viene trovato, senza aggiungere un flag dedicato. Implementato in `src/tools/aic.ts`.
- `ocd:endDate` (= conclusione/risoluzione) resta un'alternativa più **grossolana** (aggrega tipi eterogenei chiusi nella stessa finestra, traccia a più sedute): la data di modifica dentro `dc:date` è più precisa per la singola trattazione d'Aula, quindi preferita.
- Il filtro per singola seduta non è fattibile in modo pulito: numero seduta solo in `dc:description`.

# Citations

[1] Verifica 2026-07-05 su `aic.rdf/aic3_02760_19` (Manzi, question time 1 luglio): `dc:date="20260630-20260701"`, `ocd:endDate="20260701"`, `ocd:concluso=1`, seduta n. 684 solo in `dc:description`, nessun `ocd:rif_seduta`. Endpoint `dati.camera.it/sparql`.
