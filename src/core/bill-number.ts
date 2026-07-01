/**
 * Estrae il numero di provvedimento (DDL Senato / atto Camera) citato in un
 * testo libero: `rdfs:label` di una votazione Senato o `dc:description` di una
 * votazione Camera.
 *
 * Formati coperti (case-insensitive): "Disegno di legge n. 1193",
 * "Ddl n.345", "DDL 562-B", "DDL 2920-A - VOTO FINALE", "TU DDL 1168 E ABB-A".
 *
 * Restituisce il numero con l'eventuale suffisso di lettura ("562-B",
 * "924-bis") oppure "" se il testo non cita un DDL.
 *
 * Il suffisso è significativo al **Senato** (identifica ramo/lettura: `S.562-B`
 * ≠ `S.562`), mentre alla **Camera** l'atto è il numero base — vedi
 * {@link billBaseNumber}.
 */
export function extractBillNumber(text: string | undefined): string {
  if (!text) return "";
  const m = text.match(/(?:disegno di legge|ddl)[.\s]*n?[.\s]*(\d+(?:-[A-Za-z]+)*)/i);
  return m ? m[1] : "";
}

/**
 * Numero base senza suffisso di lettura ("1632-A" → "1632", "924-bis" → "924").
 * Alla Camera l'URI dell'atto usa il numero base (`dc:identifier` = "1632").
 */
export function billBaseNumber(billNumber: string): string {
  return billNumber.replace(/-.*$/, "");
}
