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
import { senatorGroupMembersTool } from "./tools/senator-group-members.js";
import { govMembersTool } from "./tools/gov-members.js";
import { committeesTool } from "./tools/committees.js";
import { billProgressTool } from "./tools/bill-progress.js";
import { billSignatoriesTool } from "./tools/bill-signatories.js";
import { billRapporteursTool } from "./tools/bill-rapporteurs.js";
import { amendmentsTool } from "./tools/amendments.js";
import { documentsTool } from "./tools/documents.js";
import { sparqlTool } from "./tools/sparql.js";
import { rankTool } from "./tools/rank.js";
import { sindacatoIspettivoTool } from "./tools/sindacato-ispettivo.js";
import { committeeMembersTool } from "./tools/committee-members.js";
import { memberBillsTool } from "./tools/member-bills.js";
import { billTextTool } from "./tools/bill-text.js";
import { fetchSenatoText } from "./core/fetch-text.js";
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
    region: {
      type: "string",
      description: "Filter by constituency/region (case-insensitive, e.g. sicilia)",
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
      region: (args.region as string) || undefined,
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
    initiative: {
      type: "string",
      description: "Filter by initiative: Popolare, Governo, Parlamentare, Regioni",
    },
    keyword: {
      type: "string",
      description: "Search in bill title (case-insensitive)",
    },
    "date-from": { type: "string", description: "Start date YYYY-MM-DD" },
    "date-to": { type: "string", description: "End date YYYY-MM-DD" },
    limit: { type: "string", default: "100" },
    offset: { type: "string", default: "0" },
    format: { type: "string", default: "csv" },
  },
  async run({ args }) {
    const result = await billsTool.execute({
      legislature: parseIntFlag(args.legislature as string, "legislature"),
      type: (args.type as string) || undefined,
      initiative: (args.initiative as string) || undefined,
      keyword: (args.keyword as string) || undefined,
      dateFrom: (args["date-from"] as string) || undefined,
      dateTo: (args["date-to"] as string) || undefined,
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
    "confidence-vote": {
      type: "string",
      description: "Filter confidence votes: true or false",
    },
    keyword: {
      type: "string",
      description: "Search in vote title (case-insensitive)",
    },
    "date-from": { type: "string", description: "Start date YYYY-MM-DD" },
    "date-to": { type: "string", description: "End date YYYY-MM-DD" },
    "bill-code": { type: "string", description: "Filter votes by bill number (e.g. '2807', '1665')" },
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
    let confidenceVote: boolean | undefined;
    if (args["confidence-vote"] !== undefined && args["confidence-vote"] !== "") {
      if (args["confidence-vote"] === "true") confidenceVote = true;
      else if (args["confidence-vote"] === "false") confidenceVote = false;
      else
        throw new Error(
          `Invalid --confidence-vote value "${args["confidence-vote"]}". Expected: true or false.`,
        );
    }
    const result = await votesTool.execute({
      legislature: parseIntFlag(args.legislature as string, "legislature"),
      approved,
      confidenceVote,
      keyword: (args.keyword as string) || undefined,
      dateFrom: (args["date-from"] as string) || undefined,
      dateTo: (args["date-to"] as string) || undefined,
      billCode: (args["bill-code"] as string) || undefined,
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
    "date-from": { type: "string", description: "Start date YYYY-MM-DD" },
    "date-to": { type: "string", description: "End date YYYY-MM-DD" },
    limit: { type: "string", default: "100" },
    offset: { type: "string", default: "0" },
    format: { type: "string", default: "csv" },
  },
  async run({ args }) {
    const result = await sessionsTool.execute({
      legislature: parseIntFlag(args.legislature as string, "legislature"),
      dateFrom: (args["date-from"] as string) || undefined,
      dateTo: (args["date-to"] as string) || undefined,
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
    legislature: { type: "string", description: "Legislature number (default: 19)" },
    format: { type: "string", default: "csv" },
  },
  async run({ args }) {
    const result = await senatorTool.execute({
      uri: args.uri as string,
      legislature: parseIntFlag(args.legislature as string, "legislature"),
    });
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
      "List speeches (interventi) in Camera or Senato.",
      speechesTool.examples,
    ),
  },
  args: {
    chamber: {
      type: "string",
      default: "camera",
      description: "camera or senato",
    },
    legislature: { type: "string", description: "Legislature number" },
    "deputy-uri": {
      type: "string",
      description: "Full URI of a deputy/senator",
    },
    "count-only": {
      type: "boolean",
      description: "Return only the total count",
    },
    limit: { type: "string", default: "100" },
    offset: { type: "string", default: "0" },
    format: { type: "string", default: "csv" },
  },
  async run({ args }) {
    const chamber = (args.chamber as string) === "senato" ? "senato" : "camera";
    const result = await speechesTool.execute({
      chamber,
      legislature: parseIntFlag(args.legislature as string, "legislature"),
      deputyUri: (args["deputy-uri"] as string) || undefined,
      countOnly: Boolean(args["count-only"]),
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
    "date-from": { type: "string", description: "Start date YYYY-MM-DD" },
    "date-to": { type: "string", description: "End date YYYY-MM-DD" },
    limit: { type: "string", default: "100" },
    offset: { type: "string", default: "0" },
    format: { type: "string", default: "csv" },
  },
  async run({ args }) {
    const result = await aicTool.execute({
      legislature: parseIntFlag(args.legislature as string, "legislature"),
      deputyUri: (args["deputy-uri"] as string) || undefined,
      primaryOnly: args["primary-only"] === true,
      dateFrom: (args["date-from"] as string) || undefined,
      dateTo: (args["date-to"] as string) || undefined,
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
    "group-acronym": { type: "string", description: "Filter by group acronym (es. FDI, PD-IDP, M5S)" },
    "vote-type": { type: "string", description: "Filter by vote type: Favorevole|Contrario|Astenuto|Non ha votato" },
    limit: { type: "string", default: "700" },
    format: { type: "string", default: "csv" },
  },
  async run({ args }) {
    const result = await voteDetailTool.execute({
      voteUri: args["vote-uri"] as string,
      groupAcronym: args["group-acronym"] as string | undefined,
      voteType: args["vote-type"] as "Favorevole" | "Contrario" | "Astenuto" | "Non ha votato" | undefined,
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
    "deputy-uri": { type: "string", description: "Full URI of a deputy (returns all groups)" },
    legislature: { type: "string", description: "Legislature number" },
    limit: { type: "string", default: "200" },
    offset: { type: "string", default: "0" },
    format: { type: "string", default: "csv" },
  },
  async run({ args }) {
    const result = await groupMembersTool.execute({
      groupUri: (args["group-uri"] as string) || undefined,
      deputyUri: (args["deputy-uri"] as string) || undefined,
      legislature: parseIntFlag(args.legislature as string, "legislature"),
      limit: parseIntFlag(args.limit as string, "limit") ?? 200,
      offset: Number(args.offset ?? 0),
    });
    emit(result, parseFormat(args.format as string));
  },
});

const senatorGroupMembersList = defineCommand({
  meta: {
    name: "list",
    description: withExamples(
      "List members of Senato parliamentary groups.",
      senatorGroupMembersTool.examples,
    ),
  },
  args: {
    "group-uri": { type: "string", description: "Full URI of a Senato parliamentary group" },
    legislature: { type: "string", description: "Legislature number" },
    "as-of": { type: "string", description: "Date YYYY-MM-DD (default: today)" },
    limit: { type: "string", default: "200" },
    offset: { type: "string", default: "0" },
    format: { type: "string", default: "csv" },
  },
  async run({ args }) {
    const result = await senatorGroupMembersTool.execute({
      groupUri: (args["group-uri"] as string) || undefined,
      legislature: parseIntFlag(args.legislature as string, "legislature"),
      asOf: (args["as-of"] as string) || undefined,
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
    keyword: {
      type: "string",
      description: "Search in DDL title (case-insensitive)",
    },
    "date-from": {
      type: "string",
      description: "Presentation start date (YYYY-MM-DD)",
    },
    "date-to": {
      type: "string",
      description: "Presentation end date (YYYY-MM-DD)",
    },
    legislature: { type: "string", description: "Legislature number" },
    limit: { type: "string", default: "100" },
    offset: { type: "string", default: "0" },
    format: { type: "string", default: "csv" },
  },
  async run({ args }) {
    const result = await billProgressTool.execute({
      ddlUri: (args["ddl-uri"] as string) || undefined,
      keyword: (args.keyword as string) || undefined,
      dateFrom: (args["date-from"] as string) || undefined,
      dateTo: (args["date-to"] as string) || undefined,
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

const billRapporteursList = defineCommand({
  meta: {
    name: "list",
    description: withExamples(
      "List rapporteurs of a Camera DDL by committee.",
      billRapporteursTool.examples,
    ),
  },
  args: {
    "bill-uri": { type: "string", description: "Full URI of a Camera DDL", required: true },
    limit: { type: "string", default: "100" },
    format: { type: "string", default: "csv" },
  },
  async run({ args }) {
    const result = await billRapporteursTool.execute({
      billUri: args["bill-uri"] as string,
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

const rankList = defineCommand({
  meta: {
    name: "list",
    description: withExamples(
      "Rank parliamentarians by activity (Camera + Senato).",
      rankTool.examples,
    ),
  },
  args: {
    "rank-by": {
      type: "string",
      description:
        "Camera: aic-primo-firmatario | aic-cofirmatario | bills-primo-firmatario | bills-cofirmatario | speeches. Senato: sindacato-ispettivo | ddl-senato",
      required: true,
    },
    legislature: { type: "string", description: "Legislature number" },
    order: { type: "string", default: "desc", description: "desc (most active) or asc (least active)" },
    limit: { type: "string", default: "20" },
    offset: { type: "string", default: "0" },
    format: { type: "string", default: "csv" },
  },
  async run({ args }) {
    const rankBy = args["rank-by"] as string;
    const validRankBy = [
      "aic-primo-firmatario",
      "aic-cofirmatario",
      "bills-primo-firmatario",
      "bills-cofirmatario",
      "speeches",
      "sindacato-ispettivo",
      "ddl-senato",
    ];
    if (!validRankBy.includes(rankBy)) {
      throw new Error(`Invalid --rank-by. Allowed: ${validRankBy.join(", ")}`);
    }
    const orderArg = (args.order as string) || "desc";
    if (orderArg !== "desc" && orderArg !== "asc") {
      throw new Error(`Invalid --order "${orderArg}". Expected: desc or asc.`);
    }
    const result = await rankTool.execute({
      rankBy: rankBy as Parameters<typeof rankTool.execute>[0]["rankBy"],
      legislature: parseIntFlag(args.legislature as string, "legislature"),
      order: orderArg as "desc" | "asc",
      limit: parseIntFlag(args.limit as string, "limit") ?? 20,
      offset: Number(args.offset ?? 0),
    });
    emit(result, parseFormat(args.format as string));
  },
});

const sindacatoIspettivoList = defineCommand({
  meta: {
    name: "list",
    description: withExamples(
      "List Senato sindacato ispettivo acts (interrogazioni, interpellanze, mozioni).",
      sindacatoIspettivoTool.examples,
    ),
  },
  args: {
    legislature: { type: "string", description: "Legislature number" },
    "senator-uri": { type: "string", description: "Full URI of a senator" },
    tipo: { type: "string", description: "Filter by act type (case-insensitive)" },
    "date-from": { type: "string", description: "Start date YYYY-MM-DD" },
    "date-to": { type: "string", description: "End date YYYY-MM-DD" },
    limit: { type: "string", default: "100" },
    offset: { type: "string", default: "0" },
    format: { type: "string", default: "csv" },
  },
  async run({ args }) {
    const result = await sindacatoIspettivoTool.execute({
      legislature: parseIntFlag(args.legislature as string, "legislature"),
      senatorUri: (args["senator-uri"] as string) || undefined,
      tipo: (args.tipo as string) || undefined,
      dateFrom: (args["date-from"] as string) || undefined,
      dateTo: (args["date-to"] as string) || undefined,
      limit: parseIntFlag(args.limit as string, "limit") ?? 100,
      offset: Number(args.offset ?? 0),
    });
    emit(result, parseFormat(args.format as string));
  },
});

const committeeMembersList = defineCommand({
  meta: {
    name: "list",
    description: withExamples(
      "List Senato committee members with roles.",
      committeeMembersTool.examples,
    ),
  },
  args: {
    chamber: { type: "string", default: "both", description: "camera, senato, or both" },
    "committee-uri": { type: "string", description: "Full URI of a committee (Camera organo or Senato commissione)" },
    "member-uri": { type: "string", description: "Full URI of a parliamentarian (returns all committees)" },
    legislature: { type: "string", description: "Legislature number" },
    "active-only": { type: "string", default: "true", description: "Only active members: true or false" },
    limit: { type: "string", default: "200" },
    offset: { type: "string", default: "0" },
    format: { type: "string", default: "csv" },
  },
  async run({ args }) {
    const chamber = (args.chamber as string) || "both";
    if (!["camera", "senato", "both"].includes(chamber)) {
      throw new Error(`Invalid --chamber "${chamber}". Expected: camera, senato, both.`);
    }
    const result = await committeeMembersTool.execute({
      chamber: chamber as "camera" | "senato" | "both",
      committeeUri: (args["committee-uri"] as string) || undefined,
      memberUri: (args["member-uri"] as string) || undefined,
      legislature: parseIntFlag(args.legislature as string, "legislature"),
      activeOnly: args["active-only"] !== "false",
      limit: parseIntFlag(args.limit as string, "limit") ?? 200,
      offset: Number(args.offset ?? 0),
    });
    emit(result, parseFormat(args.format as string));
  },
});

const memberBillsList = defineCommand({
  meta: {
    name: "list",
    description: withExamples(
      "List bills as first signatory for a deputy (Camera) or senator (Senato).",
      memberBillsTool.examples,
    ),
  },
  args: {
    "member-uri": { type: "string", description: "Full URI of deputy or senator", required: true },
    legislature: { type: "string", description: "Legislature number (default: 19)" },
    limit: { type: "string", default: "100" },
    offset: { type: "string", default: "0" },
    format: { type: "string", default: "csv" },
  },
  async run({ args }) {
    const result = await memberBillsTool.execute({
      memberUri: args["member-uri"] as string,
      legislature: parseIntFlag(args.legislature as string, "legislature"),
      limit: parseIntFlag(args.limit as string, "limit") ?? 100,
      offset: Number(args.offset ?? 0),
    });
    emit(result, parseFormat(args.format as string));
  },
});

const sparqlQuery = defineCommand({
  meta: {
    name: "query",
    description: withExamples(
      "Execute a free SPARQL SELECT query on Camera or Senato.",
      sparqlTool.examples,
    ),
  },
  args: {
    endpoint: { type: "string", description: "camera or senato", required: true },
    query: { type: "string", description: "SPARQL SELECT query", required: true },
    limit: { type: "string", default: "25" },
    format: { type: "string", default: "csv" },
  },
  async run({ args }) {
    const endpoint = args.endpoint as string;
    if (endpoint !== "camera" && endpoint !== "senato") {
      throw new Error('Invalid --endpoint. Allowed: camera, senato.');
    }
    const result = await sparqlTool.execute({
      query: args.query as string,
      endpoint,
      limit: parseIntFlag(args.limit as string, "limit") ?? 25,
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

const billTextLinks = defineCommand({
  meta: {
    name: "links",
    description: withExamples(
      "Direct links to a bill's text, with resource type (html/pdf/urn) and whether a browser is needed to fetch them (auth field).",
      billTextTool.examples,
    ),
  },
  args: {
    uri: { type: "string", description: "Bill URI (Camera atto or Senato ddl)", required: true },
    format: { type: "string", default: "csv" },
  },
  async run({ args }) {
    const result = await billTextTool.execute({ uri: args.uri as string });
    emit(result, parseFormat(args.format as string));
  },
});

const billTextFetch = defineCommand({
  meta: {
    name: "fetch",
    description: withExamples(
      "Fetch and convert a Senato bill text to markdown. Drives a real browser (agent-browser) to clear the AWS WAF, downloads the PDF, and converts it with lit. Local-only; requires agent-browser and lit installed.",
      [
        "italianparliament bill-text fetch --did 56784",
        "italianparliament bill-text fetch --did 56784 --which Relazione",
        "italianparliament bill-text fetch --did 56784 --all",
        "italianparliament bill-text fetch --did 56784 --fascicolo --out fascicolo.md",
      ],
    ),
  },
  args: {
    did: {
      type: "string",
      description: "Senato DDL id (the number N in dati.senato.it/ddl/N, == did in scheda-ddl)",
      required: true,
    },
    which: {
      type: "string",
      description: "Pick a specific text by label substring (e.g. 'Testo DDL', 'Relazione'). Default: first.",
    },
    all: { type: "boolean", description: "Concatenate all available texts", default: false },
    fascicolo: {
      type: "boolean",
      description: "Download the full iter dossier PDF instead of a single text",
      default: false,
    },
    legislature: { type: "string", description: "Legislature for the fascicolo URL (default 19)", default: "19" },
    out: { type: "string", description: "Write markdown to this file instead of stdout" },
  },
  async run({ args }) {
    const result = await fetchSenatoText({
      did: args.did as string,
      which: (args.which as string) || undefined,
      all: args.all as boolean,
      fascicolo: args.fascicolo as boolean,
      leg: args.legislature as string,
    });
    if (args.out) {
      const { writeFile } = await import("node:fs/promises");
      await writeFile(args.out as string, result.markdown + "\n");
      process.stderr.write(
        `Saved: ${args.out}\nSources:\n${result.sources.map((s) => `  ${s.label} — ${s.url}`).join("\n")}\n`,
      );
    } else {
      process.stdout.write(result.markdown + "\n");
    }
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
    "senator-group-members": defineCommand({
      meta: { name: "senator-group-members", description: "Members of Senato parliamentary groups" },
      subCommands: { list: senatorGroupMembersList },
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
    "bill-rapporteurs": defineCommand({
      meta: { name: "bill-rapporteurs", description: "Rapporteurs of a Camera DDL by committee" },
      subCommands: { list: billRapporteursList },
    }),
    amendments: defineCommand({
      meta: { name: "amendments", description: "Senato amendments" },
      subCommands: { list: amendmentsList },
    }),
    documents: defineCommand({
      meta: { name: "documents", description: "Senato parliamentary documents" },
      subCommands: { list: documentsList },
    }),
    sparql: defineCommand({
      meta: { name: "sparql", description: "Free SPARQL SELECT query on Camera or Senato" },
      subCommands: { query: sparqlQuery },
    }),
    rank: defineCommand({
      meta: { name: "rank", description: "Rank deputies by parliamentary activity (Camera)" },
      subCommands: { list: rankList },
    }),
    "sindacato-ispettivo": defineCommand({
      meta: { name: "sindacato-ispettivo", description: "Senato sindacato ispettivo acts (interrogazioni, interpellanze, mozioni)" },
      subCommands: { list: sindacatoIspettivoList },
    }),
    "committee-members": defineCommand({
      meta: { name: "committee-members", description: "Senato committee members with roles" },
      subCommands: { list: committeeMembersList },
    }),
    "member-bills": defineCommand({
      meta: { name: "member-bills", description: "Bills as first signatory for a deputy or senator (Camera+Senato)" },
      subCommands: { list: memberBillsList },
    }),
    "bill-text": defineCommand({
      meta: { name: "bill-text", description: "Links to a bill's text (links) and local fetch+convert of Senato text to markdown (fetch)" },
      subCommands: { links: billTextLinks, fetch: billTextFetch },
    }),
  },
});

// Suppress citty's stack-trace output (agents don't need it).
// citty writes the error+stack to stderr before re-throwing.
// We intercept stderr writes that contain stack traces.
const _origWrite = process.stderr.write.bind(process.stderr);
process.stderr.write = ((chunk: unknown, ...rest: unknown[]) => {
  const s = String(chunk);
  // citty prints "\n ERROR  msg\n\n    at ...\n" — suppress both the header and stack
  if (s.includes("\n    at ") || /\x1b\[.*ERROR/.test(s)) return true;
  return (_origWrite as Function)(chunk, ...rest);
}) as typeof process.stderr.write;

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
