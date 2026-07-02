const ENTITIES: Record<string, string> = {
  "&quot;": '"',
  "&apos;": "'",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&nbsp;": " ",
  "&rsquo;": "\u2019",
  "&lsquo;": "\u2018",
  "&rdquo;": "\u201d",
  "&ldquo;": "\u201c",
  "&ndash;": "\u2013",
  "&mdash;": "\u2014",
  "&hellip;": "\u2026",
  "&euro;": "\u20ac",
  "&laquo;": "\u00ab",
  "&raquo;": "\u00bb",
  "&agrave;": "\u00e0",
  "&egrave;": "\u00e8",
  "&eacute;": "\u00e9",
  "&igrave;": "\u00ec",
  "&ograve;": "\u00f2",
  "&ugrave;": "\u00f9",
};

const ENTITY_RE = new RegExp(Object.keys(ENTITIES).join("|"), "g");

/** Riferimento numerico → carattere; lascia il match invariato se il codepoint non è valido. */
function fromCharRef(code: number, original: string): string {
  if (!Number.isInteger(code) || code <= 0 || code > 0x10ffff) return original;
  try {
    return String.fromCodePoint(code);
  } catch {
    return original;
  }
}

/**
 * Pulisce stringhe che arrivano dall'endpoint Camera con:
 * - suffisso "^^http://www.w3.org/2001/XMLSchema#string" nel valore raw
 * - tag HTML (<em>, </em>, ecc.)
 * - entità HTML con nome (&quot;, &rsquo;, &agrave;, ecc.)
 * - entità HTML numeriche, decimali (&#39;) ed esadecimali (&#x27;)
 */
export function decodeHtml(s: string): string {
  return s
    .replace(/\s*\^\^https?:\/\/\S+/g, "")      // rimuove ^^xsd:type
    .replace(ENTITY_RE, (m) => ENTITIES[m] ?? m) // decodifica entità con nome (es. &lt; → <)
    .replace(/&#x([0-9a-fA-F]+);/g, (m, h) => fromCharRef(parseInt(h, 16), m)) // esadecimali
    .replace(/&#(\d+);/g, (m, d) => fromCharRef(parseInt(d, 10), m))           // decimali (es. &#39; → ')
    .replace(/<[^>]+>/g, "")                      // rimuove tag HTML risultanti
    .trim();
}
