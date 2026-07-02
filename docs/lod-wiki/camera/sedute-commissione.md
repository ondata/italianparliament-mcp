---
type: Entity Map
title: Sedute e attività delle commissioni — Camera (OCD)
description: Schema per interrogare le sedute di commissione/organismo Camera per organo e per data.
resource: http://dati.camera.it/ocd/seduta
tags: [camera, ocd, commissione, organo, seduta, attività]
timestamp: 2026-07-01
---

Le sedute di commissione della Camera sono modellate come `ocd:seduta` collegate a un `ocd:organo` (la commissione) via `ocd:rif_organo`. Sono interrogabili **per organo** e **per intervallo di date**. A differenza del Senato, qui risiede l'attività "viva" delle commissioni bicamerali (es. inchiesta femminicidio).

# Entità e proprietà

## ocd:seduta

| Proprietà | Tipo | Note |
|-----------|------|------|
| `ocd:rif_organo` | URI → `ocd:organo` | commissione/organismo che tiene la seduta |
| `dc:date` | stringa `AAAAMMGG` | data della seduta (formato plain, **non** `xsd:date`) |
| `dc:title` | stringa | es. "Seduta di lunedì 8 giugno 2026" |
| `ocd:rif_leg` | URI | legislatura |
| `ocd:rif_bollettino` | URI | riferimento al bollettino |
| `dc:relation` | URI | URL del bollettino (documento HTML/indice) |

> ⚠️ **La data è `dc:date`, stringa `AAAAMMGG`** (es. `20260608`). Non esiste `ocd:data`. Filtrare come stringa: `FILTER(?date >= "20260501" && ?date <= "20260531")`. Diversamente dal Senato, **non** usare `^^xsd:date`.

## ocd:organo

| Proprietà | Tipo | Note |
|-----------|------|------|
| `rdfs:label` | stringa | denominazione (MAIUSCOLO, es. "II COMMISSIONE (GIUSTIZIA)") |
| `ocd:rif_leg` | URI → `ocd:legislatura.rdf/repubblica_<N>` | legislatura di appartenenza |
| `dc:title` | stringa | — |
| `dc:type` | stringa | categoria dell'organo: `COMMISSIONE PERMANENTE`, `COMMISSIONE BICAMERALE D'INCHIESTA`, `COMMISSIONE MONOCAMERALE D'INCHIESTA`, `GIUNTA PER LE ELEZIONI`, `COMITATO PERMANENTE`, `ORGANO DELLA PRESIDENZA`, ecc. (leg. 19: 168 organi, 14 `COMMISSIONE PERMANENTE`) |
| `ocd:haMembro` | URI → deputato | composizione |

> Non tutti gli organi sono "commissioni" in senso stretto: `ocd:organo` copre anche giunte, comitati, delegazioni e organi di presidenza — filtrare su `dc:type = "COMMISSIONE PERMANENTE"` per le sole 14 commissioni permanenti.

# Query Template — sedute di un organo per data

```sparql
PREFIX ocd: <http://dati.camera.it/ocd/>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
SELECT ?seduta ?date (GROUP_CONCAT(DISTINCT ?rel; separator="|") AS ?bollettini)
WHERE {
  ?seduta a ocd:seduta ;
          ocd:rif_organo <ORGANO_URI> ;
          dc:date ?date .
  OPTIONAL { ?seduta dc:relation ?rel . }
}
GROUP BY ?seduta ?date
ORDER BY DESC(?date)
```

Filtri opzionali (intervallo date, stringhe `AAAAMMGG`):

```sparql
FILTER( ?date >= "20260501" && ?date <= "20260531" )
```

# Ricerca organo per nome (con filtro legislatura)

**Obbligatorio filtrare per legislatura**: senza `ocd:rif_leg`, la ricerca per nome restituisce organi di **tutte** le legislature storiche (es. "giustizia" → leg. 10, 11, 12, …). Il filtro legislature in OCD è un URI `repubblica_<N>`:

```sparql
PREFIX ocd: <http://dati.camera.it/ocd/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?organo ?label WHERE {
  ?organo a ocd:organo ;
          rdfs:label ?label ;
          ocd:rif_leg <http://dati.camera.it/ocd/legislatura.rdf/repubblica_19> .
  FILTER( CONTAINS(LCASE(?label), LCASE("giustizia")) )
}
```

# Trappole

