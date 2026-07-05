---
title: Audizioni e soggetti auditi alla Camera — modellazione attuale e proposta (AS-IS / TO-BE)
description: Come sono rappresentate oggi le audizioni parlamentari della Camera nel LOD (OCD), quali sono i limiti e come strutturare il soggetto audito con costo minimo per il publisher.
endpoint: https://dati.camera.it/sparql
tags: [camera, ocd, audizioni, auditi, lobbying, as-is, to-be]
timestamp: 2026-07-03
---

Questo documento descrive come il grafo LOD della Camera dei deputati rappresenta oggi le
audizioni parlamentari e chi vi è audito (AS-IS), ne misura i limiti su dati reali, e propone
come colmarli (TO-BE): il fulcro è uno **schema RDF da chiedere al publisher** Camera/Synapta,
affiancato da una nota su cosa il progetto MCP può ricostruire a valle nel frattempo.

La tesi in una riga: **il dato dell'audito è già presente nel grafo** — nome, ruolo ed ente
sono scritti per esteso nel titolo della voce di ordine del giorno — ma **vive come stringa
libera**, non come entità. Non manca il dato: manca la sua struttura. Esporlo come triple non
richiede al publisher di raccogliere nulla di nuovo.

> Il focus è la Camera. Il Senato è citato solo come gap: nessuna classe, tipo-seduta o testo
> libero modella l'audizione o l'audito (verifica esaustiva 2026-07-02). Non è una fonte
> alternativa.

---

# Parte AS-IS — come sono modellate oggi le audizioni

## La catena delle entità

Un'audizione di commissione della Camera (leg. 19) si ricostruisce lungo la catena:

```
ocd:seduta  →  ocd:dibattito  →  ocd:discussione  →  ocd:intervento
 (quando)      (contenitore)      (la voce ODG:        (chi parla,
                                   qui vive            solo parlamentari
                                   l'audizione)        e Governo)
```

- **`ocd:dibattito`** (leg. 19: 53.938 istanze) è il contenitore. Per la leg. 19 porta
  `ocd:rif_leg`, `ocd:startDate`/`ocd:endDate` (`AAAAMMGG`), `ocd:rif_assemblea`,
  `ocd:rif_discussione`, e — quando l'audizione avviene nell'esame di un atto — `ocd:rif_attoCamera`.
  Il suo `dc:title` è **generico**: solo il nome della commissione.
- **`ocd:discussione`** (~533.049 istanze totali) è la **voce all'ordine del giorno di una
  singola seduta**: l'unità atomica di "cosa è successo su quell'argomento, in quel giorno".
  È qui che vive l'audizione, nel `dc:title`/`rdfs:label`.
- `dc:type` sulla discussione **non** è la categoria dell'evento: è la **fase procedurale**
  ("Esame e rinvio", "Votazione segreta", "Seguito dell'esame e rinvio"…), valorizzata solo su
  ~36k/533k istanze. Non esiste il valore "Audizione". Per questo la natura audizione è
  reperibile **solo** nel testo del titolo.

## Come si trovano le audizioni: due pattern di titolo

Le audizioni leg. 19 si estraggono filtrando `"audiz"` nel `dc:title` della discussione. Emergono
due formule distinte, con proprietà diverse:

