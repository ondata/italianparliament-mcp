import { defineCommand, runMain } from "citty";
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
import { govMembersTool } from "./tools/gov-members.js";
import { committeesTool } from "./tools/committees.js";
import { billProgressTool } from "./tools/bill-progress.js";
import { billSignatoriesTool } from "./tools/bill-signatories.js";
import { amendmentsTool } from "./tools/amendments.js";
import { documentsTool } from "./tools/documents.js";
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

const legislaturesList = defineCommand({
  meta: {
    name: "list",
    description: withExamples(
      "List all legislatures of the Camera dei Deputati.",
      legislaturesTool.examples,
    ),
  },
  args: {
    format: { type: "string", default: "csv" },
  },
  async run({ args }) {
    const result = await legislaturesTool.execute({});
    emit(result, parseFormat(args.format as string));
  },
});

const groupsList = defineCommand({
  meta: {
    name: "list",
    description: withExamples(
      "List parliamentary groups of the Camera dei Deputati.",
      groupsTool.examples,
    ),
  },
  args: {
    legislature: { type: "string", description: "Legislature number" },
    limit: { type: "string", default: "100" },
    format: { type: "string", default: "csv" },
  },
  async run({ args }) {
    const result = await groupsTool.execute({
      legislature: parseIntFlag(args.legislature as string, "legislature"),
      limit: parseIntFlag(args.limit as string, "limit") ?? 100,
    });
    emit(result, parseFormat(args.format as string));
  },
});

const sessionsList = defineCommand({
  meta: {
    name: "list",
    description: withExamples(
      "List parliamentary sessions (sedute) of the Camera dei Deputati.",
      sessionsTool.examples,
    ),
  },
  args: {
    legislature: { type: "string", description: "Legislature number" },
    limit: { type: "string", default: "100" },
    offset: { type: "string", default: "0" },
    format: { type: "string", default: "csv" },
  },
  async run({ args }) {
    const result = await sessionsTool.execute({
      legislature: parseIntFlag(args.legislature as string, "legislature"),
      limit: parseIntFlag(args.limit as string, "limit") ?? 100,
      offset: Number(args.offset ?? 0),
    });
    emit(result, parseFormat(args.format as string));
  },
});

const governmentsList = defineCommand({
  meta: {
    name: "list",
    description: withExamples(
      "List Italian governments referenced in Camera membroGoverno records.",
      governmentsTool.examples,
    ),
  },
  args: {
    legislature: { type: "string", description: "Legislature number" },
    limit: { type: "string", default: "100" },
    offset: { type: "string", default: "0" },
    format: { type: "string", default: "csv" },
  },
  async run({ args }) {
    const result = await governmentsTool.execute({
      legislature: parseIntFlag(args.legislature as string, "legislature"),
      limit: parseIntFlag(args.limit as string, "limit") ?? 100,
      offset: Number(args.offset ?? 0),
    });
    emit(result, parseFormat(args.format as string));
  },
});

const deputyShow = defineCommand({
  meta: {
    name: "show",
    description: withExamples(
      "Show all RDF properties of a single deputy.",
      deputyTool.examples,
    ),
  },
  args: {
    uri: { type: "string", description: "Full URI of the deputy" },
    id: { type: "string", description: "Numeric deputy ID (use with --legislature)" },
    legislature: { type: "string", description: "Legislature number (use with --id)" },
    format: { type: "string", default: "csv" },
  },
  async run({ args }) {
    const result = await deputyTool.execute({
      uri: (args.uri as string) || undefined,
      id: parseIntFlag(args.id as string, "id"),
      legislature: parseIntFlag(args.legislature as string, "legislature"),
    });
    emit(result, parseFormat(args.format as string));
  },
});

const senatorShow = defineCommand({
  meta: {
    name: "show",
    description: withExamples(
      "Show all RDF properties of a single senator.",
      senatorTool.examples,
    ),
  },
  args: {
    uri: { type: "string", description: "Full URI of the senator", required: true },
    format: { type: "string", default: "csv" },
  },
  async run({ args }) {
    const result = await senatorTool.execute({ uri: args.uri as string });
    emit(result, parseFormat(args.format as string));
  },
});

