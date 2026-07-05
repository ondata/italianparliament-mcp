---
title: "Audizioni e soggetti auditi alla Camera: relazione e proposta ai gestori del LOD"
description: "Perché e come strutturare l'audito nel LOD della Camera dei deputati — sintesi di analisi tecnica, benchmark internazionale e impatto civico, con una richiesta concreta a Camera/Synapta."
audience: gestori dati Camera dei deputati (assistenza-dati@camera.it) e Synapta; giornalisti; società civile
timestamp: 2026-07-03
---

Relazione e proposta

Come rendere le audizioni parlamentari della Camera monitorabili strutturando chi vi è audito

---

## In una frase

La Camera dei deputati **scrive già** chi ascolta — nome, ruolo ed ente dell'audito sono riportati per esteso nel titolo di ogni audizione — ma quel dato **vive come stringa di testo, non come entità**. Non manca l'informazione: manca la sua struttura. Esporla come triple RDF non richiede al publisher di raccogliere nulla di nuovo, solo di rendere leggibile a macchina ciò che già redige a mano. È una richiesta minima nella forma e massima nell'effetto.

Questo documento è la sintesi di tre approfondimenti allegati:

- **[01 — AS-IS / TO-BE tecnico](01-as-is-to-be-sparql.md)**: come sono modellate oggi le audizioni nel LOD (OCD), i limiti misurati su dati reali, e lo schema RDF proposto.
- **[02 — Benchmark internazionale](02-benchmark-web.md)**: come USA, Regno Unito e UE strutturano l'audito e lo strato-lobby; lo stato del Registro dei rappresentanti di interessi della Camera e della legge A.C. 2336.
- **[03 — Perché conta (impatto civico)](03-perche-conta-civico.md)**: le domande giornalistiche che la strutturazione sblocca, le storie-tipo e l'angolo di campagna.

Destinatari della proposta: i **gestori del dato della Camera** (`assistenza-dati@camera.it`) e **Synapta**, che cura il grafo. Il focus operativo è la Camera; il Senato è citato come gap (non modella affatto audizioni né auditi).

---

## 1. Il fatto: il dato c'è, ma è muto

Nella legislatura XIX la Camera espone via SPARQL le audizioni di commissione lungo la catena `ocd:seduta → ocd:dibattito → ocd:discussione`. La natura "audizione" e l'identità dell'audito vivono nel `dc:title` della `ocd:discussione`, in chiaro:

> *"Audizione di **Michele Di Bari, prefetto di Napoli**"*
> *"Audizione informale … di **Paolo Bonetti, professore di diritto costituzionale**, … e di **rappresentanti dell'ASGI**, nell'ambito dell'esame del disegno di legge **C. 750**"*

Numeri verificati sull'endpoint (2026-07-03):

- **3.311** discussioni distinte leg. XIX con "audiz" nel titolo (via `ocd:dibattito → ocd:rif_discussione`). *Nota metodologica:* la stessa query senza `DISTINCT` restituisce 6.636 righe, per un `rdf:type` del dibattito memorizzato 2× nel grafo: `6.636 = 2 × 3.318` coppie distinte dibattito–discussione; le discussioni distinte sono **3.311** (poche sono collegate a due dibattiti). Il numero reale di eventi è **~3,3k**; qualunque conteggio va fatto in `DISTINCT`.
- **935** con la formula pulita `"Audizione di <nome>"`, complete di data e link al bollettino.
- Precedente storico: nella **leg. XIV** esisteva un tipo dedicato `dc:type = "Audizioni informali"` (619 dibattiti), **mai più usato** dalla leg. XV in avanti.

Il limite è strutturale, non di copertura: per rispondere a *"chi è stato audito, quante volte, su quale atto, per quale categoria di interesse"* servono oggi filtri testuali fragili (`CONTAINS`) e un parsing NLP del titolo. **Nessuna di queste domande è esprimibile come pattern di triple.**

### I quattro anelli mancanti

