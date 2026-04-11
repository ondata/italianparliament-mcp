import type { Row } from "./types.js";

export type Format = "csv" | "jsonl";

function csvEscape(value: string): string {
  if (value === "") return "";
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(rows: Row[], columns?: string[]): string {
  if (rows.length === 0) return (columns ?? []).join(",");
  const cols = columns ?? Object.keys(rows[0]!);
  const header = cols.join(",");
  const body = rows.map((r) => cols.map((c) => csvEscape(r[c] ?? "")).join(","));
  return [header, ...body].join("\n");
}

export function toJsonl(rows: Row[]): string {
  return rows.map((r) => JSON.stringify(r)).join("\n");
}

export function formatRows(
  rows: Row[],
  format: Format,
  columns?: string[],
): string {
  return format === "jsonl" ? toJsonl(rows) : toCsv(rows, columns);
}
