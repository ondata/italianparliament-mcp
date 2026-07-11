---
name: italian-parliament-mcp
description: Query Italian Parliament open data (Camera dei Deputati and Senato della Repubblica) via MCP tools. Use when a user asks about Italian MPs, bills, votes, speeches, parliamentary groups, government members, or oversight acts. Designed for conversational use in Claude Desktop or Claude Code with the italianparliament-mcp server configured.
compatibility: Requires italianparliament-mcp MCP server configured in Claude Desktop or Claude Code
metadata:
  author: aborruso
  version: "1.3"
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
| Risolvi URI persona → nome (batch, Camera+Senato) | `people` |
| Lista deputati/senatori | `deputies` / `senators` |
| Gruppi parlamentari Camera | `groups` / `group-members` |
| Gruppi parlamentari Senato | `senato-groups` / `senator-group-members` |
| Disegni di legge Camera | `bills` / `bill` |
| Iter DDL (Camera con `uri`, Senato lista/`ddlUri`) | `bill-progress` |
| Firmatari di un DDL (Camera o Senato, `billUri`) | `bill-signatories` |
| Testo integrale di un DDL (articolato) | `bill-text` |
| DDL di un parlamentare come primo firmatario | `member-bills` |
| Relatori di un DDL (Camera o Senato) | `bill-rapporteurs` |
| Membri di una commissione Senato | `committee-members` |
| Sedute di commissione su un DDL Senato, o attività di una commissione (Camera+Senato) | `committee-sessions` |
| Audizioni delle commissioni (solo Camera) | `audizioni` |
| Interrogazioni, interpellanze, mozioni | `aic` (Camera) / `sindacato-ispettivo` (Senato) |
| Votazioni Camera | `votes` / `vote-detail` |
| Votazioni Senato | `senato-votes` / `senato-vote-detail` |
| Presenze/assenze aggregate di un parlamentare per legislatura | `attendance` (Camera) / `senato-attendance` (Senato) |
| Interventi in aula | `speeches` |
| Emendamenti Senato | `amendments` |
| Emendamenti Camera (proposte emendative) | `camera-amendments` |
| Documenti parlamentari Senato | `documents` |
| Governi e ministri | `governments` / `gov-members` |
| Legislature | `legislatures` |
| Commissioni Camera e Senato | `committees` |
| Incarichi parlamentari Camera | `roles` |
| Sedute Camera | `sessions` |
| Query SPARQL libera | `sparql` |
| Ranking attività parlamentare | `rank` (persone) / `group-rank` (gruppi) |

### 2. Default legislature

The current legislature is **19** (XIX). Use it as default when the user does not specify.

### 3. Handle ambiguous names

Use `search` first to resolve a name to a URI before calling `deputy` or `senator`.

### 4. Keyword search: use the formal term

`keyword` filters (on `bills`, `aic`, `committee-sessions`, …) do a **literal match** on the act's **formal title**, not a semantic search. Journalistic wording rarely matches the legal wording, so an empty result is almost always a lexical mismatch, **not** missing data.

- Use the **normative term**: `elezione` not `elettorale`; `disabilità`/`portatori di handicap` not `fuorisede`.
- Try **several synonyms and word roots** (e.g. `elett` → elettorale/elettori/elezione) before concluding. An empty result ≠ absent data — reformulate 2-3 times first.
- **`sindacato-ispettivo` (Senato) is not searchable by topic**: the Senato LOD exposes no subject/text for these acts (only type, number, date, signatories). Don't promise thematic searches on it.
- **`audizioni --committeeName` is literal**: it matches a substring against the official `rdfs:label` of the committee, which is the full formal name. "Covid" finds nothing — use "emergenza sanitaria" or "SARS-CoV-2". If a lookup returns empty, first inspect the actual labels with `committees list --chamber camera` + grep, then retry with the exact name.

### 5. Output format

Tools return CSV or JSONL. For display, format results as markdown tables. For analysis, summarize key figures.

## Common patterns

**Find and profile an MP**
1. `search` with the name → get URI
2. `deputy` or `senator` with the URI

**Ranking by activity**
Use `rank` with `rankBy`: `aic-primo-firmatario`, `aic-cofirmatario`, `bills-primo-firmatario`, `bills-cofirmatario`, `speeches`, `sindacato-ispettivo`, `ddl-senato`.

**Group composition (Camera)**
1. `groups` → get group URI
2. `group-members` with the URI and legislature

**Group composition (Senato)**
1. `senato-groups` → get list with sigla and member count, pick group URI
2. `senator-group-members` with the URI and legislature

**Who voted how (Camera)**
1. `votes` → get vote URI
2. `vote-detail` with the URI

