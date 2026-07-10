---
type: Mechanism
title: Bulk data Akoma Ntoso su GitHub — fonte complementare ufficiale, senza WAF
description: Il repo GitHub del Senato pubblica testi, emendamenti e resoconti in AKN XML per ogni Atto, aggiornati quotidianamente, con lo stesso ID dei ddl del LOD. Colma gap noti (emendamenti fermi al 2024, votazioni COVID 2020, testi dietro WAF).
resource: https://github.com/SenatoDellaRepubblica/AkomaNtosoBulkData
tags: [senato, akn, bulk-data, github, emendamenti, resoconti, waf]
timestamp: 2026-07-10
---

Il Senato pubblica su GitHub (`SenatoDellaRepubblica/AkomaNtosoBulkData`, licenza CC BY 4.0) i documenti legislativi in formato Akoma Ntoso, legislature 13–19, **aggiornati quotidianamente** (verificato: ultimo update 10/07/2026, stesso giorno della verifica).

# Struttura e chiave di join col LOD

```
Leg<NUM>/Atto<ID 8 cifre zero-padded>/
  ddlpres/   testo presentato          (*-ft.akn.xml)
  ddlcomm/   relazione di Commissione
  ddlmess/   messaggio all'altro ramo
  emend/     emendamenti d'Assemblea   (*-em.akn.xml)
  emendc/    emendamenti di Commissione
  resaula/   resoconti stenografici d'Aula (*-ra.akn.xml)
  sommcomm/  resoconti sommari di Commissione (*-rc.akn.xml)
```

L'`AttoID` è **lo stesso id dei ddl del LOD**: `Leg19/Atto00060233` ↔ `http://dati.senato.it/ddl/60233` (verificato: il README per-atto linka esplicitamente l'URI OpenData e la query SPARQL della fase). Join diretto da `ddl_uri`, nessuna tabella di conversione.

# Perché conta: niente WAF

I file si scaricano da `raw.githubusercontent.com` con un semplice `curl` — a differenza di `senato.it` (`show-doc`, `listasommcomm`, fascicoli PDF), che è dietro AWS WAF. È la via machine-to-machine ufficiale ai testi che finora richiedevano agent-browser.

# Gap noti che colma (verificati 2026-07-10)

- **Emendamenti fermi ad agosto 2024 nel LOD** ([[emendamenti-freschezza]]): `emend/` del Piano Casa (`Atto00060233`, DDL del 2026) contiene i file AKN degli emendamenti. Il bulk data è fresco dove `osr:Emendamento` è morto. Anche il **proponente** ([[emendamenti-firmatario]]) sta nei file `-em.akn.xml`, ora raggiungibili senza WAF.
- **Votazioni COVID 2020 assenti dal LOD** ([[votazioni-covid-2020]]): `Leg18/Atto00052873/resaula/01150035-ra.akn.xml` è il resoconto d'Aula del **9/4/2020** e contiene la proclamazione della fiducia sul Cura Italia con i contatori (presenti 246, votanti 245, …). Il dato però è **testo narrativo** dentro `<an:p>` ("Proclamo il risultato della votazione nominale…"), non campi strutturati: recuperabile con parsing, non con query.
- **Testi DDL dietro WAF**: `ddlpres/` dà il testo presentato in XML senza passare dal fascicolo PDF del sito.

# Costruire gli URL senza API GitHub (verificato 2026-07-10)

Il **path della cartella** è interamente deducibile: `Leg<leg>/Atto<id ddl zero-padded a 8 cifre>/<tipologia>/` (es. `ddl/60233`, leg. 19 → `Leg19/Atto00060233/emend/`). Il **nome file** usa l'ID_TESTO della BGT, che non è calcolabile a priori — ma ci sono due vie che evitano l'API REST:

1. **Emendamenti presenti nel LOD**: il filename è l'ultimo segmento di `osr:URLTestoXml`. Verificato: emendamento `900011` (ddl/53429, leg. 18) ha `URLTestoXml = senato.it/leg/18/BGT/Testi/Emend/01186716/01181876.akn` e il bulk contiene `Leg18/Atto00053429/emend/01181876-em.akn.xml`. Quindi l'URL WAF-ato del LOD si converte in URL raw libero con una pura sostituzione di stringa: `https://raw.githubusercontent.com/SenatoDellaRepubblica/AkomaNtosoBulkData/master/Leg<leg>/Atto<8-digit ddl>/emend/<ultimo segmento URLTestoXml>-em.akn.xml`. Zero chiamate di listing.
2. **Tutto il resto** (emendamenti post-2024 assenti dal LOD, resoconti, testi): l'endpoint JSON della web UI di GitHub — `GET https://github.com/SenatoDellaRepubblica/AkomaNtosoBulkData/tree/master/<path>` con header `Accept: application/json` — restituisce i nomi file in `.payload.codeViewTreeRoute.tree.items[]`, senza token e fuori dal rate limit dell'API REST (60/h anonimo). ⚠️ Endpoint non documentato: può cambiare senza preavviso, usarlo con throttle prudenziale. Fallback robusto per usi batch: partial clone git (`--filter=blob:none --sparse`).

Nota: `osr:testoPresentato`/`osr:testoApprovato` del LOD sono URN NIR, **non** ID_TESTO — non aiutano a costruire i filename.

# Limiti

- Organizzato **per Atto Senato**: copre solo documenti legati a un DDL. Le **audizioni** (Ufficio di Presidenza, indagini conoscitive) NON ci sono — per quelle resta solo l'HTML "Audizioni e documenti acquisiti" ([[sedute-commissione]]).
- I `sommcomm/` per-atto sono i resoconti delle sedute in cui l'atto è stato trattato, non l'archivio completo per commissione (quello resta `listasommcomm`, dietro WAF).
- I contatori di voto nei `resaula/` richiedono parsing del testo; nessuna garanzia di formato stabile tra legislature.
- Repo grande (~1,7 GB): per usi puntuali scaricare i singoli file raw, non clonare.

# Citations

[1] README repo + README per-atto `Leg19/Atto00060233` (2026-07-10): struttura cartelle, licenza CC BY 4.0, link espliciti a `dati.senato.it/ddl/60233`.
[2] Verifica freschezza emendamenti (2026-07-10): `Leg19/Atto00060233/emend/` → 5+ file `-em.akn.xml` (Piano Casa, DDL 2026) contro LOD fermo al 9/8/2024.
[3] Verifica gap 2020 (2026-07-10): `Leg18/Atto00052873/resaula/01150035-ra.akn.xml`, `date="2020-04-09"`, testo "Proclamo il risultato della votazione nominale con appello dell'emendamento 1.900 … questione di fiducia" + contatori nel testo.
