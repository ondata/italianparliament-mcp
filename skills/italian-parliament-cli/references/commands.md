# Command Reference — italianparliament CLI

## Syntax

```
italianparliament <resource> <action> [options]
```

Common options available on most commands:
- `--legislature <n>`: numero legislatura (default: 19)
- `--limit <n>`: max risultati
- `--format csv|jsonl`: formato output (default: csv)

---

## Scoperta (orchestrazione)

Comandi per orientarsi senza conoscere a memoria la superficie della CLI:

```bash
italianparliament guide                  # stampa il flusso tipico (scoperta → URI → dettaglio)
italianparliament which "testo ddl"      # trova il comando per una capacità (exit 0 = match, 2 = nessun match)
italianparliament which votazione --json # output ranked [{command, score, description}]
italianparliament <comando> --help       # opzioni ed esempi del comando
```

Note utili:
- `bills`/`aic`/`votes`/`senato-votes` accettano `--count-only` (solo il totale).
- Su un valore enum errato (`--vote-type`, `--rank-by`, ...) l'errore elenca i valori validi.
- **`html_url`**: i tool su persone e atti/DDL espongono una colonna `html_url` con il link alla scheda istituzionale su `camera.it`/`senato.it`, accanto all'URI SPARQL.
- **`rss_url`**: i tool sui DDL del Senato (`amendments`, `senato-votes`, `bill-progress`) espongono `rss_url`, il feed RSS con l'iter dettagliato (fasi, sedute, voto finale).

---

## Parlamentari

### `deputies list`
Lista deputati Camera.
```bash
italianparliament deputies list --legislature 19 --limit 100 --format csv
```

### `senators list`
Lista senatori.
```bash
italianparliament senators list --legislature 19
```

### `search find`
Cerca un parlamentare per nome.
```bash
italianparliament search find --name "mario rossi" --chamber both
```
Options: `--chamber camera|senato|both`

### `deputy show`
Scheda di un deputato.
```bash
italianparliament deputy show --uri <uri>
```

### `senator show`
Scheda di un senatore.
```bash
italianparliament senator show --uri <uri>
```

### `person-career show`
Carriera unificata: mandati per legislatura + appartenenza ai gruppi (cronologica, con date) + incarichi di governo + link Wikidata.
```bash
italianparliament person-career show --uri http://dati.camera.it/ocd/deputato.rdf/d301551_15
```

### `people resolve`
Risolve in batch una lista di URI persona (anche misti Camera + Senato) nei nomi, con una query per endpoint. Utile per dare i nominativi agli URI "nudi" dei tool relazionali senza una chiamata `deputy`/`senator` per ciascuno. Output: `uri`, `first_name`, `last_name`, `label`, `chamber`, `html_url`.
```bash
italianparliament people resolve --uris http://dati.senato.it/senatore/32,http://dati.camera.it/ocd/deputato.rdf/d308917_19
italianparliament people resolve --uris http://dati.senato.it/senatore/32 --format jsonl
```

---

## Attività legislativa — Camera

### `bills list`
```bash
italianparliament bills list --legislature 19 --format csv
```

### `bill show`
```bash
italianparliament bill show --uri <uri>
```

### `aic list`
Atti di indirizzo e controllo. `--keyword` cerca nel testo (label/titolo/description, a confini di parola: "CETA" non matcha "Acetamiprid"). `--type` filtra per tipo (match parziale su `dc:type`, con fallback sul label — per la leg. 19 "a risposta immediata"/question time non è distinto da "a risposta orale" nel `dc:type`, la differenza è solo testuale).
```bash
italianparliament aic list --legislature 19 --limit 200 --format csv
italianparliament aic list --legislature 19 --keyword xylella
italianparliament aic list --legislature 19 --type immediata --limit 20
italianparliament aic list --deputy-uri <uri>
```

### `votes list`
```bash
italianparliament votes list --legislature 19 --format csv
```
Colonne `bill_number` (numero atto dalla descrizione, es. `2920-A`) e `bill_uri` (URI atto, popolato anche senza `rif_attoCamera` risolvendo il numero via `dc:identifier`).

