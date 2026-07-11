# Tool Reference — italianparliament-mcp

39 tool. Colonne trasversali nell'output:
- **`html_url`**: link alla scheda istituzionale su `camera.it`/`senato.it`, accanto all'URI SPARQL. Presente sui tool che restituiscono persone (`deputies`, `senators`, `search`, `group-members`, `senator-group-members`, `rank`, `vote-detail`, `senato-vote-detail`, `people`...) e atti/DDL (`bills`, `bill`, `member-bills`, `bill-signatories`, `bill-rapporteurs`, `amendments`, `senato-votes`, `bill-progress`...).
- **`rss_url`**: feed RSS con l'iter dettagliato del DDL (fasi, sedute, voto finale). Presente sui tool DDL del Senato (`amendments`, `senato-votes`, `bill-progress`).

## Parlamentari

### `search`
Cerca un parlamentare per nome in Camera, Senato o entrambi.
- `query` (required): nome o cognome
- `chamber`: `camera` | `senato` | `both` (default: `both`)
- `legislature`: numero legislatura (default: 19)

### `deputies`
Lista deputati Camera.
- `legislature`: numero legislatura (default: 19)
- `region`: circoscrizione/regione di elezione (case-insensitive)
- `gender`: `male` | `female`
- `bornFrom` / `bornTo`: intervallo data di nascita (YYYY-MM-DD)
- `birthPlace`: luogo di nascita — comune/provincia/regione/stato (la gerarchia è nell'URI del luogo Camera). In output `birth_place` è lo slug `comune_provincia_regione`.
- `limit`: max risultati (default: 100)
- `format`: `csv` | `jsonl`

### `senators`
Lista senatori.
- `legislature`: numero legislatura (default: 19)
- `activeOnly`: solo in carica
- `gender`: `male` | `female`
- `bornFrom` / `bornTo`: intervallo data di nascita (YYYY-MM-DD)
- `birthPlace`: **solo città** di nascita (il Senato non espone provincia/regione)

### `deputy`
Scheda di un deputato.
- `uri` (required): URI del deputato (da `search` o `deputies`)

### `senator`
Scheda di un senatore.
- `uri` (required): URI del senatore

### `person-career`
Carriera unificata di una persona: mandati da deputato (per legislatura) + appartenenza ai gruppi (con date) + incarichi di governo + link Wikidata. Risolve doppio incarico parlamento+governo e carriera multi-legislatura.
- `uri` (required): URI deputato o persona (Camera)
- Output ordinato: persona, mandati, gruppi (cronologici), governo.
- Camera+governo affidabile; Camera↔Senato non nei dati (solo via nome + data nascita).

### `people`
Risolve in batch una lista di URI persona (anche misti Camera + Senato) nei rispettivi nomi, con una query per endpoint. Dà i nominativi agli URI "nudi" restituiti dai tool relazionali, evitando una chiamata `deputy`/`senator` per ciascuno.
- `uris` (required): array di URI persona (Camera `deputato.rdf/...` o Senato `senatore/...`), max 500. La camera è rilevata dall'URI.
- Output: `uri`, `first_name`, `last_name`, `label`, `chamber`, `html_url`. Gli URI non risolti restano in output con label vuota.

## Attività legislativa — Camera

### `bills`
Disegni di legge Camera.
- `legislature`: numero legislatura
- `type`: tipo atto
- `limit`: max risultati

### `bill`
Scheda di un atto Camera.
- `uri` (required): URI dell'atto

### `aic`
Atti di indirizzo e controllo (interrogazioni, interpellanze, mozioni). Il testo è in `description`.
- `legislature`: numero legislatura
- `deputyUri`: filtra per deputato
- `keyword`: cerca nel testo (label/titolo/description) a confini di parola, es. un tema ("CETA" non matcha "Acetamiprid")
- `type`: filtra per tipo (match parziale su `dc:type`, fallback sul label — "immediata" trova le interrogazioni a risposta immediata/question time anche quando `dc:type` le etichetta genericamente "orale")
- `dateFrom`/`dateTo`: intervallo data. Combacia sia sulla presentazione sia sulla modifica: per i question time (a risposta immediata) la modifica è la data di **trattazione in Aula**, quindi filtra per quel giorno per ricostruirli (es. `type: "immediata"`, `dateFrom`/`dateTo` = giorno d'Aula).
- `limit`: max risultati

### `votes`
Votazioni Camera.
- `legislature`: numero legislatura
- `limit`: max risultati
- Colonna `bill_number`: numero atto citato nella descrizione (es. `2920-A`). `bill_uri`: URI dell'atto Camera, popolato anche quando manca `rif_attoCamera` risolvendo il numero via `dc:identifier`.
- Per mozioni e risoluzioni ("MOZ 1-586", "RIS 6-263"), colonne `aic_code` (es. `1/00586`) e `aic_link` (URL alla scheda AIC).

### `vote-detail`
Come ha votato ogni deputato in una votazione.
- `voteUri` (required): URI della votazione
- `groupAcronym`: filtra per sigla gruppo (es. FDI)
- `voteType`: Favorevole | Contrario | Astenuto | Non ha votato

### `speeches`
Interventi in aula, Camera **e** Senato (`chamber`).
- `chamber`: `camera` (default) o `senato`
- `legislature`: numero legislatura (nota: dati Camera disponibili da leg. 17)
- `deputyUri`: filtra per parlamentare
- `dateFrom` / `dateTo` (YYYY-MM-DD): filtra per **data della seduta** dell'intervento. Camera: la data non è sull'intervento (`ods:modified` è il timestamp del record) ma sulla `ocd:discussione` che lo raggruppa — il tool la ricava per te. Per la Camera il filtro data richiede `legislature` (àncora l'indice; senza è molto più lento).
- Colonna `date` (YYYY-MM-DD) in output per entrambe le camere.

### `attendance`
Conteggio aggregato dei voti di un deputato su tutte le votazioni della sua legislatura (misura di attivismo/assenteismo). L'URI del deputato è già specifico di una legislatura (`.../deputato.rdf/d<ID>_<LEG>`), quindi il conteggio è già delimitato senza filtro separato.
- `uri` oppure `id`+`legislature`
- Colonne: `favorevole`, `contrario`, `astensione`, `non_ha_votato`, `ha_votato` (scrutinio segreto), `altro`, `totale`

## Attività legislativa — Senato

### `bill-progress`
Iter di un disegno di legge, Camera o Senato (stesse colonne in entrambi i casi).
- **Senato** (senza `uri`): lista DDL con stato corrente dell'iter, filtrabile.
  - `legislature`: numero legislatura
  - `ddlUri`: singolo DDL Senato
  - `keyword`: cerca nel titolo del DDL
  - `number`: numero dell'atto (es. `1809` → S.1809), da abbinare a `branch`. Se ometti `legislature`, usa la legislatura corrente (risolta dinamicamente). Lo stesso numero può esistere in entrambi i rami (C.1809 e S.1809).
  - `branch`: ramo per `number`. `S` (default): repertorio Senato, **stato corrente** del DDL (una riga). `C`: risolve l'atto Camera `ac<leg>_<n>` e ne restituisce la **timeline completa** degli stati (una riga per stato, con date). L'asimmetria riflette la fonte: la Camera pubblica lo storico degli stati, il Senato solo lo stato corrente (la sua timeline vive nel feed RSS).
  - `dateFrom`/`dateTo`: intervallo data presentazione
- **Camera** — timeline completa di tutti gli stati attraversati, in ordine cronologico: con `uri` = atto Camera `attocamera.rdf/...`, oppure con `number` + `branch: C`.

### `bill-signatories`
Firmatari di un DDL, **Camera o Senato** (il ramo è riconosciuto dall'URI): primo firmatario e cofirmatari con nome e link al profilo. Per gli atti di iniziativa governativa, il ruolo è "Governo (proponente)".
- `billUri` (required): URI del DDL (Camera `attocamera.rdf/...` o Senato `ddl/...`)

### `bill-rapporteurs`
Relatori di un DDL, **Camera o Senato** (il ramo è riconosciuto dall'URI). Nome, tipo (Relatore / f.f.), commissione/organo e data.
- `billUri` (required): URI del DDL (Camera `attocamera.rdf/...` o Senato `ddl/...`)

### `bill-committees`
Commissioni a cui un DDL/atto è assegnato, **Camera o Senato** (il ramo è riconosciuto dall'URI). Nome commissione, `role` (sede/ruolo: Referente, Consultiva, Redigente, Deliberante), tipo, data di assegnazione e URI dell'organo.
- `billUri` (required): URI del DDL/atto (Camera `attocamera.rdf/...` o Senato `ddl/...`)

### `amendments`
Emendamenti Senato con DDL collegato. Ogni riga espone `akn_xml_url` (testo AKN raw dal bulk GitHub del Senato, senza WAF). Se il LOD è indietro, con `ddlUri` il tool passa da solo al bulk AKN (`source=akn`).
- `legislature`: numero legislatura
- `ddlUri`: filtra gli emendamenti a un DDL specifico
- `withProponents`: aggiunge primo firmatario e cofirmatari (nome + URI persona, colonne `first_proponent`/`first_proponent_uri`/`proponents`/`proponents_uri`) dal testo AKN (il proponente NON è nel LOD; un fetch per emendamento, più lento: richiede `limit<=100`, errore esplicito oltre). Popola anche la colonna `date` (data di presentazione) quando il LOD non ce l'ha.

`type` (E/G/Q, dal LOD) e `sede` (commissione/assemblea, da entrambe le fonti) sono colonne distinte: `type` non è deducibile in modo affidabile dal solo bulk AKN e resta vuota nelle righe `source=akn`.

### `camera-amendments`
Emendamenti (proposte emendative) a un atto **Camera**, per sede (referente/Assemblea). Fonte: app HTML `documenti.camera.it` (gli emendamenti Camera non sono nel LOD), via scraping. Output per emendamento: `sede`, `article`, `number`, `first_signatory`, `person_id`, `identical`, `text_url`.
- `billUri` (required): URI atto Camera (es. `http://dati.camera.it/ocd/attocamera.rdf/ac19_2696`)
- `countOnly`: solo il conteggio per sede

### `sindacato-ispettivo`
Atti di sindacato ispettivo Senato (interrogazioni, interpellanze).
- `legislature`: numero legislatura (integer, es. 19)
- `senatorUri`: filtra per senatore

### `documents`
Documenti parlamentari Senato.
- `legislature`: numero legislatura

### `senato-votes`
Votazioni d'Assemblea del Senato: esito, contatori, tipo, data seduta, DDL collegato.
- `legislature`: numero legislatura (default 19)
- `ddlUri`: filtra le votazioni collegate a un DDL
- `dateFrom`/`dateTo`: intervallo data seduta (YYYY-MM-DD)
- `keyword`: cerca nel label del voto **e** (da v0.20.0) nel titolo del DDL collegato (`osr:oggetto`/`osr:relativoA`/`osr:titolo`), in OR — un tema che sta solo nel titolo del provvedimento (es. `bilancio`) viene trovato anche quando il label del voto è generico (`Votazione finale`). Limite: se il voto non ha DDL collegato (alcune fiducie/mozioni) il tema resta irraggiungibile per keyword.
- `confidenceVote` (true/false): voti di fiducia (label-based, esclude le mozioni di sfiducia); `finalVote` (true/false): `Votazione finale`. Il tipo semantico vive nel `rdfs:label`, non in `osr:tipoVotazione`.
- Colonna `bill_number`: numero DDL citato nel label (es. `562-B`). `ddl_uri`: URI del DDL, popolato anche per le fiducie (prive di `osr:oggetto`) risolvendo il numero via `osr:fase`.

### `senato-vote-detail`
Voto del singolo senatore in una votazione, con il gruppo di appartenenza alla data del voto (colonna `group_label`) — consente il voto per gruppo.
- `voteUri` (required): URI della votazione (da `senato-votes`)
- `voteType`: filtro (Favorevole/Contrario/Astenuto/Presente non votante/In congedo/missione)

### `senato-attendance`
Conteggio aggregato dei voti di un senatore su tutte le votazioni d'Assemblea di una legislatura (misura di attivismo/assenteismo). L'URI senatore non contiene la legislatura, quindi va indicata a parte.
- `senatorUri` (required): URI del senatore
- `legislature`: numero legislatura (default 19)
- Colonne: `favorevole`, `contrario`, `astenuto`, `presente_non_votante`, `in_congedo_missione`, `totale`
- Per un senatore attivo tutta la legislatura, `totale` è prossimo (non sempre identico) al numero di votazioni della legislatura (`senato-votes` con `countOnly`); per un senatore a vita o subentrato, `totale` è naturalmente inferiore.

### `committee-sessions`
Attività delle commissioni. Due modalità: (1) iter di un DDL (`ddlUri`, Senato): sedute in cui il provvedimento è stato trattato; (2) segui una commissione (`committeeUri` o `committeeName` + `chamber`): tutte le sedute, filtrabili per data.
- Output: data, commissione, tipo seduta, n. interventi (Camera: URL bollettino).
- `countOnly`: restituisce solo il numero di sedute (una riga per ramo, `chamber,count`) invece dell'elenco. Usarlo per "quante audizioni/sedute ha svolto la commissione X" — evita di scaricare tutte le righe.

### `audizioni` (solo Camera)
Audizioni delle commissioni della Camera: data, commissione, titolo (con nome/ruolo dell'audito nel testo), atti collegati, link al bollettino.
- `legislature`: default 19 (dato vivo, via titolo della discussione); 14 = storica (via `dc:type`).
- `committeeName`: nome/parte commissione (es. "femminicidio").
- `keyword`: parola nel titolo dell'audizione (es. "Confindustria", "prefetto") — **ricerca testuale**. NB: una corrispondenza NON significa che quel soggetto sia stato audito (può essere l'oggetto dell'indagine o un ente citato); verificare il titolo completo.
- `dateFrom`/`dateTo`, `limit`, `offset`.
- Output: `date, committee, title, bill_codes, bill_uris, bulletin_url, discussion_uri, dibattito_uri`.
- **Senato non coperto**: `osr:Procedura` `tipo="Audizioni"` esiste ma senza data né commissione (link interventi rotto).
- **Limiti**: audito = stringa nel titolo (non entità); filtro testuale (non tutti i titoli citano il DDL su cui verte l'audizione); nessun link video/YouTube nel LOD.

### `bill-text` (Camera + Senato)
Link diretti al testo di un DDL, con tipo risorsa (`format`: html/pdf/urn) e se serve un browser (`auth`: none/browser). Il testo integrale NON è nei dati SPARQL.
- `uri` (required): URI dell'atto (`http://dati.senato.it/ddl/<N>` o atto Camera)
- Senato (`auth=browser`): `www.senato.it` è dietro AWS WAF → un fetch diretto torna HTTP 202. Per scaricare e convertire in markdown usare la CLI locale `italianparliament bill-text fetch --did <N>` (apre un browser reale, supera il WAF, converte il PDF con `lit`). Opzioni: `--which "<etichetta>"`, `--all`, `--fascicolo`.
- Camera (`auth=none`): pagina fetchabile direttamente.
- `bill-text fetch` è solo CLI/locale (richiede `agent-browser` e `lit`), non è un tool MCP.

## Organizzazione parlamentare

### `groups`
Gruppi parlamentari Camera con sigla e URI.
- `legislature`: numero legislatura

### `group-members`
Composizione di un gruppo Camera, con il nome del deputato (colonna `deputy_name`) accanto all'URI.
- `groupUri`: URI del gruppo (opzionale; senza → tutti i gruppi)
- `legislature`: numero legislatura

### `senato-groups`
Gruppi parlamentari Senato con sigla e numero di componenti distinti (`members`). Parallelo di `groups` per il Senato.
- `legislature`: numero legislatura (es. 19)
- `asOf`: data di riferimento YYYY-MM-DD (default: oggi). Per legislature passate usare l'ultima data della legislatura (es. `2022-10-12` per la XVIII).
- Output: `uri`, `title`, `acronym`, `members`, `html_url`

### `senator-group-members`
Composizione di un gruppo Senato (lista nominativa, con il nome del senatore nella colonna `senator_name`).
- `groupUri`: URI del gruppo (da `senato-groups`)
- `legislature`: numero legislatura
- `asOf`: data di riferimento (default: oggi)

### `roles`
Incarichi parlamentari Camera.
- `legislature`: numero legislatura

### `sessions`
Sedute Camera.
- `legislature`: numero legislatura

### `committees`
Commissioni Senato.
- `legislature`: numero legislatura

## Contesto istituzionale

### `legislatures`
Tutte le legislature dal 1848 a oggi.

### `governments`
Tutti i governi italiani.

### `gov-members`
Membri del governo.
- `legislature`: numero legislatura
- `name`: filtra per nome

## Analisi

### `group-rank`
Classifica i gruppi Camera per AIC o DDL (via gruppo del primo firmatario), con conteggio, membri e media per membro.
- `rankBy` (required): `aic` | `bills`
- `legislature`: default 19
- `order`: desc | asc
- Colonna `count_per_member`: utile per confrontare gruppi di dimensioni diverse.

Nota: i tool lista `bills`/`aic`/`votes`/`senato-votes` accettano `countOnly` (solo il totale, colonna count).

### `rank`
Ranking parlamentari per attività.
- `rankBy` (required): `aic-primo-firmatario` | `aic-cofirmatario` | `bills-primo-firmatario` | `bills-cofirmatario` | `speeches` | `sindacato-ispettivo` | `ddl-senato`
- `legislature`: numero legislatura
- `limit`: max risultati

### `sparql`
Query SPARQL libera sugli endpoint Camera o Senato.
- `query` (required): query SPARQL
- `endpoint` (required): `camera` | `senato`
