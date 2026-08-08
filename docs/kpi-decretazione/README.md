# Come si fanno le leggi: KPI su iniziativa, tempi e decretazione d'urgenza

Dati Camera dei Deputati (endpoint SPARQL `dati.camera.it`), legislature 17, 18 e 19. Estrazione del **2026-08-08**; la legislatura 19 è ancora in corso, quindi i suoi numeri vanno letti come una fotografia a metà partita — si veda la sezione sui limiti.

Tutti i numeri di questa pagina sono rigenerabili:

```bash
./scripts/kpi-decretazione/kpi.sh            # estrae i CSV grezzi in data/
duckdb -c ".read scripts/kpi-decretazione/aggrega.sql"
```

## In sintesi

Il Governo presenta circa un decimo dei progetti di legge e ne porta a casa più di due terzi. Non è una notizia nuova, ma qui è misurata su tre legislature con la stessa definizione, e mostra una tendenza: la quota governativa delle leggi approvate è passata dal 63% al 69%, la quota di leggi che nascono da un decreto-legge dal 18% al 31%, e la mediana dei tempi di approvazione di una legge governativa è scesa da 90 a 55 giorni mentre quella di una legge parlamentare è rimasta ferma sopra i 280.

## KPI 1 — Tasso di successo per iniziativa

Quanti degli atti presentati arrivano all'approvazione definitiva.

| Legislatura | Iniziativa | Presentati | Diventati legge | Successo |
|---|---|---:|---:|---:|
| 17 | Parlamentare | 4.429 | 164 | 3,7% |
| 17 | Governo | 378 | 284 | **75,1%** |
| 17 | Regioni | 51 | 1 | 2,0% |
| 17 | Popolare | 33 | 0 | **0,0%** |
| 18 | Parlamentare | 3.316 | 110 | 3,3% |
| 18 | Governo | 332 | 249 | **75,0%** |
| 18 | Regioni | 63 | 0 | 0,0% |
| 18 | Popolare | 23 | 2 | 8,7% |
| 18 | CNEL | 22 | 2 | 9,1% |
| 19 | Parlamentare | 2.623 | 115 | 4,4% |
| 19 | Governo | 335 | 261 | **77,9%** |
| 19 | Regioni | 76 | 1 | 1,3% |
| 19 | CNEL | 53 | 1 | 1,9% |
| 19 | Popolare | 16 | 1 | 6,3% |

Un disegno di legge governativo ha fra le **diciotto e le ventitré volte** la probabilità di diventare legge rispetto a una proposta parlamentare (rapporto fra i due tassi: 20,3 nella leg. 17, 22,7 nella 18, 17,7 nella 19). Le 33 proposte di iniziativa popolare della legislatura 17 sono finite tutte in nulla.

## KPI 2 — Chi ha scritto le leggi approvate

| Legislatura | Governo | Parlamentare |
|---|---:|---:|
| 17 | 284 (63,4%) | 164 (36,6%) |
| 18 | 249 (69,4%) | 110 (30,6%) |
| 19 | 261 (69,4%) | 115 (30,6%) |

Il contrasto è tutto qui: il Governo presenta il **7,7%** (leg. 17), **8,8%** (leg. 18) e **10,8%** (leg. 19) degli atti, e firma rispettivamente il 63,4%, 69,4% e 69,4% delle leggi. Lo scarto fra le due quote è la misura dello squilibrio.

## KPI 3 — Quanto ci mette una legge ad arrivare in fondo

Giorni fra la data di presentazione dell'atto e la prima data di approvazione definitiva.

| Legislatura | Iniziativa | Leggi | Mediana | Minimo | Massimo |
|---|---|---:|---:|---:|---:|
| 17 | Governo | 284 | 90 | 1 | 1.059 |
| 17 | Parlamentare | 164 | 286 | 7 | 1.658 |
| 18 | Governo | 249 | 63 | 2 | 917 |
| 18 | Parlamentare | 110 | 308 | 1 | 1.475 |
| 19 | Governo | 261 | **55** | 2 | 872 |
| 19 | Parlamentare | 115 | **293** | 20 | 1.370 |

Il doppio binario: nella legislatura 19 una legge del Governo chiude in mediana in meno di due mesi, una parlamentare in quasi dieci. E la corsia governativa si è accorciata di un terzo dalla legislatura 17, mentre l'altra non si è mossa.

## KPI 4 — Decretazione d'urgenza e fiducie

| Legislatura | DL presentati | Convertiti | Decaduti | Leggi totali | Leggi che nascono da un DL | Fiducie |
|---|---:|---:|---:|---:|---:|---:|
| 17 | 102 | 83 | 11 | 453 | **18,3%** | 58 |
| 18 | 126 | 104 | 17 | 364 | **28,6%** | 54 |
| 19 | 134 | 118 | 4 | 382 | **30,9%** | 71 |

