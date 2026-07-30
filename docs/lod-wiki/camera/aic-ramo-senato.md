---
type: Gotcha
title: Il dataset AIC della Camera contiene anche il sindacato ispettivo del Senato
description: Gli atti con URI a suffisso _S sono atti del Senato pubblicati nel grafo Camera, con testo integrale, EuroVoc e primo firmatario su senatore.rdf. È la via per cercare per argomento le interrogazioni dei senatori, che il LOD Senato non permette.
tags: [camera, senato, aic, sindacato-ispettivo, ramo, eurovoc]
timestamp: 2026-07-29
---

Gli `ocd:aic` (atti di indirizzo e controllo) del grafo Camera **non sono solo della Camera**. Una quota consistente sono atti di **sindacato ispettivo del Senato**, pubblicati dalla Camera nel proprio grafo con la stessa classe e le stesse proprietà degli atti dei deputati.

Il segno è il **suffisso `_S`** nell'URI, e la proprietà che lo dichiara è `ocd:ramo`.

```
http://dati.camera.it/ocd/aic.rdf/aic3_02728_19_S   → atto Senato
http://dati.camera.it/ocd/aic.rdf/aic5_05673_19     → atto Camera
```

# Volumi (2026-07-29)

`ocd:ramo` ha due soli valori, e la copertura è quasi totale:

| Valore di `ocd:ramo` | Atti |
|---|---|
| `Camera dei Deputati` | 362.702 |
| `Senato della Repubblica` | 160.746 |

Per legislatura, gli atti privi di `ocd:ramo`: **leg. 19** 0 su 84.586, **leg. 18** 0 su 119.748, **leg. 17** 7.446 su 165.538 (4,5%). Quindi un filtro sul ramo è affidabile dalla 18 in avanti, mentre in 17 esclude per forza quel 4,5% — il ramo lì non è deducibile e non va indovinato.

# Perché conta: è la via per cercare per ARGOMENTO gli atti del Senato

Il sindacato ispettivo del Senato, interrogato sul **proprio** endpoint, non è cercabile per argomento (vedi [trappole Senato](../senato/trappole.md)). Nel grafo Camera invece gli stessi atti hanno:

- `dc:description` con il **testo integrale** dell'atto (premesse, quesito, risposta);
- `dcterms:subject` con i **soggetti EuroVoc** (`http://eurovoc.europa.eu/…`);
- `ocd:primo_firmatario` su `senatore.rdf/s<id>_<leg>`;
- `dcterms:isReferencedBy` e `dc:relation` verso il PDF ufficiale su `documenti.camera.it` (`ramo=senato`), verificato: restituisce la scheda "ATTO SENATO Sindacato Ispettivo" con testo, partecipanti e fasi dell'iter;
- `ocd:destinatario` verso l'organo di governo interrogato, `ocd:risposta` verso la risposta.

Quindi una ricerca per parola nel testo sugli `ocd:aic` **trova anche gli atti dei senatori**. Verificato: `aic list --keyword Navene` restituisce cinque atti `_S` il cui `rdfs:label` non contiene il termine (il label ha solo tipo, cognome, gruppo e data), quindi il match è avvenuto su `dc:description`.

Attenzione a non ribaltare il ragionamento: l'assenza di un atto Senato **qui** non prova che non esista. I due insiemi non sono perfettamente sovrapponibili (160.746 atti `_S` per le legislature 17-19 lato Camera; sul Senato la classe `osr:Atto` conta 19.949 record per la sola legislatura 19, ma copre tutti gli atti, non solo il sindacato ispettivo). Il confronto vale come ordine di grandezza, non come prova di completezza del mirror.

# Trappola sull'URL umano

Il pattern della scheda `aic.camera.it/aic/scheda.html?core=aic&numero=<n>&ramo=CAMERA&leg=<leg>` **non è verificabile** per il ramo Senato: l'applicazione risponde `200` a qualsiasi combinazione di parametri, quindi non si può stabilire dallo status se `ramo=SENATO` sia la forma corretta. Per gli atti `_S` il riferimento navigabile da usare è quello che il dato stesso fornisce, `dcterms:isReferencedBy` (il PDF), non un URL costruito a mano.

# Citations

[1] Valori e volumi di `ocd:ramo` sugli `ocd:aic` (2026-07-29):
```sparql
SELECT ?ramo (COUNT(*) AS ?n) WHERE {
  ?a a <http://dati.camera.it/ocd/aic> ; <http://dati.camera.it/ocd/ramo> ?ramo .
} GROUP BY ?ramo
```
Esito: `Senato della Repubblica` 160.746, `Camera dei Deputati` 362.702.

[2] Un atto `_S` con tutte le proprietà, incluso `ocd:ramo` e il testo (2026-07-29):
```sparql
SELECT ?p ?o WHERE { <http://dati.camera.it/ocd/aic.rdf/aic3_02728_19_S> ?p ?o }
```
Esito: `ocd:ramo` = `Senato della Repubblica`, `ocd:primo_firmatario` = `senatore.rdf/s308980_19`, `dc:description` = testo integrale (2.911 caratteri), otto `dcterms:subject` EuroVoc, `dcterms:isReferencedBy` = PDF su `documenti.camera.it` con `ramo=senato`.

[3] Atti senza `ocd:ramo` per legislatura (2026-07-29):
```sparql
SELECT (COUNT(?a) AS ?tot) (SUM(IF(BOUND(?r),1,0)) AS ?con_ramo) WHERE {
  ?a a <http://dati.camera.it/ocd/aic> ;
     <http://dati.camera.it/ocd/rif_leg> <http://dati.camera.it/ocd/legislatura.rdf/repubblica_17> .
  OPTIONAL { ?a <http://dati.camera.it/ocd/ramo> ?r }
}
```
Esito: leg. 17 → 165.538 / 158.092; leg. 18 → 119.748 / 119.748; leg. 19 → 84.586 / 84.586.
