# Catalogo delle notizie già testate

## Obiettivo

Evitare che il news-driven CLI gap analyzer selezioni ripetutamente la stessa vicenda parlamentare solo perché Exa propone URL o fonti differenti.

## Disegno

- Conservare un catalogo append-only in `docs/news-agent/catalog.md`.
- Il catalogo contiene solo l'identità delle notizie testate e il report di provenienza; non contiene conclusioni sui punti di forza o debolezza della CLI.
- Considerare duplicati due articoli che riguardano lo stesso atto o tema, la stessa fase parlamentare e la stessa data o seduta sostanziale.
- Considerare nuova una fase differente dello stesso atto.
- Preferire sempre vicende non ancora testate. Prima di riusarne una, effettuare almeno due raffinamenti di ricerca nel relativo bucket.
- Consentire il riuso quando non esistono alternative sufficienti o quando è necessario un test di regressione mirato; motivarlo nel report.
- Dopo ogni run, aggiungere al catalogo le sei notizie selezionate.

## Formato

Ogni sezione si chiama esattamente come il file del report che l'ha prodotta, estensione compresa: `## 2026-07-26_09-30.md`. Nessun'altra forma è ammessa: una sezione con un nome diverso rende impossibile verificare che ogni report abbia lasciato traccia.

Ogni vicenda occupa una riga sola:

```
- **nuova|ritest** — YYYY-MM-DD — leg. NN — Camera|Senato|Camera+Senato — fase concreta ed evento — ref: numero atto e/o URI stabile — URL
```

La data è quella dell'evento parlamentare, non quella della run.

Il campo `ref` accoglie solo dati di identità: numero d'atto (`C.2822`, `S.1951`, `DL 18/2020`), URI del ddl, URI della votazione, codice AIC. Quando non se ne è trovato nessuno si scrive `ref: —`.

Lo status `backfill` marca le sezioni ricostruite a posteriori, dove lo status originale `nuova`/`ritest` non è più ricostruibile.

## Confine con la regola di analisi vergine

I riferimenti stabili sono identità e vanno registrati: servono proprio a riconoscere la stessa vicenda sotto titoli diversi.

Le annotazioni di copertura no. Frasi come "voto assente dal LOD Camera" o "il tool non ha restituito nulla" sono esiti di test: appartengono al report e nel catalogo diventerebbero esattamente la contaminazione che la regola di analisi vergine vieta. Il divieto è esplicito nella fase di aggiornamento del catalogo, non implicito.

## Crescita

Il catalogo viene letto per intero a ogni run, quindi il suo costo cresce linearmente con il numero di run. Sei vicende al giorno diventano oltre duemila righe in un anno.

Regola: superate le 400 righe, le sezioni più vecchie di 90 giorni confluiscono in un'unica sezione `## Archivio fino a YYYY-MM-DD`, con una riga per vicenda **distinta** — le ripetizioni della stessa vicenda su più run collassano in una riga sola, che conserva la data dell'ultimo test. Si perde l'associazione vicenda→report, che serve solo a scegliere quale ritestare per prima; si conserva l'identità, che è ciò su cui si fa dedup.

## Flusso

1. Leggere il catalogo, senza leggere i report precedenti.
2. Cercare e classificare più candidati per ciascun bucket temporale.
3. Confrontare semanticamente i candidati con il catalogo.
4. Selezionare due vicende nuove per bucket quando possibile.
5. Eseguire i test e scrivere il report.
6. Appendere al catalogo una sezione riferita al nuovo report.

Il passo 6 è parte della run, non un'appendice facoltativa: un report senza la sua sezione fa ripetere le stesse vicende alla run successiva.

## Implementazioni

Il flusso vive in due copie che vanno tenute allineate:

- `.agents/skills/news-driven-cli-gap-analyzer/SKILL.md` (skill Pi);
- `.claude/agents/news-driven-cli-gap-analyzer.md` (agent Claude Code).

Una modifica applicata a una sola delle due produce run che ignorano il catalogo pur avendo il catalogo sul disco: è successo tra il 17 e il 25 luglio 2026, con sei run consecutive senza sezione e le stesse vicende riproposte ogni volta.

## Verifica

- Ogni file di report in `docs/news-agent/` ha una sezione omonima nel catalogo:
  `for f in docs/news-agent/2*.md; do grep -q "^## $(basename $f)$" docs/news-agent/catalog.md || echo "MANCA: $f"; done`
- Le due implementazioni contengono entrambe la fase di lettura e quella di aggiornamento del catalogo.
- La skill distingue un URL nuovo da una vicenda nuova.
- La regola di analisi vergine continua a vietare la lettura delle conclusioni pregresse e il catalogo non contiene annotazioni di copertura.
- Un riuso è esplicitamente riconoscibile nel report, con la motivazione.

## Aggiornamenti

- 2026-07-26: normalizzati naming delle sezioni e formato riga; esplicitato il divieto di annotazioni di copertura; aggiunta la regola di crescita; allineato l'agent Claude Code alla skill Pi; ricostruite le sei sezioni mancanti (17, 19, 20, 21, 23, 25 luglio).
