---
type: Query template
title: Dal DDL alla legge — osr:numeroLegge, osr:dataLegge e l'URN Normattiva
description: Il repertorio Senato dice quale legge è nata da un DDL (numero e data), anche sulle fasi Camera. Da lì l'URN Normattiva si costruisce, ma il tipo di atto va preso da osr:natura e non da un default, e sulle leggi costituzionali il LOD porta una seconda coppia segnaposto (2100-01-01) che non si può accoppiare.
tags: [senato, ddl, legge, normattiva, urn, natura, costituzionale]
timestamp: 2026-11-04
---

Sulle risorse `osr:Ddl` diventate legge il repertorio Senato porta `osr:numeroLegge` (integer) e `osr:dataLegge` (date). Il dato è ripetuto su **tutte le fasi** dello stesso provvedimento, comprese quelle Camera (`osr:ramo="C"`): per un atto Camera il numero della legge si legge dalla sua fase `C.<n>` nel repertorio Senato, senza passare per `osr:idDdl`. Il grafo OCD della Camera **non** ha il numero di legge: l'ultimo `ocd:rif_statoIter` dice solo «Approvato definitivamente. Legge» con la data.

Copertura (DDL distinti per `osr:idDdl` con `numeroLegge`): leg. 19 = 367, leg. 18 = 315, leg. 14 = 687. Contare per fase dà il doppio (771 / 684 / 1618).

Esposto da `bill-progress` (colonne `law_number`, `law_date`, `law_url`) dal 2026-11-04.

# L'URN Normattiva

`https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:<tipo>:<YYYY-MM-DD>;<numero>`, con `<tipo>` da `osr:natura`:

| `osr:natura` | tipo nell'URN |
|---|---|
| `ordinaria`, `di conversione di decreto-legge`, `di approvazione di bilancio` | `legge` |
| `costituzionale` | `legge.costituzionale` |

Verificati con 200 e titolo corretto: L. 177/2025 (interporti), L. 196/2026 (conversione DL 154/2026), L. 117/2024 (bilancio), L. cost. 1/2020 (riduzione dei parlamentari).

**Trappola: l'URN col tipo sbagliato non fallisce, apre un altro atto.** `urn:nir:stato:legge:2020-10-19;1` risponde 200 e mostra il decreto-legge 1/2020, non la legge costituzionale 1/2020. Un default silenzioso su `legge` produrrebbe link che puntano alla norma sbagliata: con `natura` assente o fuori tabella, niente link.

# Trappola: la seconda coppia delle leggi costituzionali

Sui DDL costituzionali il LOD porta spesso **due** `numeroLegge` e **due** `dataLegge`, e le due proprietà non sono legate tra loro:

- `ddl/49285` (riduzione dei parlamentari, leg. 18): numeri `1` e `687`, date `2020-10-19` e `2100-01-01`;
- `ddl/58803` (ordinamento giurisdizionale, leg. 19): solo `690` e `2100-01-01`, con `statoDdl = approvato`.

La coppia `683…690` + `2100-01-01` compare in tutte le legislature (14-19) e solo sulle costituzionali; la scheda storica di 49285 (`/leg/18/BGT/Schede/Ddliter/49285.htm`) riporta «Legge costituzionale n. 1/20 del 19 ottobre 2020, GU n. 261» e il testo pubblicato per il referendum in GU n. 240 del 12 ottobre 2019, ma **non dà un nome al numero 687**: il significato della seconda coppia resta non documentato. Regola nel tool: numero e data si accoppiano solo quando ce n'è **uno** ciascuno e la data non è nel futuro; altrimenti si espongono i valori grezzi (separati da `;`) e il link resta vuoto. Scegliere la coppia «giusta» in codice sarebbe un'ipotesi, non un dato.

Fuori dalle costituzionali non ci sono né date future né numeri multipli (verificato su tutte le legislature con due query mirate).

# Query

Virtuoso Senato non accetta `VALUES` («syntax error at 'VALUES'»); `FILTER(?s IN (...))` con i nomi abbreviati `ddl:N` sì, e in 0,3 s su 5 URI:

```sparql
PREFIX osr: <http://dati.senato.it/osr/>
PREFIX ddl: <http://dati.senato.it/ddl/>
SELECT ?s ?n ?dl WHERE {
  ?s osr:numeroLegge ?n .
  OPTIONAL { ?s osr:dataLegge ?dl }
  FILTER(?s IN (ddl:58034, ddl:59612, ddl:49285))
}
```

Va tenuta **separata** dalla query di elenco: come `OPTIONAL` dentro la lista, i DDL con due coppie moltiplicherebbero le righe (×4) e sfalserebbero `LIMIT`/`OFFSET`. Per la fase Camera:

```sparql
PREFIX osr: <http://dati.senato.it/osr/>
SELECT ?n ?dl ?nat WHERE {
  ?a osr:numeroFase ?nf ; osr:ramo ?r ; osr:legislatura 19 ; osr:numeroLegge ?n .
  OPTIONAL { ?a osr:dataLegge ?dl } OPTIONAL { ?a osr:natura ?nat }
  FILTER(REGEX(STR(?nf), "^703(-[A-Z])?$") && STR(?r) = "C")
}
```

Collegati: `osr:testoApprovato` (URN NIR del testo approvato dal ramo, esposto da `bill-text` come `kind=urn-approvato`); `owl:sameAs` verso la scheda Camera, non ancora usato (#11).
