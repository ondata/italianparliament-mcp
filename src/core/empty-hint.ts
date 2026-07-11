import type { ToolResult } from "../tools/types.js";

/**
 * Su risultato vuoto senza hint dinamico, valorizza `hint` con l'emptyHint
 * statico del tool (precedenza `result.hint ?? emptyHint`, come il path MCP in
 * server.ts). Non muta l'input: restituisce un nuovo oggetto solo se serve.
 * Così la CLI (emit → stderr) e l'MCP comunicano lo stesso messaggio.
 */
export function withEmptyHint(result: ToolResult, emptyHint?: string): ToolResult {
  if (result.rows.length === 0 && !result.hint && emptyHint) {
    return { ...result, hint: emptyHint };
  }
  return result;
}
