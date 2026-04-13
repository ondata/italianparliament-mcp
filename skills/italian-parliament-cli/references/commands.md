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
