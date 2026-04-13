# Analisi Gap — italianparliament-mcp vs Esigenze Giornalista Parlamentare

Data: 2026-04-13

## Risultato complessivo

| Valutazione | Count | % |
|---|---|---|
| OK | 13 | 39% |
| PARZIALE | 14 | 42% |
| KO | 6 | 18% |

Su 33 user stories reali di un giornalista parlamentare, l'MCP risponde pienamente a 13, parzialmente a 14, e non riesce a rispondere a 6.

## Matrice User Stories vs Capacita MCP

### Priorita ALTA (18 user stories — uso quotidiano)

| US | Tema | Tool | Esito | Gap |
|---|---|---|---|---|
| US-01 | Sedute di oggi | sessions | PARZIALE | No filtro data, solo Camera |
| US-02 | Ultime votazioni | votes | OK | Titoli spesso vuoti, solo Camera |
| US-03 | Nuovi DDL | bills, bill-progress | PARZIALE | Lag indicizzazione Camera, no cofirmatari |
| US-04 | Nuove interrogazioni | aic, sindacato-ispettivo | PARZIALE | Senato: presentatore vuoto |
| US-05 | Scheda parlamentare | search, deputy, roles | PARZIALE | No commissioni, no circoscrizione diretta |
| US-06 | Attivita parlamentare | aic, speeches, rank | PARZIALE | No rank Senato, no contatore singolo |
| US-09 | Dissidenti voto | votes, vote-detail | OK | Solo Camera |
| US-10 | Votazioni su DDL | votes | **KO** | No filtro per DDL/titolo |
| US-11 | Voti di fiducia | votes, vote-detail | PARZIALE | No filtro confidence_vote |
| US-13 | Iter DDL | bill-progress, bill | PARZIALE | No ricerca per titolo |
| US-14 | Firmatari DDL | bill-signatories, bills | PARZIALE | Camera: solo primo firmatario |
| US-16 | Ostruzionismo emendamenti | amendments | **KO** | No presentatore, no DDL collegato |
| US-17 | Interrogazioni per tema | aic, sindacato-ispettivo | **KO** | No ricerca full-text |
| US-20 | Composizione governo | gov-members | OK | — |
| US-21 | Rimpasti | gov-members | OK | — |
| US-26 | Gruppi su voto | vote-detail | OK | Aggregazione manuale, solo Camera |
| US-27 | Composizione commissione | committees | **KO** | Solo lista, no membri, no Camera |
| US-28 | Lavori commissione | — | **KO** | Nessun tool disponibile |

**Delle 18 user stories ALTA: 5 OK, 8 PARZIALI, 5 KO.**

### Priorita MEDIA (12 user stories — uso settimanale)

| US | Tema | Tool | Esito | Gap |
|---|---|---|---|---|
| US-07 | Cambi di gruppo | group-members | PARZIALE | No filtro per singolo deputato |
| US-08 | Eletti per regione | deputies | PARZIALE | No filtro circoscrizione |
| US-12 | Confronto votazioni | votes | **KO** | No ricerca per testo |
| US-15 | DDL iniziativa popolare | bills | PARZIALE | Iniziativa non filtrabile |
| US-18 | Chi interroga di piu | rank | PARZIALE | Solo Camera |
| US-19 | Risposte interrogazioni | sindacato-ispettivo | PARZIALE | Campo esito vuoto |
| US-22 | Doppio incarico | deputies + gov-members | PARZIALE | Namespace diversi, incrocio manuale |
| US-23 | Top DDL primo firmatario | rank | OK | Solo Camera |
| US-24 | Ranking gruppi | — | **KO** | No ranking per gruppo |
| US-25 | Assenteismo | rank | PARZIALE | No ordinamento inverso |
| US-29 | Audizioni | — | **KO** | Dato non esposto |
| US-31 | Carriera multi-legislatura | search + vari | PARZIALE | No ID persona unificato |

### Priorita BASSA (3 user stories — analisi di lungo respiro)

| US | Tema | Esito |
|---|---|---|
| US-30 | Precedenti su tema | PARZIALE |
| US-32 | Confronto legislature | PARZIALE |
| US-33 | Decreti legge storici | PARZIALE |

Tutte PARZIALI: i dati ci sono ma richiedono scaricamento massivo e aggregazione manuale.

## I 7 gap strutturali

### 1. Ricerca full-text (impatto: 5 user stories KO/PARZIALI ad alta priorita)

Nessun tool permette di cercare DDL, votazioni o interrogazioni per parola chiave nel titolo o testo. E il gap piu grave: un giornalista lavora per argomenti, non per URI.

**US bloccate:** US-10, US-12, US-13, US-17, US-30

### 2. Commissioni (impatto: 3 user stories KO)

`committees` restituisce solo una lista Senato senza composizione. Non ci sono membri, ruoli (presidente), ne dati Camera. Le commissioni sono dove si fa il lavoro parlamentare reale.

**US bloccate:** US-27, US-28, US-29

### 3. Dati Senato incompleti (impatto: 5+ user stories)

- `sindacato-ispettivo`: presentatore sempre vuoto
- `amendments`: no presentatore, no DDL collegato
- Nessun `rank` Senato
- Nessun `votes` Senato

Meta del Parlamento e invisibile su dimensioni cruciali.

### 4. Filtri mancanti su tool esistenti (impatto: 4+ user stories)

- `sessions`: no filtro data
- `votes`: no filtro `confidence_vote`
- `deputies`: no filtro regione/circoscrizione
- `rank`: no ordinamento inverso (per trovare i meno attivi)
- `bills`: no filtro per iniziativa (popolare/governo/parlamentare)

### 5. Cofirmatari Camera (impatto: US-14)

I DDL Camera espongono solo il primo firmatario. I cofirmatari sono un segnale politico fondamentale (trasversalita, peso parlamentare).

### 6. Testo degli atti (impatto: US-17, US-19)

I tool restituiscono metadati (tipo, numero, data) ma mai il testo/oggetto dell'atto. Il giornalista ha bisogno dell'oggetto dell'interrogazione, non solo del numero di protocollo.

### 7. Votazioni Senato (impatto: US-02, US-09, US-11, US-26)

Nessun tool per votazioni Senato. Il giornalista monitora entrambe le camere.

## Cosa funziona bene

| Cosa | Perche funziona |
|---|---|
| `vote-detail` | Voto individuale per deputato con gruppo — fondamentale per storie su dissidenti |
| `gov-members` | Aggiornato, storico completo, ricerca per nome, motivo cessazione |
| `rank` | Top-N immediata su 5 dimensioni — ottimo per classifiche |
| `search` | Trova parlamentari cross-camera con legislatura |
| `votes` con filtro data | Le ultime votazioni escono subito |
| `html_url` ovunque | Link alle schede ufficiali per fact-checking |
| `bill-signatories` Senato | Primo firmatario + cofirmatari con URI |
