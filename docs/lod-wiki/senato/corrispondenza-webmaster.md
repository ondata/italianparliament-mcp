---
type: Reference
title: Corrispondenza con il Webmaster del Senato (Webmaster@senato.it)
description: Log cronologico delle segnalazioni inviate al Webmaster del Senato sui dati aperti (dati.senato.it) e delle relative risposte, con stato (risposta ricevuta / in attesa) e link alle pagine wiki dove il contenuto tecnico estratto è documentato.
resource: mailto:Webmaster@senato.it
tags: [senato, corrispondenza, webmaster, segnalazioni, advocacy]
timestamp: 2026-07-08
---

Archivio delle segnalazioni inviate a `Webmaster@senato.it` sui dati aperti del Senato e delle risposte ricevute. Le bozze di lavoro (non versionate) restano in `docs/note-gestori-lod/senato-webmaster.md`; qui si archivia lo scambio effettivamente avvenuto, una volta inviato/risposto, perché il contenuto (soprattutto le risposte) è spesso informazione utile e non altrimenti reperibile.

Il dettaglio tecnico estratto da ogni scambio è documentato nella pagina wiki pertinente (linkata inline), non ripetuto qui.

# Thread 1 — Sedute di commissione: manca resoconto/OdG nello SPARQL

**Stato al 2026-11-04: whitelist concessa in linea di principio, azione nostra pendente.** Solleciti il 24/7 e l'1/9; il 9/9 il Webmaster chiede l'IP da inserire in white list. Mai risposto: resta da decidere quale IP dichiarare (macchina locale senza IP stabile, Worker su IP Cloudflare condivisi). Nel frattempo il 403 per volume ha colpito di nuovo il 4/11.

| Data | Da → A | Oggetto |
|------|--------|---------|
| 2026-07-02 09:23 | Borruso → Webmaster | Chiede se `osr:SedutaCommissione` espone altro oltre a data/tipo/commissione/legislatura (nessun titolo, OdG o link al resoconto trovato). Se confermato, richiede di esporre argomento/OdG (o almeno un link al resoconto, come il bollettino Camera), i senatori presenti e, per le audizioni, gli auditi. |
| 2026-07-06 09:42 | Borruso → Webmaster | Sollecito (nessun contenuto nuovo). |
| 2026-07-06 10:38 | Webmaster → Borruso | Conferma: lo SPARQL non espone resoconto/OdG. Indica una fonte alternativa **non documentata sul sito**: le liste JSON dei sommari di commissione (`listasommcomm`), con pattern URL e note d'uso. Raccomanda di non fare richieste troppo ravvicinate (rischio di blocco automatico). **Contenuto tecnico integrale → [Sedute e attività delle commissioni](sedute-commissione.md#il-dato-manca-dal-lod-ma-esiste-fuori-le-liste-json-dei-sommari-listasommcomm).** |
| 2026-07-06 10:50 | Borruso → Webmaster | Chiede se `listasommcomm` è documentato altrove (per scoprire eventuali altri usi) e se esiste un limite di rate noto/documentabile (richieste/minuto, tetto giornaliero, User-Agent consigliato, canale whitelist) per configurare lo strumento in modo conservativo. |
| 2026-07-06 11:26 | Webmaster → Borruso | `listasommcomm` non è documentato (introdotto di recente). Per ragioni di sicurezza non comunicano soglie/limiti né User-Agent. In caso di superamento limiti, si può richiedere l'inserimento in whitelist, motivando la richiesta. |
| 2026-07-06 12:25 | Borruso → Webmaster | Osservazione costruttiva: senza nessuna soglia minima indicata (anche solo "N secondi tra una richiesta e l'altra") è impossibile usare la risorsa senza rischiare blocchi in buona fede. Formalizza la richiesta di whitelist: si presenta come presidente di onData APS, spiega lo strumento (MCP/CLI open source per dati aperti del Parlamento, uso di ricerca/data journalism non commerciale) e chiede le modalità concrete (User-Agent dedicato? token?). |

*Prossimo passo: nostro. Rispondere al Webmaster con l'IP da inserire in white list, una volta deciso quale dichiarare.*

