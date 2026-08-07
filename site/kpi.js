/* ================================================================
   italianparliament-mcp — pagina KPI
   Dati da snapshot statico (site/data/kpi.json), rigenerato a mano con
   scripts/generate-kpi-snapshot.mjs — non da GitHub Actions: gli
   endpoint SPARQL di Camera/Senato bloccano sistematicamente le
   richieste dai runner CI (v. commento in .github/workflows/ci.yml).
   Non serve interrogare il server MCP a ogni visita, la freschezza di
   questi indicatori è già a grana giornaliera nella fonte.
   Richiede shared.js (colori/sigle gruppi, titleCase, countUp).
   ================================================================ */

"use strict";

gsap.registerPlugin(ScrollTrigger);

const TOP_N = 5;

/** Nome del gruppo senza la sigla tra parentesi già mostrata a parte. */
function labelWithoutAcronym(label) {
  return titleCase(label.replace(/\s*\([^)]*\)\s*$/, "").trim());
}

/** Ridisegna la classifica (primi TOP_N) ordinata per il campo scelto, con legenda delle sigle mostrate. */
function renderRank(rows, listEl, legendEl, sortField) {
  const ranked = rows
    .filter((r) => r[sortField] !== null && r[sortField] !== undefined)
    .sort((a, b) => b[sortField] - a[sortField])
    .slice(0, TOP_N);

  const maxCount = Math.max(...ranked.map((r) => r.count || 0), 1);
  listEl.innerHTML = "";
  ranked.forEach((r, i) => {
    const color = groupColor(r.group_label);
    const li = document.createElement("li");
    li.className = "rank-item";
    li.innerHTML = `
      <span class="rank-pos">${i + 1}</span>
      <span class="rank-dot" style="background:${color}"></span>
      <span class="rank-name" title="${r.group_label}">${groupAcronym(r.group_label)}</span>
      <span class="rank-bar-track"><span class="rank-bar-fill" data-w="${Math.round((r.count / maxCount) * 100)}" style="background:${color}"></span></span>
      <span class="rank-count">${r.count}</span>
      <span class="rank-per">${r.count_per_member ?? "—"}/membro</span>`;
    listEl.appendChild(li);
  });

  gsap.from(listEl.children, { autoAlpha: 0, x: 16, stagger: 0.06, duration: 0.5, ease: "power2.out" });
  listEl.querySelectorAll(".rank-bar-fill").forEach((el) => {
    gsap.to(el, { width: el.dataset.w + "%", duration: 0.9, ease: "power3.out" });
  });

  legendEl.innerHTML = ranked
    .map((r) => `<b>${groupAcronym(r.group_label)}</b> ${labelWithoutAcronym(r.group_label)}`)
    .join(" &nbsp;·&nbsp; ");
}

/**
 * Monta una card KPI dai dati già nello snapshot: un totale + tutti i
 * gruppi (non solo i primi N — un gruppo piccolo ma molto attivo può
 * avere un tasso "per membro" altissimo pur non entrando nel top N per
 * conteggio grezzo, va cercato su tutto il campione). Il toggle
 * totale/per-membro riordina e ridisegna, nessuna nuova richiesta.
 */
function mountKpiCard(card, { totalElId, rankElId, legendElId, toggleElId }) {
  countUp(document.getElementById(totalElId), card.total);

  const listEl = document.getElementById(rankElId);
  const legendEl = document.getElementById(legendElId);
  const toggleEl = document.getElementById(toggleElId);
  renderRank(card.rank, listEl, legendEl, "count");

  toggleEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-sort]");
    if (!btn || btn.classList.contains("active")) return;
    toggleEl.querySelectorAll("button").forEach((b) => {
      b.classList.toggle("active", b === btn);
      b.setAttribute("aria-selected", b === btn ? "true" : "false");
    });
    renderRank(card.rank, listEl, legendEl, btn.dataset.sort);
  });
}

const KPI_CARDS = [
  { key: "bills", totalElId: "c-bills", rankElId: "bills-rank", legendElId: "bills-legend", toggleElId: "bills-toggle", fallbackElId: "bills-fallback" },
  { key: "aic", totalElId: "c-aic", rankElId: "aic-rank", legendElId: "aic-legend", toggleElId: "aic-toggle", fallbackElId: "aic-fallback" },
];

/* ---------------- rappresentanza di genere ---------------- */

