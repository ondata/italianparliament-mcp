// Escapa solo i caratteri che la grammatica STRING_LITERAL2 vieta (\, ",
// newline, CR). Non usare JSON.stringify: emette \uXXXX per i caratteri di
// controllo, sequenza che alcuni parser SPARQL rifiutano nel corpo del
// letterale (o cercano un valore diverso), rompendo il filtro invece di fare
// il match atteso.
const SPARQL_ESC: Record<string, string> = {
  "\\": "\\\\",
  '"': '\\"',
  "\n": "\\n",
  "\r": "\\r",
};

/**
 * Serializza un valore come string literal SPARQL, virgolette comprese.
 * Serve ovunque un valore finisca dentro una query: anche i valori che
 * arrivano dal grafo (etichette, sigle) possono contenere virgolette o
 * backslash e renderebbero la query invalida.
 */
export const sparqlStringLiteral = (value: string): string =>
  `"${value.replace(/[\\"\n\r]/g, (c) => SPARQL_ESC[c] ?? c)}"`;
