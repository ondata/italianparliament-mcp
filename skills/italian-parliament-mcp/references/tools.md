# Tool Reference — italianparliament-mcp

38 tool. Colonne trasversali nell'output:
- **`html_url`**: link alla scheda istituzionale su `camera.it`/`senato.it`, accanto all'URI SPARQL. Presente sui tool che restituiscono persone (`deputies`, `senators`, `search`, `group-members`, `senator-group-members`, `rank`, `vote-detail`, `senato-vote-detail`, `people`...) e atti/DDL (`bills`, `bill`, `member-bills`, `bill-signatories`, `bill-rapporteurs`, `amendments`, `senato-votes`, `bill-progress`...).
- **`rss_url`**: feed RSS con l'iter dettagliato del DDL (fasi, sedute, voto finale). Presente sui tool DDL del Senato (`amendments`, `senato-votes`, `bill-progress`).

## Parlamentari

### `search`
Cerca un parlamentare per nome in Camera, Senato o entrambi.
- `query` (required): nome o cognome
- `chamber`: `camera` | `senato` | `both` (default: `both`)
- `legislature`: numero legislatura (default: 19)

### `deputies`
Lista deputati Camera.
- `legislature`: numero legislatura (default: 19)
- `limit`: max risultati (default: 100)
- `format`: `csv` | `jsonl`

### `senators`
Lista senatori.
- `legislature`: numero legislatura (default: 19)

### `deputy`
Scheda di un deputato.
- `uri` (required): URI del deputato (da `search` o `deputies`)

### `senator`
Scheda di un senatore.
- `uri` (required): URI del senatore

### `person-career`
Carriera unificata di una persona: mandati da deputato (per legislatura) + appartenenza ai gruppi (con date) + incarichi di governo + link Wikidata. Risolve doppio incarico parlamento+governo e carriera multi-legislatura.
- `uri` (required): URI deputato o persona (Camera)
- Output ordinato: persona, mandati, gruppi (cronologici), governo.
- Camera+governo affidabile; Camera↔Senato non nei dati (solo via nome + data nascita).

### `people`
Risolve in batch una lista di URI persona (anche misti Camera + Senato) nei rispettivi nomi, con una query per endpoint. Dà i nominativi agli URI "nudi" restituiti dai tool relazionali, evitando una chiamata `deputy`/`senator` per ciascuno.
- `uris` (required): array di URI persona (Camera `deputato.rdf/...` o Senato `senatore/...`), max 500. La camera è rilevata dall'URI.
- Output: `uri`, `first_name`, `last_name`, `label`, `chamber`, `html_url`. Gli URI non risolti restano in output con label vuota.

## Attività legislativa — Camera

### `bills`
Disegni di legge Camera.
- `legislature`: numero legislatura
- `type`: tipo atto
- `limit`: max risultati

### `bill`
Scheda di un atto Camera.
- `uri` (required): URI dell'atto

### `aic`
Atti di indirizzo e controllo (interrogazioni, interpellanze, mozioni). Il testo è in `description`.
- `legislature`: numero legislatura
- `deputyUri`: filtra per deputato
- `keyword`: cerca nel testo (label/titolo/description) a confini di parola, es. un tema ("CETA" non matcha "Acetamiprid")
- `type`: filtra per tipo (match parziale su `dc:type`, fallback sul label — "immediata" trova le interrogazioni a risposta immediata/question time anche quando `dc:type` le etichetta genericamente "orale")
- `limit`: max risultati

### `votes`
Votazioni Camera.
- `legislature`: numero legislatura
- `limit`: max risultati
- Colonna `bill_number`: numero atto citato nella descrizione (es. `2920-A`). `bill_uri`: URI dell'atto Camera, popolato anche quando manca `rif_attoCamera` risolvendo il numero via `dc:identifier`.

### `vote-detail`
Come ha votato ogni deputato in una votazione.
- `voteUri` (required): URI della votazione
- `groupAcronym`: filtra per sigla gruppo (es. FDI)
- `voteType`: Favorevole | Contrario | Astenuto | Non ha votato

### `speeches`
Interventi in aula Camera.
- `legislature`: numero legislatura (nota: dati disponibili da leg. 17)
- `deputyUri`: filtra per deputato

## Attività legislativa — Senato

### `bill-progress`
Iter di un disegno di legge, Camera o Senato (stesse colonne in entrambi i casi).
- **Senato** (senza `uri`): lista DDL con stato corrente dell'iter, filtrabile.
  - `legislature`: numero legislatura
  - `ddlUri`: singolo DDL Senato
  - `keyword`: cerca nel titolo del DDL
  - `dateFrom`/`dateTo`: intervallo data presentazione
- **Camera** (`uri` = atto Camera `attocamera.rdf/...`): timeline completa di tutti gli stati attraversati, in ordine cronologico.

### `bill-signatories`
Firmatari di un DDL Senato.
- `ddlUri` (required): URI del DDL

