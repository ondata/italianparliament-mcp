---
type: Reference
title: Convocazioni delle commissioni — agenda prospettica (mobile.camera.it)
description: Le convocazioni delle commissioni permanenti espongono l'ordine del giorno FUTURO delle sedute (data, ora, argomenti con codice atto e relatore, audizioni con auditi, previsione di voto). È un dato prospettico assente dal LOD, che è tutto consuntivo. Fonte HTML pulita, curl-friendly.
resource: https://mobile.camera.it/convocazioni-commissioni-permanenti
tags: [camera, non-lod, convocazioni, commissioni, agenda, odg, audizioni, mobile]
timestamp: 2026-07-12
---

Le **convocazioni delle commissioni permanenti** pubblicano l'**ordine del giorno prospettico** dei lavori: cosa farà ogni commissione nei giorni a venire. È un dato **forward-looking assente dal LOD**, che espone solo il consuntivo (`ocd:seduta` passate, `ocd:discussione`, Bollettino). Copre quindi un vuoto reale e ad alto interesse giornalistico: *"cosa c'è all'ordine del giorno questa settimana", "quando si vota su X", "chi viene audito domani"*. Nessun tool attuale lo deriva.

# Endpoint

- **Indice**: `https://mobile.camera.it/convocazioni-commissioni-permanenti` → le 14 commissioni permanenti, ciascuna con link alla propria convocazione.
- **Convocazione di una commissione**: `…/convocazioni-commissioni-permanenti/convocazioni?shadow_organo_parlamentare={ID}&idlegislatura=19`.
- **Filtro temporale**: la pagina ha un selettore "Cerca per data" (mese/anno + giorno) per navigare lo storico e il futuro.

`ID` è l'identificatore d'organo di `mobile.camera.it` (**diverso** dagli `idCommissione` del Bollettino): mappatura parziale verificata — 3501 = I (Affari costituzionali), 3505 = V (Bilancio), 3507 = VII (Cultura), 3508 = VIII (Ambiente), 3512 = XII (Affari sociali). L'indice va letto per ottenere tutti gli ID in modo affidabile, non costruiti a mano.

Fonti sorelle nello stesso portale: *"Convocazioni Commissioni Bicamerali e d'inchiesta"* e *"Oggi in Commissione"*.

# Struttura del dato

HTML server-rendered, **curl-friendly** (nessun WAF/anti-bot come `documenti.camera.it`; da confermare se passa anche da IP datacenter/Worker). Per ogni giorno con sedute, l'OdG è semi-strutturato:

- **data** (es. "Martedì 14 luglio 2026") e **ora** di inizio (`Ore 13`, `Ore 13.30`);
- **tipo di seduta**: Audizioni, Comitato dei Nove, Comitato permanente per i pareri, Ufficio di presidenza, Esame di schemi di intesa, ecc.;
- **argomenti** con **codice atto** (`C. 2822`, `Doc. CCXLVII`) e **relatore** (`Rel. …` / `Rell. …`);
- **audizioni** con il nome degli **auditi** (es. Ministri Musumeci e Schillaci);
- **previsione di voto** esplicita: `(Sono previste votazioni)` / `(Non sono previste votazioni)`;
- sede quando diversa (es. commissioni riunite, Aula convegni del Senato).

Codici atto (`C. NNNN`), relatori (`Rel\.?\s`) e orari (`Ore \d`) sono estraibili con regex; il resto dell'OdG è testo narrativo.

# Esempio verificato (2026-07-12)

I Commissione, `shadow_organo_parlamentare=3501`, settimana 13–16 luglio 2026. Tra le voci, l'agenda dell'esame emendamenti del ddl legge elettorale / voto fuorisede (caso reale seguito nel progetto):

> Ore 13.30 — COMITATO DEI NOVE — *Disposizioni in materia di elezioni della Camera dei deputati e del Senato della Repubblica* (esame emendamenti **C. 2822 - 157 - 2236-A** – Rell. Alessandro Colucci, Iezzi, Pagano, Angelo Rossi)

Conferma il legame atto portante ↔ abbinati già emerso dagli emendamenti ([assenti.md](assenti.md)): 2236 confluito nel testo unificato 2822.

# Valutazione — candidata a tool nuovo

A differenza delle votazioni (ridondanti col LOD) e in linea con gli emendamenti, qui il dato è **genuinamente assente e non derivabile**: un tool nuovo è giustificato (es. `committee-agenda` / `convocazioni`, per organo e per data). Per rapporto valore/costo è **davanti al Bollettino**: parsing più semplice del resoconto narrativo e dato prospettico che nessun'altra fonte del progetto copre. Complementare al Bollettino (consuntivo) e all'iter LOD (stato corrente/passato).
