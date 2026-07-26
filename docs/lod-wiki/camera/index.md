# Camera dei Deputati (OCD)

Endpoint SPARQL: `https://dati.camera.it/sparql`. Ontologia OCD (namespace `http://dati.camera.it/ocd/`).

# Entità

* [Sedute e attività delle commissioni](sedute-commissione.md) - `ocd:seduta` per organo e per data; proprietà reali (`dc:date` stringa `AAAAMMGG`, `ocd:rif_organo`, `ocd:rif_leg`) e filtro legislatura obbligatorio.
* [Composizione delle commissioni](composizione-commissione.md) - chi ne fa parte con ruolo e date; due path RDF da unire (`ocd:membro` + `ocd:ufficioParlamentare`), trappola bicamerale sui presidenti senatori (`ocd:rif_senatore`).
* [Data di un intervento in aula](interventi-data.md) - l'intervento non porta la data (`ods:modified` è il timestamp del record); il giorno reale è su `dc:date` della `ocd:discussione` che lo raggruppa (`AAAAMMGG`), verificato per Aula e commissione. Filtro data performante solo con range filter sul soggetto (legislatura obbligatoria).
* [Date degli atti di sindacato ispettivo (aic)](aic-date.md) - `dc:date` è presentazione (a volte composta `pres-modifica`), `ocd:endDate` è conclusione/trattazione; la seduta NON è un link strutturato (numero solo in `dc:description`). Trappola question time.
* [Iter di un atto — timeline degli stati](iter-statoIter.md) - la cronologia dell'iter è una timeline via `ocd:rif_statoIter` (uno stato per fase, `dc:date`+`dc:title`); copertura alla pari tra legislature (18 = 19). Il ramo Senato dà per design solo lo stato corrente (timeline nel feed RSS), asimmetria di ramo non di legislatura.
* [Votazione → atto collegato](votazioni-atto-collegato.md) - `ocd:rif_attoCamera` manca su circa metà delle votazioni e su alcune sedute manca all'intera giornata (es. `s19_689`, legge elettorale). L'atto si ricostruisce dal testo di `dc:description` (ODG: numero centrale di `9/<atto>/<n>`) e, per i voti a codice secco (`EM 1.1077`), solo dalla monotematicità della seduta — 37% delle sedute leg. 19.
* [Voto a scrutinio segreto — dettaglio per-deputato](voto-segreto-dettaglio.md) - su una votazione `secret_vote=true`, `vote-detail` dà nel campo `vote` solo `Ha votato`/`Non ha votato`/`Astensione`, mai `Favorevole`/`Contrario`: il voto segreto è segreto, la scelta individuale non esiste alla fonte. Regola anti-confabulazione per l'LLM (specchio del caso Senato `segreta`).
* [Firmatari di decreti-legge e atti governativi](firmatari-atti-governativi.md) - sugli atti del Governo `ocd:primo_firmatario` punta a un blank node "membro di governo", non a un deputato: il nome del ministro è via `ocd:rif_persona`, il dicastero in `ocd:ruolo`. Senza seguirli il nome torna vuoto.

# Fonti non-LOD (HTML/PDF)

* [getDocumento.ashx — router delle fonti non-LOD](getdocumento-router.md) - il servizio `CommonServices/getDocumento.ashx` serve, cambiando `sezione`/`tipoDoc`, testi dei ddl, schede-attività dei deputati e Bollettini delle Giunte e Commissioni. Mappa delle facce, copertura vs LOD e priorità di integrazione (scraping, non dato strutturato).
* [Convocazioni delle commissioni — agenda prospettica](convocazioni-commissioni.md) - `mobile.camera.it` pubblica l'ordine del giorno FUTURO delle sedute di commissione (data, ora, argomenti+relatore, audizioni con auditi, previsione di voto). Dato prospettico assente dal LOD (tutto consuntivo): colma un vuoto reale, candidata a tool nuovo. Fonte HTML curl-friendly.
* [Votazioni: ricerca HTML e ridondanza schedaVotazione](votazioni-ricerca-html.md) - form di ricerca votazioni per provvedimento (link voto→ddl che manca nel LOD); la scheda di dettaglio è invece ridondante col LOD (`votes` + `vote-detail`).

# Assenti

* [Assenti verificati](assenti.md) - dati che NON esistono nel LOD OCD (emendamenti, …); include la mappa dell'app `apps/emendamenti` (liste, vista per-seduta con esito, endpoint XML indice).