const billShow = defineCommand({
  meta: {
    name: "show",
    description: withExamples(
      "Show all RDF properties of a single Camera bill.",
      billTool.examples,
    ),
  },
  args: {
    uri: { type: "string", description: "Full URI of the bill", required: true },
    format: { type: "string", default: "csv" },
  },
  async run({ args }) {
    const result = await billTool.execute({ uri: args.uri as string });
    emit(result, parseFormat(args.format as string));
  },
});

const rolesList = defineCommand({
  meta: {
    name: "list",
    description: withExamples(
      "List parliamentary roles (incarichi) of Camera deputies.",
      rolesTool.examples,
    ),
  },
  args: {
    "deputy-uri": { type: "string", description: "Full URI of a deputy" },
    "group-uri": { type: "string", description: "Full URI of a parliamentary group" },
    legislature: { type: "string", description: "Legislature number" },
    limit: { type: "string", default: "100" },
    offset: { type: "string", default: "0" },
    format: { type: "string", default: "csv" },
  },
  async run({ args }) {
    const result = await rolesTool.execute({
      deputyUri: (args["deputy-uri"] as string) || undefined,
      groupUri: (args["group-uri"] as string) || undefined,
      legislature: parseIntFlag(args.legislature as string, "legislature"),
      limit: parseIntFlag(args.limit as string, "limit") ?? 100,
      offset: Number(args.offset ?? 0),
    });
    emit(result, parseFormat(args.format as string));
  },
});

const speechesList = defineCommand({
  meta: {
    name: "list",
    description: withExamples(
      "List speeches (interventi) in Camera dei Deputati.",
      speechesTool.examples,
    ),
  },
  args: {
    legislature: { type: "string", description: "Legislature number" },
    "deputy-uri": { type: "string", description: "Full URI of a deputy" },
    limit: { type: "string", default: "100" },
    offset: { type: "string", default: "0" },
    format: { type: "string", default: "csv" },
  },
  async run({ args }) {
    const result = await speechesTool.execute({
      legislature: parseIntFlag(args.legislature as string, "legislature"),
      deputyUri: (args["deputy-uri"] as string) || undefined,
      limit: parseIntFlag(args.limit as string, "limit") ?? 100,
      offset: Number(args.offset ?? 0),
    });
    emit(result, parseFormat(args.format as string));
  },
});

const aicList = defineCommand({
  meta: {
    name: "list",
    description: withExamples(
      "List atti di indirizzo e controllo of Camera dei Deputati.",
      aicTool.examples,
    ),
  },
  args: {
    legislature: { type: "string", description: "Legislature number" },
    "deputy-uri": { type: "string", description: "Full URI of a deputy (signatory)" },
    "primary-only": { type: "boolean", description: "Only primary signatory matches" },
    limit: { type: "string", default: "100" },
    offset: { type: "string", default: "0" },
    format: { type: "string", default: "csv" },
  },
  async run({ args }) {
    const result = await aicTool.execute({
      legislature: parseIntFlag(args.legislature as string, "legislature"),
      deputyUri: (args["deputy-uri"] as string) || undefined,
      primaryOnly: args["primary-only"] === true,
      limit: parseIntFlag(args.limit as string, "limit") ?? 100,
      offset: Number(args.offset ?? 0),
    });
    emit(result, parseFormat(args.format as string));
  },
});

const voteDetailShow = defineCommand({
  meta: {
    name: "show",
    description: withExamples(
      "Show individual deputy votes for a single Camera votazione.",
      voteDetailTool.examples,
    ),
  },
  args: {
    "vote-uri": { type: "string", description: "Full URI of the votazione", required: true },
    limit: { type: "string", default: "700" },
    format: { type: "string", default: "csv" },
  },
  async run({ args }) {
    const result = await voteDetailTool.execute({
      voteUri: args["vote-uri"] as string,
      limit: parseIntFlag(args.limit as string, "limit") ?? 700,
    });
    emit(result, parseFormat(args.format as string));
  },
});

