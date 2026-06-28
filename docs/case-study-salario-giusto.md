# Inchiesta in otto mosse: la fiducia sul decreto "salario giusto"

Un caso reale di cronaca parlamentare ricostruito end-to-end con i soli dati aperti di Camera e Senato. Lo scopo di questo documento è duplice:

- mostrare a una **redazione** come costruire un pezzo verificabile, passo per passo, a partire dai dati ufficiali;
- mostrare a un **data journalist** quali comandi orchestrare e in quale ordine.

La data di riferimento dei dati è fine giugno 2026 (XIX legislatura, I Governo Meloni).

## Glossario minimi per il cronista

- **Decreto-legge (DL)**: atto del governo con forza di legge, emanato in casi di necessità e urgenza. Entro **60 giorni** deve essere convertito in legge dal Parlamento, altrimenti decade.
- **DDL di conversione**: disegno di legge con cui il Parlamento converte il DL (e può emendarlo). Il DL originale, una volta convertito, diventa legge.
- **Questione di fiducia**: il governo chiede alla Camera di approvare un testo "mettendo in gioco" la propria permanenza. Se il testo non passa, il governo deve dimettersi. La fiducia comprime il dibattito e di fatto impedisce emendamenti.
- **Appr. def. (approvazione definitiva)**: l'ultimo passaggio, quello che trasforma il DDL in legge. Avviene nel ramo che per ultimo vota il testo.

## La notizia in una riga

Il 24 giugno 2026 il Senato approva in via definitiva, con **questione di fiducia**, la conversione del **decreto-legge 30 aprile 2026, n. 62** — il cosiddetto decreto "salario giusto" — con **94 favorevoli, 61 contrari, 2 astenuti** (36 senatori assenti).

Tutto ciò che segue è la ricostruzione di quella riga a partire dai dati grezzi.

---

## Fase 1 — Ancorare il contesto: legislature e governo

Prima di cercare l'atto, fissiamo il quadro istituzionale. È quello che permette, in chiusura di pezzo, di scrivere "nella XIX legislatura, governo Meloni" con i dati in mano.

```bash
italianparliament legislatures list
italianparliament governments list
```

Risultato: la **XIX legislatura della Repubblica** inizia il **13.10.2022**; il **I Governo Meloni** è in carica dal **21.10.2022**. Ogni atto successivo si colloca dentro questo perimetro.

## Fase 2 — Trovare il provvedimento

Un cronista non parte dall'URI: parte da una parola. Cerchiamo nell'iter dei DDL del Senato.

```bash
italianparliament bill-progress list --legislature 19 --keyword "salario giusto"
```

Tra i risultati emerge il DDL **S.1933** (`http://dati.senato.it/ddl/60201`): "Conversione in legge del decreto-legge 30 aprile 2026, n. 62, recante disposizioni urgenti in materia di salario giusto, di incentivi all'occupazione e di contrasto del caporalato digitale". Stato: **appr. def.** del **2026-06-24** — approvazione definitiva, dunque legge. Lo stesso comando restituisce anche la data di presentazione del DDL di conversione (2026-06-11), utile per la timeline (Fase 9).

> Nota metodologica: la ricerca testuale sull'iter è la via più rapida quando non si conosce il numero di atto. Una volta trovato l'URI, ogni comando successivo si concatena su quello.

## Fase 3 — Di che atto si tratta, e da dove viene

Il decreto-legge è un atto governativo. Verifichiamo iniziativa e firmatari.

```bash
italianparliament bill-signatories show --ddl-uri http://dati.senato.it/ddl/60201
```

Primo firmatario: **Pres. Consiglio Giorgia Meloni**; cofirmatari i ministri competenti (Calderone al Lavoro, Roccella, altri). Tipologia: **Governativa**. È un atto del governo Meloni, presentato per la conversione di un decreto-legge.

## Fase 4 — Chi l'ha relazionato

Il relatore in commissione è la firma che "guida" l'iter tecnico. Lo recuperiamo dall'URL del DDL, senza query aggiuntive.