| # | Anello | Stato oggi |
|---|---|---|
| 1 | Audito come **entità/URI** | Solo stringa nel titolo. `ocd:rif_persona` — proprietà **esistente e usata su 45.808 discussioni** — non è mai valorizzata sulle audizioni. |
| 2 | **Categoria** dell'audito (impresa/sindacato/associazione/PA/esperto…) | Assente. L'informazione è nel testo, non normalizzata. |
| 3 | Link audito → **atto discusso** | Parziale: `ocd:rif_attoCamera` collega l'*evento* all'atto (sede referente), mai il *soggetto*; nelle inchieste l'atto manca. |
| 4 | Link audito → **Registro dei rappresentanti di interessi** | Assente in radice: anche il Registro è oggi un elenco HTML, non dato aperto. |

---

## 2. La lezione del mondo: l'audito è un'entità, e porta con sé i suoi conflitti

Il [benchmark internazionale](02-benchmark-web.md) mostra che gli anelli mancanti alla Camera sono altrove uno standard consolidato:

- **Stati Uniti (Congresso)** — il modello più avanzato. Ogni testimone è un'**entità tipizzata via API** (nome, posizione, organizzazione, `witness_type` governativo/non governativo). E porta con sé, per obbligo di regolamento, il **"Truth in Testimony"**: un modulo pubblico che dichiara finanziamenti e contratti federali (36 mesi) e pagamenti da governi stranieri. *Il conflitto di interesse è dentro il dato, non fuori.*
- **Regno Unito (select committee)** — testimonianze pubbliche, **permanenti e ricercabili per nome del testimone**; trasparenza sostanziale, anche senza tipizzazione via API.
- **Unione europea** — non struttura gli auditi ma è il riferimento per lo **strato-lobby**: Registro per la trasparenza obbligatorio (condizionalità, dal 2021), dato aperto, da cui nascono spontaneamente strumenti civici come **Integrity Watch** (TI EU) e **LobbyFacts**.

Attenzione a non confondere i due strati: USA e UK mostrano **come tipizzare l'audito**; UE e i registri nazionali mostrano lo **strato-lobby a cui l'audito andrebbe agganciato**. La proposta non è unire due dataset (in Italia nessuno dei due è strutturato), ma strutturarli entrambi e collegarli tramite un'**entità-soggetto condivisa**.

### La finestra italiana

- La Camera ha un **Registro dei rappresentanti di interessi** dal 2017: pubblico ma solo HTML, solo Camera, senza forza di legge, non open data.
- Il **29 gennaio 2026** la Camera ha approvato **A.C. 2336** (registro obbligatorio presso il CNEL + agenda incontri), ora al Senato. Ma **esclude partiti e sindacati/datoriali** (TI Italia: *"la Camera salva Confindustria"*) e **non impone di strutturare le audizioni nel LOD**: il buco sull'audito resterebbe comunque.

È il momento giusto per la richiesta tecnica: mentre il legislatore discute la trasparenza del lobbying, strutturare l'audito nel LOD è il tassello a costo più basso e più immediatamente realizzabile.

---

## 3. La proposta: due mosse di riuso, non una nuova ontologia

Principio guida: **riuso, non rivoluzione**. Non serve una nuova ontologia; bastano due mosse coerenti con OCD e con ciò che la Camera **già faceva** in leg. XIV (dettaglio tecnico e Turtle completo in [01](01-as-is-to-be-sparql.md)).

**Mossa A — ripristinare un `dc:type` dedicato.** Valorizzare `dc:type = "Audizione"` (o `"Audizione informale"`) sulla `ocd:discussione`, come già in produzione in leg. XIV. Costo di raccolta dati: **zero** — la natura audizione è già nel titolo. Effetto: le audizioni diventano selezionabili con un pattern di triple, senza `CONTAINS` testuali.

**Mossa B — l'audito come entità, popolando slot già previsti.** Valorizzare `ocd:rif_persona` (oggi vuoto sulle audizioni ma vivo altrove) con un'entità `ocd:soggettoAudito`: `foaf:name`, qualifica, ente/organizzazione, **categoria** da tassonomia SKOS (governo · PA · autorità · impresa · associazione di categoria · sindacato · ONG/terzo settore · esperto-accademico · altro), e link all'atto. Il testo per popolare questi nodi è **già nel `dc:title`**.

Con questo schema, domande oggi impossibili diventano una `SELECT`: *"tutte le imprese audite sull'atto C. NNN"*, *"quante volte è stata audita l'associazione X in legislatura"*, *"quali categorie di soggetti ha ascoltato la Commissione Trasporti"*.

