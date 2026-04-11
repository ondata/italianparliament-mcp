import { describe, it, expect } from "vitest";
import { toCsv, toJsonl } from "./format.js";

describe("toCsv", () => {
  it("returns empty string when no rows and no columns", () => {
    expect(toCsv([])).toBe("");
  });

  it("returns header only when columns given but no rows", () => {
    expect(toCsv([], ["a", "b"])).toBe("a,b");
  });

  it("renders header and rows", () => {
    const rows = [
      { s: "u1", label: "Alice" },
      { s: "u2", label: "Bob" },
    ];
    expect(toCsv(rows)).toBe("s,label\nu1,Alice\nu2,Bob");
  });

  it("quotes values containing comma, newline, or quote", () => {
    const rows = [
      { a: "hello, world", b: 'say "hi"', c: "line1\nline2" },
    ];
    expect(toCsv(rows)).toBe(
      'a,b,c\n"hello, world","say ""hi""","line1\nline2"',
    );
  });

  it("respects custom column order", () => {
    const rows = [{ a: "1", b: "2", c: "3" }];
    expect(toCsv(rows, ["c", "a"])).toBe("c,a\n3,1");
  });
});

describe("toJsonl", () => {
  it("returns empty string on empty input", () => {
    expect(toJsonl([])).toBe("");
  });

  it("emits one JSON object per line", () => {
    const rows = [
      { s: "u1", label: "Alice" },
      { s: "u2", label: "Bob" },
    ];
    expect(toJsonl(rows)).toBe(
      '{"s":"u1","label":"Alice"}\n{"s":"u2","label":"Bob"}',
    );
  });
});
