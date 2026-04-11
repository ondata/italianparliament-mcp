import { deputiesTool } from "./deputies.js";
import { senatorsTool } from "./senators.js";
import { billsTool } from "./bills.js";
import { votesTool } from "./votes.js";
import { searchTool } from "./search.js";
import type { Tool } from "./types.js";

export const tools: Tool[] = [
  deputiesTool,
  senatorsTool,
  billsTool,
  votesTool,
  searchTool,
];

export const toolsByName: Record<string, Tool> = Object.fromEntries(
  tools.map((t) => [t.name, t]),
);

export {
  deputiesTool,
  senatorsTool,
  billsTool,
  votesTool,
  searchTool,
};
export type { Tool, ToolResult } from "./types.js";
