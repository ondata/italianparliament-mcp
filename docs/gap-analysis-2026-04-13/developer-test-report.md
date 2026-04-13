# Report Test Developer

## Riepilogo
- **OK:** 13
- **PARZIALE:** 14
- **KO:** 6

---

## Dettaglio per user story

### US-01 — Sedute di oggi
- **Tool usati:** `sessions`
- **Test eseguito:** `sessions --legislature 19 --limit 5` → restituisce le sedute più recenti con data, numero progressivo e link HTML.
- **Risultato:** Ultima seduta disponibile: mercoledì 1 aprile 2026 (n. 638). Nessun filtro per data (solo offset/limit). Non c'è modo di filtrare "oggi" o "questa settimana" direttamente: bisogna paginare e confrontare manualmente.
- **Valutazione:** PARZIALE
- **Note:** Manca filtro `date-from`/`date-to` sul tool `sessions`. Il giornalista deve prendere le prime N e verificare la data. Solo Camera, nessun dato Senato.

---

### US-02 — Ultime votazioni in Aula
- **Tool usati:** `votes`
- **Test eseguito:** `votes --legislature 19 --date-from 2026-03-30 --limit 5`
- **Risultato:** Restituisce votazioni del 9 aprile con esito, contatori (favorevoli/contrari/astenuti), tipo, flag fiducia, link alla scheda ufficiale.
- **Valutazione:** OK
- **Note:** Il campo `title` delle votazioni è spesso vuoto o poco descrittivo ("Votazione ", "Votazione Ordine del giorno…"). Solo Camera. Senato non coperto.

---

### US-03 — Nuovi DDL presentati
- **Tool usati:** `bills` (Camera), `bill-progress` (Senato)
- **Test eseguito:** `bills --legislature 19 --date-from 2026-03-01 --limit 5`; `bill-progress --legislature 19 --limit 3`
- **Risultato:** Entrambi restituiscono DDL recenti con titolo, primo firmatario (URI), data, iniziativa, link HTML. I DDL Camera non hanno filtro `date-from` che funzioni prima di qualche settimana fa (con `2026-04-06` restituisce 0 risultati; con `2026-03-01` funziona). Bill-progress Senato include stato dell'iter.
- **Valutazione:** PARZIALE
- **Note:** Il filtro `date-from` su `bills` Camera sembra avere un lag di indicizzazione. Manca filtro per tipo di atto ("DDL" vs "ordine del giorno" ecc.). I cofirmatari non sono nella lista, solo il primo firmatario (URI). Per i firmatari Senato serve chiamata separata a `bill-signatories`.

---

### US-04 — Nuove interrogazioni e interpellanze
- **Tool usati:** `sindacato-ispettivo` (Senato), `aic` (Camera)
- **Test eseguito:** `sindacato-ispettivo --legislature 19 --tipo Interrogazione --date-from 2026-04-06 --limit 5`; `aic --legislature 19 --date-from 2026-04-06 --limit 3`
- **Risultato:** Entrambi restituiscono atti recenti con tipo, numero, data, link. Il tool `sindacato-ispettivo` ha il campo `presentatore` vuoto — i nomi non vengono restituiti dall'SPARQL Senato. Il tool `aic` Camera mostra presentatore nel `label` ma non ha un campo strutturato per il nome.
- **Valutazione:** PARZIALE
- **Note:** Senato: campo `presentatore` e `senatore_uri` sempre vuoti — grave gap per il giornalista che vuole sapere chi ha firmato. Camera: funziona ma il nome è solo nel label non strutturato. Nessun tool supporta ricerca per parola chiave nel testo/oggetto.

---

