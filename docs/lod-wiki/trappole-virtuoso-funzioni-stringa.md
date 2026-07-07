---
type: Gotcha
title: Trappole Virtuoso — funzioni stringa e confronti (Camera + Senato)
description: Trappole del motore Virtuoso su SUBSTR/REPLACE e sui confronti >=/<= (che diventano numerici anche su una variabile dc:date nuda) che producono errori o 0 righe muti; valgono su entrambi gli endpoint (dati.camera.it e dati.senato.it).
resource: https://dati.camera.it/sparql
tags: [virtuoso, sparql, substr, replace, filter, confronto, date, trappole, camera, senato]
timestamp: 2026-07-07
---

Entrambi gli endpoint del Parlamento (Camera `dati.camera.it/sparql`, Senato `dati.senato.it/sparql`) girano su **Virtuoso**, che ha due comportamenti non standard sulle funzioni stringa. Ignorarli manda in errore la query o produce 0 righe mute — è la causa più frequente di codice SPARQL che "sembra giusto" ma non funziona. Scrivere le query tenendone conto **a monte**, non correggerle a posteriori.

# 1. `SUBSTR` fuori range **aborta** la query (niente short-circuit)

`SUBSTR(?s, from, len)` con `from + len - 1` oltre la lunghezza della stringa non restituisce vuoto: solleva un **errore fatale** che interrompe l'intera query:

```
Virtuoso 22011 Error SR026: SPARQL substr: Bad string subrange: from=10, len=8.
```

Trappola subdola: Virtuoso **non** fa short-circuit dell'`&&`. Un guard come

```sparql
FILTER(STRLEN(STR(?date)) >= 17 && SUBSTR(STR(?date), 10, 8) = "...")   # ← ABORTA lo stesso
```

valuta comunque il `SUBSTR` sulle righe corte (dove `?date` è lungo 8) e fa fallire tutta la query, anche se lo `STRLEN` sarebbe falso.

**Soluzione**: per estrarre una sottostringa opzionale (che può non esserci) usare `REPLACE` con regex, che è sempre sicuro:

```sparql
# estrae il 2° gruppo di "AAAAMMGG-AAAAMMGG"; sui formati semplici lascia la stringa com'è
REPLACE(STR(?date), "^([0-9]{8})-([0-9]{8}).*$", "$2")
```

Usare `SUBSTR(?s, 1, N)` è invece sicuro **solo** se ogni valore è garantito lungo almeno `N`.

# 2. `>=` / `<=` su valori numerico-simili fa un confronto **numerico** (anche su variabili nude)

Quando il valore confrontato è tutto cifre (es. una data `AAAAMMGG`, un numero atto), Virtuoso ne fa un confronto **numerico** con l'operatore di range, che contro un literal stringa fallisce silenziosamente → risultati errati o **0 righe mute**. L'uguaglianza `=` invece funziona, il che rende il bug ingannevole.

**Attenzione: non riguarda solo il risultato di `SUBSTR`/`REPLACE`.** Colpisce anche una **variabile legata direttamente a `dc:date`**, senza alcuna funzione di mezzo. Il `dc:date` della Camera è un literal `AAAAMMGG` (es. `"20260630"`): confrontarlo nudo con un range è già rotto.

```sparql
# ?date legato direttamente a ?s dc:date ?date (literal "AAAAMMGG")
FILTER(?date >= "20250201") FILTER(?date <= "20250228")            # ❌ 0 righe / conteggi assurdi
FILTER(STR(?date) >= "20250201") FILTER(STR(?date) <= "20250228")  # ✅ range corretto

# stesso problema sul risultato di una funzione stringa
FILTER(REPLACE(...) = "20250709")                                  # ✅ matcha
FILTER(REPLACE(...) >= "20250709" && REPLACE(...) <= "20250709")   # ❌ 0 righe
FILTER(STR(REPLACE(...)) >= "20250709" && STR(REPLACE(...)) <= "20250709")  # ✅
```