const groupMembersList = defineCommand({
  meta: {
    name: "list",
    description: withExamples(
      "List members of Camera parliamentary groups.",
      groupMembersTool.examples,
    ),
  },
  args: {
    "group-uri": { type: "string", description: "Full URI of a parliamentary group" },
    legislature: { type: "string", description: "Legislature number" },
    limit: { type: "string", default: "200" },
    offset: { type: "string", default: "0" },
    format: { type: "string", default: "csv" },
  },
  async run({ args }) {
    const result = await groupMembersTool.execute({
      groupUri: (args["group-uri"] as string) || undefined,
      legislature: parseIntFlag(args.legislature as string, "legislature"),
      limit: parseIntFlag(args.limit as string, "limit") ?? 200,
      offset: Number(args.offset ?? 0),
    });
    emit(result, parseFormat(args.format as string));
  },
});

const govMembersList = defineCommand({
  meta: {
    name: "list",
    description: withExamples(
      "List members of Italian governments.",
      govMembersTool.examples,
    ),
  },
  args: {
    "government-uri": { type: "string", description: "Full URI of a government" },
    legislature: { type: "string", description: "Legislature number" },
    name: { type: "string", description: "Search by name (case-insensitive)" },
    limit: { type: "string", default: "100" },
    offset: { type: "string", default: "0" },
    format: { type: "string", default: "csv" },
  },
  async run({ args }) {
    const result = await govMembersTool.execute({
      governmentUri: (args["government-uri"] as string) || undefined,
      legislature: parseIntFlag(args.legislature as string, "legislature"),
      name: (args.name as string) || undefined,
      limit: parseIntFlag(args.limit as string, "limit") ?? 100,
      offset: Number(args.offset ?? 0),
    });
    emit(result, parseFormat(args.format as string));
  },
});

const committeesList = defineCommand({
  meta: {
    name: "list",
    description: withExamples(
      "List Senato committees.",
      committeesTool.examples,
    ),
  },
  args: {
    legislature: { type: "string", description: "Legislature number (shows only active committees)" },
    limit: { type: "string", default: "300" },
    format: { type: "string", default: "csv" },
  },
  async run({ args }) {
    const result = await committeesTool.execute({
      legislature: parseIntFlag(args.legislature as string, "legislature"),
      limit: parseIntFlag(args.limit as string, "limit") ?? 300,
    });
    emit(result, parseFormat(args.format as string));
  },
});

const billProgressList = defineCommand({
  meta: {
    name: "list",
    description: withExamples(
      "List Senato DDL progress (iter legislativo).",
      billProgressTool.examples,
    ),
  },
  args: {
    "ddl-uri": { type: "string", description: "Full URI of a Senato DDL" },
    legislature: { type: "string", description: "Legislature number" },
    limit: { type: "string", default: "100" },
    offset: { type: "string", default: "0" },
    format: { type: "string", default: "csv" },
  },
  async run({ args }) {
    const result = await billProgressTool.execute({
      ddlUri: (args["ddl-uri"] as string) || undefined,
      legislature: parseIntFlag(args.legislature as string, "legislature"),
      limit: parseIntFlag(args.limit as string, "limit") ?? 100,
      offset: Number(args.offset ?? 0),
    });
    emit(result, parseFormat(args.format as string));
  },
});

const billSignatoriesShow = defineCommand({
  meta: {
    name: "show",
    description: withExamples(
      "Show signatories of a Senato DDL.",
      billSignatoriesTool.examples,
    ),
  },
  args: {
    "ddl-uri": { type: "string", description: "Full URI of a Senato DDL", required: true },
    limit: { type: "string", default: "100" },
    format: { type: "string", default: "csv" },
  },
  async run({ args }) {
    const result = await billSignatoriesTool.execute({
      ddlUri: args["ddl-uri"] as string,
      limit: parseIntFlag(args.limit as string, "limit") ?? 100,
    });
    emit(result, parseFormat(args.format as string));
  },
});

