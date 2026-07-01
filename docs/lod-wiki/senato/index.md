# Senato della Repubblica (OSR)

Endpoint SPARQL: `https://dati.senato.it/sparql`. Ontologia OSR (namespace `http://dati.senato.it/osr/`). Triplestore Virtuoso.

# Trappole

* [Trappole Virtuoso — Senato](trappole.md) - quirk endpoint (403 su curl, no BIND, legislatura integer, matching nomi) e performance.

# Query template

* [Collegare una Votazione al suo DDL](votazione-ddl-link.md) - link parziale; fallback dal numero nel label via `osr:fase="S.<num>"`.

# Entità

(da popolare — es. Senatore, Ddl, SedutaCommissione, OggettoTrattazione, Votazione, Emendamento)