Regola pratica: **ogni** confronto `>=`/`<=`/`>`/`<` contro un literal stringa numerico-simile (date `AAAAMMGG`, numeri atto) va avvolto in `STR(...)` — che si tratti del risultato di `SUBSTR`/`REPLACE` **o di una semplice variabile `dc:date`**. Per le date **tipizzate del Senato** (`osr:dataSeduta`, `dataPresentazione` = `xsd:date`) vale invece la regola opposta: confrontare con un literal tipizzato `"AAAA-MM-GG"^^xsd:date`, **non** con `STR()` (vedi [dati anagrafici](dati-anagrafici.md) e le trappole Senato). Nota: un `SUBSTR(STR(?date),1,8) >= "..."` inline può funzionare in alcune forme ma rompersi quando la sotto-espressione passa per `BIND` o si combina con altri `FILTER`: `STR()` esplicito è la forma robusta e portabile.

# 3. `BIND` — supporto non uniforme tra i due endpoint

Il Senato rifiuta `BIND(...)` (vedi [Trappole Virtuoso — Senato](senato/trappole.md)); la Camera lo accetta almeno nel `SELECT`. Per portabilità **non affidarsi a `BIND`**: inlinare l'espressione nel `FILTER`/`SELECT`. In più, come sopra, portare il risultato di `SUBSTR`/`REPLACE` attraverso `BIND` peggiora il problema #2 (il confronto di range fallisce anche dove inline avrebbe retto).

# Caso reale

Il filtro data di `aic list` (`src/tools/aic.ts`) deve matchare sia la presentazione (`SUBSTR(dc:date,1,8)`) sia la modifica/trattazione d'Aula dei question time (2° gruppo del composto `AAAAMMGG-AAAAMMGG`). La prima stesura usava `STRLEN(...) >= 17 && SUBSTR(...,10,8)` (→ abortiva, trappola #1) e confronti `>=`/`<=` non avvolti in `STR()` (→ 0 righe, trappola #2). La forma corretta estrae la modifica con `REPLACE` e avvolge entrambe le date in `STR()`. Vedi [Date degli atti aic](camera/aic-date.md).

Un secondo caso, più insidioso perché **senza funzioni stringa di mezzo**: il filtro `--date-from/--date-to` di `votes`, `bills`, `sessions`, `committee-sessions` e `audizioni` confrontava la variabile nuda `?date` (legata direttamente a `dc:date`) con un range `AAAAMMGG`. Risultato: `votes list --legislature 19 --date-from 2025-02-01 --date-to 2025-02-28` restituiva **0 righe mute** pur essendoci 436 votazioni, mentre gennaio ne "catturava" 7378 (conteggi assurdi da confronto numerico). Un giornalista non poteva distinguere «nessun voto» da «query rotta». Fix: `FILTER(STR(?date) >= "…")` / `FILTER(STR(?date) <= "…")` in tutti e cinque i tool.

# Citations

[1] Verifica 2026-07-06 su `dati.camera.it/sparql`: `SUBSTR(STR(?date),10,8)` su valori lunghi 8 → `SR026 Bad string subrange` anche con guard `STRLEN>=17 &&`; `REPLACE(...) >= "20250709"` → 0 righe mentre `STR(REPLACE(...)) >= "20250709"` → righe corrette; caso interrogazioni a risposta immediata del 2025-07-09 (question time, `dc:date="20250708-20250709"`).

[2] Verifica 2026-07-07 su `dati.camera.it/sparql`: votazioni leg. 19, `FILTER(?date >= "20250201") FILTER(?date <= "20250228")` → 0 righe, mentre `FILTER(STR(?date) >= "20250201") FILTER(STR(?date) <= "20250228")` → 436 (coerente con `STRSTARTS(STR(?date),"202502")`). Stesso confronto su gennaio senza `STR()` → 7378 (falso). Riprodotto anche su leg. 18 marzo 2020 (2 → 35).
