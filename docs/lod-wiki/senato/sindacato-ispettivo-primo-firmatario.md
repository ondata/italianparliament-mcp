---
type: Gotcha
title: Primo firmatario di un atto di sindacato ispettivo — sta nel suffisso del nodo iniziativa
description: Sul sindacato ispettivo osr:primoFirmatario non esiste; l'ordine di firma è nel suffisso numerico dell'URI dell'iniziativa (…-1, -2, -3). Aggregare con MIN sui nomi o sugli URI produce accoppiamenti sbagliati.
resource: https://dati.senato.it/sparql
tags: [senato, osr, firmatari, sindacato-ispettivo, trappole]
timestamp: 2026-08-19
---

I firmatari di un atto di sindacato ispettivo si leggono come quelli dei DDL, da `osr:iniziativa`: ogni nodo porta `osr:presentatore` (etichetta testuale) e `osr:senatore` (URI). Ma con una differenza che conta.

# Il flag `osr:primoFirmatario` qui non c'è

Sui DDL il flag esiste, con le sue insidie (vedi [firmatari-iniziativa](firmatari-iniziativa.md)). Sul sindacato ispettivo **non è mai asserito**. Misurato il 2026-08-19 su leg. 19: degli atti `osr:SindacatoIspettivo`, quelli con almeno un `osr:iniziativa` che porti `osr:primoFirmatario` sono **zero**.

```sparql
PREFIX osr: <http://dati.senato.it/osr/>
SELECT (COUNT(DISTINCT ?s) AS ?n) WHERE {
  ?s a osr:SindacatoIspettivo ; osr:legislatura 19 ; osr:iniziativa ?i .
  ?i osr:primoFirmatario ?pf .
}
```

# Dove sta davvero l'ordine di firma

Nel **suffisso numerico dell'URI del nodo iniziativa**: `…/iniziativa/INIZ-SINDISP-<idAtto>-1`, `-2`, `-3`. Il `-1` è il primo firmatario.

Verificato su due atti a più firme:

- **3-01513** (leg. 18, 22/4/2020), quattro firmatari: `-1` De Falco, `-2` Buccarella, `-3` Di Marzio, `-4` Nugnes. Il dataset AIC della Camera, che pubblica gli stessi atti, indica De Falco come presentatore: **le due fonti concordano sul `-1`**.
- **1-00050** (leg. 19), 145 firmatari: `-1` Francesco Boccia.

Copertura misurata su leg. 19: 6.632 atti in tutto, 6.422 con almeno un'iniziativa, e **tutti e 6.422 hanno il nodo `-1`**. I 210 restanti non hanno alcun firmatario nel grafo, non un `-1` mancante.

# La trappola: aggregare con MIN

Con `GROUP BY ?atto` viene naturale scrivere `(MIN(?presentatore) AS ?nome) (MIN(?senatore) AS ?uri)`. Sono **due aggregati indipendenti**, che scelgono ciascuno il proprio minimo su un insieme diverso: il nome per ordine alfabetico, l'URI per ordine lessicale sul numero. Il risultato accoppia il nome di un firmatario all'URI di un altro.

Su 3-01513 usciva così: nome **Paola Nugnes** (minimo alfabetico) con URI **senatore/29055**, che è **Buccarella** — e il primo firmatario, De Falco, non compariva affatto. Chi cita il proponente da lì cita una persona sbagliata, e l'URI ne porta a una terza.

E il minimo lessicale non è comunque l'ordine di firma: fra `…-1`, `…-10` e `…-2`, l'ordinamento per stringa mette `-10` prima di `-2`.

# La query giusta

Si vincola il nodo iniziativa al suffisso `-1`, così l'atto ne porta **uno solo** e le due colonne vengono per forza dalla stessa persona:

```sparql
PREFIX osr: <http://dati.senato.it/osr/>
SELECT ?s ?presentatore ?senatore WHERE {
  ?s a osr:SindacatoIspettivo ; osr:legislatura 19 ; osr:iniziativa ?iniz .
  FILTER(STRENDS(STR(?iniz), "-1"))
  ?iniz osr:presentatore ?presentatore ; osr:senatore ?senatore .
} LIMIT 10
```

Va tenuto in `OPTIONAL` se si vogliono anche gli atti senza firmatari nel grafo.

**Niente `BIND` né subquery**: il Virtuoso del Senato rifiuta entrambi, quindi la selezione va fatta con un `FILTER` dentro il pattern.

# Da sapere anche

`osr:numero` è un letterale tipizzato: `?s osr:numero "1-00050"` non matcha, serve `FILTER(STR(?num) = "1-00050")`.

Lo stesso numero può appartenere a **due atti distinti** nella stessa legislatura, con URI e date diverse (la mozione 1-00050 esiste come `sindacatoispettivo/138071` del 24/5/2023 e `138147` del 15/6/2023). Il numero non è una chiave.
