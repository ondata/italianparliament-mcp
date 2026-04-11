# italianparliament-mcp

CLI and MCP server for querying Italian Parliament SPARQL endpoints — Camera dei Deputati (`dati.camera.it`) and Senato della Repubblica (`dati.senato.it`).

Designed **agent-first**: every command is scriptable, non-interactive, with flag-based input, machine-readable output (CSV/JSONL), and actionable errors.

One codebase, three distributions:

- **CLI** — `italianparliament <resource> <verb>` installable via npm
- **MCP server (stdio)** — usable from Claude Desktop / Claude Code
- **MCP server (Cloudflare Worker)** — remote HTTP MCP

## Status

Under active development. See `LOG.md` for daily progress and `tasks/todo.md` in the reference repo `italyParlR_cli` for the full plan.

## License

MIT
