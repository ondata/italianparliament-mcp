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
  execute(input: z.infer<S>): Promise<ToolResult>;
};
