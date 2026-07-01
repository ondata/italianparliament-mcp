---
type: Query Template
title: Collegare una Votazione al suo DDL (Senato)
description: Il link voto→DDL è parziale; per i voti senza osr:oggetto si risolve dal numero nel label via osr:fase="S.<num>".
resource: http://dati.senato.it/osr/Votazione
tags: [senato, osr, votazione, ddl, link]
timestamp: 2026-07-01
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

Applicare il fallback **solo ai label che citano un DDL**: dei 461 voti leg.19 senza `osr:oggetto`, solo 109 nominano un DDL. Gli altri (controprova, verifica del numero legale, mozioni/risoluzioni/comunicazioni) sono voti **senza DDL** → restano correttamente vuoti, non sono un gap.

Camera: analogo. Numero da `dc:description` (`DDL <num> - <VOTO FINALE|EM|ODG>`, es. "DDL 2920-A"); l'atto è il numero **base** (`2920-A` → `2920`). Non fabbricare l'URI `ac<LEG>_<NUM>`: **verificarne l'esistenza** via `?a a ocd:atto ; ocd:rif_leg <leg> ; dc:identifier "<NUM>"` (una query per legislatura, OR-chain su `dc:identifier`), così i voti che non risolvono restano vuoti invece di puntare a un URI inesistente.

# Implementato

Dalla v0.8.0 il fallback è nei tool `senato-votes` e `votes`: colonna `bill_number` (numero grezzo dal testo, sempre) + `ddl_uri`/`bill_uri` popolati quando risolvibili. Estrazione in `src/core/bill-number.ts` (`extractBillNumber`/`billBaseNumber`); regex tollerante a `DDL n.`, `DDL.n.`, `Disegno di legge n.`, suffissi `-B`/`-bis`.

# Citations

[1] Indagine LOD del 2026-07-01 (issue #21): enumerazione percorsi + validazione resolver su `19-432-3`→`ddl/60201`, `19-21-1`→`ddl/56123`, `19-389-7`→`ddl/59837`.
[2] https://github.com/aborruso/italianparliament-mcp/issues/21
