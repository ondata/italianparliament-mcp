import type { ZodTypeAny, z } from "zod";
import type { Row } from "../core/types.js";

export type ToolResult = {
  rows: Row[];
  columns: string[];
};

export type Tool<S extends ZodTypeAny = ZodTypeAny> = {
  name: string;
  description: string;
  inputSchema: S;
  examples: string[];
  /**
   * Messaggio mostrato al posto del default quando il risultato è vuoto.
   * Serve a direzionare i client che non caricano la skill: quando un dato
   * manca, il rischio di confabulazione è massimo, quindi qui si mette una
   * nota specifica (es. "riprova per numero, non per keyword"). Solo MCP.
   */
  emptyHint?: string;
  execute(input: z.infer<S>): Promise<ToolResult>;
};
