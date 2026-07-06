# italianparliament-mcp

[![npm version](https://img.shields.io/npm/v/@aborruso/italianparliament-mcp)](https://www.npmjs.com/package/@aborruso/italianparliament-mcp)
[![GitHub](https://img.shields.io/badge/github-aborruso%2Fitalianparliament--mcp-blue?logo=github)](https://github.com/aborruso/italianparliament-mcp)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/aborruso/italianparliament-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Newsletter](https://img.shields.io/badge/newsletter-ondata-FF6719?logo=substack)](https://ondata.substack.com/)

Strumento per interrogare i dati aperti del Parlamento italiano — Camera dei Deputati (`dati.camera.it`) e Senato della Repubblica (`dati.senato.it`).

Pensato per giornalisti, ricercatori e analisti parlamentari: ogni comando restituisce dati strutturati (CSV o JSONL) pronti per l'analisi.

> 🌌 **[Il cielo del Parlamento](https://aborruso.github.io/italianparliament-mcp/)** — la pagina che racconta il progetto: ogni stella è un parlamentare in carica, ogni tappa una legislatura dal 1848. I dati arrivano in tempo reale dal server MCP, a ogni visita.

Usabile in tre modi:

- **Da terminale** — `italianparliament <risorsa> <azione>` (CLI installabile via npm)
- **Da Claude** — come MCP server integrato in Claude Desktop o Claude Code
- **Da remoto** — come MCP server HTTP su Cloudflare Worker (`https://italianparliament-mcp.andy-pr.workers.dev`)

## Installazione

### Come CLI (consigliato — disponibile in tutto il sistema)

```bash
npm install -g @aborruso/italianparliament-mcp
```

Poi:

```bash
italianparliament --help
italianparliament guide                       # flusso tipico di utilizzo
italianparliament search find --name schlein
```

> Per scaricare il **testo dei DDL del Senato** (`bill-text fetch`) servono anche [`agent-browser`](https://www.npmjs.com/package/agent-browser) e `lit` (liteparse) installati.

### Come server MCP (Claude Desktop / Claude Code)

- **Remoto** (più semplice): usa l'endpoint `https://italianparliament-mcp.andy-pr.workers.dev/mcp`.
- **Locale**: dopo l'installazione globale, configura il comando `italianparliament-mcp` (trasporto stdio) nel client MCP.

### Da sorgente (sviluppo)

```bash
git clone https://github.com/aborruso/italianparliament-mcp
cd italianparliament-mcp
npm install
npm run build
node dist/cli.js --help
```

## Uso con un agente AI (skill)

Lo strumento **dà il meglio guidato da un agente AI**. Il repo include due Agent Skill che insegnano all'agente a orchestrarlo passo passo:

- **`italian-parliament-cli`** — uso da riga di comando (pipeline, export CSV/JSONL, scripting).
- **`italian-parliament-mcp`** — uso via server MCP (conversazione).

Le skill funzionano con diversi agenti (Claude Code, OpenCode, Codex, Copilot e altri). Installazione cross-agent in un comando con [`skills`](https://github.com/vercel-labs/skills):

```bash
npx skills add aborruso/italianparliament-mcp --skill italian-parliament-cli
npx skills add aborruso/italianparliament-mcp --skill italian-parliament-mcp
```

In alternativa, copia la cartella `skills/<nome>/` e registrala secondo la documentazione del tuo agente.

> **Consiglio: usa CLI e MCP in coppia con la skill.** La skill incapsula il *workflow* (scoperta → URI → dettaglio, catene tra comandi); MCP e CLI sono i due motori sotto: l'**MCP** per l'uso conversazionale, la **CLI** per pipeline/export e per le funzioni che da server sarebbero bloccate (es. `bill-text fetch`, che supera l'AWS WAF del Senato). Tenere entrambe dà all'agente sia la modalità conversazionale sia quella da terminale; gli affordance `guide` e `which` rendono inoltre la CLI scopribile anche a freddo.

## Cosa puoi fare

### Parlamentari

| Comando | Cosa fa |
|---------|---------|
| `deputies list` | Lista deputati Camera, filtrabile per legislatura, circoscrizione, genere, data e luogo di nascita (comune/provincia/regione) |
| `senators list` | Lista senatori, filtrabile per legislatura, genere, data e città di nascita |
| `search find` | Cerca un parlamentare per nome in Camera, Senato o entrambi. Ranking automatico: match esatto sul cognome e preferenza per la legislatura corrente portano in cima il risultato più pertinente |
| `deputy show` | Scheda di un deputato: nome, genere, data/luogo nascita, lista elezione, data elezione, convalida, commissioni |
| `senator show` | Scheda di un senatore: nome, genere, data/luogo nascita, regione elezione, tipo elezione, data mandato |
| `person-career show` | Carriera unificata di una persona: tutti i mandati da deputato (per legislatura) e gli incarichi di governo, con link Wikidata. Risolve doppio incarico parlamento+governo e carriera multi-legislatura |
| `people resolve` | Risolve in batch una lista di URI persona (anche misti Camera + Senato) nei rispettivi nomi, con una query per endpoint. Dà i nominativi agli URI "nudi" restituiti dai tool relazionali senza una chiamata `deputy`/`senator` per ciascuno |

### Attivita legislativa — Camera

| Comando | Cosa fa |
|---------|---------|
| `bills list` | Disegni di legge Camera, filtrabile per legislatura, tipo, data (`--date-from`/`--date-to`) |
| `bill show` | Scheda di un atto Camera (titolo, tipo, data, iniziativa, primo firmatario, cofirmatari) |
| `member-bills list` | DDL presentati come primo firmatario da un deputato o senatore (Camera e Senato) |
| `aic list` | Atti di indirizzo e controllo (interrogazioni, interpellanze, mozioni), filtrabile per data, tipo (`--type`, es. `immediata` per question time) e parola chiave a confini di parola (`--keyword`) |
| `votes list` | Votazioni Camera con contatori (favorevoli, contrari, astenuti), filtrabile per data, tipo fiducia (`--confidence-vote`), DDL collegato (`--bill-code`). Per mozioni e risoluzioni espone il codice AIC (`aic_code`) e il link alla scheda (`aic_link`) |
| `vote-detail show` | Come ha votato ogni singolo deputato in una votazione, con nome e gruppo |
| `bill-rapporteurs list` | Relatori di un DDL (Camera o Senato, riconosciuti dall'URL): nome, tipo (Relatore / f.f.), commissione/organo e data |
| `bill-committees list` | Commissioni a cui un DDL/atto è assegnato (Camera o Senato, dall'URL): nome, sede/ruolo (Referente, Consultiva, …), tipo, data di assegnazione, URI organo |
| `camera-amendments list` | Emendamenti (proposte emendative) a un atto Camera, per sede (referente/Assemblea): numero, articolo, primo firmatario, emendamenti identici, link al testo; `--count-only` per il conteggio per sede. Gli emendamenti Camera non sono nel LOD: la fonte è l'app HTML `documenti.camera.it` (per il Senato usare `amendments`) |
| `speeches list` | Interventi in aula, filtrabile per legislatura e deputato |

### Attivita legislativa — Senato

| Comando | Cosa fa |
|---------|---------|
| `bill-progress list` | Iter dei DDL: al Senato stato/date/iniziativa/natura (lista, per `--ddl-uri`, o per numero con `--number <n>` + `--branch S\|C` — senza `--legislature` usa la legislatura corrente risolta dinamicamente); con `--uri <atto Camera>` restituisce la timeline completa dell'iter alla Camera (tutti gli stati attraversati, con data) |
| `bill-signatories show` | Firmatari di un DDL (Camera o Senato): primo firmatario e cofirmatari. Per gli atti di iniziativa governativa il ruolo è "Governo (proponente)" |
| `amendments list` | Emendamenti al Senato con numero, tipo, DDL collegato e link al testo. Filtrabile per legislatura e per DDL (`--ddl-uri`) |
| `documents list` | Documenti parlamentari: atti del governo, atti UE, relazioni Corte dei Conti |
| `sindacato-ispettivo list` | Atti di sindacato ispettivo Senato (interrogazioni, interpellanze, mozioni), filtrabile per data |
| `senato-votes list` | Votazioni d'Assemblea del Senato con esito, contatori (favorevoli/contrari/astenuti), tipo, data e DDL collegato. Filtrabile per legislatura, data, DDL |
| `senato-vote-detail show` | Come ha votato ogni singolo senatore in una votazione (favorevole/contrario/astenuto/presente non votante/in congedo), con il gruppo di appartenenza alla data del voto — consente il voto per gruppo |
| `committee-sessions list` | Attività delle commissioni. Iter di un DDL (`--ddl-uri`, Senato) o tutte le sedute di una commissione per data (`--committee-uri`/`--committee-name` + `--chamber`, Camera+Senato); Camera mostra data + URL del bollettino, Senato data/tipo/interventi. `--count-only` per il solo conteggio delle sedute |
| `audizioni list` | **[CAMERA]** Audizioni delle commissioni: data, commissione, titolo (con nome/ruolo dell'audito), atti collegati e link al bollettino. Filtrabile per `--legislature`, `--committee-name`, `--keyword`, data. Leg. 19 (dato vivo) via titolo della discussione; leg. 14 (storica) via `dc:type`. Senato non coperto (via SPARQL non espone data né commissione delle audizioni) |

### Testo dei disegni di legge

Il testo integrale di un DDL non è nei dati aperti SPARQL (solo metadati). Questi comandi danno accesso al testo.

| Comando | Cosa fa |
|---|---|
| `bill-text links` | Link diretti al testo di un DDL (Camera o Senato), con tipo risorsa (`format`: html/pdf/urn) e se serve un browser (`auth`: none/browser) |
| `bill-text fetch` | Scarica un testo del DDL Senato e lo converte in markdown. `www.senato.it` è dietro AWS WAF: apre un browser reale (`agent-browser`) per superarlo, scarica il PDF e lo converte con `lit`. Opzioni `--which`, `--all`, `--fascicolo`, `--out`. Richiede `agent-browser` e `lit` installati |

### Organizzazione parlamentare

| Comando | Cosa fa |
|---------|---------|
| `groups list` | Gruppi parlamentari Camera con acronimo (FDI, PD-IDP, M5S...) |
| `group-members list` | Composizione di un gruppo Camera: chi ne fa parte (con nome del deputato, colonna `deputy_name`) e da quando |
| `senato-groups list` | Gruppi parlamentari Senato con sigla e numero di componenti distinti. `--as-of YYYY-MM-DD` per legislature passate (es. `--as-of 2022-10-12` per la XVIII) |
| `senator-group-members list` | Composizione di un gruppo al Senato a una certa data (con nome del senatore, colonna `senator_name`) |
| `roles list` | Incarichi parlamentari con ruolo (presidente, vicepresidente, segretario...) |
| `sessions list` | Sedute della Camera con numero progressivo |
| `committees list` | Commissioni Camera e Senato (`--chamber`), con categoria e numero di sedute; Camera filtrata per legislatura (default 19) |
| `committee-members list` | Membri di una commissione del Senato |

### Analisi

| Comando | Cosa fa |
|---------|---------|
| `rank list` | Classifiche di attività parlamentare (`--rank-by`: aic-primo-firmatario, aic-cofirmatario, bills-primo-firmatario, bills-cofirmatario, speeches, sindacato-ispettivo, ddl-senato) |
| `group-rank list` | Classifica dei gruppi Camera per AIC o DDL (primo firmatario), con conteggio, numero membri e media per membro |
| `sparql query` | Query SPARQL libera contro l'endpoint Camera o Senato (per dati non coperti dagli altri comandi) |

I comandi `bills`, `aic`, `votes` e `senato-votes` accettano `--count-only` per ottenere solo il numero totale (utile per confronti fra legislature senza scaricare le righe).

**Scoperta dei comandi**: `italianparliament guide` stampa il flusso tipico (scoperta → URI → dettaglio); `italianparliament which "<capacità>"` trova il comando giusto (es. `which "testo ddl"`); `<comando> --help` mostra opzioni ed esempi.

### Contesto istituzionale

| Comando | Cosa fa |
|---------|---------|
| `legislatures list` | Tutte le legislature dal 1848 a oggi |
| `governments list` | Tutti i governi italiani, dal piu recente (con data) |
| `gov-members list` | Membri del governo: ministri, sottosegretari, con ruolo e date. Cerca per nome |

## Esempi pratici

Quanti deputati hanno fatto parte della XIX legislatura (inclusi i subentrati)?

```
italianparliament deputies list --legislature 19 --limit 1000 --format csv | tail -n +2 | wc -l
```

Chi sono i membri del governo Meloni?

```
italianparliament gov-members list --legislature 19
```

Meloni ha avuto altri incarichi di governo in passato?

```
italianparliament gov-members list --name meloni
```

Quali gruppi parlamentari ci sono alla Camera e con quale acronimo?

```
italianparliament groups list --legislature 19
```

Chi fa parte di Fratelli d'Italia?

```
italianparliament group-members list --legislature 19 --group-uri http://dati.camera.it/ocd/gruppoParlamentare.rdf/gr4133
```

Come hanno votato i singoli deputati su una specifica votazione?

```
italianparliament vote-detail show --vote-uri http://dati.camera.it/ocd/votazione.rdf/vs19_047_005 --format jsonl
```

Quali votazioni ci sono state questa settimana?

```
# sostituisci le date con l'intervallo corrente
italianparliament votes list --legislature 19 --date-from 2026-04-07 --date-to 2026-04-12
```

Quali voti di fiducia ci sono stati nella XIX legislatura?

```
italianparliament votes list --legislature 19 --confidence-vote true
```

Tutte le votazioni collegate al DDL 2807:

```
italianparliament votes list --bill-code 2807 --legislature 19
```

Chi erano i relatori del DDL 2807 nelle commissioni?

```
italianparliament bill-rapporteurs list --bill-uri http://dati.camera.it/ocd/attocamera.rdf/ac19_2807
```

Quali interrogazioni sono state presentate questo mese?

```
# sostituisci la data con l'inizio del mese corrente
italianparliament aic list --legislature 19 --date-from 2026-04-01
```

Quali interrogazioni parlano di un tema (es. xylella)?

```
italianparliament aic list --legislature 19 --keyword xylella
```

Quale gruppo presenta più interrogazioni, anche rapportato ai suoi membri?

```
italianparliament group-rank list --rank-by aic --legislature 19
```

Quanti emendamenti ha avuto un DDL al Senato?

```
italianparliament amendments list --ddl-uri http://dati.senato.it/ddl/56260 --limit 1000 --format jsonl | wc -l
```

In quali sedute di commissione è passato un DDL?

```
italianparliament committee-sessions list --ddl-uri http://dati.senato.it/ddl/56260
```

Cerca una parola nel titolo delle audizioni (es. Confindustria)? (solo Camera)

```
italianparliament audizioni list --legislature 19 --keyword Confindustria
```

> La corrispondenza dice solo che la parola è nel titolo, **non** che quel soggetto sia stato audito: potrebbe essere l'oggetto dell'indagine o un ente citato nel contesto. Va sempre verificato il titolo completo.

Quali audizioni ha svolto una commissione d'inchiesta (es. femminicidio)? (solo Camera)

```
italianparliament audizioni list --legislature 19 --committee-name femminicidio
```

Quali interrogazioni al Senato questa settimana?

```
# sostituisci la data con l'inizio della settimana corrente
italianparliament sindacato-ispettivo list --legislature 19 --date-from 2026-04-07
```

Quali interrogazioni ha presentato un deputato?

```
italianparliament aic list --deputy-uri http://dati.camera.it/ocd/deputato.rdf/d308001_19
```

Quali commissioni sono attive nella XIX legislatura e quante sedute hanno fatto?

```
italianparliament committees list --legislature 19
italianparliament committees list --chamber camera --legislature 19
```

A che punto è un DDL al Senato?

```
italianparliament bill-progress list --ddl-uri http://dati.senato.it/ddl/25597
```

Chi ha firmato un DDL? Camera o Senato, il ramo è riconosciuto dall'URI:

```
italianparliament bill-signatories show --bill-uri http://dati.camera.it/ocd/attocamera.rdf/ac19_2696
italianparliament bill-signatories show --bill-uri http://dati.senato.it/ddl/25597
```

Quali sono le ultime votazioni d'Assemblea al Senato?

```
italianparliament senato-votes list --legislature 19 --limit 20
```

Chi ha votato contro in una votazione del Senato?

```
italianparliament senato-vote-detail show --vote-uri http://dati.senato.it/votazione/19-167-42 --vote-type Contrario
```

Dove trovo il testo di un DDL e di che tipo è (html/pdf)?

```
italianparliament bill-text links --uri http://dati.senato.it/ddl/59294 --format jsonl
```

Scarica il testo di un DDL del Senato in markdown (apre un browser per superare l'AWS WAF; richiede `agent-browser` e `lit`):

```
italianparliament bill-text fetch --did 59294 --out testo.md
```

Quali atti del governo sono al vaglio del Senato?

```
italianparliament documents list --legislature 19 --type "Atto del Governo"
```

Quali interventi in aula ci sono stati nella XIX legislatura?

```
italianparliament speeches list --legislature 19 --limit 20
```

Qual è la carriera completa di un parlamentare (legislature + governo)?

```
italianparliament person-career show --uri http://dati.camera.it/ocd/deputato.rdf/d301551_15
```

Cerca "schlein" in entrambe le camere:

```
italianparliament search find --name schlein
```

Risolvi una lista di URI persona (anche misti Camera + Senato) nei nomi:

```
italianparliament people resolve --uris http://dati.senato.it/senatore/32,http://dati.camera.it/ocd/deputato.rdf/d308917_19
```

Quali DDL ha presentato come primo firmatario un parlamentare?

```
italianparliament member-bills list --member-uri http://dati.senato.it/senatore/32
italianparliament member-bills list --member-uri http://dati.camera.it/ocd/deputato.rdf/d308920_19
```

### Un'inchiesta passo per passo: la riforma della Corte dei Conti

> Un secondo caso, più esteso e con glossario + lettura del testo, è in [`docs/case-study-salario-giusto.md`](docs/case-study-salario-giusto.md): la fiducia del 2026-06-24 sulla conversione del decreto "salario giusto".

A dicembre 2025 il Senato approva in via definitiva la riforma che limita i poteri di controllo dei giudici contabili (il cosiddetto "scudo erariale"). Ricostruiamo i fatti partendo solo dai dati ufficiali.

Trova il provvedimento e il suo stato (cerca per parola chiave nell'iter del Senato):

```
italianparliament bill-progress list --legislature 19 --keyword "Corte dei conti"
```

Risultato: il DDL **S.1457** (`http://dati.senato.it/ddl/59070`), "appr. definit. Legge" il **2025-12-27**, iniziativa **Dep. Foti Tommaso**.

Chi l'ha firmato? Il primo firmatario e i cofirmatari:

```
italianparliament bill-signatories show --bill-uri http://dati.senato.it/ddl/59070
```

Risultato: primo firmatario **On. Tommaso Foti** (FdI), cofirmatari De Corato e Barelli.

Chi ha relazionato il testo in Senato (relatori di commissione e d'aula)?

```
italianparliament bill-rapporteurs list --bill-uri http://dati.senato.it/ddl/59070
```

Risultato: relatori in commissione **Paolo Tosato** (Lega) e **Salvatore Sallemi** (FdI).

Com'è andata la votazione finale?

```
italianparliament senato-votes list --ddl-uri http://dati.senato.it/ddl/59070
```

Risultato: votazione `19-376-2` del **2025-12-27**, **approvato** con **93 favorevoli, 51 contrari, 5 astenuti**.

Come ha votato ogni senatore, e soprattutto come si sono divisi i gruppi? Il dettaglio include il gruppo di appartenenza alla data del voto:

```
italianparliament senato-vote-detail show --vote-uri http://dati.senato.it/votazione/19-376-2 --format jsonl
```

Da qui si verifica che **Matteo Salvini** (Lega) ha votato **Favorevole** e si ricostruisce il voto per gruppo: a favore FdI (49), Lega (25), Forza Italia (12) e Civici d'Italia (6); contrari PD (27) e M5S (21); Italia Viva astenuta (5) — la classica spaccatura maggioranza/opposizione.

## Note sui dati

I dati provengono dagli endpoint SPARQL ufficiali di Camera e Senato. Alcune limitazioni note:

- **Scheda istituzionale** (`html_url`): i tool che restituiscono persone (`deputies`, `senators`, `search`, `group-members`, `senator-group-members`, `rank`, `vote-detail`, `senato-vote-detail`, `people`...) e atti/DDL (`bills`, `bill`, `member-bills`, `bill-signatories`, `bill-rapporteurs`, `bill-progress`...) espongono una colonna `html_url` con il link alla scheda su `camera.it`/`senato.it`, accanto all'URI SPARQL. I tool sui DDL del Senato `amendments` e `senato-votes` espongono invece `ddl_html_url`. I pattern sono verificati sulla legislatura 19; per legislature passate l'URL è best-effort.
- **Feed RSS iter** (`rss_url`): i tool sui DDL del Senato (`amendments`, `senato-votes`, `bill-progress`) espongono `rss_url`, il feed RSS con l'iter dettagliato del DDL (fasi, sedute, voto finale, esiti).
- **Gruppi** (`groups`): l'acronimo viene dal campo `dcterms:alternative` dell'endpoint (es. `AVS`, `PD-IDP`); per i rari casi senza quel campo si ricava dalla label.
- **Documenti Camera**: l'endpoint Camera non espone documenti parlamentari via SPARQL. Il tool `documents` usa i dati del Senato.
- **Emendamenti Camera** (`camera-amendments`): a differenza del Senato (`amendments`, da SPARQL), gli emendamenti della Camera non sono nel LOD. Questo tool li ricava dall'app HTML `documenti.camera.it/apps/emendamenti` tramite scraping: la fonte è HTML, quindi il tool dipende dalla struttura delle pagine (test-sentinella fissano i conteggi noti per intercettare cambi di markup). L'esito del voto sul singolo emendamento non è incluso (vive nella vista per-seduta della fonte).
- **Voti di fiducia al Senato** (`senato-votes`): nei dati il legame col DDL (`osr:oggetto`) **manca** per le fiducie — il numero è scritto solo nel testo della `label` (es. "Disegno di legge n.1933. Votazione questione di fiducia."). Da **v0.8.0** i tool colmano il vuoto: la colonna `bill_number` riporta il numero e `ddl_uri` viene **risolto in fallback** dal numero (via `osr:fase`). Da **v0.17.0** un secondo fallback **intra-seduta** copre anche i refusi della fonte (es. "DDL n. 1994" per S.1944): se un voto senza DDL condivide la data con altri voti che hanno `ddl_uri` noto, lo eredita. Nota: `senato-votes list --ddl-uri <uri>` filtra ancora sul legame diretto e quindi **non** restituisce le fiducie — per quelle usare `--date-from`/`--date-to` o leggere `ddl_uri` in output. Attenzione alle votazioni "finali" trovate per data: possono appartenere a un atto diverso (testo unificato) — verificare `bill_number`/`ddl_uri`. Analogo alla Camera per i voti senza `rif_attoCamera` (colonne `bill_number`/`bill_uri`).

## Riferimento

Questo progetto e un porting in TypeScript ispirato a [italyParlR](https://github.com/paride92/italyParlR), un pacchetto R per interrogare i dati aperti del Parlamento italiano via SPARQL. Le query SPARQL di quel pacchetto hanno fornito un punto di partenza; molte altre sono state sviluppate autonomamente per coprire nuove risorse e casi d'uso.

[openparlamento](https://parlamento19.openpolis.it/) di Openpolis è stato e resterà sempre un riferimento e una fonte di ispirazione per le esigenze giornalistiche e le funzionalità da coprire.

## Licenza

MIT
