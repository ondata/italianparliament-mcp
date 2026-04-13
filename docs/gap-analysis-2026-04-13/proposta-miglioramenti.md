# Proposta Miglioramenti — italianparliament-mcp

Data: 2026-04-13

Priorita ordinata per impatto giornalistico: quante user stories ad alta priorita sblocca ogni miglioramento.

---

## Tier 1 — Sblocca user stories ALTA, impatto massimo

### M-01. Ricerca full-text su titolo DDL e votazioni

**Sblocca:** US-10, US-13, US-17, US-30 (4 user stories, di cui 2 ALTA)
**Cosa fare:** Aggiungere parametro `search` (o `keyword`) a `bills`, `bill-progress`, `votes`. Implementare con `FILTER(CONTAINS(LCASE(?title), LCASE(?keyword)))` in SPARQL.
**Complessita:** Bassa — e un filtro SPARQL aggiuntivo.
**Rischio:** Performance su endpoint con molti risultati (testare con LIMIT ragionevole).

### M-02. Composizione commissioni (membri + ruoli)

**Sblocca:** US-27, parzialmente US-28 (2 user stories ALTA)
**Cosa fare:** Nuovo tool `committee-members` per Senato (i dati ci sono: `osr:SedutaCommissione` gia usata per il conteggio). Esplorare se Camera espone composizione commissioni via SPARQL.
**Complessita:** Media — richiede esplorazione endpoint e nuova query.
**Rischio:** La Camera potrebbe non esporre il dato (verificare con query esplorativa).

### M-03. Filtro `confidence_vote` su `votes`

**Sblocca:** US-11 (1 user story ALTA)
**Cosa fare:** Aggiungere parametro booleano `confidenceVote` al tool `votes`. Il campo `confidence_vote` e gia estratto dalla query, basta aggiungere un `FILTER`.
**Complessita:** Molto bassa — il dato c'e gia, manca solo il parametro.

### M-04. Filtro data su `sessions`

**Sblocca:** US-01 (1 user story ALTA)
**Cosa fare:** Aggiungere `dateFrom`/`dateTo` al tool `sessions`, come gia fatto su `votes`, `aic`, `bills`, `sindacato-ispettivo`.
**Complessita:** Molto bassa — pattern gia consolidato.

### M-05. Fix presentatore `sindacato-ispettivo` Senato

**Sblocca:** US-04 parzialmente (1 user story ALTA)
**Cosa fare:** Il campo `presentatore` e `senatore_uri` sono vuoti quando non si filtra per senatore (dedup fix precedente). Trovare un modo per restituire almeno il primo firmatario senza duplicare le righe (SAMPLE o subquery).
**Complessita:** Media — richiede riscrittura SPARQL con attenzione alla dedup.

---

## Tier 2 — Sblocca user stories MEDIA, valore alto

### M-06. Tool `rank` per Senato

**Sblocca:** US-18, US-24 parzialmente
**Cosa fare:** Equivalente del tool `rank` Camera su endpoint Senato. Dimensioni: sindacato-ispettivo primo firmatario, DDL primo firmatario.
**Complessita:** Media — bisogna costruire le query GROUP BY su endpoint Senato (che ha sintassi diversa da Camera).

### M-07. Filtro circoscrizione/regione su `deputies`

**Sblocca:** US-08
**Cosa fare:** Estrarre la circoscrizione dalla label elezione e aggiungere parametro `region`. Oppure esporre il campo gia presente e rendere filtrabile.
**Complessita:** Bassa.

### M-08. Filtro per deputato su `group-members`

**Sblocca:** US-07
**Cosa fare:** Aggiungere parametro `deputyUri` a `group-members` per recuperare la storia dei gruppi di un singolo deputato.
**Complessita:** Molto bassa — aggiungere FILTER.

### M-09. Ordinamento inverso su `rank`

**Sblocca:** US-25
**Cosa fare:** Aggiungere parametro `order: asc|desc` (default desc). Per i meno attivi serve `ORDER BY ASC(?count)`.
**Complessita:** Molto bassa.

### M-10. Filtro per iniziativa su `bills`

**Sblocca:** US-15
**Cosa fare:** Aggiungere parametro `initiative` al tool `bills` (valori: Parlamentare, Governo, Popolare, Regioni).
**Complessita:** Molto bassa — il campo `initiative` e gia nella query.

---

## Tier 3 — Migliora esperienza complessiva

### M-11. Oggetto/titolo negli atti di sindacato ispettivo

**Sblocca:** US-17 parzialmente (il giornalista vuole sapere "di cosa parla" l'interrogazione)
**Cosa fare:** Aggiungere il campo `oggetto` (se disponibile nell'endpoint) alla risposta di `aic` e `sindacato-ispettivo`. Verificare con query esplorativa.
**Complessita:** Bassa se il dato c'e.

### M-12. Cofirmatari DDL Camera

**Sblocca:** US-14 per Camera
**Cosa fare:** Equivalente Camera di `bill-signatories` Senato. Verificare se l'endpoint Camera espone i cofirmatari.
**Complessita:** Media — dipende dal modello dati Camera.

### M-13. Emendamenti arricchiti (presentatore, DDL)

**Sblocca:** US-16
**Cosa fare:** Arricchire il tool `amendments` con presentatore (senatore URI + nome) e DDL collegato. Verificare se l'endpoint Senato espone queste relazioni.
**Complessita:** Media — richiede esplorazione RDF.

### M-14. Votazioni Senato

**Sblocca:** US-02, US-09 per Senato
**Cosa fare:** Verificare se l'endpoint Senato espone dati sulle votazioni. Se non via SPARQL, valutare fonti alternative (scraping senato.it, API non documentate).
**Complessita:** Alta — probabilmente il dato non e in SPARQL.

---

## Riepilogo effort vs impatto

| ID | Miglioramento | Complessita | US sbloccate |
|---|---|---|---|
| M-03 | Filtro confidence_vote | Molto bassa | US-11 |
| M-04 | Filtro data sessions | Molto bassa | US-01 |
| M-08 | Filtro deputato group-members | Molto bassa | US-07 |
| M-09 | Rank ordinamento inverso | Molto bassa | US-25 |
| M-10 | Filtro iniziativa bills | Molto bassa | US-15 |
| M-01 | Ricerca full-text | Bassa | US-10, US-13, US-17, US-30 |
| M-07 | Filtro regione deputies | Bassa | US-08 |
| M-11 | Oggetto atti ispettivi | Bassa | US-17 |
| M-05 | Fix presentatore Senato | Media | US-04 |
| M-02 | Composizione commissioni | Media | US-27, US-28 |
| M-06 | Rank Senato | Media | US-18, US-24 |
| M-12 | Cofirmatari Camera | Media | US-14 |
| M-13 | Emendamenti arricchiti | Media | US-16 |
| M-14 | Votazioni Senato | Alta | US-02, US-09 (Senato) |

## Raccomandazione

**Sprint 1 (quick wins):** M-03, M-04, M-08, M-09, M-10 — cinque modifiche molto semplici (aggiunta di parametri/filtri a tool esistenti) che sbloccano 5 user stories.

**Sprint 2 (massimo impatto):** M-01 (ricerca full-text) + M-05 (fix presentatore Senato) — sblocca le user stories piu richieste dal giornalista.

**Sprint 3 (completezza):** M-02 (commissioni) + M-06 (rank Senato) + M-11 (oggetto atti) — colma i gap strutturali piu importanti.

**Backlog:** M-12, M-13, M-14 — richiedono esplorazione endpoint e potrebbero dipendere da limiti dei dati upstream.
