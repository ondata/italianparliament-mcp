---
name: italian-parliament-cli
description: Query Italian Parliament open data from the command line using the italianparliament CLI. Use when a user wants to run shell commands, build pipelines, export CSV/JSONL, or script parliamentary data analysis. Covers all subcommands for deputies, senators, bills, votes, speeches, groups, and more.
compatibility: Requires italianparliament npm package installed globally or via npx
metadata:
  author: aborruso
  version: "1.0"
---

# Italian Parliament CLI Skill

Use the `italianparliament` CLI to query Camera dei Deputati and Senato della Repubblica open data from the shell.

## Installation

```bash
npm install -g italianparliament
# or without installing:
npx italianparliament <resource> <action> [options]
```

## General syntax

```
italianparliament <resource> <action> [--option value ...]
```

Default output: JSONL. Add `--format csv` for CSV.

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
italianparliament search find --query meloni
```

**Top 20 MPs by interrogations (AIC)**
```bash
italianparliament rank list --rankBy aic-primo-firmatario --legislature 19 --limit 20
```

**Who voted against in a session**
```bash
italianparliament vote-detail show --uri <vote-uri> --format csv | \
  python3 -c "import sys,csv; [print(r) for r in csv.DictReader(sys.stdin) if r['voto']=='contro']"
```

**Government members filtered by name**
```bash
italianparliament gov-members list --name draghi
```

**Pipeline: group rank by AIC rate**
1. Get group members count with `group-members`
2. Get AIC count with `rank`
3. Join and compute ratio with `duckdb` or `mlr`

## Output formats

| Format | Flag | Use |
|---|---|---|
| JSONL (default) | — | `jq`, streaming |
| CSV | `--format csv` | spreadsheets, `duckdb`, `mlr` |

## Tips

- Pipe CSV into `duckdb -c "SELECT ... FROM read_csv_auto('/dev/stdin')"` for SQL analysis
- Use `--limit` to cap results during exploration
- URIs from `list` commands can be passed to `show` commands
