/**
 * Nome d'uso vs nome anagrafico nel grafo della Camera.
 *
 * Le entità `ocd:persona` portano in `rdfs:label` e `foaf:surname` il cognome
 * **anagrafico**: la ministra per le Riforme è "MARIA ELISABETTA ALBERTI", non
 * "ALBERTI CASELLATI". Il cognome con cui la persona è pubblicamente nota vive
 * un hop più in là, dentro un blank node `foaf:nickname` (`foaf:firstName` +
 * `foaf:surname`) — mai come literal (verificato: 16.802 nickname, zero literal).
 * Le entità `ocd:deputato`, per la stessa persona, usano invece già il nome
 * d'uso nella `rdfs:label`: le due convenzioni convivono nello stesso grafo.
 *
 * Riguarda 135 persone (12 delle quali membri di governo): Villecco Calipari,
 * Scilipoti Isgrò, Guidi Cingolani, Mogherini Rebesani, De Unterrichter
 * Jervolino…
 *
 * La scelta qui è deterministica e non usa alcuna tabella di alias: fra i due
 * cognomi si tiene quello che contiene l'altro, cioè il più informativo. Nei
 * pochi casi in cui sono disgiunti — cognome acquisito ("DI SERIO" / "D'ANTONA")
 * o pseudonimo ("TRANQUILLI" / "SILONE") — si mostrano entrambi invece di
 * sceglierne uno arbitrariamente.
 */

/** Normalizza per il solo confronto: maiuscole, apostrofi e spazi uniformati. */
function comparable(s: string): string {
  return s
    .toUpperCase()
    .replace(/['’]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Dati il cognome anagrafico (`foaf:surname` della persona) e quello d'uso
 * (`foaf:surname` del blank node `foaf:nickname`), restituisce il più
 * informativo. Con un solo valore valorizzato restituisce quello.
 */
export function preferredName(registry: string, used: string): string {
  const a = (registry ?? "").trim();
  const b = (used ?? "").trim();
  if (!a) return b;
  if (!b) return a;

  const ca = comparable(a);
  const cb = comparable(b);
  // Stessa persona scritta in due modi (es. "DE VIDOVICH" / "DE' VIDOVICH"):
  // vince la forma del nome d'uso, che è quella pubblicata sulle schede.
  if (ca === cb) return b;
  if (cb.includes(ca)) return b;
  if (ca.includes(cb)) return a;
  return `${a} (${b})`;
}

/**
 * Variante per i **nomi completi**: confronta il nome ricomposto da
 * firstName+surname con la `rdfs:label` dell'entità (per le `ocd:deputato` la
 * label porta già il nome d'uso) e tiene la label solo quando la contiene.
 *
 * Qui, a differenza dei cognomi, le due forme disgiunte non vanno mostrate
 * entrambe: fra nomi completi la differenza è quasi sempre un secondo nome
 * presente da un lato solo — 527 deputati, per esempio "CARLO VENEGONI" contro
 * "CARLO EUGENIO VENEGONI" — e un `Nome (Altro nome)` in un campo di sola
 * visualizzazione sarebbe rumore. Nel dubbio si tiene il nome composto.
 */
export function richerDisplayName(composed: string, label: string): string {
  const a = (composed ?? "").trim();
  const b = (label ?? "").trim();
  if (!a) return b;
  if (!b) return a;
  return comparable(b).includes(comparable(a)) ? b : a;
}

/**
 * Nome completo da mostrare. `aliasSurnames` sono i cognomi d'uso trovati sui
 * blank node `foaf:nickname` (18 persone ne hanno due, 4 delle quali membri di
 * governo): si applica `preferredName` in cascata, così l'ordine con cui
 * l'endpoint li restituisce non cambia il risultato.
 */
export function personDisplayName(
  firstName: string,
  surname: string,
  aliasSurnames: string[] = [],
): string {
  const surnameToShow = aliasSurnames
    .filter((s) => s && s.trim())
    .reduce((acc, alias) => preferredName(acc, alias), (surname ?? "").trim());
  return `${(firstName ?? "").trim()} ${surnameToShow}`.trim();
}
