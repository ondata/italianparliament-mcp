# Named graph: perché ogni tripla sembra duplicata (e perché NON conviene interrogare il grafo tematico)

L'endpoint Camera serve una ventina di **named graph**. La stessa tripla può essere asserita sia nel grafo generale `http://dati.camera.it/ocd/` sia in uno o più grafi tematici, quindi interrogando senza `FROM` — cioè l'unione — ogni tripla viene contata **una volta per grafo in cui compare**.

Non è un difetto di caricamento. Ma la conclusione istintiva («allora interrogo il grafo tematico giusto») è **sbagliata e fa perdere dati in silenzio**: vedi sotto.

## La misura (8 agosto 2026)

```sparql
SELECT (COUNT(*) AS ?triple_rdf_type) (COUNT(DISTINCT ?s) AS ?atti_distinti)
WHERE { ?s a <http://dati.camera.it/ocd/atto> }
```

→ 269.919 triple per 121.023 atti. Per le votazioni: 258.327 contro 134.372.

La distribuzione non è un semplice ×2, perché dipende da in quanti grafi compare il soggetto:

| triple `rdf:type` per soggetto | atti | votazioni |
|---|---:|---:|
| 1 | 1.505 | 10.469 |
| 2 | 90.140 | 123.851 |
| 3 | 29.378 | 52 |

```sparql
SELECT ?g (COUNT(*) AS ?triple)
WHERE { GRAPH ?g { ?s a <http://dati.camera.it/ocd/atto> } }
GROUP BY ?g ORDER BY DESC(?triple)
```

→ `ocd/` 121.022, `ocd/atti/` 76.788, `ocd/iter/` 72.109.

## TRAPPOLA: i grafi tematici sono fette PARZIALI

Il nome `ocd/atti/` suggerisce "qui ci sono gli atti". Non è così. Verifica su un atto della legislatura 19 (`ac19_3053`, conversione del DL 100/2026):

```sparql
SELECT ?g (COUNT(*) AS ?triple)
WHERE { GRAPH ?g { <http://dati.camera.it/ocd/attocamera.rdf/ac19_3053> ?p ?o } }
GROUP BY ?g
```

| grafo | triple di quell'atto |
|---|---:|
| `http://dati.camera.it/ocd/` | **56** |
| `http://dati.camera.it/ocd/iter/` | 2 |
| `http://dati.camera.it/ocd/atti/` | **0** |

Quindi `FROM <http://dati.camera.it/ocd/atti/>` su un atto recente non restituisce **nulla**, e `FROM <http://dati.camera.it/ocd/iter/>` ne restituisce 2 proprietà su 56. Il grafo generale `ocd/` è l'unico completo.

**Regola operativa: interrogare sempre l'unione (nessun `FROM`) e deduplicare con `DISTINCT` / `COUNT(DISTINCT ?s)`.** È quello che fanno i tool del progetto, ed è il motivo per cui funzionano. Non "ottimizzare" puntando al grafo tematico: si perdono dati senza accorgersene, ed è esattamente il tipo di errore che questo wiki esiste per prevenire.

(La forma con `FROM` compare anche nella pagina "OCD - Rappresentazione semantica e documentazione", dove due query di esempio girano `FROM <http://dati.camera.it/ocd/bpr/>`. Vale per quel dominio bibliografico; non generalizzarla.)

## I grafi presenti

```sparql
SELECT ?g (COUNT(*) AS ?triple) WHERE { GRAPH ?g { ?s ?p ?o } } GROUP BY ?g ORDER BY DESC(?triple)
```

| grafo | triple |
|---|---:|
| `http://dati.camera.it/ocd/` | 312.432.722 |
| `http://dati.camera.it/ocd/votazioni/` | 59.639.273 |
| `http://dati.camera.it/ocd/dibattiti/` | 1.539.690 |
| `http://archivio-storico/` | 1.171.640 |
| `http://dati.camera.it/ocd/aic/` | 1.111.406 |
| `http://dati.camera.it/ocd/iter/` | 582.747 |
| `http://dati.camera.it/ocd/bpr/` | 496.119 |
| `http://dati.camera.it/ocd/sedute/` | 243.832 |
| `http://dati.camera.it/ocd/atti/` | 153.576 |

Seguono `DOC/`, `deputati/`, `mandatiCamera/`, `bpr/articoli/`, `leggi/`, `persone/`, `ufficiParlamentari/`, `elezioni/`, `bollettini/`, `bpr/spogli/`, `bpr/autori/`.

## Cosa è esplorabile e cosa no

L'**elenco** dei grafi è banalmente interrogabile (la query qui sopra). Quello che l'esplorazione non dà, e che nessuna documentazione pubblica dichiara:

- che cosa ciascun grafo sia *inteso* a contenere, e con quale criterio;
- che i tematici siano fette parziali — lo si scopre solo misurando, e il nome suggerisce il contrario;
- se `ocd/` sia garantito come unione completa, o se sia solo così oggi;
- la corrispondenza fra i 97 `dcat:Dataset` del catalogo e i ~20 grafi.

Cercata l'8 agosto 2026 nei tre posti canonici, senza trovarla: il **catalogo DCAT** (`ocd/catalogue`) è ricco ma le `dcat:Distribution` dichiarano `dcat:accessURL` e `dcat:downloadURL`, non il grafo; la **SPARQL Service Description** (`sd:namedGraph`), luogo standard per questo, risponde vuota (`curl -H "Accept: text/turtle" https://dati.camera.it/sparql` → `# Empty TURTLE`); **VoID** è citata fra i vocabolari adottati ma nel grafo ha **zero** triple.

Segnalato ai gestori: `docs/note-gestori-lod/camera-01-igiene-caricamento.md` (cartella non versionata).

## Trappola collegata: `dcterms:modified` contraddice la periodicità

Tutti i 97 dataset dichiarano `dc:accrualPeriodicity` = `freq-B` (giornaliera nei giorni lavorativi), ma `dcterms:modified` vale **2024-02-08** su tutti. Il campo non è quindi utilizzabile per sapere a che data è aggiornato il grafo — vedi [freschezza e autorevolezza](../freschezza-e-autorevolezza.md).
