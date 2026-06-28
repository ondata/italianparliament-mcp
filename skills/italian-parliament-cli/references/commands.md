# Command Reference — italianparliament CLI

## Syntax

```
italianparliament <resource> <action> [options]
```

Common options available on most commands:
- `--legislature <n>`: numero legislatura (default: 19)
- `--limit <n>`: max risultati
- `--format csv|jsonl`: formato output (default: jsonl)

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
italianparliament search find --query "mario rossi" --chamber both
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
Atti di indirizzo e controllo.
```bash
italianparliament aic list --legislature 19 --limit 200 --format csv
italianparliament aic list --deputyUri <uri>
```

### `votes list`
```bash
italianparliament votes list --legislature 19 --format csv
```

### `vote-detail show`
Come ha votato ogni deputato.
```bash
italianparliament vote-detail show --uri <vote-uri> --format csv
```

### `speeches list`
Interventi in aula (disponibili da leg. 17).
```bash
italianparliament speeches list --legislature 19 --deputyUri <uri>
```

---

## Attività legislativa — Senato

### `bill-progress list`
```bash
italianparliament bill-progress list --legislature 19
```

### `bill-signatories show`
```bash
italianparliament bill-signatories show --uri <ddl-uri>
```

### `amendments list`
```bash
italianparliament amendments list --legislature 19
```

### `sindacato-ispettivo list`
Atti di sindacato ispettivo Senato.
```bash
italianparliament sindacato-ispettivo list --legislature 19
italianparliament sindacato-ispettivo list --legislature 19 --senatorUri <uri>
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

### `senato-vote-detail show`
Voto del singolo senatore in una votazione (URI da `senato-votes`).
```bash
italianparliament senato-vote-detail show --vote-uri http://dati.senato.it/votazione/19-167-42
italianparliament senato-vote-detail show --vote-uri http://dati.senato.it/votazione/19-167-42 --vote-type Contrario
```

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
```bash
italianparliament groups list --legislature 19
```

### `group-members list`
```bash
italianparliament group-members list --groupUri <uri> --legislature 19 --format csv
```

### `senator-group-members list`
```bash
italianparliament senator-group-members list --groupName "fratelli" --legislature 19
```

### `roles list`
```bash
italianparliament roles list --legislature 19
```

### `sessions list`
```bash
italianparliament sessions list --legislature 19
```

### `committees list`
```bash
italianparliament committees list --legislature 19
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

### `rank list`
Ranking parlamentari per attività.
```bash
italianparliament rank list --rankBy aic-primo-firmatario --legislature 19 --limit 20 --format csv
```
`--rankBy` values: `aic-primo-firmatario` | `aic-co-firmatario` | `bills-primo-firmatario` | `bills-co-firmatario` | `speeches`

### `sparql query`
Query SPARQL libera.
```bash
italianparliament sparql query --endpoint camera --query "SELECT ?s WHERE { ?s a <...> } LIMIT 10"
```
