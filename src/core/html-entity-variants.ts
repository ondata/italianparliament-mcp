const HTML_ENTITY_BY_CHAR: Record<string, string> = {
  '"': "&quot;",
  "'": "&apos;",
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\u2019": "&rsquo;",
  "\u2018": "&lsquo;",
  "\u201d": "&rdquo;",
  "\u201c": "&ldquo;",
  "\u2013": "&ndash;",
  "\u2014": "&mdash;",
  "\u2026": "&hellip;",
  "\u20ac": "&euro;",
  "\u00ab": "&laquo;",
  "\u00bb": "&raquo;",
  "\u00e0": "&agrave;",
  "\u00e8": "&egrave;",
  "\u00e9": "&eacute;",
  "\u00ec": "&igrave;",
  "\u00f2": "&ograve;",
  "\u00f9": "&ugrave;",
  "\u00c0": "&Agrave;",
  "\u00c8": "&Egrave;",
  "\u00c9": "&Eacute;",
  "\u00cc": "&Igrave;",
  "\u00d2": "&Ograve;",
  "\u00d9": "&Ugrave;",
};

const HTML_ENTITY_CHARS = /["'&<>\u2018\u2019\u201c\u201d\u2013\u2014\u2026\u20ac\u00ab\u00bb\u00e0\u00e8\u00e9\u00ec\u00f2\u00f9\u00c0\u00c8\u00c9\u00cc\u00d2\u00d9]/g;

/**
 * Camera LOD often stores title/label literals with HTML entities
 * (e.g. `criminalit&agrave;`) while CLI users search the decoded text
 * (`criminalità`). Return both forms so SPARQL filters can match raw data.
 */
export function htmlEntityKeywordVariants(keyword: string): string[] {
  const htmlEncoded = keyword.replace(
    HTML_ENTITY_CHARS,
    (char) => HTML_ENTITY_BY_CHAR[char] ?? char,
  );
  return [...new Set([keyword, htmlEncoded])];
}
