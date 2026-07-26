---
type: Gotcha
title: Scrutinio segreto — la scelta individuale non è mai registrata (alla Camera vote-detail dà solo "Ha votato")
description: principio generale, valido per qualsiasi votazione a scrutinio segreto in qualunque contesto (Camera, Senato, ogni organo deliberativo): il voto segreto è segreto, la scelta del singolo NON è registrata alla fonte. Non è un buco del dato. Alla Camera emerge così: vote-detail su secret_vote=true dà nel campo `vote` solo "Ha votato"/"Non ha votato"/"Astensione", mai "Favorevole"/"Contrario". Serve a non far confabulare l'esito individuale a un LLM.
resource: https://dati.camera.it/sparql
tags: [camera, senato, ocd, votazione, vote-detail, scrutinio-segreto, confabulazione, gotcha]
timestamp: 2026-07-24
---

# Principio generale

**Uno scrutinio segreto è segreto.** In *qualsiasi* votazione a scrutinio segreto — Camera, Senato, o qualunque contesto — la scelta del singolo votante **non è registrata alla fonte**, per definizione. Non è un difetto del tool né un buco del dato: il dato è *corretto* così. Quindi alla domanda "come ha votato X?" su un voto segreto la risposta è "scelta individuale non registrata", **mai** un sì/no dedotto o inventato.

Cambia solo *come* questo emerge nei dati di ciascun ramo. Sotto, l'istanza verificata alla Camera.

# Come emerge alla Camera

Su una votazione Camera a **scrutinio segreto** (`secret_vote=true` in `votes`), `vote-detail` restituisce comunque la riga per ogni deputato, ma nel campo `vote` la **scelta espressa non c'è**: compaiono solo `Ha votato`, `Non ha votato`, `Astensione`. Il sì/no del singolo deputato non è nel dato.

# Contrasto voto normale vs voto segreto (verificato 2026-07-24, leg. 19)

| votazione | `vote` — valori distinti |
|---|---|
| **normale** (`vs19_696_005`) | `Favorevole` 101, `Contrario` 134, `Astensione` 5, `Non ha votato` 158 |
| **segreta** (`vs19_691_001`, voto finale legge elettorale 16/7/2026) | `Ha votato` 369, `Non ha votato` 28, `Astensione` 2 — **nessun** Favorevole/Contrario |

In un voto normale la scelta di merito è esplicita; nel voto segreto `Favorevole`/`Contrario` sono sostituiti da un unico `Ha votato` (registra la presenza al voto, non come si è votato).

# Regola pratica per l'orchestratore/LLM

Alla domanda "come ha votato il deputato X?" su una votazione a scrutinio segreto: **non dedurre né inventare** il sì/no — la scelta non esiste nel dato, c'è solo `Ha votato`. Il segnale è già derivabile senza campi extra: il flag `secret_vote` è esposto da `votes`, e nel dettaglio l'assenza di `Favorevole`/`Contrario` (solo `Ha votato`) lo conferma.

Simmetrico al Senato, dove `senato-vote-detail` sui voti `segreta` e `verifica numero legale` dà solo le presenze, mai la scelta — vedi [[votazione-tipo-semantico]].

# Citations

[1] Distribuzione `vote` su `vs19_691_001` (legge elettorale, scrutinio segreto): 369 `Ha votato`, 28 `Non ha votato`, 2 `Astensione`; verificato via `vote-detail` 2026-07-24.
[2] Voto normale di contrasto `vs19_696_005`: 101 `Favorevole`, 134 `Contrario`, 5 `Astensione`, 158 `Non ha votato`.
[3] Emerso dalla gap analysis news-driven `docs/news-agent/2026-07-23_12-50.md` come candidato a documentazione (non bug).
