import { ZodError } from "zod";

// Formatta un ZodError in un messaggio compatto, una riga per campo, con i
// valori ammessi per gli enum. Condiviso tra CLI e path MCP (server.ts) così
// un input non valido produce lo stesso errore leggibile invece della stringa
// JSON lunga di default di Zod. flagStyle=true antepone "--" al nome del campo
// (stile flag CLI); false lascia il nome del parametro nudo (MCP).
export function formatZodError(e: ZodError, flagStyle = false): string {
  const p = flagStyle ? "--" : "";
  return e.issues
    .map((i) => {
      const field = i.path.join(".") || "input";
      return i.code === "invalid_enum_value"
        ? `${p}${field}: valore non valido "${(i as { received?: string }).received ?? ""}". Ammessi: ${i.options.join(" | ")}.`
        : `${p}${field}: ${i.message}`;
    })
    .join("\n");
}
