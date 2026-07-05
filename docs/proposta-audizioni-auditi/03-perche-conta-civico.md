# Perché conta: l'impatto civico delle audizioni strutturate

Oggi la Camera pubblica oltre 3.300 audizioni della legislatura XIX (3.311 discussioni distinte con "audiz" nel titolo; ~935 nella forma pulita "Audizione di <nome>") in cui, dentro il titolo, è scritto chi viene ascoltato e in quale veste: *"Audizione di Michele Di Bari, prefetto di Napoli"*. È un'informazione preziosa, ma è una stringa di testo. L'audito non è un'entità: non è tipizzato per categoria (impresa, sindacato, associazione, ente pubblico, esperto), non è collegato all'atto o al DDL su cui viene sentito, non è agganciato al Registro dei rappresentanti di interessi della Camera. Trasformare quella stringa in dato strutturato non aggiunge un'informazione nuova: rende **interrogabile** un'informazione che c'è già ma che oggi nessuno può contare, confrontare, seguire nel tempo.

Questo documento non descrive *cosa* costruire (lo fanno i documenti tecnici 01 e 02): descrive **perché conta** per giornalisti, ricercatori e cittadini. Il filo conduttore è uno solo: **follow-the-influence** — dall'audito all'atto discusso, dall'atto al registro dei portatori di interessi, dal registro alle porte girevoli.

---

## 1. Le domande civiche che oggi non si possono rispondere

Chi entra al Parlamento a portare la propria voce lo fa in una stanza di cui, oggi, non esiste il registro degli ingressi leggibile a macchina. Ecco le domande che la strutturazione sblocca — tutte oggi senza risposta automatica:

- **Chi sono i soggetti più auditi di questa legislatura?** Non un elenco di titoli, ma una classifica di enti e persone per numero di audizioni.
- **Quali categorie dominano?** Imprese e loro associazioni di categoria, sindacati, ordini professionali, società civile e comitati, enti pubblici, mondo accademico: qual è la composizione reale di chi viene ascoltato?
- **Un'azienda (o la sua lobby) è stata audita sul provvedimento che la regola direttamente?** È la domanda del conflitto d'interessi. Oggi si può scoprire solo leggendo a mano centinaia di resoconti.
- **Quante volte una singola associazione, azienda o federazione è stata ascoltata** in un arco di tempo, e da quali commissioni?
- **C'è squilibrio di accesso** su un tema dato — energia, sanità, delivery, intelligenza artificiale — tra portatori di interessi economici e associazioni di consumatori o della società civile?
- **Un audito compare poi tra i nominati** in incarichi pubblici, consulenze, autorità? È la domanda delle porte girevoli (*revolving door*).
- **Chi è iscritto al Registro dei rappresentanti di interessi della Camera compare tra gli auditi?** E viceversa: chi viene audito ripetutamente in veste di portatore di interessi è iscritto al registro?

Nessuna di queste domande richiede dati nuovi. Richiede solo che l'audito diventi un'entità collegata all'atto e alle altre banche dati parlamentari.

---

## 2. Storie-tipo giornalistiche

I numeri e i nomi che seguono sono **scenari illustrativi dichiarati tali**: servono a mostrare la forma dell'inchiesta che il dato strutturato renderebbe possibile con una query invece che con settimane di lettura manuale.

**a) L'azienda audita sul decreto che la riguarda.** Un operatore del settore energetico viene ascoltato cinque volte, tra Camera e commissioni competenti, sullo stesso decreto che ridisegna le regole del suo mercato — mentre le associazioni dei consumatori compaiono una sola volta. Oggi questa asimmetria è invisibile: è sepolta in cinque titoli di audizione diversi, in date diverse, dentro resoconti separati. Con l'audito come entità collegata all'atto, diventa un grafico.

**b) La federazione ascoltata quaranta volte, i consumatori due.** Su un fascio di provvedimenti in materia di lavoro delle piattaforme, un'associazione datoriale di categoria risulta audita decine di volte nell'arco della legislatura, mentre le associazioni che rappresentano i lavoratori o gli utenti compaiono una manciata di volte. La storia non è "hanno fatto lobbying" — è perfettamente legittimo essere auditi — la storia è **la sproporzione di accesso**, quantificata per la prima volta.

**c) Il consulente che passa da audito a nominato.** Un esperto viene sentito ripetutamente come tecnico indipendente su una riforma; qualche mese dopo compare tra i componenti di un organismo pubblico o come consulente ministeriale sullo stesso tema. Incrociando il nome dell'audito con `person-career`, `gov-members` e `roles` del progetto MCP, il percorso audito → nominato diventa ricostruibile automaticamente. Questa non è un'accusa: è un **metodo** per rendere tracciabili le porte girevoli e distinguere i casi che meritano una domanda pubblica.

**d) Il monopolista invisibile del tema.** Su un tema tecnico e poco mediatico — poniamo la revisione di uno standard o di una filiera — un solo soggetto industriale risulta l'unico auditato per mesi. Nessuno se n'era accorto perché il tema non fa notizia. La classifica automatica degli auditi per tema fa emergere proprio i casi che sfuggono all'attenzione: dove *l'assenza di pluralità* è essa stessa la notizia.

