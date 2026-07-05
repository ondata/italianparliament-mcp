Benchmark internazionale: come si strutturano le audizioni e i soggetti auditi

Questo documento raccoglie come altri parlamenti e istituzioni pubblicano e rendono monitorabile *chi viene ascoltato* (l'audito, il testimone) e come collegano questa informazione al mondo del lobbying, dei conflitti di interesse e dei finanziamenti. Serve da termine di paragone per la proposta sulla Camera italiana, dove oggi l'audito resta una stringa dentro il titolo di una discussione, non un'entità strutturata.

## Premessa: due strati di dato da non confondere

Il materiale raccolto copre due oggetti diversi, e la forza della proposta sta nel *collegarli*, non nel confonderli.

1. Lo strato dell'audito / testimone: la persona o organizzazione che testimonia in una specifica audizione. Qui i modelli di riferimento sono gli Stati Uniti (Congresso) e il Regno Unito (select committee). Sono l'analogo diretto dell'"audito" della Camera.
2. Lo strato del lobbista / rappresentante di interessi: chi è registrato come portatore di interessi e quali incontri dichiara. Qui i modelli sono l'Unione europea (Registro per la trasparenza, Integrity Watch, LobbyFacts) e, in Italia, il Registro della Camera e la legge appena approvata alla Camera (A.C. 2336).

Attenzione a un errore di categoria da evitare: LobbyFacts e Integrity Watch NON strutturano gli "auditi", strutturano i lobbisti e i loro incontri. USA e UK mostrano come tipizzare l'audito; UE e registri nazionali mostrano lo strato-lobby a cui l'audito andrebbe collegato.

---

## 1. Stati Uniti — Congresso: il testimone come entità strutturata

È il modello più avanzato. Per ogni audizione (hearing) della Camera dei Rappresentanti, il Committee Repository (docs.house.gov) e Congress.gov espongono una lista testimoni in cui ogni testimone è un record con nome, posizione e organizzazione, accompagnato da una serie tipizzata di documenti.

L'API ufficiale della Library of Congress (api.congress.gov) rende questa struttura esplicita e machine-readable. Nell'endpoint `committee-meeting`, il contenitore `<witnesses>` ha, per ogni `<item>`:
- `<name>` (es. "Mr. Thomas DiNanno")
- `<position>` (es. "Assistant Administrator, Grant Programs Directorate, FEMA")
- `<organization>` (es. "U.S. Department of Homeland Security")

e un contenitore `<witnessDocuments>` con `documentType` a valori chiusi: "Witness Biography", "Witness Supporting Document", "Witness Statement", "Witness Truth in Testimony".
Fonte: https://github.com/LibraryOfCongress/api.congress.gov/blob/main/Documentation/CommitteeMeetingEndpoint.md

Il pezzo forte è il "Truth in Testimony". In base alla Rule XI, clause 2(g)(5) del regolamento della Camera USA, ogni testimone che non appare in veste governativa deve compilare un modulo di disclosure che dichiara, sul testimone stesso:
- se rappresenta sé stesso o un'organizzazione (e quale/i);
- eventuali finanziamenti o contratti federali (fonte e importo) ricevuti nei 36 mesi precedenti, relativi al tema dell'audizione;
- eventuali contratti o pagamenti provenienti da governi stranieri (importo e paese), sempre nei 36 mesi;
- una certificazione (18 U.S.C. § 1001: fornire informazioni false è reato).
Il modulo è reso pubblico in forma elettronica, di norma 24 ore prima dell'audizione.
Fonte (modulo): https://www.congress.gov/119/meeting/house/119371/witnesses/HHRG-119-AG00-TTF-SawinK-20260610.pdf
Esempio di audizione con i tre documenti per testimone (Statement, Truth in Testimony, Biography): https://docs.house.gov/Committee/Calendar/ByEvent.aspx?EventId=119368

Il dato è tipizzato anche sul versante "witness_type" (Governmental / Non-governmental; e più in dettaglio Government-Federal, Government-State, Non-Governmental), come documentato dalle vecchie API di terze parti che leggevano l'XML della Camera.
Fonte (schema witness/documenti): https://sunlightlabs.github.io/congress/hearings.html

Riuso civico e giornalistico. Su questi dati sono nati strumenti terzi:
- GovInfo (govinfo.gov) permette la ricerca dei resoconti (Congressional Hearings) per testimone (witness), oltre che per parola chiave, con URL prevedibili e bulk data. https://www.govinfo.gov/help/chrg
- L'API ProPublica del Congresso esponeva le hearing delle commissioni con i loro metadati. https://projects.propublica.org/api-docs/congress-api/committees/

In sintesi USA: il testimone è entità (nome, ruolo, organizzazione, tipo) e porta con sé, in modo standardizzato e obbligatorio, la dichiarazione dei propri finanziamenti e conflitti. È esattamente ciò che manca alla Camera italiana.

---

## 2. Regno Unito — select committee: testimonianze pubbliche e permanenti, ricercabili per testimone

Il Parlamento britannico pubblica sistematicamente le "oral evidence" (audizioni orali) e le "written evidence" (memorie scritte) rese ai select committee. Ogni sessione orale è di norma pubblica, trasmessa in diretta (parliamentlive.tv) e archiviata; il transcript verbatim viene pubblicato e resta online in modo permanente ("Once published, the document remains available on the internet permanently").
Fonte: https://www.parliament.uk/get-involved/committees/give-evidence-to-a-select-committee/

Il portale delle commissioni (committees.parliament.uk) offre un motore per trovare i transcript filtrando per nome del testimone o dell'organizzazione e per inchiesta (inquiry). Ogni sessione riporta i witness con nome, ruolo e organizzazione di appartenenza.
Fonte: https://committees.parliament.uk/publications/oral-evidence/

Esiste anche un endpoint dati storico (data.parliament.uk) da cui si recuperano i documenti di evidence, ma va detto con onestà l'asimmetria rispetto agli USA: il Regno Unito pubblica testi ricchi e ben ricercabili, ma il testimone non è un'entità tipizzata via API allo stesso modo del Congresso americano (niente equivalente strutturato del witness_type né un modulo obbligatorio di disclosure dei finanziamenti agganciato al singolo testimone). È comunque un modello forte sul piano della trasparenza sostanziale (chi ha detto cosa, per iscritto, in modo permanente e cercabile).
Fonte (esempio documento evidence): https://data.parliament.uk/writtenevidence/committeeevidence.svc/evidencedocument/science-and-technology-committee/big-data-dilemma/oral/24873.pdf

---

## 3. Unione europea — lo strato-lobby: Registro per la trasparenza, Integrity Watch, LobbyFacts

L'UE non struttura "auditi" nel senso della Camera, ma è il riferimento mondiale per lo strato che alla Camera manca del tutto: chi è un rappresentante di interessi e quali incontri ha con i decisori.

Il Registro per la trasparenza. Dal 20 maggio 2021 esiste un accordo interistituzionale (Parlamento europeo, Consiglio, Commissione) che rende il registro *obbligatorio* attraverso il principio di "condizionalità": la registrazione è precondizione necessaria per svolgere determinate attività di rappresentanza di interessi (es. ottenere l'accredito al Parlamento, incontrare certi decisori).
Fonte (testo ufficiale, EUR-Lex ELI): https://eur-lex.europa.eu/eli/agree_interinstit/2021/611/oj
Fonte (condizionalità spiegata): https://transparency-register.europa.eu/conditions-contacts-eu-institutions_it

Cosa contiene il registro (dato strutturato, aperto sul portale EU Open Data): identità del soggetto, interessi rappresentati, spese/entrate finanziarie dichiarate, numero di lobbisti e di pass al Parlamento, temi su cui è attivo, e le connessioni con altre organizzazioni (reti, membership). La Commissione pubblica inoltre, dal dicembre 2014, gli incontri di alto livello (commissari, capi di gabinetto, direttori generali) con i soggetti in registro; dal 1° gennaio 2025 anche gli incontri del personale con "funzioni dirigenziali".

Riuso civico. Su questi dati open sono costruiti due strumenti civici di riferimento, entrambi ottime prove del valore del dato strutturato:
- Integrity Watch EU (Transparency International EU) combina i verbali degli incontri della Commissione con i dati del Registro per la trasparenza, aggiornamento giornaliero; espone incontri lobby della Commissione, incontri lobby dei deputati, redditi accessori dei deputati, lobbisti UE. https://www.integritywatch.eu/ — descrizione dei dataset: https://integritywatch.eu/about
- LobbyFacts (Corporate Europe Observatory / LobbyControl) consente a giornalisti, attivisti e ricercatori di cercare, ordinare e filtrare i dati del Registro nel tempo: spese di lobbying, numero di lobbisti, pass al Parlamento, incontri con la Commissione, paese di origine, temi. https://www.lobbyfacts.eu/ — guida: https://www.lobbyfacts.eu/how-to

Lezione UE: quando identità del rappresentante, interessi, spese e incontri sono dato aperto e strutturato, nasce spontaneamente un ecosistema civico di monitoraggio. L'anello che manca in UE è che gli incontri dei deputati non sono ancora integrati automaticamente col registro; è un limite noto, utile da citare per non idealizzare il modello.

---

## 4. Focus Italia — il Registro dei rappresentanti di interessi della Camera e la legge A.C. 2336

Questo è l'angolo che rende affilata la proposta.

### 4.1 Il Registro della Camera (2016-2017): esiste, è pubblico, ma non è dato aperto

La Camera si è dotata dal 2016-2017 di una propria disciplina interna. La Giunta per il Regolamento ha adottato la regolamentazione il 26 aprile 2016; la deliberazione dell'Ufficio di Presidenza dell'8 febbraio 2017 ha istituito il "Registro dei soggetti che svolgono professionalmente attività di rappresentanza di interessi nei confronti dei deputati presso le sedi della Camera".
Fonti:
- https://rappresentantidiinteressi.camera.it/sito
- https://rappresentantidiinteressi.camera.it/sito/regolamento.html
- https://rappresentantidiinteressi.camera.it/sito/deliberazione.html

Cosa contiene. Gli iscritti (che inseriscono i dati da soli) dichiarano: dati anagrafici / denominazione e sede, descrizione dell'attività, soggetti che intendono contattare, e — per conto di terzi — il titolare dell'interesse rappresentato. Entro il 31 gennaio di ogni anno presentano una relazione annuale sui contatti effettivamente posti in essere, gli obiettivi perseguiti e i soggetti per conto dei quali hanno agito; le relazioni sono pubblicate sul sito della Camera.

Com'è fatto oggi il dato. Il registro è consultabile come elenco HTML sul sito rappresentantidiinteressi.camera.it, articolato per categorie di persone giuridiche (es. imprese e gruppi di imprese; associazioni di categoria o di tutela di interessi diffusi; organizzazioni sindacali e datoriali; soggetti specializzati nella rappresentanza professionale di interessi di terzi; associazioni professionali; ONG; associazioni di consumatori) e per persone fisiche. Le cifre per categoria sono nell'ordine delle centinaia complessive (dell'ordine di ~100+ imprese, ~100+ associazioni di categoria, ~85 organizzazioni sindacali/datoriali, decine per le altre categorie; sono numeri "vivi", che cambiano nel tempo).
Fonte (pagina con l'elenco e i conteggi): https://rappresentantidiinteressi.camera.it/sito/1/registro.html

Limiti, verificabili:
- Copre solo la Camera, non il Senato (dove una proposta di codice di condotta del 2015 non ha portato a un registro analogo). Fonte: https://www.es-comunicazione.it/approfondimenti/fare-lobby-in-italia-verso-una-disciplina-organica-della-rappresentanza-di-interessi/
- Non ha forza di legge nazionale: è norma interna della Camera.
- Non è pubblicato in formato aperto/strutturato: è un elenco HTML navigabile, non un dataset scaricabile. (La sezione lobbying del portale trasparenza.camera.it è dietro un controllo anti-bot che non consente la verifica automatica del formato; qui riporto quanto verificabile dall'elenco pubblico.)

### 4.2 La legge appena approvata alla Camera (A.C. 2336): registro al CNEL + agenda incontri

Il 29 gennaio 2026 la Camera ha approvato la proposta di legge A.C. 2336 ("Disciplina dell'attività di relazioni istituzionali per la rappresentanza di interessi"), testo base adottato il 24 giugno 2025 e frutto anche di un'indagine conoscitiva della I Commissione Affari costituzionali. La spinta viene anche dalla sentenza n. 185 del 2025 della Corte costituzionale, che ha invitato il legislatore a una disciplina organica.
Fonti:
- https://temi.camera.it/leg19/provvedimento/disciplina-dell-attivit-di-relazioni-istituzionali-per-la-rappresentanza-di-interessi.html
- https://parlamento19.openpolis.it/attivita_legislativa/disegni_di_legge/C_2336

Cosa prevede:
- un "registro pubblico per la trasparenza dell'attività di rappresentanza di interessi" istituito presso il CNEL (non presso l'ANAC come nel tentativo 2021-2022, né presso il Ministero della giustizia come in una delle proposte abbinate, A.C. 2283), con iscrizione obbligatoria dei rappresentanti di interessi;
- un'agenda degli incontri tra decisori pubblici e rappresentanti di interessi iscritti;
- un codice deontologico e un comitato di sorveglianza presso il CNEL, con sanzioni anche pecuniarie.

Tre avvertenze da dire con chiarezza:
1. Non è ancora legge: approvata dalla sola Camera il 29/01/2026 (122 favorevoli, 104 astenuti, nessun contrario — opposizioni astenute), ora al Senato. Fonte: https://www.es-comunicazione.it/approfondimenti/fare-lobby-in-italia-verso-una-disciplina-organica-della-rappresentanza-di-interessi/
2. Ha esclusioni rilevanti: dal perimetro sono esclusi, tra gli altri, i partiti e le organizzazioni sindacali dei lavoratori e dei datori di lavoro — punto contestato dalle organizzazioni civiche (Transparency International Italia: "la Camera salva Confindustria"). Fonti: la stessa pagina temi.camera.it; https://www.transparency.it/stampa/legge-lobbying-la-camera-salva-confindustria
3. Non impone di strutturare le audizioni nel LOD: anche se diventasse legge, riguarda il registro dei lobbisti e l'agenda incontri, non la pubblicazione strutturata e collegata degli auditi delle commissioni. Il "buco LOD" sull'audito resterebbe.

### 4.3 L'incrocio audito ↔ registro: perché è l'angolo affilato (e i suoi limiti)

Oggi in Italia entrambi gli oggetti sono destrutturati: l'audito della Camera è una stringa dentro il titolo di una `ocd:discussione`, e il registro dei rappresentanti di interessi è un elenco HTML. Non esiste alcun modo automatico di rispondere alla domanda giornalistica più naturale: "questo soggetto audito è anche un rappresentante di interessi iscritto? con quali interessi dichiarati? quali incontri ha dichiarato?".

La proposta affilata non è "unire due dataset già strutturati" (non lo sono), ma: strutturare l'audito come entità nel LOD della Camera e strutturare/aprire il registro (oggi HTML, domani il registro CNEL previsto da A.C. 2336), collegandoli tramite un'entità condivisa (il soggetto: persona/organizzazione). Il valore, per un giornalista, è duplice:
- rivelare quali auditi sono anche lobbisti registrati (e con quali interessi dichiarati), incrociabile con l'agenda incontri quando esisterà;
- rivelare, per differenza, quali auditi NON risultano in alcun registro.

Limite da dichiarare, per onestà: non è un join 1:1. Molti auditi (università, esperti, associazioni della società civile, autorità) non compaiono e non devono comparire in un registro di lobbisti. L'incrocio serve proprio a distinguere chi è portatore di interessi registrato da chi no — non a etichettare ogni audito come lobbista.

### 4.4 Il contesto civico italiano: The Good Lobby, Openpolis, Transparency Italia

Il tema delle audizioni informali della Camera è già stato mappato dalla società civile, ed è la base di partenza della proposta:
- The Good Lobby, con la Legal Clinic Ruffilli dell'Università di Salerno e Openpolis, ha pubblicato nel 2021 il rapporto "Le audizioni informali nelle Commissioni permanenti della Camera dei Deputati" (prima analisi sistematica dall'inizio della legislatura al 31/12/2020, con focus PNRR). Tesi centrale: l'informalità produce discrezionalità (i parlamentari scelgono gli interlocutori senza criteri) e opacità (non è obbligatorio pubblicare i contributi degli auditi, quindi è impossibile misurare l'impatto). Fonti: https://www.agendadigitale.eu/cultura-digitale/audizioni-parlamentari-presidio-di-democrazia-come-renderle-piu-trasparenti/ ; https://www.policymakermag.it/fact-checking/le-audizioni-informali-parlamentari-si-da-voce-solo-ai-potenti/
- Le richieste storiche della coalizione #Lobbying4Change (promossa da The Good Lobby, con Transparency International Italia e decine di organizzazioni): registro digitale in formato open data, agenda pubblica degli incontri, consultazioni pubbliche, sanzioni. Fonti: https://www.transparency.it/cosa-facciamo/advocacy/lobbying4change/proposte-emendative-della-coalizione-lobbying4change ; https://www.thegoodlobby.it/legge_sul_lobbying_la_nostra_voce_finalmente_alla_camera/
- Transparency International Italia, nel report "Lobbying e democrazia" (2014), assegnava all'Italia un voto complessivo di 20/100 sulla rappresentanza di interessi (trasparenza 11%, integrità 27%, parità di accesso 22/100): il punto di partenza da cui misurare i progressi. Fonte: https://www.transparency.it/informati/pubblicazioni/lobbying-e-democrazia

---

## Tabella di sintesi

| Paese / istituzione | Cosa struttura dell'audito/testimone | Collegamenti a lobby / conflitti / finanziamenti | Riuso civico |
|---|---|---|---|
| USA — Congresso | Entità testimone tipizzata via API: nome, posizione, organizzazione, witness_type (Gov/Non-gov); documenti a tipo chiuso (Statement, Biography, Truth in Testimony, Supporting) | Forte: modulo obbligatorio "Truth in Testimony" con finanziamenti/contratti federali e pagamenti da governi stranieri (36 mesi), pubblicato per legge | GovInfo (ricerca per witness), API Library of Congress, ex ProPublica/Sunlight |
| UK — select committee | Testimone con nome/ruolo/organizzazione dentro transcript pubblici e permanenti; ricerca per nome testimone/organizzazione | Debole/assente sul singolo testimone: nessun modulo obbligatorio di disclosure agganciato al witness | Portale committees.parliament.uk, endpoint data.parliament.uk |
| UE — Registro trasparenza | Non struttura auditi; struttura il rappresentante di interessi | Forte sullo strato-lobby: identità, interessi, spese/entrate, lobbisti, connessioni; incontri Commissione dal 2014. Obbligatorio (condizionalità) dal 2021 | Integrity Watch EU (TI EU), LobbyFacts; dato su EU Open Data |
| Italia — Registro Camera (2017) | Non struttura auditi; elenco HTML degli iscritti + relazioni annuali | Parziale: interessi rappresentati e contatti dichiarati, ma solo Camera, no forza di legge, non open data | Nessun dataset aperto verificato; base per analisi The Good Lobby/Openpolis |
| Italia — A.C. 2336 (approvata Camera 29/01/2026, al Senato) | Non struttura auditi | Previsti registro obbligatorio al CNEL + agenda incontri; esclusi partiti e sindacati/datoriali; non ancora legge | Da definire; richieste civiche per formato open data |

---

## Lezioni per l'Italia (Camera)

1. Trasformare l'audito da stringa a entità. Il modello minimo è quello statunitense: per ogni audizione, un record testimone con nome, ruolo e organizzazione di appartenenza, e i documenti collegati (memoria depositata, biografia). Questo, da solo, renderebbe le audizioni della Camera cercabili "per audito", cosa oggi impossibile.

2. Aggiungere una disclosure sul soggetto audito, sul modello Truth in Testimony. Una dichiarazione standard e pubblica (in che veste parla, per conto di chi, con quali finanziamenti/contratti pubblici rilevanti) porterebbe il conflitto di interesse dentro il dato, non fuori.

3. Pubblicare i contributi depositati e i resoconti. È la richiesta storica di The Good Lobby/Openpolis: senza pubblicazione dei contributi è impossibile misurare l'impatto degli auditi sugli atti. La pubblicazione permanente e cercabile è il modello UK.

4. Aprire e strutturare il registro dei rappresentanti di interessi (oggi HTML) come dato aperto collegabile — coerentemente con la richiesta #Lobbying4Change di un "registro digitale in formato open data" e con l'imminente registro CNEL previsto da A.C. 2336.

5. Collegare i due strati con un'entità-soggetto condivisa. È il salto che nessuno in Italia ha ancora fatto: poter chiedere, per un dato soggetto, "è stato audito? è iscritto al registro? con quali interessi?". Il modello di riuso è Integrity Watch/LobbyFacts, che nascono proprio quando i dati sono aperti e agganciabili.

6. Estendere al Senato. Il registro esiste solo alla Camera; qualsiasi infrastruttura dati sugli auditi che copra una sola camera resta zoppa. La coerenza tra le due camere è una precondizione, non un dettaglio.
