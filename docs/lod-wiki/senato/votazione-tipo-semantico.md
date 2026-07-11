---
type: Gotcha
title: Tipo semantico di una votazione (finale/fiducia) NON in osr:tipoVotazione, solo nel label
description: osr:tipoVotazione è la modalità di voto (elettronica/nominale/segreta), non il tipo semantico. "Votazione finale" e "questione di fiducia" vivono solo nel rdfs:label.
resource: http://dati.senato.it/osr/Votazione
tags: [senato, osr, votazione, tipoVotazione, fiducia, finale, label]
timestamp: 2026-07-11
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

Nota Virtuoso: il literal di `osr:tipoVotazione` è tipizzato `xsd:string`, quindi il match con un literal **semplice** (`osr:tipoVotazione "elettronica"`) torna **vuoto** — è un problema di uguaglianza di *term* (`"elettronica"` ≠ `"elettronica"^^xsd:string`). Due forme che funzionano (verificato leg. 19: 7821 vs 0): tipizzare il literal nel triple pattern — `osr:tipoVotazione "elettronica"^^xsd:string` — oppure filtrare con `FILTER(STR(?t) = "elettronica")` (cfr. [[trappole]]).

# Dettaglio nominativo per tipo (roll call): la scelta individuale c'è solo per i voti di merito

`senato-vote-detail` restituisce le righe per-senatore **per tutte le modalità di voto**, non solo per `nominale con appello` (verificato 2026-07-11, leg. 19). La differenza vera non è "c'è / non c'è il dettaglio", ma **cosa** contiene il dettaglio: la scelta espressa (Favorevole, Contrario, Astenuto) oppure solo le presenze (Presente non votante, In congedo/missione).

| `osr:tipoVotazione` | righe per-senatore | scelta espressa (Fav./Contr./Astenuto)? |
|---|---|---|
| `elettronica` | sì | **sì** (voto di merito) |
| `nominale con appello` | sì | **sì** (voto di merito) |
| `controprova` | sì | **sì** (voto di merito) |
| `verifica numero legale` | sì | **NO** — solo presenze (conteggio del quorum) |
| `segreta` | sì | **NO** — solo presenze (voto segreto) |

Prova sul voto segreto `19-155-52`: 15 `Presente non votante` + 21 `In congedo/missione`, **zero** scelte espresse (né Favorevole, né Contrario, né Astenuto). È costituzionalmente corretto: il voto segreto registra chi era presente, non come ha votato. Lo stesso vale per la `verifica numero legale`, che è un semplice conteggio del numero legale, non un voto su un provvedimento.

**Regola pratica per l'orchestratore/LLM:** la domanda "come ha votato il singolo senatore X?" è rispondibile solo per i voti di **merito** (`elettronica`, `nominale con appello`, `controprova`). Su `segreta` e `verifica numero legale` **non** dedurre né inventare il sì/no: la scelta non esiste nel dato, ci sono solo le presenze. Non serve un campo booleano dedicato (`roll_call_available`): il segnale è **derivabile** dal campo `type` già esposto da `senato-votes` — la scelta individuale c'è quando `type ∉ {"segreta", "verifica numero legale"}`.

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

# Il tema del decreto spesso NON è nel label (mitigato da v0.20.0)

Molte votazioni hanno label **generico** senza tema: `Votazione finale`, `Em. 14.6, Camusso e altri`, `Votazione questione pregiudiziale`. Il tema del provvedimento (es. "caccia", "piano casa", "bilancio") **non** è nel label della votazione — vive nel titolo del DDL collegato (`osr:oggetto`/`osr:relativoA`/`osr:titolo`). Prima della v0.20.0 una ricerca `--keyword caccia` su `senato-votes` tornava **vuota** anche se il voto esisteva (label `Votazione finale`).

Dalla **v0.20.0** `--keyword` matcha anche il titolo del DDL collegato, in OR col label: `--keyword bilancio` restituisce le votazioni della legge di bilancio (es. `ddl/59654`) che con il solo label-match erano invisibili. `BOUND()` sul titolo evita che le fiducie (prive di `osr:oggetto`) facciano fallire l'intero OR. Limite residuo: se il voto non ha `osr:oggetto` collegato (alcune fiducie, mozioni) il tema non è raggiungibile per keyword — restano validi i passi sotto.

1. Trova il voto per data (`--date-from/--date-to`) o per DDL (`--ddl-uri`).
2. Leggi il `ddl_uri` (o risolvilo dal `bill_number` nel label, cfr. [[votazione-ddl-link]]).
3. Cerca il tema sul DDL (`bill-progress --keyword` o `bill-signatories`).

# Implementato

Dalla v0.18.0 il tool `senato-votes` espone i filtri label-based:
- `--confidence-vote true|false` → `CONTAINS "fiducia" && !CONTAINS "sfiducia"`
- `--final-vote true|false` → `CONTAINS "votazione finale"`
- `--keyword <term>` → `CONTAINS` sul label del voto **e** (da v0.20.0) sul titolo del DDL collegato (`osr:oggetto`/`osr:relativoA`/`osr:titolo`), in OR

Simmetria con la Camera, dove `votes` ha `--confidence-vote` (campo strutturato `ocd:richiestaFiducia`) e `--keyword` (su label/title/description). Al Senato manca il campo strutturato per la fiducia, quindi il filtro è testuale sul label.

# Citations

[1] Enumerazione `osr:tipoVotazione` leg. 19, 2026-07-07: elettronica 7821 / verifica numero legale 83 / controprova 70 / nominale con appello 57 / segreta 13.
[2] Gap analysis news-driven `docs/news-agent/2026-07-07_13-47.md` (gap #2): `senato-votes` senza filtri chiave per fiducia/finale/keyword.
