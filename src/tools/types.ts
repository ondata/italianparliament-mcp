import type { ZodTypeAny, z } from "zod";
import type { Row } from "../core/types.js";

export type ToolResult = {
  rows: Row[];
  columns: string[];
  /**
   * Nota dinamica calcolata a runtime, mostrata SOLO quando il risultato è
   * vuoto. A differenza di `emptyHint` (statico), dipende dall'input: serve a
   * qualificare un vuoto ambiguo (es. finestra di date recente non ancora
   * caricata nel LOD). Se presente, ha precedenza sull'emptyHint statico.
   */
  hint?: string;
  /**
   * Avviso mostrato quando il risultato NON è vuoto ma è stato tagliato da
   * `limit`. Campo distinto da `hint`, che resta riservato al risultato vuoto:
   * i due casi convivono senza sovrapporsi. Lo valorizza
   * `withTruncationNotice`, non i singoli tool.
   */
  notice?: string;
  /**
   * Il tool dichiara di essere stato troncato dalla query. Da impostare SOLO
   * nei tool che accorciano le righe dopo la query (dedup, filtri lato TS):
   * lì `rows.length >= limit` non è più un segnale affidabile e va calcolato
   * sul conteggio grezzo. Altrove va lasciato assente.
   */
  truncated?: boolean;
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
