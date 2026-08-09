# Analisi — fonti non-LOD per arricchire CLI e MCP

Data: 2026-07-10. Analisi delle tre fonti dati non-LOD candidate ad arricchire i tool esistenti, valutate rispetto ai punti di forza e debolezza degli output LOD correnti e agli obiettivi di progetto: MCP-first per giornalisti, nessun download bulk, arricchimento di output esistenti (o nuovi tool con fetch puntuali), nessun tool nuovo per ciò che è derivabile da una pipeline di tool esistenti.

## Contesto

Il gestore del repository LOD della Camera ha confermato (scambio email, luglio 2026) che l'ontologia OCD è ferma al 2009-2011 per la parte centrale e che il RDF è pubblicato a lotti alla ricezione delle triple dai produttori sorgente (vedi [lod-wiki/freschezza-e-autorevolezza.md](lod-wiki/freschezza-e-autorevolezza.md)). Il LOD del Senato ha gap analoghi, verificati sull'endpoint: emendamenti fermi ad agosto 2024, sedute di commissione ridotte a data/tipo, iter DDL limitato allo stato corrente. Il LOD non colmerà questi buchi a breve: le fonti non-LOD ufficiali qui analizzate sono il modo pragmatico di farlo senza attendere i gestori.

## Forza e debolezza degli output LOD correnti

