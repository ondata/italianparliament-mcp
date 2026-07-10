---
type: Gotcha
title: Emendamenti al Senato — firmatario assente dal LOD, presente nell'AKN
description: osr:Emendamento NON espone il firmatario/proponente nel LOD; il dato esiste solo nel testo AKN linkato da osr:URLTestoXml (dietro WAF).
resource: https://dati.senato.it/sparql
tags: [senato, osr, emendamenti, firmatario, assenti, waf]
timestamp: 2026-07-05
---

Al Senato gli emendamenti **sono** nel LOD come classe `osr:Emendamento` (a differenza della Camera, dove non esistono affatto nel LOD — vedi [assenti Camera](../camera/assenti.md)). Ma il **firmatario/proponente non c'è**.

# Cosa espone `osr:Emendamento` (e cosa no)

Verificato il 2026-07-05 su un campione di 200 istanze: le uniche proprietà sono

- `osr:numero`, `osr:tipo`, `osr:legislatura`, `osr:flagCommissione`
- `osr:URLTesto` (link testo HTML), `osr:URLTestoXml` (link testo AKN/Akoma Ntoso)
- `osr:oggetto` → `osr:OggettoTrattazione` (che ha solo `osr:relativoA` → DDL, `osr:legislatura`, `type`)
- `rdf:type`, `rdfs:label`

**Nessuna proprietà di firmatario** sull'emendamento né sull'oggetto, e **nessuna relazione inversa** senatore→emendamento (query `?sen ?p ?e . ?e a osr:Emendamento` → vuota). L'assenza è reale a monte, non un limite di query.

Nota performance: lo scan dataset-wide `SELECT DISTINCT ?p WHERE { ?s a osr:Emendamento . ?s ?p ?o }` va in timeout su Virtuoso; usare un campione bounded (`{ SELECT ?s WHERE {...} LIMIT 200 } ?s ?p ?o`).

# Il dato esiste fuori dal LOD: il testo AKN

Il proponente è nel testo **AKN (Akoma Ntoso)** puntato da `osr:URLTestoXml`. Verificato su `emendamento/1067383` (`.../Emendc/01366896/01364883.akn`): l'header porta i nomi in chiaro (es. «Amidei Ancorotti Fallucchi Maffoni Silvestroni») e i tag strutturati

```xml
<an:TLCRole id="tipoSenatore" href="http://dati.senato.it/Senatore" showAs="Senatore"/>
<an:docProponent refersTo="#ID0E5" as="#tipoSenatore"/>
<an:docProponent refersTo="#ID0EIB" as="#tipoSenatore"/>
...
```

Il **primo** `an:docProponent` è il primo firmatario, i successivi i cofirmatari.

Trappola accesso: `www.senato.it` è **dietro AWS WAF** — `curl` diretto restituisce 403 (301→CloudFront in HTTP, 403 in HTTPS). Il recupero richiede un fetch browser-class (agente browser con token WAF), non `curl`.

# Conseguenza per il tooling — RISOLTO (2026-07-10)

Il tool `amendments` ora espone il proponente con `withProponents`/`--with-proponents`: il testo AKN si recupera **senza WAF** dal bulk GitHub del Senato ([[akn-bulk-data]]) convertendo `osr:URLTestoXml` in URL raw (pura sostituzione di stringa: ultimo segmento → `<path atto>/emend[c]/<id>-em.akn.xml`, con `osr:flagCommissione` a decidere `emend/` vs `emendc/`). Simmetria raggiunta con `camera-amendments` (`first_signatory`). Il limite LOD a monte resta: nessun firmatario emendamento nel grafo di nessuna delle due camere.

Colonne emesse: `first_proponent`/`proponents` (nomi) **e** `first_proponent_uri`/`proponents_uri` (URI `dati.senato.it/<id>` da `an:TLCPerson`, stesso ordine dei nomi): l'URI è ciò che permette il join con altri tool (es. risalire alla scheda del senatore), il nome da solo non basta (omonimie, forma non normalizzata).

## Due varianti del markup docProponent (verificate 2026-07-10)

- **File d'Assemblea** (`emend/`): nome come testo diretto del tag — `<an:docProponent ...>DI GIROLAMO</an:docProponent>`.
- **File di Commissione** (`emendc/`): nome annidato in un `<an:span>` dentro il tag. In entrambi i casi `an:TLCPerson` (via `refersTo`) dà l'`href` (URI persona `dati.senato.it/<id>`) e `showAs` col **nome completo** ("Bartolomeo Amidei" contro "Amidei" nel testo): preferire `showAs`.

## File stub vuoti

Alcuni file del bulk sono **stub vuoti** (solo l'elemento `akomaNtoso` autochiuso, ~295 byte): es. `Leg19/Atto00060233/emend/01511907-em.akn.xml` (odg G1.17). Il file esiste (HTTP 200) ma non ha numero né proponenti: gap della fonte, non dell'estrazione. `parseAknAmendment` non lancia mai su questi file (torna solo campi vuoti) — per design, indistinguibile da un vero fallimento di fetch a livello di singola riga.

## Outage sistematico vs vuoto legittimo

`enrichProponents` (in `amendments.ts`) distingue i due casi a livello di finestra: un singolo fetch fallito (rete, 404) lascia la riga vuota senza bloccare le altre; se **tutti** i fetch della finestra falliscono, è quasi certamente un'irraggiungibilità di GitHub (es. dal Worker, cfr. [[akn-bulk-data]] "verifiche pendenti") e il tool lancia un errore esplicito invece di restituire righe silenziosamente vuote indistinguibili dal caso legittimo.

# Citations

[1] Verifica 2026-07-05: proprietà di `osr:Emendamento` (campione 200) e assenza legame senatore→emendamento; endpoint `dati.senato.it/sparql`. Testo AKN `emendamento/1067383` recuperato via agente browser (WAF): 5 `an:docProponent`.
[2] Verifica 2026-07-10: `amendments list --ddl-uri http://dati.senato.it/ddl/56260 --with-proponents` → em. 1.30 "Bartolomeo Amidei" + 5 proponenti (stesso caso di [1], ora senza browser); Piano Casa `ddl/60233` con proponenti da `emend/` (testo diretto) e `emendc/` (span annidato).