| Trappola | Dettaglio |
|----------|-----------|
| **Data è `dc:date` stringa `AAAAMMGG`** | Non `ocd:data`, non `xsd:date`. `FILTER` numerico/stringa. |
| **Filtro legislatura obbligatorio** | Senza `ocd:rif_leg`, la ricerca per nome mescola tutte le legislature. URI: `legislatura.rdf/repubblica_<N>`. |
| **Label MAIUSCOLA** | `rdfs:label` è in maiuscolo; usare `LCASE()` nel `CONTAINS`. |
| **Deduplicare** | Una seduta può avere più `dc:relation`/`rdfs:label` (multipli bollettini); usare `GROUP_CONCAT(DISTINCT …)` o `GROUP BY ?seduta ?date`. |

# Cosa non è strutturato

Il `dc:relation`/`ocd:rif_bollettino` punta al **documento bollettino** (HTML/indice). Gli **argomenti trattati** e gli **atti discussi** in ciascuna seduta **non sono modellati come triple**: vanno recuperati parsando il bollettino. La seduta dà data + commissione + URL del bollettino, non l'elenco strutturato degli oggetti.

# ocd:dibattito — le "Audizioni informali" esistono, ma solo in un lotto storico (leg. 14)

`ocd:dibattito` è una classe **diversa** da `ocd:seduta`, con predicati propri (`dc:type`, `dc:title`, `ocd:rif_organo` multi-valore, `ocd:rif_discussione`, `ocd:rif_leg`, …). Esiste per **tutte** le legislature (costituente → repubblica_19, decine di migliaia di istanze ciascuna), ma il predicato `dc:type` che classifica il dibattito **è valorizzato solo fino alla legislatura 15** — e solo nella legislatura 14 compaiono i valori `"Audizioni informali"` / `"AUDIZIONI INFORMALI"` (619 dibattiti, tutti `rif_leg = repubblica_14`; verificato 2026-07-02).

Per la legislatura 19 (attuale) `ocd:dibattito` esiste (53.938 istanze) ma **non ha alcun `dc:type`**: nessuna audizione è quindi distinguibile dagli altri dibattiti d'aula via SPARQL nel dato corrente. Il concetto "audizione" non è quindi assente dal grafo in senso assoluto, ma è **relitto di un unico lotto di caricamento storico**, non un dato mantenuto nel tempo.

```sparql
PREFIX ocd: <http://dati.camera.it/ocd/>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
SELECT ?leg (COUNT(?s) AS ?n) WHERE {
  ?s a ocd:dibattito ; dc:type ?type .
  FILTER(?type IN ("Audizioni informali","AUDIZIONI INFORMALI"))
  ?s ocd:rif_leg ?leg .
} GROUP BY ?leg
-- → un'unica riga: repubblica_14, n=619
```

Dettagli ulteriori (struttura del dibattito, join con organo/commissione, limiti nel risalire a chi è stato audito) in `tmp/audizioni.md` (nota di lavoro non versionata).

# Caso d'uso — Commissione bicamerale femminicidio

La *Commissione parlamentare di inchiesta sul femminicidio e su ogni forma di violenza di genere* ha attività (sedute/bollettini) esposta **solo** in OCD, come `ocd:organo` `o19_3941`: **181 URI seduta (157 date distinte)**, fino a giugno 2026 (seduta dell'8 giugno 2026 al 2026-07-01). Il corrispondente Senato ha l'entità e i **membri senatori** (24 afferenze in `commissione/4-223`, leg. XIX) ma nessuna seduta/intervento come triple (vedi [[../senato/sedute-commissione]]).

# Citations

[1] Enumerazione proprietà `ocd:seduta` (2026-07-01): `SELECT ?p (COUNT(*) AS ?n) WHERE { ?s a ocd:seduta ; ocd:rif_organo <…/o19_3941> . ?s ?p ?o } GROUP BY ?p` → `dc:date`, `dc:title`, `ocd:rif_leg`, `ocd:rif_organo`, `dc:relation`, `ocd:rif_bollettino`.
[2] Verifica filtro legislatura (2026-07-01): senza `ocd:rif_leg` la ricerca "giustizia" restituisce organi leg. 10–18; con `repubblica_19` → solo `o19_3502`.
[3] Conteggio attività femminicidio (2026-07-01): `o19_3941` → 181 URI seduta / 157 date distinte (i "292" erano triple `rif_bollettino`, non sedute distinte), ultima data `20260608`.
