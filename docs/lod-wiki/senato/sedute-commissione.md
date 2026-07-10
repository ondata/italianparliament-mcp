---
type: Entity Map
title: Sedute e attività delle commissioni — Senato (OSR)
description: Schema per interrogare le sedute di commissione Senato per commissione e per data (non solo per DDL).
resource: http://dati.senato.it/osr/SedutaCommissione
tags: [senato, osr, commissione, seduta, attività]
timestamp: 2026-07-01
---

Le sedute di commissione del Senato sono modellate come `osr:SedutaCommissione` e sono interrogabili **per commissione** e **per intervallo di date**, non solo a partire da un DDL (che è l'unico modo offerto dal tool `committee-sessions` con `--ddl-uri`).

# Entità e proprietà

## osr:SedutaCommissione

| Proprietà | Tipo | Note |
|-----------|------|------|
| `osr:dataSeduta` | `xsd:date` | data della seduta; `FILTER` con `"AAAA-MM-GG"^^xsd:date` |
| `osr:tipoSeduta` | stringa | `antimeridiana` / `pomeridiana` |
| `osr:commissione` | URI → `osr:Commissione` | commissione presso cui si tiene la seduta |
| `osr:legislatura` | integer | es. `19` (nudo, non stringa) |

## osr:Commissione

| Proprietà | Tipo | Note |
|-----------|------|------|
| `osr:titolo` | stringa | denominazione estesa |
| `osr:titoloBreve` | stringa | denominazione breve (es. "Giustizia") |
| `osr:sottotitolo` | stringa | es. "(Art. 24 del Regolamento)" |

> ⚠️ **Niente `rdfs:label`**: `Commissione` non ha `rdfs:label`. Usare `osr:titolo`/`osr:titoloBreve`. (Verificato 2026-07-01.)

## osr:Intervento

Collegato alla seduta via `osr:seduta`. Per contare gli interventi di una seduta: `?int a osr:Intervento ; osr:seduta ?seduta`.

# Query Template — sedute di una commissione per data

```sparql
PREFIX osr: <http://dati.senato.it/osr/>
SELECT ?seduta ?date ?tipo (MIN(?tb) AS ?commName)
       (COUNT(DISTINCT ?int) AS ?interventi)
WHERE {
  ?seduta a osr:SedutaCommissione ;
          osr:commissione <COMMISSIONE_URI> ;
          osr:dataSeduta ?date .
  OPTIONAL { ?seduta osr:tipoSeduta ?tipo }
  OPTIONAL { <COMMISSIONE_URI> osr:titoloBreve ?tb }
  OPTIONAL { ?int a osr:Intervento ; osr:seduta ?seduta . }
}
GROUP BY ?seduta ?date ?tipo
ORDER BY DESC(?date)
```

Filtri opzionali (intervallo date):

```sparql
FILTER( ?date >= "2026-05-01"^^xsd:date && ?date <= "2026-05-31"^^xsd:date )
```

# Trappole

| Trappola | Dettaglio |
|----------|-----------|
| **Nome proprietà `dataSeduta`, non `data`** | `osr:data` non esiste; usare `osr:dataSeduta`. |
| **`osr:dataSeduta` è `xsd:date` tipizzato** | `FILTER` con `"AAAA-MM-GG"^^xsd:date`. |
| **Doppia etichetta della commissione** | Una `Commissione` può avere **più `osr:titoloBreve`** (es. `commissione/0-2` → "Giustizia" **e** "Giustizia e autorizzazioni a procedere"). Non mettere `?comm`/`?tb` nel `SELECT` senza aggregazione, altrimenti ogni seduta si duplica. Usare `MIN(?tb)` + `GROUP BY` senza `?comm`. |
| **`SAMPLE` non supportato** | Virtuoso Senato rifiuta `SAMPLE` (400). `MIN`/`MAX`/`COUNT` funzionano. |
| **Niente `BIND`** | Come da [[trappole]] generali del Senato. |

# Ricerca commissione per nome

`osr:Commissione` non ha `rdfs:label`; cercare su `osr:titoloBreve`:

```sparql
SELECT ?committee_uri ?titoloBreve WHERE {
  ?committee_uri a osr:Commissione ; osr:titoloBreve ?titoloBreve .
  FILTER( CONTAINS(LCASE(?titoloBreve), LCASE("giustizia")) )
}
```

# Il dato manca dal LOD, ma esiste fuori: le liste JSON dei sommari (`listasommcomm`)

Lo SPARQL espone **solo** data/tipo/commissione/legislatura (nessun titolo, ordine del giorno o link al resoconto) — **confermato dal Webmaster del Senato via email il 2026-07-06** in risposta a una richiesta di arricchimento. Nella stessa risposta il Webmaster ha però indicato una fonte **non documentata** che colma il buco: le liste JSON statiche dei sommari di commissione usate dal sito.

## URL

```
https://www.senato.it/static/bgt/listasommcomm/<TIPO_COD_COMM>/<COD_COMM>/t/<NUM_LEG>/<ANNO>/index.json
```

Esempio (1ª Affari Costituzionali, leg. 19, 2026): `https://www.senato.it/static/bgt/listasommcomm/0/1/t/19/2026/index.json`

| Segmento | Significato | Fonte |
|----------|-------------|-------|
| `<TIPO_COD_COMM>` | tipo codice commissione (es. `0`) | dai record JSON (`tipo_cod_comm`) o dallo SPARQL per commissione |
| `<COD_COMM>` | codice commissione (es. `1`) | idem (`cod_comm`) |
| `<NUM_LEG>` | legislatura (es. `19`) | — |
| `<ANNO>` | anno (es. `2026`) | — |

> ⚠️ **Dietro AWS WAF**: `curl` riceve **HTTP 202 a corpo vuoto** (challenge anti-bot). Recuperabile solo via browser reale (agent-browser) → vedi [[trappole]] / pattern WAF. Il Webmaster raccomanda di **non fare richieste troppo ravvicinate**, pena blocco temporaneo dei sistemi di sicurezza (limite numerico esatto richiesto via email, in attesa di riscontro).

## Schema

```
{ "organo": { numeraz_comm_perm, dizione_breve_comm, diz_combinata_breve_comm, progr, layout },
  "elenco": [ { "mese": "...", "sottoelenco": [ { …seduta… } ] } ] }
```

`elenco` è raggruppato per mese; ogni seduta (`sottoelenco[]`) espone:

| Campo | Note |
|-------|------|
| `id_testo` | **chiave del resoconto/sommario** → costruisce l'URL del testo (sotto) |
| `num_sed_comm` | numero progressivo della seduta di commissione |
| `data_seduta` / `sdata` | `GG-MM-AAAA` / stringa estesa |
| `ora_inizio` / `ora_fine` | orari (assenti dal LOD) |
| `tipo_seduta` | `A` antimeridiana / `P` pomeridiana |
| `descr_tipo_veste` | **veste della seduta**: Commissione Plenaria, Ufficio di Presidenza…, Comitato Ristretto, Sottocommissione per i pareri |
| `diz_raggr` | sedute congiunte (es. "1ª (Aff. costituzionali) e 2ª (Giustizia)") |
| `tipo_cod_comm` / `cod_comm` | codici da riusare nell'URL |

Verificato 2026-07-06: 141 sedute su 7 mesi per la 1ª Commissione, leg. 19, 2026.

## Link al resoconto (sommario dei lavori) da `id_testo`

```
https://www.senato.it/show-doc?leg=<NUM_LEG>&tipodoc=SommComm&id=<id_testo>&idoggetto=0
```

Es. `id_testo=1512635` → `https://www.senato.it/show-doc?leg=19&tipodoc=SommComm&id=1512635&idoggetto=0`. È l'equivalente Senato del bollettino Camera (`ocd:rif_bollettino`), che qui non passa dal LOD.

**Restano assenti ovunque** (né SPARQL né JSON): senatori presenti a ciascuna seduta e persone/enti auditi (richiesti nella stessa email).

## Mapping URI commissione → path JSON (confermato 2026-07-09)

`<TIPO_COD_COMM>` e `<COD_COMM>` **coincidono** con i due segmenti dell'URI `osr:Commissione`: `commissione/<tipo_cod_comm>-<cod_comm>`. Es. `commissione/0-148` (Affari sociali, sanità) → `listasommcomm/0/148/t/19/2026/index.json`. Non serve una tabella di conversione separata: l'URI SPARQL della commissione dà già i due codici.

## `descr_tipo_veste` — nessuna categoria "audizione" (verificato su 2 commissioni, 2026-07-09)

Testato via agent-browser (WAF, `curl` bloccato) su 1ª (Affari Costituzionali, 149 sedute 2026) e 10ª (Affari sociali/sanità, 125 sedute 2026) — commissione scelta apposta perché tipicamente audizioni-intensiva. In **entrambe**, `descr_tipo_veste` ha solo gli stessi 4 valori (Commissione Plenaria, Ufficio di Presidenza integrato dai rappresentanti dei Gruppi, Sottocommissione per i pareri, Comitato Ristretto) e **zero occorrenze** di "audiz" in tutto il JSON (`grep -i audiz` su entrambi i file → 0 match). La classificazione JSON non distingue mai un'audizione come tipo di seduta.

## Testo integrale del resoconto (`&part=doc_dc`) — scrapeable, ma nessun esempio positivo ancora trovato

Il link `Documento completo` sulla pagina `show-doc` porta a `show-doc?...&part=doc_dc`, che espone il **testo integrale** del resoconto sommario: intestazioni di trattazione (`IN SEDE REFERENTE`, `IN SEDE CONSULTIVA`, `PROGRAMMAZIONE DEI LAVORI`, `SCONVOCAZIONE DI SEDUTA` — stessa logica del `dc:type`/fase procedurale della Camera) seguite dal testo libero degli interventi, con attribuzione per cognome + gruppo (es. "La senatrice CAMUSSO (PD-IDP) preannuncia...") e menzione esplicita di membri di Governo presenti ("Interviene il sottosegretario di Stato... Giuseppina Castiello"). Struttura confermata scrapeable e ricca quanto il bollettino Camera. **Non ancora verificato**: nei 2 resoconti campionati (10ª Commissione, 01/07/2026) non c'era un'audizione in agenda quel giorno, quindi non si è trovato un esempio positivo del testo "Audizione di..." — resta da campionare una seduta con indagine conoscitiva nota per confermare il pattern testuale.

## SVOLTA (2026-07-09): pagina "Audizioni e documenti acquisiti" — gli auditi SONO pubblicati (correzione)

**Correzione alla riga precedente** ("restano assenti ovunque... persone/enti auditi"): quell'affermazione vale solo per SPARQL e JSON `listasommcomm`. Esiste una **terza fonte web**, non esplorata prima, che pubblica esattamente ciò che mancava: chi è stato audito, su quale DDL, in quale seduta. Confermata dalla pagina "Lavori del Senato" (*"Ogni Commissione ha un'area dedicata dove sono elencati... composizione, competenze ed eventuali indagini conoscitive"*).

### URL

```
https://www.senato.it/commissioni-e-giunte/commissioni-permanenti/<N>a-commissione-permanente/audizioni-e-documenti-acquisiti
```

`<N>` = numero commissione permanente (1–10 in leg. 19). Verificato per `2a` (Giustizia) e `10a` (Affari sociali/sanità). Paginato: `?page=0`, `?page=1`, ... La pagina di default mostra la legislatura corrente (XIX, "dal 13 ottobre 2022"); il menu laterale "Legislature" dà accesso alle legislature precedenti (XVIII, XVII, XVI...) sulla stessa struttura.

### Contenuto per record (una card per audizione/documento)

| Campo | Esempio | Note |
|---|---|---|
| Argomento | "AS 1715 e connessi - Modifica dell'articolo 609-bis..." | titolo del provvedimento/tema |
| Atti o procedure | `A.S. 1715 e connessi` | **riferimento diretto al DDL** — incrociabile con i dati `bill`/`bill-progress` già coperti da SPARQL |
| Titolo audizione | "AUDIZIONI, ANCHE IN VIDEOCONFERENZA, DEL PROFESSOR GIAN LUIGI GATTA, ORDINARIO DI DIRITTO PENALE... E DELL'AVVOCATO GUIDO CAMERA, ESPERTO" | **nome + ruolo/qualifica + ente dell'audito**, testo libero ma sempre presente |
| Riferimento seduta | "Sed. n. 317 - 11 Giugno 2026 - Ufficio di Presidenza Integrato - 2ª Commissione permanente" | correlabile a `osr:SedutaCommissione` per data/commissione |
| Comunicazione/Documentazione alla Commissione | "seduta n. 69 - 25 Luglio 2023 - 2ª Commissione permanente" | seduta in cui il materiale è stato comunicato in plenaria |
| Documenti | link a video (WebTV) e/o PDF "memoria depositata dagli auditi" | non strutturati, ma linkabili |

### Tassonomia — filtro "Tipologie di attività"

```
https://www.senato.it/commissioni-e-giunte/commissioni-permanenti/<N>a-commissione-permanente/audizioni-e-documenti-acquisiti/tipologia?type=<TYPE>
```

Categorie viste (link testuali, `type` numerico da ricavare per commissione — verificato `type=15` = Indagini Conoscitive per la 10ª): **Esami di Disegni di Legge**, **Altre audizioni**, **Esami di atti del Governo**, **Esami di atti di Legislazione Comunitaria**, **Indagini Conoscitive**. Quest'ultima elenca le indagini conoscitive **come inchieste nominate** (es. "Indagine conoscitiva sulla ristrutturazione edilizia e l'ammodernamento tecnologico del patrimonio sanitario pubblico, anche nel quadro della Missione 6 del PNRR") — presumibilmente ciascuna con una propria sotto-pagina di sedute/audizioni (non ancora aperta).

### Implicazioni

Un tool "audizioni Senato" è **fattibile via scraping HTML** (non SPARQL, non JSON) — pagina statica per commissione, paginata, nessun WAF riscontrato su queste pagine specifiche finora (a differenza di `listasommcomm` e `show-doc` — da riverificare comunque prima di costruirci sopra in produzione). Colma esattamente il gap segnalato al Webmaster (senatori presenti + auditi), limitatamente agli auditi esterni con nome/ruolo — i senatori presenti in seduta restano assenti anche qui.

**Non ancora verificato**: quante pagine totali per commissione/legislatura; struttura HTML sottostante (tabella vs card, attributi/microdata utili allo scraping); mapping `type=N` per le altre categorie e per le altre commissioni; comportamento WAF su scraping massivo/ripetuto di queste pagine.

# Assenti

* **Commissioni bicamerali con sedute/interventi esposti**: la *Commissione parlamentare di inchiesta sul femminicidio* esiste come entità Senato (`commissione/0-141` storica leg. XVII–XVIII e `commissione/4-223` attuale XIX) con i suoi membri senatori (**24 afferenze** nella XIX), ma **non ha `SedutaCommissione`/`Intervento` collegati** nel LOD Senato (verificato 2026-07-01: 0 righe su entrambi gli URI per leg. 19). Le sedute/interventi sono pubblicati solo dalla Camera (`ocd:organo` `o19_3941`, 181 URI seduta / 157 date distinte fino a giu 2026). Vedi [[../camera/sedute-commissione]]. La composizione Senatori si ottiene con `committee-members list --committee-uri <commissione/4-223> --chamber senato`.

# Citations

[1] Enumerazione proprietà `SedutaCommissione` (2026-07-01): `SELECT DISTINCT ?p WHERE { ?s a osr:SedutaCommissione . ?s ?p ?o }` → `osr:dataSeduta`, `osr:tipoSeduta`, `osr:commissione`, `osr:legislatura`.
[2] Verifica raddoppio etichetta `commissione/0-2` (2026-07-01): due `osr:titoloBreve` → soluzione `GROUP BY ?seduta ?date ?tipo` + `MIN(?tb)`.
[3] Verifica assenza attività femminicidio Senato (2026-07-01): `committee-sessions`/SPARQL su `commissione/0-141` e `4-223` → 0 sedute, 0 interventi.
[4] Risposta Webmaster Senato (email 2026-07-06): conferma che lo SPARQL non espone resoconto/OdG per `SedutaCommissione`; indica le liste JSON `listasommcomm` come fonte con link ai resoconti.
[5] Schema JSON verificato via agent-browser (2026-07-06): `https://www.senato.it/static/bgt/listasommcomm/0/1/t/19/2026/index.json`; `curl` → HTTP 202 vuoto (WAF). Pattern link resoconto ricavato dai `href` della pagina resoconti: `show-doc?leg=19&tipodoc=SommComm&id=<id_testo>&idoggetto=0`.
