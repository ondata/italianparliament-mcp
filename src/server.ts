import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deputiesTool } from "./tools/deputies.js";
import { senatorsTool } from "./tools/senators.js";
import { billsTool } from "./tools/bills.js";
import { votesTool } from "./tools/votes.js";
import { searchTool } from "./tools/search.js";
import { legislaturesTool } from "./tools/legislatures.js";
import { groupsTool } from "./tools/groups.js";
import { sessionsTool } from "./tools/sessions.js";
import { governmentsTool } from "./tools/governments.js";
import { deputyTool } from "./tools/deputy.js";
import { senatorTool } from "./tools/senator.js";
import { billTool } from "./tools/bill.js";
import { rolesTool } from "./tools/roles.js";
import { speechesTool } from "./tools/speeches.js";
import { aicTool } from "./tools/aic.js";
import { voteDetailTool } from "./tools/vote-detail.js";
import { groupMembersTool } from "./tools/group-members.js";
import { senatorGroupMembersTool } from "./tools/senator-group-members.js";
import { govMembersTool } from "./tools/gov-members.js";
import { committeesTool } from "./tools/committees.js";
import { billProgressTool } from "./tools/bill-progress.js";
import { billSignatoriesTool } from "./tools/bill-signatories.js";
import { amendmentsTool } from "./tools/amendments.js";
import { documentsTool } from "./tools/documents.js";
import { sparqlTool } from "./tools/sparql.js";
import type { Tool, ToolResult } from "./tools/types.js";
import { toJsonl } from "./core/format.js";
import { SparqlError } from "./core/client.js";

function describe(tool: Tool): string {
  return `${tool.description}\n\nExamples:\n${tool.examples
    .map((e) => `  ${e}`)
    .join("\n")}`;
}

function formatResult(result: ToolResult): string {
  if (result.rows.length === 0) return "No results.";
  return toJsonl(result.rows);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeHandler(tool: { execute(input: any): Promise<ToolResult> }) {
  return async (input: unknown) => {
    try {
      const result = await tool.execute(input);
      return {
        content: [{ type: "text" as const, text: formatResult(result) }],
      };
    } catch (err) {
      const message =
        err instanceof SparqlError
          ? `SPARQL error on ${err.endpoint}${err.status ? ` (HTTP ${err.status})` : ""}: ${err.message}`
          : err instanceof Error
            ? err.message
            : String(err);
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  };
}

export function createServer(): McpServer {
  return new McpServer({
    name: "italianparliament-mcp",
    version: "0.0.1",
  });
}

export function registerAll(server: McpServer): void {
  const allTools = [
    deputiesTool,
    senatorsTool,
    billsTool,
    votesTool,
    searchTool,
    legislaturesTool,
    groupsTool,
    sessionsTool,
    governmentsTool,
    deputyTool,
    senatorTool,
    billTool,
    rolesTool,
    speechesTool,
    aicTool,
    voteDetailTool,
    groupMembersTool,
    senatorGroupMembersTool,
    govMembersTool,
    committeesTool,
    billProgressTool,
    billSignatoriesTool,
    amendmentsTool,
    documentsTool,
    sparqlTool,
  ];

  for (const tool of allTools) {
    server.registerTool(
      tool.name,
      { description: describe(tool), inputSchema: tool.inputSchema.shape },
      makeHandler(tool),
    );
  }
}