**Who voted how (Senato)**
1. `senato-votes` → get vote URI (filter by `ddlUri` for votes on a bill, or by date)
2. `senato-vote-detail` with the URI. Each row includes the senator's `group_label` at the vote date, so the group breakdown comes directly (no need to cross-reference).
   - **When is the individual choice available?** Only for *merit* votes (`type` from `senato-votes` = `elettronica`, `nominale con appello`, `controprova`). For `segreta` (secret ballot) and `verifica numero legale` (quorum count) the source does **not** record the individual choice — `senato-vote-detail` returns only presence rows (`Presente non votante`, `In congedo/missione`), never an expressed choice (neither `Favorevole`, nor `Contrario`, nor `Astenuto`). That's correct: report "scelta individuale non registrata (voto segreto / verifica del numero legale)", don't infer the vote on those two types.

**Iter completo di una legge (Camera → Senato → pubblicazione)**
Non generare la timeline a memoria: costruiscila dai tool, passo per passo. `bill-progress` è la spina dorsale.
1. `bills` con `keyword` → individua l'atto Camera (URI, es. `ac19_2911`).
2. `bill-progress` con `uri` = atto Camera → iter con le **date reali** di ogni fase (assegnazione, esame in commissione, approvazione/trasmissione, approvazione definitiva, legge).
3. Aggancia il DDL Senato **per numero, mai per keyword**: dalla progress ricavi il numero Senato, poi `bill-progress` con `number` + `branch: S` → ottieni il `ddlUri` (es. `dati.senato.it/ddl/60201`). Evita di pescare un DDL omonimo diverso.
4. Voti: Senato `senato-votes` con `ddlUri` (+ caveat fiducia sotto). Camera `votes`: se `keyword`/numero non trova il **voto finale** o la **fiducia**, filtra per **intervallo di date** attorno alla trasmissione e leggi `vote-detail`, invece di dedurre il conteggio.
5. Contenuto: `bill-text` — il testo **non** è nei metadati; se non lo recuperi, non descrivere il contenuto della legge.

**Obiettivi giornalistici derivabili senza tool dedicato**
Alcune analisi ricorrenti (es. i **dissidenti/ribelli** che votano contro la linea del proprio gruppo) non hanno un tool dedicato ma si ricavano combinando i tool esistenti. Vedi [obiettivi giornalistici](references/obiettivi-giornalistici.md) per le ricette (ingredienti, passi, scelte analitiche, limiti).

> **Confidence votes:** at the source a *fiducia* has an empty `ddlUri` (the bill link is only in the `label` text, e.g. "Disegno di legge n.1933. Votazione questione di fiducia."), but `senato-votes list --ddlUri <uri>` **now includes it anyway**: it resolves the DDL's seduta dates and re-links the fiducia voted that day. Still verify `ddlUri` on any "final" vote found by date: it may belong to a different act (unified text).

**Read the actual text of a bill (articolato)**

The full text is **not** in the SPARQL data — only metadata. `bill-text` returns the direct links to the text, each with a `format` (html/pdf/urn) and an `auth` field:
1. `bill-text` with the bill URI (`http://dati.senato.it/ddl/<N>` or a Camera atto URI) → list of resources.
2. `auth=none` (Camera): the orchestrator can fetch the page directly.
3. `auth=browser` (Senato): `www.senato.it` is behind AWS WAF, so a plain fetch returns HTTP 202. Either let a browser-capable orchestrator open the URL, or use the local CLI `italianparliament bill-text fetch --did <N>` which drives a real browser to clear the WAF, downloads the PDF, and converts it to markdown with `lit`. Use `--which "Relazione"` to pick a specific text, `--all` for every text, `--fascicolo` for the full iter dossier.

The `did` is the number `<N>` in the Senato DDL URI (`dati.senato.it/ddl/<N>`), same as `?did=` in the scheda URL.

## Grounding (non inventare)

Ricostruendo iter, voti o schede il rischio è la **confabulazione su scheletro reale**: partire da un dato corretto e riempire i buchi con valori plausibili ma falsi (voti, date, firmatari, contenuti). I tool restituiscono il dato giusto; il difetto nasce da come li si combina e interpreta. Regole:

- **Riporta solo ciò che un tool ha restituito.** Se un voto, un firmatario, una data o un contenuto non è nell'output, dì "non disponibile" — non completare con numeri o nomi verosimili.
- **Aggancia gli atti per identificatore, non per keyword.** Il DDL Senato di un atto Camera va risolto per numero (`bill-progress` con `number` + `branch: S`), così non si confondono atti omonimi.
- **Distingui "Dato" (da tool) da "Sintesi/interpretazione" (tua).** Le deduzioni (es. entrata in vigore calcolata, sigle di gruppo espanse) vanno dichiarate come tali.
- **Cita per riga**: l'URL della votazione/atto/scheda accanto al dato, non un'unica fonte cumulativa in fondo.
