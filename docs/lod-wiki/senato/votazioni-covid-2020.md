---
type: Gotcha
title: Votazioni d'Assemblea assenti o scollegate dai DDL nel 2020 (leg.18) — finestra COVID estesa
description: le sedute d'Assemblea del periodo COVID esistono nel LOD (con osr:Intervento) ma non hanno alcuna osr:Votazione collegata, compresa la fiducia sul Cura Italia del 9/4/2020. Il buco non è limitato a mar-apr 2020: la fiducia sul Decreto Rilancio (16/7/2020) è del tutto assente, e la votazione finale sul Decreto Agosto (S.1925, 7/10/2020) esiste ma non è collegata al DDL. Gap di dataset, non di query.
resource: https://dati.senato.it/sparql
tags: [senato, osr, votazioni, freschezza, assenti, covid]
timestamp: 2026-07-08
---

`senato-votes` restituisce vuoto per l'intera finestra **10 marzo → 16 aprile 2020** (legislatura 18), inclusa la seduta del 9 aprile in cui fu votata la fiducia sul decreto Cura Italia (S.1766, esito noto da fonti terze: 142 sì, 99 no, 4 astenuti).

**Il buco è più ampio di mar-apr 2020.** Verifiche successive (run news-driven `docs/news-agent/2026-07-08_21-23.md`) mostrano che il problema si estende ad altri due provvedimenti chiave del 2020:

- **Decreto Rilancio** (d.l. 19 maggio 2020 n. 34, S.1874): la fiducia votata al Senato il 16 luglio 2020 **non compare affatto** nel LOD. Le votazioni di luglio 2020 ci sono (57 in tutto il mese), ma sono tutte mozioni e comunicazioni del governo: nessuna riguarda il Rilancio (zero occorrenze di "fiducia"/"rilancio"/"decreto"/"34" tra i label). Le sedute del 16-17 luglio non hanno `osr:Votazione`.
- **Decreto Agosto** (d.l. 14 agosto 2020 n. 104, S.1925): la votazione finale del 7 ottobre 2020 **esiste** nel LOD, ma **non è collegata al DDL** via `osr:oggetto`/`osr:relativoA`. `senato-votes --ddl-uri http://dati.senato.it/ddl/53249` torna vuoto; i voti della seduta n. 262 (7/10/2020) risultano collegati ai soli ddl 53220/53221 (Rendiconto/Assestamento bilancio).

# Le sedute esistono, i voti no

```sparql
SELECT ?seduta ?data (COUNT(?v) as ?nvoti) WHERE {
  ?seduta a <http://dati.senato.it/osr/SedutaAssemblea> ;
          <http://dati.senato.it/osr/dataSeduta> ?data ;
          <http://dati.senato.it/osr/legislatura> 18 .
  FILTER(STR(?data) >= "2020-02-01" && STR(?data) <= "2020-05-31")
  OPTIONAL { ?v a <http://dati.senato.it/osr/Votazione> ; <http://dati.senato.it/osr/seduta> ?seduta }
} GROUP BY ?seduta ?data ORDER BY ?data
```