I decreti-legge presentati crescono (102 → 126 → 134) mentre le leggi approvate calano, quindi la quota di produzione legislativa che passa dalla decretazione d'urgenza è quasi raddoppiata in tre legislature. Le 71 fiducie della legislatura 19 sono già più delle 54 dell'intera legislatura 18.

## Definizioni operative

Contano le scelte, quindi sono esplicite.

**"Diventato legge"** = l'atto ha, nella sua storia d'iter (`ocd:rif_statoIter`), almeno uno stato il cui titolo contiene "Approvato definitivamente". Copre le quattro varianti presenti nel grafo ("Approvato definitivamente. Legge", "…dal Senato. Legge", "…non ancora pubblicato", "…in seconda deliberazione"). Misura l'**approvazione**, non la pubblicazione in Gazzetta.

Non serve ricostruire l'ultimo stato dell'iter, ed è bene saperlo: `rif_statoIter` è una **storia**, non uno stato corrente — "Da assegnare" compare su tutti e 3.107 gli atti della legislatura 19. Ma "Approvato definitivamente" è terminale, quindi la sua sola esistenza basta. (Se servisse davvero l'ultimo stato: `dc:date` è presente sul 100% dei nodi, e i pareggi di giornata si sciolgono col seriale nell'URI, `si19_94610` → `si19_94730`.)

**"Decreto-legge"** = atto il cui `rdfs:label` contiene "conversione in legge". È il punto più fragile dell'analisi, ed è una scelta obbligata: **i decreti-legge non esistono come categoria nel grafo**. Il vocabolario `ocd:rif_natura` ha quattro soli valori (disegno/proposta × ordinario/costituzionale) e la conversione del DL 100/2026 è classificata `disegno_legge_ordinario` come un DDL qualunque. L'unico appiglio strutturale in tutto il grafo è lo stato d'iter "Decreto-legge decaduto", che però marca solo i decreti **non** convertiti.

Cercare "decreto-legge" invece di "conversione in legge" sarebbe un errore da 60%: nella legislatura 19 dà 218 atti invece di 134, perché **78 sono proposte parlamentari che si limitano a citare un DL nel titolo** ("Modifiche all'articolo 24 del decreto-legge 6 dicembre 2011, n. 201…").

**Iniziativa** = `ocd:iniziativa`, valore letterale. Oltre a Governo, Parlamentare, Regioni, Popolare e CNEL esistono valori "Mista (Governo, Parlamentare)". Qui i gruppi sono tenuti distinti; attenzione perché il flag `--initiative` della CLI fa match per sottostringa, quindi `--initiative Governo` restituisce 338 (335 puri + 3 Miste) contro i 335 di questa tabella.

**Denominatori** = `COUNT(DISTINCT ?s)`, mai `--count-only` del tool `bills`: senza filtro di legislatura quest'ultimo gonfia del 32% (160.454 contro 121.022 atti reali), perché un atto con più cofirmatari o più URL viene contato più volte.

## Limiti da dichiarare se questi numeri finiscono in un pezzo

**La legislatura 19 è aperta.** I suoi tassi di successo saliranno ancora, man mano che gli atti pendenti chiudono. E le mediane dei tempi sono **censurate a destra**: le leggi più lente non sono ancora arrivate in fondo, quindi non entrano nel conteggio. L'effetto va in una direzione precisa — la mediana parlamentare della legislatura 19 è se mai **sottostimata**, quindi il divario reale fra le due corsie è più largo di quello in tabella, non più stretto.

**Solo atti Camera.** Il denominatore dei "presentati" conta ciò che è stato presentato alla Camera. Un disegno di legge nato al Senato e mai trasmesso non compare, quindi il tasso di successo dell'iniziativa parlamentare è calcolato su una base parziale. Le leggi approvate, dovendo passare da entrambi i rami, hanno invece sempre un atto Camera.

**Il conteggio dei DL è un text-match e non è stato validato contro una fonte autorevole.** Prima di pubblicarlo, confrontare i 134 della legislatura 19 con Normattiva o con la Gazzetta Ufficiale.

**Le fiducie sono votazioni, non atti.** La colonna conta le votazioni con richiesta di fiducia (`ocd:richiestaFiducia`), non i provvedimenti su cui la fiducia è stata posta: un singolo decreto può portarne più di una. Per legarle ai provvedimenti serve un passaggio in più, via `votes --bill-code`.

## File

- `scripts/kpi-decretazione/kpi.sh` — estrazione dei dati grezzi
- `scripts/kpi-decretazione/aggrega.sql` — calcolo dei KPI
- `data/` — CSV grezzi, uno per misura e per legislatura, rigenerabili
