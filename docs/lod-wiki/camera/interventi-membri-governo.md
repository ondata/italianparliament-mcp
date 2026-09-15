# Interventi dei membri del governo (Camera)

Alla Camera un intervento è legato a chi lo pronuncia in due modi diversi, secondo il ruolo con cui parla:

- **da deputato**: `?i ocd:rif_deputato <deputato.rdf/d{idPersona}_{leg}>`;
- **da membro del governo**: `?i ocd:rif_membroGoverno <membroGoverno.rdf/mg{idPersona}_...>`, un URI per ogni incarico (per esempio `mg302103_1_202_1_20221021`, Meloni presidente del Consiglio).

Chi filtra solo su `rif_deputato` perde tutti gli interventi da premier, ministro o sottosegretario. Meloni in leg. 19 risulta con **1** intervento invece di **123** (122 da presidente del Consiglio: 119 d'Aula, 3 in commissione); Pichetto Fratin passa da 1 a 135. Su un campione di 3.000 interventi di leg. 19, 162 usano `rif_membroGoverno`.

## Query

Gli URI degli incarichi si ricavano dall'id persona, con il vincolo di tipo:

```sparql
PREFIX ocd: <http://dati.camera.it/ocd/>
SELECT DISTINCT ?mg WHERE {
  ?mg a ocd:membroGoverno .
  FILTER(STRSTARTS(STR(?mg), "http://dati.camera.it/ocd/membroGoverno.rdf/mg302103_"))
}
```

Poi deputato e incarichi insieme, con `IN` sull'oggetto e il range sulla legislatura (gli URI `mg` non sono per legislatura, l'URI dell'intervento sì):

```sparql
PREFIX ocd: <http://dati.camera.it/ocd/>
SELECT (COUNT(DISTINCT ?s) AS ?n) WHERE {
  ?s a ocd:intervento ; ?p ?o .
  FILTER(?o IN (<http://dati.camera.it/ocd/deputato.rdf/d302103_19>,
                <http://dati.camera.it/ocd/membroGoverno.rdf/mg302103_1_202_1_20221021>))
  FILTER(?s >= <http://dati.camera.it/ocd/intervento.rdf/in19_> && ?s < <http://dati.camera.it/ocd/intervento.rdf/in19_z>)
}
```

## Trappole

- **`COUNT` su `UNION` è sbagliato** su Virtuoso Camera: con un ramo `rif_deputato` e uno `rif_membroGoverno` restituisce 6, mentre l'elenco delle righe della stessa `UNION` ne ha 123. `VALUES (?p ?o)` con le coppie proprietà-oggetto restituisce 0. La forma `FILTER(?o IN (...))` dà 123 sia in conteggio sia in elenco.
- **`rif_membroGoverno` non sta solo sugli interventi**: la portano anche persona, governo, organoGoverno e i nodi anonimi di firma degli atti (`ocd:primo_firmatario`). Senza `?i a ocd:intervento` il conteggio del premier sale a 288.

## Membri del governo non parlamentari: dato assente

Gli interventi dei membri del governo che **non sono parlamentari** non sono nel LOD. Verificato sulla seduta 672 del 10/6/2026 (question time): delle tre interrogazioni rivolte a Piantedosi il grafo ha la domanda (`...sub00010.int00020`) e la replica (`...int00060`), ma non la risposta del ministro (`...int00040`), che nello stenografico c'è con link alla scheda `idPersona=309042`. Nella stessa seduta le risposte dei ministri parlamentari (Pichetto Fratin, Mazzi) ci sono. Piantedosi nel grafo compare solo come persona, come incarico e come firmatario di atti. Non è latenza: gli interventi arrivano fino al 17/6/2026.

Ordine di grandezza da una fonte esterna (dataset `emeierkeio/parliamentrag-camera-leg19` su Hugging Face, costruito dagli stenografici): Piantedosi 132 interventi, Crosetto 81, contro 0 nel LOD.

## Presidenza di turno

Gli interventi di chi presiede la seduta non hanno né `rif_deputato` né `rif_membroGoverno`: solo l'etichetta (`intervento di Sergio COSTA`). In leg. 19 Sergio Costa ha 6.011 interventi per etichetta, 108 dei quali con `rif_deputato`. Il tool `speeches` non li restituisce.
