# PRD — italianparliament-mcp

Stato: vivente · derivato dal progetto realizzato · aggiornato 2026-07-12

Documento sintetico di visione e principi. I requisiti di dettaglio e le decisioni tecniche vivono nei documenti collegati in fondo; questo file tiene insieme il "perché" e le regole trasversali che ogni intervento deve rispettare.

## Visione e destinatari

Rendere interrogabili i dati aperti del Parlamento italiano — Camera (`dati.camera.it`) e Senato (`dati.senato.it`) — senza dover conoscere SPARQL né la struttura dei grafi RDF.

Il destinatario primario è il **giornalista parlamentare**; secondari ricercatori e analisti. La conseguenza guida ogni scelta: l'output deve essere verificabile, citabile e pronto per l'analisi, non un dump tecnico. Chi usa lo strumento vuole rispondere a una domanda giornalistica ("chi ha firmato questo ddl?", "come ha votato quel gruppo?") e poterla portare in un articolo.

Tre modalità d'uso: **CLI** da terminale, **MCP server** dentro un client (Claude Desktop/Code), **Worker HTTP** remoto per la prova rapida. L'MCP orchestrato da un agente è il bersaglio principale; la CLI è la stessa capacità esposta a riga di comando e per lo scripting.

## Principi di prodotto

Derivati da come il progetto è stato costruito. Sono vincoli, non aspirazioni.

1. **URL human-readable ovunque possibile.** Accanto all'identificatore tecnico (URI LOD, codice atto) l'output include, quando la risorsa ha una pagina pubblica, un `html_url`/`url` navigabile. Serve al giornalista per verificare alla fonte e per citarlo come link. Vale anche per le fonti non-LOD (scheda votazione, Bollettino, emendamenti). Dettaglio: [prd-human-readable-urls.md](docs/prd-human-readable-urls.md).
2. **Output strutturato e agent-friendly.** Ogni comando restituisce CSV o JSONL pulito; gli errori sono messaggi chiari senza stack trace; naming coerente `risorsa + verbo`. Deve essere leggibile tanto da un umano quanto da un agente che lo pipeline.
3. **CLI e MCP sempre allineati.** Ogni capacità esiste sia come subcommand CLI sia come tool MCP registrato, con lo stesso schema. Un intervento che tocca una delle due facce tocca anche l'altra; entrambe vanno testate.
4. **Niente tool nuovo se il risultato è derivabile.** Se una domanda si risponde componendo i tool esistenti, non si aggiunge un tool o un flag: lo si dimostra con la pipeline. Si aggiunge capacità solo per dati realmente non ottenibili.
5. **Correttezza garantita sulla legislatura corrente (19), best-effort sullo storico.** I pattern e le query sono verificati sulla 19; le legislature precedenti sono esposte ma meno battute. Dove l'incertezza esiste, va resa esplicita, mai nascosta.
6. **Fonti non-LOD solo quando colmano un vuoto reale.** Il perimetro nativo è LOD/SPARQL. Si ricorre allo scraping di fonti HTML/PDF (`documenti.camera.it`, `www.senato.it`) solo per dati **assenti dal LOD** — es. emendamenti Camera (issue #62), audizioni/pareri di commissione, testo dei ddl Senato. Quando una fonte HTML replica un dato LOD già completo (es. le votazioni, coperte fino al voto nominale), **non** si integra: è ridondante.
7. **Advocacy quando il dato manca a monte.** Se l'assenza è strutturale (dato non modellato dal gestore, non un limite di tooling), oltre al workaround si documenta il caso e si propone al gestore di esporlo come dato aperto.

## Requisiti trasversali

- **Verificabilità.** Ogni risultato deve poter essere ricondotto a una fonte ufficiale: URI LOD + URL human-readable.
- **Nessun URL inventato.** Gli URL derivati localmente da un identificatore sono valorizzati solo se il pattern combacia, altrimenti stringa vuota.
- **Uso locale come modalità piena.** Alcune fonti (`documenti.camera.it`, WAF di `senato.it`) bloccano il traffico da datacenter: la copertura completa è garantita da CLI/MCP installati in locale, non dal Worker remoto.
- **Documentazione per il destinatario.** README e guide sono scritti per giornalisti, non per sviluppatori; la conoscenza LOD verificata (trappole, assenze, classi) è consolidata nel wiki `docs/lod-wiki/`.

## Copertura funzionale (aree)

Circa 48 tool raggruppabili per area: **persone** (deputati, senatori, ricerca, carriera, gruppi), **atti e iter** (ddl, firmatari, relatori, progresso, testo), **votazioni** (elenco, dettaglio nominale per deputato, gruppi), **emendamenti** (Senato via LOD; Camera via fonte HTML), **commissioni** (composizione, sedute, audizioni), **sindacato ispettivo**, **governo**, **aggregazioni** (rank, group-rank). Il catalogo puntuale e lo stato di copertura sono nelle gap-analysis collegate.

## Fuori scope / roadmap

- Estrazione del **contenuto** di pagine human-readable oltre al link (testo integrale delle schede).
- Gap aperti prioritari: esito+cofirmatari degli emendamenti Camera (#62), pareri e audizioni di commissione dal Bollettino, copertura storica pre-legislatura 19.

## Documenti collegati

- [docs/prd-human-readable-urls.md](docs/prd-human-readable-urls.md) — spec di dettaglio del principio 1 (persone e atti).
- [docs/user-stories-parlamento.md](docs/user-stories-parlamento.md) — user story giornalistiche.
- [docs/gap-analysis-2026-06-28/](docs/gap-analysis-2026-06-28/) — copertura vs bisogni reali.
- [docs/analisi-fonti-non-lod.md](docs/analisi-fonti-non-lod.md) e [docs/lod-wiki/](docs/lod-wiki/) — fonti, trappole e assenze verificate.
