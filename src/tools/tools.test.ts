import { describe, it, expect } from "vitest";
import { peopleTool } from "./people.js";
import { deputiesTool } from "./deputies.js";
import { senatorsTool } from "./senators.js";
import { searchTool } from "./search.js";
import { legislaturesTool } from "./legislatures.js";
import { groupsTool } from "./groups.js";
import { sessionsTool } from "./sessions.js";
import { governmentsTool } from "./governments.js";
import { billsTool } from "./bills.js";
import { votesTool } from "./votes.js";
import { speechesTool } from "./speeches.js";
import { aicTool } from "./aic.js";
import { voteDetailTool } from "./vote-detail.js";
import { groupMembersTool } from "./group-members.js";
import { deputyTool } from "./deputy.js";
import { senatorTool } from "./senator.js";
import { billTool } from "./bill.js";
import { rolesTool } from "./roles.js";
import { govMembersTool } from "./gov-members.js";
import { committeesTool } from "./committees.js";
import { billProgressTool } from "./bill-progress.js";
import { billSignatoriesTool } from "./bill-signatories.js";
import { amendmentsTool } from "./amendments.js";
import { documentsTool } from "./documents.js";

// Integration tests — hit real SPARQL endpoints.
// Run with: npx vitest run src/tools/tools.test.ts
// These are slow (network), so timeout is generous.

