---
type: Reference
title: getDocumento.ashx — router delle fonti non-LOD della Camera
description: Il servizio CommonServices/getDocumento.ashx è un router unico che, cambiando i parametri sezione/tipoDoc, serve testi dei ddl, schede-attività dei deputati e i Bollettini delle Giunte e Commissioni. Mappa delle facce verificate, cosa coprono rispetto al LOD OCD e priorità di integrazione. Fonti HTML/PDF, non dato strutturato.
resource: https://documenti.camera.it/apps/commonServices/getDocumento.ashx
tags: [camera, non-lod, getDocumento, bollettini, scheda-attivita, emendamenti, scraping]
timestamp: 2026-07-12
---

Diverse funzioni della Camera **non sono nel LOD OCD** ma sono pubblicate da applicazioni HTML/PDF su `documenti.camera.it`. Il punto d'ingresso ricorrente è `https://documenti.camera.it/apps/commonServices/getDocumento.ashx`: un **router unico** che, a seconda di `sezione` e `tipoDoc`, restituisce (o redirige a `302`) documenti di natura diversa. Questa pagina mappa le facce verificate. Tutte servono HTML renderizzato lato server o PDF: nessuna è un endpoint dati: per estrarne dato strutturato serve scraping. Per gli emendamenti — che non passano da `getDocumento.ashx` ma dall'app gemella `apps/emendamenti/` — vedi [Assenti / emendamenti](assenti.md).

Nota trasversale: il **casing dei parametri non è uniforme** tra le facce (`idLegislatura` nei ddl e nei bollettini, ma `idlegislatura`/`idpersona`/`tipopersona` minuscoli nella scheda-attività). Copiare i parametri dalla faccia giusta, non normalizzarli a mano.

# Faccia 1 — Testo dei progetti di legge (`sezione=lavori&tipoDoc=pdl`)

`getDocumento.ashx?sezione=lavori&tipoDoc=pdl&idLegislatura=19&idDocumento={N}` → **PDF del testo del ddl** (risponde `302` verso il file). Con `&old=old` la versione precedente/storica della scheda. È il pulsante "Scheda" / "Vecchia Scheda" nell'indice dell'app emendamenti. Coperto in parte dal tool `bill-text` (Camera); qui è la fonte PDF diretta.

Variante `tipoDoc=testo_pdl&codice=...`: è il link che il LOD pubblica per ogni versione del testo (`ocd:rif_versioneTestoAtto` → `dcterms:isReferencedBy`), esposto da `bill-text` come righe `kind=versione` (2026-11-04). Redirige a una pagina **HTML** (non PDF) con la relazione sotto l'ancora `#RL` e l'articolato sotto `#PD`; dalla leg. 18 anche un'ancora per articolo (`#art.N`), nelle leg. 16-17 no. Copertura nel LOD: atti con almeno una versione 4.850 in leg. 17 e 3.693 in leg. 18, presenti in leg. 16, nessuno in leg. 14-15. Il testo della commissione (`_A`) sta sull'atto di partenza, la lettura successiva della navetta (`-B`) sull'atto variante.

# Faccia 2 — Scheda-attività di un deputato (`sezione=deputati&tipoDoc=schedaAttivita`)

`getDocumento.ashx?sezione=deputati&tipoDoc=schedaAttivita&idlegislatura=19&idpersona={N}&tipoAttivita={T}&tipoVisAtt=1&tipopersona=C` → rende la scheda-attività su `www.camera.it/leg19/1431` (HTML). È l'**aggregato ufficiale dell'attività di un parlamentare**, diviso in 7 "tab" (`tipoAttivita`):