# Thread 2 — Emendamenti (`osr:Emendamento`) fermi da agosto 2024

**Stato al 2026-11-04: risolto alla fonte.** Il Webmaster l'8/7 inoltra al servizio di popolamento; nostri follow-up il 24/7; il 27/7 risponde «ci risulta che il problema sia stato risolto». Verifica del 4/11: `ddl/60233` (Piano Casa, 2026) ha 799 `osr:Emendamento` collegati.

| Data | Da → A | Oggetto |
|------|--------|---------|
| 2026-07-08 08:00 | Borruso → Webmaster | Segnala che gli emendamenti collegati a DDL recenti risultano sempre assenti (DL Sicurezza 2025, Piano Casa 2026: 0 emendamenti) mentre sono regolarmente presenti su provvedimenti anche vecchi (Cura Italia 2020: 3.827; DL dic. 2022: 119). Query di verifica allegata: nessun DDL collegato a un emendamento ha `osr:dataPresentazione` successiva al 9/8/2024. Chiede se è un aggiornamento sospeso temporaneamente o se gli emendamenti recenti sono pubblicati altrove. **Contenuto tecnico integrale → [Emendamenti — dataset fermo da agosto 2024](emendamenti-freschezza.md).** Issue collegata: [#38](https://github.com/ondata/italianparliament-mcp/issues/38). |

*Prossimo passo: nessuno, thread chiuso (risolto alla fonte, verificato il 4/11).*

# Thread 3 — Votazioni d'Assemblea assenti nella finestra COVID 2020 (leg.18)

**Stato al 2026-11-04: bozza mai inviata.** Faceva parte del pacchetto del 25/7 rimasto fermo. Il 4/11 le votazioni leg. 18 per mese risultano: feb 79, mar 70, apr 12, mag 32, giu 63 (via `osr:seduta`/`osr:dataSeduta`): il vuoto di marzo-aprile resta.

| Data | Da → A | Oggetto |
|------|--------|---------|
| — | Borruso → Webmaster | Segnala che le votazioni d'Assemblea sui principali decreti COVID (Cura Italia S.1766, Liquidità S.1829, decreto lockdown S.1811, Rilancio S.1874) risultano assenti dal grafo tra marzo e luglio 2020, pur essendo avvenute: aprile 2020 ha 1 sola votazione contro le 70-79 dei mesi adiacenti; la finestra 14-21 maggio 2020 (voto finale/fiducia sul decreto lockdown) ha solo la questione pregiudiziale, nessun voto finale. Query di verifica allegata (conteggio SPARQL sulla finestra 14-21/5/2020, risultato: 1). **Contenuto tecnico integrale → punto 1 di [note-gestori-lod/senato-webmaster.md](../../note-gestori-lod/senato-webmaster.md).** Issue collegata: [#36](https://github.com/ondata/italianparliament-mcp/issues/36). |

*Prossimo passo: inviare la bozza in [note-gestori-lod/senato-webmaster-voti-covid.md](../../note-gestori-lod/senato-webmaster-voti-covid.md).*

# Thread 4 — Perimetro di `osr:Votazione`: richiesta di conferma sull'alzata di mano

**Stato: bozza pronta, non ancora inviata.**

| Data | Da → A | Oggetto |
|------|--------|---------|
| — | Borruso → Webmaster | Richiesta di **conferma**, non segnalazione: chiede se `osr:Votazione` abbia lo stesso perimetro delle pagine "Votazione" del sito (sole votazioni con rilevazione dei voti, escluse le deliberazioni per alzata di mano ex art. 113 c.2 Reg.), e se esista un'indicazione di quanto pesi la quota non rilevata. La seconda domanda ha la ricaduta pratica: ogni indicatore costruito contando `osr:Votazione` (es. la partecipazione alle votazioni) ha per denominatore le sole votazioni rilevate, senza che chi riusa il dato possa accorgersene. Esempi allegati: seduta 333 del 24/7/2025 (articoli del DDL 1566 assenti, voto finale presente) e 26/11/2025 (DDL 1714 assente). **Contenuto tecnico integrale → [Voto per alzata di mano](voto-alzata-di-mano.md).** |

*Prossimo passo: inviare la bozza in [note-gestori-lod/senato-webmaster-alzata-di-mano.md](../../note-gestori-lod/senato-webmaster-alzata-di-mano.md).*

# Thread 5 — `intervento/null`: la risorsa `osr:Intervento` senza identificativo

**Stato: bozza pronta, non ancora inviata.**

| Data | Da → A | Oggetto |
|------|--------|---------|
| — | Borruso → Webmaster | Segnala che nel grafo esiste `http://dati.senato.it/intervento/null`, di tipo `osr:Intervento`: pare l'esito della serializzazione quando l'id dell'intervento manca a monte (viene scritta la stringa `null` nell'URI invece di omettere il record), quindi tutti gli interventi senza id collassano in un'unica risorsa. Misure al 30/7/2026: **36.853** triple `osr:seduta` (sedute dal 9/5/1996 al 29/7/2026), **47.571** `osr:oggetto`, nessun `osr:interviene`, su una classe di 302.845 interventi. Effetto: il join oggetto→intervento→seduta attraversa quel nodo e restituisce il prodotto delle due liste — **righe non vere**, non un vuoto. Esempio allegato: 18.945 sedute (comprese sedute d'Assemblea del 1996) per l'Atto del Governo n. 418 sull'IA nell'attività di polizia, presentato il 24/6/2026. Due domande: (1) conferma che sia un effetto della pipeline e non una risorsa con significato proprio; (2) possibilità di **omettere il record** quando l'id manca, o almeno di documentare l'URI come sentinella. Segnalata nella stessa nota l'assenza della **commissione assegnataria** sui documenti "Atto del Governo sottoposto a parere parlamentare". **Contenuto tecnico integrale → [trappole Senato](trappole.md).** |

