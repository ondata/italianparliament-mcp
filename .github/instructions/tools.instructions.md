---
applyTo: "src/tools/**/*.ts"
---

# Trappole SPARQL Virtuoso (Camera e Senato)

Questi endpoint sono Virtuoso e hanno comportamenti non ovvi già scoperti e verificati sul campo. Quando rivedi o scrivi query in `src/tools/`, controlla che rispettino queste regole: quasi tutte producono, se violate, un **vuoto silenzioso** (0 righe senza errore) che per un giornalista è indistinguibile da "il fatto non esiste".

## Filtri su date e stringhe

- **`STR()` obbligatorio nei FILTER di confronto** su letterali stringa/data della Camera. Il `dc:date` Camera è un letterale `YYYYMMDD`: confrontarlo nudo con `>=`/`<=` fa fare a Virtuoso un confronto numerico spurio → risultati errati o vuoti muti. Avvolgi sempre: `FILTER(STR(?date) >= "20250201")`. Vale anche per `siglaGruppo` (XVIII richiede `FILTER(STR(?sigla) = "PD")`; XIX accetta anche il confronto diretto).
- **Senato: `dataPresentazione` è `xsd:date` tipizzato.** I FILTER sulle date del Senato richiedono il letterale tipizzato `"2025-01-01"^^xsd:date`, non la stringa nuda. La Camera invece usa la stringa piana `YYYYMMDD`. Le due camere non si trattano allo stesso modo.
- **Senato: la legislatura si filtra con l'integer nudo** (`19`), non con una stringa né con un URI di legislatura come alla Camera.

## Prefissi e proprietà

- **Camera accetta `rdfs:` in ogni forma** (`rdfs:label` ecc.): nessun workaround necessario.
- **Decodifica HTML prima di rimuovere i tag**, mai il contrario: le entità (`&#8211;` ecc.) vanno decodificate per prime, poi si fa lo strip. Usa l'helper riusabile in `src/core/decode-html.ts`.
- **Label dei gruppi Camera troncate alla fonte** (`"NOME (ACRONIMO) (DD.MM.YYYY"`): usa l'helper `cleanGroupLabel`, non fidarti del letterale grezzo.

## Quirk del Virtuoso del Senato

- Non supporta le **subquery con `COUNT`**; alcune label (es. sul sindacato ispettivo) tornano vuote; a volte serve `GROUP BY` + `MIN`/`MAX` per una riga sola per soggetto. `BIND` non è affidabile: preferisci le triple dirette.
- La legislatura, quando compare solo nell'URI del soggetto, si filtra meglio con un **range filter su `?s` + `ORDER BY DESC(?s)` + `GROUP BY`** invece che con `STRSTARTS`: è molto più veloce (es. speeches 6s → 1.8s).

## Performance

- **Subquery-first** quando ci sono molti `OPTIONAL`: seleziona/ordina/limita prima i soli URI con i filtri come pattern vincolanti, poi aggancia gli `OPTIONAL` alle sole righe risultanti. Senza, Virtuoso materializza tutti gli `OPTIONAL` su decine di migliaia di record prima di ordinare e limitare (→ timeout). La legislatura va messa come tripla vincolante, non come `FILTER` su una variabile `OPTIONAL`.
- Parti sempre da una query minima mirata (un caso reale noto) e allarga solo se serve; non lanciare full-scan pesanti alla cieca.

## Coerenza con la memoria di progetto

Non fidarti delle query "per analogia": verifica le proprietà RDF reali con una query esplorativa sull'endpoint prima di dare per assente un dato. Le trappole qui elencate sono documentate in dettaglio in `docs/lod-wiki/`.