### La richiesta ai gestori (in ordine di priorità e costo crescente)

1. **`dc:type = "Audizione"`** sulla `ocd:discussione` (leg. XIX+), come già in leg. XIV. *Costo minimo, sblocco massimo.*
2. **Popolare `ocd:rif_persona`** con l'entità dell'audito (almeno `foaf:name` + qualifica): dati che il publisher **già scrive**.
3. **Collegare l'audito all'atto** (`ocd:rif_attoCamera` a livello di soggetto) per le audizioni in sede referente/consultiva.
4. **Correggere il buco di `dc:date`** sulle audizioni informali (Pattern B), oggi spesso vuoto — bug di qualità documentato.
5. *(auspicabile)* **Categoria controllata** dell'audito e link verso il Registro dei rappresentanti di interessi.

Argomento chiave: *non si chiede di raccogliere nuovi dati, ma di esporre come triple ciò che la Camera già redige in forma testuale.* Il precedente della leg. XIV dimostra che il modello dedicato era già alla portata del publisher.

> **Nota-ponte (nel frattempo, a valle).** In attesa dell'adeguamento a monte, il progetto italianparliament-mcp può ricostruire la struttura via arricchimento locale — estrazione SPARQL (già nel tool `audizioni`) → NER dal titolo → classificazione → entity resolution verso Wikidata e il Registro. È una **dimostrazione di fattibilità**, non un sostituto: è fragile per costruzione (ogni cambio di stile del titolo rompe il parsing), ed è proprio questa fragilità a motivare la strutturazione a monte. Dettaglio in [01 §Nota-ponte](01-as-is-to-be-sparql.md).

---

## 4. Perché conta: da archivio di testi a sistema di accountability

Strutturare l'audito non aggiunge informazione: rende **contabile, confrontabile e seguibile nel tempo** ciò che oggi nessuno può misurare ([impatto civico completo in 03](03-perche-conta-civico.md)). Il filo è **follow-the-influence**: dall'audito all'atto, dall'atto al registro dei portatori di interessi, dal registro alle porte girevoli.

Domande oggi senza risposta automatica che si aprirebbero:

- Chi sono i **soggetti più auditi** della legislatura, e quali **categorie dominano**?
- Un'azienda è stata audita **sul provvedimento che la regola direttamente**? (conflitto d'interessi)
- C'è **squilibrio di accesso** tra interessi economici e società civile su un tema dato?
- Un audito compare poi tra i **nominati** in incarichi pubblici? (porte girevoli — ricostruibile incrociando `person-career`, `gov-members`, `roles` del progetto MCP)

Chi userebbe il dato: giornalisti d'inchiesta (da "credo ci sia uno squilibrio" a "questi sono i numeri"), ricercatori, watchdog (**The Good Lobby** ha già mappato *a mano* le audizioni informali come lobbying: la strutturazione automatizza e rende ripetibile quella pipeline), cittadini e comitati, e gli stessi parlamentari per documentare l'equilibrio delle proprie audizioni.

---

## 5. Call to action

1. **Ai gestori del dato della Camera / Synapta** — adottare le Mosse A e B (§3). È lo scatto tecnico a costo più basso e con il maggior ritorno di trasparenza: rendere leggibile a macchina e collegabile ciò che la Camera già pubblica.
2. **Al Senato** — colmare il divario: oggi non modella né le audizioni né un registro. La Camera diventa lo standard; al Senato si chiede di allinearsi.
3. **Alla società civile e alle redazioni** — dimostrare il valore *prima* della regola: pubblicare classifiche degli auditi e indici di pluralismo ricostruiti già oggi dai titoli grezzi, come prova che il dato è utile e maturo. È la base della campagna **"Chi ascolta il Parlamento?"**.

La leva è sempre la stessa: nessuna di queste richieste costa dati nuovi né tocca il merito delle audizioni. Chiede solo di rendere strutturato, e collegabile, ciò che il Parlamento **già scrive**.

---

*Documento sintesi. Approfondimenti tecnici, fonti e query verificabili nei file 01, 02, 03 di questa cartella. Analisi SPARQL ancorata a query live su `https://dati.camera.it/sparql` (2026-07-03); benchmark ancorato a fonti web citate; numeri degli scenari giornalistici dichiarati illustrativi dove non verificati su SPARQL.*