Risultato (conteggio voti per seduta, estratto): 2020-03-04 → 70 voti (normale); poi **zero** dal 2020-03-10 al 2020-04-16 incluso (10 sedute d'Assemblea consecutive, tra cui la fiducia Cura Italia del 9/4); ripresa parziale il 2020-04-21 (1 voto) e il 2020-04-30 (11 voti); torna a livelli normali dal 2020-05-06 (21 voti).

Le sedute in questa finestra non sono vuote di per sé: contengono regolarmente `osr:Intervento` (i discorsi in Aula ci sono), manca solo la classe `osr:Votazione`.

# Oltre la finestra di marzo-aprile: Rilancio (luglio) e Agosto (ottobre)

Verifiche del 2026-07-08 hanno esteso il buco oltre mar-apr 2020, su due decreti COVID altrettanto noti.

## Decreto Rilancio (d.l. 34/2020) — fiducia del 16/7/2020 totalmente assente

Le votazioni Senato di luglio 2020 ci sono (57 nel mese), ma **nessuna** riguarda il Rilancio. Conteggio per mese 2020 via `senato-votes list --legislature 18 --date-from/--date-to --count-only`:

```
2020-03: 70   2020-04: 12   2020-05: 32   2020-06: 63
2020-07: 57   2020-08: 21   2020-09: 36   2020-10: 196
```

Tra i 57 voti di luglio, zero occorrenze di "fiducia"/"rilancio"/"decreto"/"34" nel label: sono tutte mozioni (Autostrade, glifosato, occupazione) e comunicazioni del governo. Le sedute del 16-17 luglio (giorno della conversione in legge) non hanno `osr:Votazione`.

```sparql
SELECT ?v ?date ?label WHERE {
  ?v a <http://dati.senato.it/osr/Votazione> ;
     <http://dati.senato.it/osr/legislatura> 18 ;
     <http://dati.senato.it/osr/seduta> ?s .
  ?s <http://dati.senato.it/osr/dataSeduta> ?date .
  OPTIONAL { ?v <http://www.w3.org/2000/01/rdf-schema#label> ?label }
  FILTER(STR(?date) >= "2020-07-13" && STR(?date) <= "2020-07-17")
} ORDER BY ?date
```

→ 0 risultati per il 16-17 luglio. La fiducia Rilancio è noto da fonti terze (Il Sole 24 Ore, 8/7/2020: 318 sì alla Camera; conversione definitiva Senato 16/7/2020) ma **non è nel LOD Senato**.

## Decreto Agosto (d.l. 104/2020, S.1925) — voto finale esiste ma scollegato dal DDL

Il DDL `http://dati.senato.it/ddl/53249` esiste (`bill-progress --ddl-uri` restituisce stato "approvato" 2020-10-06), ma **nessuna `osr:Votazione` è collegata** ad esso:

```sparql
SELECT ?v ?date ?label WHERE {
  ?v a <http://dati.senato.it/osr/Votazione> ;
     <http://dati.senato.it/osr/oggetto> ?o .
  ?o <http://dati.senato.it/osr/relativoA> <http://dati.senato.it/ddl/53249> .
  OPTIONAL { ?v <http://dati.senato.it/osr/seduta> ?s . ?s <http://dati.senato.it/osr/dataSeduta> ?date }
  OPTIONAL { ?v <http://www.w3.org/2000/01/rdf-schema#label> ?label }
} LIMIT 20
```

→ 0 risultati. La seduta n. 262 del 7/10/2020 contiene votazioni (anche "Votazione finale" approvata 135-105-2), ma sono collegate ai soli ddl 53220/53221 (Rendiconto/Assestamento bilancio 2019/2020), non a S.1925. `senato-votes --ddl-uri http://dati.senato.it/ddl/53249` torna perciò vuoto: il filtro funziona, il link nel grafo no.

# Causa probabile

Durante il lockdown il Senato adottò per un periodo il voto per appello nominale a gruppi ridotti (procedura anti-assembramento), diversa dal voto elettronico ordinario. Il dataset leg.18 registra "nominale con appello" solo per 5 voti del 2022: la modalità di voto straordinaria di marzo-aprile 2020 non sembra essere stata digitalizzata in questo dataset.

# Non è l'unico pattern: buco "totale" vs "chirurgico"

Questa nota documenta il buco **"totale"** — sedute con **zero** `osr:Votazione`. Esiste anche un pattern **"chirurgico"** diverso: seduta piena di votazioni ma manca la **singola** votazione cercata (es. la fiducia sul Milleproroghe del **26/2/2020**, S.1729: 21 votazioni nella seduta, ma la fiducia non è nel LOD — e non è COVID, è pre-lockdown). Per distinguere i due (e il caso "nessuna seduta") senza conoscere in anticipo le date-buco, vedi il metodo dei tre stati in [vuoto-votazioni-diagnosi.md](vuoto-votazioni-diagnosi.md).

# Conseguenza per il tooling

Un vuoto da `senato-votes` in questa finestra **non significa "nessuna votazione avvenuta"** — le fonti terze (stampa, OpenParlamento) confermano che le sedute prevedevano voti regolari, incluse fiducie importanti (Cura Italia 9/4, Liquidità inizio aprile, Rilancio 16/7). Significa che questo specifico dataset LOD non li registra per il periodo, o non li collega al DDL (caso Decreto Agosto).

In particolare:
- `senato-votes --confidence-vote true` torna vuoto su **tutto il 2020** leg.18 — non perché il filtro sia rotto (su leg.19 trova regolarmente le fiducie), ma perché le fiducie Senato 2020 non sono nel LOD o non hanno "fiducia" nel label.
- `senato-votes --ddl-uri <DDL leg.18>` può tornare vuoto anche per DDL regolarmente approvati (es. S.1925) quando la votazione non è collegata al DDL via `osr:relativoA`.

Il filtro `--confidence-vote` funziona correttamente su leg.19 (verificato: trova fiducie Piano Casa 106/62/2 del 2026-07-01 e salario giusto 94/61/2 del 2026-06-24).

# Citations

[1] Conteggio voti per seduta d'Assemblea, legislatura 18, febbraio-maggio 2020, verificato 2026-07-08: zero `osr:Votazione` dal 2020-03-10 al 2020-04-16 incluso, su 10 sedute consecutive.

[2] Seduta `sedutaassemblea/22107` (2020-04-09, fiducia Cura Italia): esiste con `osr:dataSeduta`, zero `osr:Votazione` con `osr:seduta` verso quella seduta.

[3] Esito noto del voto di fiducia Cura Italia da fonte terza (Corriere della Sera, 2020-04-09): 142 sì, 99 no, 4 astenuti — non verificabile via SPARQL Senato per l'assenza del dato.

[4] Conteggio voti Senato leg.18 per mese 2020 via `senato-votes --count-only`, verificato 2026-07-08: luglio 2020 = 57 voti, ma nessuno con label contenente "fiducia"/"rilancio"/"decreto"/"34". Sedute 16-17 luglio 2020 senza `osr:Votazione`. Fiducia Decreto Rilancio (d.l. 34/2020, conversione 16/7/2020) assente dal LOD.

[5] Query `osr:relativoA <http://dati.senato.it/ddl/53249>` (Decreto Agosto, S.1925), verificata 2026-07-08: 0 votazioni collegate. Votazione finale del 7/10/2020 (seduta 262) esiste ma collegata ai soli ddl 53220/53221. `senato-votes --ddl-uri http://dati.senato.it/ddl/53249` torna vuoto.
