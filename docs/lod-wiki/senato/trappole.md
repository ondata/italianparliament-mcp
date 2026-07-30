---
type: Gotcha
title: Trappole Virtuoso — Senato (OSR)
description: Quirk dell'endpoint SPARQL del Senato (Virtuoso) e del modello OSR.
resource: https://dati.senato.it/sparql
tags: [senato, osr, virtuoso, trappole]
timestamp: 2026-07-01
---

Quirk noti dell'endpoint Senato (`dati.senato.it/sparql`, triplestore Virtuoso) e del modello OSR. Ignorarli produce 0 risultati muti o errori.

# Query e sintassi

| Trappola | Dettaglio |
|----------|-----------|
| `curl` diretto → comportamento **non stabile** | In precedenza l'endpoint poteva rispondere 403 a richieste grezze; alla verifica del 2026-07-01 `curl` semplice restituisce invece 200 (XML o JSON a seconda del `format`). Non assumere più il 403 come proprietà stabile dell'endpoint. |
| **`BIND` non supportato** | Virtuoso Senato rifiuta `BIND(...)`. Portare la logica nel `SELECT`/`FILTER` o usare triple dirette. |
| **`CONCAT` dentro `FILTER` invece funziona** | Verificato 2026-07-01: `FILTER(CONTAINS(LCASE(CONCAT(?fn," ",?ln)), q))` è valido ed è il modo per matchare nome+cognome insieme. |
| **Legislatura come integer nudo** | Filtrare con `FILTER(?leg = 19)` (integer), non stringa né URI. |
| **Subquery aggregate fragili** | Alcune subquery con `COUNT` funzionano, altre no o danno risultati vuoti/inaffidabili a seconda della forma. Non fare affidamento su subquery aggregate complesse: preferire `GROUP BY` + `MIN`/`MAX`/`COUNT` al livello esterno quando possibile. |
| **`osr:dataPresentazione` è `xsd:date` tipizzato** | I `FILTER` sulle date Senato richiedono `"AAAA-MM-GG"^^xsd:date` (la Camera usa stringhe `AAAAMMGG` plain). |
| **`SUBSTR` fuori range aborta; `>=`/`<=` su funzioni stringa è numerico** | Trappole del motore Virtuoso comuni a entrambi gli endpoint: vedi [Trappole Virtuoso — funzioni stringa](../trappole-virtuoso-funzioni-stringa.md). |

# `intervento/null` — la risorsa senza identità che falsifica i join

Nel grafo esiste la risorsa letterale **`http://dati.senato.it/intervento/null`**: è quello che resta quando l'id dell'intervento manca alla fonte e la serializzazione scrive `null` nell'URI invece di omettere il record. Tutti gli interventi privi di id collassano quindi in **un'unica** risorsa `osr:Intervento`.

Misurato il 2026-07-30: quel nodo porta **36.853** triple `osr:seduta` e **47.571** triple `osr:oggetto`.

Perché è la trappola peggiore del modello OSR: il percorso naturale per sapere *in quale seduta* è stato trattato un atto è `?o ← ?int → ?seduta` (dall'oggetto di trattazione all'intervento, e da lì alla seduta). Quel percorso attraversa il nodo, e il risultato è un **prodotto cartesiano**. Non produce un vuoto — produce **righe false**, indistinguibili dalle vere.

Caso reale: le sedute di commissione sull'**Atto del Governo n. 418** (schema di d.lgs. su IA e attività di polizia, `documento/54072`) risultavano **18.945**, comprese sedute d'Assemblea del **1996**, per un atto presentato il 24 giugno 2026. Le sedute realmente ricostruibili sono **zero**: l'unico intervento collegato a quell'atto è il nodo senza identità.

La difesa è escluderlo per identità esatta in ogni join sugli interventi:

```sparql
?int a osr:Intervento ; osr:oggetto ?o ; osr:seduta ?seduta .
FILTER(?int != <http://dati.senato.it/intervento/null>)
```

Escluderlo **non** è indovinare un dato mancante: è scartare un record che la fonte stessa dichiara privo di identità. Gli interventi veri hanno un id (`int_aula-…`, `int_cons-…`) e restano tutti — verificato che la seduta d'Assemblea legittima sul DDL nucleare (`ddl/60187`, 29/7/2026) sopravvive al filtro perché il suo intervento è `int_aula-25547-30102-1`.

**Attenzione al rovescio**: dopo il filtro, un vuoto su un atto agganciato *solo* al nodo non significa "non è stato esaminato" — significa che la trattazione risulta avvenuta ma la seduta non è deducibile dal grafo. Sono due conclusioni opposte e vanno distinte: l'atto 418 era in esame in Commissione politiche UE proprio nei giorni in cui il grafo non sa dire dove. In quel caso la fonte da usare è il resoconto o il bollettino delle Giunte e Commissioni, oppure si segue la **commissione** per date invece dell'atto. `committee-sessions` sonda la differenza e la dichiara nel messaggio di vuoto.

# Il collegamento atto→commissione manca sugli Atti del Governo

Sui documenti di tipo `Atto del Governo sottoposto a parere parlamentare` il LOD espone anagrafica e testo — `osr:numeroDoc`, `osr:tipoDoc`, `osr:statoDoc`, `osr:dataPresentazione`, `osr:titolo`/`titoloBreve`, `osr:URLTesto` (PDF ufficiale) — ma **nessuna proprietà di assegnazione alla commissione**. Verificato il 2026-07-30 su `documento/54072`: nessun `osr:assegnazione` né equivalente.

La `osr:Procedura` collegata (`osr:tipo` = "Parere su atti del Governo", legata all'atto da `osr:relativoA`) porta titolo, tipo e legislatura, ma nemmeno lei dichiara l'organo. Quindi «quale commissione sta esaminando questo schema di decreto» non è una domanda che il LOD Senato sappia rispondere: va risolta dal bollettino o dalla scheda dell'atto su senato.it.

# Matching nomi parlamentari

`foaf:firstName` e `foaf:lastName` sono **campi separati**: un `FILTER(CONTAINS(?fn, q) || CONTAINS(?ln, q))` **non matcha** una query che contiene nome+cognome insieme (es. `"Ignazio La Russa"` fallisce, `"La Russa"` funziona). Serve il match sulla concatenazione nei due ordini:

```sparql
FILTER( CONTAINS(LCASE(CONCAT(?fn, " ", ?ln)), q)
     || CONTAINS(LCASE(CONCAT(?ln, " ", ?fn)), q) )
```

Vedi issue #20. La Camera non ha il problema perché matcha su `rdfs:label` intero.

# Performance

Quando la legislatura è codificata **solo nell'URI**, un range filter su `?s` + `ORDER BY DESC(?s)` + `GROUP BY` è molto più veloce di `STRSTARTS` (es. `speeches` 6s → 1.8s).

# Citations

[1] Verifica `CONCAT`/matching nomi (2026-07-01): `sparql query --endpoint senato` su `"Ignazio La Russa"` → `senatore/1275`.
[2] Issue matching nomi: https://github.com/ondata/italianparliament-mcp/issues/20
