# PRD — URL human-readable per le entità (persone e atti)

Stato: bozza · 2026-06-29 · spec di dettaglio del **principio 1** di [../PRD.md](../PRD.md)

## Problema

I tool restituiscono gli **URI SPARQL** delle entità (es. `http://dati.senato.it/senatore/32`). Sono identificatori tecnici: non aprono una pagina leggibile da un essere umano. Un giornalista che riceve un risultato vuole poter cliccare e arrivare alla **scheda ufficiale** della persona o dell'atto sui siti istituzionali (camera.it / senato.it).

Oggi questo avviene **solo per gli atti**: i tool restituiscono già `html_url` per gli atti Camera e i DDL Senato. **Per le persone (deputati e senatori) manca.**

## Obiettivo

Restituire, **ove possibile e in aggiunta all'URI SPARQL**, l'**URL della scheda human-readable** dell'entità, **sia per le persone (deputati e senatori) sia per le leggi (atti Camera e DDL Senato)**.

Per le persone è una funzione nuova (oggi assente). Per le leggi `html_url` esiste già su alcuni tool: l'obiettivo è renderlo **consistente e presente su tutti** i tool che restituiscono atti/DDL.

Vincolo dichiarato dall'utente: garantire la correttezza **almeno per la legislatura corrente (19)**, perché i pattern URL dei siti istituzionali possono essere cambiati nel tempo e non è detto che valgano per le legislature passate.

## Principio generale (linea guida di progetto)

La regola non si limita a persone e atti: vale per **qualsiasi risorsa** che abbia una pagina pubblica corrispondente. Ogni volta che è possibile, l'output di un tool include un **URL human-readable** accanto all'identificatore tecnico. Motivo: il target è il giornalista, che usa quel link per (1) **verificare il dato alla fonte** e (2) **citarlo come link nel proprio articolo** — l'URI LOD non serve a nessuno dei due scopi. Si applica anche alle **fonti non-LOD** (scheda votazione, Bollettino delle Giunte e Commissioni, emendamenti, scheda-attività del deputato): i pattern sono nel wiki `docs/lod-wiki/camera/getdocumento-router.md`. Esempi già coperti oltre a persone/atti: `votes.url` → scheda votazione della Camera. Regola invariata: URL generato **localmente** dall'identificatore quando derivabile, **mai inventato** (stringa vuota se il pattern non combacia).

## Pattern URL verificati

Mappatura URI SPARQL → URL scheda, verificata aprendo le pagine reali con browser:

| Entità | URI SPARQL | URL human-readable | Mappatura | Oggi |
|---|---|---|---|---|
| **Deputato** (Camera) | `…/ocd/deputato.rdf/d{ID}_{LEG}` | `https://www.camera.it/deputati/elenco/{LEG}-{ID}` | da `d{ID}_{LEG}` a `{LEG}-{ID}` | ❌ assente |
| **Senatore** (Senato) | `http://dati.senato.it/senatore/{N}` | `https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did={N}` | `did` = `{N}` finale | ❌ assente |
| Atto (Camera) | `…/ocd/attocamera.rdf/ac{LEG}_{ID}` | `https://www.camera.it/leg{LEG}/126?leg={LEG}&idDocumento={ID}` | regex da URI | ✅ già |
| DDL (Senato) | `http://dati.senato.it/ddl/{N}` | `https://www.senato.it/leggi-e-documenti/disegni-di-legge/scheda-ddl?did={N}` | `did` = `{N}` finale | ✅ già |

Esempi reali verificati:
- Chiara Colosimo: `d308917_19` → `camera.it/deputati/elenco/19-308917` ✓
- M.E. Alberti Casellati: `senatore/32` → `…/scheda-attivita?did=32` ✓
- DDL S.1778 → `scheda-ddl?did=59851` ✓ ; C.2511 → `did=59372` ✓

Entrambe le mappature persona sono **derivabili con una semplice regex dall'URI SPARQL**: nessuna query aggiuntiva richiesta.

## Requisiti

### Funzionali — persone