const amendmentsList = defineCommand({
  meta: {
    name: "list",
    description: withExamples(
      "List Senato amendments.",
      amendmentsTool.examples,
    ),
  },
  args: {
    legislature: { type: "string", description: "Legislature number" },
    limit: { type: "string", default: "100" },
    offset: { type: "string", default: "0" },
    format: { type: "string", default: "csv" },
  },
  async run({ args }) {
    const result = await amendmentsTool.execute({
      legislature: parseIntFlag(args.legislature as string, "legislature"),
      limit: parseIntFlag(args.limit as string, "limit") ?? 100,
      offset: Number(args.offset ?? 0),
    });
    emit(result, parseFormat(args.format as string));
  },
});

const documentsList = defineCommand({
  meta: {
    name: "list",
    description: withExamples(
      "List Senato parliamentary documents.",
      documentsTool.examples,
    ),
  },
  args: {
    legislature: { type: "string", description: "Legislature number" },
    type: { type: "string", description: "Filter by document type (case-insensitive)" },
    limit: { type: "string", default: "100" },
    offset: { type: "string", default: "0" },
    format: { type: "string", default: "csv" },
  },
  async run({ args }) {
    const result = await documentsTool.execute({
      legislature: parseIntFlag(args.legislature as string, "legislature"),
      type: (args.type as string) || undefined,
      limit: parseIntFlag(args.limit as string, "limit") ?? 100,
      offset: Number(args.offset ?? 0),
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
    legislatures: defineCommand({
      meta: { name: "legislatures", description: "Legislatures of Camera" },
      subCommands: { list: legislaturesList },
    }),
    groups: defineCommand({
      meta: { name: "groups", description: "Parliamentary groups of Camera" },
      subCommands: { list: groupsList },
    }),
    sessions: defineCommand({
      meta: { name: "sessions", description: "Parliamentary sessions of Camera" },
      subCommands: { list: sessionsList },
    }),
    governments: defineCommand({
      meta: { name: "governments", description: "Italian governments" },
      subCommands: { list: governmentsList },
    }),
    deputy: defineCommand({
      meta: { name: "deputy", description: "Single deputy detail" },
      subCommands: { show: deputyShow },
    }),
    senator: defineCommand({
      meta: { name: "senator", description: "Single senator detail" },
      subCommands: { show: senatorShow },
    }),
    bill: defineCommand({
      meta: { name: "bill", description: "Single Camera bill detail" },
      subCommands: { show: billShow },
    }),
    roles: defineCommand({
      meta: { name: "roles", description: "Parliamentary roles (incarichi) of Camera" },
      subCommands: { list: rolesList },
    }),
    speeches: defineCommand({
      meta: { name: "speeches", description: "Speeches (interventi) in Camera" },
      subCommands: { list: speechesList },
    }),
    aic: defineCommand({
      meta: { name: "aic", description: "Atti di indirizzo e controllo of Camera" },
      subCommands: { list: aicList },
    }),
    "vote-detail": defineCommand({
      meta: { name: "vote-detail", description: "Individual deputy votes in a votazione" },
      subCommands: { show: voteDetailShow },
    }),
    "group-members": defineCommand({
      meta: { name: "group-members", description: "Members of Camera parliamentary groups" },
      subCommands: { list: groupMembersList },
    }),
    "gov-members": defineCommand({
      meta: { name: "gov-members", description: "Members of Italian governments" },
      subCommands: { list: govMembersList },
    }),
    committees: defineCommand({
      meta: { name: "committees", description: "Senato committees" },
      subCommands: { list: committeesList },
    }),
    "bill-progress": defineCommand({
      meta: { name: "bill-progress", description: "Senato DDL progress (iter)" },
      subCommands: { list: billProgressList },
    }),
    "bill-signatories": defineCommand({
      meta: { name: "bill-signatories", description: "Signatories of a Senato DDL" },
      subCommands: { show: billSignatoriesShow },
    }),
    amendments: defineCommand({
      meta: { name: "amendments", description: "Senato amendments" },
      subCommands: { list: amendmentsList },
    }),
    documents: defineCommand({
      meta: { name: "documents", description: "Senato parliamentary documents" },
      subCommands: { list: documentsList },
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
