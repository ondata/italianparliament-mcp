/**
 * Riconosce il ramo (Camera o Senato) dall'**host** di un URI del LOD.
 *
 * Non con `uri.includes("dati.camera.it")`: quella forma accetta anche un URI
 * che quel testo se lo porta nel superdominio, nel path o nella query
 * (`https://dati.camera.it.example.org/...`, `https://example.org/?x=dati.senato.it`),
 * instradandolo verso un endpoint che non lo conosce — il risultato è un vuoto
 * che sembra "l'atto non c'è" invece di "l'URI non è di questo grafo".
 *
 * Restituisce `undefined` quando l'host non è uno dei due o l'URI non è
 * nemmeno un URL: entrambi i casi vanno trattati come input non riconosciuto,
 * non come vuoto.
 */
export type Chamber = "camera" | "senato";

const HOSTS: Record<string, Chamber> = {
  "dati.camera.it": "camera",
  "dati.senato.it": "senato",
};

export function chamberFromUri(uri?: string): Chamber | undefined {
  if (!uri) return undefined;
  try {
    return HOSTS[new URL(uri).hostname];
  } catch {
    return undefined;
  }
}
