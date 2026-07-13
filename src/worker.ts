import { createServer, registerAll } from "./server.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Root — info page
    if (request.method === "GET" && url.pathname === "/") {
      return new Response(
        JSON.stringify({
          name: "italianparliament-mcp",
          version: "0.25.2",
          description:
            "MCP server for querying Italian Parliament SPARQL endpoints (Camera + Senato)",
          mcp_endpoint: "/mcp",
          tools: 43,
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    // Health check
    if (request.method === "GET" && url.pathname === "/health") {
      return new Response(
        JSON.stringify({ status: "ok", runtime: "cloudflare-workers" }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    // CORS preflight
    if (request.method === "OPTIONS" && url.pathname === "/mcp") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // MCP endpoint
    if (request.method === "POST" && url.pathname === "/mcp") {
      try {
        const server = createServer();
        registerAll(server);

        const transport = new WebStandardStreamableHTTPServerTransport({
          sessionIdGenerator: undefined, // stateless
        });

        await server.connect(transport);
        const response = await transport.handleRequest(request);
        const headers = new Headers(response.headers);
        headers.set("Access-Control-Allow-Origin", "*");
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      } catch (err) {
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            error: {
              code: -32603,
              message: err instanceof Error ? err.message : String(err),
            },
            id: null,
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          },
        );
      }
    }

    return new Response("Not Found", { status: 404 });
  },
};
