# italianparliament-mcp

Strumento per interrogare i dati aperti del Parlamento italiano — Camera dei Deputati (`dati.camera.it`) e Senato della Repubblica (`dati.senato.it`).

Pensato per giornalisti, ricercatori e analisti parlamentari: ogni comando restituisce dati strutturati (CSV o JSONL) pronti per l'analisi.

Usabile in tre modi:

- **Da terminale** — `italianparliament <risorsa> <azione>` (installabile via npm)
- **Da Claude** — come MCP server integrato in Claude Desktop o Claude Code
- **Da remoto** — come MCP server HTTP su Cloudflare Worker (`https://italianparliament-mcp.andy-pr.workers.dev`)

## Cosa puoi fare

### Parlamentari

| Comando | Cosa fa |
|---------|---------|
| `deputies list` | Lista deputati Camera, filtrabile per legislatura |
| `senators list` | Lista senatori, filtrabile per legislatura |
| `search find` | Cerca un parlamentare per nome in Camera, Senato o entrambi |
| `deputy show` | Scheda di un deputato: nome, genere, data/luogo nascita, lista elezione, data elezione, convalida, commissioni |
| `senator show` | Scheda di un senatore: nome, genere, data/luogo nascita, regione elezione, tipo elezione, data mandato |

### Attivita legislativa — Camera

| Comando | Cosa fa |
|---------|---------|
| `bills list` | Disegni di legge Camera, filtrabile per legislatura, tipo, data (`--date-from`/`--date-to`) |
| `bill show` | Scheda di un atto Camera (titolo, tipo, data, iniziativa, primo firmatario, cofirmatari) |
| `member-bills list` | DDL presentati come primo firmatario da un deputato o senatore (Camera e Senato) |
| `aic list` | Atti di indirizzo e controllo (interrogazioni, interpellanze, mozioni), filtrabile per data |
| `votes list` | Votazioni Camera con contatori (favorevoli, contrari, astenuti), filtrabile per data, tipo fiducia (`--confidence-vote`), DDL collegato (`--bill-code`) |
| `vote-detail show` | Come ha votato ogni singolo deputato in una votazione, con nome e gruppo |
| `bill-rapporteurs list` | Relatori di un DDL Camera per commissione, con tipo (Relatore / Relatore f.f.) e data |
| `speeches list` | Interventi in aula, filtrabile per legislatura e deputato |

### Attivita legislativa — Senato

| Comando | Cosa fa |
|---------|---------|
| `bill-progress list` | Iter dei DDL al Senato: stato, date, iniziativa, natura |
| `bill-signatories show` | Firmatari di un DDL: primo firmatario e cofirmatari |
| `amendments list` | Emendamenti al Senato con link al testo |
| `documents list` | Documenti parlamentari: atti del governo, atti UE, relazioni Corte dei Conti |
| `sindacato-ispettivo list` | Atti di sindacato ispettivo Senato (interrogazioni, interpellanze, mozioni), filtrabile per data |
| `senato-votes list` | Votazioni d'Assemblea del Senato con esito, contatori (favorevoli/contrari/astenuti), tipo, data e DDL collegato. Filtrabile per legislatura, data, DDL |
| `senato-vote-detail show` | Come ha votato ogni singolo senatore in una votazione (favorevole/contrario/astenuto/presente non votante/in congedo) |

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
| `group-members list` | Composizione di un gruppo Camera: chi ne fa parte, da quando |
| `senator-group-members list` | Composizione di un gruppo al Senato a una certa data |
| `roles list` | Incarichi parlamentari con ruolo (presidente, vicepresidente, segretario...) |
| `sessions list` | Sedute della Camera con numero progressivo |
| `committees list` | Commissioni Senato; con filtro legislatura mostra solo quelle attive e il numero di sedute |
| `committee-members list` | Membri di una commissione del Senato |

### Analisi

| Comando | Cosa fa |
|---------|---------|
| `rank list` | Classifiche di attività parlamentare (`--rank-by`: aic-primo-firmatario, aic-co-firmatario, bills-primo-firmatario, bills-co-firmatario, speeches) |
| `sparql query` | Query SPARQL libera contro l'endpoint Camera o Senato (per dati non coperti dagli altri comandi) |

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
italianparliament aic list --legislature 19 --date-from 2026-04-01
```

Quali interrogazioni al Senato questa settimana?

```
italianparliament sindacato-ispettivo list --legislature 19 --date-from 2026-04-07
```

Quante interrogazioni ha presentato un deputato?

```
italianparliament aic list --deputy-uri http://dati.camera.it/ocd/deputato.rdf/d308001_19
```

Quali commissioni del Senato sono attive nella XIX legislatura e quante sedute hanno fatto?

```
italianparliament committees list --legislature 19
```

A che punto e un DDL al Senato?

```
italianparliament bill-progress list --legislature 19 --limit 10
```

Chi ha firmato un DDL al Senato?

```
italianparliament bill-signatories show --ddl-uri http://dati.senato.it/ddl/25597
```

Quali sono le ultime votazioni d'Assemblea al Senato?

```
italianparliament senato-votes list --legislature 19 --limit 20
```

Come ha votato ogni senatore in una votazione (e i contrari)?

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

Cerca "schlein" in entrambe le camere:

```
italianparliament search find --name schlein
```

## Note sui dati

I dati provengono dagli endpoint SPARQL ufficiali di Camera e Senato. Alcune limitazioni note:

- **Gruppi** (`groups`): l'acronimo viene estratto dalla label (non ha campo dedicato nell'endpoint). Funziona per tutti i gruppi della XIX legislatura.
- **Documenti Camera**: l'endpoint Camera non espone documenti parlamentari via SPARQL. Il tool `documents` usa i dati del Senato.

## Riferimento

Questo progetto e un porting in TypeScript ispirato a [italyParlR](https://github.com/paride92/italyParlR), un pacchetto R per interrogare i dati aperti del Parlamento italiano via SPARQL. Le query SPARQL di quel pacchetto hanno fornito un punto di partenza; molte altre sono state sviluppate autonomamente per coprire nuove risorse e casi d'uso.

Per le esigenze giornalistiche e le funzionalità da coprire prendiamo come riferimento [openparlamento](https://parlamento19.openpolis.it/) di Openpolis: schede parlamentari, iter dei DDL, votazioni, gruppi, indicatori e classifiche sono una guida alle user story che l'MCP punta a soddisfare.

Quali DDL ha presentato come primo firmatario un parlamentare?

```
italianparliament member-bills list --member-uri http://dati.senato.it/senatore/32
italianparliament member-bills list --member-uri http://dati.camera.it/ocd/deputato.rdf/d308920_19
```

## Stato

33 tool implementati. Vedi `LOG.md` per il diario di avanzamento e `RELEASING.md` per il processo di rilascio.

## Licenza

MIT