```bash
italianparliament bill-rapporteurs list --bill-uri http://dati.senato.it/ddl/60201
```

Relatore in commissione (Lavoro): **Sen. Paola Mancini** (FdI), il 2026-06-11. È il nome da citare per ogni approfondimento sul merito (comma per comma, chi ha chiesto cosa).

## Fase 5 — Le votazioni sull'atto

In una seduta possono esserci più votazioni sullo stesso provvedimento (pregiudiziale, finale, fiducia). Il modo più affidabile per trovarle tutte è filtrare **per data** della seduta, non per `ddl_uri`.

```bash
italianparliament senato-votes list --legislature 19 --date-from 2026-06-24 --date-to 2026-06-24
```

> Perché non `--ddl-uri`? Nel dataset del Senato il voto di fiducia ha il campo `ddl_uri` **vuoto**: il legame con il DDL n.1933 è scritto solo nel testo della `label` ("Disegno di legge n.1933. Votazione questione di fiducia."), non nel campo strutturato. Filtrando per data si recuperano tutte le votazioni della seduta, fiducia compresa.

La seduta del 2026-06-24 contiene, fra le altre:

| Votazione | Esito | Sì / No / Ast. | DDL collegato |
|---|---|---|---|
| `19-432-2` Questione pregiudiziale | respinta | 52 / 79 / 0 | `ddl/60201` (S.1933) |
| `19-432-3` **Questione di fiducia** | approvato | **94 / 61 / 2** | nessuno in `ddl_uri` (DDL n.1933 nella `label`) |

La votazione finale `19-432-1` (79/51/0) appartiene a un **atto diverso** (`ddl/60220`, testo unificato) e va tenuta separata dal nostro decreto: è un trabocchetto tipico quando si lavora per data invece che per atto.

La fiducia è il passaggio politico: il governo mette la propria sopravvivenza sul testo e la maggioranza si compatta. Notare la logica: la **questione pregiudiziale** (che chiedeva di non procedere) è **respinta** con 79 no, e subito dopo la **fiducia** è **approvata** con 94 sì — due facce della stessa maggioranza.

## Fase 6 — Come ha votato ogni gruppo

Qui sta il cuore dell'inchiesta. Scarichiamo il dettaglio nominale della fiducia e lo aggreghiamo per gruppo.

```bash
italianparliament senato-vote-detail show \
  --vote-uri http://dati.senato.it/votazione/19-432-3 --format jsonl \
  > fiducia-salario.jsonl
```

Poi, con un piccolo script (qualunque strumento vale — DuckDB, jq, pandas), si pivotta `group_label` × `vote`. Totale generale dei senatori: **193** (94 sì + 61 no + 2 astenuti + 36 assenti).

| Gruppo | Favorevoli | Contrari | Astenuti | Assenti | Totale |
|---|---:|---:|---:|---:|---:|
| Fratelli d'Italia | 54 | – | – | 7 | 61 |
| Lega - Psd'Az | 22 | – | – | 5 | 27 |
| Forza Italia - Berlusconi Presidente - PPE | 12 | – | – | 8 | 20 |
| Civici d'Italia-UDC-Noi Moderati-MAIE | 6 | – | – | 2 | 8 |
| Partito Democratico - IDP | – | 29 | – | 6 | 35 |
| MoVimento 5 Stelle | – | 21 | – | 2 | 23 |
| Italia Viva - Casa Riformista | – | 6 | – | – | 6 |
| Misto | – | 4 | – | 3 | 7 |
| Per le Autonomie (SVP-PATT, Campobase) | – | 1 | 2 | 3 | 6 |
| **Totale** | **94** | **61** | **2** | **36** | **193** |

Lettura giornalistica immediata:

- **Maggioranza compattissima**: FdI, Lega, Forza Italia e Civici votano compatte a favore, nessun dissenso interno.
- **Opposizione compatta sul no**: PD, M5S, Italia Viva, Misto. Nessun "ribelle", nessun trasfuga verso il sì.
- **SVP-PATT spaccato**: 1 no, 2 astenuti, 3 assenti. È il dettaglio che merita un paragrafo a sé: le minoranze linguistiche non si allineano né con la maggioranza né con l'opposizione, e per giunta per tre senatori su sei non sono nemmeno in aula.