*Prossimo passo: inviare la bozza in [note-gestori-lod/senato-webmaster-intervento-null.md](../../note-gestori-lod/senato-webmaster-intervento-null.md).*

# Thread 6 — Audizioni di commissione: assenti dagli open data

**Stato al 2026-11-04: risposto, confermata l'assenza.**

| Data | Da → A | Oggetto |
|------|--------|---------|
| 2026-07-25 08:00 | Borruso → Webmaster | Chiede se le audizioni (oggetto e auditi) siano esposte da qualche parte negli open data, non trovandole nel grafo. |
| 2026-09-01 08:06 | Borruso → Webmaster | Sollecito. |
| 2026-09-09 13:09 | Webmaster → Borruso | «le informazioni sulle audizioni non sono attualmente pubblicate negli open data del Senato». |

Verifica del 4/11: nessuna classe con «audizion» fra le classi istanziate del grafo. Proposta di advocacy in `docs/proposta-audizioni-auditi/`.

# Thread 7 — `osr:dataPresentazione` dei DDL tipizzata `xsd:string`, non `xsd:date`

**Stato al 2026-11-04: inoltrata al servizio tecnico, nessun riscontro; condizione invariata.**

| Data | Da → A | Oggetto |
|------|--------|---------|
| 2026-09-01 08:17 | Borruso → Webmaster | Segnala che `osr:dataPresentazione` è `xsd:string` sui `Ddl` (58.677 valori) e `xsd:date` su `SindacatoIspettivo` e `Documento`: un filtro tipizzato su `osr:Atto` esclude tutti i DDL senza errore. |
| 2026-09-09 13:32 | Webmaster → Borruso | «abbiamo inoltrato al servizio tecnico». |
| 2026-10-10 13:14 | Borruso → Webmaster | Rieseguita la query: grafo aggiornato, tipizzazione identica. Chiede se un allineamento a `xsd:date` sia previsto. |

Verifica del 4/11: `Ddl` 58.745 valori, tutti `xsd:string`. Nel frattempo è emerso un secondo difetto, sullo stesso servizio: il confronto col literal `^^xsd:date` è rotto anche sui valori `xsd:date` (vedi [trappole](trappole.md), issue #116). Da proporre come follow-up in questo thread, non come mail nuova.
