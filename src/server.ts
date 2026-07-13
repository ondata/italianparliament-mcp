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
import { billRapporteursTool } from "./tools/bill-rapporteurs.js";
import { billCommitteesTool } from "./tools/bill-committees.js";
import { amendmentsTool } from "./tools/amendments.js";
import { cameraAmendmentsTool } from "./tools/camera-amendments.js";
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
import { attendanceTool } from "./tools/attendance.js";
import { senatoAttendanceTool } from "./tools/senato-attendance.js";
import type { Tool, ToolResult } from "./tools/types.js";
import { toJsonl } from "./core/format.js";
import { SparqlError } from "./core/client.js";
import { ZodError } from "zod";
import { formatZodError } from "./core/zod-error.js";

function describe(tool: Tool): string {
  return `${tool.description}\n\nExamples:\n${tool.examples
    .map((e) => `  ${e}`)
    .join("\n")}`;
}

const DEFAULT_EMPTY =
  "Nessun risultato dai dati. NON dedurre né inventare il valore: se serve, riformula (termine normativo o radice più corta per le ricerche testuali, filtro più largo) o verifica gli identificatori (URI/numero/ramo). Un vuoto è spesso un mismatch, non un dato assente.";

function formatResult(result: ToolResult, emptyHint?: string): string {
  if (result.rows.length === 0) return result.hint ?? emptyHint ?? DEFAULT_EMPTY;
  return toJsonl(result.rows);
}

function makeHandler(tool: Tool) {
  return async (input: unknown) => {
    try {
      // Valida l'input con lo schema Zod prima di eseguire, come fa la CLI
      // (cli.ts). Le regex/limiti dello schema (es. il formato data YYYY-MM-DD
      // di speeches) non devono dipendere dal solo dispatch dell'SDK: parseare
      // qui è il chokepoint unico che protegge tutti i tool da input non
      // conformi che finirebbero interpolati nelle query SPARQL.
      const parsed = tool.inputSchema.parse(input);
      const result = await tool.execute(parsed);
      return {
        content: [
          { type: "text" as const, text: formatResult(result, tool.emptyHint) },
        ],
      };
    } catch (err) {
      const message =
        err instanceof ZodError
          ? formatZodError(err)
          : err instanceof SparqlError
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
    version: "0.25.2",
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
    billRapporteursTool,
    billCommitteesTool,
    amendmentsTool,
    cameraAmendmentsTool,
    documentsTool,
    sparqlTool,
    rankTool,
    sindacatoIspettivoTool,
    committeeMembersTool,
    memberBillsTool,
    billTextTool,
    senatoGroupsTool,
    senatoVotesTool,
    senatoVoteDetailTool,
    groupRankTool,
    committeeSessionsTool,
    personCareerTool,
    peopleTool,
    audizioniTool,
    attendanceTool,
    senatoAttendanceTool,
  ];

  for (const tool of allTools) {
    server.registerTool(
      tool.name,
      { description: describe(tool), inputSchema: tool.inputSchema.shape },
      makeHandler(tool),
    );
  }
}