1. I tool che restituiscono **persone** (`deputies`, `deputy`, `senators`, `senator`, `search`, `group-members`, `senator-group-members`, `gov-members`, `person-career`, i `rank`/`group-rank` dove pertinente) aggiungono una colonna **`html_url`** con l'URL della scheda istituzionale, accanto all'URI SPARQL.

### Funzionali — leggi

2. Audit dei tool che restituiscono **atti/DDL** (`bills`, `bill`, `member-bills`, `aic`, `amendments`, `bill-progress`, `bill-signatories`, `bill-rapporteurs`, `documents`, `sindacato-ispettivo`, …): tutti devono esporre `html_url` verso la scheda dell'atto. Colmare i tool che oggi non lo fanno, riusando i pattern già esistenti.

### Comuni

3. Il valore è generato **localmente** dall'URI (regex), senza chiamate extra all'endpoint.
4. Se l'URI non corrisponde al pattern atteso, `html_url` è **stringa vuota** (mai un URL inventato).

### Vincolo legislatura (deciso: best-effort + flag)

5. `html_url` è **sempre valorizzato** col pattern attuale, per tutte le legislature (best-effort).
6. Si aggiunge una colonna **`url_verified`** = `true` **solo per la legislatura corrente (19)**, `false` per le precedenti (pattern non verificato sullo storico). Trasparenza sull'incertezza senza rinunciare alla copertura.

### Copertura (deciso: anagrafici + aggregati)

7. `html_url` (persona) va aggiunto **ovunque compaia una persona**, inclusi i tool aggregati: `rank`, `group-rank`, `vote-detail`, `senato-vote-detail`, `speeches`, oltre ai tool anagrafici.

### Non funzionali

8. Nome colonna persone: **`html_url`**, identico a quello già usato per gli atti/DDL (una sola convenzione in tutto il progetto).
9. Nessuna rottura di schema per gli script esistenti: `html_url` e `url_verified` sono **colonne aggiuntive** in coda.
10. Helper unici riusabili in `src/core/` (es. `personHtmlUrl(uri)`, `actHtmlUrl(uri)`, con relativo `verified` flag), con test unitari sui pattern.

## Fuori scope (per ora)

- Estrazione del **contenuto** delle schede (testo, allegati): qui si restituisce solo il link.
- Pagine human-readable per entità diverse da persone/atti (gruppi, commissioni, votazioni): valutabili in un secondo momento.

## Stato implementazione (2026-06-29)

**Fatto** — `html_url` persone (helper `src/core/html-url.ts`, verificato con agent-browser):
`deputies`, `senators`, `search`, `group-members`, `senator-group-members`, `rank`, `vote-detail`, `senato-vote-detail`.

**Differito**:
- `gov-members`, `person-career`: l'URI persona è `…/persona.rdf/p{N}` (non `deputato.rdf`) e non ha una scheda `elenco`/`scheda-attivita` derivabile → serve risolvere il mandato deputato/senatore corrispondente. Da approfondire.
- `speeches`: schema misto Camera/Senato, da trattare con cura.
- `url_verified`: non implementato — l'URI senatore non contiene la legislatura, quindi il flag non è derivabile in modo robusto dalla sola URI (resta domanda aperta).
- **Leggi**: `html_url` già presente sui tool atti/DDL principali; audit di consistenza + eventuale `rss_url` per i DDL (feed RSS, issue #13) ancora da fare.

## Decisioni prese

- **Scope**: persone **e** leggi.
- **Legislature passate**: best-effort sul pattern attuale + colonna `url_verified` (true solo per la 19).
- **Nome colonna**: `html_url` (coerente con atti/DDL).
- **Copertura persone**: anagrafici **+** aggregati (ovunque compaia una persona).

## Domande aperte (residue)

- Senatore: il `did` è a livello di **persona** (stabile tra legislature) o cambia per legislatura? Da verificare su un senatore con più mandati prima di fidarsi del flag `url_verified=false` come "solo non verificato" anziché "potenzialmente errato".
- Deputato storico: confermare il pattern `camera.it/deputati/elenco/{LEG}-{ID}` su una legislatura vecchia (atteso `url_verified=false`).
- `url_verified`: colonna booleana sempre presente, o solo quando `html_url` è valorizzato?
