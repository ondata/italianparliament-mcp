/**
 * Validazione dei nomi di opzione passati alla CLI.
 *
 * Il parser (citty/mri) accetta qualsiasi `--qualcosa`: le opzioni non
 * dichiarate finiscono nell'oggetto args e nessuno le guarda. Chi sbaglia il
 * nome di un flag (`--committee-uri` invece di `--committee-name`) riceve
 * quindi un risultato normale, senza il filtro che credeva di aver applicato —
 * il caso peggiore per un agente, che non ha modo di accorgersene. Qui i nomi
 * ignoti diventano un errore esplicito, con il suggerimento del nome più vicino.
 */

/**
 * Valore booleano di un'opzione, con il flag nudo trattato come errore.
 *
 * I flag booleani sono dichiarati `type: "string"` perché devono accettare sia
 * `true` sia `false`: citty, per un `--confidence-vote` senza valore, mette in
 * args la stringa vuota. Trattarla come "opzione assente" è la stessa trappola
 * che questo modulo esiste per chiudere — chi scrive `votes list --legislature 19
 * --confidence-vote` intende filtrare le fiducie e si vede restituire TUTTE le
 * votazioni (19.428 invece di 71), un numero plausibile e sbagliato, senza un
 * segnale che il filtro non è mai stato applicato.
 */
export function parseBoolFlag(
  raw: string | boolean | undefined,
  name: string,
): boolean | undefined {
  if (raw === undefined) return undefined;
  if (raw === true || raw === "true") return true;
  if (raw === false || raw === "false") return false;
  if (raw === "")
    throw new Error(
      `--${name} richiede un valore: true o false. ` +
        `Scritto da solo non filtra nulla, e il risultato che ricevi è quello NON filtrato: ` +
        `usa --${name} true.`,
    );
  throw new Error(`Invalid --${name} value "${raw}". Expected: true or false.`);
}

/** `date-from` → `dateFrom` */
function camelCase(s: string): string {
  return s.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

/** `dateFrom` → `date-from` */
function kebabCase(s: string): string {
  return s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

/**
 * Tutte le grafie con cui un'opzione dichiarata può essere scritta. citty
 * accede agli argomenti attraverso un Proxy che prova nome, camelCase e
 * kebabCase: `--dateFrom` funziona già oggi dove è dichiarato `date-from`, e
 * deve continuare a funzionare.
 */
function spellings(name: string): string[] {
  return [name, camelCase(name), kebabCase(name)];
}

/** Distanza di Levenshtein, per suggerire il nome dichiarato più vicino. */
function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev.splice(0, prev.length, ...curr);
  }
  return prev[b.length];
}

/**
 * Nome dichiarato più vicino a quello sconosciuto, se abbastanza vicino da
 * essere plausibilmente un refuso (un terzo della lunghezza, minimo 2 caratteri
 * di distanza): meglio nessun suggerimento che uno fuorviante.
 */
export function suggestFlag(
  unknown: string,
  declared: string[],
): string | undefined {
  const soglia = Math.max(2, Math.floor(unknown.length / 3));
  let best: { name: string; d: number } | undefined;
  for (const name of declared) {
    const d = editDistance(unknown.toLowerCase(), name.toLowerCase());
    if (d <= soglia && (!best || d < best.d)) best = { name, d };
  }
  return best?.name;
}

/**
 * Opzioni passate che non corrispondono a nessuna dichiarata. `passed` sono le
 * chiavi dell'oggetto args (già senza `_`), `declared` i nomi dichiarati più i
 * loro alias.
 */
export function unknownFlags(passed: string[], declared: string[]): string[] {
  const valid = new Set(declared.flatMap(spellings));
  return passed.filter((k) => !spellings(k).some((s) => valid.has(s)));
}

/**
 * Messaggio d'errore. `declared` sono qui le sole OPZIONI: gli argomenti
 * posizionali (`which <capability>`) valgono per il controllo ma non vanno
 * elencati né suggeriti col trattino, perché `--capability` non esiste.
 * `dashByFlag` ricostruisce come l'utente ha scritto l'opzione (`-q` contro
 * `--q`): citarla in una forma che non ha digitato farebbe sembrare l'errore
 * un altro.
 */
export function buildUnknownFlagError(
  unknowns: string[],
  declared: string[],
  dashByFlag: Map<string, string> = new Map(),
): string {
  const dash = (f: string) => `${dashByFlag.get(f) ?? "--"}${f}`;
  const parti = unknowns.map((u) => {
    const forse = suggestFlag(u, declared);
    return forse ? `${dash(u)} (forse intendevi --${forse}?)` : dash(u);
  });
  const etichetta = unknowns.length > 1 ? "Opzioni sconosciute" : "Opzione sconosciuta";
  return (
    `${etichetta}: ${parti.join(", ")}. ` +
    `Il filtro che credevi di applicare NON è stato applicato: rileggi il risultato solo dopo aver corretto il nome. ` +
    `Opzioni valide per questo comando: ${declared.map((d) => `--${d}`).join(", ")}.`
  );
}

/**
 * Ricostruisce, per ogni nome di opzione, il prefisso con cui compare negli
 * argomenti grezzi (`-` o `--`).
 */
export function dashPrefixes(rawArgs: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const arg of rawArgs) {
    const m = /^(-{1,2})([^-=][^=]*)/.exec(arg);
    if (m) map.set(m[2], m[1]);
  }
  return map;
}
