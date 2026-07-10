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
import { attendanceTool } from "./tools/attendance.js";
import { senatoAttendanceTool } from "./tools/senato-attendance.js";
import { groupMembersTool } from "./tools/group-members.js";
import { senatorGroupMembersTool } from "./tools/senator-group-members.js";
import { govMembersTool } from "./tools/gov-members.js";
import { committeesTool } from "./tools/committees.js";
import { billProgressTool } from "./tools/bill-progress.js";
import { billSignatoriesTool } from "./tools/bill-signatories.js";
import { cameraAmendmentsTool } from "./tools/camera-amendments.js";
import { billRapporteursTool } from "./tools/bill-rapporteurs.js";
import { billCommitteesTool } from "./tools/bill-committees.js";
import { amendmentsTool } from "./tools/amendments.js";
import { documentsTool } from "./tools/documents.js";
import { sparqlTool } from "./tools/sparql.js";
import { rankTool } from "./tools/rank.js";
import { sindacatoIspettivoTool } from "./tools/sindacato-ispettivo.js";
import { committeeMembersTool } from "./tools/committee-members.js";
import { memberBillsTool } from "./tools/member-bills.js";
import { billTextTool } from "./tools/bill-text.js";
import { senatoGroupsTool } from "./tools/senato-groups.js";
import { senatoVotesTool } from "./tools/senato-votes.js";
import { senatoVoteDetailTool } from "./tools/senato-vote-detail.js";
import { groupRankTool } from "./tools/group-rank.js";
import { committeeSessionsTool } from "./tools/committee-sessions.js";
import { personCareerTool } from "./tools/person-career.js";
import { peopleTool } from "./tools/people.js";
import { audizioniTool } from "./tools/audizioni.js";
import { fetchSenatoText } from "./core/fetch-text.js";
import { CAPABILITIES, capabilityScore } from "./core/capabilities.js";
import { formatRows, type Format } from "./core/format.js";
import { SparqlError } from "./core/client.js";
import { ZodError } from "zod";
import type { ToolResult } from "./tools/types.js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

function exitOnEpipe(err: NodeJS.ErrnoException): never {
  if (err.code === "EPIPE") process.exit(0);
  throw err;
}

process.stdout.on("error", exitOnEpipe);
process.stderr.on("error", exitOnEpipe);

function withExamples(description: string, examples: string[]): string {
  return `${description}\n\nExamples:\n${examples.map((e) => `  ${e}`).join("\n")}`;
}

function emit(result: ToolResult, format: Format): void {
  process.stdout.write(formatRows(result.rows, format, result.columns) + "\n");
  // Hint dinamico su risultato vuoto → stderr, per non sporcare l'output
  // parsabile (CSV/JSONL) di pipeline e redirezioni.
  if (result.rows.length === 0 && result.hint) {
    process.stderr.write(result.hint + "\n");
  }
}

// Valida l'input con lo schema Zod del tool PRIMA di eseguirlo: così gli enum
// errati (--vote-type, --rank-by, ...) producono un ZodError con i valori validi
// invece di scivolare nella query come stringa.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function runTool(tool: { inputSchema: { parse(i: unknown): any }; execute(i: any): Promise<ToolResult> }, input: unknown): Promise<ToolResult> {
  let parsed: unknown;
  try {
    parsed = tool.inputSchema.parse(input);
  } catch (e) {
    if (e instanceof ZodError) {
      const msgs = e.issues.map((i) => {
        const field = i.path.join(".") || "input";
        return i.code === "invalid_enum_value"
          ? `--${field}: valore non valido "${(i as { received?: string }).received ?? ""}". Ammessi: ${i.options.join(" | ")}.`
          : `--${field}: ${i.message}`;
      });
      throw new Error(msgs.join("\n"));
    }
    throw e;
  }
  return tool.execute(parsed);
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

