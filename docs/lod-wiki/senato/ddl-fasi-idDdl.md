---
type: Query template
title: Il numero non si conserva tra i rami — le fasi di un DDL si legano con osr:idDdl
description: C.2669 alla Camera diventa S.1924 al Senato. Cercare il numero Camera sul ramo S dà un vuoto che sembra "il Senato non ha ancora l'atto". Le fasi dello stesso DDL condividono osr:idDdl, e il repertorio Senato contiene anche le fasi Camera (osr:ramo="C").
tags: [senato, ddl, iter, navetta, idDdl, fase, ramo]
timestamp: 2026-07-29
---

Il repertorio `osr:Ddl` del Senato **non contiene solo i DDL del Senato**: contiene una risorsa per ogni **fase** dell'iter, comprese quelle svolte alla Camera (`osr:ramo` = `"C"`). Le fasi dello stesso provvedimento sono legate da `osr:idDdl`.

Le proprietà che contano:

| Proprietà | Significato |
|---|---|
| `osr:idDdl` | **identità del provvedimento**, condivisa da tutte le sue fasi nei due rami |
| `osr:idFase` | identità della singola fase (coincide con l'id nell'URI `ddl/<id>`) |
| `osr:fase` | etichetta della fase col ramo, es. `S.1924`, `C.2669`, `S.1440-B` |
| `osr:numeroFase` | solo il numero, **ambiguo** senza il ramo (1933 può essere C.1933 o S.1933) |
| `osr:ramo` | `"S"` o `"C"` |
| `osr:progressivoIter` | progressivo della fase nell'iter |

# La trappola: il numero non si conserva nel passaggio tra i rami

Un atto approvato alla Camera e trasmesso al Senato **riceve un nuovo numero**. Il DDL delega sul nucleare è `C.2669` alla Camera e `S.1924` al Senato: sono la stessa legge in due fasi, con due numeri diversi e due URI `ddl/*` diversi.

Da qui l'errore, osservato in un report automatico del 29/07/2026: si cerca il DDL Senato di un atto Camera **usando il numero Camera sul ramo S**, si ottiene zero righe e si conclude che "il Senato non ha ancora numerato l'atto". Il DDL invece c'era, presentato il 2026-06-08, con l'esame concluso il 2026-07-22.

Peggio: lo stesso numero **esiste spesso in entrambi i rami come atti completamente diversi**. `S.1511` in legislatura 18 è un DDL sulla partecipazione dei titolari di protezione internazionale ad attività di utilità sociale, e non ha nulla a che vedere con `C.1511` (voto ai diciottenni per il Senato). Cercare per numero sul ramo sbagliato non restituisce un vuoto — restituisce **l'atto sbagliato**, che è più insidioso.

# Query: tutte le fasi di un provvedimento, partendo da un numero di un ramo

Due passaggi. Prima l'`idDdl` a partire dalla fase nota (qui una fase Camera):

```sparql
PREFIX osr: <http://dati.senato.it/osr/>
SELECT DISTINCT ?id WHERE {
  ?a osr:idDdl ?id ; osr:numeroFase ?n ; osr:ramo ?r ; osr:legislatura 19 .
  FILTER(REGEX(STR(?n), "^2669(-[A-Z])?$") && STR(?r) = "C")
}
```

Poi tutte le fasi con quell'`idDdl`:

```sparql
PREFIX osr: <http://dati.senato.it/osr/>
SELECT ?fase ?ramo ?prog ?stato ?data WHERE {
  ?s osr:idDdl 54960 ; osr:fase ?fase ; osr:ramo ?ramo ;
     osr:progressivoIter ?prog ; osr:statoDdl ?stato ; osr:dataStatoDdl ?data .
} ORDER BY ?prog ?fase
```

Due query piccole e non una sola con anchor: sull'endpoint Senato un URI di richiesta oltre ~2047 byte torna 403 (vedi [trappole](trappole.md)), e la query del repertorio è già lunga.

# Perché serve: le navette a più letture

Sul DDL costituzionale del voto ai diciottenni, `osr:idDdl` restituisce l'intero percorso in una query, cosa che nessun singolo ramo mostra:

| Fase | Ramo | Stato | Data |
|---|---|---|---|
| C.1511 | C | appr. in t.u. | 2019-07-31 |
| S.1440 | S | approvato | 2020-09-09 |
| C.1511-1647-1826-1873-B | C | approvato | 2021-06-09 |
| S.1440-B | S | appr. definit. Legge | 2021-07-08 |

Le proposte confluite nel testo unificato (C.1647, C.1826, C.1873) hanno `idDdl` propri e restano fuori: `idDdl` segue il provvedimento che prosegue, non i testi assorbiti.

Nel tool `bill-progress` questo aggancio è automatico sul vuoto: `--number <n> --branch S` che non trova un `S.<n>` cerca da sé la fase `C.<n>` e restituisce tutte le fasi dello stesso `idDdl`, spiegando nell'output perché le righe mostrano un altro numero.

# Citations

[1] C.2669 e S.1924 condividono `osr:idDdl` (2026-07-29):
```sparql
SELECT ?fase ?ramo ?idDdl ?prog ?stato ?data WHERE {
  ?s a <http://dati.senato.it/osr/Ddl> ;
     <http://dati.senato.it/osr/idDdl> ?idDdl ;
     <http://dati.senato.it/osr/fase> ?fase ;
     <http://dati.senato.it/osr/ramo> ?ramo ;
     <http://dati.senato.it/osr/progressivoIter> ?prog ;
     <http://dati.senato.it/osr/statoDdl> ?stato ;
     <http://dati.senato.it/osr/dataStatoDdl> ?data .
  FILTER(?idDdl = 54960)
} ORDER BY ?prog
```
Esito: `S.1924` (S, "concluso l'esame", 2026-07-22) e `C.2669` (C, "approvato", 2026-06-04).

[2] La navetta del voto ai diciottenni via `idDdl` di `ddl/52141` (2026-07-29): quattro fasi, tabella sopra.

[3] Omonimia tra rami: `bill-progress list --number 1511 --branch S --legislature 18` restituisce `S.1511` (protezione internazionale), non la fase Senato di `C.1511`.