- `PDL` — progetti di legge del deputato → **già coperto** dal LOD (`member-bills`, `bill-signatories`).
- `attivitalegislativaassemblea` — interventi legislativi in Aula → coperto da `speeches`.
- `attivitalegislativacommissione` — interventi su ddl **in Commissione, per sede (referente/consultiva)** → **coperto male** dal LOD: è la granularità genuinamente utile.
- `attivitanonlegislativaassemblea` — mozioni/interpellanze/interrogazioni in Aula → coperto da `aic`, `sindacato-ispettivo`.
- `attivitanonlegislativacommissione` — idem in Commissione → parziale.
- `DOCII`, `DOCXXII` — documenti (Doc. II, Doc. XXII: relazioni di commissioni d'inchiesta) → **non coperto**.

Valutazione: ~70% è ridondante con dati LOD già esposti in modo più pulito e queryabile. Il valore nuovo è ristretto agli **interventi in commissione per sede** e ai **Doc. II/XXII**. Utile fin da subito come **fonte di verifica/completezza** (colpo d'occhio ufficiale su tutta l'attività di un `idpersona`), non prioritaria come nuova fonte-tool.

# Faccia 3 — Bollettino delle Giunte e Commissioni (`sezione=bollettini`)

Il resoconto ufficiale dei lavori di commissione, per giorno. Tre livelli:

- `tipoDoc=indiceGenerale&anno=&mese=&giorno=` → **indice del giorno**: elenco delle commissioni attive (link con `idCommissione=NN`).
- `tipoDoc=indice&…&idCommissione=NN` → **sommario per commissione**: il livello **semi-strutturato**. Ogni voce ha tipo di esame (es. art. 96-bis), titolo del provvedimento con codice atto (`C. 2947`), tipo (`Governo, approvato dal Senato`), sede/parere (`Parere alla Commissione I`) ed **esito** (`Esame e conclusione – Parere con raccomandazione`).
- `tipoDoc=pdf&…&file=leg.19.bol{NNNN}.data{YYYYMMDD}.indiceGenerale` → il **PDF** del bollettino. Il numero di bollettino (`bol0690`, "Bollettino numero 695") è lo stesso che compare sugli emendamenti e nell'iter: è il **ponte** tra atto/emendamento e resoconto.

È la fonte più ricca del set: tocca **quattro gap** in un colpo — **audizioni** in commissione (oggetto e auditi), **pareri in sede consultiva con esito** (assenti dal LOD), esami in referente con esito, emendamenti votati in commissione.

Due limiti che ne fanno un progetto a sé:

1. **Indicizzato per DATA**, non per atto né per deputato: per l'attività su un dato ddl servono prima le sue date-seduta (ricavabili da `ocd:rif_statoIter` e dagli emendamenti, che riportano il numero di bollettino).
2. **Resoconto narrativo** (HTML/PDF): solo il SOMMARIO è parsabile con affidabilità; il corpo è testo libero.

# Priorità di integrazione

Ordine consigliato, per rapporto valore/costo (dato realmente assente vs già coperto dal LOD, e costo di scraping):

1. **Esito degli emendamenti** — app `apps/emendamenti/`, vista per-seduta `getProposteEmendativeSeduta.aspx` (+ cofirmatari e testo dal singolo emendamento). Dato assente, costo basso, alto valore. Vedi [Assenti / emendamenti](assenti.md).
2. **Interventi in commissione per sede** — Faccia 2 (`attivitalegislativacommissione`) o Faccia 3.
3. **Pareri consultivi e audizioni** — Faccia 3 (Bollettino). La più ricca, la più costosa.

# Advocacy

Il dato strutturato che genera queste pagine **esiste già a monte** (l'app emendamenti ha persino un Web Service SOAP `getEmendamenti` con output XML, ma dichiarato "utilizzabile solo localmente alla macchina server"). La richiesta giusta al Servizio Informatica della Camera è esporre queste funzioni come **dato aperto** (LOD o endpoint JSON/XML per-atto): colmerebbe l'asimmetria col Senato e ci eviterebbe lo scraping. Vedi [contatti gestori](../../note-gestori-lod/) e [freschezza e provenienza](../freschezza-e-autorevolezza.md).
