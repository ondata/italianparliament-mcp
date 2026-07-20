---
type: Trappola
title: Il link votazione → atto (`ocd:rif_attoCamera`) è largamente assente
description: Metà delle votazioni Camera non ha rif_attoCamera; su alcune sedute manca all'intera giornata. L'atto va ricostruito dal testo di dc:description e, per i voti a codice secco, dalla monotematicità della seduta.
resource: https://dati.camera.it/sparql
tags: [camera, votazione, atto, rif_attoCamera, emendamenti, seduta]
timestamp: 2026-07-20
---

La proprietà che collega una `ocd:votazione` al provvedimento votato è `ocd:rif_attoCamera`. È l'unico link strutturato disponibile — e non è affidabile.

# Quanto manca

Votazioni prive di `rif_attoCamera` (conteggi su `dati.camera.it/sparql`, luglio 2026):

| Legislatura | Votazioni | Senza atto |
|---|---|---|
| 17 | 24.930 | ~11.100 |
| 18 | 10.724 | ~7.300 |
| 19 | 18.917 | ~10.000 |

Non è un fenomeno solo delle votazioni recenti non ancora consolidate: il buco è distribuito su tutte le legislature e su quasi tutte le sedute.

# Trappola: sedute intere senza il link

Il caso peggiore non è il voto isolato, è la **seduta intera**. La seduta `s19_689` (14/7/2026, prima lettura della legge elettorale) ha 12 votazioni e **zero** triple `rif_attoCamera`, pur vertendo tutta su un solo atto (`ac19_2822`):

```sparql
PREFIX ocd: <http://dati.camera.it/ocd/>
SELECT DISTINCT ?atto WHERE {
  ?v ocd:rif_seduta <http://dati.camera.it/ocd/seduta.rdf/s19_689> ;
     ocd:rif_attoCamera ?atto
}
# → 0 righe
```

Conseguenza pratica: chi cerca "i voti sull'atto 2822" col solo link strutturato non trova nulla, incluso il voto sull'emendamento preferenze (188 contrari / 187 favorevoli) che ha deciso la vicenda.

# Ricostruire l'atto dal testo

`dc:description` è la fonte di riserva, ma il suo formato non è uniforme. Tre famiglie osservate sui voti senza atto (leg. 19, proporzioni su ~20.000 righe):

1. **Ordini del giorno (~58%)** — `"Ordine del giorno n. 9/1049/3 ZANELLA LUANA (AVS)"`, oppure la forma breve `"ODG 9/2920/46"`. Il numero dell'atto è **il segmento centrale** della numerazione `9/<atto>/<progressivo>`, con `E ABB` come suffisso tollerato. Estraibile in modo deterministico.
2. **Codice secco (~19%)** — `"EM 1.1077"`, `"SUBEM 0.1.1077.4"`. Nessun riferimento all'atto, né nel testo né nel grafo. Non ricostruibile dalla singola riga.
3. **Mozioni e risoluzioni (~20%)** — `"MOZ 1-586"`, `"Risoluzione n. 6-263"`. Sono AIC a sé stanti: **è corretto** che non abbiano un atto collegato, non vanno agganciate.

Nella stessa seduta le due forme convivono: `vs19_689_002` porta `"PDL 2822-A E ABB - EM 1.1"` (atto ricostruibile) mentre `vs19_689_012` porta solo `"EM 1.1077"`.

# Monotematicità della seduta

Per la famiglia 2 l'unico aggancio possibile è la seduta: se **tutta** la seduta verte su un solo atto, quello è l'atto anche dei voti muti. Distribuzione degli atti per seduta in leg. 19 (408 sedute con votazioni):

| Atti distinti nella seduta | Sedute |
|---|---|
| 1 | 149 |
| 2 | 167 |
| 3 | 63 |
| 4+ | 29 |

Solo il 37% delle sedute è monotematico: l'ereditarietà va applicata **solo** a quelle, altrimenti si attribuiscono emendamenti all'atto sbagliato. Due cautele non negoziabili:

* la monotematicità va calcolata con una query dedicata **sull'intera seduta**, mai sulle righe già filtrate in memoria: un filtro per data o un `LIMIT` stretto possono mostrare un solo atto quando la seduta ne tratta quattro;
* l'insieme degli atti della seduta va costruito dall'unione di `rif_attoCamera` **e** dei numeri citati nelle `dc:description` delle altre votazioni — sulle sedute come `s19_689` il primo insieme è vuoto.

# Implementazione nel progetto

`src/tools/votes.ts` applica i tre livelli in cascata: `rif_attoCamera` → numero citato in `dc:description` (`extractBillNumber`, copre DDL/PDL e ODG) → ereditarietà dalla seduta monotematica (`inheritBillFromSession`, esclude mozioni e risoluzioni). Il numero base è sempre risolto a URI verificandone l'esistenza via `dc:identifier`: nessun URI fabbricato.
