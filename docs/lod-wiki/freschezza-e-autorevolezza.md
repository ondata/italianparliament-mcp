---
type: Gotcha
title: Freschezza del dato e cosa fa fede sull'approvazione
description: Il segnale di freschezza a livello di dataset è congelato, ma ods:modified per-record è vivo e misura la freschezza per area (Camera; il Senato non ne ha). Per l'esito (approvato/respinto/promulgato) la fonte di verità resta il resoconto/scheda iter/GU, non il grafo.
tags: [camera, senato, freschezza, autorevolezza, approvazione]
timestamp: 2026-07-29
---

Il LOD di Camera e Senato è una rappresentazione **derivata e pubblicata a lotti** dell'attività parlamentare, non la fonte primaria. Per gli usi giornalistici questo ha due conseguenze da tenere sempre presenti: (1) il grafo può essere **indietro** rispetto alla realtà, e (2) di quanto sia indietro si può sapere solo alla Camera, e solo guardando il posto giusto (`ods:modified` per-record, non `dcterms:modified` sui dataset).

# Perché a lotti: la provenienza del dato (conferma del gestore)

Il gestore del repository LOD della Camera ha confermato (scambio email, luglio 2026) l'architettura che spiega i comportamenti osservati sull'endpoint. Sono note di **provenienza**, non attribuite a persone: descrivono come è fatto il sistema.

- **L'ontologia OCD è datata.** La parte centrale del modello risale al **2009-2011**, con soli sviluppi parziali successivi (principalmente sulle **votazioni**). I dati riflettono quell'organizzazione: è la causa a monte per cui interi ambiti recenti risultano non modellati o modellati in modo grezzo.
- **Pubblicazione a valle di un processo distribuito.** Il repository/portale RDF è **l'ultimo anello** di una catena che parte dai **singoli produttori delle triple** (i gestori dei rispettivi database sorgente). Il sistema pubblica RDF **solo nel momento in cui riceve i dati** dai produttori. Non c'è quindi un ciclo di aggiornamento centralizzato e prevedibile: la freschezza dipende dal flusso a monte (e dalla disponibilità del personale interno).
- **Conseguenza sul segnale di freschezza.** Questo spiega perché `dcterms:modified` a livello di dataset è congelato (vedi sotto): un "ultimo caricamento" unico non esiste, perché il caricamento è per-lotto e per-produttore. Ma proprio per questo il segnale utile è **per-record**: `ods:modified` registra il lotto di ciascun record, quindi restituisce una freschezza **per area** — che è la granularità reale del processo descritto qui. Verificato il 2026-07-29 (sezione sotto): la divergenza tra aree è ampia e misurabile, esattamente come questa architettura fa prevedere.

Questa spiegazione **converge** con due assenze verificate in modo indipendente sull'endpoint: gli [emendamenti Camera assenti dal LOD](camera/assenti.md) e le [audizioni non strutturate come entità](camera/audizioni.md). Osservazione empirica ("il dato non c'è / è solo testo libero") e provenienza dichiarata dal gestore ("ontologia ferma, ambiti non modellati") descrivono lo stesso fenomeno da due lati.

# Freschezza: il segnale a livello di dataset è congelato, quello per-record è vivo

Due segnali distinti, che vanno tenuti separati. Il primo è quello che si cerca istintivamente e non serve a niente; il secondo funziona ed è quello da usare.

## `dcterms:modified` sui dataset: congelato (non usarlo)

Verificato il 2026-07-02 e riverificato il 2026-07-29 sui due endpoint.

- **Camera**: le risorse `ocd/dataset/*` espongono `dcterms:modified`, ma il valore è **congelato**. Sono 73 triple in tutto e riportano una data uniforme del **6–8 febbraio 2024**, pur descrivendo dataset che contengono dati fino a metà 2026. Il campo **non riflette l'ultimo caricamento reale**. Precisazione sul tipo (2026-07-29): quelle risorse sono `dcat:Dataset` (66) più un `dcat:Catalog`; di `void:Dataset` sull'endpoint non esiste **nessuna** istanza, quindi una query che parta da `void:Dataset` torna vuota.
- **Senato**: **nessun** metadato di freschezza sui dati. Le uniche 926 triple `dcterms:modified` presenti sono file interni dell'installazione Virtuoso (`http://localhost:8890/DAV//VAD/…`, datati 2012), non metadati parlamentari.

