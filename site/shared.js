/* ================================================================
   italianparliament-mcp — utility condivise tra le pagine del sito
   Client MCP, cache locale, colori dei gruppi parlamentari.
   ================================================================ */

"use strict";

const MCP_URL = "https://italianparliament-mcp.andy-pr.workers.dev/mcp";
const HOUR = 3600e3;

/* ---------------- client MCP ---------------- */

let rpcId = 0;

async function rpc(method, params) {
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
  });
  const text = await res.text();
  let payload;
  const dataLine = text.split("\n").find((l) => l.startsWith("data: "));
  payload = JSON.parse(dataLine ? dataLine.slice(6) : text);
  if (payload.error) throw new Error(payload.error.message);
  return payload.result;
}

function cacheGet(key, ttl) {
  try {
    const c = JSON.parse(localStorage.getItem(key));
    if (c && Date.now() - c.t < ttl) return c.v;
  } catch (_) {}
  return null;
}

function cachePut(key, v) {
  try {
    localStorage.setItem(key, JSON.stringify({ t: Date.now(), v }));
  } catch (_) {}
}

/** Chiama un tool MCP, ritorna le righe JSONL come array di oggetti. */
async function callTool(name, args, ttl = 6 * HOUR) {
  const key = `ipmcp:${name}:${JSON.stringify(args)}`;
  const hit = cacheGet(key, ttl);
  if (hit) return hit;
  const result = await rpc("tools/call", { name, arguments: args });
  const text = (result.content?.[0]?.text ?? "").trim();
  const rows = text
    ? text.split("\n").map((l) => { try { return JSON.parse(l); } catch (_) { return null; } }).filter(Boolean)
    : [];
  cachePut(key, rows);
  return rows;
}

async function listTools(ttl = 6 * HOUR) {
  const key = "ipmcp:tools/list";
  const hit = cacheGet(key, ttl);
  if (hit) return hit;
  const result = await rpc("tools/list", {});
  const tools = (result.tools ?? []).map((t) => ({ name: t.name, description: t.description ?? "" }));
  cachePut(key, tools);
  return tools;
}

/* ---------------- colori dei gruppi ---------------- */

const GROUPS = [
  [/fratelli d'italia|\(fdi\)/i, "#7fa3ff", "FdI"],
  [/partito democratico|pd-idp/i, "#ff8078", "PD-IDP"],
  [/lega/i, "#7fe0a8", "Lega"],
  [/forza italia/i, "#7fd4ff", "FI-PPE"],
  [/movimento 5|m5s/i, "#ffd166", "M5S"],
  [/verdi e sinistra|avs/i, "#c3f56c", "AVS"],
  [/azione|az-per/i, "#5fc9f0", "Az-PER-RE"],
  [/italia viva|iv-cr/i, "#f48fd0", "IV-CR"],
  [/noi moderati|civici d'italia|udc/i, "#a9e2ef", "NM-UDC"],
  [/autonomie|svp/i, "#c9b3ff", "Aut"],
  [/misto/i, "#98a2ae", "Misto"],
];

function groupColor(label) {
  for (const [re, c] of GROUPS) if (re.test(label)) return c;
  return "#d8d3c2";
}

function groupAcronym(label) {
  for (const [re, , short] of GROUPS) if (re.test(label)) return short;
  const m = label.match(/\(([^)]+)\)\s*$/);
  if (m) return m[1].split(",")[0].trim();
  return label.length > 22 ? label.slice(0, 20) + "…" : label;
}

/* ---------------- utility comuni ---------------- */

function titleCase(s) {
  return s.toLowerCase().replace(/(^|[\s'-])\p{L}/gu, (c) => c.toUpperCase());
}

function countUp(el, value) {
  const obj = { n: 0 };
  gsap.to(obj, {
    n: value, duration: 1.6, ease: "power2.out",
    onUpdate: () => (el.textContent = Math.round(obj.n)),
  });
}