> Controllo di coerenza: i totali di colonna (94 / 61 / 2 / 36) devono sommare a 193, il numero dei senatori in carica. Se non tornano, c'è un errore nell'aggregazione. È la verifica che distingue un dato pubblicabile da uno da ricontrollare.

## Fase 7 — I "silenzi" della fiducia

In un voto di fiducia l'assenza vale quanto il voto: la fiducia passa comunque grazie alla maggioranza che c'è, ma le assenze di peso raccontano altro. Filtriamo i non-partecipanti per gruppo e otteniamo nomi, non solo numeri.

```bash
italianparliament senato-vote-detail show \
  --vote-uri http://dati.senato.it/votazione/19-432-3 \
  --vote-type "In congedo/missione" --format csv
```

Tra gli assenti della maggioranza spiccano, per FdI, **Adolfo Urso**, **Giovanbattista Fazzolari**, **Roberto Menia**; per Forza Italia, **Maria Elisabetta Alberti Casellati**, **Maurizio Gasparri**, **Francesco Paolo Sisto**. Per un cronista è materia per un box "chi non era in aula sul decreto più delicato dell'anno" — con un caveat: "in congedo/missione" copre missioni istituzionali e assenze vere, la distinzione va chiesta ai gruppi.

## Fase 8 — Il testo del provvedimento

Metadati e voti non bastano: prima o dopo il pezzo serve leggere il testo. L'endpoint SPARQL non espone l'articolato, ma `bill-text` recupera i link giusti per ogni ramo.

```bash
italianparliament bill-text links --uri http://dati.senato.it/ddl/60201
```

Il comando restituisce, già classificati, i punti di accesso al testo:

| Kind | Formato | Auth | Cosa è |
|---|---|---|---|
| `testi` | html | browser | Pagina "Testi ed emendamenti": elenco dei PDF (Testo DDL, Relazione, testi successivi) |
| `fascicolo` | pdf | browser | Fascicolo iter completo (articolato + relazioni + resoconti commissione e aula), PDF unico |
| `scheda` | html | browser | Scheda DDL con dati generali e iter |
| `urn` | urn | none | URN NIR del testo presentato (identificatore, non un file) |
| `come-scaricare` | cli | cli-locale | Il comando per ottenere il testo in markdown locale |

L'informazione chiave è il campo `auth`: dice già all'agente (o al cronista) se il link è scaricabile in automatico (`none`) o se serve un browser (`browser`). Per il Senato, `www.senato.it` è dietro AWS WAF e un `fetch` normale ottiene un HTTP 202 invece del documento.

Per avere il testo in markdown, lavorabile in redazione, la CLI fa tutto in locale: apre un browser reale, supera il WAF, scarica il PDF e lo converte. Richiede `agent-browser` e `lit` installati.

```bash
# Solo il testo del DDL
italianparliament bill-text fetch --did 60201

# L'intero fascicolo iter (articolato + relazioni + resoconti)
italianparliament bill-text fetch --did 60201 --fascicolo --out fascicolo-salario.md
```

**Cosa cercare nel testo, una volta in mano.** Per un decreto lavoro, i tre punti che fanno pezzo:

- la definizione operativa di **"salario giusto"** (soglie, calcolo, sanzioni);
- le **esenzioni o aliquote agevolate** per i datori di lavoro (spesso il vero costo);
- le norme su **caporalato digitale** e piattaforme (ambito applicativo, oneri a carico della piattaforma).

Confrontando questi punti con la Relazione del relatore (sempre nel fascicolo) e con gli emendamenti discussi in commissione, si costruisce la versione "prima e dopo" del decreto.

Lo stesso comando `bill-text links` funziona anche per i DDL della Camera (basta passare un URI `dati.camera.it`): l'accesso al testo è coperto per entrambi i rami; l'unica asimmetria è la conversione locale in markdown (`fetch`), oggi Senato-only perché il sito del Senato richiede il passaggio del browser per il WAF.

