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

# La seduta È un link strutturato, ma solo per gli atti trattati in Aula

> ⚠️ **Correzione dell'8 agosto 2026.** Questa pagina affermava che `ocd:rif_seduta` non esistesse sugli `ocd:aic` e che il numero di seduta vivesse solo nel testo di `dc:description`, da cui la regola «filtro per seduta non fattibile, serve parsare la description». **È falso**, e la regola che ne discendeva mandava a scrivere un workaround testuale al posto di un join RDF disponibile.

`ocd:rif_seduta` esiste e punta a una `seduta.rdf` vera:

```sparql
SELECT (COUNT(DISTINCT ?s) AS ?n) WHERE {
  ?s a <http://dati.camera.it/ocd/aic> ;
     <http://dati.camera.it/ocd/rif_seduta> <http://dati.camera.it/ocd/seduta.rdf/s19_402>
}
```

→ **243** atti agganciati a quella seduta. Il filtro «atti della seduta X» è quindi ottenibile via join, senza toccare il testo.

**Copertura**: 109.147 `ocd:aic` su 555.702 (19,6%), di cui 12.985 in legislatura 19 — non è un buco per legislatura, la 17 ne ha 22.483 e la 18 17.820. Per tipo: ODG in Assemblea 52.458, interrogazioni a risposta orale 18.825, in commissione 12.798, interpellanze 7.634, ODG in commissione 4.251, mozioni 3.929.

**Chi non ce l'ha, e perché ha senso**: in testa alle assenze stanno le 277.568 *interrogazioni a risposta scritta*, che per natura non vengono trattate in una seduta d'Aula. L'assenza lì è semanticamente corretta, non un buco.

**Attenzione però**: la copertura è parziale anche dentro i tipi che il link ce l'hanno (42.209 interrogazioni a risposta orale ne sono prive), e singole sedute possono non avere alcun atto agganciato — la `s19_684` del 1° luglio 2026, che era l'esempio su cui poggiava il claim sbagliato, ne ha **zero**. È probabilmente così che l'errore è nato: verificato su un caso recente che davvero non aveva agganci, e generalizzato a inesistenza della proprietà.

Regola pratica: **provare prima il join**, e ricadere sul parsing di `dc:description` solo quando torna vuoto — non il contrario.

# Regola per il tooling

- `--date-from/--date-to` combacia se cade nell'intervallo la **presentazione** (`SUBSTR(dc:date,1,8)`) **oppure** la **modifica** (secondo gruppo del composto, via `REPLACE`). Così il question time cercato per la sua data d'Aula (= modifica) viene trovato, senza aggiungere un flag dedicato. Implementato in `src/tools/aic.ts`.
- `ocd:endDate` (= conclusione/risoluzione) resta un'alternativa più **grossolana** (aggrega tipi eterogenei chiusi nella stessa finestra, traccia a più sedute): la data di modifica dentro `dc:date` è più precisa per la singola trattazione d'Aula, quindi preferita.
- Il filtro per singola seduta **è** fattibile via join su `ocd:rif_seduta` per i 109.147 atti che ce l'hanno (vedi sopra); il parsing di `dc:description` resta il ripiego per gli altri. Il tool `aic` oggi non espone un filtro per seduta: sarebbe derivabile, non richiede dato nuovo.

# Citations

[1] Verifica 2026-07-05 su `aic.rdf/aic3_02760_19` (Manzi, question time 1 luglio): `dc:date="20260630-20260701"`, `ocd:endDate="20260701"`, `ocd:concluso=1`, seduta n. 684 solo in `dc:description`, nessun `ocd:rif_seduta`. Endpoint `dati.camera.it/sparql`.
