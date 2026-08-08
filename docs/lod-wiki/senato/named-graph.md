# Named graph: partizione per legislatura (e perché non ci tocca)

Anche l'endpoint Senato usa **named graph**, ma con uno schema diverso da quello della Camera: la partizione è **per legislatura**, non per tema.

```sparql
SELECT ?g (COUNT(*) AS ?triple)
WHERE { GRAPH ?g { <http://dati.senato.it/senatore/32> ?p ?o } }
GROUP BY ?g
```

→ `http://dati.senato.it/composizione/18` 249, `/16` 241, `/14` 154, `/17` 70, `/15` 56, `/12` 10.

Quel senatore ha seduto in sei legislature, e in ciascun grafo stanno le triple di quel mandato.

## Conseguenza: i senatori sono tipizzati più volte

```sparql
SELECT (COUNT(*) AS ?triple_rdf_type) (COUNT(DISTINCT ?s) AS ?soggetti)
WHERE { ?s a <http://dati.senato.it/osr/Senatore> }
```

→ **6.269 triple per 3.498 senatori distinti** (8 agosto 2026). Un `COUNT(*)` sui senatori sovrastima del 79%.

Non vale per tutto: le votazioni appartengono a una sola legislatura e infatti non duplicano (63.983 = 63.983).

## Perché i tool del progetto non ne risentono

Doppia protezione, verificata: le query usano `SELECT DISTINCT`, e i tool restringono per legislatura (senza `--legislature` risolvono quella corrente). Prova reale: `senators list --legislature 19` → 212 righe, 212 URI distinti; senza filtro → 205 e 205.

La differenza con la Camera è sostanziale e vale la pena tenerla a mente: là i grafi tematici sono **fette parziali** e puntarci fa perdere dati ([named-graph Camera](../camera/named-graph.md)); qui i grafi sono partizioni per legislatura, quindi coerenti, e il rischio è solo di contare due volte la stessa persona.

## L'enumerazione dei grafi è rifiutata

```sparql
SELECT ?g (COUNT(*) AS ?triple) WHERE { GRAPH ?g { ?s ?p ?o } } GROUP BY ?g
```

restituisce **403** (5 tentativi falliti), mentre nello stesso momento una query normale risponde regolarmente — quindi non è il blocco per volume descritto in [corrispondenza-webmaster](corrispondenza-webmaster.md), è proprio la scansione non limitata a essere respinta. Per sapere in quali grafi sta qualcosa, **partire sempre da un soggetto noto**: la forma vincolata funziona.
