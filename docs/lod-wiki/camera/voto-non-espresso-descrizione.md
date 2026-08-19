---
type: Gotcha
title: "\"Non ha votato\" alla Camera non è un'assenza — la distinzione è in dc:description"
description: dc:type raggruppa in "Non ha votato" tre situazioni diverse (In missione, Presidente di turno, Non ha partecipato). Solo la terza è un'assenza. Contarle insieme fa risultare assenti al 97% ministri e vicepresidenti d'Assemblea.
resource: https://dati.camera.it/sparql
tags: [camera, ocd, votazioni, presenze, trappole]
timestamp: 2026-08-19
---

Il nodo `ocd:voto` porta `dc:type` con cinque valori: `Favorevole`, `Contrario`, `Astensione`, `Ha votato` (partecipazione a scrutinio segreto, dove la scelta individuale non è tracciata) e `Non ha votato`.

# La trappola: `Non ha votato` non significa assente

Dentro `Non ha votato` il dato tiene distinte **tre situazioni che non hanno nulla in comune**, e la distinzione sta in `dc:description`:

- **`In missione`** — assente per incarico istituzionale. Non è un'assenza, e Openpolis la tiene come categoria a sé.
- **`Presidente di turno`** — è in Aula: presiede la seduta, e chi presiede non vota.
- **`Non ha partecipato`** — l'assenza vera.

Sommarle produce numeri che sembrano un'accusa e non lo sono. Misurato in leg. 19:

| Deputato | `Non ha votato` | In missione | Presidente di turno | Assenze reali |
|---|---|---|---|---|
| Giorgio Mulè (vicepresidente della Camera) | 18.844 | 12.869 | 5.429 | **546** (2,81%) |
| Giorgia Meloni (Presidente del Consiglio) | 19.409 | 18.998 | 0 | **411** (2,12%) |
| Antonio Angelucci | 19.309 | 0 | 0 | **19.309** (99,40%) |

Letto senza scomporre, Mulè risulta assente nel 97% delle votazioni: il dato vero è il 2,81%. Il terzo caso mostra che la scomposizione non "assolve" chi è assente davvero — semplicemente distingue.

```sparql
PREFIX ocd: <http://dati.camera.it/ocd/>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
SELECT ?type ?descr (COUNT(DISTINCT ?v) AS ?n) WHERE {
  ?v a ocd:voto ; ocd:rif_deputato <http://dati.camera.it/ocd/deputato.rdf/d307130_19> ; dc:type ?type .
  OPTIONAL { ?v dc:description ?descr }
} GROUP BY ?type ?descr
```

`dc:description` va tenuto in **`OPTIONAL`**: la portano solo i `Non ha votato`. I voti espressi non ce l'hanno, e un pattern obbligatorio li farebbe sparire dal conteggio (su Angelucci: 19.309 righe invece di 19.425).

`COUNT(DISTINCT ?v)` resta obbligatorio per la duplicazione da named graph (vedi [named-graph](named-graph.md)). Verificato che la scomposizione non la riapre: la somma delle tre sottocategorie coincide esattamente con il conteggio di `Non ha votato` non suddiviso.

# Il denominatore è già delimitato al mandato

Al Senato il denominatore delle percentuali va limitato al periodo di mandato, altrimenti chi subentra risulta assente per i mesi in cui non era in carica (vedi [presenze-assenze](../senato/presenze-assenze.md)). **Alla Camera non serve**: l'URI del deputato è specifico della legislatura e il grafo non gli attribuisce le votazioni precedenti al suo ingresso.

Verificato su due subentrati del 26/3/2026, Di Rubba (`d309320_19`) e Maffioli (`d309300_19`): entrambi hanno **2.287** voti registrati invece dei 19.425 della legislatura piena, e la prima votazione a cui risultano è del **31/3/2026**, cinque giorni dopo l'inizio del mandato. Il totale dei voti registrati è quindi un denominatore valido così com'è.