describe("Camera tools", () => {
  it("deputies: returns rows for legislature 19", async () => {
    const result = await deputiesTool.execute({ legislature: 19, limit: 3, offset: 0 });
    expect(result.rows.length).toBe(3);
    expect(result.rows[0]).toHaveProperty("first_name");
    expect(result.rows[0]).toHaveProperty("last_name");
  }, 30000);

  it("legislatures: returns all legislatures", async () => {
    const result = await legislaturesTool.execute({});
    expect(result.rows.length).toBeGreaterThan(30);
    expect(result.rows[0]).toHaveProperty("uri");
    expect(result.rows[0]).toHaveProperty("date");
  }, 30000);

  it("groups: returns groups with acronyms for leg 19", async () => {
    const result = await groupsTool.execute({ legislature: 19, limit: 100 });
    expect(result.rows.length).toBeGreaterThan(5);
    const fdi = result.rows.find((r) => r.acronym === "FDI");
    expect(fdi).toBeDefined();
    const m5s = result.rows.find((r) => r.acronym === "M5S");
    expect(m5s).toBeDefined();
  }, 30000);

  it("sessions: returns sessions without BF_ duplicates", async () => {
    const result = await sessionsTool.execute({ legislature: 19, limit: 5, offset: 0 });
    expect(result.rows.length).toBe(5);
    for (const row of result.rows) {
      expect(row.uri).toMatch(/seduta\.rdf\/s\d/);
      expect(row.number).not.toBe("");
    }
  }, 30000);

  it("governments: ordered chronologically descending", async () => {
    const result = await governmentsTool.execute({ limit: 3, offset: 0 });
    expect(result.rows.length).toBe(3);
    expect(result.rows[0].label).toContain("Meloni");
    expect(result.rows[0]).toHaveProperty("start_date");
  }, 30000);

  it("bills: returns bills for legislature 19", async () => {
    const result = await billsTool.execute({ legislature: 19, limit: 3, offset: 0 });
    expect(result.rows.length).toBe(3);
    expect(result.rows[0]).toHaveProperty("type");
  }, 30000);

  it("votes: returns votes for legislature 19", async () => {
    const result = await votesTool.execute({ legislature: 19, limit: 3, offset: 0 });
    expect(result.rows.length).toBe(3);
    expect(result.rows[0]).toHaveProperty("in_favour");
    expect(result.rows[0]).toHaveProperty("approved");
  }, 30000);

  it("speeches: returns speeches for legislature 19", async () => {
    const result = await speechesTool.execute({ legislature: 19, limit: 3, offset: 0, chamber: "camera", countOnly: false });
    expect(result.rows.length).toBe(3);
    expect(result.rows[0]).toHaveProperty("deputy_uri");
    expect(result.rows[0]).toHaveProperty("document_url");
  }, 30000);

  it("aic: returns atti for legislature 19", async () => {
    const result = await aicTool.execute({ legislature: 19, primaryOnly: false, limit: 3, offset: 0 });
    expect(result.rows.length).toBe(3);
    expect(result.rows[0]).toHaveProperty("type");
    expect(result.rows[0]).toHaveProperty("identifier");
  }, 30000);

  it("vote-detail: returns individual votes", async () => {
    const result = await voteDetailTool.execute({
      voteUri: "http://dati.camera.it/ocd/votazione.rdf/vs19_047_005",
      limit: 5,
    });
    expect(result.rows.length).toBe(5);
    expect(result.rows[0]).toHaveProperty("vote");
    expect(result.rows[0]).toHaveProperty("group_acronym");
  }, 30000);

  it("group-members: returns members for legislature 19", async () => {
    const result = await groupMembersTool.execute({ legislature: 19, limit: 3, offset: 0 });
    expect(result.rows.length).toBe(3);
    expect(result.rows[0]).toHaveProperty("group_label");
    expect(result.rows[0]).toHaveProperty("deputy_uri");
  }, 30000);

  it("roles: returns roles with role field populated", async () => {
    const result = await rolesTool.execute({ legislature: 19, limit: 5, offset: 0 });
    expect(result.rows.length).toBe(5);
    const withRole = result.rows.filter((r) => r.role !== "");
    expect(withRole.length).toBeGreaterThan(0);
  }, 30000);

  it("deputy: returns structured detail for Meloni", async () => {
    const result = await deputyTool.execute({ id: 302103, legislature: 19 });
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].first_name).toBe("GIORGIA");
    expect(result.rows[0].last_name).toBe("MELONI");
    expect(result.rows[0].gender).toBe("female");
  }, 30000);

  it("bill: returns structured detail", async () => {
    const result = await billTool.execute({
      uri: "http://dati.camera.it/ocd/attocamera.rdf/ac19_153",
    });
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].type).toBe("Progetto di Legge");
    expect(result.rows[0]).toHaveProperty("initiative");
  }, 30000);

  it("search: finds Meloni in camera", async () => {
    const result = await searchTool.execute({
      name: "meloni",
      chamber: "camera",
      limit: 10,
    });
    expect(result.rows.length).toBeGreaterThan(0);
    const giorgia = result.rows.find((r) => r.first_name === "Giorgia");
    expect(giorgia).toBeDefined();
    expect(giorgia?.gender).toBe("female");
  }, 30000);

  it("gov-members: returns Meloni government members", async () => {
    const result = await govMembersTool.execute({ legislature: 19, limit: 5, offset: 0 });
    expect(result.rows.length).toBe(5);
    expect(result.rows[0]).toHaveProperty("person_name");
    expect(result.rows[0]).toHaveProperty("role");
  }, 30000);

  it("gov-members: search by name", async () => {
    const result = await govMembersTool.execute({ name: "meloni", limit: 10, offset: 0 });
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.rows[0].person_name).toContain("MELONI");
  }, 30000);
});