| Area (tool) | Forza LOD | Debolezza LOD | Fonte che colma |
|---|---|---|---|
| Emendamenti Senato (`amendments`) | storico ricco fino ad ago 2024 (Cura Italia: 3.827 em.) | dataset morto dal 2024-08-09 ([wiki](lod-wiki/senato/emendamenti-freschezza.md)); proponente assente dal grafo ([wiki](lod-wiki/senato/emendamenti-firmatario.md)) | B — AKN |
| Testi DDL (`bill-text`) | link e metadati via SPARQL | testo integrale solo via fascicolo PDF dietro WAF; il subcommand `fetch` è CLI-only (agent-browser, non nel Worker) | B — AKN |
| Iter Senato (`bill-progress`) | stato corrente affidabile (`osr:statoDdl`) | 1 sola riga, nessuna timeline — asimmetria con la Camera che ha `ocd:rif_statoIter` | C — RSS |
| Sedute commissione Senato (`committee-sessions`) | interrogabili per commissione+data, conteggio interventi | niente titolo/OdG/link resoconto/orari/veste — confermato dal Webmaster Senato ([wiki](lod-wiki/senato/sedute-commissione.md)) | A — listasommcomm |
| Votazioni Senato mar-apr 2020 | — | assenti dal LOD (#36) | B — AKN resoconti (testo narrativo, serve parsing) |

## Confronto delle tre fonti

| | A. listasommcomm JSON (#33) | B. AKN bulk GitHub (#45) | C. Feed RSS per-DDL (#13) |
|---|---|---|---|
| Cosa copre | sedute commissione Senato: link resoconto, orari, veste, sedute congiunte | emendamenti Senato (anche post-2024) con proponente, testi DDL, resoconti — legislature 13-19, aggiornato quotidianamente | timeline iter dettagliata + esiti voto per singolo DDL |
| Accesso | **WAF AWS** — curl → HTTP 202 vuoto | **niente WAF** — verificato 2026-07-10: file raw HTTP 200 (23 KB), listing web-UI JSON HTTP 200 | **WAF** sul fetch; l'URL è però costruibile al 100% |
| Fetch dal Worker Cloudflare | quasi certamente bloccato (IP datacenter) | atteso OK (GitHub), da confermare post-deploy (stessa classe di verifica di #28) | quasi certamente bloccato |
| URL costruibile senza fetch | lista sì (da URI commissione + leg + anno); link resoconto **no** (`id_testo` sta dentro il JSON) | path al 100% (`Leg<leg>/Atto<8-digit>/...`); filename via `osr:URLTestoXml` (LOD) o listing GitHub | sì — helper `ddlRssUrl` già esistente |
| Rischio bulk | no (1 JSON per commissione/anno) | repo ~1,7 GB → **solo fetch puntuali per-file**, mai clone | no (1 XML per DDL) |

Il criterio discriminante è il WAF: in un progetto MCP-first, dove il target primario è il Worker Cloudflare interrogato da client remoti, una fonte che il server non può fetchare vale solo come **URL emesso in output** (il client la recupera, con browser se serve). L'AKN è l'unica delle tre fetchabile lato server, e per questo domina la classifica.

## Stato del codice rilevante

- `rss_url` è **già emesso** da `bill-progress`, `amendments`, `senato-votes` via `ddlRssUrl` (`src/core/html-url.ts`); manca su `bills` (ramo Senato) e `bill`. L'opportunità 1 della #13 è quindi in gran parte realizzata.
- Esiste un pattern di scraping Worker-compatible collaudato: `camera-amendments.ts` (fetch nativo + UA custom + `cheerio/slim` + validazione anti-bot con errore esplicito "riprovare dalla CLI locale").
- Il pattern per fonti dietro WAF (`src/core/fetch-text.ts`, agent-browser) è **CLI-only** (child_process), strutturalmente non portabile nel Worker.
- Non esiste ancora un helper HTTP condiviso non-SPARQL: da estrarre in `src/core/` alla prima nuova fonte fetchata lato server.

## Raccomandazioni

### P1 — AKN bulk GitHub (#45): l'unica fonte affidabile server-side

Zero WAF significa che funziona in CLI **e** nel Worker/MCP, cioè nel canale primario del progetto.

1. **`amendments` — fallback AKN + proponente.** Per DDL con `dataPresentazione > 2024-08-09` (oggi: vuoto mitigato solo da emptyHint), listare `emend/`/`emendc/` via endpoint JSON della web UI GitHub; con flag opzionale (es. `--with-proponents`) fetch puntuale dei singoli XML per estrarre `an:docProponent`. Valore giornalistico: gli emendamenti dei provvedimenti **correnti** (Piano Casa, decreti 2025-2026), oggi invisibili a qualunque query, tornano interrogabili — con il firmatario, che nel LOD non c'è mai stato. Chiude #38 e #30.
2. **`bill-text` — colonne link AKN raw** (`akn_text_url`, `auth=none`). Accanto ai link WAF-ati del sito, il client riceve un URL del testo machine-readable scaricabile con un semplice curl. Valore giornalistico: leggere il testo presentato di un DDL Senato senza browser né PDF.

Cautele: throttle prudenziale sull'endpoint di listing (non documentato, può cambiare); mai clone o attraversamento ricorsivo del repo; verificare la raggiungibilità di `raw.githubusercontent.com` e dell'endpoint JSON **dal Worker** dopo il deploy.

### P2 — Feed RSS per-DDL (#13): completare l'emissione pura, niente parsing server-side

3. **`rss_url` su `bills` (ramo Senato) e `bill`.** Emissione pura dall'helper esistente, zero fetch, zero costo. Valore giornalistico: da qualunque elenco di DDL si arriva con un click alla timeline dell'iter con gli esiti.
4. **Parsing del feed lato server: no.** Il WAF lo blocca dal Worker; la timeline resta delegata al client (Claude con browser/fetch) o alla skill, che deve documentare il pattern "per l'iter dettagliato Senato usa il feed in `rss_url`".

### P3 — listasommcomm (#33): solo colonna URL + guida nella skill

5. **`committee-sessions` (Senato) — colonna `sommari_json_url`.** Costruibile al 100% dall'URI commissione (`commissione/<tipo>-<cod>` → path) + legislatura + anno della seduta, zero fetch. Il client recupera il JSON e da `id_testo` costruisce il link al resoconto (`show-doc?...&tipodoc=SommComm`).
6. **Fetch server-side del JSON: sconsigliato.** Doppio blocco: WAF, e raccomandazione esplicita del Webmaster di non fare richieste ravvicinate. La pipeline di recupero client-side va documentata nella skill.

### Cose da non fare

- Nessun mirror o download bulk delle fonti (vincolo di progetto; il repo AKN è ~1,7 GB).
- Nessun nuovo tool per ciò che è derivabile: timeline RSS e sommari di commissione si ottengono con gli URL già emessi + fetch client-side. Un tool dedicato duplicherebbe una pipeline a due passi già possibile.
- Nessun parsing dei contatori di voto nei `resaula/` AKN come tool (testo narrativo, formato non garantito tra legislature): resta materiale per advocacy (#36), non per codice.

## Verifiche pendenti

- Raggiungibilità di GitHub (raw + endpoint JSON) dal Worker Cloudflare: testabile solo post-deploy, stessa classe di problema di #28.
- Ipotesi "WAF Senato blocca anche il Worker": data per vera per analogia (IP datacenter), non ancora testata direttamente.

## Aggiornamento 2026-08-09

La premessa "IP datacenter ⇒ bloccato" alla base delle righe qui sopra **è caduta per la Camera**: la #28 è chiusa e `camera-amendments` risponde correttamente dal Worker live (AC 2696 → referente 37, assemblea 25, sia in `countOnly` sia in lista). Quindi `documenti.camera.it` non blocca più il range Cloudflare, e "stessa classe di problema di #28" non è più un pronostico negativo. Le due voci sul WAF **Senato** restano non verificate: là il blocco è di AWS, non della Camera, e nessuna sonda l'ha ancora toccato dal Worker.