## `ods:modified` per-record: vivo, e misura la freschezza PER AREA

Verificato il 2026-07-29 sull'endpoint Camera. La proprietà `ods:modified` (`http://lod.xdams.org/ontologies/ods/modified`) è presente **su ogni record** di circa 24 classi `ocd:` e registra il **caricamento** di quel record. Non è un dettaglio: è il segnale di freschezza che a livello di dataset manca.

Tre riscontri indipendenti che si tratti davvero del caricamento e non di un campo interno:

1. **Copertura totale.** Sugli `ocd:aic`: 1.110.266 valori su 1.110.258 atti (le poche unità in più sono atti con due valori).
2. **Lotti giornalieri.** I valori si addensano in giornate di caricamento: 712 atti stampati il 28/07/2026, 122 il 26/07, 216 il 25/07, 852 il 23/07. È la firma di una pubblicazione a lotti, coerente con la provenienza dichiarata dal gestore (sopra).
3. **Coerenza con il contenuto.** Il `MAX(ods:modified)` di una classe cade il giorno dopo il contenuto più recente di quella classe: votazioni, ultimo voto 2026-07-23 → ultimo lotto 2026-07-24; sedute, ultima seduta 2026-06-17 → ultimo lotto 2026-06-18.

**Le aree divergono, e di molto.** Fotografia al 2026-07-29:

| Classe | Ultimo lotto |
|---|---|
| `ocd:atto`, `ocd:statoIter`, `ocd:assegnazione`, `ocd:aic`, `ocd:deputato`, `ocd:legge` | 2026-07-28 |
| `ocd:votazione`, `ocd:voto` | 2026-07-24 |
| `ocd:intervento`, `ocd:discussione`, `ocd:dibattito`, `ocd:seduta`, `ocd:allegatoDiscussione` | 2026-06-18 |
| `ocd:elezione` | 2026-03-28 |
| `ocd:DOC` | 2024-04-16 |

Il blocco dei **lavori d'Aula fermo al 18 giugno** mentre gli atti sono al 28 luglio non è un caso isolato: era già stato osservato a occhio nel luglio 2026 (sedute e discussioni indietro rispetto alle votazioni) e ora è **misurabile** invece che intuito. `ocd:DOC` fermo all'aprile 2024 dice che quell'area è di fatto abbandonata.

**Attenzione a non ribaltare il senso**: `ods:modified` dice quando il LOD ha *caricato*, non quando il Parlamento ha *fatto*. Un'area caricata ieri può comunque essere incompleta se il produttore a monte ha inviato un lotto parziale. È un limite superiore alla freschezza, non una garanzia di completezza.

## Conseguenza operativa

Quando una votazione o uno stato d'iter molto recente **non compare** nel grafo, l'assenza resta **ambigua** — (a) dato non ancora caricato, (b) dato strutturalmente assente (vedi [assenti Camera](camera/assenti.md)), (c) l'evento non è avvenuto — ma il caso (a) ora si può **escludere o confermare** confrontando la finestra cercata con il `MAX(ods:modified)` della classe pertinente. Un "non trovato" **non equivale** a "non è successo", e ora si può dire quale delle due spiegazioni regge.

Nella CLI questo confronto è automatico sul risultato vuoto (`src/core/freshness.ts`): quando c'è un filtro di date e non torna nulla, l'output dice fino a quando quell'area risulta caricata, distinguendo "finestra non ancora coperta" da "finestra coperta, quindi cerca altrove la causa". Il Senato, che non ha `ods:modified`, resta senza questo aiuto.

# Cosa fa fede sull'approvazione

Il LOD non è la fonte di verità sull'**esito** di un provvedimento. Per stabilire se qualcosa è approvato o no, l'ordine di autorevolezza è:

1. **Passaggio d'aula in un ramo** (approvato/respinto da Camera *o* Senato): fa fede il **resoconto stenografico dell'Assemblea** della seduta, e in second'ordine la **scheda dell'iter** sul sito istituzionale (Camera: "Progetti di legge"; Senato: "scheda DDL"). Il LOD rispecchia questi (`ocd:rif_statoIter` / `osr:statoDdl`, `ocd:votazione` voto finale) **con ritardo**.
2. **Legge definitivamente approvata e promulgata**: fa fede la pubblicazione in **Gazzetta Ufficiale** (normattiva.it / gazzettaufficiale.it).

