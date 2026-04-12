import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer, registerAll } from "./server.js";

async function main(): Promise<void> {
  const server = createServer();
  registerAll(server);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err: unknown) => {
  process.stderr.write(
    `Fatal: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
