import { describe, it, expect } from "vitest";
import { flattenBindings } from "./flatten.js";
import type { SparqlResults } from "./types.js";

describe("flattenBindings", () => {
  it("returns empty array on empty bindings", () => {
    const input: SparqlResults = {
      head: { vars: ["s", "label"] },
      results: { bindings: [] },
    };
    expect(flattenBindings(input)).toEqual([]);
  });

  it("extracts .value from each binding", () => {
    const input: SparqlResults = {
      head: { vars: ["s", "label"] },
      results: {
        bindings: [
          {
            s: { type: "uri", value: "http://example.org/1" },
            label: { type: "literal", value: "Alice" },
          },
          {
            s: { type: "uri", value: "http://example.org/2" },
            label: { type: "literal", value: "Bob" },
          },
        ],
      },
    };
    expect(flattenBindings(input)).toEqual([
      { s: "http://example.org/1", label: "Alice" },
      { s: "http://example.org/2", label: "Bob" },
    ]);
  });

  it("fills missing optional variables with empty string", () => {
    const input: SparqlResults = {
      head: { vars: ["s", "label", "desc"] },
      results: {
        bindings: [
          {
            s: { type: "uri", value: "http://example.org/1" },
            label: { type: "literal", value: "Alice" },
          },
        ],
      },
    };
    expect(flattenBindings(input)).toEqual([
      { s: "http://example.org/1", label: "Alice", desc: "" },
    ]);
  });
});
