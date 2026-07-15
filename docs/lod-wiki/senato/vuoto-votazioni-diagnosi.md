---
type: Method
title: Interpretare un vuoto di senato-votes — i tre stati (sedute vs votazioni)
description: un risultato vuoto di senato-votes per data non è mai "non si è votato" senza verifica. Sondando due contatori sul grafo — sedute d'Assemblea (osr:SedutaAssemblea) e votazioni (osr:Votazione) nell'intervallo — si distinguono tre stati diversi con conclusioni opposte: nessuna seduta / seduta senza voti (buco della fonte "totale") / voti presenti ma target assente (buco "chirurgico"). Il metodo non richiede di sapere in anticipo dov'è il buco. È ciò che l'emptyHint dinamico di senato-votes sonda al volo.
resource: https://dati.senato.it/sparql
tags: [senato, osr, votazioni, freschezza, assenti, diagnostica, method]
timestamp: 2026-07-15
---

Un risultato vuoto di `senato-votes` filtrato per data (o per fiducia/keyword in una finestra temporale) **non è mai** di per sé la prova che non si sia votato: nel LOD Senato i buchi hanno forme diverse, e alcune sono indistinguibili dal comportamento atteso finché non si osserva il grafo. Il rischio è massimo per un LLM/agente, che di fronte al vuoto può confabulare un esito.

Il metodo qui sotto **osserva** invece di **ricordare**: non serve un elenco di date-buco note (fragile, incompleto), basta contare due cose sull'intervallo interrogato.

# I due contatori della sonda

Le sedute d'Assemblea sono modellate come `osr:SedutaAssemblea` con `osr:legislatura` e `osr:dataSeduta` (xsd:date) **diretti** — quindi interrogabili **indipendentemente** dalle votazioni. Le votazioni (`osr:Votazione`) puntano alla seduta via `osr:seduta`.

```sparql
# Contatore 1 — sedute d'Assemblea nell'intervallo
SELECT (COUNT(DISTINCT ?s) AS ?sedute) WHERE {
  ?s a <http://dati.senato.it/osr/SedutaAssemblea> ;
     <http://dati.senato.it/osr/legislatura> 18 ;
     <http://dati.senato.it/osr/dataSeduta> ?d .
  FILTER(?d >= "2020-02-26"^^<http://www.w3.org/2001/XMLSchema#date> &&
         ?d <= "2020-02-26"^^<http://www.w3.org/2001/XMLSchema#date>)
}

# Contatore 2 — votazioni collegate a quelle sedute nello stesso intervallo
SELECT (COUNT(DISTINCT ?v) AS ?votazioni) WHERE {
  ?v a <http://dati.senato.it/osr/Votazione> ;
     <http://dati.senato.it/osr/legislatura> 18 ;
     <http://dati.senato.it/osr/seduta> ?s .
  ?s <http://dati.senato.it/osr/dataSeduta> ?d .
  FILTER(?d >= "2020-02-26"^^<http://www.w3.org/2001/XMLSchema#date> &&
         ?d <= "2020-02-26"^^<http://www.w3.org/2001/XMLSchema#date>)
}
```

Il range filter su `?d` è anche la forma performante su Virtuoso Senato (meglio di `STRSTARTS`).

# I tre stati

| Sedute | Votazioni | Interpretazione | Conclusione |
|---|---|---|---|
| `0` | `0` | Nessuna seduta d'Assemblea nell'intervallo | Probabilmente non si è votato in Aula (o le sedute non sono ancora caricate). Verifica le date. |
| `>0` | `0` | Le sedute esistono ma **nessuna** votazione è collegata | **Buco della fonte "totale"** — le votazioni non sono nel LOD. Un vuoto qui NON significa che non si sia votato. Vedi [votazioni-covid-2020.md](votazioni-covid-2020.md). |
| `>0` | `>0` | Ci sono votazioni, ma nessuna che matcha i filtri (fiducia/keyword) | **Dato pieno** → è il filtro. Oppure **buco "chirurgico"**: la singola votazione cercata (es. una fiducia) manca pur essendoci le altre della seduta. |

Il punto chiave: gli stati si distinguono **senza sapere in anticipo** quale data cade in quale buco. La sonda lo rileva per costruzione, quindi vale anche per date future non ancora note.

# Esempio di buco "totale" — 9 aprile 2020 (Cura Italia)

`sedute=1, votazioni=0`. La seduta del 9/4/2020 esiste (con `osr:Intervento`) ma non ha alcuna `osr:Votazione`, inclusa la fiducia sul Cura Italia. È il pattern documentato per l'intera finestra 10/3–16/4/2020 in [votazioni-covid-2020.md](votazioni-covid-2020.md).

# Esempio di buco "chirurgico" — 26 febbraio 2020 (Milleproroghe)

`sedute=1, votazioni=21`. Questo è un pattern **diverso** dal buco COVID e **non è COVID** (è pre-lockdown). La fiducia sul Milleproroghe (S.1729, votata 154 sì / 96 no da fonti terze) **non è nel LOD**, ma la stessa seduta contiene regolarmente **21 altre votazioni** (`--confidence-vote true` torna vuoto perché nessuna ha "fiducia" nel `rdfs:label`; senza filtro le 21 votazioni ci sono).

Verifica:

```
senato-votes list --legislature 18 --date-from 2020-02-26 --date-to 2020-02-26 --confidence-vote true   # vuoto
senato-votes list --legislature 18 --date-from 2020-02-26 --date-to 2020-02-26                            # 21 righe
```

Conseguenza: qui la mancanza è di **una singola votazione** (la fiducia), non dell'intera seduta di voti. Il buco COVID (seduta con zero voti) e il buco chirurgico (seduta piena ma manca il target) hanno cause probabilmente diverse e vanno segnalati distintamente ai gestori.

# Dove è implementato

L'`emptyHint` di `senato-votes` (`src/tools/senato-votes.ts`) esegue questa sonda **al volo, solo sui risultati vuoti con vincolo di data** (2 COUNT leggeri, gate su `offset===0` per non affermare il falso oltre l'ultima pagina) e restituisce l'hint corrispondente allo stato osservato, invece di ripetere un elenco statico di buchi noti. È la funzione pura `buildSenatoVotesEmptyHint` + `probeSenatoDates`.

# Citations

[1] `osr:SedutaAssemblea` con `osr:legislatura` + `osr:dataSeduta` diretti (interrogabili senza votazioni), verificato 2026-07-15 su `sedutaassemblea` del 26/2/2020 (numeroSeduta 196, legislatura 18).

[2] Sonda a tre stati, verificata 2026-07-15 su 5 contesti: 26/2/2020 (sedute=1, votazioni=21, fiducie=0); 9/4/2020 (1, 0, 0); range 10/3–16/4/2020 (9, 0); 15/8/2020 ferragosto (0, 0, 0); 12/3/2024 leg.19 (1, 42) e 23/7/2025 leg.19 (1, 4, fiducie=1, controllo positivo del conteggio fiducia).

[3] Buco "chirurgico" 26/2/2020: `senato-votes --confidence-vote true` vuoto, ma 21 votazioni nella stessa seduta senza filtro. Fiducia Milleproroghe (S.1729) 154 sì / 96 no nota da fonte terza (la Repubblica, 26/2/2020), non presente nel LOD.
