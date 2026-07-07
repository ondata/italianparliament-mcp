---
type: Gotcha
title: Tipo semantico di una votazione (finale/fiducia) NON in osr:tipoVotazione, solo nel label
description: osr:tipoVotazione è la modalità di voto (elettronica/nominale/segreta), non il tipo semantico. "Votazione finale" e "questione di fiducia" vivono solo nel rdfs:label.
resource: http://dati.senato.it/osr/Votazione
tags: [senato, osr, votazione, tipoVotazione, fiducia, finale, label]
timestamp: 2026-07-07
---

# Trappola

`osr:tipoVotazione` **non** è il tipo semantico della votazione (finale / fiducia / articolo / emendamento). È la **modalità di voto**. Valori distinti su leg. 19 (enumerazione, 2026-07-07):

| `osr:tipoVotazione` | n. voti |
|---|---|
| `elettronica` | 7821 |
| `verifica numero legale` | 83 |
| `controprova` | 70 |
| `nominale con appello` | 57 |
| `segreta` | 13 |

Filtrare `--type` o `osr:tipoVotazione` per "finale" o "fiducia" restituisce **0 righe** — non perché il dato manchi, ma perché è la proprietà sbagliata.

# Dove vive il tipo semantico

Nel **`rdfs:label`** della votazione, come testo. Pattern verificati (leg. 19):

- **Votazione finale** → label contiene `Votazione finale` (es. `Votazione finale`, `DDL n. 924-bis. Votazione finale`, `Mozione 1-00044, Malan e altri. Votazione finale`).
- **Fiducia governativa** → label contiene `fiducia` nelle forme `Votazione questione di fiducia`, `Questione di fiducia ...`, `Votazione questione fiducia` (senza "di"). Il DDL è citato nel numero (`Disegno di legge n. 1933. Votazione questione di fiducia.`).
- **Mozione di sfiducia** → label contiene `sfiducia` (es. `Mozione n. 62, Patuanelli e altri, di sfiducia individuale nei confronti del Ministro del turismo`). **Attenzione:** "sfiducia" contiene la stringa "fiducia" → un filtro "CONTAINS fiducia" catturerebbe anche le mozioni di sfiducia. Va escluso esplicitamente con `!CONTAINS(..., "sfiducia")`.

# Query Template

Fiducie governative (esclude sfiducia):

```sparql
SELECT ?v ?label WHERE {
  ?v a osr:Votazione ; osr:legislatura <LEG> ; rdfs:label ?label .
  FILTER(CONTAINS(LCASE(STR(?label)), "fiducia")
         && !CONTAINS(LCASE(STR(?label)), "sfiducia"))
}
```

Votazioni finali:

```sparql
FILTER(CONTAINS(LCASE(STR(?label)), "votazione finale"))
```

Caveat Virtuoso: `STR()` obbligatorio sul literal tipizzato (cfr. [[trappole]]); `LCASE` per case-insensitive.

# Limite: il tema del decreto spesso NON è nel label

Molte votazioni hanno label **generico** senza tema: `Votazione finale`, `Em. 14.6, Camusso e altri`, `Votazione questione pregiudiziale`. Il tema del provvedimento (es. "caccia", "piano casa", "bilancio") **non** è nel label della votazione — vive nel `rdfs:label`/titolo del DDL collegato. Conseguenza: una ricerca `--keyword caccia` su `senato-votes` torna **vuota** anche se il voto Caccia esiste (label `Votazione finale`, ddl collegati `ddl/59566` ecc.). Per ricostruire il tema:

1. Trova il voto per data (`--date-from/--date-to`) o per DDL (`--ddl-uri`).
2. Leggi il `ddl_uri` (o risolvilo dal `bill_number` nel label, cfr. [[votazione-ddl-link]]).
3. Cerca il tema sul DDL (`bill-progress --keyword` o `bill-signatories`).

Il caso "bilancio" funziona con `--keyword` solo perché alcuni voti interni del Senato hanno label `Progetto di bilancio interno del Senato per l'anno finanziario ...` — non è il voto sul DDL Bilancio dello Stato (che è Camera).

# Implementato

Dalla v0.18.0 il tool `senato-votes` espone i filtri label-based:
- `--confidence-vote true|false` → `CONTAINS "fiducia" && !CONTAINS "sfiducia"`
- `--final-vote true|false` → `CONTAINS "votazione finale"`
- `--keyword <term>` → `CONTAINS` sul label

Simmetria con la Camera, dove `votes` ha `--confidence-vote` (campo strutturato `ocd:richiestaFiducia`) e `--keyword` (su label/title/description). Al Senato manca il campo strutturato per la fiducia, quindi il filtro è testuale sul label.

# Citations

[1] Enumerazione `osr:tipoVotazione` leg. 19, 2026-07-07: elettronica 7821 / verifica numero legale 83 / controprova 70 / nominale con appello 57 / segreta 13.
[2] Gap analysis news-driven `docs/news-agent/2026-07-07_13-47.md` (gap #2): `senato-votes` senza filtri chiave per fiducia/finale/keyword.
