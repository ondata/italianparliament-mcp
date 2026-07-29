import type { ToolResult } from "../tools/types.js";

/**
 * Tetto di `--limit` quando lo schema non lo dichiara. NON è il tetto di tutti
 * i tool: i massimi reali vanno da 100 (`rank`) a 5000 (`camera-amendments`),
 * per questo il valore giusto si legge dallo schema Zod (`limitCeiling`) invece
 * di essere costante.
 */
const FALLBACK_MAX_LIMIT = 1000;

/**
 * Legge il massimo ammesso da `--limit` dallo schema Zod del tool, scartando il
 * wrapper `.default()`. Suggerire "alza --limit fino a N" con N sbagliato
 * manderebbe l'utente contro un errore di validazione (o gli farebbe credere di
 * essere al tetto quando non lo è): il tetto lo conosce solo lo schema.
 */
export function limitCeiling(inputSchema: unknown): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shape = (inputSchema as any)?.shape;
  const field = shape?.limit;
  if (!field) return FALLBACK_MAX_LIMIT;
  const inner = field._def?.innerType ?? field;
  const max = inner?.maxValue;
  return typeof max === "number" && max > 0 ? max : FALLBACK_MAX_LIMIT;
}

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
 *
 * Il testo non afferma quante righe siano state restituite ("troncato DA un
 * limite di N", non "troncato A N righe"): `search` interroga i due rami e
 * unisce, quindi può restituirne fino al doppio pur essendo tagliata a N per
 * ramo.
 */
export function truncationNotice(
  limit: number,
  offset = 0,
  maxLimit = FALLBACK_MAX_LIMIT,
): string {
  // La pagina successiva parte da offset+limit, non da limit: suggerire
  // `--offset <limit>` a chi è già oltre la prima pagina lo rimanderebbe a
  // righe appena lette.
  const next = offset + limit;
  const escape =
    limit >= maxLimit
      ? `--limit è già al massimo (${maxLimit}): pagina con --offset ${next} o restringi l'intervallo`
      : `rilancia con --limit più alto (max ${maxLimit}), pagina con --offset ${next} o restringi l'intervallo`;
  return (
    `AVVISO: risultato troncato da un limite di ${limit} righe (--limit): possono esistere ` +
    "altre righe che soddisfano i filtri e non sono in questo output. Se hai filtrato per " +
    "intervallo di date, l'ordinamento decrescente fa sì che a mancare siano i giorni PIÙ " +
    "VECCHI dell'intervallo: NON concludere che in quei giorni non sia successo nulla. " +
    `Per sapere quante righe esistono davvero usa --count-only (dove disponibile); ${escape}.`
  );
}

/**
 * Un risultato di `--count-only` è una riga sola con la sola colonna `count`:
 * è un aggregato completo per costruzione, mai una pagina di un elenco. Senza
 * questa guardia `--count-only --limit 1` produrrebbe un avviso di troncamento
 * su un totale esatto — l'opposto del suo scopo.
 */
function isCountResult(result: ToolResult): boolean {
  return (
    result.rows.length === 1 &&
    result.columns.length === 1 &&
    result.columns[0] === "count"
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
 * `audizioni`), che ne restituiscono PIÙ del limite (`search`, che unisce i due
 * rami) o dove `--limit` non è quello applicato (`sparql` con LIMIT proprio)
 * devono impostare `truncated` da soli, altrimenti l'euristica mente in un
 * verso o nell'altro.
 *
 * Falso positivo accettato: un risultato che per caso ha esattamente `limit`
 * righe genera l'avviso. Costa una riga su stderr; il falso negativo costa un
 * articolo sbagliato. Per questo il messaggio dice "possono esistere altre
 * righe", non "mancano N righe": nel falso positivo resterebbe vero.
 */
export function withTruncationNotice(
  result: ToolResult,
  limit: number | undefined,
  offset: number | undefined = 0,
  maxLimit: number = FALLBACK_MAX_LIMIT,
): ToolResult {
  if (typeof limit !== "number" || limit <= 0) return result;
  // Su risultato vuoto parla `hint`, mai `notice`: è il contratto dichiarato in
  // ToolResult, e senza questa guardia un tool che imposta `truncated: true`
  // potrebbe far stampare i due messaggi insieme, in contraddizione.
  if (result.rows.length === 0 || isCountResult(result)) return result;
  const truncated = result.truncated ?? result.rows.length >= limit;
  if (!truncated) return result;
  const from = typeof offset === "number" && offset > 0 ? offset : 0;
  return { ...result, notice: truncationNotice(limit, from, maxLimit) };
}
