/**
 * Scelta della legislatura da interrogare quando chi chiama non la indica.
 *
 * Il default fisso sulla legislatura in corso è una trappola ricorrente: chi
 * cerca per data (o per persona) un evento di legislature passate interroga in
 * silenzio la corrente e riceve "nessun risultato", cioè un messaggio che
 * afferma l'assenza del dato mentre il dato c'è altrove. Ogni tool deduce la
 * legislatura dai propri input — le sedute dell'intervallo, le legislature di
 * un DDL o di un senatore — e passa qui l'esito per decidere cosa farne.
 *
 * I messaggi restano nei singoli tool: cambiano ramo (Camera/Senato) e
 * spiegazione del perché non si possano interrogare più legislature insieme.
 */

/** Legislatura in corso: usata solo quando non c'è nulla da cui dedurla. */
export const CURRENT_LEGISLATURE = 19;

export type LegislatureChoice =
  | { kind: "explicit" | "default" | "derived"; legislature: number }
  | { kind: "ambiguous"; legislatures: number[] }
  | { kind: "none" };

/**
 * `derived` è l'esito della deduzione: `undefined` quando non è stata tentata
 * (legislatura esplicita, nessun input da cui dedurre) o è fallita — casi in
 * cui si ricade sulla legislatura in corso, cioè il comportamento storico.
 * Un array vuoto è invece un'informazione: nessuna legislatura corrisponde.
 */
/**
 * Elenco leggibile di legislature ("18 e 19", "17, 18 e 19"): un intervallo di
 * date aperto può coprirne più di due, e un messaggio che ne dà per scontate
 * due sarebbe scorretto proprio nel caso più ampio.
 */
export function formatLegislatureList(legislatures: number[]): string {
  if (legislatures.length <= 1) return legislatures.join("");
  return `${legislatures.slice(0, -1).join(", ")} e ${legislatures[legislatures.length - 1]}`;
}

export function resolveLegislature(
  explicit: number | undefined,
  derived?: number[],
): LegislatureChoice {
  if (explicit !== undefined)
    return { kind: "explicit", legislature: explicit };
  if (derived === undefined)
    return { kind: "default", legislature: CURRENT_LEGISLATURE };
  if (derived.length === 0) return { kind: "none" };
  if (derived.length === 1) return { kind: "derived", legislature: derived[0] };
  return { kind: "ambiguous", legislatures: [...derived].sort((a, b) => a - b) };
}
