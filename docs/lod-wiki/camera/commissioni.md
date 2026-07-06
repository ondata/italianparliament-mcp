---
type: Concept
title: Commissioni Camera (ocd:organo)
description: Cosa copre ocd:organo per legislatura nel LOD Camera — permanenti, speciali, bicamerali, giunte, comitati e commissioni d'inchiesta.
tags: [camera, ocd, organo, commissioni, inchiesta]
timestamp: 2026-07-06
---

# Commissioni Camera (ocd:organo)

Il tool `committees list --chamber camera` interroga `ocd:organo` con filtro `ocd:rif_leg repubblica_{N}`. Include tutti i tipi di organo della Camera per quella legislatura.

Non serve una seconda query su `ocd:dibattito` (le commissioni d'inchiesta sono `ocd:dibattito`, ma compaiono anche come istanze di `ocd:organo` con `dc:type` valorizzato).

## Tipi di organo coperti (leg. 19)

| Categoria (`dc:type`) | Esempi |
|------------------------|--------|
| COMMISSIONE PERMANENTE | I (Affari costituzionali), II (Giustizia), ... XIV (Politiche UE) |
| COMMISSIONE BICAMERALE D'INCHIESTA | Mafie, Femminicidio, Rifiuti, SARS-CoV-2, Orlandi-Gregori, Forteto |
| COMMISSIONE MONOCAMERALE D'INCHIESTA | David Rossi, Moby Prince, Periferie, Lavoro, Transizione demografica |
| GIUNTA | Giunta delle elezioni, Giunta per le autorizzazioni, Giunta per il Regolamento |
| COMITATO | Comitato per la legislazione, Comitato per gli affari del personale |
| COMMISSIONE SPECIALE | Commissione speciale per l'esame degli atti del Governo |

## Verifica SPARQL

```sparql
PREFIX ocd: <http://dati.camera.it/ocd/>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT DISTINCT ?type WHERE {
  ?o a ocd:organo ;
     ocd:rif_leg <http://dati.camera.it/ocd/legislatura.rdf/repubblica_19> ;
     dc:type ?type .
}
ORDER BY ?type
```

## Session count

Il conteggio sedute (`session_count`) viene da `COUNT(DISTINCT ?seduta)` dove `?seduta a ocd:seduta ; ocd:rif_organo ?o`. Il numero riflette le sedute **pubbliche** (quelle con bollettino). Le sedute non pubbliche (ufficio di presidenza, convocazioni) potrebbero non essere contate.
