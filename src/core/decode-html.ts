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
  "&agrave;": "\u00e0",
};

const ENTITY_RE = new RegExp(Object.keys(ENTITIES).join("|"), "g");

/**
 * Pulisce stringhe che arrivano dall'endpoint Camera con:
 * - suffisso "^^http://www.w3.org/2001/XMLSchema#string" nel valore raw
 * - tag HTML (<em>, </em>, ecc.)
 * - entità HTML (&quot;, &rsquo;, &agrave;, ecc.)
 */
export function decodeHtml(s: string): string {
  return s
    .replace(/\s*\^\^https?:\/\/\S+/g, "")      // rimuove ^^xsd:type
    .replace(ENTITY_RE, (m) => ENTITIES[m] ?? m) // decodifica entità (es. &lt; → <)
    .replace(/<[^>]+>/g, "")                      // rimuove tag HTML risultanti
    .trim();
}
