# Command Reference — italianparliament CLI

## Syntax

```
italianparliament <resource> <action> [options]
```

Common options available on most commands:
- `--legislature <n>`: numero legislatura (default: 19)
- `--limit <n>`: max risultati
- `--format csv|jsonl`: formato output (default: csv)

---

## Note utili

Comandi di scoperta (`guide`, `which`, `--help`) documentati nel SKILL.

- `bills`/`aic`/`votes`/`senato-votes` accettano `--count-only` (solo il totale).
- Su un valore enum errato (`--vote-type`, `--rank-by`, ...) l'errore elenca i valori validi.
- **`html_url`**: i tool su persone e atti/DDL espongono una colonna `html_url` con il link alla scheda istituzionale su `camera.it`/`senato.it`, accanto all'URI SPARQL.
- **`rss_url`**: i tool sui DDL del Senato (`amendments`, `senato-votes`, `bill-progress`) espongono `rss_url`, il feed RSS con l'iter dettagliato (fasi, sedute, voto finale).

---

## Parlamentari

### `deputies list`
Lista deputati Camera. Filtri: `--region`, `--gender male|female`, `--born-from`/`--born-to` (YYYY-MM-DD), `--birth-place` (comune/provincia/regione/stato — la gerarchia è nell'URI del luogo). `birth_place` in output è lo slug `comune_provincia_regione` (es. `messina_messina_sicilia`).
```bash
italianparliament deputies list --legislature 19 --limit 100 --format csv
italianparliament deputies list --legislature 19 --gender female --birth-place sicilia
italianparliament deputies list --legislature 19 --born-from 1990-01-01
```

### `senators list`
Lista senatori. Filtri: `--active-only`, `--gender male|female`, `--born-from`/`--born-to` (YYYY-MM-DD), `--birth-place` (**solo città** — il Senato non espone provincia/regione di nascita).
```bash
italianparliament senators list --legislature 19
italianparliament senators list --legislature 19 --gender female --born-from 1980-01-01
```

### `search find`
Cerca un parlamentare per nome.
```bash
italianparliament search find --name "mario rossi" --chamber both
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

### `person-career show`
Carriera unificata: mandati per legislatura + appartenenza ai gruppi (cronologica, con date) + incarichi di governo + link Wikidata.
```bash
italianparliament person-career show --uri http://dati.camera.it/ocd/deputato.rdf/d301551_15
```

### `people resolve`
Risolve in batch una lista di URI persona (anche misti Camera + Senato) nei nomi, con una query per endpoint. Utile per dare i nominativi agli URI "nudi" dei tool relazionali senza una chiamata `deputy`/`senator` per ciascuno. Output: `uri`, `first_name`, `last_name`, `label`, `chamber`, `html_url`.
```bash
italianparliament people resolve --uris http://dati.senato.it/senatore/32,http://dati.camera.it/ocd/deputato.rdf/d308917_19
italianparliament people resolve --uris http://dati.senato.it/senatore/32 --format jsonl
```

---

## Attività legislativa — Camera

### `bills list`
```bash
italianparliament bills list --legislature 19 --format csv
```

### `bill show`
Solo atti **Camera** (`dati.camera.it`): un URI Senato produce un errore instradante verso `bill-progress --ddl-uri` / `bill-signatories --bill-uri` / `bill-text --uri`.
```bash
italianparliament bill show --uri <uri>
```

### `aic list`
Atti di indirizzo e controllo. `--keyword` cerca nel testo (label/titolo/description, a confini di parola: "CETA" non matcha "Acetamiprid"). `--type` filtra per tipo (match parziale su `dc:type`, con fallback sul label — per la leg. 19 "a risposta immediata"/question time non è distinto da "a risposta orale" nel `dc:type`, la differenza è solo testuale). `--date-from/--date-to` combacia sia sulla presentazione sia sulla modifica: per i question time la modifica è la **data di trattazione in Aula**, quindi filtra per quel giorno per ricostruirli.
```bash
italianparliament aic list --legislature 19 --limit 200 --format csv
italianparliament aic list --legislature 19 --keyword xylella
italianparliament aic list --legislature 19 --type immediata --limit 20
# question time di un giorno d'Aula preciso (es. 9 luglio 2025):
italianparliament aic list --legislature 19 --type immediata --date-from 2025-07-09 --date-to 2025-07-09
italianparliament aic list --deputy-uri <uri>
```

### `votes list`
```bash
italianparliament votes list --legislature 19 --format csv
```
Colonne `bill_number` (numero atto dalla descrizione, es. `2920-A`) e `bill_uri` (URI atto, popolato anche senza `rif_attoCamera` risolvendo il numero via `dc:identifier`).

### `vote-detail show`
Come ha votato ogni deputato.
```bash
italianparliament vote-detail show --vote-uri <vote-uri> --format csv
```

### `speeches list`
Interventi in aula, Camera e Senato (`--chamber`; dati Camera da leg. 17). Colonna `date` (YYYY-MM-DD) in output.
```bash
italianparliament speeches list --legislature 19
italianparliament speeches list --legislature 19 --date-from 2026-06-17 --date-to 2026-06-17
italianparliament speeches list --chamber senato --legislature 19 --date-from 2025-03-01 --date-to 2025-03-31
```
`--date-from`/`--date-to` filtrano per la **data della seduta**. Camera: la data non è sull'intervento (`ods:modified` è il timestamp del record) ma sulla `ocd:discussione` che lo raggruppa — il tool la ricava. Per la Camera il filtro data richiede `--legislature` (àncora l'indice; senza è molto più lento).

### `attendance show`
Conteggio aggregato dei voti di un deputato su tutte le votazioni della sua legislatura (favorevole/contrario/astensione/non ha votato/ha votato in scrutinio segreto) — misura di attivismo/assenteismo.
```bash
italianparliament attendance show --id 302103 --legislature 19
italianparliament attendance show --uri http://dati.camera.it/ocd/deputato.rdf/d306921_17
```

---

## Attività legislativa — Senato

### `bill-progress list`
Iter di un disegno di legge. **Senato** (`--branch S`, default): lista DDL con **stato corrente**, filtrabile per legislatura, `--keyword`, `--number <n>` (es. `--number 1809` → S.1809), `--date-from`/`--date-to`, o per singolo DDL con `--ddl-uri`. **Camera**: **timeline completa** di tutti gli stati attraversati, in ordine cronologico, in due modi — con `--uri <atto Camera>`, oppure con `--number <n> --branch C` (risolve l'atto Camera `ac<leg>_<n>`). Stesse colonne in entrambi i casi.
```bash
italianparliament bill-progress list --legislature 19
italianparliament bill-progress list --number 1809 --branch S --legislature 19
italianparliament bill-progress list --number 2617 --branch C --legislature 18   # timeline Camera dl Covid 2020
italianparliament bill-progress list --ddl-uri http://dati.senato.it/ddl/25597
italianparliament bill-progress list --uri http://dati.camera.it/ocd/attocamera.rdf/ac19_2822
```

> Nota: lo stesso numero può esistere in entrambi i rami (`C.1809` e `S.1809`), perciò `--branch` disambigua (default `S`). Attenzione all'asimmetria: `--branch S` restituisce **una riga** (stato corrente del DDL al Senato), `--branch C` restituisce **la timeline** (una riga per stato, con date) — riflette ciò che le due fonti pubblicano (la Camera lo storico degli stati, il Senato solo lo stato corrente; la timeline Senato vive nel feed RSS).

### `bill-signatories show`
Firmatari di un DDL, **Camera o Senato** (riconosciuto dall'URI): primo firmatario e cofirmatari con nome e link al profilo.
```bash
italianparliament bill-signatories show --bill-uri http://dati.camera.it/ocd/attocamera.rdf/ac19_2696
italianparliament bill-signatories show --bill-uri http://dati.senato.it/ddl/25597
```

### `bill-rapporteurs list`
Relatori di un DDL, **Camera o Senato** (riconosciuto dall'URI): nome, tipo (Relatore / f.f.), commissione/organo, data.
```bash
italianparliament bill-rapporteurs list --bill-uri http://dati.camera.it/ocd/attocamera.rdf/ac19_2807
italianparliament bill-rapporteurs list --bill-uri http://dati.senato.it/ddl/59313
```

### `bill-committees list`
Commissioni a cui un DDL/atto è assegnato, **Camera o Senato** (riconosciuto dall'URI): nome commissione, `role` (sede/ruolo: Referente, Consultiva, Redigente, Deliberante), tipo, data di assegnazione e URI dell'organo.
```bash
italianparliament bill-committees list --bill-uri http://dati.senato.it/ddl/59924
italianparliament bill-committees list --bill-uri http://dati.camera.it/ocd/attocamera.rdf/ac19_2822
```

### `amendments list`
Emendamenti Senato; `--ddl-uri` per gli emendamenti a un DDL specifico. Ogni riga espone `akn_xml_url` (testo AKN raw dal bulk GitHub del Senato, senza WAF). Se il LOD è indietro, con `--ddl-uri` il tool passa da solo al bulk AKN (`source=akn`). `--with-proponents` aggiunge primo firmatario e cofirmatari (nome + URI persona, colonne `first_proponent`/`first_proponent_uri`/`proponents`/`proponents_uri`) dal testo AKN (il proponente NON è nel LOD; un fetch per emendamento, più lento: richiede `--limit<=100`, errore esplicito oltre). Popola anche la colonna `date` (data di presentazione) quando il LOD non ce l'ha. `type` (E/G/Q, dal LOD) e `sede` (commissione/assemblea) sono colonne distinte: `type` resta vuota sulle righe `source=akn`.
```bash
italianparliament amendments list --legislature 19
italianparliament amendments list --ddl-uri http://dati.senato.it/ddl/56260 --format jsonl
italianparliament amendments list --ddl-uri http://dati.senato.it/ddl/60233 --with-proponents --limit 20
```

### `camera-amendments list`
Emendamenti (proposte emendative) a un atto **Camera**, per sede (referente/Assemblea): numero, articolo, primo firmatario, emendamenti identici, link al testo. `--count-only` per il conteggio per sede. Fonte: app HTML `documenti.camera.it` (gli emendamenti Camera non sono nel LOD); per il Senato usare `amendments`.
```bash
italianparliament camera-amendments list --bill-uri http://dati.camera.it/ocd/attocamera.rdf/ac19_2696 --count-only
italianparliament camera-amendments list --bill-uri http://dati.camera.it/ocd/attocamera.rdf/ac19_2696 --format jsonl
```

### `sindacato-ispettivo list`
Atti di sindacato ispettivo Senato.
```bash
italianparliament sindacato-ispettivo list --legislature 19
italianparliament sindacato-ispettivo list --legislature 19 --senator-uri <uri>
```

### `documents list`
```bash
italianparliament documents list --legislature 19
```

### `senato-votes list`
Votazioni d'Assemblea del Senato con esito e contatori.
```bash
italianparliament senato-votes list --legislature 19 --limit 20
italianparliament senato-votes list --ddl-uri http://dati.senato.it/ddl/58039 --format jsonl
italianparliament senato-votes list --date-from 2026-01-01 --date-to 2026-03-31
italianparliament senato-votes list --legislature 19 --confidence-vote true
italianparliament senato-votes list --legislature 19 --final-vote true --date-from 2026-06-01
italianparliament senato-votes list --legislature 19 --keyword bilancio
```
Colonne `bill_number` (numero DDL dal label, es. `562-B`; se il label è generico o col refuso, da v0.23.0 è backfillato dalla `osr:fase` del DDL risolto) e `ddl_uri` (URI DDL, popolato anche per le fiducie prive di `osr:oggetto` risolvendo il numero via `osr:fase`). Il tipo semantico vive nel `rdfs:label` (non in `osr:tipoVotazione`): `--confidence-vote true|false` (fiducia, esclude le mozioni di sfiducia) e `--final-vote true|false` (`Votazione finale`) sono label-based. `--keyword` cerca nel label del voto **e** (da v0.20.0) nel titolo del DDL collegato (`osr:oggetto`/`osr:relativoA`/`osr:titolo`), in OR; da v0.23.0 copre anche le **fiducie** (prive di `osr:oggetto`): il DDL citato per numero nel label viene risolto e il suo titolo concorre al match (es. `--keyword sicurezza` trova la fiducia sul decreto sicurezza). Limite residuo: fiducie con refuso nel numero del label e voti senza alcun DDL — usare `--ddl-uri` + `bill-progress`.

### `senato-vote-detail show`
Voto del singolo senatore in una votazione (URI da `senato-votes`); include il gruppo alla data del voto (`group_label`) → voto per gruppo.
```bash
italianparliament senato-vote-detail show --vote-uri http://dati.senato.it/votazione/19-167-42
italianparliament senato-vote-detail show --vote-uri http://dati.senato.it/votazione/19-167-42 --vote-type Contrario
```

### `senato-attendance show`
Conteggio aggregato dei voti di un senatore su tutte le votazioni d'Assemblea di una legislatura (favorevole/contrario/astenuto/presente non votante/in congedo o missione). L'URI senatore non contiene la legislatura: `--legislature` è obbligatorio (default 19).
```bash
italianparliament senato-attendance show --senator-uri http://dati.senato.it/senatore/32 --legislature 19
```

### `committee-sessions list`
Attività delle commissioni. Due modalità:
- **iter di un DDL** (`--ddl-uri`, Senato): sedute in cui il provvedimento è stato trattato.
- **segui una commissione** (`--committee-uri` o `--committee-name` + `--chamber`): tutte le sedute di una commissione, filtrabili per data. Camera: data + URL del bollettino; Senato: data, tipo seduta, numero interventi.

```bash
# iter di un DDL
italianparliament committee-sessions list --ddl-uri http://dati.senato.it/ddl/56260
# segui una commissione per nome
italianparliament committee-sessions list --committee-name femminicidio --chamber camera
italianparliament committee-sessions list --committee-name giustizia --chamber senato --date-from 2026-05-01 --date-to 2026-05-31
# o per URI diretto
italianparliament committee-sessions list --committee-uri http://dati.camera.it/ocd/organo.rdf/o19_3941 --chamber camera
# solo il conteggio (es. "quante audizioni ha svolto la commissione"): output chamber,count
italianparliament committee-sessions list --committee-name femminicidio --chamber camera --count-only
```

Con `--count-only` restituisce solo il numero di sedute (una riga per ramo), senza scaricare l'elenco completo — ideale per i conteggi.

> Le commissioni bicamerali (es. inchiesta femminicidio) hanno attività esposta solo dalla Camera.

### `audizioni list` (solo Camera)
Audizioni delle commissioni: data, commissione, titolo (nome/ruolo dell'audito nel testo), atti collegati (`bill_codes`/`bill_uris`) e link al bollettino. Leg. 19 (dato vivo) via titolo della discussione; leg. 14 (storica) via `dc:type` "Audizioni informali".

```bash
# tutte le audizioni recenti
italianparliament audizioni list --legislature 19 --limit 50
# per commissione (anche d'inchiesta)
italianparliament audizioni list --legislature 19 --committee-name femminicidio
# per tema/soggetto audito (cerca nel titolo)
italianparliament audizioni list --legislature 19 --keyword Confindustria
italianparliament audizioni list --legislature 19 --keyword prefetto --date-from 2026-01-01
# storico (legislatura 14)
italianparliament audizioni list --legislature 14 --committee-name difesa
```

> **Senato non coperto**: via SPARQL le audizioni Senato (`osr:Procedura` `tipo="Audizioni"`) esistono ma senza data né commissione (link agli interventi rotto). Solo Camera.
> **Limiti**: l'audito è testo nel titolo, non entità strutturata; il filtro è testuale (per una legge specifica cerca il tema con `--keyword`, non tutti i titoli citano il DDL); nessun link video/YouTube nel LOD.
> **`--keyword` non è "chi è stato audito"**: una corrispondenza dice solo che la parola compare nel titolo, non che quel soggetto sia stato audito (può essere l'oggetto dell'indagine o un ente citato nel contesto). Verificare sempre il titolo completo.

### `bill-text links` (Camera + Senato)
Link diretti al testo di un DDL, con tipo risorsa (`format`) e se serve un browser (`auth`).
```bash
italianparliament bill-text links --uri http://dati.senato.it/ddl/56784 --format jsonl
italianparliament bill-text links --uri http://dati.camera.it/ocd/attocamera.rdf/ac19_1234
```

### `bill-text fetch` (Senato, locale)
Scarica il testo di un DDL Senato e lo converte in markdown. Apre un browser reale (`agent-browser`) per superare l'AWS WAF di `www.senato.it`, scarica il PDF e lo converte con `lit`. Richiede `agent-browser` e `lit` installati.
```bash
italianparliament bill-text fetch --did 56784                       # primo testo
italianparliament bill-text fetch --did 56784 --which Relazione     # testo specifico
italianparliament bill-text fetch --did 56784 --all                 # tutti i testi
italianparliament bill-text fetch --did 56784 --fascicolo --out fascicolo.md
```
`did` = il numero `<N>` nell'URI Senato `dati.senato.it/ddl/<N>`.

---

## Organizzazione parlamentare

### `groups list`
Gruppi parlamentari Camera con sigla e URI.
```bash
italianparliament groups list --legislature 19
```

### `group-members list`
Composizione di un gruppo Camera.
```bash
italianparliament group-members list --group-uri <uri> --legislature 19 --format csv
```

### `senato-groups list`
Gruppi parlamentari Senato con sigla e numero di componenti distinti. Parallelo di `groups list` per il Senato.
```bash
italianparliament senato-groups list --legislature 19
italianparliament senato-groups list --legislature 18 --as-of 2022-10-12
italianparliament senato-groups list --legislature 18 --as-of 2022-10-12 --format jsonl
```
`--as-of` YYYY-MM-DD: data di riferimento per le adesioni attive (default: oggi). Per legislature passate usare l'ultima data della legislatura.
Output: `uri`, `title`, `acronym`, `members`, `html_url`

### `senator-group-members list`
Composizione nominativa di un gruppo Senato (URI da `senato-groups list`).
```bash
italianparliament senator-group-members list --group-uri <uri> --legislature 19
```

### `roles list`
```bash
italianparliament roles list --legislature 19
```

### `sessions list`
```bash
italianparliament sessions list --legislature 19
```

### `committees list` (Camera + Senato)
Commissioni parlamentari con categoria (permanente/speciale/inchiesta/comitato) e numero di sedute.
```bash
italianparliament committees list --legislature 19
italianparliament committees list --chamber camera --legislature 19
italianparliament committees list --chamber senato
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

### `group-rank list`
Classifica i gruppi Camera per AIC/DDL con media per membro.
```bash
italianparliament group-rank list --rank-by aic --legislature 19
italianparliament group-rank list --rank-by bills --legislature 19 --limit 10
```

### `rank list`
Ranking parlamentari per attività.
```bash
italianparliament rank list --rank-by aic-primo-firmatario --legislature 19 --limit 20 --format csv
```
`--rank-by` values: `aic-primo-firmatario` | `aic-cofirmatario` | `bills-primo-firmatario` | `bills-cofirmatario` | `speeches` | `sindacato-ispettivo` | `ddl-senato`

### `sparql query`
Query SPARQL libera. Funziona anche senza il sotto-comando `query` (es. `sparql --endpoint ...`).
```bash
italianparliament sparql query --endpoint camera --query "SELECT ?s WHERE { ?s a <...> } LIMIT 10"
italianparliament sparql --endpoint senato --query "SELECT ?s WHERE { ?s ?p ?o } LIMIT 10"
```
