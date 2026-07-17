---
type: Schema Absence
title: Assenti verificati — Camera (OCD)
description: Dati che NON esistono nel LOD OCD della Camera, verificati sull'endpoint.
tags: [camera, ocd, assenti]
timestamp: 2026-07-01
---

Questa pagina elenca ciò che **non esiste** nel LOD OCD della Camera, verificato sull'endpoint. Serve a impedire relazioni plausibili ma inesistenti: se un dato è qui, non va cercato via SPARQL.

# Emendamenti

Gli **emendamenti della Camera non sono modellati nel LOD OCD**. Verificato il 2026-07-01 su `https://dati.camera.it/sparql` (**37.317** `ocd:votazione` in leg. 19).

- Nessuna classe emendamento **riscontrata tra i tipi OCD istanziati** (`SELECT DISTINCT ?class` sui tipi `http://dati.camera.it/ocd/*`); classi atto-correlate presenti: `ocd:atto`, `ocd:versioneTestoAtto`, `ocd:statoIter`, `ocd:votazione`, `ocd:discussione` — nessuna per l'emendamento. Il precedente numero "47 tipi RDF instanziati" è stato rimosso perché non più verificato con affidabilità sul dataset corrente.
- `ocd:natura` degli atti ha **solo 3 valori**: *Disegno di legge ordinario*, *Proposta di legge costituzionale*, *Proposta di legge ordinaria*. L'emendamento non è una natura di atto.
- Gli emendamenti compaiono **solo come testo libero** nel `dc:description` delle `ocd:votazione`, e **solo quando votati** (recuperabili con `votes list --bill-code`). Non esiste l'entità "emendamento depositato".

**Conseguenza operativa**: il tool `amendments` (oggi `osr:Emendamento`, solo Senato) non è estendibile alla Camera via SPARQL — non c'è dato da interrogare. Vedi issue #19. Per gli emendamenti *votati* si può risalire dal testo delle votazioni collegate all'atto.

**Conferma dal gestore** (scambio email, luglio 2026): gli emendamenti **non sono proprio presenti nel repository** RDF. L'assenza non è un limite di query o di tooling: il dato non è modellato a monte. Coerente con la causa strutturale generale — l'ontologia OCD ha la parte centrale ferma al 2009-2011 (vedi [freschezza e provenienza](../freschezza-e-autorevolezza.md)) — quindi un ambito recente come gli emendamenti non ha mai ricevuto una classe dedicata.

## Il dato esiste fuori dal LOD: l'app HTML `getProposteEmendative`

Verificato il 2026-07-05 (browser + curl): pur **assenti dal LOD**, gli emendamenti Camera sono pubblicati integralmente dall'app HTML `https://documenti.camera.it/apps/emendamenti/getProposteEmendative.aspx`, **attiva anche per la legislatura 19**, per singolo atto e per sede (referente/Assemblea), con articolo, numero, primo firmatario e link al testo del singolo emendamento.

- **Le liste emendamento sono solo HTML**: la pagina `getProposteEmendative.aspx` è HTML renderizzato lato server (solo il documento `.aspx` + asset statici, zero XHR/JSON). I singoli emendamenti (numero, articolo, firmatari, testo, esito) sono fruibili **solo via scraping**. Il conteggio "(N)" nell'intestazione è calcolato lato client (JS): via `curl` risulta vuoto — non affidabile. (Nota: esistono però endpoint XML pubblici a livello di *indice* — vedi l'aggiornamento 2026-07-12 sotto.)
- **URL non costruibile a mano**: i codici sede/lettura dell'URN (`tipoSeduta`, `sedeEsame`, il ramo `A`, il codice commissione `com:NN`) non sono derivabili dal solo numero d'atto. L'URL corretto va **estratto dalla scheda atto** (`www.camera.it/leg{leg}/126?idDocumento={num}` → pulsante EMENDAMENTI → sezioni "in sede referente"/"in Assemblea" → link `getProposteEmendative.aspx`). La scheda espone quei link **lato server** (recuperabili via curl).
- **Àncore stabili per il parsing**: intestazione articolo `tr.rigaArticoloNormale` con `id="cmd.art..<ART>.<n>"`; singolo emendamento `tr.normale` con `id="tr.id...."`, link numero `a[href*="idPropostaEmendativa="]`, firmatario `a[href*="idPersona="]`. Contare `idPropostaEmendativa` = conteggio esatto (verificato: AC 2696 → referente 37, Assemblea 25, coincide col numero mostrato dal browser).
- **Esito**: non presente nelle liste cumulative "in ordine di pubblicazione" (cella vuota); vive nella vista per-seduta `getProposteEmendativeSeduta.aspx?...&dataSeduta=YYYYMMDD`.

