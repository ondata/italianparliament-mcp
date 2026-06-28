---
name: italian-parliament-mcp
description: Query Italian Parliament open data (Camera dei Deputati and Senato della Repubblica) via MCP tools. Use when a user asks about Italian MPs, bills, votes, speeches, parliamentary groups, government members, or oversight acts. Designed for conversational use in Claude Desktop or Claude Code with the italianparliament-mcp server configured.
compatibility: Requires italianparliament-mcp MCP server configured in Claude Desktop or Claude Code
metadata:
  author: aborruso
  version: "1.1"
---

# Italian Parliament MCP Skill

Query Italian Parliament open data through the `italianparliament-mcp` MCP server.

## When to use

Activate this skill when the user asks questions like:
- "Quanti deputati ha il gruppo FDI?"
- "Chi ha fatto più interrogazioni in questa legislatura?"
- "Come ha votato X nella seduta Y?"
- "Quali leggi ha proposto il governo Meloni?"

## Available tools

See [tool reference](references/tools.md) for the full list with parameters and examples.

## Workflow

### 1. Identify the right tool

| User intent | Tool |
|---|---|
| Cerca un parlamentare per nome | `search` |
| Scheda deputato | `deputy` |
| Scheda senatore | `senator` |
| Carriera persona (legislature + governo) | `person-career` |
| Lista deputati/senatori | `deputies` / `senators` |
| Gruppi parlamentari Camera | `groups` / `group-members` |
| Gruppi parlamentari Senato | `senator-group-members` |
| Disegni di legge Camera | `bills` / `bill` |
| Iter DDL Senato | `bill-progress` / `bill-signatories` |
| Testo integrale di un DDL (articolato) | `bill-text` |
| DDL di un parlamentare come primo firmatario | `member-bills` |
| Relatori di un DDL (Camera o Senato) | `bill-rapporteurs` |
| Membri di una commissione Senato | `committee-members` |
| Sedute di commissione su un DDL Senato | `committee-sessions` |
| Interrogazioni, interpellanze, mozioni | `aic` (Camera) / `sindacato-ispettivo` (Senato) |
| Votazioni Camera | `votes` / `vote-detail` |
| Votazioni Senato | `senato-votes` / `senato-vote-detail` |
| Interventi in aula | `speeches` |
| Emendamenti Senato | `amendments` |
| Documenti parlamentari Senato | `documents` |
| Governi e ministri | `governments` / `gov-members` |
| Legislature | `legislatures` |
| Commissioni Senato | `committees` |
| Incarichi parlamentari Camera | `roles` |
| Sedute Camera | `sessions` |
| Query SPARQL libera | `sparql` |
| Ranking attività parlamentare | `rank` (persone) / `group-rank` (gruppi) |

### 2. Default legislature

The current legislature is **19** (XIX). Use it as default when the user does not specify.

### 3. Handle ambiguous names

Use `search` first to resolve a name to a URI before calling `deputy` or `senator`.

### 4. Output format

Tools return CSV or JSONL. For display, format results as markdown tables. For analysis, summarize key figures.

## Common patterns

**Find and profile an MP**
1. `search` with the name → get URI
2. `deputy` or `senator` with the URI

**Ranking by activity**
Use `rank` with `rankBy`: `aic-primo-firmatario`, `aic-cofirmatario`, `bills-primo-firmatario`, `bills-cofirmatario`, `speeches`, `sindacato-ispettivo`, `ddl-senato`.

**Group composition**
1. `groups` → get group URI
2. `group-members` with the URI and legislature

**Who voted how (Camera)**
1. `votes` → get vote URI
2. `vote-detail` with the URI

**Who voted how (Senato)**
1. `senato-votes` → get vote URI (filter by `ddlUri` for votes on a bill, or by date)
2. `senato-vote-detail` with the URI. Each row includes the senator's `group_label` at the vote date, so the group breakdown comes directly (no need to cross-reference).

> **Confidence votes caveat:** `senato-votes list --ddlUri <uri>` does **not** return a *fiducia* — the `ddlUri` field is empty for confidence votes; the bill link is only in the `label` text (e.g. "Disegno di legge n.1933. Votazione questione di fiducia."). Filter by **seduta date** (`--dateFrom`/`--dateTo`), then match the DDL via `label`. Also verify `ddlUri` on any "final" vote found by date: it may belong to a different act (unified text).

**Read the actual text of a bill (articolato)**

The full text is **not** in the SPARQL data — only metadata. `bill-text` returns the direct links to the text, each with a `format` (html/pdf/urn) and an `auth` field:
1. `bill-text` with the bill URI (`http://dati.senato.it/ddl/<N>` or a Camera atto URI) → list of resources.
2. `auth=none` (Camera): the orchestrator can fetch the page directly.
3. `auth=browser` (Senato): `www.senato.it` is behind AWS WAF, so a plain fetch returns HTTP 202. Either let a browser-capable orchestrator open the URL, or use the local CLI `italianparliament bill-text fetch --did <N>` which drives a real browser to clear the WAF, downloads the PDF, and converts it to markdown with `lit`. Use `--which "Relazione"` to pick a specific text, `--all` for every text, `--fascicolo` for the full iter dossier.

The `did` is the number `<N>` in the Senato DDL URI (`dati.senato.it/ddl/<N>`), same as `?did=` in the scheda URL.
