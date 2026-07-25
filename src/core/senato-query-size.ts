/**
 * Vincoli di dimensione delle richieste all'endpoint SPARQL del Senato.
 *
 * Il front-end di `dati.senato.it` accetta una request-URI (`/sparql?query=…`)
 * fino a **2047 byte** e respinge da 2048 in su con una pagina 403 HTML, non
 * con un errore SPARQL né con un 414. Misurato per bisezione il 25/7/2026, con
 * query di controllo a 200 subito prima e subito dopo: non è il blocco per
 * frequenza, che invece respinge anche le richieste minime. Il POST è sempre
 * rifiutato, quindi non c'è modo di aggirare il limite spostando la query nel
 * corpo: l'unica strada è tenere corta la GET.
 */
export const SENATO_MAX_REQUEST_URI = 2047;

/**
 * Massimo numero di termini in una OR-chain (`FILTER(STR(?x) = "a" || …)`) per
 * singola query. 45 termini sfiorano la soglia, 50 la superano: 25 lascia
 * margine anche quando il resto della query cresce, al costo di una query in
 * più ogni 25 elementi.
 */
export const SENATO_MAX_OR_TERMS = 25;

/**
 * Lunghezza della request-URI che il client produrrebbe per questa query,
 * calcolata con lo stesso encoding di `URLSearchParams` usato in `client.ts`.
 */
export function senatoRequestUriLength(query: string): number {
  const params = new URLSearchParams({ query, format: "application/json" });
  return "/sparql?".length + params.toString().length;
}

/**
 * Blocca in partenza le query troppo lunghe con un messaggio che dice cosa
 * fare, invece di lasciare arrivare un 403 opaco — indistinguibile, lato
 * client, dal blocco per frequenza.
 */
export function assertQueryFits(query: string, keyword?: string): void {
  const len = senatoRequestUriLength(query);
  if (len <= SENATO_MAX_REQUEST_URI) return;
  const perche = keyword
    ? ` La parola chiave "${keyword}" pesa circa tre volte la sua lunghezza: accorciala (una radice più corta basta, il match è per sottostringa)`
    : " Restringi i filtri";
  throw new Error(
    `Query troppo lunga per l'endpoint del Senato: ${len} byte di request-URI, il massimo accettato è ${SENATO_MAX_REQUEST_URI}.${perche} oppure aggiungi un intervallo di date più stretto.`,
  );
}
