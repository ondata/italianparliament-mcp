# Senato della Repubblica (OSR)

Endpoint SPARQL: `https://dati.senato.it/sparql`. Ontologia OSR (namespace `http://dati.senato.it/osr/`). Triplestore Virtuoso.

# Trappole

* [Trappole Virtuoso — Senato](trappole.md) - quirk endpoint (403 su curl, no BIND, legislatura integer, matching nomi) e performance.

# Query template

* [Il numero non si conserva tra i rami — le fasi si legano con osr:idDdl](ddl-fasi-idDdl.md) - `C.2669` alla Camera diventa `S.1924` al Senato: cercare il numero di un ramo sull'altro dà un vuoto ("il Senato non ha l'atto") o, peggio, l'atto sbagliato (`S.1511` ≠ fase Senato di `C.1511`). Il repertorio `osr:Ddl` contiene anche le fasi Camera (`osr:ramo="C"`) e `osr:idDdl` lega tutte le fasi dello stesso provvedimento: due query piccole ricostruiscono una navetta a più letture.
* [Collegare una Votazione al suo DDL](votazione-ddl-link.md) - link parziale; fallback dal numero nel label via `osr:fase="S.<num>"`.
* [Tipo semantico di una votazione (finale/fiducia)](votazione-tipo-semantico.md) - `osr:tipoVotazione` è la **modalità** (elettronica/nominale/segreta), non il tipo semantico; "Votazione finale" e "questione di fiducia" vivono solo nel `rdfs:label`. Filtri label-based di `senato-votes`.
* [Firmatari di un DDL — osr:iniziativa e primoFirmatario](firmatari-iniziativa.md) - il flag `osr:primoFirmatario` NON è mutuamente esclusivo: per gli atti di governo vale su più presentatori (Presidente del Consiglio + ministro competente; fino a tutti i ministri per i decreti collegiali).

# Entità

* [Sedute e attività delle commissioni](sedute-commissione.md) - `osr:SedutaCommissione` per commissione e per data; proprietà reali (`osr:dataSeduta`, `osr:titoloBreve`) e trappola doppia etichetta.
* [Emendamenti — firmatario assente dal LOD](emendamenti-firmatario.md) - `osr:Emendamento` esiste nel LOD ma **senza** firmatario; il proponente sta solo nel testo AKN (`osr:URLTestoXml`), dietro WAF. Asimmetria di tooling con `camera-amendments`.
* [Emendamenti — dataset fermo da agosto 2024](emendamenti-freschezza.md) - nessun DDL con `dataPresentazione` successiva al 9/8/2024 ha emendamenti collegati; vuoto su DDL recenti non è assenza del dato ma cutoff del dataset.
* [Votazioni assenti 10/3–16/4/2020 (leg.18)](votazioni-covid-2020.md) - sedute d'Assemblea COVID con `osr:Intervento` ma zero `osr:Votazione` collegate, inclusa la fiducia sul Cura Italia; probabile voto per appello nominale a gruppi mai digitalizzato.

# Diagnostica

* [Voto per alzata di mano — non esiste come osr:Votazione](voto-alzata-di-mano.md) - l'Assemblea vota *normalmente* per alzata di mano (art. 113 c.2 Reg.) e quel voto non produce conteggi, quindi nessuna `osr:Votazione`: il LOD enumera le sole votazioni **elettroniche**, come dichiarano le pagine di senato.it. Un voto "che non si trova" di solito è questo, non un buco. L'esito resta leggibile dall'iter (`bill-progress`).
* [Interpretare un vuoto di senato-votes — i tre stati](vuoto-votazioni-diagnosi.md) - sondando sedute (`osr:SedutaAssemblea`) vs votazioni si distinguono nessuna-seduta / buco "totale" (sedute senza voti) / buco "chirurgico" (voti presenti ma il target — es. una fiducia — manca, come il Milleproroghe del 26/2/2020). Metodo che l'`emptyHint` di `senato-votes` sonda al volo. Include le due spiegazioni non-buco da escludere prima: voto per alzata di mano e **votazione finale preclusa** da un emendamento interamente sostitutivo (DDL costituzionale S.1440, 9/9/2020: il 125-0-84 sull'emendamento *è* l'approvazione, e la "Votazione finale" non esiste perché non si è votata).

# Fonti complementari

* [Bulk data Akoma Ntoso su GitHub](akn-bulk-data.md) - repo ufficiale senza WAF, aggiornato quotidianamente, `AttoID` = id del `ddl` LOD; colma emendamenti post-2024, testi dietro WAF e (via parsing dei resoconti) le votazioni COVID 2020. Non copre le audizioni.

# Corrispondenza gestori

* [Corrispondenza con il Webmaster del Senato](corrispondenza-webmaster.md) - log delle segnalazioni inviate a `Webmaster@senato.it` e delle risposte ricevute (sedute di commissione/listasommcomm, emendamenti fermi da agosto 2024).