function mountGenderCard(card) {
  const grid = document.getElementById("gender-grid");
  const chambers = [
    { name: "Camera", ...card.camera },
    { name: "Senato", ...card.senato },
  ];
  grid.innerHTML = "";
  for (const c of chambers) {
    const pct = Math.round((c.female / c.total) * 1000) / 10;
    const div = document.createElement("div");
    div.className = "gender-card";
    div.innerHTML = `
      <div class="gc-chamber">${c.name}</div>
      <div class="gc-pct">${pct}%</div>
      <div class="gc-bar"><span class="gc-bar-fill" data-w="${pct}"></span></div>
      <div class="gc-detail">${c.female} donne su ${c.total}</div>`;
    grid.appendChild(div);
  }
  gsap.from(grid.children, { autoAlpha: 0, y: 20, stagger: 0.1, duration: 0.6, ease: "power2.out" });
  grid.querySelectorAll(".gc-bar-fill").forEach((el) => {
    gsap.to(el, { width: el.dataset.w + "%", duration: 1, ease: "power3.out" });
  });
}

/* ---------------- presenza in aula ---------------- */

function mountAttendanceCard(card) {
  const wrap = document.getElementById("attendance-wrap");
  const div = document.createElement("div");
  div.className = "attendance-card";
  div.innerHTML = `
    <div class="ac-pct">${card.avgPresentPct}%</div>
    <div class="ac-cap">presenti in media alle votazioni · ${card.avgPresent} su ${card.seats} seggi</div>
    <div class="ac-bar"><span class="ac-bar-fill" data-w="${card.avgPresentPct}"></span></div>
    <div class="ac-range">min ${card.minPresent} · max ${card.maxPresent} · campione: ${card.sampleSize} votazioni più recenti</div>`;
  wrap.appendChild(div);
  gsap.from(div, { autoAlpha: 0, y: 20, duration: 0.7, ease: "power2.out" });
  wrap.querySelectorAll(".ac-bar-fill").forEach((el) => {
    gsap.to(el, { width: el.dataset.w + "%", duration: 1.1, ease: "power3.out" });
  });
}

/* ---------------- audizioni per commissione ---------------- */

function mountCommitteeCard(card) {
  countUp(document.getElementById("c-committees"), card.total);
  const listEl = document.getElementById("committees-rank");
  const ranked = card.rank.slice(0, TOP_N);
  const maxCount = Math.max(...ranked.map((r) => r.count || 0), 1);
  listEl.innerHTML = "";
  ranked.forEach((r, i) => {
    const li = document.createElement("li");
    li.className = "rank-item";
    li.innerHTML = `
      <span class="rank-pos">${i + 1}</span>
      <span class="rank-name">${r.committee}</span>
      <span class="rank-count">${r.count}</span>`;
    listEl.appendChild(li);
  });
  gsap.from(listEl.children, { autoAlpha: 0, x: 16, stagger: 0.08, duration: 0.6, ease: "power2.out" });
}

/* ---------------- orchestrazione ---------------- */

async function main() {
  gsap.from(".kpi-hero > *", { autoAlpha: 0, y: 30, stagger: 0.1, duration: 0.8, ease: "power3.out" });

  let snapshot;
  try {
    const res = await fetch("data/kpi.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    snapshot = await res.json();
  } catch (e) {
    console.warn("[italianparliament] kpi snapshot", e);
    KPI_CARDS.forEach((c) => (document.getElementById(c.fallbackElId).hidden = false));
    document.getElementById("gender-fallback").hidden = false;
    document.getElementById("attendance-fallback").hidden = false;
    document.getElementById("committees-fallback").hidden = false;
    snapshot = null;
  }

  if (snapshot) {
    KPI_CARDS.forEach((c) => mountKpiCard(snapshot.cards[c.key], c));
    mountGenderCard(snapshot.cards.gender);
    mountAttendanceCard(snapshot.cards.attendance);
    mountCommitteeCard(snapshot.cards.committees);
    ScrollTrigger.refresh();
    const updatedDate = new Date(snapshot.generatedAt).toLocaleDateString("it-IT");
    document.getElementById("kpi-updated").textContent = `● dati aggiornati ${updatedDate}`;
    document.getElementById("footer-meta").textContent =
      `snapshot statico, rigenerato a mano · legislatura ${snapshot.legislature}`;
  } else {
    document.getElementById("kpi-updated").textContent = "○ snapshot non raggiungibile";
    document.getElementById("footer-meta").textContent = "snapshot dati non raggiungibile in questo momento";
  }
}

main();
