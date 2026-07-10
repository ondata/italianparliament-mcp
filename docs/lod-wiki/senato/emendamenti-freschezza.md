---
type: Gotcha
title: Emendamenti al Senato — freschezza intermittente (fermo ago 2024 → refresh lug 2026)
description: osr:Emendamento è rimasto ~2 anni senza collegamenti a DDL presentati dopo il 9 agosto 2024, poi un refresh (rilevato 2026-07-10) lo ha riallineato. La freschezza non è garantita nel tempo; il tool amendments ha un fallback sul bulk AKN GitHub.
resource: https://dati.senato.it/sparql
tags: [senato, osr, emendamenti, freschezza, assenti]
timestamp: 2026-07-10
---

# AGGIORNAMENTO 2026-07-10: il dataset è stato aggiornato (refresh tra il 7 e il 10 luglio)

La verifica del 2026-07-07 (sotto, mantenuta come storia) trovava **0** emendamenti per il Piano Casa (`ddl/60233`). Il 2026-07-10 lo stesso conteggio dà **799** (682 tipo `E`, 114 `G`, 3 `Q`) — che combacia esattamente col bulk AKN GitHub (400 in `emend/` + 399 in `emendc/`). Il dataset `osr:Emendamento` è quindi tornato vivo dopo ~2 anni di stallo.

Due conseguenze operative:

1. **La freschezza è intermittente, non garantita**: il dataset è rimasto fermo per quasi due anni ed è ripartito senza alcun segnale di versioning (vedi [freschezza e autorevolezza](../freschezza-e-autorevolezza.md)). Non assumere né che sia fermo né che sia aggiornato: verificare sul provvedimento.
2. **Trappola nuova sulla query canonica del cutoff**: la query sotto (FILTER su `dataPresentazione` con literal `^^xsd:date`) oggi restituisce **9**, non 799+ — perché la `osr:dataPresentazione` dei DDL recenti (es. `ddl/60233`) è ora tipizzata **`xsd:string`**, non `xsd:date`, e il confronto tipizzato la esclude. La regola "date Senato = sempre xsd:date tipizzato" non vale più uniformemente: il refresh ha introdotto date string. Per conteggi affidabili confrontare con `STR(?data)`.

Il tool `amendments` resta protetto in entrambe le direzioni: se il LOD è indietro, con `ddlUri` fa fallback sul bulk AKN GitHub ([[akn-bulk-data]]), che è aggiornato quotidianamente.

---

# Storia (verifica 2026-07-07): dataset fermo da agosto 2024

Il tool `amendments` (Senato) restituiva **sempre vuoto** sui DDL più recenti — verificato su DL Sicurezza 2025 (`ddl/59201`) e Piano Casa 2026 (`ddl/60233`) — mentre funzionava su provvedimenti anche molto vecchi (Cura Italia 2020, `ddl/52873`, 3.827 emendamenti; DL Dic. 2022, `ddl/56260`, 119 emendamenti).

# Non è un problema di lettura/ddl_uri sbagliato

Prima ipotesi scartata: che gli emendamenti restassero indicizzati su un `ddl_uri` di una lettura Senato precedente diversa da quella finale. Verificato che non regge: entrambi i DDL recenti hanno un solo `osr:fase` registrato (`S.1509` per Sicurezza, `S.1944` per Piano Casa) — nessun altro DDL nel grafo condivide la stessa fase, quindi non esiste una "lettura precedente" alternativa a cui i link potrebbero puntare.

# La causa reale: cutoff temporale sul dataset

```sparql
SELECT (COUNT(*) as ?c) WHERE {
  ?e a <http://dati.senato.it/osr/Emendamento> ; <http://dati.senato.it/osr/oggetto> ?o .
  ?o <http://dati.senato.it/osr/relativoA> ?ddl .
  ?ddl <http://dati.senato.it/osr/dataPresentazione> ?data .
  FILTER(?data > "2024-08-09"^^xsd:date)
}
```

Risultato: **0**. Su 2.467 DDL collegati a emendamenti in tutto il grafo (da legislatura 18 in poi), **nessuno** ha `dataPresentazione` successiva al 9 agosto 2024. Il dataset `osr:Emendamento` non viene aggiornato da quasi due anni: qualunque provvedimento presentato dopo quella data restituirà emendamenti vuoti, indipendentemente dal DDL passato.

# Conseguenza per il tooling

Un CSV vuoto da `amendments list --ddl-uri ...` su un DDL recente **non significa "nessun emendamento presentato"** — significa quasi certamente "dataset non aggiornato oltre agosto 2024". Il tool dovrebbe restituire un `emptyHint` esplicito quando la `dataPresentazione` del DDL richiesto è successiva a quella soglia, per evitare che l'assenza venga letta come dato strutturale.

# Citations

[1] Conteggio emendamenti per DDL noti, 2026-07-07: `ddl/52873` (Cura Italia, leg.18) → 3.827; `ddl/56260` (leg.19, dic. 2022) → 119; `ddl/59201` (Sicurezza, leg.19, pres. 2025-05-29) → 0; `ddl/60233` (Piano Casa, leg.19, pres. 2026-06-23) → 0.

[2] Nessun `osr:fase` alternativo condiviso da altri DDL per `S.1509` o `S.1944` (query `SELECT ?s WHERE { ?s osr:fase "S.1509" }` → solo il DDL stesso).

[3] Cutoff confermato: `COUNT` di emendamenti su DDL con `dataPresentazione > 2024-08-09` → 0, su 2.467 DDL totali collegati a emendamenti nel grafo.
