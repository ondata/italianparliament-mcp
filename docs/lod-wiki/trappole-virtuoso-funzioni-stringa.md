---
type: Gotcha
title: Trappole Virtuoso — funzioni stringa e confronti (Camera + Senato)
description: Due trappole del motore Virtuoso su SUBSTR/REPLACE e sui confronti >=/<= che producono errori o 0 righe muti; valgono su entrambi gli endpoint (dati.camera.it e dati.senato.it).
resource: https://dati.camera.it/sparql
tags: [virtuoso, sparql, substr, replace, filter, confronto, trappole, camera, senato]
timestamp: 2026-07-06
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

# 2. `>=` / `<=` sul risultato di funzioni stringa fa un confronto **numerico**

Quando il valore prodotto da `SUBSTR`/`REPLACE` è tutto cifre (es. una data `AAAAMMGG`), Virtuoso ne fa un confronto **numerico** con l'operatore di range, che contro un literal stringa fallisce silenziosamente → **0 righe**. L'uguaglianza `=` invece funziona, il che rende il bug ingannevole:

```sparql
FILTER(REPLACE(...) = "20250709")                        # ✅ matcha
FILTER(REPLACE(...) >= "20250709" && REPLACE(...) <= "20250709")  # ❌ 0 righe
```

**Soluzione**: forzare il confronto lessicografico avvolgendo l'espressione in `STR(...)`:

```sparql
FILTER(STR(REPLACE(...)) >= "20250709" && STR(REPLACE(...)) <= "20250709")  # ✅
```

Regola pratica: ogni volta che confronti con `>=`/`<=`/`>`/`<` il risultato di una funzione stringa su valori numerici-simili (date `AAAAMMGG`, numeri atto), **avvolgilo in `STR()`**. Nota: un `SUBSTR(STR(?date),1,8) >= "..."` inline può funzionare in alcune forme ma rompersi quando la sotto-espressione passa per `BIND` o si combina con altri `FILTER`: `STR()` esplicito è la forma robusta e portabile.

# 3. `BIND` — supporto non uniforme tra i due endpoint

Il Senato rifiuta `BIND(...)` (vedi [Trappole Virtuoso — Senato](senato/trappole.md)); la Camera lo accetta almeno nel `SELECT`. Per portabilità **non affidarsi a `BIND`**: inlinare l'espressione nel `FILTER`/`SELECT`. In più, come sopra, portare il risultato di `SUBSTR`/`REPLACE` attraverso `BIND` peggiora il problema #2 (il confronto di range fallisce anche dove inline avrebbe retto).

# Caso reale

Il filtro data di `aic list` (`src/tools/aic.ts`) deve matchare sia la presentazione (`SUBSTR(dc:date,1,8)`) sia la modifica/trattazione d'Aula dei question time (2° gruppo del composto `AAAAMMGG-AAAAMMGG`). La prima stesura usava `STRLEN(...) >= 17 && SUBSTR(...,10,8)` (→ abortiva, trappola #1) e confronti `>=`/`<=` non avvolti in `STR()` (→ 0 righe, trappola #2). La forma corretta estrae la modifica con `REPLACE` e avvolge entrambe le date in `STR()`. Vedi [Date degli atti aic](camera/aic-date.md).

# Citations

[1] Verifica 2026-07-06 su `dati.camera.it/sparql`: `SUBSTR(STR(?date),10,8)` su valori lunghi 8 → `SR026 Bad string subrange` anche con guard `STRLEN>=17 &&`; `REPLACE(...) >= "20250709"` → 0 righe mentre `STR(REPLACE(...)) >= "20250709"` → righe corrette; caso interrogazioni a risposta immediata del 2025-07-09 (question time, `dc:date="20250708-20250709"`).
