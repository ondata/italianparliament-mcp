# LOG

## 2026-06-28

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
