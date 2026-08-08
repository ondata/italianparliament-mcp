# Come si fanno le leggi: KPI su iniziativa, tempi e decretazione d'urgenza

Dati Camera dei Deputati (endpoint SPARQL `dati.camera.it`), legislature 17, 18 e 19. Estrazione del **2026-08-08**; la legislatura 19 è ancora in corso, quindi i suoi numeri vanno letti come una fotografia a metà partita — si veda la sezione sui limiti.

Tutti i numeri di questa pagina sono rigenerabili:

```bash
./scripts/kpi-decretazione/kpi.sh            # estrae i CSV grezzi in data/
duckdb -c ".read scripts/kpi-decretazione/aggrega.sql"
```

## In sintesi

Il Governo presenta circa un decimo dei progetti di legge e ne porta a casa più di due terzi. Non è una notizia nuova, ma qui è misurata su tre legislature con la stessa definizione, e mostra una tendenza: la quota governativa delle leggi approvate è passata dal 62,7% al 68,3%, la quota di leggi che nascono da un decreto-legge dal 18% al 31%, e la mediana dei tempi di approvazione di una legge governativa è scesa da 90 a 55 giorni mentre quella di una legge parlamentare è rimasta ferma sopra i 280.

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

Quote sul totale delle leggi della legislatura (453, 364, 382), non sui soli due gruppi maggiori.

| Legislatura | Governo | Parlamentare | Altri |
|---|---:|---:|---:|
| 17 | 284 (62,7%) | 164 (36,2%) | 5 (1,1%) |
| 18 | 249 (68,4%) | 110 (30,2%) | 5 (1,4%) |
| 19 | 261 (68,3%) | 115 (30,1%) | 6 (1,6%) |

Gli "altri" sono le briciole che rendono il quadro: Regioni, CNEL, iniziativa popolare e le iniziative Miste stanno insieme sotto il 2%, e nella legislatura 19 valgono **una legge ciascuno**.

Il contrasto è tutto qui: il Governo presenta il **7,7%** (leg. 17), **8,8%** (leg. 18) e **10,8%** (leg. 19) degli atti, e firma rispettivamente il 62,7%, 68,4% e 68,3% delle leggi. Lo scarto fra le due quote è la misura dello squilibrio.

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

La colonna "DL presentati" conta i **disegni di conversione presentati alla Camera**. Per confronto, i decreti-legge *emanati* nello stesso periodo sono 137 secondo Normattiva: lo scarto è fatto di decreti recentissimi o presentati al Senato e non ancora trasmessi (vedi i limiti in fondo).

I decreti-legge presentati crescono (102 → 126 → 134) mentre le leggi approvate calano, quindi la quota di produzione legislativa che passa dalla decretazione d'urgenza è quasi raddoppiata in tre legislature. Le 71 fiducie della legislatura 19 sono già più delle 54 dell'intera legislatura 18.

## Definizioni operative

Contano le scelte, quindi sono esplicite.

**"Diventato legge"** = l'atto ha, nella sua storia d'iter (`ocd:rif_statoIter`), almeno uno stato il cui titolo contiene "Approvato definitivamente". Copre le quattro varianti presenti nel grafo ("Approvato definitivamente. Legge", "…dal Senato. Legge", "…non ancora pubblicato", "…in seconda deliberazione"). Misura l'**approvazione**, non la pubblicazione in Gazzetta.

Non serve ricostruire l'ultimo stato dell'iter, ed è bene saperlo: `rif_statoIter` è una **storia**, non uno stato corrente — "Da assegnare" compare su tutti e 3.107 gli atti della legislatura 19. Ma "Approvato definitivamente" è terminale, quindi la sua sola esistenza basta. (Se servisse davvero l'ultimo stato: `dc:date` è presente sul 100% dei nodi, e i pareggi di giornata si sciolgono col seriale nell'URI, `si19_94610` → `si19_94730`.)

**"Decreto-legge"** = atto il cui `rdfs:label` contiene "conversione in legge". È il punto più fragile dell'analisi, ed è una scelta obbligata: **i decreti-legge non esistono come categoria nel grafo**. Il vocabolario `ocd:rif_natura` ha quattro soli valori (disegno/proposta × ordinario/costituzionale) e la conversione del DL 100/2026 è classificata `disegno_legge_ordinario` come un DDL qualunque. L'unico appiglio strutturale in tutto il grafo è lo stato d'iter "Decreto-legge decaduto", che però marca solo i decreti **non** convertiti.

Cercare "decreto-legge" invece di "conversione in legge" sarebbe un errore da 60%: nella legislatura 19 dà 218 atti invece di 134, perché **78 sono proposte parlamentari che si limitano a citare un DL nel titolo** ("Modifiche all'articolo 24 del decreto-legge 6 dicembre 2011, n. 201…").

**Iniziativa** = `ocd:iniziativa`, valore letterale. Oltre a Governo, Parlamentare, Regioni, Popolare e CNEL esistono valori "Mista (Governo, Parlamentare)". Qui i gruppi sono tenuti distinti; attenzione perché il flag `--initiative` della CLI fa match per sottostringa, quindi `--initiative Governo` restituisce 338 (335 puri + 3 Miste) contro i 335 di questa tabella.

