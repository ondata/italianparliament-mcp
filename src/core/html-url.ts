/**
 * Genera URL human-readable (schede istituzionali camera.it / senato.it) a
 * partire dagli URI SPARQL. Funzioni pure, nessuna chiamata di rete.
 *
 * Pattern verificati su pagine reali (legislatura 19):
 * - Deputato:  http://dati.camera.it/ocd/deputato.rdf/d{ID}_{LEG}
 *              → https://www.camera.it/deputati/elenco/{LEG}-{ID}
 * - Senatore:  http://dati.senato.it/senatore/{N}
 *              → https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did={N}
 *
 * Per le legislature passate il pattern del sito potrebbe differire: qui si
 * emette comunque l'URL best-effort (la correttezza è garantita per la 19).
 */

/**
 * URL della scheda istituzionale di una persona (deputato o senatore) dal suo URI.
 * Ritorna stringa vuota se l'URI non corrisponde a un pattern noto.
 */
export function personHtmlUrl(uri: string | undefined | null): string {
  if (!uri) return "";

  // Deputato Camera: .../deputato.rdf/d<id>_<leg> oppure dr<id>_<leg> (Regno)
  const dep = uri.match(/dati\.camera\.it\/ocd\/deputato\.rdf\/dr?(\d+)_(\d+)$/);
  if (dep) {
    const [, id, leg] = dep;
    return `https://www.camera.it/deputati/elenco/${leg}-${id}`;
  }

  // Senatore: http://dati.senato.it/senatore/<n>
  const sen = uri.match(/dati\.senato\.it\/senatore\/(\d+)$/);
  if (sen) {
    return `https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did=${sen[1]}`;
  }

  return "";
}
