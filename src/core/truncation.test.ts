import { describe, it, expect } from "vitest";
import { z } from "zod";
import { withTruncationNotice, truncationNotice, limitCeiling } from "./truncation.js";
import { searchTool } from "../tools/search.js";
import { rankTool } from "../tools/rank.js";
import { cameraAmendmentsTool } from "../tools/camera-amendments.js";
import { votesTool } from "../tools/votes.js";
import { toJsonl } from "./format.js";
import type { ToolResult } from "../tools/types.js";

const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ a: String(i) }));
const result = (n: number, extra: Partial<ToolResult> = {}): ToolResult => ({
  rows: rows(n),
  columns: ["a"],
  ...extra,
});

describe("withTruncationNotice", () => {
  it("righe pari al limite → avviso", () => {
    expect(withTruncationNotice(result(100), 100).notice).toContain("limite di 100 righe");
  });

  it("righe sotto il limite → nessun avviso", () => {
    expect(withTruncationNotice(result(99), 100).notice).toBeUndefined();
  });

  it("risultato vuoto → nessun avviso (è il caso di hint, non di notice)", () => {
    const out = withTruncationNotice(result(0), 100);
    expect(out.notice).toBeUndefined();
  });

  it("risultato vuoto con truncated:true → comunque nessun avviso", () => {
    // Sul vuoto parla hint: stampare i due messaggi insieme si
    // contraddirebbe ("non ho trovato nulla" + "ho tagliato i risultati").
    expect(withTruncationNotice(result(0, { truncated: true }), 100).notice).toBeUndefined();
  });

  it("risultato di --count-only → nessun avviso, è un totale esatto", () => {
    const count: ToolResult = { rows: [{ count: "11649" }], columns: ["count"] };
    expect(withTruncationNotice(count, 1).notice).toBeUndefined();
  });

  it("una riga con una colonna diversa da count non è un conteggio", () => {
    const one: ToolResult = { rows: [{ a: "x" }], columns: ["a"] };
    expect(withTruncationNotice(one, 1).notice).toContain("AVVISO");
  });

  it("limite assente (tool senza --limit) → nessun avviso", () => {
    expect(withTruncationNotice(result(50), undefined).notice).toBeUndefined();
  });

  it("truncated esplicito true vince su rows.length sotto il limite", () => {
    // Il caso di votes: dedup dopo il LIMIT lascia meno righe del limite,
    // ma la query era troncata.
    const out = withTruncationNotice(result(87, { truncated: true }), 100);
    expect(out.notice).toContain("troncato");
  });

  it("truncated esplicito false vince su rows.length pari al limite", () => {
    const out = withTruncationNotice(result(100, { truncated: false }), 100);
    expect(out.notice).toBeUndefined();
  });

  it("non muta il risultato in ingresso", () => {
    const input = result(100);
    const out = withTruncationNotice(input, 100);
    expect(input.notice).toBeUndefined();
    expect(out).not.toBe(input);
  });

  it("preserva hint e righe", () => {
    const out = withTruncationNotice(result(100, { hint: "H" }), 100);
    expect(out.hint).toBe("H");
    expect(out.rows).toHaveLength(100);
  });
});

describe("limitCeiling", () => {
  it("legge il massimo reale dallo schema, non un tetto costante", () => {
    // I tetti veri divergono: suggerire "max 1000" a rank (che si ferma a 100)
    // manderebbe l'utente contro un errore di validazione, e dire "già al
    // massimo (1000)" a camera-amendments (che arriva a 5000) è falso.
    expect(limitCeiling(rankTool.inputSchema)).toBe(100);
    expect(limitCeiling(searchTool.inputSchema)).toBe(500);
    expect(limitCeiling(cameraAmendmentsTool.inputSchema)).toBe(5000);
    expect(limitCeiling(votesTool.inputSchema)).toBe(1000);
  });

  it("schema senza limit o senza max → fallback 1000", () => {
    expect(limitCeiling(z.object({ q: z.string() }))).toBe(1000);
    expect(limitCeiling(z.object({ limit: z.number() }))).toBe(1000);
    expect(limitCeiling(undefined)).toBe(1000);
  });

  it("il tetto letto è quello usato nel messaggio", () => {
    const out = withTruncationNotice(result(100), 100, 0, limitCeiling(rankTool.inputSchema));
    expect(out.notice).toContain("già al massimo (100)");
  });
});

// Riproduce il path MCP (server.ts formatResult) per il solo caso non vuoto:
// l'avviso va ACCODATO al JSONL, non sostituito ad esso.
const mcpText = (r: ToolResult) =>
  r.notice ? `${toJsonl(r.rows)}\n${r.notice}` : toJsonl(r.rows);

describe("parità col path MCP", () => {
  it("l'avviso è accodato al JSONL, le righe restano tutte", () => {
    const out = withTruncationNotice(result(3), 3);
    const text = mcpText(out);
    const lines = text.split("\n");
    expect(lines).toHaveLength(4);
    expect(lines.slice(0, 3).map((l) => JSON.parse(l).a)).toEqual(["0", "1", "2"]);
    expect(lines[3]).toContain("AVVISO");
  });

  it("senza troncamento il testo resta JSONL puro", () => {
    const text = mcpText(withTruncationNotice(result(2), 100));
    expect(text.split("\n").every((l) => JSON.parse(l).a !== undefined)).toBe(true);
  });
});

describe("truncationNotice", () => {
  it("sotto il tetto suggerisce di alzare --limit", () => {
    const msg = truncationNotice(100);
    expect(msg).toContain("--limit più alto");
    expect(msg).toContain("--offset");
    expect(msg).toContain("--count-only");
  });

  it("al tetto non suggerisce di alzare --limit ma di paginare", () => {
    // Caso aic su un anno intero: a 1000 righe si copre il solo ultimo mese e
    // alzare il limite non è un'opzione, quindi il messaggio non deve dirlo.
    const msg = truncationNotice(1000, 0, 1000);
    expect(msg).toContain("già al massimo");
    expect(msg).toContain("--offset 1000");
    expect(msg).not.toContain("--limit più alto");
  });

  it("oltre la prima pagina l'offset suggerito è quello SUCCESSIVO", () => {
    // Con --limit 100 --offset 200 la pagina dopo parte da 300: suggerire 100
    // rimanderebbe a righe già lette.
    expect(truncationNotice(100, 200)).toContain("--offset 300");
    expect(withTruncationNotice(result(100), 100, 200).notice).toContain("--offset 300");
  });

  it("non afferma quante righe siano state restituite", () => {
    // search interroga i due rami e unisce: con --limit 50 può restituirne 100
    // pur essendo tagliata a 50 per ramo. "troncato A 50 righe" sarebbe falso.
    expect(truncationNotice(50)).toContain("troncato da un limite di 50 righe");
  });

  it("avverte che a mancare sono i giorni più vecchi, ma solo come condizionale", () => {
    // Il clause sulle date è condizionale ("se hai filtrato per intervallo"):
    // l'avviso vale anche per il tool sparql, dove l'ordinamento lo decide
    // l'utente e affermare "l'ordinamento è per data" sarebbe falso.
    const msg = truncationNotice(100);
    expect(msg).toContain("Se hai filtrato per intervallo di date");
    expect(msg).toContain("PIÙ VECCHI");
  });
});
