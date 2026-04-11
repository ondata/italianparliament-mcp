import { defineCommand, runMain } from "citty";
import { deputiesTool } from "./tools/deputies.js";
import { senatorsTool } from "./tools/senators.js";
import { billsTool } from "./tools/bills.js";
import { votesTool } from "./tools/votes.js";
import { searchTool } from "./tools/search.js";
import { formatRows, type Format } from "./core/format.js";
import { SparqlError } from "./core/client.js";
import type { ToolResult } from "./tools/types.js";

function withExamples(description: string, examples: string[]): string {
  return `${description}\n\nExamples:\n${examples.map((e) => `  ${e}`).join("\n")}`;
}

function emit(result: ToolResult, format: Format): void {
  process.stdout.write(formatRows(result.rows, format, result.columns) + "\n");
}

function parseFormat(raw: string): Format {
  if (raw === "csv" || raw === "jsonl") return raw;
  throw new Error(
    `Invalid --format value "${raw}". Allowed: csv, jsonl.\nExample: --format jsonl`,
  );
}

function parseIntFlag(raw: string | undefined, name: string): number | undefined {
  if (raw === undefined || raw === "") return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(
      `Invalid --${name} value "${raw}". Expected a positive integer.`,
    );
  }
  return n;
}

const deputiesList = defineCommand({
  meta: {
    name: "list",
    description: withExamples(
      "List deputies of the Italian Camera dei Deputati.",
      deputiesTool.examples,
    ),
  },
  args: {
    legislature: {
      type: "string",
      description: "Legislature number (e.g. 19)",
    },
    limit: {
      type: "string",
      description: "Max rows to return (default 100, max 1000)",
      default: "100",
    },
    offset: {
      type: "string",
      description: "Offset for pagination (default 0)",
      default: "0",
    },
    format: {
      type: "string",
      description: "Output format: csv (default) or jsonl",
      default: "csv",
    },
  },
  async run({ args }) {
    const result = await deputiesTool.execute({
      legislature: parseIntFlag(args.legislature as string, "legislature"),
      limit: parseIntFlag(args.limit as string, "limit") ?? 100,
      offset: Number(args.offset ?? 0),
    });
    emit(result, parseFormat(args.format as string));
  },
});

const senatorsList = defineCommand({
  meta: {
    name: "list",
    description: withExamples(
      "List senators of the Italian Senato della Repubblica.",
      senatorsTool.examples,
    ),
  },
  args: {
    legislature: {
      type: "string",
      description: "Legislature number (e.g. 19)",
    },
    "active-only": {
      type: "boolean",
      description:
        "Only senators currently in office (default: true if no --legislature)",
    },
    limit: {
      type: "string",
      description: "Max rows to return (default 300, max 1000)",
      default: "300",
    },
    offset: {
      type: "string",
      description: "Offset for pagination",
      default: "0",
    },
    format: {
      type: "string",
      description: "Output format: csv (default) or jsonl",
      default: "csv",
    },
  },
  async run({ args }) {
    const activeOnlyRaw = args["active-only"];
    const result = await senatorsTool.execute({
      legislature: parseIntFlag(args.legislature as string, "legislature"),
      activeOnly:
        activeOnlyRaw === undefined ? undefined : Boolean(activeOnlyRaw),
      limit: parseIntFlag(args.limit as string, "limit") ?? 300,
      offset: Number(args.offset ?? 0),
    });
    emit(result, parseFormat(args.format as string));
  },
});

const billsList = defineCommand({
  meta: {
    name: "list",
    description: withExamples(
      "List bills (atti) of the Italian Camera dei Deputati.",
      billsTool.examples,
    ),
  },
  args: {
    legislature: { type: "string", description: "Legislature number" },
    type: {
      type: "string",
      description: 'Filter by bill type (case-insensitive substring match)',
    },
    limit: { type: "string", default: "100" },
    offset: { type: "string", default: "0" },
    format: { type: "string", default: "csv" },
  },
  async run({ args }) {
    const result = await billsTool.execute({
      legislature: parseIntFlag(args.legislature as string, "legislature"),
      type: (args.type as string) || undefined,
      limit: parseIntFlag(args.limit as string, "limit") ?? 100,
      offset: Number(args.offset ?? 0),
    });
    emit(result, parseFormat(args.format as string));
  },
});

