/* ================================================================
   italianparliament-mcp — pagina viva
   Tutti i dati arrivano in tempo reale dal server MCP su Cloudflare.
   ================================================================ */

"use strict";

gsap.registerPlugin(ScrollTrigger);

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

/* ---------------- il cielo ---------------- */

const sky = {
  canvas: document.getElementById("sky"),
  ctx: null,
  stars: [],        // {x,y,r,phase,color,name,group,chamber}
  lines: [],        // [{x1,y1,x2,y2,color}]
  labels: [],       // {x,y,text,color}
  alpha: 0,         // rampa d'ingresso, animata da GSAP
  reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
  raw: null,        // dati grezzi per il re-layout al resize
};

function mulberry(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function layoutSky() {
  if (!sky.raw) return;
  const { canvas } = sky;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const W = canvas.clientWidth, H = canvas.clientHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  sky.ctx = canvas.getContext("2d");
  sky.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  sky.stars = []; sky.lines = []; sky.labels = [];
  const rand = mulberry(19480101);
  const portrait = H > W * 1.15;

  // zona proibita: il blocco di testo dell'hero
  const copy = document.querySelector(".hero-copy");
  const fb = {
    x0: copy.offsetLeft - 24, y0: copy.offsetTop - 24,
    x1: copy.offsetLeft + copy.offsetWidth + 12, y1: copy.offsetTop + copy.offsetHeight + 24,
  };
  const inForbid = (x, y) => x > fb.x0 && x < fb.x1 && y > fb.y0 && y < fb.y1;

  // area utile: lascia respiro al testo in basso
  const top = H * 0.06;
  const bottom = portrait ? Math.max(top + 120, fb.y0 - 16) : H * 0.72;
  const zones = portrait
    ? { camera: [0.04 * W, 0.96 * W, top, top + (bottom - top) * 0.52], senato: [0.04 * W, 0.96 * W, top + (bottom - top) * 0.6, bottom] }
    : { camera: [0.03 * W, 0.56 * W, top, bottom], senato: [0.62 * W, 0.97 * W, top, bottom] };
  const tiny = bottom - top < 340 || W < 560; // poco cielo: niente etichette, cluster stretti

  for (const [chamber, members] of Object.entries(sky.raw)) {
    const [x0, x1, y0, y1] = zones[chamber];
    const zw = x1 - x0, zh = y1 - y0;

    // gruppi ordinati per dimensione
    const byGroup = new Map();
    for (const m of members) {
      if (!byGroup.has(m.group)) byGroup.set(m.group, []);
      byGroup.get(m.group).push(m);
    }
    const groups = [...byGroup.entries()].sort((a, b) => b[1].length - a[1].length);

    // centri dei gruppi su spirale ad angolo aureo
    const cx = x0 + zw / 2, cy = y0 + zh / 2;
    const maxR = Math.min(zw, zh) * 0.46;
    groups.forEach(([label, list], gi) => {
      const t = groups.length === 1 ? 0 : gi / (groups.length - 1);
      const color = groupColor(label);
      const spread = (Math.sqrt(list.length) * Math.min(zw, zh) * 0.018 + 14) * (tiny ? 0.65 : 1);

      // centro del gruppo fuori dalla zona di testo, con retry
      let gx, gy, tries = 0;
      do {
        const ang = gi * 2.39996 + rand() * (tries ? 6.28 : 0.5);
        const dist = maxR * Math.sqrt(t) * (0.55 + 0.45 * rand());
        gx = cx + Math.cos(ang) * dist * (zw > zh ? 1 : 0.7);
        gy = cy + Math.sin(ang) * dist * (zh > zw ? 1 : 0.75);
      } while (++tries < 24 && (inForbid(gx, gy) || inForbid(gx - spread, gy + spread) || inForbid(gx + spread, gy + spread)));
      if (tries >= 24) gy = Math.max(top + spread, fb.y0 - spread - 12);

      const pts = list.map((m) => {
        // scatter gaussiano approssimato, mai dentro la zona di testo
        let x, y, st = 0;
        do {
          const a = rand() * Math.PI * 2;
          const r = spread * Math.sqrt(-2 * Math.log(1 - rand() * 0.999)) * 0.55;
          x = Math.min(x1, Math.max(x0, gx + Math.cos(a) * r));
          y = Math.min(y1, Math.max(y0, gy + Math.sin(a) * r * 0.8));
        } while (++st < 10 && inForbid(x, y));
        if (inForbid(x, y)) y = Math.max(top, fb.y0 - 6 - rand() * 24);
        const star = {
          x, y,
          r: 0.7 + rand() * 1.3,
          phase: rand() * Math.PI * 2,
          speed: 0.4 + rand() * 1.1,
          color,
          name: m.name, group: label, chamber,
        };
        sky.stars.push(star);
        return star;
      });

      // linee di costellazione: percorso greedy tra le stelle "principali"
      const main = pts.filter((_, i) => i % Math.ceil(pts.length / Math.min(8, pts.length)) === 0).slice(0, 8);
      const rest = [...main];
      let cur = rest.shift();
      while (rest.length) {
        let bi = 0, bd = Infinity;
        rest.forEach((p, i) => {
          const d = (p.x - cur.x) ** 2 + (p.y - cur.y) ** 2;
          if (d < bd) { bd = d; bi = i; }
        });
        const nxt = rest.splice(bi, 1)[0];
        sky.lines.push({ x1: cur.x, y1: cur.y, x2: nxt.x, y2: nxt.y, color });
        cur = nxt;
      }

      if (!tiny) sky.labels.push({ x: gx, y: gy - spread - 10, text: groupAcronym(label), color });
    });

    // intestazione emisfero
    if (!tiny) sky.labels.push({
      x: x0 + zw / 2, y: y0 - 2,
      text: chamber === "camera" ? "· CAMERA ·" : "· SENATO ·",
      color: "rgba(201,168,76,0.9)", header: true,
    });
  }
}

function drawSky(time) {
  const { ctx, canvas } = sky;
  if (!ctx) return;
  const W = canvas.clientWidth, H = canvas.clientHeight;
  ctx.clearRect(0, 0, W, H);
  const A = sky.alpha;
  if (A <= 0) return;

  // linee di costellazione
  ctx.lineWidth = 0.6;
  for (const l of sky.lines) {
    ctx.strokeStyle = l.color;
    ctx.globalAlpha = 0.16 * A;
    ctx.beginPath();
    ctx.moveTo(l.x1, l.y1);
    ctx.lineTo(l.x2, l.y2);
    ctx.stroke();
  }

  // stelle
  const t = time / 1000;
  for (const s of sky.stars) {
    const tw = sky.reduced ? 0.85 : 0.62 + 0.38 * Math.sin(t * s.speed + s.phase);
    ctx.globalAlpha = tw * A;
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
    if (s.r > 1.6) {
      ctx.globalAlpha = tw * A * 0.25;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // etichette
  for (const lb of sky.labels) {
    ctx.globalAlpha = (lb.header ? 0.75 : 0.55) * A;
    ctx.fillStyle = lb.color;
    ctx.font = lb.header
      ? "600 10px 'IBM Plex Mono', monospace"
      : "500 9px 'IBM Plex Mono', monospace";
    ctx.textAlign = "center";
    ctx.letterSpacing = "2px";
    ctx.fillText(lb.text, lb.x, lb.y);
  }
  ctx.globalAlpha = 1;
}

function skyLoop(time) {
  if (document.visibilityState === "visible") drawSky(time);
  if (sky.reduced && sky.alpha >= 1) { drawSky(time); return; } // fermo: un solo frame
  requestAnimationFrame(skyLoop);
}

/* tooltip: stella più vicina al puntatore */
function initSkyTooltip() {
  const tip = document.getElementById("sky-tooltip");
  sky.canvas.addEventListener("pointermove", (e) => {
    const rect = sky.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    let best = null, bd = 14 * 14;
    for (const s of sky.stars) {
      const d = (s.x - mx) ** 2 + (s.y - my) ** 2;
      if (d < bd) { bd = d; best = s; }
    }
    if (best) {
      tip.hidden = false;
      tip.innerHTML = `<span class="tt-chamber">${best.chamber}</span><br>${best.name}<br><span class="tt-group">${best.group}</span>`;
      tip.style.left = Math.min(e.clientX + 14, innerWidth - 280) + "px";
      tip.style.top = e.clientY + 14 + "px";
    } else {
      tip.hidden = true;
    }
  });
  sky.canvas.addEventListener("pointerleave", () => (tip.hidden = true));
}

/* ---------------- caricamento cielo + contatori ---------------- */

function latestMembership(rows, keyField) {
  const byPerson = new Map();
  for (const r of rows) {
    const k = r[keyField];
    const prev = byPerson.get(k);
    const better = !prev
      || (!r.end_date && prev.end_date)
      || (!!r.end_date === !!prev.end_date && (r.start_date || "") > (prev.start_date || ""));
    if (better) byPerson.set(k, r);
  }
  return [...byPerson.values()];
}

function countUp(el, value) {
  const obj = { n: 0 };
  gsap.to(obj, {
    n: value, duration: 1.6, ease: "power2.out",
    onUpdate: () => (el.textContent = Math.round(obj.n)),
  });
}

async function loadSky() {
  const [cam, sen] = await Promise.all([
    callTool("group-members", { legislature: 19, limit: 1000 }),
    callTool("senator-group-members", { legislature: 19, limit: 1000 }),
  ]);

  const deputies = latestMembership(cam, "deputy_uri")
    .filter((r) => !r.end_date)
    .map((r) => ({ name: r.deputy_name, group: r.group_label }));
  const senators = latestMembership(sen, "senator_uri")
    .filter((r) => !r.end_date)
    .map((r) => ({ name: r.senator_name, group: r.group_label }));

  sky.raw = { camera: deputies, senato: senators };
  layoutSky();
  requestAnimationFrame(skyLoop);
  initSkyTooltip();
  gsap.to(sky, { alpha: 1, duration: sky.reduced ? 0 : 2.4, ease: "power2.inOut" });

  // contatori
  countUp(document.getElementById("c-deputati"), deputies.length);
  countUp(document.getElementById("c-senatori"), senators.length);
  const allGroups = new Set([...deputies, ...senators].map((m) => m.group));
  countUp(document.getElementById("c-gruppi"), allGroups.size);

  // legenda (gruppi Camera per dimensione)
  const legend = document.getElementById("sky-legend");
  const sizes = new Map();
  for (const d of deputies) sizes.set(d.group, (sizes.get(d.group) || 0) + 1);
  [...sizes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([g, n]) => {
    const div = document.createElement("div");
    div.className = "lg-item";
    div.innerHTML = `<span class="lg-dot" style="background:${groupColor(g)}"></span>${groupAcronym(g)} · ${n}`;
    legend.appendChild(div);
  });
  gsap.from(legend.children, { autoAlpha: 0, x: 12, stagger: 0.07, duration: 0.5, delay: 0.8 });

  return { deputies, senators };
}

/* ---------------- la strada delle legislature ---------------- */

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
  "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX",
  "XXI", "XXII", "XXIII", "XXIV", "XXV", "XXVI", "XXVII", "XXVIII", "XXIX", "XXX"];

function legInfo(row) {
  const uri = row.uri || "";
  const years = (row.date || "").split("-").map((d) => d.slice(0, 4)).filter(Boolean);
  const span = years.length === 2 ? `${years[0]}–${years[1]}` : `${years[0] || "?"} → oggi`;
  let m;
  if ((m = uri.match(/regno_(\d+)/))) return { era: "Regno d'Italia", num: ROMAN[+m[1]], span, ord: +m[1] };
  if (uri.includes("consulta")) return { era: "Transizione", num: "Consulta nazionale", span, ord: 100 };
  if (uri.includes("costituente")) return { era: "Transizione", num: "Assemblea Costituente", span, ord: 101 };
  if ((m = uri.match(/repubblica_(\d+)/))) return { era: "Repubblica", num: ROMAN[+m[1]], span, ord: 200 + +m[1] };
  return { era: "Altro", num: row.label || "?", span, ord: 999 };
}

async function loadRoad() {
  const rows = await callTool("legislatures", { chamber: "camera" }, 24 * HOUR);
  const legs = rows.map(legInfo).sort((a, b) => a.ord - b.ord);
  const wrap = document.getElementById("road-wrap");

  const W = 900, STEP = 92, PAD = 60;
  const H = legs.length * STEP + PAD * 2;
  const amp = 190, cx = W / 2;

  // percorso a serpentina
  let d = `M ${cx} ${PAD}`;
  const anchors = [];
  legs.forEach((_, i) => {
    const y = PAD + (i + 0.5) * STEP;
    const x = cx + Math.sin(i * 0.55) * amp;
    anchors.push([x, y]);
  });
  anchors.forEach(([x, y], i) => {
    const [px, py] = i === 0 ? [cx, PAD] : anchors[i - 1];
    const my = (py + y) / 2;
    d += ` C ${px} ${my}, ${x} ${my}, ${x} ${y}`;
  });

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("class", "road-svg");

  const bed = document.createElementNS(svgNS, "path");
  bed.setAttribute("d", d);
  bed.setAttribute("fill", "none");
  bed.setAttribute("class", "road-bed");
  bed.setAttribute("stroke-width", "10");
  bed.setAttribute("stroke-linecap", "round");
  svg.appendChild(bed);

  const line = document.createElementNS(svgNS, "path");
  line.setAttribute("d", d);
  line.setAttribute("fill", "none");
  line.setAttribute("class", "road-line");
  line.setAttribute("stroke-width", "2");
  line.setAttribute("stroke-dasharray", "8 7");
  line.setAttribute("pathLength", "1000");
  svg.appendChild(line);

  let lastEra = "";
  legs.forEach((leg, i) => {
    const [x, y] = anchors[i];

    if (leg.era !== lastEra) {
      lastEra = leg.era;
      const era = document.createElementNS(svgNS, "text");
      era.setAttribute("x", cx);
      era.setAttribute("y", y - STEP * 0.62);
      era.setAttribute("text-anchor", "middle");
      era.setAttribute("class", "road-era");
      era.setAttribute("fill", "#c9a84c");
      era.setAttribute("style", "font: italic 500 30px Fraunces, serif; opacity:.9");
      era.textContent = leg.era;
      svg.appendChild(era);
    }

    const g = document.createElementNS(svgNS, "g");
    g.setAttribute("class", "road-stop");

    const dot = document.createElementNS(svgNS, "circle");
    dot.setAttribute("cx", x); dot.setAttribute("cy", y);
    dot.setAttribute("r", i === legs.length - 1 ? 7 : 4);
    dot.setAttribute("fill", i === legs.length - 1 ? "#e8cf8a" : "#0a1020");
    dot.setAttribute("stroke", "#c9a84c");
    dot.setAttribute("stroke-width", "1.5");
    g.appendChild(dot);

    const side = x < cx ? -1 : 1;
    const label = document.createElementNS(svgNS, "text");
    label.setAttribute("x", x + side * 18);
    label.setAttribute("y", y - 2);
    label.setAttribute("text-anchor", side < 0 ? "end" : "start");
    label.setAttribute("fill", "#e8cf8a");
    label.setAttribute("style", "font: 600 13px 'IBM Plex Mono', monospace");
    label.textContent = leg.num;
    g.appendChild(label);

    const years = document.createElementNS(svgNS, "text");
    years.setAttribute("x", x + side * 18);
    years.setAttribute("y", y + 14);
    years.setAttribute("text-anchor", side < 0 ? "end" : "start");
    years.setAttribute("fill", "#8f8d82");
    years.setAttribute("style", "font: 400 11px 'IBM Plex Mono', monospace");
    years.textContent = leg.span;
    g.appendChild(years);

    if (i === legs.length - 1) {
      const now = document.createElementNS(svgNS, "text");
      now.setAttribute("x", x + side * 18);
      now.setAttribute("y", y + 30);
      now.setAttribute("text-anchor", side < 0 ? "end" : "start");
      now.setAttribute("fill", "#6fd695");
      now.setAttribute("style", "font: 600 11px 'IBM Plex Mono', monospace");
      now.textContent = "● in corso";
      g.appendChild(now);
    }

    svg.appendChild(g);
  });

  wrap.appendChild(svg);

  // animazioni: la linea si disegna con lo scroll, le tappe affiorano
  if (!sky.reduced) {
    const len = 1000;
    gsap.fromTo(line,
      { strokeDashoffset: len, strokeDasharray: `${len} ${len}` },
      {
        strokeDashoffset: 0, ease: "none",
        scrollTrigger: { trigger: wrap, start: "top 75%", end: "bottom 65%", scrub: 0.8 },
      });
    svg.querySelectorAll(".road-stop, .road-era").forEach((el) => {
      gsap.from(el, {
        autoAlpha: 0, y: 18, duration: 0.6, ease: "power2.out",
        scrollTrigger: { trigger: el, start: "top 88%" },
      });
    });
  }
}

/* ---------------- votazioni recenti ---------------- */

const MONTHS = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

function fmtDate(yyyymmdd) {
  if (!yyyymmdd || yyyymmdd.length < 8) return yyyymmdd || "";
  return `${+yyyymmdd.slice(6, 8)} ${MONTHS[+yyyymmdd.slice(4, 6) - 1]} ${yyyymmdd.slice(0, 4)}`;
}

const VOTE_KINDS = { MOZ: "Mozione", RIS: "Risoluzione", ODG: "OdG", DDL: "Ddl", PDL: "Pdl", EM: "Emendamento", DOC: "Doc." };

function voteTitle(desc) {
  return (desc || "Votazione").replace(/^([A-Z]+)\b/, (m) => VOTE_KINDS[m] || m);
}

async function loadVotes() {
  const from = new Date(Date.now() - 60 * 86400e3).toISOString().slice(0, 10);
  const rows = await callTool("votes", { dateFrom: from, limit: 9 }, 1 * HOUR);
  const grid = document.getElementById("votes-grid");
  if (!rows.length) {
    document.getElementById("votes-fallback").hidden = false;
    return;
  }

  for (const v of rows) {
    const present = Math.max(1, +v.present || (+v.in_favour + +v.against + +v.abstentions));
    const ok = v.approved === "true";
    const card = document.createElement("article");
    card.className = "vote-card";
    card.innerHTML = `
      <div class="vote-date"><span>${fmtDate(v.date)} · Camera</span><span class="vote-badge ${ok ? "ok" : "no"}">${ok ? "approvata" : "respinta"}</span></div>
      <h3 class="vote-title"><a href="${v.url}" target="_blank" rel="noopener">${voteTitle(v.description || v.title)}</a></h3>
      <div class="vote-bars">
        ${[["f", "sì", v.in_favour], ["c", "no", v.against], ["a", "ast", v.abstentions]].map(([cls, lab, n]) => `
          <div class="vote-bar ${cls}">
            <span>${lab}</span>
            <span class="bar-track"><span class="bar-fill" data-w="${Math.round((+n / present) * 100)}"></span></span>
            <span class="bar-n">${n || 0}</span>
          </div>`).join("")}
      </div>`;
    grid.appendChild(card);
  }

  gsap.from(grid.children, {
    autoAlpha: 0, y: 26, stagger: 0.08, duration: 0.7, ease: "power2.out",
    scrollTrigger: { trigger: grid, start: "top 80%" },
  });
  grid.querySelectorAll(".bar-fill").forEach((el) => {
    gsap.to(el, {
      width: el.dataset.w + "%", duration: 1.1, ease: "power3.out",
      scrollTrigger: { trigger: el.closest(".vote-card"), start: "top 85%" },
    });
  });
}

/* ---------------- griglia strumenti ---------------- */

const FAMILIES = [
  ["Camera + Senato", /^\[CAMERA[+/]SENATO\]/],
  ["Camera", /^\[CAMERA\]/],
  ["Senato", /^\[SENATO\]/],
];

async function loadTools() {
  const tools = await listTools();
  countUp(document.getElementById("c-tools"), tools.length);

  const buckets = new Map(FAMILIES.map(([n]) => [n, []]));
  buckets.set("Trasversali", []);
  for (const t of tools) {
    const fam = FAMILIES.find(([, re]) => re.test(t.description))?.[0] ?? "Trasversali";
    buckets.get(fam).push(t);
  }

  const container = document.getElementById("tools-groups");
  for (const [fam, list] of buckets) {
    if (!list.length) continue;
    const div = document.createElement("div");
    div.className = "tool-family";
    div.innerHTML = `<h3 class="tf-name">${fam} <span class="tf-count">${list.length}</span></h3>`;
    const grid = document.createElement("div");
    grid.className = "tool-grid";
    for (const t of list.sort((a, b) => a.name.localeCompare(b.name))) {
      const desc = t.description.replace(/^\[[^\]]+\]\s*/, "").split(/\s*Examples?:/)[0];
      const chip = document.createElement("div");
      chip.className = "tool-chip";
      chip.innerHTML = `<div class="tc-name">${t.name}</div><div class="tc-desc">${desc}</div>`;
      grid.appendChild(chip);
    }
    div.appendChild(grid);
    container.appendChild(div);

    gsap.from(grid.children, {
      autoAlpha: 0, y: 18, stagger: { each: 0.04, from: "start" }, duration: 0.5, ease: "power2.out",
      scrollTrigger: { trigger: grid, start: "top 85%" },
    });
  }
}

/* ---------------- terminale ---------------- */

const TERM_SCRIPT = [
  { text: "$ ", cls: "prompt" },
  { text: "italianparliament search find --name schlein", type: true },
  { text: "\n", cls: "" },
  { text: 'name,chamber,uri\n"SCHLEIN ELLY",camera,…/deputato.rdf/d307621_19\n', cls: "dim" },
  { text: "$ ", cls: "prompt" },
  { text: "italianparliament votes list --date-from 2026-06-01", type: true },
  { text: "\n", cls: "" },
  { text: "date,description,in_favour,against,approved\n20260630,MOZ 1-586,9,261,false\n…", cls: "dim" },
];

function initTerminal() {
  const body = document.getElementById("term-body");
  const caret = document.createElement("span");
  caret.className = "caret";
  body.appendChild(caret);

  let played = false;
  ScrollTrigger.create({
    trigger: "#terminal", start: "top 85%",
    onEnter: () => {
      if (played) return;
      played = true;
      let chain = Promise.resolve();
      for (const step of TERM_SCRIPT) {
        chain = chain.then(() => new Promise((done) => {
          const span = document.createElement("span");
          if (step.cls) span.className = step.cls;
          body.insertBefore(span, caret);
          if (!step.type || sky.reduced) {
            span.textContent = step.text;
            setTimeout(done, sky.reduced ? 0 : 260);
          } else {
            let i = 0;
            const iv = setInterval(() => {
              span.textContent = step.text.slice(0, ++i);
              if (i >= step.text.length) { clearInterval(iv); setTimeout(done, 320); }
            }, 26);
          }
        }));
      }
    },
  });
}

/* ---------------- orchestrazione ---------------- */

function revealSections() {
  document.querySelectorAll(".section-head").forEach((el) => {
    gsap.from(el.children, {
      autoAlpha: 0, y: 30, stagger: 0.12, duration: 0.8, ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 82%" },
    });
  });
  gsap.from(".use-card", {
    autoAlpha: 0, y: 30, stagger: 0.14, duration: 0.7, ease: "power2.out",
    scrollTrigger: { trigger: ".use-grid", start: "top 80%" },
  });
}

async function main() {
  // intro del testo hero
  gsap.from(".hero-copy > *", { autoAlpha: 0, y: 34, stagger: 0.11, duration: 0.9, ease: "power3.out", delay: 0.15 });
  revealSections();
  initTerminal();
  addEventListener("resize", () => { layoutSky(); });

  const dot = document.getElementById("live-dot");
  const label = document.getElementById("live-label");

  const results = await Promise.allSettled([
    loadSky(),
    loadTools(),
    loadRoad(),
    loadVotes(),
  ]);

  const failures = results.filter((r) => r.status === "rejected");
  failures.forEach((f) => console.warn("[italianparliament]", f.reason));

  // il contenuto asincrono ha spostato il layout: ricalcola i trigger
  ScrollTrigger.refresh();

  if (results[0].status === "fulfilled") {
    dot.classList.add("on");
    label.textContent = "dati live · Camera + Senato · aggiornati adesso";
  } else {
    label.textContent = "endpoint momentaneamente non raggiungibile";
  }
  if (results[2].status === "rejected") document.getElementById("road-fallback").hidden = false;
  if (results[3].status === "rejected") document.getElementById("votes-fallback").hidden = false;

  document.getElementById("footer-meta").textContent =
    `pagina generata nel browser · ${new Date().toLocaleString("it-IT")} · nessun dato precotto: ogni visita interroga il server MCP`;
}

main();