### US-05 — Scheda parlamentare completa
- **Tool usati:** `search`, `deputy`, `roles`, `group-members`
- **Test eseguito:** `search --name Costa --chamber camera --legislature 19` → trovato URI; `deputy --uri ...` → scheda base; `roles --deputy-uri ...` → ruoli nel gruppo; `group-members` per il gruppo.
- **Risultato:** Si ottiene: nome, descrizione (professione/titolo), foto, link scheda, ruoli nel gruppo (es. delegato d'aula, segretario) con date. Mancano commissioni (la Camera non espone le commissioni per singolo deputato).
- **Valutazione:** PARZIALE
- **Note:** Ricerca per nome+cognome non funziona (es. "Costa Enrico"), bisogna cercare solo per cognome. Le commissioni di appartenenza non sono disponibili per Camera. Il gruppo è recuperabile via `group-members` ma non è diretto dalla scheda deputato.

---

### US-06 — Attività di un parlamentare nel dettaglio
- **Tool usati:** `aic`, `speeches`, `bills`, `rank`
- **Test eseguito:** AIC con `deputy-uri`, speeches con `deputy-uri`, rank per bills e aic.
- **Risultato:** Si può ottenere: numero di AIC (interrogazioni) presentate come primo firmatario o cofirmatario, numero di interventi in Aula (speeches), numero di DDL primo firmatario (via rank). Non c'è un "contatore" diretto — bisogna usare rank o paginare e contare.
- **Valutazione:** PARZIALE
- **Note:** Il tool `rank` è solo per Camera e non filtra per singolo parlamentare. Per il Senato non c'è equivalente. Il tool `speeches` non ha filtro per data. Non c'è contatore diretto sul singolo, bisogna sommare pagine o affidarsi a rank.

---

### US-07 — Storia dei cambi di gruppo
- **Tool usati:** `group-members`
- **Test eseguito:** `group-members --legislature 19 --limit 5` → mostra date inizio/fine per ogni membro del gruppo.
- **Risultato:** Il tool `group-members` mostra le membership con date. Cateno De Luca non è nella Camera XIX (non trovato con `search`). In linea di principio si può ricostruire la storia dei cambi cercando tutte le membership di un deputato su tutti i gruppi.
- **Valutazione:** PARZIALE
- **Note:** Non esiste un filtro `group-members --deputy-uri` per estrarre la storia di un singolo parlamentare su tutti i gruppi. Bisogna scaricare tutti i `group-members` e filtrare in post. Possibile ma non comodo. Solo Camera.

---

### US-08 — Parlamentari eletti in un collegio o regione
- **Tool usati:** `deputies`
- **Test eseguito:** `deputies --legislature 19 --limit 3`
- **Risultato:** Il campo `election_label` contiene la circoscrizione (es. "Eletto nella circoscrizione LIGURIA - P01"). Non esiste un filtro per regione/circoscrizione nel tool — bisogna scaricare tutti i deputati e filtrare in post.
- **Valutazione:** PARZIALE
- **Note:** Manca un parametro `region` o `constituency` nel tool `deputies`. Il dato è presente ma non filtrabile lato SPARQL/tool. Con tutti i 400 deputati scaricabili, il filtro manuale è praticabile ma macchinoso.

---

### US-09 — Dettaglio voto: chi ha votato contro la linea del gruppo
- **Tool usati:** `votes`, `vote-detail`
- **Test eseguito:** `votes --date-from 2026-03-30` → trovata votazione fiducia (vs19_641_046, `confidence_vote: true`); `vote-detail --vote-uri ...` → lista voti per deputato con gruppo.
- **Risultato:** Ottimo. Si vede nome, voto (Favorevole/Contrario/Astenuto/Non ha votato), acronimo gruppo per ogni deputato. Permette di identificare i dissidenti per gruppo.
- **Valutazione:** OK
- **Note:** Solo Camera. Il titolo della votazione di fiducia è vuoto ("Votazione ") — il giornalista deve usare il link esterno per capire di cosa si tratta.

---

### US-10 — Votazioni su un provvedimento specifico
- **Tool usati:** `votes`, `bills`
- **Test eseguito:** `votes` non ha filtro per DDL/titolo. Il campo `bill_uri` nelle votazioni è quasi sempre vuoto nei test.
- **Risultato:** Non è possibile filtrare le votazioni per DDL specifico tramite i tool attuali. Il campo `bill_uri` è presente ma spesso vuoto.
- **Valutazione:** KO
- **Note:** Manca un filtro `votes --bill-uri` o ricerca per titolo. L'unico modo sarebbe usare `sparql` con query libera ma richiede competenze tecniche non adatte al giornalista.

---

### US-11 — Voti di fiducia: chi manca e chi vota contro
- **Tool usati:** `votes`, `vote-detail`
- **Test eseguito:** `votes` ha il campo `confidence_vote` booleano, usabile per filtrare. Con `vote-detail` si ottiene il voto individuale per deputato con il gruppo.
- **Risultato:** Buono. Si può trovare le votazioni di fiducia (`confidence_vote: true`) e poi analizzare il dettaglio individuale per gruppo. Il tool `votes` non ha filtro `confidence_vote` come parametro — bisogna scaricare e filtrare.
- **Valutazione:** PARZIALE
- **Note:** Manca parametro `votes --confidence-vote true` per filtrare direttamente. Il titolo della votazione spesso è vuoto. Solo Camera.

---

### US-12 — Confronto tra votazioni simili nel tempo
- **Tool usati:** `votes` (con filtro legislatura e data)
- **Test eseguito:** Teoricamente `votes --legislature 18` e `votes --legislature 19` con filtro per parola chiave.
- **Risultato:** Non c'è ricerca per testo nelle votazioni. Il confronto fra legislature su un tema specifico non è praticabile senza conoscere le URI o i numeri di seduta.
- **Valutazione:** KO
- **Note:** Manca ricerca full-text nelle votazioni. Solo con `sparql` libero ma fuori dalla portata del giornalista standard.

---

### US-13 — Iter di un DDL: dove siamo arrivati
- **Tool usati:** `bill-progress` (Senato), `bill` (Camera)
- **Test eseguito:** `bill-progress --legislature 19 --limit 3` → mostra stato (assegnato, da assegnare), data, fase.
- **Risultato:** Per il Senato si ottiene stato dell'iter, data di presentazione, iniziativa, link HTML. Per la Camera `bill` mostra la scheda del singolo atto ma senza storico delle fasi. Non c'è ricerca per parola chiave (es. "salario minimo").
- **Valutazione:** PARZIALE
- **Note:** Nessun tool permette di cercare un DDL per titolo/tema. Bisogna conoscere l'URI o il numero. Il tool `bill-progress` Senato copre lo stato ma non lo storico completo delle commissioni/votazioni intermedie. La Camera non ha un equivalente `bill-progress`.

---

### US-14 — Firmatari di un DDL: chi c'è dietro una proposta
- **Tool usati:** `bill-signatories` (Senato), `bills` (Camera)
- **Test eseguito:** `bill-signatories --ddl-uri http://dati.senato.it/ddl/60043` → restituisce primo firmatario e cofirmatari con flag `is_primary`.
- **Risultato:** Perfetto per il Senato: nome, URI senatore, tipo (Parlamentare), flag primo firmatario. Per Camera solo il primo firmatario è nella scheda `bills` (campo `sponsor_uri`).
- **Valutazione:** PARZIALE
- **Note:** Per la Camera i cofirmatari dei DDL non sono esposti dai tool — solo primo firmatario. Nessun tool permette di cercare un DDL per titolo (es. "fine vita") senza conoscere l'URI.

---

### US-15 — DDL di iniziativa popolare
- **Tool usati:** `bills` (Camera), `bill-progress` (Senato)
- **Test eseguito:** `bills --type Popolare --legislature 19` → 0 risultati. `bills --legislature 19 --limit 5` → campo `initiative` contiene "Parlamentare", "Governo", "Regioni" ma non "Popolare" nei 5 risultati.
- **Risultato:** Il campo `initiative` esiste nei risultati di `bills` e `bill-progress`. Per Camera: `initiative: "Popolare"` esiste nel modello dati ma il filtro `--type Popolare` non funziona (filtra su tipo atto, non su iniziativa). Per Senato: `bill-progress` ha `initiative_description` ma non filtro per iniziativa.
- **Valutazione:** PARZIALE
- **Note:** Il campo `initiative` c'è ma non è filtrabile dal tool. Con `sparql` libero è possibile. Senza, bisogna scaricare molti DDL e filtrare. La funzionalità esiste nel modello dati ma non è esposta come parametro.

---

### US-16 — Ostruzionismo via emendamenti
- **Tool usati:** `amendments`
- **Test eseguito:** `amendments --legislature 19 --limit 5`
- **Risultato:** Restituisce emendamenti con numero, tipo, link al testo. Non ci sono informazioni su: quale DDL/decreto, chi ha presentato l'emendamento, a quale gruppo appartiene.
- **Valutazione:** KO
- **Note:** Il tool `amendments` è molto scarno: mancano presentatore, gruppo, DDL di riferimento. Impossibile rispondere alla domanda "qual è il gruppo che ha presentato più emendamenti al Milleproroghe". Solo Senato, nessun dato Camera sugli emendamenti.

---

### US-17 — Interrogazioni su un tema specifico
- **Tool usati:** `sindacato-ispettivo`, `aic`
- **Test eseguito:** `sindacato-ispettivo --legislature 19 --date-from 2026-03-13 --date-to 2026-04-13 --limit 5`; `aic --legislature 19 --date-from ...`
- **Risultato:** Si ottengono le interrogazioni per periodo. Ma non c'è ricerca per parola chiave nel testo/oggetto (es. "caro energia"). Impossibile filtrare per tema.
- **Valutazione:** KO
- **Note:** Manca ricerca full-text. Senza poter filtrare per oggetto/titolo, il giornalista non può trovare le interrogazioni su un tema specifico. Il testo dell'atto non è incluso nella risposta, solo un link esterno.

---

### US-18 — Question time: chi interroga di più il governo
- **Tool usati:** `rank` (Camera), `sindacato-ispettivo` (Senato)
- **Test eseguito:** `rank --rank-by aic-primo-firmatario --legislature 19 --limit 5` → classifica Camera; per Senato non c'è un rank equivalente.
- **Risultato:** Per Camera: classifica completa e funzionante dei deputati per numero di interrogazioni. Per Senato: non esiste un tool rank — bisogna scaricare tutti gli atti e aggregare manualmente.
- **Valutazione:** PARZIALE
- **Note:** Funziona bene per Camera. Per Senato manca un tool `rank` equivalente. La domanda riguarda i "10 senatori" ma non è supportata nativamente.

---

### US-19 — Risposte del governo alle interrogazioni
- **Tool usati:** `sindacato-ispettivo`, `aic`
- **Test eseguito:** Il campo `esito` nel tool `sindacato-ispettivo` è sempre vuoto nei risultati testati. Il tool `aic` non ha un campo esito/risposta.
- **Risultato:** Il campo `esito` esiste nella struttura dati del tool `sindacato-ispettivo` ma risulta sempre vuoto. Non è possibile sapere se e quando il governo ha risposto.
- **Valutazione:** KO
- **Note:** Il campo `esito` non viene popolato dall'SPARQL Senato (problema noto). Non è possibile verificare lo stato di risposta di un'interrogazione specifica.

---

### US-20 — Composizione attuale del governo
- **Tool usati:** `gov-members`, `governments`
- **Test eseguito:** `gov-members --legislature 19 --limit 5` → restituisce ministri, sottosegretari con ruolo, portafoglio, date.
- **Risultato:** Ottimo. Nome, ruolo (MINISTRO, SOTTOSEGRETARIO, MINISTRO SENZA PORTAFOGLIO), portafoglio, date inizio/fine, governo di riferimento.
- **Valutazione:** OK
- **Note:** Non c'è filtro per ruolo ("solo sottosegretari") ma è facilmente gestibile. I dati sono aggiornati (es. Giuli come ministro dal settembre 2024). Copre anche i rimpasti con date di cessazione.

---

### US-21 — Storia dei rimpasti: chi è entrato e chi è uscito
- **Tool usati:** `gov-members`
- **Test eseguito:** `gov-members --name Fitto` → restituisce tutti gli incarichi di Fitto con date e motivo cessazione.
- **Risultato:** Perfetto. Si vede la storia completa: nomina, cessazione (con motivo: "Dimissioni", "Scioglimento"), governo di riferimento. Per Fitto: nominato il 22.10.2022, ruolo cambiato il 10.11.2022, dimissioni il 30.11.2024.
- **Valutazione:** OK
- **Note:** Il filtro per nome funziona bene. Storico su più governi disponibile. Copre anche legislature precedenti.

---

### US-22 — Parlamentari che sono anche nel governo
- **Tool usati:** `deputies` + `gov-members`
- **Test eseguito:** Non esiste un filtro diretto "deputati con incarico governativo". Bisogna incrociare la lista `gov-members` con `deputies`.
- **Risultato:** Con due chiamate si può incrociare: `gov-members --legislature 19` restituisce le persone con incarico (con `person_uri`), poi `deputies` ha gli URI dei deputati. L'incrocio è manuale.
- **Valutazione:** PARZIALE
- **Note:** Non esiste un parametro che restituisca direttamente "deputati con incarico di governo attivo". Il campo `person_uri` nel gov-members e `uri` nei deputies usano namespace diversi (`/persona.rdf/` vs `/deputato.rdf/`) quindi l'incrocio richiede una logica aggiuntiva.

---

### US-23 — Chi presenta più DDL come primo firmatario
- **Tool usati:** `rank`
- **Test eseguito:** `rank --rank-by bills-primo-firmatario --legislature 19 --limit 10`
- **Risultato:** Ottimo. Top 10 immediata con nome, conteggio, URI. Brambilla 216 DDL, Comaroli 176, Pittalis 160.
- **Valutazione:** OK
- **Note:** Solo Camera. Nessun equivalente per il Senato.

---

### US-24 — Ranking gruppi per attività ispettiva
- **Tool usati:** `sindacato-ispettivo`, `aic`
- **Test eseguito:** Non esiste un tool `rank` per il Senato o per i gruppi. Il tool `rank` Camera classifica per deputato, non per gruppo.
- **Risultato:** Non è possibile ottenere direttamente un ranking per gruppo. Bisogna scaricare tutti gli atti e aggregare per gruppo — non supportato nativamente dai tool.
- **Valutazione:** KO
- **Note:** Il tool `rank` non ha una dimensione "per gruppo". Manca completamente un ranking Senato. Possibile solo con `sparql` libero.

---

### US-25 — Parlamentari meno presenti in Aula (assenteismo)
- **Tool usati:** `rank`, `speeches`
- **Test eseguito:** `rank --rank-by speeches --legislature 19 --limit 5` → classifica per numero di discorsi (dal più attivo). Non esiste il ranking inverso (dal meno attivo).
- **Risultato:** Il tool `rank` ordina dal più attivo in poi, non è invertibile. Per trovare i "fantasmi" bisognerebbe scaricare tutti i discorsi e raggruppare per deputato.
- **Valutazione:** PARZIALE
- **Note:** Manca parametro `order: asc` o simile nel tool `rank`. L'assenteismo (voti "Non ha votato") non è aggregabile con i tool attuali. Solo Camera.

---

### US-26 — Confronto tra gruppi su voto specifico
- **Tool usati:** `votes`, `vote-detail`
- **Test eseguito:** `vote-detail --vote-uri http://dati.camera.it/ocd/votazione.rdf/vs19_641_046 --limit 10` → ogni riga ha nome, voto, acronimo gruppo.
- **Risultato:** Buono. Con tutti i dati (fino a 700 deputati per votazione) si può aggregare per gruppo e calcolare le percentuali. Il tool restituisce anche il voto di fiducia. L'aggregazione per gruppo non è automatica ma i dati ci sono.
- **Valutazione:** OK
- **Note:** Bisogna fare l'aggregazione per gruppo manualmente (o chiedere a un LLM di farlo). Il titolo della votazione spesso è vuoto. Solo Camera — Senato non ha dati di votazione individuali.

---

### US-27 — Composizione di una commissione
- **Tool usati:** `committees`
- **Test eseguito:** `committees --legislature 19 --limit 5` → lista commissioni Senato con nome e numero sedute.
- **Risultato:** Il tool restituisce solo le commissioni Senato con titolo breve e conteggio sedute. Non ci sono i membri delle commissioni, né i ruoli (presidente, vicepresidente). Nessun tool per le commissioni Camera.
- **Valutazione:** KO
- **Note:** Il tool `committees` è molto limitato: solo lista commissioni Senato senza composizione. Manca completamente la Camera. Non c'è modo di sapere chi fa parte di una commissione o chi la presiede.

---

### US-28 — Lavori di una commissione su un provvedimento
- **Tool usati:** nessuno adatto
- **Test eseguito:** Non esiste un tool per le sedute di commissione o per l'iter di un DDL in commissione.
- **Risultato:** Impossibile.
- **Valutazione:** KO
- **Note:** Il tool `bill-progress` Senato mostra lo stato dell'iter (es. "assegnato") ma non le date delle singole sedute di commissione né le votazioni sugli emendamenti. Nessun tool copre l'iter in commissione Camera.

---

### US-29 — Audizioni in commissione
- **Tool usati:** nessuno adatto
- **Test eseguito:** Non esiste un tool per le audizioni.
- **Risultato:** Impossibile.
- **Valutazione:** KO
- **Note:** Le audizioni non sono presenti nel modello dati esposto dai tool. Né Camera né Senato.

---

### US-30 — Precedenti legislativi su un tema
- **Tool usati:** `bills`, `bill-progress`
- **Test eseguito:** Non c'è filtro per parola chiave nel titolo.
- **Risultato:** Possibile cercare DDL per legislatura (es. 17 o 18) ma non per tema. Senza ricerca full-text non si può trovare "DDL sul presidenzialismo".
- **Valutazione:** PARZIALE
- **Note:** Teoricamente si possono scaricare tutti i DDL di una legislatura e filtrare manualmente, ma è operazione laboriosa. Con `sparql` libero si potrebbe fare un `FILTER CONTAINS` sul titolo.

---

### US-31 — Storia parlamentare di un politico su più legislature
- **Tool usati:** `search`, `deputies`, `senators`, `gov-members`, `group-members`
- **Test eseguito:** `gov-members --name Fitto` → restituisce storia incarichi governativi su più legislature. `search --name Casini` potrebbe trovare URI per legislature diverse.
- **Risultato:** Parzialmente possibile: storia governativa disponibile (gov-members per nome su tutte le legislature), gruppi Camera recuperabili per legislatura. Ma non c'è un unico tool "storia parlamentare completa" per una persona.
- **Valutazione:** PARZIALE
- **Note:** Bisogna combinare 3-4 tool e fare chiamate per ogni legislatura. Non c'è un identificatore persona unificato tra Camera e Senato. Per parlamentari che hanno fatto entrambi (deputato e senatore) il flusso è complesso.

---

### US-32 — Confronto tra legislature: produttività legislativa
- **Tool usati:** `bills`, `bill-progress`
- **Test eseguito:** Non esiste un contatore aggregato per legislature. Si potrebbero scaricare tutti i DDL di leg 18 e 19 e confrontare, ma è oneroso.
- **Risultato:** Possibile in linea teorica ma non pratico: bisogna scaricare migliaia di DDL per entrambe le legislature. Non c'è un tool `stats` o contatore aggregato.
- **Valutazione:** PARZIALE
- **Note:** Il tool `rank` conta per deputato, non per legislatura. Un tool di statistiche aggregate manca. Con `sparql` libero sarebbe fattibile.

---

### US-33 — Decreti legge: frequenza storica e temi
- **Tool usati:** `bills`, `bill-progress`
- **Test eseguito:** `bills --type "decreto"` → non testato ma il parametro `type` filtra sul tipo di atto.
- **Risultato:** Il tool `bills` Camera ha un campo `type` e `initiative` che potrebbe discriminare i decreti legge. Ma non c'è un contatore aggregato per governo né confronto tra governi.
- **Valutazione:** PARZIALE
- **Note:** Per rispondere bisogna scaricare i DDL per legislature diverse, filtrare per tipo "decreto legge" e contare. Fattibile ma richiede più passaggi. Il confronto tra governi (Meloni vs Draghi vs Conte) richiede di conoscere le date di ciascun governo (recuperabili da `governments` + `gov-members`).

---

## Riepilogo per priorità

| Priorità | US | Valutazione |
|---|---|---|
| ALTA | US-01 | PARZIALE |
| ALTA | US-02 | OK |
| ALTA | US-03 | PARZIALE |
| ALTA | US-04 | PARZIALE |
| ALTA | US-05 | PARZIALE |
| ALTA | US-06 | PARZIALE |
| ALTA | US-09 | OK |
| ALTA | US-10 | KO |
| ALTA | US-11 | PARZIALE |
| ALTA | US-13 | PARZIALE |
| ALTA | US-14 | PARZIALE |
| ALTA | US-16 | KO |
| ALTA | US-17 | KO |
| ALTA | US-20 | OK |
| ALTA | US-21 | OK |
| ALTA | US-26 | OK |
| ALTA | US-27 | KO |
| ALTA | US-28 | KO |
| MEDIA | US-07 | PARZIALE |
| MEDIA | US-08 | PARZIALE |
| MEDIA | US-12 | KO |
| MEDIA | US-15 | PARZIALE |
| MEDIA | US-18 | PARZIALE |
| MEDIA | US-19 | KO |
| MEDIA | US-22 | PARZIALE |
| MEDIA | US-23 | OK |
| MEDIA | US-24 | KO |
| MEDIA | US-25 | PARZIALE |
| MEDIA | US-29 | KO |
| MEDIA | US-31 | PARZIALE |
| BASSA | US-30 | PARZIALE |
| BASSA | US-32 | PARZIALE |
| BASSA | US-33 | PARZIALE |

---

## Gap principali identificati

1. **Ricerca full-text assente**: nessun tool permette di cercare DDL, votazioni o interrogazioni per parola chiave nel titolo/testo. Blocca US-10, US-12, US-13, US-17, US-30.
2. **Senato incompleto**: `sindacato-ispettivo` non restituisce il presentatore (`senatore_uri` e `presentatore` vuoti). `amendments` senza presentatore/gruppo. Nessun `rank` Senato.
3. **Commissioni**: il tool `committees` mostra solo la lista Senato senza composizione. Camera non coperta. Blocca US-27, US-28, US-29.
4. **Filtri mancanti**: `sessions` senza filtro data, `votes` senza filtro `confidence_vote`, `deputies` senza filtro regione/circoscrizione, `rank` senza ordinamento inverso.
5. **Cofirmatari Camera**: i DDL Camera espongono solo il primo firmatario nell'elenco, non i cofirmatari (diversamente dal Senato con `bill-signatories`).
6. **Votazioni Senato**: nessun tool per le votazioni del Senato (solo Camera).
7. **Testo atti assente**: il contenuto testuale di interrogazioni, DDL, emendamenti non è restituito — solo metadati e link esterno.