## Distinzione critica: "approvato da un ramo" ≠ "legge"

È l'errore classico. Un DDL **approvato solo alla Camera** (o solo al Senato) **non è ancora legge**: torna all'altro ramo e l'iter prosegue. Solo l'approvazione nel **medesimo testo da entrambi i rami**, seguita da promulgazione e pubblicazione in GU, produce una legge. Nel LOD:

- `osr:statoDdl` / `ocd:rif_statoIter` descrivono lo **stato nel ramo**, non lo stato complessivo del provvedimento tra i due rami.
- "Approvato" in un ramo va sempre qualificato ("approvato dalla Camera", "passato al Senato"), mai reso come "approvata la legge".

# Regola per il tool

Per fatti **time-sensitive sull'esito** (approvato / respinto / promulgato di eventi delle ultime ore o giorni), **non affidarsi al solo LOD**: incrociare con resoconto stenografico, scheda iter istituzionale o GU. Il LOD resta ottimo per **struttura, anagrafica e storico**; non è la fonte di verità istantanea sull'esito.

# Citations

[1] Camera — `dcterms:modified` congelato a feb 2024 su dataset vivi (2026-07-02):
```sparql
SELECT ?ds ?mod WHERE {
  ?ds <http://purl.org/dc/terms/modified> ?mod .
  FILTER(CONTAINS(STR(?ds), "dataset"))
} ORDER BY DESC(?mod)
```
Esito: date uniformi `2024-02-06/07/08` (es. `dataset/stato-iter-19` = `2024-02-07`), mentre i dati arrivano a metà 2026.

[2] Senato — nessun `void:Dataset` con `dcterms:modified`; le triple presenti sono interni Virtuoso (2012):
```sparql
SELECT ?s ?o WHERE { ?s <http://purl.org/dc/terms/modified> ?o } ORDER BY DESC(?o) LIMIT 12
```
Esito: soggetti `http://localhost:8890/DAV//VAD/fct/…`, non dati parlamentari.

[3] Camera — `void:Dataset` non esiste come classe istanziata, i dataset sono `dcat:Dataset` (2026-07-29):
```sparql
SELECT (COUNT(DISTINCT ?ds) AS ?n) WHERE { ?ds a <http://rdfs.org/ns/void#Dataset> }
```
Esito: `0`. Con `?s dcterms:modified ?m ; a ?t` i tipi sono `dcat:Dataset` (66), `dcat:Catalog` (1), più `owl:Ontology`/`voaf:Vocabulary`/`owl:NamedIndividual` (6 ciascuno).

[4] Camera — freschezza per area via `ods:modified` (2026-07-29):
```sparql
SELECT ?t (COUNT(*) AS ?n) (MAX(?m) AS ?ultimo_lotto) WHERE {
  ?s <http://lod.xdams.org/ontologies/ods/modified> ?m ; a ?t .
} GROUP BY ?t ORDER BY DESC(?n)
```
Esito: ~24 classi, con `MAX` divergente per area (tabella sopra). Per una singola area basta la forma mirata:
```sparql
SELECT (MAX(?m) AS ?ultimo_lotto) WHERE {
  ?s a <http://dati.camera.it/ocd/votazione> ; <http://lod.xdams.org/ontologies/ods/modified> ?m .
}
```

[5] Camera — i valori si addensano in lotti giornalieri (2026-07-29):
```sparql
SELECT (SUBSTR(STR(?m),1,10) AS ?giorno) (COUNT(*) AS ?atti) WHERE {
  ?a a <http://dati.camera.it/ocd/aic> ; <http://lod.xdams.org/ontologies/ods/modified> ?m .
  FILTER(STR(?m) > "2026-07-15")
} GROUP BY SUBSTR(STR(?m),1,10) ORDER BY DESC(?giorno)
```
Esito: 712 atti il 2026-07-28, 122 il 26, 216 il 25, 216 il 24, 852 il 23 — nessun caricamento il 27 e il 18.

[6] Senato — nessun `ods:modified` sui DDL (2026-07-29):
```sparql
SELECT (COUNT(*) AS ?n) WHERE {
  ?s a <http://dati.senato.it/osr/Ddl> ; <http://lod.xdams.org/ontologies/ods/modified> ?m .
}
```
Esito: `0`. Nessun predicato che contenga `modif`/`aggiorn`/`updat`/`timestamp` sui DDL.
