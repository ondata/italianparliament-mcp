---
type: Reference
title: Iter di un atto Camera — timeline degli stati (ocd:rif_statoIter)
description: La cronologia dell'iter di un atto Camera è una timeline di stati collegati con ocd:rif_statoIter (uno per fase, con dc:date e dc:title). Copertura verificata alla pari tra legislature (18 e 19). Il ramo Senato dello stesso tool restituisce per design solo lo stato corrente, non una timeline — asimmetria di ramo, non di legislatura. Trappola: la timeline di un atto tornato dalla navetta NON contiene la lettura successiva, che vive su un atto variante distinto con suffisso (-B, -C…), e l'ultimo stato dell'atto base sembra definitivo senza esserlo.
resource: https://dati.camera.it/sparql
tags: [camera, ocd, iter, statoIter, fasi, timeline, bill-progress, legislatura, navetta, atto-variante]
timestamp: 2026-08-06
---

L'iter legislativo di un atto Camera è modellato come una **timeline di stati**: l'atto è collegato a più risorse-stato via `ocd:rif_statoIter`, ciascuna con la sua data (`dc:date`, stringa `AAAAMMGG`) e la sua etichetta (`dc:title`, es. "Assegnato", "In discussione"). Non è un singolo campo "stato corrente": è la sequenza completa delle fasi attraversate.

# Query canonica

```sparql
PREFIX ocd: <http://dati.camera.it/ocd/>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
SELECT DISTINCT ?date ?stato WHERE {
  <http://dati.camera.it/ocd/attocamera.rdf/ac18_2463> ocd:rif_statoIter ?st .
  ?st dc:date ?date ; dc:title ?stato .
}
ORDER BY ?date
```

Nessun filtro sugli stati: si prendono tutti quelli presenti a monte. Le fasi tipiche: `Da assegnare · Assegnato · In corso di esame in Commissione · Concluso l'esame da parte della Commissione. In stato di relazione · In discussione · Approvato definitivamente. Legge · Approvato definitivamente, non ancora pubblicato`. Gli stati arrivano spesso **in coppia sulla stessa data** (es. "Da assegnare" + "Assegnato"; i due stati di "Approvato definitivamente"), per cui il conteggio grezzo tende a essere pari.

# La copertura è alla pari tra legislature (18 = 19)

Verificato che il dato a monte contiene la timeline multi-fase **anche per la legislatura 18**, senza riduzione di granularità rispetto alla 19. Non è quindi necessario alcun accorgimento nel tool per le legislature storiche: la query recupera tutte le fasi disponibili.

* Cura Italia (`ac18_2463`, leg. 18, DL 18/2020) → **7 stati**, inclusi "Assegnato", "In corso di esame in Commissione", "In discussione", "Approvato definitivamente. Legge".
* Distribuzione su un campione di 300 atti per legislatura: profili quasi sovrapponibili (la maggior parte a 2/4 stati, code lunghe fino a 26 stati per la leg. 18 e 22 per la leg. 19). La leg. 18 non è più povera della 19.

# Asimmetria di ramo (non di legislatura): il Senato via SPARQL dà solo lo stato corrente

Lo stesso tool `bill-progress` ha due rami con granularità diversa **per costruzione**, indipendente dalla legislatura:

* **Camera**: timeline completa via `ocd:rif_statoIter` (una riga per stato), raggiungibile in due modi — con `--uri <atto>` o con `--number <n> --branch C` (che risolve `ac<leg>_<n>`).
* **Senato** (`--branch S`, default): l'entità `osr:Ddl` in SPARQL espone solo lo **stato corrente** (`osr:statoDdl` + `osr:dataStatoDdl`, `osr:fase`/`osr:numeroFase`), **una sola riga**, non una cronologia. La timeline dettagliata delle fasi del DDL Senato (con sedute ed esiti) vive nel **feed RSS** del DDL, non nello SPARQL — il tool la espone come `rss_url`. Vedi [Feed RSS dei DDL Senato](../senato/index.md).

