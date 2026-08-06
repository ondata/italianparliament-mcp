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

/**
 * Scompone l'URI di un atto Camera in legislatura e identificativo.
 *
 * L'identificativo NON è sempre un numero nudo: gli atti variante lo portano
 * con un suffisso (`703-B` per la lettura successiva della navetta, `703-A`
 * per il testo della commissione, `1059-bis-B` per le combinazioni). Un
 * pattern `_(\d+)$` non li matcha, e chi lo usa perde l'atto per intero.
 * Perciò l'id è preso come tutto ciò che segue `ac<leg>_`.
 */
export function parseCameraActUri(
  uri: string | undefined | null,
): { legislature: string; id: string } | undefined {
  if (!uri) return undefined;
  const m = uri.match(/attocamera\.rdf\/ac(\d+)_([^/#?]+)$/);
  return m ? { legislature: m[1], id: m[2] } : undefined;
}

/**
 * URL della scheda istituzionale di un atto/DDL dal suo URI.
 * Gestisce sia gli atti Camera sia i DDL Senato. Stringa vuota se ignoto.
 *
 * - Atto Camera: .../attocamera.rdf/ac{LEG}_{ID}
 *   → https://www.camera.it/leg{LEG}/126?leg={LEG}&idDocumento={ID}
 * - DDL Senato:  http://dati.senato.it/ddl/{N}
 *   → https://www.senato.it/leggi-e-documenti/disegni-di-legge/scheda-ddl?tab=datiGenerali&did={N}
 *
 * Per gli atti variante l'id va passato INTERO: la scheda di `ac19_703-B` vive
 * su `idDocumento=703-B` (verificato: la pagina dichiara "Atto Camera: 703-B"),
 * non su quella dell'atto base, che racconta un iter diverso.
 */
export function actHtmlUrl(uri: string | undefined | null): string {
  if (!uri) return "";

  const cam = parseCameraActUri(uri);
  if (cam) {
    const { legislature: leg, id } = cam;
    return `https://www.camera.it/leg${leg}/126?leg=${leg}&idDocumento=${encodeURIComponent(id)}`;
  }

  const ddl = uri.match(/dati\.senato\.it\/ddl\/(\d+)$/);
  if (ddl) {
    return `https://www.senato.it/leggi-e-documenti/disegni-di-legge/scheda-ddl?tab=datiGenerali&did=${ddl[1]}`;
  }

  return "";
}

/**
 * Feed RSS per-DDL del Senato (iter dettagliato). Richiede la legislatura,
 * non presente nell'URI del DDL. Stringa vuota se URI non-DDL o leg mancante.
 *
 * http://dati.senato.it/ddl/{N} (+ leg) → .../feed-rss/documenti/ddl/rss/{N}/{leg}
 */
export function ddlRssUrl(
  uri: string | undefined | null,
  legislature: number | string | undefined | null,
): string {
  if (!uri || !legislature) return "";
  const ddl = uri.match(/dati\.senato\.it\/ddl\/(\d+)$/);
  if (!ddl) return "";
  return `https://www.senato.it/feed-rss/documenti/ddl/rss/${ddl[1]}/${legislature}`;
}
