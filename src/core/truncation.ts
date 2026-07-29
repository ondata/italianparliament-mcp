import type { ToolResult } from "../tools/types.js";

/** Tetto di `--limit` condiviso dagli schemi Zod dei tool lista. */
const MAX_LIMIT = 1000;

/**
 * Avviso di troncamento: il risultato ha riempito `--limit`, quindi altre
 * righe che soddisfano i filtri possono essere rimaste fuori.
 *
 * Perché serve: i tool lista ordinano per data DESCRESCENTE e tagliano a
 * `LIMIT`. Su un intervallo di date è quindi la parte PIÙ VECCHIA a sparire, e
 * spariva in silenzio: `votes list --date-from 2020-02-24 --date-to 2020-02-28`
 * restituiva 100 righe tutte del 27/2, facendo sembrare che il 25/2 — giorno
 * della fiducia sul decreto intercettazioni — non si fosse votato.
 *
 * `--limit` più alto non è sempre la via d'uscita: su
 * `aic --date-from 2025-01-01 --date-to 2025-12-31` anche il massimo (1000)
 * copre il solo dicembre. Per questo il messaggio cambia quando il limite è
 * già al tetto: lì l'unica strada è `--offset` o restringere l'intervallo.
 */
export function truncationNotice(limit: number): string {
  const escape =
    limit >= MAX_LIMIT
      ? `--limit è già al massimo (${MAX_LIMIT}): pagina con --offset ${limit} o restringi l'intervallo`
      : `rilancia con --limit più alto (max ${MAX_LIMIT}), pagina con --offset o restringi l'intervallo`;
  return (
    `AVVISO: risultato troncato a ${limit} righe (--limit): esistono altre righe che ` +
    "soddisfano i filtri e non sono in questo output. Se hai filtrato per intervallo di date, " +
    "l'ordinamento decrescente fa sì che a mancare siano i giorni PIÙ VECCHI dell'intervallo: " +
    "NON concludere che in quei giorni non sia successo nulla. " +
    `Per sapere quante righe esistono davvero usa --count-only (dove disponibile); ${escape}.`
  );
}

/**
 * Valorizza `notice` quando il risultato risulta troncato. Chiamata una volta
 * sola nei due chokepoint (CLI `runTool`, MCP `makeHandler`) così l'avviso vale
 * per tutti i tool, non per quello in cui il problema è emerso.
 *
 * Il segnale di default è `rows.length >= limit`. È un'approssimazione: vale
 * finché il tool restituisce una riga per ogni riga della query. I tool che
 * ACCORCIANO le righe dopo la query (dedup in `votes`, filtro date lato TS in
 * `audizioni`) devono impostare `truncated` da soli sul conteggio grezzo,
 * altrimenti un risultato troncato ma deduplicato scivolerebbe via muto — lo
 * stesso silenzio che questa funzione esiste per togliere.
 *
 * Falso positivo accettato: un risultato che per caso ha esattamente `limit`
 * righe genera l'avviso. Costa una riga su stderr; il falso negativo costa un
 * articolo sbagliato. Per questo il messaggio dice "possono", non "mancano".
 */
export function withTruncationNotice(
  result: ToolResult,
  limit: number | undefined,
): ToolResult {
  if (typeof limit !== "number" || limit <= 0) return result;
  const truncated = result.truncated ?? result.rows.length >= limit;
  if (!truncated) return result;
  return { ...result, notice: truncationNotice(limit) };
}