Attenzione al `--branch` con `--number`: `--branch C` dà la **timeline** dell'atto Camera (molte righe), `--branch S` dà lo **stato corrente** del DDL Senato (una riga). Prima `--branch C` restituiva il record Senato di rimando (`osr:ramo="C"`, una riga senza date), fuorviante per chi si aspettava l'iter Camera (issue #41).

Conseguenza pratica: un DDL Senato che "sembra meno dettagliato" di un atto Camera non è un buco della legislatura, ma questa differenza di modellazione tra i due grafi. Confrontare timeline con timeline (RSS lato Senato) o stato-corrente con stato-corrente.

# Trappola: la navetta prosegue su un atto DIVERSO (suffisso `-B`), e la timeline dell'atto base non lo dice

Quando un testo torna dall'altro ramo modificato, la lettura successiva **non** si aggiunge alla timeline dell'atto di partenza: riceve un'entità `ocd:atto` separata, con URI e `dc:identifier` suffissati (`ac19_703` → `ac19_703-B`, poi `-C`, `-D`…). I due atti hanno `rif_statoIter` propri e non sono collegati da alcun triple diretto: nessuna proprietà dell'atto base rimanda alla sua variante.

L'effetto è una **timeline che sembra conclusa e non lo è**. La legge quadro sugli interporti: `ac19_703` si chiude con `Approvato, segue Navette` il **20240228**, mentre l'approvazione definitiva (Legge 177/2025) è il **20251113** e sta su `ac19_703-B`. Chi legge solo l'atto base conclude che il provvedimento è fermo da anni.

Non essendoci il link nel grafo, la variante si trova **costruendo gli URI candidati** e sondandoli — `VALUES` su `ac<leg>_<n>-B` … `-F`, misurato ~0,5 s. Un `REGEX` su `dc:identifier` è invece un full scan, da evitare:

```sparql
PREFIX ocd: <http://dati.camera.it/ocd/>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
SELECT ?a ?id ?date ?stato WHERE {
  VALUES ?a { <http://dati.camera.it/ocd/attocamera.rdf/ac19_703-B>
              <http://dati.camera.it/ocd/attocamera.rdf/ac19_703-C> }
  ?a dc:identifier ?id ; ocd:rif_statoIter ?st .
  ?st dc:date ?date ; dc:title ?stato .
}
ORDER BY ?id ?date
```

**Non tutti i suffissi sono letture successive.** Censimento dei `dc:identifier` con suffisso su tutte le legislature: `-A` **4.558** atti, `-B` 1.807, `-bis` 361, `-ter` 250, `-C` 162, `-A-bis` 127, `-D` 106, poi code lunghe (`bis-B`, `ter-B`, `quater-B`…). `-A` è il **testo della commissione**, non una lettura di navetta: scambiarlo per tale significa indicare una bozza di commissione al posto dell'approvazione definitiva. Le letture successive sono `-B`, `-C`, `-D`, `-E`, `-F` (ed esistono composte, `1059-bis-B`).

Conseguenza per chi scrive codice: un pattern `ac(\d+)_(\d+)$` sugli URI d'atto **perde per intero** ogni atto variante. La scheda HTML invece li serve regolarmente, con l'identificativo completo: `https://www.camera.it/leg19/126?leg=19&idDocumento=703-B` risponde e dichiara «Atto Camera: 703-B».

Lato Senato la stessa navetta si vede diversamente: le fasi dello stesso DDL condividono `osr:idDdl` e il repertorio contiene anche le fasi Camera (`osr:ramo="C"`), quindi lì l'iter completo si ricostruisce senza costruire URI. È solo il grafo Camera a spezzare l'atto in risorse separate.

# Citations

[2] Verifica 2026-08-06 su `dati.camera.it/sparql`: `ac19_703` → ultimo stato `Approvato, segue Navette` (20240228); `ac19_703-B` → `Approvato definitivamente. Legge` (20251113), `dc:identifier` = "703-B", nessun triple che colleghi i due atti. Censimento dei suffissi via `GROUP BY` su `dc:identifier` filtrato `REGEX(^[0-9]+-)`: `-A` 4.558, `-B` 1.807, `-C` 162, `-D` 106. Scheda `idDocumento=703-B` verificata su www.camera.it (dichiara «Atto Camera: 703-B»). Emerso dalla gap analysis news-driven del 2026-08-06 (storia della legge quadro sugli interporti).

[1] Verifica 2026-07-07 su `dati.camera.it/sparql`: `ac18_2463` (Cura Italia) → 7 stati `rif_statoIter`; `ac19_2822` (legge elettorale) → 5 stati (iter ancora in corso). Distribuzione del conteggio stati su `GROUP BY ?a LIMIT 300` per `ocd:atto` con `rif_leg` = repubblica_18 e repubblica_19: profili quasi identici, coda a 26 (leg. 18) vs 22 (leg. 19). Emerso dalla gap analysis news-driven del 2026-07-07 (chiarimento del dubbio "granularità iter ridotta leg. 18").