function parseBoolFlag(
  raw: string | boolean | undefined,
  name: string,
): boolean | undefined {
  if (raw === undefined || raw === "") return undefined;
  if (raw === true || raw === "true") return true;
  if (raw === false || raw === "false") return false;
  throw new Error(
    `Invalid --${name} value "${raw}". Expected: true or false.`,
  );
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
    gender: {
      type: "string",
      description: "Filter by gender: male | female",
    },
    "born-from": {
      type: "string",
      description: "Born on or after (YYYY-MM-DD)",
    },
    "born-to": {
      type: "string",
      description: "Born on or before (YYYY-MM-DD)",
    },
    "birth-place": {
      type: "string",
      description: "Filter by birthplace (comune/provincia/regione/stato, case-insensitive, e.g. sicilia)",
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
    const result = await runTool(deputiesTool, {
      legislature: parseIntFlag(args.legislature as string, "legislature"),
      region: (args.region as string) || undefined,
      gender: (args.gender as "male" | "female" | undefined) || undefined,
      bornFrom: (args["born-from"] as string) || undefined,
      bornTo: (args["born-to"] as string) || undefined,
      birthPlace: (args["birth-place"] as string) || undefined,
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
    gender: {
      type: "string",
      description: "Filter by gender: male | female",
    },
    "born-from": {
      type: "string",
      description: "Born on or after (YYYY-MM-DD)",
    },
    "born-to": {
      type: "string",
      description: "Born on or before (YYYY-MM-DD)",
    },
    "birth-place": {
      type: "string",
      description: "Filter by birth city (case-insensitive; Senato exposes city only, no province/region)",
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
    const result = await runTool(senatorsTool, {
      legislature: parseIntFlag(args.legislature as string, "legislature"),
      activeOnly:
        activeOnlyRaw === undefined ? undefined : Boolean(activeOnlyRaw),
      gender: (args.gender as "male" | "female" | undefined) || undefined,
      bornFrom: (args["born-from"] as string) || undefined,
      bornTo: (args["born-to"] as string) || undefined,
      birthPlace: (args["birth-place"] as string) || undefined,
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
    limit: { type: "string", default: "100", description: "Max rows to return" },
    offset: { type: "string", default: "0", description: "Offset for pagination" },
    "count-only": { type: "boolean", description: "Return only the total count (column count)" },
    format: { type: "string", default: "csv", description: "csv | jsonl" },
  },
  async run({ args }) {
    const result = await runTool(billsTool, {
      countOnly: args["count-only"] === true,
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
    "count-only": { type: "boolean", description: "Return only the total count (column count)" },
    limit: { type: "string", default: "100", description: "Max rows to return" },
    offset: { type: "string", default: "0", description: "Offset for pagination" },
    format: { type: "string", default: "csv", description: "csv | jsonl" },
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
    const result = await runTool(votesTool, {
      countOnly: args["count-only"] === true,
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
    limit: { type: "string", default: "50", description: "Max rows to return" },
    format: { type: "string", default: "csv", description: "csv | jsonl" },
  },
  async run({ args }) {
    const chamber = args.chamber as string;
    if (chamber !== "camera" && chamber !== "senato" && chamber !== "both") {
      throw new Error(
        `Invalid --chamber value "${chamber}". Allowed: camera, senato, both.`,
      );
    }
    const activeOnlyRaw = args["active-only"];
    const result = await runTool(searchTool, {
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
    format: { type: "string", default: "csv", description: "csv | jsonl" },
  },
  async run({ args }) {
    const result = await runTool(legislaturesTool, {});
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
    limit: { type: "string", default: "100", description: "Max rows to return" },
    format: { type: "string", default: "csv", description: "csv | jsonl" },
  },
  async run({ args }) {
    const result = await runTool(groupsTool, {
      legislature: parseIntFlag(args.legislature as string, "legislature"),
      limit: parseIntFlag(args.limit as string, "limit") ?? 100,
    });
    emit(result, parseFormat(args.format as string));
  },
});

const senatoGroupsList = defineCommand({
  meta: {
    name: "list",
    description: withExamples(
      "List parliamentary groups of the Senato della Repubblica with member count.",
      senatoGroupsTool.examples,
    ),
  },
  args: {
    legislature: { type: "string", description: "Legislature number (e.g. 19)" },
    "as-of": { type: "string", description: "Reference date YYYY-MM-DD (default: today). For past legislatures use the last date of that legislature (e.g. 2022-10-12 for XVIII)" },
    limit: { type: "string", default: "100", description: "Max rows to return" },
    format: { type: "string", default: "csv", description: "csv | jsonl" },
  },
  async run({ args }) {
    const result = await runTool(senatoGroupsTool, {
      legislature: parseIntFlag(args.legislature as string, "legislature"),
      asOf: (args["as-of"] as string) || undefined,
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
    limit: { type: "string", default: "100", description: "Max rows to return" },
    offset: { type: "string", default: "0", description: "Offset for pagination" },
    format: { type: "string", default: "csv", description: "csv | jsonl" },
  },
  async run({ args }) {
    const result = await runTool(sessionsTool, {
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
    limit: { type: "string", default: "100", description: "Max rows to return" },
    offset: { type: "string", default: "0", description: "Offset for pagination" },
    format: { type: "string", default: "csv", description: "csv | jsonl" },
  },
  async run({ args }) {
    const result = await runTool(governmentsTool, {
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
    format: { type: "string", default: "csv", description: "csv | jsonl" },
  },
  async run({ args }) {
    const result = await runTool(deputyTool, {
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
    format: { type: "string", default: "csv", description: "csv | jsonl" },
  },
  async run({ args }) {
    const result = await runTool(senatorTool, {
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
    format: { type: "string", default: "csv", description: "csv | jsonl" },
  },
  async run({ args }) {
    const result = await runTool(billTool, { uri: args.uri as string });
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
    limit: { type: "string", default: "100", description: "Max rows to return" },
    offset: { type: "string", default: "0", description: "Offset for pagination" },
    format: { type: "string", default: "csv", description: "csv | jsonl" },
  },
  async run({ args }) {
    const result = await runTool(rolesTool, {
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
    limit: { type: "string", default: "100", description: "Max rows to return" },
    offset: { type: "string", default: "0", description: "Offset for pagination" },
    format: { type: "string", default: "csv", description: "csv | jsonl" },
  },
  async run({ args }) {
    const chamber = (args.chamber as string) === "senato" ? "senato" : "camera";
    const result = await runTool(speechesTool, {
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
    keyword: { type: "string", description: "Search in the act text/object (label, title, description), word-boundary match" },
    type: { type: "string", description: "Filter by act type (partial match on dc:type, e.g. 'immediata' for question time)" },
    "date-from": { type: "string", description: "Start date YYYY-MM-DD" },
    "date-to": { type: "string", description: "End date YYYY-MM-DD" },
    "count-only": { type: "boolean", description: "Return only the total count (column count)" },
    limit: { type: "string", default: "100", description: "Max rows to return" },
    offset: { type: "string", default: "0", description: "Offset for pagination" },
    format: { type: "string", default: "csv", description: "csv | jsonl" },
  },
  async run({ args }) {
    const result = await runTool(aicTool, {
      countOnly: args["count-only"] === true,
      legislature: parseIntFlag(args.legislature as string, "legislature"),
      deputyUri: (args["deputy-uri"] as string) || undefined,
      primaryOnly: args["primary-only"] === true,
      keyword: (args.keyword as string) || undefined,
      type: (args.type as string) || undefined,
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
    "vote-type": { type: "string", description: "Filter by vote type: Favorevole|Contrario|Astensione|Non ha votato" },
    limit: { type: "string", default: "700", description: "Max rows to return" },
    format: { type: "string", default: "csv", description: "csv | jsonl" },
  },
  async run({ args }) {
    const result = await runTool(voteDetailTool, {
      voteUri: args["vote-uri"] as string,
      groupAcronym: args["group-acronym"] as string | undefined,
      voteType: args["vote-type"] as "Favorevole" | "Contrario" | "Astensione" | "Non ha votato" | undefined,
      limit: parseIntFlag(args.limit as string, "limit") ?? 700,
    });
    emit(result, parseFormat(args.format as string));
  },
});

const attendanceShow = defineCommand({
  meta: {
    name: "show",
    description: withExamples(
      "Aggregate vote counts for a single deputy across a legislature.",
      attendanceTool.examples,
    ),
  },
  args: {
    uri: { type: "string", description: "Full URI of the deputy" },
    id: { type: "string", description: "Numeric deputy ID (use with --legislature)" },
    legislature: { type: "string", description: "Legislature number (use with --id)" },
    format: { type: "string", default: "csv", description: "csv | jsonl" },
  },
  async run({ args }) {
    const result = await runTool(attendanceTool, {
      uri: (args.uri as string) || undefined,
      id: parseIntFlag(args.id as string, "id"),
      legislature: parseIntFlag(args.legislature as string, "legislature"),
    });
    emit(result, parseFormat(args.format as string));
  },
});

const senatoAttendanceShow = defineCommand({
  meta: {
    name: "show",
    description: withExamples(
      "Aggregate vote counts for a single senator across a legislature.",
      senatoAttendanceTool.examples,
    ),
  },
  args: {
    "senator-uri": { type: "string", description: "Full URI of the senator", required: true },
    legislature: { type: "string", default: "19", description: "Legislature number (default 19)" },
    format: { type: "string", default: "csv", description: "csv | jsonl" },
  },
  async run({ args }) {
    const result = await runTool(senatoAttendanceTool, {
      senatorUri: args["senator-uri"] as string,
      legislature: parseIntFlag(args.legislature as string, "legislature") ?? 19,
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
    limit: { type: "string", default: "200", description: "Max rows to return" },
    offset: { type: "string", default: "0", description: "Offset for pagination" },
    format: { type: "string", default: "csv", description: "csv | jsonl" },
  },
  async run({ args }) {
    const result = await runTool(groupMembersTool, {
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
    limit: { type: "string", default: "200", description: "Max rows to return" },
    offset: { type: "string", default: "0", description: "Offset for pagination" },
    format: { type: "string", default: "csv", description: "csv | jsonl" },
  },
  async run({ args }) {
    const result = await runTool(senatorGroupMembersTool, {
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
    limit: { type: "string", default: "100", description: "Max rows to return" },
    offset: { type: "string", default: "0", description: "Offset for pagination" },
    format: { type: "string", default: "csv", description: "csv | jsonl" },
  },
  async run({ args }) {
    const result = await runTool(govMembersTool, {
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
      "List Camera/Senato committees.",
      committeesTool.examples,
    ),
  },
  args: {
    chamber: { type: "string", default: "both", description: "camera, senato, or both" },
    legislature: { type: "string", description: "Legislature number (Camera default: 19; Senato: shows only active committees)" },
    limit: { type: "string", default: "300", description: "Max rows to return" },
    format: { type: "string", default: "csv", description: "csv | jsonl" },
  },
  async run({ args }) {
    const chamber = (args.chamber as string) || "both";
    if (!["camera", "senato", "both"].includes(chamber)) {
      throw new Error(`Invalid --chamber "${chamber}". Expected: camera, senato, both.`);
    }
    const result = await runTool(committeesTool, {
      chamber: chamber as "camera" | "senato" | "both",
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
      "Bill progress / iter. Senato: list DDL with current status. Camera: full iter timeline of a single atto (use --uri).",
      billProgressTool.examples,
    ),
  },
  args: {
    "ddl-uri": { type: "string", description: "Full URI of a Senato DDL" },
    uri: {
      type: "string",
      description:
        "Full URI of a Camera atto (e.g. http://dati.camera.it/ocd/attocamera.rdf/ac19_2822): returns the full iter timeline",
    },
    keyword: {
      type: "string",
      description: "Search in DDL title (case-insensitive)",
    },
    number: {
      type: "string",
      description: "Senato act number (e.g. 1809 for S.1809); pair with --branch",
    },
    branch: {
      type: "string",
      description: "Branch for --number: S (Senato, default) or C (Camera)",
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
    limit: { type: "string", default: "100", description: "Max rows to return" },
    offset: { type: "string", default: "0", description: "Offset for pagination" },
    format: { type: "string", default: "csv", description: "csv | jsonl" },
  },
  async run({ args }) {
    const branchRaw = (args.branch as string) || undefined;
    if (branchRaw && branchRaw !== "S" && branchRaw !== "C") {
      throw new Error("--branch must be S or C");
    }
    const result = await runTool(billProgressTool, {
      ddlUri: (args["ddl-uri"] as string) || undefined,
      uri: (args.uri as string) || undefined,
      keyword: (args.keyword as string) || undefined,
      number: (args.number as string) || undefined,
      branch: branchRaw as "S" | "C" | undefined,
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
      "Show signatories of a DDL (Camera or Senato, auto-detected from the URI).",
      billSignatoriesTool.examples,
    ),
  },
  args: {
    "bill-uri": { type: "string", description: "Full URI of a DDL (Camera or Senato)" },
    "ddl-uri": { type: "string", description: "Alias of --bill-uri (deprecated)" },
    limit: { type: "string", default: "200", description: "Max rows to return" },
    format: { type: "string", default: "csv", description: "csv | jsonl" },
  },
  async run({ args }) {
    const billUri = (args["bill-uri"] as string) || (args["ddl-uri"] as string);
    if (!billUri) throw new Error("--bill-uri is required");
    const result = await runTool(billSignatoriesTool, {
      billUri,
      limit: parseIntFlag(args.limit as string, "limit") ?? 200,
    });
    emit(result, parseFormat(args.format as string));
  },
});

const billRapporteursList = defineCommand({
  meta: {
    name: "list",
    description: withExamples(
      "List rapporteurs of a DDL (Camera or Senato, auto-detected from the URI).",
      billRapporteursTool.examples,
    ),
  },
  args: {
    "bill-uri": { type: "string", description: "Full URI of a DDL (Camera or Senato)", required: true },
    limit: { type: "string", default: "100", description: "Max rows to return" },
    format: { type: "string", default: "csv", description: "csv | jsonl" },
  },
  async run({ args }) {
    const result = await runTool(billRapporteursTool, {
      billUri: args["bill-uri"] as string,
      limit: parseIntFlag(args.limit as string, "limit") ?? 100,
    });
    emit(result, parseFormat(args.format as string));
  },
});

const billCommitteesList = defineCommand({
  meta: {
    name: "list",
    description: withExamples(
      "List committees a DDL/atto is assigned to (Camera or Senato, auto-detected from the URI).",
      billCommitteesTool.examples,
    ),
  },
  args: {
    "bill-uri": { type: "string", description: "Full URI of a DDL/atto (Camera or Senato)", required: true },
    limit: { type: "string", default: "100", description: "Max rows to return" },
    format: { type: "string", default: "csv", description: "csv | jsonl" },
  },
  async run({ args }) {
    const result = await runTool(billCommitteesTool, {
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
    "ddl-uri": { type: "string", description: "Filter amendments to a specific bill (Senato ddl URI)" },
    "with-proponents": {
      type: "boolean",
      default: false,
      description:
        "Enrich rows with proponents from the Senato AKN bulk data (one fetch per amendment, slower)",
    },
    limit: { type: "string", default: "100", description: "Max rows to return" },
    offset: { type: "string", default: "0", description: "Offset for pagination" },
    format: { type: "string", default: "csv", description: "csv | jsonl" },
  },
  async run({ args }) {
    const result = await runTool(amendmentsTool, {
      legislature: parseIntFlag(args.legislature as string, "legislature"),
      ddlUri: (args["ddl-uri"] as string) || undefined,
      withProponents: Boolean(args["with-proponents"]),
      limit: parseIntFlag(args.limit as string, "limit") ?? 100,
      offset: Number(args.offset ?? 0),
    });
    emit(result, parseFormat(args.format as string));
  },
});

const cameraAmendmentsList = defineCommand({
  meta: {
    name: "list",
    description: withExamples(
      "List Camera amendments (proposte emendative) for an atto, by sede. Source: documenti.camera.it HTML app (not LOD).",
      cameraAmendmentsTool.examples,
    ),
  },
  args: {
    "bill-uri": {
      type: "string",
      description: "Full URI of a Camera atto (es. http://dati.camera.it/ocd/attocamera.rdf/ac19_2696)",
      required: true,
    },
    "count-only": { type: "boolean", description: "Return only the amendment count per sede" },
    limit: { type: "string", default: "2000", description: "Max rows to return" },
    format: { type: "string", default: "csv", description: "csv | jsonl" },
  },
  async run({ args }) {
    const result = await runTool(cameraAmendmentsTool, {
      billUri: args["bill-uri"] as string,
      countOnly: Boolean(args["count-only"]),
      limit: parseIntFlag(args.limit as string, "limit") ?? 2000,
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
    limit: { type: "string", default: "20", description: "Max rows to return" },
    offset: { type: "string", default: "0", description: "Offset for pagination" },
    format: { type: "string", default: "csv", description: "csv | jsonl" },
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
    const result = await runTool(rankTool, {
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
    type: { type: "string", description: "Filter by act type (case-insensitive)" },
    keyword: { type: "string", description: "Search in act label (case-insensitive)" },
    "date-from": { type: "string", description: "Start date YYYY-MM-DD" },
    "date-to": { type: "string", description: "End date YYYY-MM-DD" },
    "count-only": { type: "boolean", description: "Return only total count" },
    limit: { type: "string", default: "100", description: "Max rows to return" },
    offset: { type: "string", default: "0", description: "Offset for pagination" },
    format: { type: "string", default: "csv", description: "csv | jsonl" },
  },
  async run({ args }) {
    const result = await runTool(sindacatoIspettivoTool, {
      legislature: parseIntFlag(args.legislature as string, "legislature"),
      senatorUri: (args["senator-uri"] as string) || undefined,
      type: (args.type as string) || undefined,
      keyword: (args.keyword as string) || undefined,
      dateFrom: (args["date-from"] as string) || undefined,
      dateTo: (args["date-to"] as string) || undefined,
      countOnly: args["count-only"] ? true : undefined,
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
    limit: { type: "string", default: "200", description: "Max rows to return" },
    offset: { type: "string", default: "0", description: "Offset for pagination" },
    format: { type: "string", default: "csv", description: "csv | jsonl" },
  },
  async run({ args }) {
    const chamber = (args.chamber as string) || "both";
    if (!["camera", "senato", "both"].includes(chamber)) {
      throw new Error(`Invalid --chamber "${chamber}". Expected: camera, senato, both.`);
    }
    const result = await runTool(committeeMembersTool, {
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
    limit: { type: "string", default: "100", description: "Max rows to return" },
    offset: { type: "string", default: "0", description: "Offset for pagination" },
    format: { type: "string", default: "csv", description: "csv | jsonl" },
  },
  async run({ args }) {
    const result = await runTool(memberBillsTool, {
      memberUri: args["member-uri"] as string,
      legislature: parseIntFlag(args.legislature as string, "legislature"),
      limit: parseIntFlag(args.limit as string, "limit") ?? 100,
      offset: Number(args.offset ?? 0),
    });
    emit(result, parseFormat(args.format as string));
  },
});

const sparqlArgs = {
  endpoint: { type: "string", description: "camera or senato", required: true },
  query: { type: "string", description: "SPARQL SELECT query", required: true },
  limit: { type: "string", default: "25", description: "Max rows to return" },
  format: { type: "string", default: "csv", description: "csv | jsonl" },
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runSparqlArgs(args: Record<string, any>): Promise<void> {
  const endpoint = args.endpoint as string;
  if (endpoint !== "camera" && endpoint !== "senato") {
    throw new Error('Invalid --endpoint. Allowed: camera, senato.');
  }
  const result = await runTool(sparqlTool, {
    query: args.query as string,
    endpoint,
    limit: parseIntFlag(args.limit as string, "limit") ?? 25,
  });
  emit(result, parseFormat(args.format as string));
}

const sparqlQuery = defineCommand({
  meta: {
    name: "query",
    description: withExamples(
      "Execute a free SPARQL SELECT query on Camera or Senato.",
      sparqlTool.examples,
    ),
  },
  args: sparqlArgs,
  run: ({ args }) => runSparqlArgs(args),
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
    limit: { type: "string", default: "100", description: "Max rows to return" },
    offset: { type: "string", default: "0", description: "Offset for pagination" },
    format: { type: "string", default: "csv", description: "csv | jsonl" },
  },
  async run({ args }) {
    const result = await runTool(documentsTool, {
      legislature: parseIntFlag(args.legislature as string, "legislature"),
      type: (args.type as string) || undefined,
      limit: parseIntFlag(args.limit as string, "limit") ?? 100,
      offset: Number(args.offset ?? 0),
    });
    emit(result, parseFormat(args.format as string));
  },
});

const personCareerShow = defineCommand({
  meta: {
    name: "show",
    description: withExamples(
      "Show a person's unified career across legislatures and government (Camera persona hub).",
      personCareerTool.examples,
    ),
  },
  args: {
    uri: { type: "string", description: "Deputy or persona URI (Camera)", required: true },
    format: { type: "string", default: "csv", description: "csv | jsonl" },
  },
  async run({ args }) {
    const result = await runTool(personCareerTool, { uri: args.uri as string });
    emit(result, parseFormat(args.format as string));
  },
});

const peopleResolve = defineCommand({
  meta: {
    name: "resolve",
    description: withExamples(
      "Resolve a batch of person URIs (mixed Camera + Senato) to names.",
      peopleTool.examples,
    ),
  },
  args: {
    uris: {
      type: "string",
      description:
        "Comma-separated person URIs (Camera and/or Senato, mixed)",
      required: true,
    },
    format: { type: "string", default: "csv", description: "csv | jsonl" },
  },
  async run({ args }) {
    const uris = (args.uris as string)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const result = await runTool(peopleTool, { uris });
    emit(result, parseFormat(args.format as string));
  },
});

const committeeSessionsList = defineCommand({
  meta: {
    name: "list",
    description: withExamples(
      "Committee activity. Mode 1: bill progress (--ddl-uri, Senato). Mode 2: follow a committee (--committee-uri or --committee-name + --chamber, Camera+Senato).",
      committeeSessionsTool.examples,
    ),
  },
  args: {
    "ddl-uri": { type: "string", description: "Senato ddl URI (bill progress mode)" },
    "committee-uri": { type: "string", description: "Committee URI (Camera organo or Senato commissione). Follow-committee mode." },
    "committee-name": { type: "string", description: 'Committee name (or substring) to resolve, e.g. "giustizia", "femminicidio". Use with --chamber and --legislature.' },
    chamber: { type: "string", default: "both", description: "camera, senato, or both (follow-committee mode). Ignored with --ddl-uri." },
    legislature: { type: "string", description: "Legislature number (default 19)" },
    "date-from": { type: "string", description: 'Start date inclusive. Senato: AAAA-MM-GG; Camera: AAAAMMGG or AAAA-MM-GG.' },
    "date-to": { type: "string", description: 'End date inclusive. Senato: AAAA-MM-GG; Camera: AAAAMMGG or AAAA-MM-GG.' },
    limit: { type: "string", default: "200", description: "Max rows to return" },
    offset: { type: "string", default: "0", description: "Offset for pagination" },
    "count-only": { type: "boolean", description: "Return only the session count, not the full list." },
    format: { type: "string", default: "csv", description: "csv | jsonl" },
  },
  async run({ args }) {
    const chamber = (args.chamber as string) || "both";
    if (!["camera", "senato", "both"].includes(chamber)) {
      throw new Error(`Invalid --chamber "${chamber}". Expected: camera, senato, both.`);
    }
    const result = await runTool(committeeSessionsTool, {
      ddlUri: (args["ddl-uri"] as string) || undefined,
      committeeUri: (args["committee-uri"] as string) || undefined,
      committeeName: (args["committee-name"] as string) || undefined,
      chamber: chamber as "camera" | "senato" | "both",
      legislature: parseIntFlag(args.legislature as string, "legislature"),
      dateFrom: (args["date-from"] as string) || undefined,
      dateTo: (args["date-to"] as string) || undefined,
      limit: parseIntFlag(args.limit as string, "limit") ?? 200,
      offset: Number(args.offset ?? 0),
      countOnly: args["count-only"] === true,
    });
    emit(result, parseFormat(args.format as string));
  },
});

const audizioniList = defineCommand({
  meta: {
    name: "list",
    description: withExamples(
      "[CAMERA] Committee hearings (audizioni). Leg. 19: via discussion title (date, committee, audited person in title, linked bills, bulletin). Leg. 14: via historical dc:type. Senato not covered.",
      audizioniTool.examples,
    ),
  },
  args: {
    legislature: { type: "string", description: "Legislature number (default 19)" },
    "committee-name": { type: "string", description: 'Committee name/substring, e.g. "femminicidio", "periferie".' },
    keyword: { type: "string", description: 'Keyword in the hearing title, e.g. "prefetto", "Enel", "equo compenso".' },
    "date-from": { type: "string", description: "Start date inclusive. AAAAMMGG or AAAA-MM-GG." },
    "date-to": { type: "string", description: "End date inclusive. AAAAMMGG or AAAA-MM-GG." },
    limit: { type: "string", default: "200", description: "Max rows to return" },
    offset: { type: "string", default: "0", description: "Offset for pagination" },
    format: { type: "string", default: "csv", description: "csv | jsonl" },
  },
  async run({ args }) {
    const result = await runTool(audizioniTool, {
      legislature: parseIntFlag(args.legislature as string, "legislature") ?? 19,
      committeeName: (args["committee-name"] as string) || undefined,
      keyword: (args.keyword as string) || undefined,
      dateFrom: (args["date-from"] as string) || undefined,
      dateTo: (args["date-to"] as string) || undefined,
      limit: parseIntFlag(args.limit as string, "limit") ?? 200,
      offset: Number(args.offset ?? 0),
    });
    emit(result, parseFormat(args.format as string));
  },
});

const groupRankList = defineCommand({
  meta: {
    name: "list",
    description: withExamples(
      "Rank Camera parliamentary groups by activity (AIC or bills), with per-member average.",
      groupRankTool.examples,
    ),
  },
  args: {
    "rank-by": { type: "string", description: "aic | bills", required: true },
    legislature: { type: "string", description: "Legislature number (default 19)", default: "19" },
    order: { type: "string", description: "desc | asc (default desc)", default: "desc" },
    limit: { type: "string", default: "20", description: "Max rows to return" },
    format: { type: "string", default: "csv", description: "csv | jsonl" },
  },
  async run({ args }) {
    const result = await runTool(groupRankTool, {
      rankBy: args["rank-by"] as "aic" | "bills",
      legislature: parseIntFlag(args.legislature as string, "legislature") ?? 19,
      order: (args.order as "desc" | "asc") ?? "desc",
      limit: parseIntFlag(args.limit as string, "limit") ?? 20,
    });
    emit(result, parseFormat(args.format as string));
  },
});

const senatoVotesList = defineCommand({
  meta: {
    name: "list",
    description: withExamples(
      "List Senato Assembly votes with outcome, counters and linked bill.",
      senatoVotesTool.examples,
    ),
  },
  args: {
    legislature: { type: "string", description: "Legislature number (default 19)", default: "19" },
    "ddl-uri": { type: "string", description: "Filter votes linked to a bill (Senato ddl URI)" },
    keyword: { type: "string", description: "Search in vote label (case-insensitive), e.g. 'caccia', 'bilancio'" },
    "confidence-vote": { type: "string", description: "Filter confidence votes: true or false" },
    "final-vote": { type: "string", description: "Filter final votes (label 'Votazione finale'): true or false" },
    "date-from": { type: "string", description: "Session date from (YYYY-MM-DD)" },
    "date-to": { type: "string", description: "Session date to (YYYY-MM-DD)" },
    "count-only": { type: "boolean", description: "Return only the total count (column count)" },
    limit: { type: "string", default: "100", description: "Max rows to return" },
    offset: { type: "string", default: "0", description: "Offset for pagination" },
    format: { type: "string", default: "csv", description: "csv | jsonl" },
  },
  async run({ args }) {
    const result = await runTool(senatoVotesTool, {
      countOnly: args["count-only"] === true,
      legislature: parseIntFlag(args.legislature as string, "legislature") ?? 19,
      ddlUri: (args["ddl-uri"] as string) || undefined,
      keyword: (args.keyword as string) || undefined,
      confidenceVote: parseBoolFlag(args["confidence-vote"] as string, "confidence-vote"),
      finalVote: parseBoolFlag(args["final-vote"] as string, "final-vote"),
      dateFrom: (args["date-from"] as string) || undefined,
      dateTo: (args["date-to"] as string) || undefined,
      limit: parseIntFlag(args.limit as string, "limit") ?? 100,
      offset: Number(args.offset) || 0,
    });
    emit(result, parseFormat(args.format as string));
  },
});

const senatoVoteDetailShow = defineCommand({
  meta: {
    name: "show",
    description: withExamples(
      "Show how each senator voted in a single Senato vote.",
      senatoVoteDetailTool.examples,
    ),
  },
  args: {
    "vote-uri": { type: "string", description: "Senato vote URI (from senato-votes)", required: true },
    "vote-type": {
      type: "string",
      description: "Filter by vote: Favorevole | Contrario | Astenuto | Presente non votante | In congedo/missione",
    },
    format: { type: "string", default: "csv", description: "csv | jsonl" },
  },
  async run({ args }) {
    const result = await runTool(senatoVoteDetailTool, {
      voteUri: args["vote-uri"] as string,
      voteType: (args["vote-type"] as string) || undefined,
    } as Parameters<typeof senatoVoteDetailTool.execute>[0]);
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
    format: { type: "string", default: "csv", description: "csv | jsonl" },
  },
  async run({ args }) {
    const result = await runTool(billTextTool, { uri: args.uri as string });
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

const GUIDE_TEXT = `italianparliament — guida all'orchestrazione

FLUSSO TIPICO (le schede di dettaglio richiedono un URI, ottenuto da un comando di lista/ricerca):
  1. Scoperta:
     - persone:        search find --name <nome>            (Camera+Senato, restituisce URI)
     - gruppi:         groups list --legislature 19          (Camera)  /  senator-group-members list (Senato)
     - legislature:    legislatures list
     - governi:        governments list
  2. Dettaglio (con l'URI ottenuto sopra):
     - persona:        deputy/senator show --uri ...  |  person-career show --uri ... (legislature + governo)
     - gruppo:         group-members list --group-uri ...
  3. Catene utili:
     - votazioni Camera:  votes list ... → vote-detail show --vote-uri ...
     - votazioni Senato:  senato-votes list ... → senato-vote-detail show --vote-uri ...
     - presenze/assenze:  attendance show --uri <deputato>  |  senato-attendance show --senator-uri ... --legislature ...
     - DDL Senato:        bill-progress list --keyword ... → amendments / committee-sessions / bill-text (--ddl-uri o ddl URI)
     - testo DDL:         bill-text links --uri <ddl> (poi, Senato dietro WAF: bill-text fetch --did <N>)

OPZIONI TRASVERSALI:
  --format csv|jsonl     formato output (default csv)
  --count-only           solo il totale (su bills/aic/votes/senato-votes), per confronti senza scaricare le righe
  --legislature 19       legislatura corrente (default dove applicabile)

SCOPERTA COMANDI:
  italianparliament which <capacità>     trova il comando per una capacità (es. which "testo ddl")
  italianparliament <comando> --help     mostra opzioni ed esempi copiabili
`;

const guideCmd = defineCommand({
  meta: { name: "guide", description: "Print the recommended workflow for orchestrating the CLI step by step" },
  run() {
    process.stdout.write(GUIDE_TEXT);
  },
});

const whichCmd = defineCommand({
  meta: {
    name: "which",
    description: withExamples(
      "Find the command(s) that implement a capability. Ranked by relevance; exit code 0 if a match is found, 2 otherwise.",
      [
        'italianparliament which "testo ddl"',
        "italianparliament which votazione",
        'italianparliament which carriera --json',
      ],
    ),
  },
  args: {
    capability: { type: "positional", description: "Capability to look up (e.g. 'testo ddl')", required: true },
    json: { type: "boolean", description: "Output ranked JSON [{command, score, description, example}]", default: false },
  },
  run({ args }) {
    const q = String(args.capability ?? "").toLowerCase().trim();
    // Query vuota (es. which "   "): la stringa vuota è contenuta in ogni
    // term, quindi matcherebbe l'intero catalogo con exit 0 — fuorviante.
    // Messaggio su stderr (stdout resta per risultati/JSON, come gli hint).
    if (!q) {
      process.stderr.write(
        `Indicare una capacità da cercare, es.: italianparliament which "testo ddl". ` +
          `Per il catalogo completo: italianparliament guide.\n`,
      );
      process.exit(2);
    }
    const ranked = CAPABILITIES.map((c) => ({
      command: c.cmd,
      score: capabilityScore(c, q),
      description: c.desc,
      example: c.example,
    }))
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score);

    if (args.json) {
      process.stdout.write(JSON.stringify(ranked) + "\n");
    } else if (ranked.length === 0) {
      // Su stderr: stdout resta per risultati/JSON (pipeline-friendly).
      process.stderr.write(
        `Nessun comando trovato per "${q}". Prova 'italianparliament guide' per il flusso completo, o '--help'.\n`,
      );
    } else {
      for (const m of ranked) {
        process.stdout.write(`${m.command} — ${m.description}\n  es.: ${m.example}\n`);
      }
      process.stdout.write(`\nDettagli e altre opzioni: italianparliament <comando> --help\n`);
    }
    // Confidenza via exit code: 0 = match trovato, 2 = nessun match.
    process.exit(ranked.length > 0 ? 0 : 2);
  },
});

const main = defineCommand({
  meta: {
    name: "italianparliament",
    version,
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
    "senato-groups": defineCommand({
      meta: { name: "senato-groups", description: "Parliamentary groups of Senato with member count" },
      subCommands: { list: senatoGroupsList },
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
    attendance: defineCommand({
      meta: { name: "attendance", description: "Aggregate deputy vote counts across a legislature (Camera)" },
      subCommands: { show: attendanceShow },
    }),
    "senato-attendance": defineCommand({
      meta: { name: "senato-attendance", description: "Aggregate senator vote counts across a legislature (Senato)" },
      subCommands: { show: senatoAttendanceShow },
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
      meta: { name: "committees", description: "Camera+Senato committees" },
      subCommands: { list: committeesList },
    }),
    "bill-progress": defineCommand({
      meta: { name: "bill-progress", description: "Senato DDL progress (iter)" },
      subCommands: { list: billProgressList },
    }),
    "bill-signatories": defineCommand({
      meta: { name: "bill-signatories", description: "Signatories of a DDL (Camera+Senato)" },
      subCommands: { show: billSignatoriesShow },
    }),
    "bill-rapporteurs": defineCommand({
      meta: { name: "bill-rapporteurs", description: "Rapporteurs of a DDL (Camera or Senato)" },
      subCommands: { list: billRapporteursList },
    }),
    "bill-committees": defineCommand({
      meta: { name: "bill-committees", description: "Committees a DDL/atto is assigned to (Camera or Senato)" },
      subCommands: { list: billCommitteesList },
    }),
    amendments: defineCommand({
      meta: { name: "amendments", description: "Senato amendments" },
      subCommands: { list: amendmentsList },
    }),
    "camera-amendments": defineCommand({
      meta: { name: "camera-amendments", description: "Camera amendments (proposte emendative, via HTML app)" },
      subCommands: { list: cameraAmendmentsList },
    }),
    documents: defineCommand({
      meta: { name: "documents", description: "Senato parliamentary documents" },
      subCommands: { list: documentsList },
    }),
    sparql: defineCommand({
      meta: { name: "sparql", description: "Free SPARQL SELECT query on Camera or Senato (use: sparql query --endpoint ...)" },
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
    "senato-votes": defineCommand({
      meta: { name: "senato-votes", description: "Senato Assembly votes with outcome and counters" },
      subCommands: { list: senatoVotesList },
    }),
    "senato-vote-detail": defineCommand({
      meta: { name: "senato-vote-detail", description: "How each senator voted in a single Senato vote" },
      subCommands: { show: senatoVoteDetailShow },
    }),
    "group-rank": defineCommand({
      meta: { name: "group-rank", description: "Rank Camera groups by activity (AIC/bills) with per-member average" },
      subCommands: { list: groupRankList },
    }),
    "committee-sessions": defineCommand({
      meta: { name: "committee-sessions", description: "Committee activity: bill progress (Senato) or follow a committee (Camera+Senato)" },
      subCommands: { list: committeeSessionsList },
    }),
    "person-career": defineCommand({
      meta: { name: "person-career", description: "A person's unified career across legislatures and government" },
      subCommands: { show: personCareerShow },
    }),
    people: defineCommand({
      meta: { name: "people", description: "Batch resolve person URIs (mixed Camera + Senato) to names" },
      subCommands: { resolve: peopleResolve },
    }),
    audizioni: defineCommand({
      meta: { name: "audizioni", description: "[CAMERA] Committee hearings (audizioni): date, committee, audited person, linked bills, bulletin" },
      subCommands: { list: audizioniList },
    }),
    guide: guideCmd,
    which: whichCmd,
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

// Shim ergonomico: `sparql --endpoint ...` (senza il sotto-comando `query`)
// è un errore facile per un agente. citty con i subCommands mostrerebbe l'help;
// qui inseriamo `query` così il comando funziona come `sparql query ...`.
const argv = process.argv.slice(2);
if (argv[0] === "sparql" && argv[1] !== "query" && argv[1] !== "--help" && argv[1] !== "-h") {
  process.argv.splice(3, 0, "query");
}

runMain(main).catch((err: unknown) => {
  if (err instanceof ZodError) {
    // Errori di validazione input: per gli enum, elenca i valori validi.
    const msgs = err.issues.map((i) => {
      const field = i.path.join(".") || "input";
      if (i.code === "invalid_enum_value") {
        return `--${field}: valore non valido. Ammessi: ${i.options.join(" | ")}.`;
      }
      return `--${field}: ${i.message}`;
    });
    process.stderr.write(`Error: ${msgs.join("\n")}\n`);
  } else if (err instanceof SparqlError) {
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