### `vote-detail show`
Come ha votato ogni deputato.
```bash
italianparliament vote-detail show --vote-uri <vote-uri> --format csv
```

### `speeches list`
Interventi in aula (disponibili da leg. 17).
```bash
italianparliament speeches list --legislature 19
```

---

## Attività legislativa — Senato

### `bill-progress list`
Iter di un disegno di legge. **Senato** (senza `--uri`): lista DDL con stato corrente, filtrabile per legislatura, `--keyword`, `--date-from`/`--date-to`, o per singolo DDL con `--ddl-uri`. **Camera** (con `--uri <atto Camera>`): timeline completa di tutti gli stati attraversati, in ordine cronologico. Stesse colonne in entrambi i casi.
```bash
italianparliament bill-progress list --legislature 19
italianparliament bill-progress list --ddl-uri http://dati.senato.it/ddl/25597
italianparliament bill-progress list --uri http://dati.camera.it/ocd/attocamera.rdf/ac19_2822
```

### `bill-signatories show`
```bash
italianparliament bill-signatories show --ddl-uri <ddl-uri>
```

### `bill-rapporteurs list`
Relatori di un DDL, **Camera o Senato** (riconosciuto dall'URI): nome, tipo (Relatore / f.f.), commissione/organo, data.
```bash
italianparliament bill-rapporteurs list --bill-uri http://dati.camera.it/ocd/attocamera.rdf/ac19_2807
italianparliament bill-rapporteurs list --bill-uri http://dati.senato.it/ddl/59313
```

### `amendments list`
Emendamenti Senato; `--ddl-uri` per gli emendamenti a un DDL specifico.
```bash
italianparliament amendments list --legislature 19
italianparliament amendments list --ddl-uri http://dati.senato.it/ddl/56260 --format jsonl
```

### `sindacato-ispettivo list`
Atti di sindacato ispettivo Senato.
```bash
italianparliament sindacato-ispettivo list --legislature 19
italianparliament sindacato-ispettivo list --legislature 19 --senator-uri <uri>
```

### `documents list`
```bash
italianparliament documents list --legislature 19
```

### `senato-votes list`
Votazioni d'Assemblea del Senato con esito e contatori.
```bash
italianparliament senato-votes list --legislature 19 --limit 20
italianparliament senato-votes list --ddl-uri http://dati.senato.it/ddl/58039 --format jsonl
italianparliament senato-votes list --date-from 2026-01-01 --date-to 2026-03-31
```
Colonne `bill_number` (numero DDL dal label, es. `562-B`) e `ddl_uri` (URI DDL, popolato anche per le fiducie prive di `osr:oggetto` risolvendo il numero via `osr:fase`).

### `senato-vote-detail show`
Voto del singolo senatore in una votazione (URI da `senato-votes`); include il gruppo alla data del voto (`group_label`) → voto per gruppo.
```bash
italianparliament senato-vote-detail show --vote-uri http://dati.senato.it/votazione/19-167-42
italianparliament senato-vote-detail show --vote-uri http://dati.senato.it/votazione/19-167-42 --vote-type Contrario
```

### `committee-sessions list`
Attività delle commissioni. Due modalità:
- **iter di un DDL** (`--ddl-uri`, Senato): sedute in cui il provvedimento è stato trattato.
- **segui una commissione** (`--committee-uri` o `--committee-name` + `--chamber`): tutte le sedute di una commissione, filtrabili per data. Camera: data + URL del bollettino; Senato: data, tipo seduta, numero interventi.

```bash
# iter di un DDL
italianparliament committee-sessions list --ddl-uri http://dati.senato.it/ddl/56260
# segui una commissione per nome
italianparliament committee-sessions list --committee-name femminicidio --chamber camera
italianparliament committee-sessions list --committee-name giustizia --chamber senato --date-from 2026-05-01 --date-to 2026-05-31
# o per URI diretto
italianparliament committee-sessions list --committee-uri http://dati.camera.it/ocd/organo.rdf/o19_3941 --chamber camera
```

> Le commissioni bicamerali (es. inchiesta femminicidio) hanno attività esposta solo dalla Camera.

### `bill-text links` (Camera + Senato)
Link diretti al testo di un DDL, con tipo risorsa (`format`) e se serve un browser (`auth`).
```bash
italianparliament bill-text links --uri http://dati.senato.it/ddl/56784 --format jsonl
italianparliament bill-text links --uri http://dati.camera.it/ocd/attocamera.rdf/ac19_1234
```

### `bill-text fetch` (Senato, locale)
Scarica il testo di un DDL Senato e lo converte in markdown. Apre un browser reale (`agent-browser`) per superare l'AWS WAF di `www.senato.it`, scarica il PDF e lo converte con `lit`. Richiede `agent-browser` e `lit` installati.
```bash
italianparliament bill-text fetch --did 56784                       # primo testo
italianparliament bill-text fetch --did 56784 --which Relazione     # testo specifico
italianparliament bill-text fetch --did 56784 --all                 # tutti i testi
italianparliament bill-text fetch --did 56784 --fascicolo --out fascicolo.md
```
`did` = il numero `<N>` nell'URI Senato `dati.senato.it/ddl/<N>`.

---

## Organizzazione parlamentare

### `groups list`
Gruppi parlamentari Camera con sigla e URI.
```bash
italianparliament groups list --legislature 19
```

### `group-members list`
Composizione di un gruppo Camera.
```bash
italianparliament group-members list --group-uri <uri> --legislature 19 --format csv
```

### `senato-groups list`
Gruppi parlamentari Senato con sigla e numero di componenti distinti. Parallelo di `groups list` per il Senato.
```bash
italianparliament senato-groups list --legislature 19
italianparliament senato-groups list --legislature 18 --as-of 2022-10-12
italianparliament senato-groups list --legislature 18 --as-of 2022-10-12 --format jsonl
```
`--as-of` YYYY-MM-DD: data di riferimento per le adesioni attive (default: oggi). Per legislature passate usare l'ultima data della legislatura.
Output: `uri`, `title`, `acronym`, `members`, `html_url`

### `senator-group-members list`
Composizione nominativa di un gruppo Senato (URI da `senato-groups list`).
```bash
italianparliament senator-group-members list --group-uri <uri> --legislature 19
```

### `roles list`
```bash
italianparliament roles list --legislature 19
```

### `sessions list`
```bash
italianparliament sessions list --legislature 19
```

### `committees list` (Camera + Senato)
Commissioni parlamentari con categoria (permanente/speciale/inchiesta/comitato) e numero di sedute.
```bash
italianparliament committees list --legislature 19
italianparliament committees list --chamber camera --legislature 19
italianparliament committees list --chamber senato
```

---

## Contesto istituzionale

### `legislatures list`
```bash
italianparliament legislatures list
```

### `governments list`
```bash
italianparliament governments list
```

### `gov-members list`
```bash
italianparliament gov-members list --legislature 19
italianparliament gov-members list --name meloni
```

---

## Analisi

### `group-rank list`
Classifica i gruppi Camera per AIC/DDL con media per membro.
```bash
italianparliament group-rank list --rank-by aic --legislature 19
italianparliament group-rank list --rank-by bills --legislature 19 --limit 10
```
Nota: `bills`/`aic`/`votes`/`senato-votes` accettano `--count-only` (solo il totale).

### `rank list`
Ranking parlamentari per attività.
```bash
italianparliament rank list --rank-by aic-primo-firmatario --legislature 19 --limit 20 --format csv
```
`--rank-by` values: `aic-primo-firmatario` | `aic-cofirmatario` | `bills-primo-firmatario` | `bills-cofirmatario` | `speeches` | `sindacato-ispettivo` | `ddl-senato`

### `sparql query`
Query SPARQL libera. Funziona anche senza il sotto-comando `query` (es. `sparql --endpoint ...`).
```bash
italianparliament sparql query --endpoint camera --query "SELECT ?s WHERE { ?s a <...> } LIMIT 10"
italianparliament sparql --endpoint senato --query "SELECT ?s WHERE { ?s ?p ?o } LIMIT 10"
```
