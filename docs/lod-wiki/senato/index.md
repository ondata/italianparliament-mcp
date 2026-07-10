# Senato della Repubblica (OSR)

Endpoint SPARQL: `https://dati.senato.it/sparql`. Ontologia OSR (namespace `http://dati.senato.it/osr/`). Triplestore Virtuoso.

# Trappole

* [Trappole Virtuoso — Senato](trappole.md) - quirk endpoint (403 su curl, no BIND, legislatura integer, matching nomi) e performance.

# Query template

* [Collegare una Votazione al suo DDL](votazione-ddl-link.md) - link parziale; fallback dal numero nel label via `osr:fase="S.<num>"`.
* [Tipo semantico di una votazione (finale/fiducia)](votazione-tipo-semantico.md) - `osr:tipoVotazione` è la **modalità** (elettronica/nominale/segreta), non il tipo semantico; "Votazione finale" e "questione di fiducia" vivono solo nel `rdfs:label`. Filtri label-based di `senato-votes`.
* [Firmatari di un DDL — osr:iniziativa e primoFirmatario](firmatari-iniziativa.md) - il flag `osr:primoFirmatario` NON è mutuamente esclusivo: per gli atti di governo vale su più presentatori (Presidente del Consiglio + ministro competente; fino a tutti i ministri per i decreti collegiali).

# Entità

* [Sedute e attività delle commissioni](sedute-commissione.md) - `osr:SedutaCommissione` per commissione e per data; proprietà reali (`osr:dataSeduta`, `osr:titoloBreve`) e trappola doppia etichetta.
* [Emendamenti — firmatario assente dal LOD](emendamenti-firmatario.md) - `osr:Emendamento` esiste nel LOD ma **senza** firmatario; il proponente sta solo nel testo AKN (`osr:URLTestoXml`), dietro WAF. Asimmetria di tooling con `camera-amendments`.
* [Emendamenti — dataset fermo da agosto 2024](emendamenti-freschezza.md) - nessun DDL con `dataPresentazione` successiva al 9/8/2024 ha emendamenti collegati; vuoto su DDL recenti non è assenza del dato ma cutoff del dataset.
* [Votazioni assenti 10/3–16/4/2020 (leg.18)](votazioni-covid-2020.md) - sedute d'Assemblea COVID con `osr:Intervento` ma zero `osr:Votazione` collegate, inclusa la fiducia sul Cura Italia; probabile voto per appello nominale a gruppi mai digitalizzato.

# Fonti complementari

* [Bulk data Akoma Ntoso su GitHub](akn-bulk-data.md) - repo ufficiale senza WAF, aggiornato quotidianamente, `AttoID` = id del `ddl` LOD; colma emendamenti post-2024, testi dietro WAF e (via parsing dei resoconti) le votazioni COVID 2020. Non copre le audizioni.

# Corrispondenza gestori

* [Corrispondenza con il Webmaster del Senato](corrispondenza-webmaster.md) - log delle segnalazioni inviate a `Webmaster@senato.it` e delle risposte ricevute (sedute di commissione/listasommcomm, emendamenti fermi da agosto 2024).
