/**
 * Spezza una lista in blocchi di al più `size` elementi, preservando l'ordine.
 *
 * Serve a tenere corte le query SPARQL costruite come OR-chain su una lista di
 * lunghezza variabile (`FILTER(STR(?x) = "a" || STR(?x) = "b" || ...)`):
 * l'endpoint del Senato respinge con 403 le richieste la cui query string
 * supera ~2 KB, e il POST non è un'alternativa (è sempre rifiutato). Con una
 * lista che cresce — es. le fiducie di un'intera legislatura — la query supera
 * la soglia e il tool smette di funzionare del tutto.
 */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size < 1) throw new Error("chunk: size deve essere >= 1");
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}