Il valore comune a tutte e quattro: oggi ognuna di queste inchieste costa settimane di spoglio manuale, e per questo quasi nessuno le fa. Il dato strutturato le abbassa al costo di una query.

---

## 3. Indicatori di monitoraggio costruibili

Dalla stringa strutturata si costruiscono metriche stabili e ripetibili nel tempo:

- **Indice di pluralismo degli auditi** per commissione, per atto o per tema: quanto è varia la composizione di chi è stato ascoltato (categorie diverse, soggetti diversi) rispetto a un ascolto concentrato su pochi.
- **Classifica dei soggetti più auditi** — persone ed enti — per legislatura, per anno, per commissione.
- **Ratio interessi economici / società civile**: rapporto tra audizioni di imprese, associazioni datoriali e ordini da un lato, e sindacati, associazioni di consumatori, comitati e ONG dall'altro. Calcolabile per singolo provvedimento.
- **Audizioni per atto**: quante e quali voci ha ascoltato il Parlamento prima di legiferare su un dato tema (un proxy della "densità di ascolto" di una legge).
- **Copertura del Registro**: quota degli auditi ricorrenti in veste di portatori di interessi che risultano iscritti al Registro dei rappresentanti di interessi della Camera.
- **Divario Camera-Senato**: il Senato non modella affatto le audizioni. La sola esistenza dell'indicatore alla Camera misura, per contrasto, il buco di trasparenza dell'altro ramo.

Sono indicatori che un cruscotto civico può aggiornare a ogni legislatura e che una redazione può citare con una fonte precisa.

---

## 4. Chi userebbe questi dati

- **Giornalisti d'inchiesta**: per passare da "credo ci sia uno squilibrio" a "questi sono i numeri", con la fonte verificabile. Il dato strutturato abbassa il costo d'ingresso di un'inchiesta sull'influenza da settimane a ore.
- **Ricercatori** (scienza politica, studi legislativi): per analisi quantitative sull'accesso ai decisori, sulla rappresentanza degli interessi e sul ciclo di produzione normativa, oggi possibili solo con codifica manuale.
- **ONG e watchdog** — **Transparency International Italia**, **The Good Lobby Italia**, **Openpolis**: The Good Lobby ha già mappato *a mano* le audizioni informali come attività di lobbying; la strutturazione automatizza esattamente quella pipeline e la rende ripetibile a ogni legislatura invece che a ogni progetto una tantum.
- **Cittadini attivi e comitati**: per verificare se, sul tema che li riguarda, il Parlamento ha ascoltato anche la loro parte o solo la controparte economica.
- **Gli stessi parlamentari e le loro strutture**: per documentare l'equilibrio delle audizioni di una commissione e rispondere all'accusa di ascolto a senso unico con un dato, non con un'impressione.

---

## 5. L'angolo di campagna: "Chi ascolta il Parlamento?"

Qui si chiude il cerchio del *follow-the-influence*, e qui c'è l'asimmetria istituzionale che rende la campagna forte e non retorica.

La Camera ha istituito nel febbraio 2017 un **Registro dei rappresentanti di interessi** (attivo dal 10 marzo 2017). Ma l'Italia resta **tra i pochi Paesi europei senza una legge nazionale organica sul lobbying**, e il **Senato non modella né le audizioni né un proprio registro**. Il risultato: le audizioni — il momento più visibile e formale in cui un interesse entra nel processo legislativo — restano **scollegate da qualsiasi registro esista**. Il dato c'è, ma è muto.

Una campagna civica "Chi ascolta il Parlamento?" userebbe questi dati su tre fronti:

1. **Dimostrare il valore prima di chiedere la regola.** Pubblicare le classifiche degli auditi, gli indici di pluralismo e i casi di squilibrio ricostruiti *già oggi* dai titoli grezzi. È la prova concreta che il dato è utile e maturo: non si chiede al legislatore di raccogliere qualcosa di nuovo, ma di **strutturare ciò che pubblica già**. Una richiesta a costo quasi nullo e ad alto ritorno di trasparenza.
2. **Chiedere alla Camera lo scatto tecnico**: tipizzare l'audito come entità (categoria dell'interesse), collegarlo all'atto discusso e agganciarlo al Registro dei rappresentanti di interessi. Tre link mancanti che trasformano un archivio di testi in un sistema di *accountability*.
3. **Estendere la trasparenza al Senato.** Il divario tra i due rami è l'argomento più semplice e più efficace: se la Camera pubblica chi ascolta e il Senato no, la domanda "perché?" si pone da sé. La campagna usa la Camera come standard e chiede al Senato di allinearsi.

La leva politica è che nessuna di queste richieste costa dati nuovi né tocca il merito delle audizioni: chiede solo di rendere leggibile a macchina, e collegabile, ciò che il Parlamento già scrive. È una richiesta difficile da respingere proprio perché è minima nella forma e massima nell'effetto.

---

*Fonti istituzionali citate: Registro dei rappresentanti di interessi della Camera dei deputati (istituito con deliberazione dell'Ufficio di Presidenza dell'8 febbraio 2017, attivo dal 10 marzo 2017); assenza di una legge nazionale organica sul lobbying in Italia. Tutti i numeri e i nomi negli scenari del §2 sono ipotesi illustrative dichiarate tali; i dati quantitativi effettivi sono verificati via SPARQL da un altro contributo del team.*
