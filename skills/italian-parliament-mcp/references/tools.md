# Tool Reference — italianparliament-mcp

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
Carriera unificata di una persona: mandati da deputato (per legislatura) + incarichi di governo + link Wikidata. Risolve doppio incarico parlamento+governo e carriera multi-legislatura.
- `uri` (required): URI deputato o persona (Camera)
- Camera+governo affidabile; Camera↔Senato non nei dati (solo via nome + data nascita).

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
- `keyword`: cerca nel testo (label/titolo/description), es. un tema
- `limit`: max risultati

### `votes`
Votazioni Camera.
- `legislature`: numero legislatura
- `limit`: max risultati

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
Iter DDL al Senato.
- `legislature`: numero legislatura

### `bill-signatories`
Firmatari di un DDL Senato.
- `ddlUri` (required): URI del DDL

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

### `senato-vote-detail`
Voto del singolo senatore in una votazione.
- `voteUri` (required): URI della votazione (da `senato-votes`)
- `voteType`: filtro (Favorevole/Contrario/Astenuto/Presente non votante/In congedo/missione)
- Il gruppo non è incluso: incrociare con `senator-group-members`.

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
Gruppi parlamentari Camera.
- `legislature`: numero legislatura

### `group-members`
Composizione di un gruppo Camera.
- `groupUri` (required): URI del gruppo
- `legislature`: numero legislatura

### `senator-group-members`
Composizione di un gruppo Senato.
- `groupName` (required): nome o parte del nome del gruppo
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