**Denominatori** = `COUNT(DISTINCT ?s)`, calcolato via il tool `sparql`. All'epoca dell'estrazione il `--count-only` di `bills` non era utilizzabile come denominatore: senza filtro di legislatura gonfiava del 32% (160.454 contro 121.021 atti reali), perché un atto con più primi firmatari veniva contato più volte. Il difetto è stato poi corretto (issue #99) e oggi i due metodi coincidono; i numeri di questa pagina restano quelli misurati con `COUNT(DISTINCT ?s)`, che non ne è mai stato toccato.

## Limiti da dichiarare se questi numeri finiscono in un pezzo

**La legislatura 19 è aperta.** I suoi tassi di successo saliranno ancora, man mano che gli atti pendenti chiudono. E le mediane dei tempi sono **censurate a destra**: le leggi più lente non sono ancora arrivate in fondo, quindi non entrano nel conteggio. L'effetto va in una direzione precisa — la mediana parlamentare della legislatura 19 è se mai **sottostimata**, quindi il divario reale fra le due corsie è più largo di quello in tabella, non più stretto.

**Solo atti Camera.** Il denominatore dei "presentati" conta ciò che è stato presentato alla Camera. Un disegno di legge nato al Senato e mai trasmesso non compare, quindi il tasso di successo dell'iniziativa parlamentare è calcolato su una base parziale. Al numeratore il problema in linea di principio non si pone — una legge deve passare da entrambi i rami, quindi ha un atto Camera — e il dato è coerente con questa lettura (nella leg. 19 gli stati "Approvato definitivamente **dal Senato**" convivono nel grafo Camera con quelli approvati per ultimi alla Camera), ma è ragionamento costituzionale, non una misura: non è stato verificato contro l'elenco delle leggi promulgate.

**Il conteggio dei DL è un text-match, validato contro Normattiva l'8 agosto 2026. La validazione ha retto sul metodo ma ha corretto il numero, e va letta prima di usare questi dati.**

Normattiva conta **137** decreti-legge emanati fra il 13 ottobre 2022 (inizio della legislatura 19) e l'8 agosto 2026. Alla Camera i **disegni di conversione** presentati sono 134, ma non è il numero da confrontare: alcuni sono varianti dello stesso provvedimento (`-A`, `-B`) o passaggi di navetta. Riducendoli ai decreti distinti effettivamente convertiti, e filtrandoli per data di emanazione nella stessa finestra, restano **128**.

Il divario reale è quindi di **9 decreti**, non di 3 come indicato in una prima stesura di questa nota. Distribuzione per anno di emanazione:

| anno | Normattiva | con atto Camera | senza |
|---|---:|---:|---:|
| 2022 (dal 13/10) | 11 | 10 | 1 |
| 2023 | 39 | 38 | 1 |
| 2024 | 32 | 29 | 3 |
| 2025 | 34 | 33 | 1 |
| 2026 (all'8/8) | 21 | 18 | 3 |
| **totale** | **137** | **128** | **9** |

Dei nove è stato identificato con certezza il **DL 179/2022**, presente in Normattiva e privo di atto Camera. Gli altri otto sono localizzati per anno ma non ancora per numero.

Ne segue la precisazione che più conta se questi numeri finiscono in un pezzo: **quello che misuriamo sono disegni di legge di conversione presentati alla Camera, non decreti-legge emanati.** Sono popolazioni diverse, e i nove mancanti sono decreti presentati al Senato e non ancora trasmessi, oppure emanati negli ultimi giorni e non ancora recepiti. Per il numero dei decreti emanati la fonte è Normattiva; il nostro conto misura l'attività parlamentare di conversione alla Camera. La tendenza mostrata dai KPI — la quota crescente di leggi che nascono da un decreto — non cambia, perché lo scarto è costante e piccolo; cambia l'etichetta da mettere in tabella.

Come rifare la verifica: sul portale open data di Normattiva la ricerca avanzata è parametrizzata in query string (`dati.normattiva.it/risultati?isAdvancedSearch=true&denominazioneAtto=DECRETO-LEGGE&dataInizioPubblicazione=…&dataFinePubblicazione=…`) e il totale si legge nell'etichetta "Elenco atti scaricabili (N)". **Attenzione**: la SPA applica il filtro di data fine in modo inaffidabile quando si passa da una ricerca all'altra, e restituisce il conteggio cumulativo della sola data d'inizio — va verificato che il numero cambi davvero fra una finestra e l'altra, altrimenti si legge un residuo. Per l'elenco completo conviene il download ufficiale della collezione (ZIP in AKN/XML/JSON), che passa da un flusso via email con conferma.

**Le fiducie sono votazioni, non atti.** La colonna conta le votazioni con richiesta di fiducia (`ocd:richiestaFiducia`), non i provvedimenti su cui la fiducia è stata posta: un singolo decreto può portarne più di una. Per legarle ai provvedimenti serve un passaggio in più, via `votes --bill-code`.

## File

- `scripts/kpi-decretazione/kpi.sh` — estrazione dei dati grezzi
- `scripts/kpi-decretazione/aggrega.sql` — calcolo dei KPI
- `data/` — CSV grezzi, uno per misura e per legislatura, rigenerabili
