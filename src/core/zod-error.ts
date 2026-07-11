import { ZodError } from "zod";

// Formatta un ZodError in un messaggio compatto, una riga per campo, con i
// valori ammessi per gli enum. Condiviso tra CLI e path MCP (server.ts) così
// un input non valido produce lo stesso errore leggibile invece della stringa
// JSON lunga di default di Zod. flagStyle=true antepone "--" al nome del campo
// (stile flag CLI); false lascia il nome del parametro nudo (MCP).
export function formatZodError(e: ZodError, flagStyle = false): string {
  // flagStyle: rende il campo come il flag CLI reale — "--" + kebab-case
  // (dateFrom -> --date-from, voteType -> --vote-type), così l'errore non
  // suggerisce un flag camelCase inesistente. MCP usa il nome nudo dello schema.
  const label = (field: string) =>
    flagStyle ? `--${field.replace(/([A-Z])/g, "-$1").toLowerCase()}` : field;
  const safeJson = (value: unknown) => {
    try {
      return JSON.stringify(value) ?? "undefined";
    } catch {
      return String(value);
    }
  };
  return e.issues
    .map((i) => {
      const field = i.path.join(".") || "input";
      if (i.code === "invalid_enum_value") {
        const received = safeJson(i.received);
        const allowed = i.options.map((v) => safeJson(v)).join(" | ");
        return `${label(field)}: valore non valido ${received}. Ammessi: ${allowed}.`;
      }
      return `${label(field)}: ${i.message}`;
    })
    .join("\n");
}