Il tool `camera-amendments` (dalla v0.14.0) implementa questa pipeline (cheerio/slim). Advocacy verso il gestore: il dato strutturato esiste già a monte per generare quelle pagine, esporlo come LOD (o endpoint JSON/XML per-atto) avrebbe costo marginale e colmerebbe l'asimmetria con il Senato (`osr:Emendamento`).

Nota Senato: l'emendamento esiste come `osr:Emendamento`, ma il dataset appare non popolato per i DDL 2026 (solo inizio legislatura). Da tracciare a parte.

## Aggiornamento 2026-07-12: mappa completa dell'app `apps/emendamenti` ed endpoint XML

Esplorazione integrale dell'app (browser + curl, leg. 19, caso reale AC 2236 il cui atto portante emendato è **AC 2822**). La radice `https://documenti.camera.it/apps/emendamenti/` è un **indice di tutti gli atti con emendamenti elaborati** ("Prototipo degli emendamenti — Gestione interna degli XML"): tabella `ATTO CAMERA | DATA CREAZIONE | DATA MODIFICA` con ~373 righe per la leg. 19. Ogni riga ha sei pulsanti:

- **Scheda** → `apps/CommonServices/getDocumento.ashx?sezione=lavori&tipoDoc=pdl&idLegislatura=19&idDocumento={N}` — il PDF del testo del progetto di legge (l'atto "portante"), non gli emendamenti. Risponde `302` verso il file.
- **Emendamenti** → `apps/emendamenti/ostr/19?attoportante=leg.19.eme.ac.{N}` — pagina-indice (HTML) coi *quick-link* agli elenchi emendamenti per sede e per seduta (contiene i link `getProposteEmendative.aspx` / `getProposteEmendativeSeduta.aspx`).
- **Vecchia Scheda** → `getDocumento.ashx?old=old&...&idDocumento={N}` — versione precedente/storica del PDF della scheda del pdl.
- **Nuovi Emendamenti** → `ostr/19?attoportante=leg.19.eme.ac.{N}&new=new` — stessa pagina-indice degli emendamenti, layout/UI nuova.
- **Nuovi Emendamenti By Proxy** → `apps/emendamenti/proxySito?leg=19&pdl={N}&new=new&url=assoluto&cache=false` — **restituisce XML** (`application/xml`): elemento `<gruppoEmendamenti>` con sede (`sedeReferente`/organo "in I Commissione"), testo di riferimento e l'elenco delle **sedute con numero di Bollettino** e relativo `href` alla vista per-seduta. È l'indice sedi/sedute in forma machine-readable (non i singoli emendamenti).
- **Elenchi Testi** → `apps/emendamenti/export-elenco-testi-riferimento?leg=19&pdl={N}&organo=commissione` — **restituisce XML** (`<testiRiferimento>`): i testi di riferimento e gli "stampati" (una `<stampato>` per seduta) con `dataSeduta`, `numero` bollettino, `dataProcessamento`, `dataTimeStamp`. Con `pdl` errato torna `<process status="ko">`; usare l'atto **portante** (qui 2822, non 2236).

Esiste inoltre un **Web Service SOAP documentato** in `apps/emendamenti/docs` (metodi `xmlEmendamenti`, `getEmendamenti`, `getEmendamentiSeduta`, `getEmendamento`, `getElenco`, con `tipologiaContenuto=xml|xhtml`), ma la pagina avverte che i metodi sono "utilizzabili solo localmente alla macchina server": il SOAP puro **non risulta invocabile dall'esterno**, va trattato come non-pubblico finché non verificato diversamente.

**Cosa si ottiene aprendo i link foglia — e non è ancora nella CLI** (`camera-amendments` oggi espone solo: sede, articolo, numero, *primo* firmatario, identici, `text_url`):

- **Testo integrale del singolo emendamento** — `getPropostaEmendativa.aspx?...&idPropostaEmendativa={num}` (HTML). Esempio reale (AC 2822, em. 1.1.): *"Sopprimerlo."* La CLI oggi dà solo il link, non il testo.
- **Tutti i firmatari/cofirmatari** — la stessa pagina del singolo emendamento li elenca tutti (es. 1.1.: Bonafè, Colucci, Zaratti, Boschi, Magi), mentre la lista cumulativa mostra solo il primo. Colma il gap "solo primo firmatario".
- **Esito** (approvato/respinto/ritirato/inammissibile/…) — vista **per-seduta** `getProposteEmendativeSeduta.aspx?...&dataSeduta=YYYYMMDD`. Esempio reale (AC 2822, seduta 23/06/2026): em. 1.151 (Montaruli e altri) → **approvato**. Le date-seduta si scoprono in modo strutturato dall'XML di `proxySito`/`export-elenco-testi-riferimento`.
- **Bollettino delle Giunte e Commissioni** di pubblicazione — presente sia nel testo del singolo emendamento sia negli XML indice.

Sintesi integrabilità: il valore aggiunto (testo, cofirmatari, esito) resta recuperabile **solo via scraping HTML** dei link foglia; i due endpoint XML (`proxySito`, `export-elenco-testi-riferimento`) sono utili per **orchestrare le sedute** senza parsing HTML. Miglioria naturale del tool esistente (non un tool nuovo): arricchire `camera-amendments` con **esito**, **cofirmatari** e opzionalmente **testo**. Nulla di ciò è derivabile dai tool attuali.

## Aggiornamento 2026-07-17: la scheda atto storica perde il link diretto, ma l'indice ostr resta interrogabile

La riga 28 sopra assume che la scheda atto esponga sempre il link `getProposteEmendative.aspx` lato server. Non è più vero per le legislature vecchie: verificato su AC 2402 (decreto Covid, leg.18, `www.camera.it/leg18/126?idDocumento=2402`), il bottone "Emendamenti" punta oggi a `https://www.camera.it/ricerca-emendamenti` (motore di ricerca generico, non un link diretto alla lista dell'atto) — `camera-amendments` restituiva **0 righe senza errore**, pur esistendo 54+53 emendamenti alla fonte (confermato l'emendamento Locatelli 1.52 citato dalla stampa dell'epoca).

L'indice per-atto `apps/emendamenti/ostr/{leg}?attoportante=leg.{leg}.eme.ac.{num}` (già mappato sopra, 2026-07-12) **contiene comunque** i link diretti `getProposteEmendative.aspx` per referente e Assemblea, indipendentemente dal fatto che la scheda atto li esponga o meno. Dalla v successiva alla 0.25.3, `camera-amendments` prova prima la scheda atto e, se valida ma senza il link diretto, usa questo indice come fallback — nessun nuovo tool, stessa pipeline di scraping.

# Citations

[1] Enumerazione dei tipi OCD (2026-07-01), usata come controprova dell'assenza di `ocd:emendamento`:
```sparql
SELECT DISTINCT ?class WHERE {
  ?s a ?class .
  FILTER(STRSTARTS(STR(?class), "http://dati.camera.it/ocd/"))
}
```
Verifica diretta minima:
```sparql
PREFIX ocd: <http://dati.camera.it/ocd/>
SELECT ?s WHERE { ?s a ocd:emendamento . } LIMIT 1
```
[2] Valori di `ocd:natura` degli atti (2026-07-01):
```sparql
SELECT DISTINCT ?l WHERE {
  ?n a <http://dati.camera.it/ocd/natura> .
  ?n <http://www.w3.org/2000/01/rdf-schema#label> ?l
}
```
[3] Esempio di emendamento presente solo come testo libero in votazione (2026-07-01):
```sparql
PREFIX ocd: <http://dati.camera.it/ocd/>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
SELECT ?v ?d WHERE {
  ?v a ocd:votazione ; dc:description ?d .
  FILTER(CONTAINS(LCASE(?d), "emendamento"))
}
LIMIT 3
```
[4] Issue: https://github.com/ondata/italianparliament-mcp/issues/19
