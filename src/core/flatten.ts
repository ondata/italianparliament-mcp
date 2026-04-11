import type { SparqlResults, Row } from "./types.js";

export function flattenBindings(results: SparqlResults): Row[] {
  const bindings = results?.results?.bindings ?? [];
  const vars = results?.head?.vars ?? [];
  return bindings.map((b) => {
    const row: Row = {};
    for (const v of vars) {
      row[v] = b[v]?.value ?? "";
    }
    return row;
  });
}
