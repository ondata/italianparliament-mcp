---
type: Query Template
title: Collegare una Votazione al suo DDL (Senato)
description: Il link voto→DDL è parziale; per i voti senza osr:oggetto si risolve dal numero nel label via osr:fase="S.<num>".
resource: http://dati.senato.it/osr/Votazione
tags: [senato, osr, votazione, ddl, link]
timestamp: 2026-07-25
---

Il collegamento `osr:Votazione` → `osr:Ddl` passa per `?v osr:oggetto ?o . ?o osr:relativoA ?ddl`. È **parziale**: alcuni voti (tipicamente le **fiducie**) non hanno affatto `osr:oggetto`, e per essi il DDL è **irraggiungibile via grafo** (verificato per enumerazione: nessuna inverse, la seduta è un dead-end, il DDL non referenzia il voto).

Per quei voti l'unica traccia del provvedimento è il numero nel `rdfs:label` ("Disegno di legge n.1933. Votazione questione di fiducia.").

# Schema

| Percorso | Note |
|----------|------|
| `?v osr:oggetto ?o . ?o osr:relativoA ?ddl` | via primaria; **assente** su fiducie e voti procedurali |
| `?v rdfs:label` | contiene il numero DDL come testo (fallback) |
| `?ddl osr:fase ?f` | chiave di risoluzione univoca (include il ramo, es. `S.1933`) |

# Query Template

Fallback numero→URI quando manca `osr:oggetto`. `osr:numeroFase` da solo è **ambiguo** (es. "1933" → C.1933 + S.1933); `osr:fase` col ramo `S.` è **univoco** (leg.19: 1980 fasi `S.*`, 0 collisioni). I voti d'Assemblea del Senato sono sempre su fase ramo S.

```sparql
SELECT ?ddl WHERE {
  ?ddl a osr:Ddl ; osr:legislatura <LEG> ; osr:fase ?f .
  FILTER(STR(?f) = "S.<NUM>")
}
```

`<NUM>` = numero + eventuale suffisso di lettura, estratto dal label (3 formati: `Disegno di legge n.N`, `Ddl n.N`, `DDL N`; regex `/(?:disegno di legge|ddl)\s*n?\.?\s*(\d+(?:-[A-Za-z]+)*)/i`). Il suffisso conta: `562-B` → seconda lettura.

Caveat: `STR()` obbligatorio (literal tipizzato, senza → 0 righe, cfr. [[trappole]]); niente `VALUES` batch (400 su Virtuoso); filtrare sempre per legislatura (unicità intra-legislatura).

# Assenti

Applicare il fallback **solo ai label che citano un DDL**: dei 461 voti leg.19 senza `osr:oggetto`, solo 109 nominano un DDL. Gli altri (controprova, verifica del numero legale, mozioni/risoluzioni/comunicazioni) restano vuoti.

Attenzione però a non liquidarli tutti come "voti senza DDL": la **controprova** è la ripetizione di una votazione il cui esito era incerto, quindi quando segue un voto di merito riguarda esattamente quell'atto — ma il grafo non lo dice in nessun modo. Verificato il 25/7/2026 sul voto `votazione/19-438-5` chiedendo tutte le sue triple: ha `osr:seduta`, i contatori e i **voti individuali di ogni senatore** (`osr:favorevole` ecc.), ma **nessun `osr:oggetto`** e un `rdfs:label` che è la sola parola "Controprova" — nemmeno un numero da cui risalire. Si sa come ha votato ciascun senatore, non su cosa.

Nella seduta del 16/7/2026 (`sedutaassemblea/24345`, autonomia differenziata, 4 atti trattati) i tre `controprova` — n. 2, 5, 11 — sono tutti senza `ddl_uri`. Ereditarlo dal voto immediatamente precedente sarebbe **sbagliato in due casi su tre**: solo il n. 5 segue un voto di merito (ODG G270 → `ddl/54204`), mentre n. 2 e n. 11 seguono una *verifica del numero legale*, che non verte sul merito di alcun atto. In una seduta con quattro atti diversi l'euristica appiccicherebbe l'atto sbagliato: il campo vuoto è preferibile.

Da qui il comportamento dei tool: la propagazione per data (`senato-votes`, Fallback 2) aggancia il `controprova` quando la seduta è **monotematica** — es. `19-440` del 22/7/2026 — e si astiene quando la seduta tratta più atti. Non è una svista ma una scelta: l'alternativa è indovinare.

**È un limite della fonte, non del tooling** (stessa famiglia delle fiducie prive di `osr:oggetto`): segnalato al Webmaster in [[corrispondenza-webmaster]] insieme a quel caso.

Camera: analogo. Numero da `dc:description` (`DDL <num> - <VOTO FINALE|EM|ODG>`, es. "DDL 2920-A"); l'atto è il numero **base** (`2920-A` → `2920`). Non fabbricare l'URI `ac<LEG>_<NUM>`: **verificarne l'esistenza** via `?a a ocd:atto ; ocd:rif_leg <leg> ; dc:identifier "<NUM>"` (una query per legislatura, OR-chain su `dc:identifier`), così i voti che non risolvono restano vuoti invece di puntare a un URI inesistente.

# Implementato

Dalla v0.8.0 il fallback è nei tool `senato-votes` e `votes`: colonna `bill_number` (numero grezzo dal testo, sempre) + `ddl_uri`/`bill_uri` popolati quando risolvibili. Estrazione in `src/core/bill-number.ts` (`extractBillNumber`/`billBaseNumber`); regex tollerante a `DDL n.`, `DDL.n.`, `Disegno di legge n.`, suffissi `-B`/`-bis`.

Estesa il 1° luglio 2026 (pomeriggio) dopo aver scoperto che gli Ordini del Giorno Camera citano l'atto **senza** la parola "DDL": aggiunto il pattern "9/<atto>/<progressivo>" (forma breve "ODG 9/2920/46" e forma estesa "Ordine del giorno n. 9/1049/3 COGNOME NOME (GRUPPO)"), tollerante al suffisso "E ABB" (e abbinate), e aggiunta l'alternativa "PDL"/"proposta di legge" accanto a "DDL"/"disegno di legge" (stesso schema, atto di iniziativa parlamentare invece che governativa). Validato su un campione di 6000 votazioni leg. 19: **1591/1606 ODG risolti (99%)**. I 15 residui sono voci Doc. VIII (non un DDL/PDL, correttamente vuote) o "testo unificato" con riferimento di ramo a 4 segmenti (`9/1928 E ABB-A/R/8`), lasciate vuote per non rischiare un'estrazione sbagliata. Tipi come `Articolo`/`Mozione`/`Risoluzione` restano in parte vuoti perché il **testo stesso non cita l'atto** (es. `dc:description = "ARTICOLO 1"`): non è un gap di parsing, è la conferma diretta del problema segnalato in `docs/note-gestori-lod/camera-assistenza-dati.md` (punto 2).

# Citations

[1] Indagine LOD del 2026-07-01 (issue #21): enumerazione percorsi + validazione resolver su `19-432-3`→`ddl/60201`, `19-21-1`→`ddl/56123`, `19-389-7`→`ddl/59837`.
[2] https://github.com/ondata/italianparliament-mcp/issues/21
