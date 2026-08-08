---
type: Entity Map
title: Composizione delle commissioni — Camera (OCD)
description: Chi fa parte di una commissione Camera, con ruolo e date. Due path RDF distinti da unire; trappola bicamerale sui presidenti senatori.
resource: http://dati.camera.it/ocd/organo
tags: [camera, ocd, commissione, organo, membri, composizione, ufficioParlamentare, bicamerale]
timestamp: 2026-07-04
---

La composizione di una commissione Camera (`ocd:organo`) è modellata su **due path RDF distinti** che vanno **uniti**: chi interroga solo il primo perde la maggioranza dei componenti. È la causa di un bug reale del tool `committee-members` (restituiva 3 persone invece di 16 sulla Commissione d'inchiesta Covid, con Giuseppe Conte assente).

# I due path

## Path A — membri effettivi (`ocd:membro`)

I componenti "semplici" sono legati **dal deputato verso un blank node**, che a sua volta punta all'organo. La direzione è deputato → nodo → organo, **non** organo → deputato.

```
?deputato ocd:membro ?bn .
?bn ocd:rif_organo ?organo ;
    ocd:startDate "AAAAMMGG" ;
    dc:type "Titolare" .          # oppure "Sostituto"
    # ocd:endDate presente solo se il mandato è cessato
```

| Proprietà del blank node | Tipo | Note |
|---|---|---|
| `ocd:rif_organo` | URI → `ocd:organo` | commissione di appartenenza |
| `dc:type` | stringa | **`Titolare`** (membro effettivo) o **`Sostituto`** (supplente) |
| `ocd:startDate` | stringa `AAAAMMGG` | inizio mandato |
| `ocd:endDate` | stringa `AAAAMMGG` | presente **solo** se cessato → usare `!BOUND(?endDate)` per i soli attivi |
| `rdfs:label` | stringa | nome commissione + data (label del nodo, **non** dell'organo) |

> ⚠️ **`ocd:haMembro` esiste ma è un vicolo cieco** (correzione dell'8 agosto 2026: questa pagina diceva che non esistesse, ed è falso). Il predicato c'è, con 47.415 triple, e va da `ocd:organo` a un **blank node** — non a un deputato. Dentro quel nodo c'è solo una `rdfs:label` con nome e periodo, per esempio `"ROBERTO GIACHETTI (23.03.2018-24.03.2018)"`: **nessun URI alla persona**, quindi nessun join possibile e il nome va parsato da una stringa.
>
> La conclusione operativa non cambia — si usa `ocd:membro` in direzione **deputato → blank node**, che è la via che dà gli URI — ma la ragione sì: non è che `haMembro` non esista, è che non porta da nessuna parte. Chi lo trovasse esplorando l'organo penserebbe altrimenti che il wiki sbagli.

## Path B — cariche apicali (`ocd:ufficioParlamentare`)

Presidenza, vicepresidenza, segretari e capigruppo in commissione sono entità `ocd:ufficioParlamentare` separate:

```
?uff a ocd:ufficioParlamentare ;
     ocd:rif_organo ?organo ;
     ocd:carica "PRESIDENTE" ;          # VICEPRESIDENTE | SEGRETARIO | CAPOGRUPPO
     ocd:startDate "AAAAMMGG" .
     # ocd:endDate solo se cessato
{ ?uff ocd:rif_deputato ?person } UNION { ?uff ocd:rif_senatore ?person }
```

| Proprietà | Tipo | Note |
|---|---|---|
| `ocd:rif_organo` | URI → `ocd:organo` | commissione |
| `ocd:carica` | stringa | `PRESIDENTE`, `VICEPRESIDENTE`, `SEGRETARIO`, `CAPOGRUPPO` |
| `ocd:rif_deputato` | URI → deputato | **oppure** ↓ |
| `ocd:rif_senatore` | URI → senatore | **sulle bicamerali** presidente/segretari possono essere senatori |
| `ocd:startDate` / `ocd:endDate` | stringa `AAAAMMGG` | date carica |

> ⚠️ **Trappola bicamerale.** Nelle commissioni d'inchiesta bicamerali le cariche apicali sono spesso senatori, legati via `ocd:rif_senatore` (non `rif_deputato`). Filtrare solo su `rif_deputato` scarta il presidente e altri. I senatori hanno comunque `rdfs:label` sull'endpoint Camera.

# Query Template — composizione completa (UNION)

```sparql
PREFIX ocd: <http://dati.camera.it/ocd/>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT DISTINCT ?person ?label ?ruolo ?startDate ?endDate WHERE {
  {
    ?person ocd:membro ?bn .
    ?bn ocd:rif_organo <ORGANO_URI> ; ocd:startDate ?startDate .
    OPTIONAL { ?bn ocd:endDate ?endDate }
    OPTIONAL { ?bn dc:type ?ruolo }
  } UNION {
    ?uff a ocd:ufficioParlamentare ; ocd:rif_organo <ORGANO_URI> ;
         ocd:carica ?ruolo ; ocd:startDate ?startDate .
    OPTIONAL { ?uff ocd:endDate ?endDate }
    { ?uff ocd:rif_deputato ?person } UNION { ?uff ocd:rif_senatore ?person }
  }
  ?person rdfs:label ?label .
  FILTER(!BOUND(?endDate))          # solo attivi
}
```

Una persona può comparire **in entrambi i path** (es. è Titolare *e* Vicepresidente): dedup lato client tenendo il ruolo più significativo (Presidente > Vicepresidente > Segretario > Capogruppo > Titolare > Sostituto). Con lo storico (`endDate` non filtrato) le righe restano distinte per non collassare i periodi.

# Trappole

| Trappola | Dettaglio |
|----------|-----------|
| **`ocd:membro`, non `ocd:haMembro`** | Direzione deputato → blank node → organo. `haMembro` non esiste. |
| **Solo apicali = composizione monca** | Interrogare solo `ufficioParlamentare` perde tutti i `Titolare`/`Sostituto` (la maggioranza). |
| **Bicamerali: presidenti senatori** | Cariche apicali via `ocd:rif_senatore`; filtrare solo `rif_deputato` li scarta. |
| **`endDate` sul nodo giusto** | Il flag "attivo" è `!BOUND(?endDate)` sul blank node (path A) o sull'`ufficioParlamentare` (path B), non sul deputato. |
| **Doppio ruolo** | Stessa persona in A e B → dedup con priorità di ruolo. |

# Cosa NON è coperto lato Camera

Sulle commissioni **bicamerali** i senatori *membri semplici* (non apicali) **non** sono in OCD via `ocd:membro`: vivono solo nel LOD Senato (`osr:afferisce`, vedi [[../senato/sedute-commissione]]). Una query per URI-organo Camera dà quindi la componente deputati + gli apicali (deputati o senatori), non i senatori membri semplici. Per la composizione bicamerale completa servono entrambi gli endpoint.

# Citations

[1] Path A verificato su Commissione Covid `o19_4281` (2026-07-04): `?dep ocd:membro ?bn . ?bn ocd:rif_organo <…o19_4281> ; dc:type ?t` → 22 `Titolare`; il blank node espone `rif_organo`, `startDate`, `dc:date`, `dc:type`, `rdfs:label` (nessun `rif_deputato`: il link è entrante via `ocd:membro`).
[2] Path B verificato su `o19_4281` (2026-07-04): `ufficioParlamentare` con `PRESIDENTE`/`SEGRETARIO` via `ocd:rif_senatore` (Marco Lisei `s308988_19`, Giuseppe De Cristofaro `s301569_19`), `VICEPRESIDENTE`/`SEGRETARIO` via `ocd:rif_deputato`.
[3] Commissione permanente XIII Agricoltura `o19_3513` (2026-07-04): path A → 35 `Titolare` totali (30 attivi) + 1 `Sostituto`; path B → `PRESIDENTE`, `VICEPRESIDENTE`, `SEGRETARIO`, `CAPOGRUPPO`. Modello identico a quello bicamerale.
[4] UNION completa su `o19_4281`, solo attivi + dedup priorità ruolo → 16 persone (era 3 col solo path B/`rif_deputato`), con Giuseppe Conte (`Titolare`) e Marco Lisei (`PRESIDENTE`, senatore) presenti.
