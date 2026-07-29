---
type: Schema Absence
title: Voto per alzata di mano — non esiste come osr:Votazione (e non è un buco della fonte)
description: al Senato l'Assemblea vota NORMALMENTE per alzata di mano (art. 113 c.2 Reg.); il voto elettronico è l'eccezione su richiesta. Il LOD — come le pagine "Votazione" di senato.it — enumera SOLO le votazioni elettroniche. Un voto assente da senato-votes può quindi essere avvenuto regolarmente per alzata di mano: non un buco del dato, ma una modalità che non produce numeri da pubblicare. L'evento resta leggibile dall'iter (bill-progress), che ne registra data ed esito.
resource: http://dati.senato.it/osr/Votazione
tags: [senato, osr, votazione, tipoVotazione, alzata-di-mano, assenti, regolamento, diagnostica]
timestamp: 2026-07-29
---

# La regola

Al Senato **l'alzata di mano è la modalità ordinaria**, non l'eccezione. Art. 113 comma 2 del Regolamento: «L'Assemblea vota normalmente per alzata di mano, a meno che quindici Senatori chiedano la votazione nominale e [...] venti chiedano quella a scrutinio segreto».

Una votazione per alzata di mano **non produce conteggi**: il Presidente proclama l'esito («È approvato», «Il Senato approva») senza numeri, e non esiste un elenco di chi ha votato come. Non c'è quindi alcun dato da pubblicare, e infatti non viene creata alcuna `osr:Votazione`.

Lo dichiara la fonte stessa, in testa alle pagine "Votazione" delle schede DDL su senato.it:

> L'Assemblea del Senato «vota normalmente per alzata di mano». È quanto detta l'articolo 113 (secondo comma) del Regolamento del Senato. **Come specificato nel titolo, le votazioni elencate in questa pagina sono quelle avvenute mediante il dispositivo elettronico.**

Il LOD eredita questo perimetro: le `osr:Votazione` sono le votazioni **elettroniche** (più le poche nominali con appello e segrete), non tutte le deliberazioni dell'Aula. Coerentemente, l'enumerazione di `osr:tipoVotazione` su leg. 19 non contiene alcun valore "alzata di mano" (cfr. [[votazione-tipo-semantico]]).

# Conseguenza diagnostica

L'assenza di una votazione da `senato-votes` ha **quattro** spiegazioni possibili, non tre: alle tre di [[vuoto-votazioni-diagnosi]] (nessuna seduta / buco "totale" / buco "chirurgico") va aggiunta questa, che **non è un buco**. Prima di segnalare un dato mancante ai gestori, va escluso che il voto sia semplicemente avvenuto per alzata di mano.

Il discrimine pratico: se il voto cercato è un **voto finale su DDL costituzionale, elettorale, a prevalente contenuto di delega, di bilancio o di conversione di decreti in materia di ordine pubblico**, allora l'art. 120 comma 3 impone lo scrutinio elettronico e la sua assenza è anomala. Fuori da quell'elenco — inclusa la **generalità delle conversioni di decreto-legge** — l'alzata di mano è del tutto legittima e l'assenza è attesa.

# Prove

## Caso A — stessa seduta, entrambe le modalità (24/07/2025, seduta 333)

Il caso più pulito, perché elimina la variabile "seduta non caricata": nella stessa seduta convivono voti presenti e voti assenti, e a distinguerli è solo la modalità.

Dal resoconto stenografico, sul DDL 1566 (rendiconto): «Metto ai voti l'articolo 1. **È approvato**» — e così per gli articoli da 1 a 7, tutti per alzata di mano. Le due votazioni **finali** sui DDL 1566 e 1567 sono invece qualificate ex art. 120 c.3 e avvengono con scrutinio elettronico.

```
senato-votes list --legislature 19 --date-from 2025-07-24 --date-to 2025-07-24
```

