# LOG

## 2026-06-29

- **`html_url` per le persone** (PRD `docs/prd-human-readable-urls.md`): i tool che restituiscono parlamentari espongono ora l'URL della **scheda istituzionale** accanto all'URI SPARQL. Helper puro `src/core/html-url.ts` (`personHtmlUrl`, zero query): deputato `…/deputato.rdf/d{ID}_{LEG}` → `camera.it/deputati/elenco/{LEG}-{ID}` ; senatore `…/senatore/{N}` → `senato.it/…/scheda-attivita?did={N}`. Cablato in `deputies`, `senators`, `search`, `group-members`, `senator-group-members`, `rank`, `vote-detail`, `senato-vote-detail` (colonna aggiuntiva, nessuna rottura di schema). Verifica end-to-end con agent-browser: `19-307302`→Ascari, `did=32578`→Alfieri, `did=32`→Casellati. Differiti `gov-members`/`person-career` (URI `persona.rdf`, non risolve) e `speeches` (schema misto). Unit test pattern in `html-url.test.ts`; 45/45 test. Scoperti anche: feed RSS per-DDL del Senato con iter dettagliato (issue #13) e gemello S.1822 della legge elettorale.
- **`bill-progress` esteso alla Camera** (parità tool, issue #11): con `--uri <atto Camera>` il tool restituisce ora la **cronologia completa dell'iter** (timeline di tutti gli stati attraversati), non solo lo stato corrente come per il Senato. Modello Camera scoperto via SPARQL: `atto → ocd:rif_statoIter → {dc:date, dc:title=stato}` (DISTINCT obbligatorio per il `rdf:type` duplicato). Routing per host dell'URI (`dati.camera.it` → timeline, `dati.senato.it`/default → lista Senato invariata); **stesso schema colonne** in entrambi i rami (colonne solo-Senato vuote nel ramo Camera, date normalizzate a `YYYY-MM-DD`, `phase`=`C.<id>`). CLI: `bill-progress list --uri …`; MCP auto-registrato via `inputSchema.shape`. Verificato su C.2822 (4 stati: Da assegnare → Assegnato → In corso di esame in Commissione → Concluso l'esame in Commissione) e C.302. Test parità schema in `tools.test.ts`; 41/41 verdi. Nota: il dataset Senato rispecchia lo stato corrente anche di atti Camera (1 riga), la Camera ne dà la storia (N righe).
- **v0.5.2** — **Perf `speeches` (Camera, path legislatura): da ~6s a ~1.8s (3-4×)**. Gli interventi Camera non hanno `ocd:rif_leg` (la legislatura è solo nel pattern URI); il vecchio `FILTER(STRSTARTS(...))` + `ORDER BY DESC(?modified)` impediva l'uso dell'indice sul soggetto e materializzava/ordinava tutti gli interventi (~126k distinti) prima del LIMIT. Riscritto: (1) STRSTARTS → **range filter** `FILTER(?s >= <…in19_> && ?s < <…in19_z>)` che Virtuoso esegue come scansione indicizzata all'indietro fermandosi al LIMIT; (2) ordinamento per `DESC(?s)` (ID intervento = ordine di creazione, proxy della cronologia reale; `ods:modified` era un timestamp di modifica del record); (3) subquery-first con **`GROUP BY ?s`** nell'interna — la tripla `?s a ocd:intervento` è duplicata alla fonte (2× per intervento, COUNT(*)=253354 vs DISTINCT=126677), GROUP BY collassa i doppioni ed è ~2× più veloce di DISTINCT; (4) dedup per uri in TS (modified/relation multi-valore). Path per deputato già selettivo (invariato), Senato invariato. Test `speeches` da 7570ms a 1440ms; suite 40/40.
- **v0.5.1** — allineamento campi `aic` / `sindacato-ispettivo`: su `sindacato-ispettivo` rinominati `tipo`→`type`, `data`→`date`, `numero`→`identifier`, `senatore_uri`→`sponsor_uri`, `legislatura`→`legislature`; aggiunto filtro `keyword` (cerca in label/tipo/numero) e `countOnly`. Su `aic`: `legislature_uri`→`legislature` (numero estratto dall'URI), date normalizzata da `YYYYMMDD` a `YYYY-MM-DD`. Fix TS (comparazione boolean/string su `countOnly`). countOnly Senato implementato con `COUNT(DISTINCT ?s)` diretto (Virtuoso non supporta subquery wrap).
- Nuovo tool **`senato-groups`** [SENATO]: elenca i gruppi parlamentari del Senato con sigla (`acronym`) e numero di componenti distinti (`members`), filtrabile per legislatura. È il parallelo diretto di `groups` (Camera). Query SPARQL con `COUNT(DISTINCT ?sen)` per evitare il doppio conteggio dovuto a senatori con carica interna (Presidente, Tesoriere, ecc.) che hanno due adesioni attive. Output: `uri`, `title`, `acronym`, `members`, `html_url`. Testato: XIX leg. → 9 gruppi, FdI 63, PD-IDP 36, Lega 29. CLI: `senato-groups list --legislature 19`. MCP, skill e README aggiornati.

## 2026-06-28

- **v0.4.1** (patch, doc-only): case study `docs/case-study-salario-giusto.md` (fiducia DL "salario giusto", catena verificata 94+61+2+36=193); avvertenza trasversale sui voti di fiducia Senato (`ddl_uri` vuoto, legame solo nella `label`) in README + 2 skill; fix `src/cli.ts` (versione CLI letta da `package.json` invece dell'hardcoded `0.0.1`). Versione allineata 0.4.1 nei 3 punti; tsc/build/worker puliti; 40/40 test.
- Docs: nuovo case study `docs/case-study-salario-giusto.md` — inchiesta end-to-end sul voto di fiducia del 2026-06-24 per la conversione del DL "salario giusto" (S.1933 / ddl 60201). Catena verificata: legislatures/governments → bill-progress (keyword) → bill-signatories → bill-rapporteurs → senato-votes → senato-vote-detail (voto per gruppo + filtri assenti) → bill-text links/fetch. Tabella voto per gruppo con totali coerenti (94+61+2+36=193). Linkato dal README accanto al box Corte dei Conti.
- Docs/avvertenza trasversale: i **voti di fiducia al Senato hanno `ddl_uri` vuoto** (il legame col DDL è solo nel testo della `label`), quindi `senato-votes list --ddl-uri <uri>` non li restituisce — va filtrato per data seduta (`--date-from`/`--date-to`). Le votazioni "finali" trovate per data possono inoltre appartenere a un atto diverso (testo unificato). Nota aggiunta in README "Note sui dati" + sezione Tips della skill CLI + blocco "Who voted how (Senato)" della skill MCP. Emersa verificando il case study (prima la tabella voti mescolava DDL 60201 e 60220 e citava un `--confidence-vote` inesistente su senato-votes).
- **v0.4.0**: nuove capacità da verifica giornalistica. Relatori Senato in `bill-rapporteurs` (ora Camera+Senato), gruppo di voto in `senato-vote-detail` (voto per gruppo al Senato), timeline gruppi in `person-career`, `group-members` ordinato, `sparql` usabile senza il sotto-comando `query`, pulizia label gruppi Camera. README con esempio d'inchiesta e skill allineate. Dettagli nelle voci sotto.
- **Perf `votes` (Camera): da ~33s a <1s (45×)**. La query usava `FILTER(?rif_leg = …)` su una variabile **OPTIONAL** + `ORDER BY DESC(?date)` con 17 OPTIONAL: Virtuoso materializzava tutte le votazioni di tutte le legislature prima di ordinare/limitare (timeout del test a 30s). Riscritta **subquery-first**: l'interna seleziona/filtra/ordina/limita i soli `?s` (legislatura come triple vincolante; `GROUP BY ?s` + `MAX(?date)` perché alcune votazioni hanno `dc:date` multiplo), l'esterna aggancia i 17 OPTIONAL solo alle righe risultanti; dedup per uri in TS contro la moltiplicazione delle OPTIONAL multi-valore. Tutti i filtri (keyword/approved/confidence/date/bill-code) spostati nell'interna. Test `votes` ora verde in 0.5s; suite 40/40.

- Secondo round dalla stessa verifica giornalistica (gap media/bassa) + esempio d'inchiesta. (1) **`group-members`**: aggiunto `ORDER BY ?deputy_uri ?start_date` → timeline cambi-gruppo in ordine cronologico (prima FDI compariva prima di IV-CR). (2) **`person-career`**: nuovo ramo UNION (`ocd:siComponeDi`) → ora include le righe `kind=gruppo` (appartenenza ai gruppi con date, label pulita via `cleanGroupLabel`), output riordinato per categoria+data. (3) **`sparql`**: shim argv che inserisce il sotto-comando `query` quando manca → `sparql --endpoint senato --query …` funziona (prima mostrava l'help/"Unknown command"); `sparql query …` resta valido, `sparql --help` resta help. (4) Help sotto-comandi: **NON era un bug** — `bills list --help` ecc. mostrano i flag; il falso positivo del report nasceva da zsh (niente word-splitting su `$c`). **Allineamento CLI↔MCP+skill**: `bill-rapporteurs` mancava da entrambe le reference skill (gap pre-esistente) → aggiunto; aggiornate descrizioni di person-career/senato-vote-detail/sparql nelle 2 skill; check automatico: 36/36 tool presenti in CLI+MCP reference. README: nuovo box "Un'inchiesta passo per passo: la riforma della Corte dei Conti" (catena verificata bill-progress→bill-signatories→bill-rapporteurs→senato-votes→senato-vote-detail con voto per gruppo), tabelle aggiornate. tsc --noEmit pulito; 39/40 test (l'unico KO è timeout di rete su `votes`, non legato alle modifiche).
- Due gap "alta priorità" emersi da una verifica giornalistica (3 notizie 2025: riforma Corte dei Conti S.1457, legge IA S.1146-B, cambio gruppo Gruppioni). (1) **Relatori Senato in `bill-rapporteurs`**: prima solo-Camera; ora il ramo è rilevato dall'URI (`dati.senato.it` → query `osr:relatore`, blank node con `rdfs:label`/`tipoRelatore`/`organo`/`dataNomina`/`senatore`, mappati sulle stesse colonne Camera). Es. S.1146-B → Rosa/Minasi (commissione 09/07) + Rosa/Minasi/Mazzella f.f. (assemblea 30/07); Camera invariata (ac19_2316). (2) **Gruppo in `senato-vote-detail`**: nuova colonna `group_label` = gruppo del senatore alla data del voto. Query gruppi separata (logica `senator-group-members` con `asOf` = data seduta) → mappa JS unita ai risultati: le 5 query di conteggio restano invariate (verificato 19-376-2 → 93/51/5 intatti, group_label 100%). Abilita il **voto-per-gruppo al Senato** (es. Corte dei Conti: FdI 49 + Lega 25 + FI 12 fav, PD 27 + M5S 21 contr, IV 5 ast). Analisi in `tmp/analisi-notizie-2025-verifica-cli.md`.
- Fix label gruppi Camera: `rdfs:label`/`dc:title` arrivano troncati alla fonte come `NOME (ACRONIMO) (DD.MM.YYYY` (parentesi sulla data di inizio mai chiusa, sistematico su tutti i gruppi). Nuovo helper `src/core/group-label.ts` (`cleanGroupLabel`) che rimuove la coda ` (data` → resta `NOME (ACRONIMO)`. Applicato a `group-members` (group_label) e `groups` (label + title); acronimo estratto dalla label grezza prima della pulizia, `dcterms:alternative` resta la fonte primaria. Verificato su gr4133 (FDI) e tutti i gruppi leg19.
- Fix README: due domande "Quante interrogazioni..." (xylella, deputato) corrette in "Quali", perché il comando `aic list` elenca (non conta). Per il conteggio resta `--format jsonl | wc -l`.

- v0.3.3 (doc-only): skill CLI/MCP corrette (flag kebab, formato default CSV, parametri voteUri/ddlUri, valori --rank-by completi); README sezione "Uso con un agente AI (skill)" (install cross-agent `npx skills`, consiglio CLI+MCP in coppia con la skill). Republish per allineare la README su npm.

- v0.3.2: fix `groups` acronimo — ora dal campo dedicato `dcterms:alternative` (prima puntava a `ocd:acronimo` inesistente, ripiegando su parsing regex della label). README "Note sui dati" corretta. Spostato l'esempio `member-bills` da "Riferimento" a "Esempi pratici".

- v0.3.1: repo reso pubblico e **pubblicato su npm** come `@aborruso/italianparliament-mcp` (CLI + MCP installabili con `npm i -g`). Aggiunta sezione "Installazione" al README (CLI npm / MCP remoto-locale / da sorgente), `prepublishOnly` in package.json, e step npm in RELEASING.md.
- Affordance di scoperta CLI stile opensdmx: comando `guide` (flusso tipico di orchestrazione: scoperta→URI→dettaglio, catene, opzioni trasversali); comando `which <capacità>` (mappa capacità→comando, es. `which "testo ddl"` → bill-text); errori enum con valori validi via wrapper `runTool` che valida l'input Zod prima di `execute` (prima la CLI chiamava execute senza validare: gli enum errati scivolavano nella query). Solo-CLI, non tool MCP.
- Nuovo tool `person-career` [CAMERA] (gap US-22 + US-31): carriera unificata di una persona via il hub `persona.rdf/p{id}`, che collega tutti i mandati da deputato (per legislatura, join `rif_mandatoCamera`) e gli incarichi di governo (`rif_membroGoverno`), più `owl:sameAs` Wikidata. Risolve doppio incarico parlamento+governo e carriera multi-legislatura. Es. Meloni: 5 mandati (leg15-19) + PM + ministra; Wikidata Q451791. NB: Camera↔Senato non collegabile dai dati (namespace separati, nessun ID condiviso, nessun owl:sameAs sul Senato) → match solo per nome+data nascita (non implementato). Tot tool 36.
- Nuovo tool `committee-sessions` [SENATO] (gap US-28): sedute di commissione in cui un DDL è stato trattato, con data, commissione (`osr:titoloBreve`), tipo seduta e n. interventi. Catena: `osr:Intervento → osr:oggetto → osr:relativoA → ddl` + `osr:Intervento → osr:seduta`. Es. ddl/56260 → 32 sedute (Industria/agricoltura 8, Politiche UE 6, Affari Costituzionali 5...). Tot tool 35.
- Roadmap gap-analysis #1 e #2. (1) `--count-only` su `bills`/`aic`/`votes`/`senato-votes`: restituisce solo il totale (colonna count) per confronti senza scaricare le righe. bills/aic via wrap COUNT del SELECT (veloce su dataset piccoli); votes/senato-votes via count minimale sui soli pattern vincolanti (il wrap con gli OPTIONAL su decine di migliaia di righe va in timeout). Verificato: votes leg19 18587 (0.6s), senato-votes leg19 8030, fiducia 70. (2) Nuovo tool `group-rank` [CAMERA]: classifica i gruppi per AIC/DDL (via gruppo del primo firmatario) con conteggio, membri e media per membro (`count_per_member`). Es. AIC leg19: AVS 4195/12 = 349.6 per membro vs FDI 2714/108 = 25.1. Tot tool 34. #3 (assenteismo) rinviato: il dato grezzo "Non ha votato" è fuorviante (governo/ministri in testa, nessun tipo "missione").
- Fix due bug emersi dalla gap-analysis. (1) `aic --keyword` era accettato dalla CLI ma ignorato (né schema né query lo gestivano): ora filtra davvero su label/titolo/`description` (COALESCE per i campi opzionali). Verificato: `--keyword xylella` → 28/28 risultati pertinenti. (2) `amendments` non aveva filtro per DDL: aggiunto `--ddl-uri` via `osr:oggetto → osr:relativoA` (niente BIND, non supportato da Virtuoso) + colonna `ddl_uri`. Verificato: ddl/56260 → 119 emendamenti.
- Nuovi tool `senato-votes` + `senato-vote-detail` [SENATO]: chiudono il gap n.1 della ripartenza (votazioni Senato). `senato-votes` lista le votazioni d'Assemblea (`osr:Votazione`) con esito, contatori, tipo, data seduta (via `osr:seduta/osr:dataSeduta`, filtro `^^xsd:date`) e DDL collegato (`osr:oggetto → osr:relativoA`); dedup TS per voti su DDL unificati. `senato-vote-detail` dà il voto del singolo senatore via `osr:favorevole/contrario/astenuto/presenteNonVotante/inCongedoMissione` (una query per categoria: Virtuoso non supporta VALUES/BIND); nome via foaf. Gruppo non incluso (membership temporale) → incrociare con `senator-group-members`. Tot tool MCP: 33.
- Gap analysis (ripartenza) in `docs/gap-analysis-2026-06-28/`: re-test mirato dei 16 gap residui di aprile + user story openparlamento, metodo a due agenti (giornalista+developer) con chiamate reali. Copertura framework 33 US: da 17/10/6 a **23 OK / 8 PARZIALE / 2 KO**. Gap n.1 ora: **votazioni Senato** (dato presente, `osr:Votazione` ~63.911 voti leg19, ma nessun tool dedicato — solo via `sparql`). Bug emersi: `aic --keyword` accettato ma ignorato; `amendments` senza filtro DDL. Vecchia analisi marcata archiviata. README: aggiunto openparlamento come riferimento per le esigenze giornalistiche.
- Nuovo tool `bill-text` [CAMERA+SENATO]: link diretti al testo di un DDL, con `format` (html/pdf/urn) e `auth` (none/browser) pensati per un orchestratore. Il testo integrale NON è nei dati SPARQL: il Senato espone solo l'URN `osr:testoPresentato`. Registrato in MCP+CLI (`bill-text links`). Aggiunto anche `member-bills` al server MCP (era solo in CLI).
- Nuovo comando CLI locale `bill-text fetch` (Senato): scarica e converte il testo in markdown. `www.senato.it` è dietro **AWS WAF** (fetch diretto → HTTP 202): apre un browser reale via `agent-browser`, estrae il cookie `aws-waf-token` + UA, scarica il PDF (singolo testo via scraping del tab "Testi ed emendamenti", oppure `--fascicolo` per il dossier completo) e converte con `lit` (liteparse). Opzioni `--which`, `--all`, `--fascicolo`, `--out`. Pulizia soft-hyphen (`&shy;`) per ricongiungere le parole sillabate. Token effimero → preso fresco a ogni run.
- Pattern URL Senato verificati: testo presentato `…/Ddliter/testi/{N}_testi.htm`, fascicolo `…/FascicoloSchedeDDL/ebook/{N}.pdf`, singoli testi `…/service/PDF/PDFServer/BGT/{idDoc}.pdf`; `scheda-ddl?did={N}` con `{N}` = numero in `dati.senato.it/ddl/{N}` (non idDdl). Camera: nessun WAF, pagine fetchabili.
- Skill `italian-parliament-mcp` (v1.1) e `italian-parliament-cli` aggiornate con `bill-text`. Test unitario per `parseTextList`. Totale tool MCP: 31.

## 2026-04-15

- `member-bills` [CAMERA+SENATO]: nuovo tool unificato per DDL come primo firmatario. Camera: filtra `ocd:primo_firmatario` + tipo atto. Senato: pattern `INIZ-DDL-{ddl_id}-{id}` + `osr:primoFirmatario="1"` (REGEX `[^0-9]{id}$` perché Virtuoso non supporta BIND/STRAFTER nidificato).
- `bill` [CAMERA]: aggiunto campo `cosignatories` con tutti i cofirmatari (`dc:contributor`) separati da ` | `.
- `deputy` [CAMERA]: aggiunti `committees`, `election_list`, `election_date`, `election_validated`, `birth_date`, `birth_place`. Nascita via `persona.rdf/p{id}` → `bio:Birth`.
- `senator` [SENATO]: fix `birth_city` (via `bio:birth`→`bio:place`→`rdfs:label`); fix CLI `--legislature` non passato all'execute (mandato sempre leg 19); fix filtro `osr:legislatura` con `FILTER(STR(...))` (era `xsd:integer`, non stringa).

## 2026-04-14

- Nuovo tool `bill-rapporteurs` [CAMERA]: relatori di un DDL per commissione con nome, tipo (Relatore/Relatore f.f.), commissione, data inizio esame e URI deputato. Path SPARQL: atto→rif_dibattito→dibattito→rif_discussione→discussione→rif_relatore. Totale tool: 26.
- Aggiunto campi mandato/elezione a `deputy` (Camera) e `senator` (Senato): `election_region`, `election_district` (solo Camera), `election_type`, `mandate_start`, `mandate_end`. Camera via `ocd:rif_mandatoCamera → ocd:rif_elezione`; Senato via `osr:mandato` filtrato per legislatura.
- Aggiunto campo `description` al tool `votes` (Camera): `dc:description` contiene il testo reale della votazione (es. "Votazione Fiducia A.C. 2807-A"), mentre `label` e `title` sono spesso vuoti. Utile soprattutto con `--confidence-vote true`.
- Aggiunto parametro `--bill-code` al tool `votes` (Camera): filtra votazioni collegate a un DDL per numero atto (es. `--bill-code 2807`). Restituisce fiducia, voto finale e ordini del giorno. Combina con `--legislature` per evitare falsi positivi tra legislature.

## 2026-04-13

- Gap analysis giornalista vs MCP: 33 user stories testate con tool reali. 13 OK, 14 PARZIALI, 6 KO. Documenti in `docs/gap-analysis-2026-04-13/`.
- Fix `group-members`: campo `start_date` conteneva inizio+fine concatenati (`20221018-20240916`), `end_date` sempre vuoto. Ora split su `-` con date separate.
- Aggiunto filtro `region` al tool `deputies`: filtra per circoscrizione/regione con CONTAINS case-insensitive su election_label. Testato: sicilia, lombardia. Circoscrizioni estero: AFRICA, AMERICA, EUROPA.
- Aggiunto campo `description` al tool `aic` (Camera): contiene il testo/oggetto dell'interrogazione, interpellanza o mozione. Il Senato (sindacato-ispettivo) non espone l'oggetto nell'endpoint SPARQL.
- Tool `rank` esteso al Senato: 2 nuove dimensioni `sindacato-ispettivo` e `ddl-senato`. Aggiunto campo `chamber` nell'output. Top Senato atti ispettivi: Camusso 786, Rojc 753. Con `--order asc`: Casellati, Bernini, Durigon con 1 atto. Totale dimensioni rank: 7 (5 Camera + 2 Senato).
- Nuovo tool `committee-members` [CAMERA+SENATO]: composizione commissioni con ruoli. Camera: `ocd:ufficioParlamentare` con `carica` (PRESIDENTE, VICEPRESIDENTE, SEGRETARIO, CAPOGRUPPO, COMPONENTE). Senato: `osr:Afferenza` + `osr:afferisce` con `carica` (Presidente, Membro, ecc.). Parametro `chamber: camera|senato|both`, filtrabile per commissione, parlamentare, legislatura, activeOnly. Totale tool: 25.
- Fix `sindacato-ispettivo`: campo `presentatore` e `senatore_uri` ora sempre popolati (anche senza filtro senatore). Riscrittura query con `GROUP BY` + `MIN()` per evitare duplicati da join multi-firmatario. Subquery non supportata da Virtuoso Senato, usato MIN su tutti i campi.
- Sprint 1 (6 quick wins):
  - `keyword` su `bills`, `bill-progress`, `votes`: ricerca full-text nei titoli DDL e votazioni. Cerca in title+label (OR).
  - `confidenceVote` su `votes`: filtra votazioni di fiducia. 10 fiducie leg19 testate.
  - `dateFrom`/`dateTo` su `sessions`: filtra sedute per data.
  - `deputyUri` su `group-members`: storia cambi gruppo di un singolo deputato. Testato con Enrico Costa (Azione→FI).
  - `order: asc|desc` su `rank`: ordinamento inverso per trovare i meno attivi. asc mostra ministri con 4 speeches.
  - `initiative` su `bills`: filtra per iniziativa (Popolare/Governo/Parlamentare/Regioni). Tutti e 4 testati.

## 2026-04-12 (aggiornamento 8)

- Nuovo helper `src/core/decode-html.ts`: rimuove `^^xsd:type`, decodifica entità HTML (`&quot;`, `&rsquo;`, `&agrave;`, ecc.), rimuove tag HTML (`<em>` ecc.).
- Applicato a `bills` su campi `label` e `title`. Titoli ora leggibili.
- Deploy worker aggiornato.

## 2026-04-12 (aggiornamento 7)

- Fix `vote-detail`: aggiunto campo `deputy_name` (nome leggibile) alla query. Usato `rdfs:label` con URI completo (Camera rifiuta prefisso `rdfs:`). Suffisso legislatura rimosso con `stripLegLabel`.
- Deploy worker aggiornato.

## 2026-04-12 (aggiornamento 6)

- Fix dedup `bills`: blank node multipli su `primo_firmatario` governativi → aggiunto `FILTER(!isBlank(?sponsor_uri))`. DDL governativi ora hanno `sponsor_uri` vuoto (corretto).
- Fix dedup `sindacato-ispettivo`: join su `osr:iniziativa` produceva N righe per N firmatari → rimosso join quando nessun filtro senatore. `senatore_uri`/`presentatore` vuoti nella lista generale, presenti solo quando si filtra per senatore.
- Deploy worker aggiornato.

## 2026-04-12 (aggiornamento 5)

- Fix bug `rank`: senatori comparivano nella classifica Camera perché `legFilter` non vincolava `?person a ocd:deputato`. Aggiunto il tipo esplicito in entrambi i rami (con e senza legislatura).
- Deploy worker aggiornato.

## 2026-04-12 (aggiornamento 4)

- Aggiunto filtro `dateFrom`/`dateTo` (YYYY-MM-DD) a 4 tool: `votes`, `aic`, `bills`, `sindacato-ispettivo`.
- Aggiunto `ORDER BY DESC(?date)` su tutti e 4 i tool — le più recenti escono per prime.
- Fix: Senato usa `xsd:date` tipizzato → FILTER con `"data"^^xsd:date` (non plain string).
- CLI: aggiunto `--date-from`/`--date-to` nei 4 subcommand corrispondenti.
- Testato: votes leg19 dal 1 apr 2026 → seduta 641 del 9 apr; sindacato-ispettivo dal 1 apr → interrogazione 3-02528 del 10 apr.

## 2026-04-12 (aggiornamento 3)

- Nuovo tool `sindacato-ispettivo` [SENATO]: equivalente Senato degli AIC Camera (interrogazioni, interpellanze, mozioni, risoluzioni).
- Filtrabile per legislatura, senatore URI, tipo atto.
- Fix: `BIND` non supportato su Virtuoso Senato → sostituito con `FILTER(?senatore_uri = <URI>)`.
- Fix: legislatura come triple pattern diretto (`?s osr:legislatura 19`) non OPTIONAL+FILTER.

## 2026-04-12 (aggiornamento 2)

- Nuovo tool `rank` [CAMERA]: classifica deputati per attività parlamentare in una sola chiamata.
- 5 dimensioni: `aic-primo-firmatario`, `aic-cofirmatario`, `bills-primo-firmatario`, `bills-cofirmatario`, `speeches`.
- Evita N batch da 1000 righe: GROUP BY lato SPARQL, risposta diretta top-N.
- Fix trovato: prefisso `PREFIX rdfs:` causa errore silenzioso su endpoint Camera — usare URI completo `<http://www.w3.org/2000/01/rdf-schema#label>`.

## 2026-04-12 (aggiornamento)

- Nuovo tool `senator-group-members` [SENATO]: membri attivi di un gruppo parlamentare del Senato.
- Default `asOf = oggi`; opzionale `--as-of YYYY-MM-DD`, `--legislature`, `--group-uri`.
- Schema Senato differisce dalla Camera: `ocd:aderisce` (direzione inversa), label gruppo via blank node `osr:Denominazione` con storico nomi filtrato per data.

## 2026-04-12

- Fase 6 batch 3: +4 tool Camera (`speeches`, `aic`, `vote-detail`, `group-members`). Totale tool: 17/24.
- Fix `vote-detail`: la query R usava `ocd:voto` come proprietà ma non esiste — il valore del voto è in `dc:type`. Scoperto con query esplorativa sulle proprietà reali del triplo.
- `speeches`: dati disponibili solo per legislatura 17, molti campi opzionali vuoti (limite dati upstream Camera).
- README aggiornato con riferimento al repo upstream [`italyParlR`](https://github.com/paride92/italyParlR).
- README riscritto in italiano per giornalisti parlamentari (tabella comandi, esempi pratici, note sui limiti dati).
- Verifica completa dei 17 tool, 3 fix applicati:
  - `groups`: acronimo ora estratto dalla label con regex (era campo vuoto nell'endpoint).
  - `roles`: proprietà corretta `ocd:ruolo` invece di `dc:type` (VICEPRESIDENTE, SEGRETARIO, ecc. ora popolati).
  - `sessions`: filtro `STRSTARTS` per escludere bollettini (`BF_*`), ora solo sedute formali con numero progressivo.
  - `speeches`: riscritto completamente. `rif_leg`/`dc:date`/`rif_seduta` non esistono; la legislatura è nell'URI (`in19_`), filtro con `STRSTARTS`. Ora funziona per tutte le legislature (>1M interventi totali). Colonne: uri, label, deputy_uri, document_url, modified.
  - `deputy/senator/bill show`: riscritti con query mirate invece di triple RDF grezze. Output ora con campi leggibili (first_name, last_name, gender, photo, ecc.). Deputy usa `foaf:firstName`/`foaf:surname`/`foaf:gender`.
  - `governments`: riscritta query, ora interroga direttamente `ocd:governo` con `dc:date`. Ordinamento cronologico DESC (Meloni→Draghi→Conte II→...). Aggiunto campo `start_date`.
- Fase 6 batch 4: +5 tool (`gov-members`, `committees`, `bill-progress`, `bill-signatories`, `amendments`). Totale tool: 22.
  - `gov-members`: membri del governo con nome persona, ruolo (MINISTRO, SOTTOSEGRETARIO, ecc.), date, motivo termine. Cerca per nome.
  - `committees`: 279 commissioni Senato (permanenti, speciali, d'inchiesta).
  - `bill-progress`: iter DDL Senato con stato, date, iniziativa, natura. Dati freschi (DDL del 10 aprile 2026).
  - `bill-signatories`: firmatari DDL Senato con primo firmatario/cofirmatari e link senatore.
  - `amendments`: 53K emendamenti Senato leg 19, con link al testo.
- `documents` Camera (`ocd:documento`): 0 istanze nell'endpoint. Nessun tipo documento alternativo trovato. Senato ha `osr:Documento` (48K), implementato.
- `documents` Senato: atti del governo, atti UE, relazioni Corte dei Conti, risoluzioni commissioni. Dati freschi (9 aprile 2026).
- `committees`: migliorato con filtro legislatura via SedutaCommissione. Con `--legislature 19` mostra 12 commissioni attive con conteggio sedute (Affari Costituzionali: 681 sedute). Senza filtro mostra catalogo storico (279).

## 2026-04-11

- Commit root: 26 file (Fase 0-4).
- Fase 6 batch 1: +4 tool Camera (`legislatures`, `groups`, `sessions`, `governments`). Query portate da `italyParlR` (clone in `tmp/`). Type check pulito. Smoke test CLI reali verdi su tutti e 4. Totale tool: 9/24.
- Fase 6 batch 2: +4 tool dettaglio (`deputy`, `senator`, `bill` property/value; `roles` Camera con filtri deputy/group/legislature). Totale tool: 13/24.
- Refactor obbligato: `makeHandler` in `src/index.ts` passato da `<I>` generico a `any` perché a 13 tool la generic instantiation combinata Zod × MCP SDK × helper mandava `tsc` in OOM (FATAL heap limit) anche con `--max-old-space-size=4096`. Con handler non generico il type check torna pulito.
- Nota su `deputy`: rimossa la `z.refine()` sullo schema (produceva `ZodEffects` senza `.shape`, incompatibile con `registerTool` MCP). Validazione ora dentro `execute()`.

- Repo creato. Fase 0 completata.
- Struttura: `src/core/`, `src/tools/`, entrypoint previsti `src/cli.ts`, `src/index.ts`, `src/worker.ts`.
- Stack: TypeScript + citty + axios + zod + @modelcontextprotocol/sdk.
- Scripts `package.json` clonati da `ckan-mcp-server`: build (esbuild cli+index), build:worker, build:dxt, pack:skill, deploy.
- Paradigma vincolante: CLI agent-friendly (non-interattiva, flag+stdin, errori actionable, output machine-readable, no emoji).
- Naming CLI: `italianparliament <resource> <verb>`.
- Fase 1 COMPLETATA: `src/core/` con `endpoints.ts`, `prefixes.ts` (OCD/OSR copiati da italyParlR), `types.ts` (SparqlResults, Row), `flatten.ts` (flattenBindings), `client.ts` (cdQuery/snQuery con axios, retry, SparqlError), `format.ts` (toCsv/toJsonl), `index.ts` barrel.
- Endpoint: Camera `https://dati.camera.it/sparql`, Senato `http://dati.senato.it/sparql`. Timeout 60s, retry 3.
- Test vitest: 10/10 passati (flatten + format). Type check pulito.
- Smoke test reale contro Camera SPARQL (SELECT ?s ?label WHERE Person LIMIT 3) → OK end-to-end.
- Fase 2 COMPLETATA: 5 tool MVP in `src/tools/` (deputies, senators, bills, votes, search) + `types.ts` (Tool interface con name, description, inputSchema Zod, examples, execute) + `index.ts` (barrel + toolsByName).
- Ogni tool: schema Zod per input, lista `columns` per output stabile, `execute()` che chiama cdQuery/snQuery → flattenBindings → riga rinominata secondo naming coerente (uri invece di s, legislature_uri invece di rif_leg, in_favour/against/abstentions per i voti, ecc.).
- Fix importanti scoperti durante smoke test:
  - Endpoint Senato aggiornato a HTTPS (il vecchio http://dati.senato.it/sparql redirige e il redirect mangia le `{}` della query).
  - Formato response: `format=application/json` + `Accept: application/json` (il vecchio `application/sparql-results+json` restituisce 406 su Senato).
  - `User-Agent` custom obbligatorio su Senato (default axios → 403 CloudFront).
- Smoke test reale verde su Camera (deputies leg 19), Senato (senators leg 19), search (Camera "meloni"). 10/10 vitest ancora verdi, type check pulito.
- Fase 3 COMPLETATA: `src/cli.ts` con citty. Pattern `italianparliament <resource> <verb>`: `deputies list`, `senators list`, `bills list`, `votes list`, `search find`. `--help` per ogni subcommand include sezione Examples con invocazioni copiabili. `--format csv|jsonl` su tutti (default csv, machine-readable, no colori/emoji). Errori fail-fast: `--limit abc` → "Invalid --limit value. Expected a positive integer", argomento required mancante → citty mostra help + errore. Catch top-level gestisce `SparqlError` con endpoint/status.
- Test reali verdi: deputies, senators, search, jsonl output, error handling.
- Fase 4 COMPLETATA: `src/index.ts` — MCP stdio server con @modelcontextprotocol/sdk. `McpServer` + `StdioServerTransport`. Registrazione esplicita (non loop) dei 5 tool via `registerTool(name, {description, inputSchema: tool.inputSchema.shape}, handler)`. Helper `makeHandler` generic per catturare SparqlError/Error e restituire `isError: true`. Output in formato JSONL via `toJsonl`.
- Nota TS2589: il loop generico su `tools[]` generava "Type instantiation is excessively deep". Fix: chiamate registerTool esplicite per ogni tool.
- Test stdio end-to-end: initialize + tools/list → 5 tool con JSON Schema completo da Zod (properties, required, default, enum). tools/call `search {name:"meloni",chamber:"camera",limit:2}` → 2 righe JSONL da Camera SPARQL reale.
- Prossimo: Fase 5 — Cloudflare Worker (`src/worker.ts` con MCP HTTP server clonando pattern da ckan-mcp-server).