### `bill-rapporteurs`
Relatori di un DDL, **Camera o Senato** (il ramo è riconosciuto dall'URI). Nome, tipo (Relatore / f.f.), commissione/organo e data.
- `billUri` (required): URI del DDL (Camera `attocamera.rdf/...` o Senato `ddl/...`)

### `amendments`
Emendamenti Senato con DDL collegato.
- `legislature`: numero legislatura
- `ddlUri`: filtra gli emendamenti a un DDL specifico

### `sindacato-ispettivo`
Atti di sindacato ispettivo Senato (interrogazioni, interpellanze).
- `legislature`: numero legislatura (integer, es. 19)
- `senatorUri`: filtra per senatore

### `documents`
Documenti parlamentari Senato.
- `legislature`: numero legislatura

### `senato-votes`
Votazioni d'Assemblea del Senato: esito, contatori, tipo, data seduta, DDL collegato.
- `legislature`: numero legislatura (default 19)
- `ddlUri`: filtra le votazioni collegate a un DDL
- `dateFrom`/`dateTo`: intervallo data seduta (YYYY-MM-DD)
- Colonna `bill_number`: numero DDL citato nel label (es. `562-B`). `ddl_uri`: URI del DDL, popolato anche per le fiducie (prive di `osr:oggetto`) risolvendo il numero via `osr:fase`.

### `senato-vote-detail`
Voto del singolo senatore in una votazione, con il gruppo di appartenenza alla data del voto (colonna `group_label`) — consente il voto per gruppo.
- `voteUri` (required): URI della votazione (da `senato-votes`)
- `voteType`: filtro (Favorevole/Contrario/Astenuto/Presente non votante/In congedo/missione)

### `committee-sessions`
Sedute di commissione in cui un DDL è stato trattato (iter in commissione).
- `ddlUri` (required): URI del DDL Senato
- Output: data, commissione, tipo seduta, n. interventi.

### `bill-text` (Camera + Senato)
Link diretti al testo di un DDL, con tipo risorsa (`format`: html/pdf/urn) e se serve un browser (`auth`: none/browser). Il testo integrale NON è nei dati SPARQL.
- `uri` (required): URI dell'atto (`http://dati.senato.it/ddl/<N>` o atto Camera)
- Senato (`auth=browser`): `www.senato.it` è dietro AWS WAF → un fetch diretto torna HTTP 202. Per scaricare e convertire in markdown usare la CLI locale `italianparliament bill-text fetch --did <N>` (apre un browser reale, supera il WAF, converte il PDF con `lit`). Opzioni: `--which "<etichetta>"`, `--all`, `--fascicolo`.
- Camera (`auth=none`): pagina fetchabile direttamente.
- `bill-text fetch` è solo CLI/locale (richiede `agent-browser` e `lit`), non è un tool MCP.

## Organizzazione parlamentare

### `groups`
Gruppi parlamentari Camera con sigla e URI.
- `legislature`: numero legislatura

### `group-members`
Composizione di un gruppo Camera, con il nome del deputato (colonna `deputy_name`) accanto all'URI.
- `groupUri`: URI del gruppo (opzionale; senza → tutti i gruppi)
- `legislature`: numero legislatura

### `senato-groups`
Gruppi parlamentari Senato con sigla e numero di componenti distinti (`members`). Parallelo di `groups` per il Senato.
- `legislature`: numero legislatura (es. 19)
- `asOf`: data di riferimento YYYY-MM-DD (default: oggi). Per legislature passate usare l'ultima data della legislatura (es. `2022-10-12` per la XVIII).
- Output: `uri`, `title`, `acronym`, `members`, `html_url`

### `senator-group-members`
Composizione di un gruppo Senato (lista nominativa, con il nome del senatore nella colonna `senator_name`).
- `groupUri`: URI del gruppo (da `senato-groups`)
- `legislature`: numero legislatura
- `asOf`: data di riferimento (default: oggi)

### `roles`
Incarichi parlamentari Camera.
- `legislature`: numero legislatura

### `sessions`
Sedute Camera.
- `legislature`: numero legislatura

### `committees`
Commissioni Senato.
- `legislature`: numero legislatura

## Contesto istituzionale

### `legislatures`
Tutte le legislature dal 1848 a oggi.

### `governments`
Tutti i governi italiani.

### `gov-members`
Membri del governo.
- `legislature`: numero legislatura
- `name`: filtra per nome

## Analisi

### `group-rank`
Classifica i gruppi Camera per AIC o DDL (via gruppo del primo firmatario), con conteggio, membri e media per membro.
- `rankBy` (required): `aic` | `bills`
- `legislature`: default 19
- `order`: desc | asc
- Colonna `count_per_member`: utile per confrontare gruppi di dimensioni diverse.

Nota: i tool lista `bills`/`aic`/`votes`/`senato-votes` accettano `countOnly` (solo il totale, colonna count).

### `rank`
Ranking parlamentari per attività.
- `rankBy` (required): `aic-primo-firmatario` | `aic-cofirmatario` | `bills-primo-firmatario` | `bills-cofirmatario` | `speeches` | `sindacato-ispettivo` | `ddl-senato`
- `legislature`: numero legislatura
- `limit`: max risultati

### `sparql`
Query SPARQL libera sugli endpoint Camera o Senato.
- `query` (required): query SPARQL
- `endpoint` (required): `camera` | `senato`