**Pattern A — commissioni d'inchiesta** (`"Audizione di <nome>, <ruolo>"`): ha `dc:date`, ma
**nessun** `ocd:rif_attoCamera` (un'inchiesta non esamina un DDL).

**Pattern B — sede referente/consultiva** (`"Audizione informale, …, di <nome>, <ruolo>, …
nell'ambito dell'esame del disegno di legge C. <NNN>"`): il dibattito **ha**
`ocd:rif_attoCamera`, ma la discussione ha spesso **`dc:date` vuota** (bug di qualità del dato).

### Query canonica (Pattern A, con esempi reali)

```sparql
PREFIX ocd: <http://dati.camera.it/ocd/>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
SELECT DISTINCT ?date ?organo ?audizione WHERE {
  ?dib a ocd:dibattito ;
       ocd:rif_leg <http://dati.camera.it/ocd/legislatura.rdf/repubblica_19> ;
       dc:title ?organo ;                       # nome commissione
       ocd:rif_discussione ?d .
  ?d dc:title ?audizione ; dc:date ?date .       # titolo reale + data
  FILTER(CONTAINS(LCASE(?audizione), "audizione di"))
} ORDER BY DESC(?date)
```

Output reale (leg. 19, 16 giugno 2026), il ruolo/ente dell'audito è **letteralmente scritto** nel
titolo:

| data | commissione | titolo (l'audito è nel testo) |
|---|---|---|
| 20260616 | Inchiesta mafie | Svolgimento e conclusione - Audizione di **Michele Di Bari, prefetto di Napoli** |
| 20260616 | Inchiesta Moby Prince | …Audizione di **Salvatore De Gaetano, direttore tecnico della flotta Snam** all'epoca del disastro |
| 20260616 | Inchiesta rischio idrogeologico | …Audizione di **Fabrizio Iaccarino, Marco Proietti, e Massimo Sessego, rappresentanti di Enel Green Power** |
| 20260616 | Inchiesta sicurezza periferie | …Audizione di **Monsignor Gian Franco Saba, Arcivescovo Ordinario Militare per l'Italia** |
| 20260610 | Inchiesta mafie | Audizione di **Mauro Mangano, dirigente scolastico** dell'Istituto omnicomprensivo «Musco» di Catania |

### Query canonica (Pattern B, audizione legata a un atto)

```sparql
PREFIX ocd: <http://dati.camera.it/ocd/>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
SELECT ?organo ?audizione ?atto WHERE {
  ?dib a ocd:dibattito ;
       ocd:rif_leg <http://dati.camera.it/ocd/legislatura.rdf/repubblica_19> ;
       dc:title ?organo ;
       ocd:rif_attoCamera ?atto ;                # link all'atto esaminato
       ocd:rif_discussione ?d .
  ?d dc:title ?audizione .
  FILTER(CONTAINS(LCASE(?audizione), "audiz"))
}
```

Output reale (esame del DDL C. 750, I e IX Commissione):

> "Audizione informale, in videoconferenza, di **Paolo Bonetti, professore di diritto
> costituzionale** presso l'Università Milano-Bicocca, di **Irini Papanicolopulu, professoressa di
> diritto internazionale**, di **Dario Vinci, avvocato esperto di diritto minorile**, e di
> **rappresentanti dell'Associazione per gli studi giuridici sull'immigrazione (ASGI)**,
> nell'ambito dell'esame del disegno di legge C. 750"
> → `ocd:rif_attoCamera = attocamera.rdf/ac19_750`

Un singolo titolo nomina **quattro auditi di tre tipi diversi** (due accademici, un
professionista/esperto, un'associazione) e cita l'atto. Tutto in una stringa.

## Quanto dato c'è (numeri verificati 2026-07-03)

- **3.311 discussioni distinte** leg. 19 con `"audiz"` nel titolo, raggiungibili via
  `ocd:dibattito → ocd:rif_discussione`. La stessa query senza `COUNT(DISTINCT …)` restituisce
  **6.636 righe**, perché l'`rdf:type` del dibattito è memorizzato 2× (named graph / doppio
  caricamento) e il join `?dib a ocd:dibattito` fa uscire ogni riga in coppia:
  `6.636 = 2 × 3.318` coppie distinte dibattito–discussione, mentre le discussioni distinte sono
  **3.311** (poche discussioni sono collegate a due dibattiti, da cui 3.318 ≠ 3.311; verificato con
  `COUNT(DISTINCT ?d)` vs `COUNT(DISTINCT coppia)`). Il numero reale di eventi è **~3,3k**, non
  6,6k. Lo stesso raddoppio gonfia qualunque `COUNT(*)` grezzo: vanno usati sempre conteggi
  `DISTINCT`. (Il tool `audizioni` del progetto, escludendo i falsi positivi d'agenda, ne isola
  ~3.167 reali.)
- **935** di queste hanno la locuzione esplicita `"Audizione di <nome>"` con `dc:date` e
  bollettino valorizzati (Pattern A, il sottoinsieme più pulito — conteggio `DISTINCT`).
- Precedente storico: nella **leg. 14** esistevano 619 `ocd:dibattito` con
  `dc:type = "Audizioni informali"` / `"AUDIZIONI INFORMALI"` — un tipo dedicato, poi **mai più
  usato** dalla leg. 15 in avanti.

## Cosa c'è e cosa manca (tabella dei GAP)

Enumerando le proprietà effettivamente presenti sulle discussioni-audizione leg. 19, si trova:
`ocd:rif_intervento`, `dc:relation`, `dc:title`, `rdfs:label`, `dc:date`, `ods:modified`,
`ocd:rif_seduta`. **Assenti** su queste stesse istanze: `dc:type`, `ocd:rif_persona`,
`ocd:rif_deputato`, `ocd:rif_relatore`.

| # | Cosa | Stato | Dettaglio verificato |
|---|---|---|---|
| 1 | **Audito come entità/URI** | ❌ assente | Nome, ruolo ed ente sono **solo stringa** nel `dc:title`. `ocd:rif_persona` — proprietà esistente e usata su ~45.808 altre discussioni — **non è mai valorizzato** su queste istanze. L'audito non è un nodo del grafo. |
| 2 | **Tipizzazione dell'audito** | ❌ assente | Nessuna categoria (persona/ente/impresa/associazione/sindacato/PA/autorità/esperto). L'informazione è nel testo ("prefetto", "professore", "rappresentanti di Enel") ma non normalizzata. |
| 3 | **Classe/tipo "Audizione"** | ❌ assente (leg. 19) | `dc:type` sulla discussione è la fase procedurale, non l'evento; sulle audizioni non è nemmeno valorizzato. Il valore dedicato `"Audizioni informali"` esiste **solo** come relitto leg. 14. |
| 4 | **Link audito → atto** | ⚠️ parziale/indiretto | `ocd:rif_attoCamera` esiste sul **dibattito** per le audizioni in sede referente/consultiva (es. C. 750), ma collega l'**evento** all'atto, **mai il soggetto audito** all'atto. Nelle audizioni d'inchiesta l'atto non c'è affatto (0 casi con `rif_attoCamera`). |
| 5 | **Link audito → tema/registro lobby** | ❌ assente | Nessun collegamento a una tassonomia tematica né al Registro dei rappresentanti di interessi della Camera. |
| 6 | **Resoconto** | ⚠️ presente ma non strutturato | `dc:relation` linka il **bollettino HTML** ancorato al punto esatto — quindi il testo c'è ed è raggiungibile, ma è HTML da parsare. Nessun link al **video** (webtv.camera.it non è nel LOD). |
| 7 | **Data** | ⚠️ incompleta | Pattern A ha `dc:date`; Pattern B (audizioni informali in referente) ha spesso `dc:date` **vuota**. Buco di qualità del dato. |

Sintesi AS-IS: *"chi è stato audito, quando, da quale commissione, su quale atto"* è **scritto**
nel grafo, ma per rispondervi via query servono `CONTAINS` testuali fragili e un parsing NLP del
titolo. Nessuna di queste domande è oggi esprimibile come pattern di triple.

---

# Parte TO-BE — lo schema RDF da proporre al publisher

Il fulcro della proposta è **un intervento sulla sorgente**: chiedere a Camera/Synapta di
strutturare l'audito come entità nel grafo. È lì che il costo di produzione è più basso — il dato
è già scritto — e il beneficio pubblico più alto: chiunque interroghi l'endpoint ottiene l'audito
strutturato, senza doverlo ricostruire a valle. L'arricchimento locale nel progetto MCP (in coda)
è solo la prova di fattibilità nel frattempo, non un'alternativa allo schema.

## Lo schema proposto

Principio guida: **riuso, non rivoluzione**. Non serve una nuova ontologia; bastano due mosse
coerenti con OCD e con ciò che la Camera **già faceva** in leg. 14.

### Mossa A — ripristinare un `dc:type` dedicato

Valorizzare `dc:type = "Audizione"` (o `"Audizione informale"`) sulla `ocd:discussione`, come già
avveniva in leg. 14 sui `ocd:dibattito`. Costo: **zero raccolta dati** — la natura audizione è già
determinabile dal titolo che il publisher stesso redige. Beneficio: le audizioni diventano
selezionabili con un pattern di triple, senza `CONTAINS` testuali.

### Mossa B — l'audito come entità, valorizzando slot già previsti

L'ontologia OCD prevede già `ocd:rif_persona` sulla discussione: è una proprietà **viva**, usata su
**45.808 discussioni** del grafo, ma **mai valorizzata sulle audizioni**. La proposta è popolarla,
sulle discussioni-audizione, con un'entità `ocd:soggettoAudito` così strutturata:

| Proprietà | Range | Contenuto |
|---|---|---|
| `foaf:name` | letterale | nome e cognome (o denominazione se ente) |
| `ocd:qualifica` | letterale | ruolo dichiarato ("prefetto di Napoli", "professore di diritto costituzionale") |
| `ocd:rif_organizzazione` | URI (idealmente) | ente/organizzazione di appartenenza |
| `ocd:categoriaAudito` | SKOS concept | categoria da tassonomia controllata (sotto) |
| `ocd:rif_attoCamera` | URI → `ocd:attocamera` | atto su cui è audito (se in referente/consultiva) |
| `ocd:rif_discussione` | URI → `ocd:discussione` | l'evento-audizione |
| `dc:relation` | URI | resoconto (già presente sull'evento) |

Tassonomia proposta per `ocd:categoriaAudito` (SKOS, 9 valori, allineata a quella già usata nel
progetto): `governo` · `pubblica-amministrazione` · `autorita-indipendente` · `impresa` ·
`associazione-di-categoria` · `sindacato` · `ong-terzo-settore` · `esperto-accademico` · `altro`.
(I parlamentari sono esclusi: sono già entità nel grafo e non sono "auditi".)

### Esempio Turtle — l'audizione C. 750 modellata bene

Come apparirebbe **una** audizione reale (I Commissione, esame del DDL C. 750) se lo schema fosse
applicato. Si noti che il testo per popolare questi nodi è **già oggi** nel `dc:title`:

```turtle
@prefix ocd:  <http://dati.camera.it/ocd/> .
@prefix dc:   <http://purl.org/dc/elements/1.1/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .

ocd:discussione.rdf/disId_xxx_19
    a ocd:discussione ;
    dc:type "Audizione informale" ;                      # Mossa A
    dc:date "20260604" ;                                 # data, oggi vuota → colmata
    ocd:rif_seduta ocd:seduta.rdf/... ;
    ocd:rif_attoCamera ocd:attocamera.rdf/ac19_750 ;     # link evento→atto (già oggi sul dibattito)
    dc:relation <http://documenti.camera.it/.../bollettino#...> ;
    ocd:rif_persona ocd:audito.rdf/a_bonetti_750 ,       # Mossa B: auditi come entità
                    ocd:audito.rdf/a_papanicolopulu_750 ,
                    ocd:audito.rdf/a_vinci_750 ,
                    ocd:audito.rdf/a_asgi_750 .

ocd:audito.rdf/a_bonetti_750
    a ocd:soggettoAudito ;
    foaf:name "Paolo Bonetti" ;
    ocd:qualifica "professore di diritto costituzionale, Università Milano-Bicocca" ;
    ocd:categoriaAudito ocd:cat/esperto-accademico ;
    ocd:rif_attoCamera ocd:attocamera.rdf/ac19_750 .

ocd:audito.rdf/a_asgi_750
    a ocd:soggettoAudito ;
    foaf:name "Associazione per gli studi giuridici sull'immigrazione (ASGI)" ;
    ocd:categoriaAudito ocd:cat/ong-terzo-settore ;
    ocd:rif_organizzazione <...>  ;                       # idealmente URI verso il registro lobby
    ocd:rif_attoCamera ocd:attocamera.rdf/ac19_750 .
```

Con questo schema, domande oggi impossibili diventano una `SELECT`: *"tutte le imprese audite
sull'atto C. NNN"*, *"quante volte è stata audita ASGI in legislatura"*, *"quali categorie di
soggetti ha ascoltato la Commissione Trasporti"*.

**Il costo per il publisher è minimo**: il nome, il ruolo e l'ente sono già scritti nel titolo che
redige a mano; la categoria è derivabile con NER + regola; il `dc:type` era già in produzione in
leg. 14. Non si chiede di raccogliere informazione nuova, ma di **esporre come triple ciò che è
già scritto in stringa**.

## Nota-ponte: cosa può fare il progetto MCP nel frattempo

Finché lo schema non è adottato a monte, il progetto MCP dimostra la fattibilità ricostruendo la
struttura a valle. Lo Step 1 è **già fatto** (tool `src/tools/audizioni.ts`): estrae in modo
deterministico via SPARQL evento, titolo, commissione, atto (`rif_attoCamera`) e bollettino. Gli
step successivi — NER per separare nome e qualifica dal titolo, classificazione nella tassonomia,
entity resolution verso Wikidata e il Registro dei rappresentanti di interessi — sono
**euristici/LLM**, con limiti noti: audizioni collettive con solo ente (nomi non recuperabili),
titoli multi-audito da spacchettare, omonimie da disambiguare, e la fragilità di ogni parser
testuale rispetto ai cambi di stile redazionale. È una toppa utile e verificabile, ma resta una
ricostruzione a posteriori: **lo schema a monte eliminerebbe tutti questi limiti alla radice**, ed
è per questo che l'arricchimento locale è la dimostrazione, non la soluzione.

---

# La richiesta ai gestori

Cosa chiedere concretamente a Camera/Synapta (canale informale già aperto via Synapta — Fabiana e
Giovanni; contatto formale `assistenza-dati@camera.it`), in ordine di priorità:

1. **Ripristinare un `dc:type` dedicato all'audizione** sulla `ocd:discussione` leg. 19+, come già
   in uso in leg. 14 (`"Audizioni informali"`). È il costo più basso e sblocca la selezione via
   triple.
2. **Popolare `ocd:rif_persona`** (slot già previsto, oggi vuoto sulle audizioni) con l'entità
   dell'audito, valorizzando almeno `foaf:name` + qualifica: sono dati che il publisher **già
   scrive** nel titolo.
3. **Collegare l'audito all'atto** (`ocd:rif_attoCamera` a livello di soggetto, non solo di
   dibattito) per le audizioni in sede referente/consultiva.
4. **Correggere il buco di `dc:date`** sulle audizioni informali (Pattern B), oggi spesso vuoto.
5. (auspicabile) **Categoria controllata** dell'audito e link verso il Registro dei rappresentanti
   di interessi.

Argomento chiave da usare nella segnalazione: *non si chiede di raccogliere nuovi dati, ma di
esporre come triple informazioni che la Camera già redige in forma testuale.* Il precedente della
leg. 14 dimostra che il modello dedicato era già alla portata del publisher.

> Note collegate: `docs/lod-wiki/camera/sedute-commissione.md` (schema verificato),
> memoria `project_audizioni_coverage` (copertura), `project_synapta_contact` (canale aperto).
