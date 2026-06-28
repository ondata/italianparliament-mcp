import { deputiesTool } from "./deputies.js";
import { senatorsTool } from "./senators.js";
import { billsTool } from "./bills.js";
import { votesTool } from "./votes.js";
import { searchTool } from "./search.js";
import { legislaturesTool } from "./legislatures.js";
import { groupsTool } from "./groups.js";
import { sessionsTool } from "./sessions.js";
import { governmentsTool } from "./governments.js";
import { deputyTool } from "./deputy.js";
import { senatorTool } from "./senator.js";
import { billTool } from "./bill.js";
import { rolesTool } from "./roles.js";
import { speechesTool } from "./speeches.js";
import { aicTool } from "./aic.js";
import { voteDetailTool } from "./vote-detail.js";
import { groupMembersTool } from "./group-members.js";
import { senatorGroupMembersTool } from "./senator-group-members.js";
import { govMembersTool } from "./gov-members.js";
import { committeesTool } from "./committees.js";
import { billProgressTool } from "./bill-progress.js";
import { billSignatoriesTool } from "./bill-signatories.js";
import { amendmentsTool } from "./amendments.js";
import { documentsTool } from "./documents.js";
import { sparqlTool } from "./sparql.js";
import { rankTool } from "./rank.js";
import { sindacatoIspettivoTool } from "./sindacato-ispettivo.js";
import { committeeMembersTool } from "./committee-members.js";
import { memberBillsTool } from "./member-bills.js";
import { billTextTool } from "./bill-text.js";
import { senatoVotesTool } from "./senato-votes.js";
import { senatoVoteDetailTool } from "./senato-vote-detail.js";
import type { Tool } from "./types.js";

export const tools: Tool[] = [
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
  rankTool,
  sindacatoIspettivoTool,
  committeeMembersTool,
  memberBillsTool,
  billTextTool,
  senatoVotesTool,
  senatoVoteDetailTool,
];

export const toolsByName: Record<string, Tool> = Object.fromEntries(
  tools.map((t) => [t.name, t]),
);

export {
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
  rankTool,
  sindacatoIspettivoTool,
  committeeMembersTool,
  memberBillsTool,
  billTextTool,
  senatoVotesTool,
  senatoVoteDetailTool,
};
export type { Tool, ToolResult } from "./types.js";