const votesList = defineCommand({
  meta: {
    name: "list",
    description: withExamples(
      "List votes of the Italian Camera dei Deputati.",
      votesTool.examples,
    ),
  },
  args: {
    legislature: { type: "string", description: "Legislature number" },
    approved: {
      type: "string",
      description: "Filter by approval: true or false",
    },
    limit: { type: "string", default: "100" },
    offset: { type: "string", default: "0" },
    format: { type: "string", default: "csv" },
  },
  async run({ args }) {
    let approved: boolean | undefined;
    if (args.approved !== undefined && args.approved !== "") {
      if (args.approved === "true") approved = true;
      else if (args.approved === "false") approved = false;
      else
        throw new Error(
          `Invalid --approved value "${args.approved}". Expected: true or false.`,
        );
    }
    const result = await votesTool.execute({
      legislature: parseIntFlag(args.legislature as string, "legislature"),
      approved,
      limit: parseIntFlag(args.limit as string, "limit") ?? 100,
      offset: Number(args.offset ?? 0),
    });
    emit(result, parseFormat(args.format as string));
  },
});

const searchFind = defineCommand({
  meta: {
    name: "find",
    description: withExamples(
      "Search parliamentarians by name in Camera, Senato or both.",
      searchTool.examples,
    ),
  },
  args: {
    name: {
      type: "string",
      description: "Name or surname to search (required)",
      required: true,
    },
    chamber: {
      type: "string",
      description: "camera | senato | both (default: both)",
      default: "both",
    },
    legislature: { type: "string", description: "Legislature number" },
    "active-only": {
      type: "boolean",
      description: "Only senators currently in office (Senato side)",
    },
    limit: { type: "string", default: "50" },
    format: { type: "string", default: "csv" },
  },
  async run({ args }) {
    const chamber = args.chamber as string;
    if (chamber !== "camera" && chamber !== "senato" && chamber !== "both") {
      throw new Error(
        `Invalid --chamber value "${chamber}". Allowed: camera, senato, both.`,
      );
    }
    const activeOnlyRaw = args["active-only"];
    const result = await searchTool.execute({
      name: args.name as string,
      chamber,
      legislature: parseIntFlag(args.legislature as string, "legislature"),
      activeOnly:
        activeOnlyRaw === undefined ? undefined : Boolean(activeOnlyRaw),
      limit: parseIntFlag(args.limit as string, "limit") ?? 50,
    });
    emit(result, parseFormat(args.format as string));
  },
});

const main = defineCommand({
  meta: {
    name: "italianparliament",
    version: "0.0.1",
    description:
      "CLI for querying Italian Parliament SPARQL endpoints (Camera + Senato). Agent-friendly: flags for everything, machine-readable output.",
  },
  subCommands: {
    deputies: defineCommand({
      meta: { name: "deputies", description: "Deputies of Camera" },
      subCommands: { list: deputiesList },
    }),
    senators: defineCommand({
      meta: { name: "senators", description: "Senators of Senato" },
      subCommands: { list: senatorsList },
    }),
    bills: defineCommand({
      meta: { name: "bills", description: "Bills (atti) of Camera" },
      subCommands: { list: billsList },
    }),
    votes: defineCommand({
      meta: { name: "votes", description: "Votes of Camera" },
      subCommands: { list: votesList },
    }),
    search: defineCommand({
      meta: { name: "search", description: "Search parliamentarians by name" },
      subCommands: { find: searchFind },
    }),
  },
});

runMain(main).catch((err: unknown) => {
  if (err instanceof SparqlError) {
    process.stderr.write(
      `Error: ${err.message}\nEndpoint: ${err.endpoint}\n${err.status ? `Status: ${err.status}\n` : ""}`,
    );
  } else if (err instanceof Error) {
    process.stderr.write(`Error: ${err.message}\n`);
  } else {
    process.stderr.write(`Error: ${String(err)}\n`);
  }
  process.exit(1);
});