## Fase 9 — Dal decreto alla legge: la tempistica

Dobbiamo distinguere due date che il dataset tiene separate: la data del **decreto-legge originario** e la data di **presentazione del DDL di conversione** al Senato.

- Data del decreto-legge (DL 62/2026): **30 aprile 2026** — ricavata dal **titolo** dell'atto, non da un campo dedicato (il Senato non espone in SPARQL la data di emanazione del DL).
- Presentazione del DDL di conversione S.1933: **2026-06-11** (campo `presentation_date` di `bill-progress`).
- Approvazione definitiva al Senato: **2026-06-24** (campo `status_date`).

Dalla presentazione del DDL di conversione all'approvazione definitiva sono **13 giorni** di iter parlamentare. Dall'emanazione del DL (30 aprile) alla conversione in legge sono **55 giorni**, sotto la soglia dei 60 oltre la quale un decreto-legge decade. Il primo numero misura la velocità del Parlamento su questo testo; il secondo, la rapidità complessiva del percorso decreto→legge. Per un confronto, lo stesso flusso su altri DL recenti (`bill-progress list --keyword "conversione"`) mostra quanto questa velocità sia nella norma o anomala.

---

## Cosa abbiamo costruito

Partendo da una sola parola chiave ("salario giusto") e usando nove comandi distinti, abbiamo prodotto:

1. il quadro istituzionale (legislatura, governo in carica);
2. l'identificazione certa del provvedimento (URI, numero, natura);
3. la catena di responsabilità (governo firmatario, relatore in commissione);
4. l'esito puntuale di ogni votazione, con la logica fiducia/pregiudiziale;
5. la mappa del voto per gruppo, con totali verificati (94+61+2+36=193);
6. l'anomalia editoriale (lo spaccato SVP-PATT);
7. i nomi degli assenti significativi;
8. il testo del provvedimento e cosa cercarci dentro;
9. la tempistica del percorso decreto→legge.

Tutto verificabile contro `dati.senato.it` e `dati.camera.it`. Ogni numero del pezzo è rintracciabile a un'URI.

## Lo stesso flusso, più velocemente

Per una redazione che produce cronaca ogni giorno, il flusso si presta a essere orchestrato da un agente AI tramite la skill `italian-parliament-cli` (o il server MCP). Il cronista scrive la domanda in linguaggio naturale e l'agente costruisce la stessa catena di comandi descritta sopra, senza che il giornalista debba conoscere gli URI o l'ordine degli step.

Esempio di prompt di partenza:

> "Trova il decreto-legge sul 'salario giusto' convertito a fine giugno 2026. Dimmi chi l'ha firmato e relazionato, com'è andato il voto di fiducia al Senato, come si sono divisi i gruppi, chi era assente nella maggioranza e quanto ci ha messo il percorso dal DL alla legge."

La skill incapsula proprio questo: scoperta → URI → dettaglio → aggregazione. Il cronista pensa alla domanda, l'agente alla pipeline.

## Comandi usati in ordine

```bash
italianparliament legislatures list
italianparliament governments list
italianparliament bill-progress list --legislature 19 --keyword "salario giusto"
italianparliament bill-signatories show --ddl-uri http://dati.senato.it/ddl/60201
italianparliament bill-rapporteurs list --bill-uri http://dati.senato.it/ddl/60201
italianparliament senato-votes list --legislature 19 --date-from 2026-06-24 --date-to 2026-06-24
italianparliament senato-vote-detail show --vote-uri http://dati.senato.it/votazione/19-432-3 --format jsonl
italianparliament senato-vote-detail show --vote-uri http://dati.senato.it/votazione/19-432-3 --vote-type "In congedo/missione" --format csv
italianparliament bill-text links --uri http://dati.senato.it/ddl/60201
italianparliament bill-text fetch --did 60201 --fascicolo --out fascicolo-salario.md
```

Dieci righe di terminale, una notizia completa, citabile e con il testo in mano.
