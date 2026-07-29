import { describe, it, expect } from "vitest";
import { withTruncationNotice, truncationNotice } from "./truncation.js";
import type { ToolResult } from "../tools/types.js";

const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ a: String(i) }));
const result = (n: number, extra: Partial<ToolResult> = {}): ToolResult => ({
  rows: rows(n),
  columns: ["a"],
  ...extra,
});

describe("withTruncationNotice", () => {
  it("righe pari al limite → avviso", () => {
    expect(withTruncationNotice(result(100), 100).notice).toContain("troncato a 100 righe");
  });

  it("righe sotto il limite → nessun avviso", () => {
    expect(withTruncationNotice(result(99), 100).notice).toBeUndefined();
  });

  it("risultato vuoto → nessun avviso (è il caso di hint, non di notice)", () => {
    const out = withTruncationNotice(result(0), 100);
    expect(out.notice).toBeUndefined();
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
    const msg = truncationNotice(1000);
    expect(msg).toContain("già al massimo");
    expect(msg).toContain("--offset 1000");
    expect(msg).not.toContain("--limit più alto");
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