describe("Senato tools", () => {
  it("senators: returns rows for legislature 19", async () => {
    const result = await senatorsTool.execute({ legislature: 19, limit: 3, offset: 0 });
    expect(result.rows.length).toBe(3);
    expect(result.rows[0]).toHaveProperty("first_name");
    expect(result.rows[0]).toHaveProperty("last_name");
  }, 30000);

  it("senator: returns structured detail", async () => {
    const result = await senatorTool.execute({
      uri: "http://dati.senato.it/senatore/32",
    });
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].last_name).toBe("Alberti Casellati");
  }, 30000);

  it("committees: returns active Senato committees for leg 19", async () => {
    const result = await committeesTool.execute({ chamber: "senato", legislature: 19, limit: 300 });
    expect(result.rows.length).toBeGreaterThan(10);
    const affari = result.rows.find((r) =>
      r.short_title.includes("Affari Costituzionali"),
    );
    expect(affari).toBeDefined();
    expect(Number(affari!.session_count)).toBeGreaterThan(100);
  }, 30000);

  it("committees: returns Camera committees for leg 19", async () => {
    const result = await committeesTool.execute({ chamber: "camera", legislature: 19, limit: 300 });
    expect(result.rows.length).toBeGreaterThan(10);
    const giustizia = result.rows.find((r) => r.title.includes("GIUSTIZIA"));
    expect(giustizia).toBeDefined();
    expect(giustizia!.category).toBe("COMMISSIONE PERMANENTE");
    expect(Number(giustizia!.session_count)).toBeGreaterThan(10);
  }, 30000);

  it("bill-progress: returns DDL for legislature 19", async () => {
    const result = await billProgressTool.execute({ legislature: 19, limit: 3, offset: 0 });
    expect(result.rows.length).toBe(3);
    expect(result.rows[0]).toHaveProperty("status");
    expect(result.rows[0]).toHaveProperty("title");
    expect(result.rows[0].legislature).toBe("19");
  }, 30000);

  it("people: resolves a mixed Camera+Senato batch of URIs to names", async () => {
    const result = await peopleTool.execute({
      uris: [
        "http://dati.senato.it/senatore/32",
        "http://dati.camera.it/ocd/deputato.rdf/d308917_19",
      ],
    });
    expect(result.rows.length).toBe(2);
    const sen = result.rows.find((r) => r.chamber === "senato");
    const cam = result.rows.find((r) => r.chamber === "camera");
    expect(sen?.last_name).toMatch(/casellati/i);
    expect(cam?.last_name).toMatch(/colosimo/i);
    expect(sen?.html_url).toContain("scheda-attivita?did=32");
    expect(cam?.html_url).toContain("19-308917");
  }, 30000);

  it("bill-progress: Camera atto returns iter timeline with same schema as Senato", async () => {
    const camera = await billProgressTool.execute({
      uri: "http://dati.camera.it/ocd/attocamera.rdf/ac19_302",
      limit: 100,
      offset: 0,
    });
    const senato = await billProgressTool.execute({
      legislature: 19,
      limit: 1,
      offset: 0,
    });
    // schema colonne identico tra ramo Camera e ramo Senato (issue #11)
    expect(camera.columns).toEqual(senato.columns);
    expect(camera.rows.length).toBeGreaterThanOrEqual(2);
    const first = camera.rows[0];
    expect(first.ddl_uri).toBe(
      "http://dati.camera.it/ocd/attocamera.rdf/ac19_302",
    );
    expect(first).toHaveProperty("status");
    expect(first.status_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(first.phase).toBe("C.302");
  }, 30000);

  it("bill-signatories: returns signatories for a Senato DDL", async () => {
    const result = await billSignatoriesTool.execute({
      billUri: "http://dati.senato.it/ddl/25597",
      limit: 10,
    });
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.rows[0]).toHaveProperty("name");
    const primary = result.rows.find((r) => r.is_primary === "true");
    expect(primary).toBeDefined();
  }, 30000);

  it("bill-signatories: returns signatories for a Camera atto", async () => {
    const result = await billSignatoriesTool.execute({
      billUri: "http://dati.camera.it/ocd/attocamera.rdf/ac19_2696",
      limit: 50,
    });
    expect(result.rows.length).toBeGreaterThan(0);
    const primary = result.rows.find((r) => r.is_primary === "true");
    expect(primary).toBeDefined();
    expect(primary?.name).toBeTruthy();
  }, 30000);

  it("amendments: returns amendments for legislature 19", async () => {
    const result = await amendmentsTool.execute({ legislature: 19, limit: 3, offset: 0 });
    expect(result.rows.length).toBe(3);
    expect(result.rows[0]).toHaveProperty("number");
    expect(result.rows[0]).toHaveProperty("url");
    expect(result.rows[0].legislature).toBe("19");
  }, 30000);

  it("documents: returns documents for legislature 19", async () => {
    const result = await documentsTool.execute({ legislature: 19, limit: 3, offset: 0 });
    expect(result.rows.length).toBe(3);
    expect(result.rows[0]).toHaveProperty("type");
    expect(result.rows[0]).toHaveProperty("title");
    expect(result.rows[0]).toHaveProperty("status");
  }, 30000);
});
