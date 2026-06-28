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
Atti di indirizzo e controllo (interrogazioni, interpellanze, mozioni).
- `legislature`: numero legislatura
- `deputyUri`: filtra per deputato
- `limit`: max risultati

### `votes`
Votazioni Camera.
- `legislature`: numero legislatura
- `limit`: max risultati

### `vote-detail`
Come ha votato ogni deputato in una votazione.
- `uri` (required): URI della votazione

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
- `uri` (required): URI del DDL

### `amendments`
Emendamenti Senato.
- `legislature`: numero legislatura

### `sindacato-ispettivo`
Atti di sindacato ispettivo Senato (interrogazioni, interpellanze).
- `legislature`: numero legislatura (integer, es. 19)
- `senatorUri`: filtra per senatore

### `documents`
Documenti parlamentari Senato.
- `legislature`: numero legislatura

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

### `rank`
Ranking parlamentari per attività.
- `rankBy` (required): `aic-primo-firmatario` | `aic-co-firmatario` | `bills-primo-firmatario` | `bills-co-firmatario` | `speeches`
- `legislature`: numero legislatura
- `limit`: max risultati

### `sparql`
Query SPARQL libera sugli endpoint Camera o Senato.
- `query` (required): query SPARQL
- `endpoint` (required): `camera` | `senato`
