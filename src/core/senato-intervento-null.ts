/**
 * Il nodo-calderone `osr:Intervento` senza identità del LOD Senato.
 *
 * Nel grafo del Senato esiste la risorsa letterale
 * `http://dati.senato.it/intervento/null`: è quello che resta quando l'id
 * dell'intervento manca alla fonte e la serializzazione scrive "null" nell'URI
 * invece di omettere il record. Tutti gli interventi privi di id collassano
 * quindi in **un'unica** risorsa, che risulta collegata a mezzo secolo di
 * attività parlamentare.
 *
 * Misurato il 2026-07-30: `intervento/null` porta **36.853** triple
 * `osr:seduta` e **47.571** triple `osr:oggetto`.
 *
 * Perché è pericoloso: qualunque join che passi da un oggetto di trattazione
 * all'intervento e da lì alla seduta (`?o ← ?int → ?seduta`) attraversa quel
 * nodo e produce un prodotto cartesiano. Non è un vuoto — sono **righe false**,
 * indistinguibili dalle vere per chi legge l'output. Caso reale: le sedute di
 * commissione sull'Atto del Governo n. 418 (schema di d.lgs. su IA e attività di
 * polizia, `documento/54072`) risultavano **18.945**, tra cui sedute
 * d'Assemblea del 1996, mentre le sedute pertinenti nel LOD sono zero.
 *
 * Escluderlo non è indovinare un dato mancante: è scartare un record che la
 * fonte stessa dichiara privo di identità. Gli interventi veri hanno un id
 * (`int_aula-…`, `int_cons-…`) e non vengono toccati — verificato che la seduta
 * d'Assemblea legittima sul DDL nucleare resta nell'output.
 */
export const SENATO_INTERVENTO_NULL = "http://dati.senato.it/intervento/null";

/**
 * Frammento SPARQL da aggiungere dove una variabile lega un `osr:Intervento`.
 * Da usare in ogni join che attraversa gli interventi del Senato.
 */
export function excludeInterventoNull(varName = "?int"): string {
  return `FILTER(${varName} != <${SENATO_INTERVENTO_NULL}>)`;
}
