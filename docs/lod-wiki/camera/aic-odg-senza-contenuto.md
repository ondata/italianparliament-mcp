# Ordini del giorno presenti come nodi ma senza contenuto

Nel dataset `ocd:aic` ci sono **4.950 risorse prive di `rdfs:label`**, e **4.944** sono ordini del giorno (URI col prefisso `aic9_`). Hanno solo il tipo, un `ods:modified` e `ocd:rif_attoCamera`: niente titolo, data, testo, firmatario, ramo. Le proprietà di contenuto ce le hanno appena 28 su 4.950.

Il tool `aic` li **esclude** — la query richiede `rdfs:label` — ed è la scelta giusta: righe senza titolo né data sono inservibili in un elenco. Ma va saputo, perché il conteggio ne risente.

## Le misure (8 agosto 2026)

| | |
|---|---:|
| `ocd:aic` nel grafo | 555.702 |
| con `rdfs:label` (quel che il tool conta) | 550.752 |
| **senza label** | **4.950** |
| di cui ordini del giorno (`aic9_`) | 4.944 |
| ordini del giorno **con** label, per confronto | 79.039 |
| atti su cui insistono gli ODG muti | **520** |

Quindi è il 6% degli ordini del giorno, meno dell'1% del totale AIC — ma **concentrato**: punte di 125 su un solo atto (`ac18_1117`), poi 119, 101, 99, 96.

## Sono reali: la prova sta nelle votazioni

Su `ac18_1117` gli ODG con label sono **zero** e i muti **125**: non è un caricamento parziale, è l'intero blocco. Che siano reali lo dice lo stesso grafo, in un'altra classe:

```sparql
SELECT (COUNT(DISTINCT ?v) AS ?votazioni) WHERE {
  ?v a <http://dati.camera.it/ocd/votazione> ;
     <http://purl.org/dc/elements/1.1/description> ?d .
  FILTER(CONTAINS(STR(?d), "9/1117/"))
}
```

→ **125**, esattamente quanti i muti. E le descrizioni portano il proponente, cioè proprio ciò che manca al record: *"Ordine del giorno n. 9/1117/41 QUARTAPELLE PROCOPIO LIA (PD)"*, votato il 14 settembre 2018.

**Attenzione al limite della prova**: vale dove gli ODG furono votati. Su `ac17_1248` i muti sono 101 e le votazioni che li citano zero — ma non prova nulla al contrario, perché moltissimi ordini del giorno sono accolti come raccomandazione senza voto.

## Mancano anche all'applicazione documenti

`getDocumento.ashx` con `idDocumento=9/01117/041` restituisce risposta vuota, mentre un ODG della stessa legislatura dotato di label (`9/00484-A/002`) restituisce 11.370 byte. Il buco è quindi a monte e colpisce sia il LOD sia l'app documenti.

Margine di incertezza dichiarato: per i muti l'identificativo del documento è **ricostruito per analogia** (`aic9_<atto>_<seq>_<leg>` → `9/<atto>/<seq>`), non essendoci `dcterms:isReferencedBy` da cui leggerlo.

Due trappole incontrate nel verificarlo, entrambe capaci di produrre una risposta plausibile e falsa: `curl` senza `-L` restituisce 0 byte per **tutti** gli ODG (il servizio risponde 301), e senza un controllo su un ODG della stessa legislatura si rischia di scambiare una copertura mancante del servizio per un buco sul singolo atto.

## Conseguenza pratica

Su quei 520 atti, «quanti ordini del giorno sono stati presentati su questo provvedimento» dà un numero **più basso del reale**, a volte di oltre cento, senza che nulla segnali l'incompletezza. Per una conta attendibile su un singolo atto conviene passare dalle votazioni (`CONTAINS(?description, "9/<numero atto>/")`), che è anche l'unico modo di risalire al proponente.

Segnalato ai gestori: punto 9 di `docs/note-gestori-lod/camera-assistenza-dati.md` (cartella non versionata).
