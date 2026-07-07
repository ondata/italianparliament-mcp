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
