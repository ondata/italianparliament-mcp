---
type: Gotcha
title: Nome d'uso e nome anagrafico — Camera (OCD)
description: Il cognome con cui una persona è pubblicamente nota (Casellati, Villecco Calipari) non sta in foaf:surname né nella rdfs:label della ocd:persona, ma dentro un blank node foaf:nickname. Le ocd:deputato usano invece il nome d'uso già nella label: due convenzioni opposte nello stesso grafo. Cercare per cognome noto sulla persona restituisce zero righe.
resource: https://dati.camera.it/sparql
tags: [camera, ocd, persona, deputato, nome, blank-node, ricerca]
timestamp: 2026-08-02
---

Nel grafo OCD la stessa persona è descritta da due entità con **convenzioni opposte sul nome**:

- `ocd:persona` (`persona.rdf/p<id>`) → nome **anagrafico**. La ministra per le Riforme è `rdfs:label "MARIA ELISABETTA ALBERTI"`, `foaf:surname "ALBERTI"`. Il cognome "Casellati", quello con cui la si trova su qualunque giornale, **non compare**.
- `ocd:deputato` (`deputato.rdf/d<id>_<leg>`) → nome **d'uso**. La deputata Villecco Calipari ha `rdfs:label "ROSA MARIA VILLECCO CALIPARI, XVII Legislatura della Repubblica"`, ma il suo `foaf:surname` sulla stessa entità è `"VILLECCO"`.

## Dove vive il nome d'uso

Sulla `ocd:persona`, dentro un **blank node** appeso a `foaf:nickname`, che espone a sua volta `foaf:firstName` e `foaf:surname`:

```sparql
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
SELECT ?surname ?aliasSurname WHERE {
  <http://dati.camera.it/ocd/persona.rdf/p200012> foaf:surname ?surname ;
                                                  foaf:nickname ?nick .
  ?nick foaf:surname ?aliasSurname
}
# → "ALBERTI"  |  "ALBERTI CASELLATI"
```

Il nodo è **sempre** un blank node: verificato il 2026-08-02, 16.802 valori di `foaf:nickname`, zero literal. Un `FILTER(isLiteral(?nk))` non serve.

## Quante persone riguarda

135 persone hanno un cognome d'uso diverso da quello anagrafico, 12 delle quali membri di governo: Alberti/**Alberti Casellati**, Villecco/**Villecco Calipari**, Scilipoti/**Scilipoti Isgrò**, Guidi/**Guidi Cingolani**, Mogherini/**Mogherini Rebesani**, Jervolino/**De Unterrichter Jervolino**, Marchi/**Marchi Dascola**…

La differenza non va **sempre** nella stessa direzione: in una minoranza di casi è il nome d'uso a essere più corto dell'anagrafico (`ZELIOLI LANZINI` → `ZELIOLI`, `CATANOSO GENOESE` → `CATANOSO`, `NATALI PIERUCCI BONDI` → `NATALI`). Non si può quindi assumere "il nickname è più completo".

In sei casi i due cognomi sono **disgiunti**, e sceglierne uno perde informazione: cognome acquisito (`DI SERIO` / `D'ANTONA` — Olga D'Antona), pseudonimo (`TRANQUILLI` / `SILONE` — Ignazio Silone), varianti ortografiche (`DE VIDOVICH` / `DE' VIDOVICH`, `NIRENSZTEJN` / `NIRENSTEIN`).

Cardinalità: una persona ha di norma un solo cognome d'uso, ma **18 ne hanno due** (4 delle quali membri di governo). Proiettare l'alias senza raccoglierlo raddoppia le righe.

## La trappola

Un filtro per nome sulla `rdfs:label` della persona — il modo ovvio di cercare — restituisce **zero righe** per il cognome più noto:

```sparql
FILTER(CONTAINS(LCASE(?personaLabel), "casellati"))   # → 0 risultati
```

Zero righe senza avviso si legge come "questa persona non è mai stata al governo", che è falso. Il filtro va esteso al nickname, concatenando le due parti perché `?aliasSurname` è opzionale e `CONTAINS` su una variabile non legata solleva un errore che scarta la riga:

```sparql
OPTIONAL { ?persona foaf:nickname ?nick . ?nick foaf:surname ?aliasSurname }
FILTER(CONTAINS(LCASE(CONCAT(COALESCE(?personaLabel, ""), " ",
                             COALESCE(?aliasSurname, ""))), "casellati"))
```

## Lato Senato non esiste

Il grafo OSR espone direttamente il nome d'uso: `foaf:lastName` del senatore 32 è `"Alberti Casellati"`. Una ricerca per "casellati" sul Senato ha sempre funzionato — il che rende il vuoto lato Camera ancora più facile da fraintendere, perché la stessa persona si trova su un ramo e non sull'altro.

## Come lo risolve la CLI

`src/core/person-name.ts` sceglie fra le due forme senza alcuna tabella di alias: si tiene quella che **contiene** l'altra (la più informativa, in entrambe le direzioni); se sono disgiunte le mostra entrambe (`Di Serio (D'Antona)`). Usato da `gov-members` (filtro `--name` e nome mostrato), `bill-signatories` (proponenti governativi e firmatari deputati) e `search` (etichetta del ramo Camera).

Nota su `search`: `first_name`/`last_name` restano i campi anagrafici della fonte, mentre `label` porta il nome d'uso. La divergenza è voluta — allargare `last_name` cambierebbe la semantica di una colonna, e il campo anagrafico resta l'unico modo di risalire al valore che la fonte pubblica davvero.
