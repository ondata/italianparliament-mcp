/**
 * Estrae il numero di provvedimento (DDL Senato / atto Camera) citato in un
 * testo libero: `rdfs:label` di una votazione Senato o `dc:description` di una
 * votazione Camera.
 *
 * Formati coperti (case-insensitive): "Disegno di legge n. 1193",
 * "Ddl n.345", "DDL 562-B", "DDL 2920-A - VOTO FINALE", "TU DDL 1168 E ABB-A",
 * "PDL 1928-A" / "Proposta di legge n. ..." (atti di iniziativa parlamentare,
 * stesso schema di DDL/disegno di legge).
 *
 * Gli Ordini del Giorno della Camera citano l'atto senza la parola
 * "DDL"/"PDL", con la numerazione ufficiale "9/<atto>/<progressivo>" in due
 * varianti osservate: abbreviata ("ODG 9/2920/46") ed estesa ("Ordine del
 * giorno n. 9/1049/3 COGNOME NOME (GRUPPO)"). Verificato su tutte le
 * votazioni ODG del DDL 2920 (58/58) più un campione di 6000 voti su
 * legislatura 19: numero atto sempre in posizione centrale, con "E ABB"
 * (e abbinate) come suffisso testuale tollerato prima del progressivo finale.
 * Non copre i rari casi di "testo unificato" con riferimento di ramo aggiuntivo
 * (es. "9/1928 E ABB-A/R/8", 4 segmenti anziché 3): restano correttamente
 * vuoti piuttosto che rischiare un'estrazione sbagliata.
 *
 * Restituisce il numero con l'eventuale suffisso di lettura ("562-B",
 * "924-bis") oppure "" se il testo non cita un DDL/PDL.
 *
 * Il suffisso è significativo al **Senato** (identifica ramo/lettura: `S.562-B`
 * ≠ `S.562`), mentre alla **Camera** l'atto è il numero base — vedi
 * {@link billBaseNumber}.
 */
export function extractBillNumber(text: string | undefined): string {
  if (!text) return "";
  const m = text.match(
    /(?:disegno di legge|proposta di legge|ddl|pdl)[.\s]*n?[.\s]*(\d+(?:-[A-Za-z]+)*)/i,
  );
  if (m) return m[1];
  const odg = text.match(
    /\b(?:odg|ordine del giorno)\b[.\s]*n?[.\s]*9\/(\d+(?:-[A-Za-z]+)*)(?:\s+e\s+abb\.?)?\/\d+/i,
  );
  return odg ? odg[1] : "";
}

/**
 * Numero base senza suffisso di lettura ("1632-A" → "1632", "924-bis" → "924").
 * Alla Camera l'URI dell'atto usa il numero base (`dc:identifier` = "1632").
 */
export function billBaseNumber(billNumber: string): string {
  return billNumber.replace(/-.*$/, "");
}