Restituisce **3 righe, tutte `Votazione finale`** (DDL 1547, 1566, 1567). I 7 voti sugli articoli del 1566 — avvenuti, verbalizzati, approvati — **non ci sono**. Stesso DDL, stessa seduta, stesso giorno: presente il voto elettronico, assenti quelli per alzata di mano.

## Caso B — decreto flussi, approvazione definitiva (26/11/2025)

`senato-votes --ddl-uri` è vuoto per il DDL 1714 (conversione del DL 146/2025) su ogni URI provato, mentre la stessa giornata contiene 4 votazioni regolari sul DDL 1519 (`Votazione finale`, un emendamento, `Verifica del numero legale`, `Controprova`). Sonda dei due contatori: sedute > 0, votazioni > 0 → terzo stato, che il caso A qualifica ora come modalità e non come buco.

Da notare la presenza di una `Controprova` fra i voti del 1519: la controprova è proprio ciò che si fa **quando l'esito di un'alzata di mano è contestato** — traccia indiretta, nel dato, di voti per alzata di mano che il dato non registra.

# Dove il dato c'è comunque

L'**evento** resta verificabile: l'iter del DDL registra esito e data anche quando il voto non è numerato.

```
bill-progress list --ddl-uri http://dati.senato.it/ddl/59715
```

→ `status: "appr. definit. Legge"`, `status_date: "2025-11-26"`.

Regola operativa per l'orchestratore/LLM: se `senato-votes` è vuoto ma il provvedimento risulta approvato, **la domanda giusta cambia**. «Con quali numeri è passato?» non ha risposta — i numeri non esistono, e vanno cercati nel resoconto stenografico solo per sapere se c'è stato dibattito, non per un conteggio. «Quando e con quale esito è stato approvato?» ha risposta piena via `bill-progress`. **NON** dedurre né inventare un conteggio.

# Cosa vale la pena chiedere ai gestori

Non i numeri: per un'alzata di mano non esistono e nessuno può pubblicarli. Il punto segnalabile è più sottile: oggi, nel LOD, una deliberazione per alzata di mano è **indistinguibile da una deliberazione mai avvenuta**. Modellare l'evento (data, oggetto, esito proclamato) anche senza conteggi renderebbe distinguibili i due casi, che per un riuso automatico sono opposti. È materiale da proporre come domanda, non come segnalazione di bug — la fonte qui si comporta esattamente come dichiara.

# Rapporto con le votazioni COVID 2020

[[votazioni-covid-2020]] documenta sedute (10/3–16/4/2020) con `osr:Intervento` e **zero** `osr:Votazione`, ipotizzando un «voto per appello nominale a gruppi mai digitalizzato». Questa pagina **non** risolve quel caso e non va usata per archiviarlo: la fiducia sul Cura Italia è una fiducia, e le fiducie al Senato si votano per appello nominale, non per alzata di mano. Le due assenze restano distinte finché non verificate separatamente.

# Citations

[1] Art. 113 c.2 e art. 120 c.3 del Regolamento del Senato (testo su senato.it), consultati 2026-07-29.
[2] Disclaimer sulle pagine "Votazione" delle schede DDL di senato.it: «le votazioni elencate in questa pagina sono quelle avvenute mediante il dispositivo elettronico».
[3] Caso A, verificato 2026-07-29: resoconto stenografico seduta 333 del 24/07/2025 (DDL 1566, articoli 1-7 «Metto ai voti [...] È approvato»; votazioni finali 1566/1567 ex art. 120 c.3 con scrutinio elettronico) vs `senato-votes` 24/07/2025 → 3 sole righe, tutte `Votazione finale`.
[4] Caso B, verificato 2026-07-29: `senato-votes` 26/11/2025 → 4 votazioni, tutte su DDL 1519; nessuna sul DDL 1714. `bill-progress --ddl-uri http://dati.senato.it/ddl/59715` → `appr. definit. Legge`, 2025-11-26. Approvazione definitiva del decreto flussi riportata da ANSA il 26/11/2025.
[5] Gap analysis news-driven `docs/news-agent/2026-07-29_11-09.md` (gap #2), che ha sollevato il caso B.
