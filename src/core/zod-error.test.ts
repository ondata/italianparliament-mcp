import { describe, it, expect } from "vitest";
import { z } from "zod";
import { ZodError } from "zod";
import { formatZodError } from "./zod-error.js";

function zodErrorFrom(schema: z.ZodTypeAny, input: unknown): ZodError {
  const r = schema.safeParse(input);
  if (r.success) throw new Error("atteso fallimento di parsing");
  return r.error;
}

describe("formatZodError", () => {
  it("enum: elenca i valori ammessi e il valore ricevuto", () => {
    const schema = z.object({ voteType: z.enum(["finale", "emendamento"]) });
    const msg = formatZodError(zodErrorFrom(schema, { voteType: "x" }));
    expect(msg).toContain("voteType:");
    expect(msg).toContain('"finale" | "emendamento"');
    expect(msg).toContain('"x"');
  });

  it("flagStyle rende il flag CLI reale (-- + kebab-case), MCP lascia il nome schema nudo", () => {
    const schema = z.object({ dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });
    const err = zodErrorFrom(schema, { dateFrom: "pippo" });
    expect(formatZodError(err, true)).toMatch(/^--date-from:/);
    expect(formatZodError(err)).toMatch(/^dateFrom:/);
  });

  it("una riga per issue", () => {
    const schema = z.object({ a: z.string(), b: z.number() });
    const msg = formatZodError(zodErrorFrom(schema, { a: 1, b: "x" }));
    expect(msg.split("\n").length).toBe(2);
  });
});
