---
name: italian-parliament-cli
description: Query Italian Parliament open data from the command line using the italianparliament CLI. Use when a user wants to run shell commands, build pipelines, export CSV/JSONL, or script parliamentary data analysis. Covers all subcommands for deputies, senators, bills, votes, speeches, groups, and more.
compatibility: Requires the @aborruso/italianparliament-mcp npm package installed globally (provides the `italianparliament` command)
metadata:
  author: aborruso
  version: "1.1"
---

# Italian Parliament CLI Skill

Use the `italianparliament` CLI to query Camera dei Deputati and Senato della Repubblica open data from the shell.

## Installation

```bash
npm install -g @aborruso/italianparliament-mcp
# provides the `italianparliament` command
```

## Discovery (orchestration)

```bash
italianparliament guide                  # typical workflow (discover → URI → detail)
italianparliament which "testo ddl"      # capability → command (exit 0 match, 2 no-match); add --json for ranked output
italianparliament <command> --help       # options + examples
```

## General syntax

```
italianparliament <resource> <action> [--option value ...]
```

Default output: **CSV**. Add `--format jsonl` for JSONL. List commands (`bills`, `aic`, `votes`, `senato-votes`) accept `--count-only`.

## Default legislature

Current legislature is **19**. Most commands default to 19 when `--legislature` is omitted.

## Command reference

See [full command reference](references/commands.md).

## Common patterns

**Count deputies in a legislature**
```bash
italianparliament deputies list --legislature 19 --format csv | wc -l
```

**Export all bills as CSV**
```bash
italianparliament bills list --legislature 19 --format csv > bills-19.csv
```

**Find an MP by name**
```bash
italianparliament search find --name meloni
```

**Top 20 MPs by interrogations (AIC)**
```bash
italianparliament rank list --rank-by aic-primo-firmatario --legislature 19 --limit 20
```

**Who voted against in a vote**
```bash
italianparliament vote-detail show --vote-uri <vote-uri> --format csv | \
  python3 -c "import sys,csv; [print(r) for r in csv.DictReader(sys.stdin) if r['vote']=='Contrario']"
```

**A person's full career (legislatures + government)**
```bash
italianparliament person-career show --uri http://dati.camera.it/ocd/deputato.rdf/d302103_19
```

**Government members filtered by name**
```bash
italianparliament gov-members list --name draghi
```

**Group ranking by AIC, also per member**
```bash
italianparliament group-rank list --rank-by aic --legislature 19   # colonna count_per_member già calcolata
```

## Output formats

| Format | Flag | Use |
|---|---|---|
| JSONL (default) | — | `jq`, streaming |
| CSV | `--format csv` | spreadsheets, `duckdb`, `mlr` |

## Tips

- Pipe CSV into `duckdb -c "SELECT ... FROM read_csv_auto('/dev/stdin')"` for SQL analysis
- Use `--limit` to cap results during exploration
- URIs from `list` commands can be passed to `show` commands
