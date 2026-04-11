import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { deputiesTool } from "./tools/deputies.js";
import { senatorsTool } from "./tools/senators.js";
import { billsTool } from "./tools/bills.js";
import { votesTool } from "./tools/votes.js";
import { searchTool } from "./tools/search.js";
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

function makeHandler<I>(tool: { execute(input: I): Promise<ToolResult> }) {
  return async (input: I) => {
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

async function main(): Promise<void> {
  const server = new McpServer({
    name: "italianparliament-mcp",
    version: "0.0.1",
  });

  server.registerTool(
    deputiesTool.name,
    { description: describe(deputiesTool), inputSchema: deputiesTool.inputSchema.shape },
    makeHandler(deputiesTool),
  );

  server.registerTool(
    senatorsTool.name,
    { description: describe(senatorsTool), inputSchema: senatorsTool.inputSchema.shape },
    makeHandler(senatorsTool),
  );

  server.registerTool(
    billsTool.name,
    { description: describe(billsTool), inputSchema: billsTool.inputSchema.shape },
    makeHandler(billsTool),
  );

  server.registerTool(
    votesTool.name,
    { description: describe(votesTool), inputSchema: votesTool.inputSchema.shape },
    makeHandler(votesTool),
  );

  server.registerTool(
    searchTool.name,
    { description: describe(searchTool), inputSchema: searchTool.inputSchema.shape },
    makeHandler(searchTool),
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err: unknown) => {
  process.stderr.write(
    `Fatal: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
