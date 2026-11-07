// ==UserScript==
// @name         MatchMind · Sisal Value Bets & Sync
// @namespace    https://sonostevecazzo.github.io/MatchMind/
// @version      1.3.0
// @description  Evidenzia le probabilità stimate del modello MatchMind e le scommesse consigliate direttamente su Sisal.
// @author       Simone Sedda & MatchMind
// @match        https://www.sisal.it/scommesse*
// @match        https://www.sisal.it/scommesse-matchpoint*
// @match        https://scommesse.sisal.it/*
// @icon         https://sonostevecazzo.github.io/MatchMind/icon.svg
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function() {
  'use strict';

  const MATCHMIND_URL = "https://sonostevecazzo.github.io/MatchMind/bets.html";

  // Alias squadre Serie A
  const TEAM_ALIASES = {
    inter: ["inter", "internazionale", "fc inter", "fc internazionale", "inter milan"],
    milan: ["milan", "ac milan", "acmilan"],
    juventus: ["juventus", "juve", "juventus fc"],
    roma: ["roma", "as roma"],
    lazio: ["lazio", "ss lazio"],
    napoli: ["napoli", "ssc napoli"],
    verona: ["verona", "hellas verona", "hellas"],
    atalanta: ["atalanta", "atalanta bc"],
    fiorentina: ["fiorentina", "acf fiorentina"],
    bologna: ["bologna", "bologna fc"],
    torino: ["torino", "toro", "torino fc"],
    monza: ["monza", "ac monza"],
    udinese: ["udinese", "udinese calcio"],
    lecce: ["lecce", "us lecce"],
    empoli: ["empoli", "empoli fc"],
    cagliari: ["cagliari", "cagliari calcio"],
    genoa: ["genoa", "genoa cfc"],
    parma: ["parma", "parma calcio"],
    como: ["como", "como 1907"],
    venezia: ["venezia", "venezia fc"]
  };

  // Parametri forza e stile squadre per modello probabilistico MatchMind
  const TEAM_RATINGS = {
    inter: { att: 1.95, def: 0.85, homeBoost: 0.15 },
    juventus: { att: 1.70, def: 0.80, homeBoost: 0.12 },
    milan: { att: 1.75, def: 1.05, homeBoost: 0.12 },
    napoli: { att: 1.70, def: 0.90, homeBoost: 0.15 },
    atalanta: { att: 1.90, def: 1.15, homeBoost: 0.15 },
    roma: { att: 1.55, def: 1.10, homeBoost: 0.14 },
    lazio: { att: 1.50, def: 1.10, homeBoost: 0.12 },
    fiorentina: { att: 1.45, def: 1.15, homeBoost: 0.10 },
    bologna: { att: 1.40, def: 1.05, homeBoost: 0.12 },
    torino: { att: 1.15, def: 1.10, homeBoost: 0.10 },
    udinese: { att: 1.15, def: 1.30, homeBoost: 0.10 },
    genoa: { att: 1.10, def: 1.25, homeBoost: 0.12 },
    parma: { att: 1.25, def: 1.45, homeBoost: 0.10 },
    como: { att: 1.20, def: 1.40, homeBoost: 0.08 },
    verona: { att: 1.05, def: 1.45, homeBoost: 0.10 },
    cagliari: { att: 1.05, def: 1.45, homeBoost: 0.12 },
    empoli: { att: 0.95, def: 1.35, homeBoost: 0.08 },
    lecce: { att: 0.90, def: 1.40, homeBoost: 0.10 },
    monza: { att: 1.00, def: 1.40, homeBoost: 0.08 },
    venezia: { att: 0.95, def: 1.55, homeBoost: 0.08 }
  };

  const norm = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

  function canonicalTeam(name) {
    const n = norm(name);
    for (const [canon, aliases] of Object.entries(TEAM_ALIASES)) {
      if (canon === n || aliases.some(a => norm(a) === n)) return canon;
    }
    const clean = String(name || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
    const words = clean.split(/\s+/).filter(w => !["fc", "ac", "ss", "as", "cfc", "bc", "1907", "calcio", "spa"].includes(w));
    for (const [canon, aliases] of Object.entries(TEAM_ALIASES)) {
      if (words.includes(canon) || aliases.some(a => words.includes(a))) return canon;
    }
    return n;
  }

  // Motore Poisson MatchMind (calcola matrice gol 0-7)
  function calculateMatchMindForecast(homeName, awayName) {
    const hKey = canonicalTeam(homeName);
    const aKey = canonicalTeam(awayName);

    const h = TEAM_RATINGS[hKey] || { att: 1.25, def: 1.25, homeBoost: 0.10 };
    const a = TEAM_RATINGS[aKey] || { att: 1.25, def: 1.25, homeBoost: 0.10 };

    const avgHome = 1.35;
    const avgAway = 1.10;

    const homeXg = Math.max(0.2, avgHome * (h.att / 1.30) * (a.def / 1.30) * 1.055 * (1 + h.homeBoost));
    const awayXg = Math.max(0.2, avgAway * (a.att / 1.30) * (h.def / 1.30) * (1 - a.homeBoost * 0.4));

    let pHome = 0, pDraw = 0, pAway = 0;
    let o15 = 0, u15 = 0, o25 = 0, u25 = 0, o35 = 0, u35 = 0;
    let bttsYes = 0, bttsNo = 0;

    function poisson(lambda, k) {
      if (lambda <= 0) return k === 0 ? 1 : 0;
      let p = Math.exp(-lambda);
      for (let i = 1; i <= k; i++) p *= lambda / i;
      return p;
    }

    for (let hg = 0; hg <= 7; hg++) {
      for (let ag = 0; ag <= 7; ag++) {
        const prob = poisson(homeXg, hg) * poisson(awayXg, ag);
        if (hg > ag) pHome += prob;
        else if (hg === ag) pDraw += prob;
        else pAway += prob;

        const tot = hg + ag;
        if (tot >= 2) o15 += prob; else u15 += prob;
        if (tot >= 3) o25 += prob; else u25 += prob;
        if (tot >= 4) o35 += prob; else u35 += prob;

        if (hg > 0 && ag > 0) bttsYes += prob;
        else bttsNo += prob;
      }
    }

    return {
      homeName,
      awayName,
      homeXg,
      awayXg,
      probabilities: {
        home: pHome,
        draw: pDraw,
        away: pAway,
        dc1X: pHome + pDraw,
        dcX2: pDraw + pAway,
        dc12: pHome + pAway,
        over15: o15,
        under15: u15,
        over25: o25,
        under25: u25,
        over35: o35,
        under35: u35,
        bttsYes: bttsYes,
        bttsNo: bttsNo
      }
    };
  }

  // Stili grafici
  const styles = `
    .mm-prob-tag {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      background: #081a2e !important;
      color: #38bdf8 !important;
      border: 1px solid #0284c7 !important;
      border-radius: 4px !important;
      padding: 1px 4px !important;
      font-size: 10px !important;
      font-weight: 800 !important;
      margin-top: 2px !important;
      line-height: 1.2 !important;
      pointer-events: none !important;
    }
    .mm-badge-recommended {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 3px !important;
      background: linear-gradient(135deg, #064e3b, #047857) !important;
      color: #34d399 !important;
      border: 1px solid #10b981 !important;
      border-radius: 4px !important;
      padding: 2px 5px !important;
      font-size: 10px !important;
      font-weight: 800 !important;
      margin-top: 2px !important;
      box-shadow: 0 0 8px rgba(16, 185, 129, 0.5) !important;
      animation: mmPulse 2s infinite ease-in-out !important;
      line-height: 1.2 !important;
      pointer-events: none !important;
    }
    .mm-highlight-btn {
      outline: 2px solid #10b981 !important;
      outline-offset: -2px !important;
      background-color: rgba(16, 185, 129, 0.08) !important;
    }
    @keyframes mmPulse {
      0%, 100% { box-shadow: 0 0 4px rgba(16, 185, 129, 0.3); }
      50% { box-shadow: 0 0 10px rgba(16, 185, 129, 0.7); }
    }
    .mm-send-btn {
      display: inline-flex !important;
      align-items: center !important;
      gap: 2px !important;
      background: #111e2e !important;
      color: #c4f36a !important;
      border: 1px solid #2f4960 !important;
      border-radius: 4px !important;
      padding: 1px 4px !important;
      font-size: 10px !important;
      font-weight: 700 !important;
      cursor: pointer !important;
      margin-top: 2px !important;
      transition: all 0.2s !important;
      text-decoration: none !important;
    }
    .mm-send-btn:hover {
      background: #1b2f46 !important;
      border-color: #c4f36a !important;
    }
    #mm-widget {
      position: fixed;
      bottom: 12px;
      right: 12px;
      z-index: 999999;
      background: #090d16;
      color: #e2e8f0;
      border: 1px solid #223249;
      border-radius: 12px;
      padding: 10px 12px;
      box-shadow: 0 6px 24px rgba(0,0,0,0.7);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-width: 290px;
      min-width: 230px;
    }
    #mm-widget-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 700;
      color: #c4f36a;
      border-bottom: 1px solid #1a2636;
      padding-bottom: 5px;
    }
    .mm-recom-box {
      background: #0f1a26;
      border: 1px solid #1e3a2e;
      border-left: 3px solid #10b981;
      border-radius: 6px;
      padding: 6px 8px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .mm-recom-title {
      font-size: 11px;
      color: #a7f3d0;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .mm-recom-prob {
      font-size: 13px;
      font-weight: 900;
      color: #34d399;
    }
    .mm-recom-meta {
      font-size: 10px;
      color: #94a3b8;
    }
    .mm-btn-action {
      background: #10b981;
      color: #022c22;
      border: none;
      border-radius: 6px;
      padding: 6px 8px;
      font-size: 11px;
      font-weight: 800;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      transition: background 0.15s;
    }
    .mm-btn-action:hover {
      background: #34d399;
    }
    .mm-btn-cart {
      background: #1e293b;
      color: #c4f36a;
      border: 1px solid #334155;
      border-radius: 6px;
      padding: 5px 8px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }
    .mm-btn-cart:hover {
      background: #334155;
    }
    .mm-table-toggle {
      background: none;
      border: none;
      color: #7dd3fc;
      font-size: 10px;
      cursor: pointer;
      padding: 2px 0;
      text-align: left;
      text-decoration: underline;
    }
    .mm-details-table {
      font-size: 10px;
      border-collapse: collapse;
      width: 100%;
      margin-top: 4px;
    }
    .mm-details-table td {
      padding: 2px 4px;
      border-bottom: 1px solid #1a2636;
    }
  `;

  if (typeof GM_addStyle === "function") {
    GM_addStyle(styles);
  } else {
    const styleEl = document.createElement("style");
    styleEl.textContent = styles;
    document.head?.appendChild(styleEl);
  }

  // Rileva squadre dalla pagina singola Sisal
  function detectSingleMatch() {
    // 1. Da document.title
    const titleMatch = document.title.match(/([A-Za-z0-9\s]{3,22})\s*[-–vsVS]+\s*([A-Za-z0-9\s]{3,22})/i);
    if (titleMatch) {
      let h = titleMatch[1].replace(/^(quote|scommesse|partita|live)\s+/i, "").trim();
      let a = titleMatch[2].replace(/\s+(scommesse|quote|sisal|calcio|serie).*$/i, "").trim();
      if (h.length >= 3 && a.length >= 3) return { home: h, away: a };
    }

    // 2. Da intestazioni o scoreboard
    const headEls = document.querySelectorAll("h1, h2, [class*='title'], [class*='match-name'], [class*='scoreboard'], [data-qa*='match']");
    for (const el of headEls) {
      const txt = (el.innerText || "").trim();
      const m = txt.match(/([A-Za-z0-9\s]{3,22})\s*[-–vsVS]+\s*([A-Za-z0-9\s]{3,22})/i);
      if (m) {
        return { home: m[1].trim(), away: m[2].trim() };
      }
    }

    // 3. Da elementi con competitor o team
    const teamEls = Array.from(document.querySelectorAll("[class*='competitor'], [class*='team-name'], [class*='teamName']"));
    if (teamEls.length >= 2) {
      const h = (teamEls[0].innerText || "").trim();
      const a = (teamEls[1].innerText || "").trim();
      if (h.length >= 3 && a.length >= 3 && h !== a) {
        return { home: h, away: a };
      }
    }

    return null;
  }

  function parseOddsValue(text) {
    const m = String(text || "").match(/\b(\d+[.,]\d{2})\b/);
    if (!m) return null;
    const v = Number(m[1].replace(",", "."));
    return Number.isFinite(v) && v > 1.01 && v <= 100 ? v : null;
  }

  // Invia a MatchMind via hash URL
  window.sendToMatchMind = function(event, home, away, marketKey, marketLabel, odds) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const payload = {
      bookmaker: "Sisal",
      home: home,
      away: away,
      marketKey: marketKey,
      marketLabel: marketLabel,
      odds: Number(odds),
      date: new Date().toISOString().slice(0, 10),
      timestamp: Date.now()
    };
    const targetUrl = MATCHMIND_URL + "#import=" + encodeURIComponent(JSON.stringify(payload));
    window.open(targetUrl, "_blank");
  };

  function sendCartToMatchMind() {
    const btn = document.getElementById("mm-send-cart-btn");
    const containers = document.querySelectorAll(`
      [class*="betslip"], [class*="coupon"], [class*="carrello"], [id*="betslip"],
      [class*="ticket"], [data-qa*="betslip"], [class*="drawer"], [class*="biglietto"]
    `);

    const items = [];
    const seen = new Set();

    containers.forEach(container => {
      const rows = container.querySelectorAll('[class*="item"], [class*="selection"], [class*="event"], [class*="row"], li');
      rows.forEach(row => {
        const text = row.innerText || "";
        const teamMatch = text.match(/([A-Za-z0-9\s]{3,20})\s*[-–vsVS]+\s*([A-Za-z0-9\s]{3,20})/);
        const oddVal = parseOddsValue(text);
        if (teamMatch && oddVal) {
          const home = teamMatch[1].trim();
          const away = teamMatch[2].trim();
          const key = canonicalTeam(home) + "|" + canonicalTeam(away);
          if (seen.has(key)) return;
          seen.add(key);

          const mInfo = parseSisalMarket(text) || { key: "auto", label: "Selezione" };
          items.push({
            home: home,
            away: away,
            marketKey: mInfo.key,
            marketLabel: mInfo.label,
            odds: oddVal,
            bookmaker: "Sisal"
          });
        }
      });
    });

    if (!items.length) {
      if (btn) {
        const orig = btn.innerHTML;
        btn.innerHTML = "⚠️ Biglietto vuoto o da aprire";
        setTimeout(() => { btn.innerHTML = orig; }, 2500);
      }
      return;
    }

    const payload = {
      bookmaker: "Sisal",
      selections: items,
      date: new Date().toISOString().slice(0, 10),
      timestamp: Date.now()
    };

    const targetUrl = MATCHMIND_URL + "#import=" + encodeURIComponent(JSON.stringify(payload));
    window.open(targetUrl, "_blank");

    if (btn) {
      const orig = btn.innerHTML;
      btn.innerHTML = `✅ Inviate ${items.length} giocate!`;
      setTimeout(() => { btn.innerHTML = orig; }, 3000);
    }
  }

  function parseSisalMarket(text) {
    const t = String(text || "").trim().toLowerCase();
    if (t === "1" || t.includes("esito finale 1")) return { key: "home", label: "1" };
    if (t === "x" || t.includes("esito finale x")) return { key: "draw", label: "X" };
    if (t === "2" || t.includes("esito finale 2")) return { key: "away", label: "2" };
    if (t === "1x") return { key: "dc1X", label: "1X" };
    if (t === "x2") return { key: "dcX2", label: "X2" };
    if (t === "12") return { key: "dc12", label: "12" };
    if (t.includes("over 2,5") || t.includes("over 2.5") || t === "over") return { key: "over25", label: "Over 2.5" };
    if (t.includes("under 2,5") || t.includes("under 2.5") || t === "under") return { key: "under25", label: "Under 2.5" };
    if (t.includes("over 1,5") || t.includes("over 1.5")) return { key: "over15", label: "Over 1.5" };
    if (t.includes("under 1,5") || t.includes("under 1.5")) return { key: "under15", label: "Under 1.5" };
    if (t === "goal" || t === "gol" || t.includes("entrambe")) return { key: "bttsYes", label: "Gol" };
    if (t === "nogoal" || t === "no goal" || t.includes("no segnano")) return { key: "bttsNo", label: "No Gol" };
    return null;
  }

  let currentAnalysis = null;
  let showDetailsTable = false;

  function renderWidget() {
    let widget = document.getElementById("mm-widget");
    if (!widget) {
      widget = document.createElement("div");
      widget.id = "mm-widget";
      document.body.appendChild(widget);
    }

    if (!currentAnalysis || !currentAnalysis.recommended) {
      widget.innerHTML = `
        <div id="mm-widget-head">
          <span>🧠 MatchMind</span>
          <small style="color:#34d399">● Attivo</small>
        </div>
        <div style="font-size:11px;color:#94a3b8;">Scansione quote Sisal in corso…</div>
        <button id="mm-send-cart-btn" class="mm-btn-cart">📥 Invia carrello Sisal</button>
        <div style="display:flex;justify-content:space-between;margin-top:2px;">
          <a href="${MATCHMIND_URL}" target="_blank" style="color:#7dd3fc;text-decoration:none;font-size:11px;">📋 MatchMind</a>
          <span style="color:#64748b;font-size:11px;cursor:pointer;" id="mm-rescan-btn">🔄 Scansiona</span>
        </div>
      `;
      document.getElementById("mm-send-cart-btn")?.addEventListener("click", sendCartToMatchMind);
      document.getElementById("mm-rescan-btn")?.addEventListener("click", scanPage);
      return;
    }

    const { home, away, recommended, calculations } = currentAnalysis;
    const recProbPct = (recommended.modelProb * 100).toFixed(0);
    const fairOddsStr = (1 / recommended.modelProb).toFixed(2);
    const evPct = (recommended.ev * 100).toFixed(1);

    let rowsHtml = "";
    if (showDetailsTable && calculations.length) {
      rowsHtml = `
        <table class="mm-details-table">
          <thead>
            <tr style="color:#64748b;text-align:left;">
              <th>Esito</th><th>Quota</th><th>Stima MM</th><th>EV</th>
            </tr>
          </thead>
          <tbody>
            ${calculations.slice(0, 7).map(c => {
              const p = (c.modelProb * 100).toFixed(0);
              const ev = (c.ev * 100).toFixed(0);
              const isRec = c === recommended;
              return `
                <tr style="${isRec ? 'color:#34d399;font-weight:700;' : ''}">
                  <td>${c.label}</td>
                  <td>${c.odd.toFixed(2)}</td>
                  <td>${p}%</td>
                  <td style="color:${c.ev > 0 ? '#34d399' : '#94a3b8'}">${ev > 0 ? '+' + ev : ev}%</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      `;
    }

    widget.innerHTML = `
      <div id="mm-widget-head">
        <span>🧠 MatchMind Stime</span>
        <small style="color:#34d399">● Analizzata</small>
      </div>
      <div style="font-size:11px;font-weight:700;color:#f8fafc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
        ⚽ ${home} - ${away}
      </div>
      <div class="mm-recom-box">
        <div class="mm-recom-title">
          <span>🏆 SCOMMESSA CONSIGLIATA</span>
          <span class="mm-recom-prob">${recProbPct}%</span>
        </div>
        <div style="font-size:12px;font-weight:800;color:#f1f5f9;">
          ${recommended.label} @ ${recommended.odd.toFixed(2)}
        </div>
        <div class="mm-recom-meta">
          Stima MatchMind: ${recProbPct}% · Quota equa: ${fairOddsStr}
          ${recommended.ev > 0 ? ` · <span style="color:#34d399;font-weight:700;">+${evPct}% EV</span>` : ''}
        </div>
      </div>
      <button id="mm-play-recom-btn" class="mm-btn-action">
        ⚡ Invia Consigliata a MatchMind
      </button>
      <button id="mm-send-cart-btn" class="mm-btn-cart">
        📥 Invia carrello Sisal
      </button>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
        <button id="mm-toggle-table" class="mm-table-toggle">
          ${showDetailsTable ? "Nascondi percentuali ▲" : "Tutte le probabilità MatchMind ▼"}
        </button>
        <span style="color:#64748b;font-size:10px;cursor:pointer;" id="mm-rescan-btn">🔄 Aggiorna</span>
      </div>
      ${rowsHtml}
    `;

    document.getElementById("mm-play-recom-btn")?.addEventListener("click", (e) => {
      window.sendToMatchMind(e, home, away, recommended.key, recommended.label, recommended.odd);
    });
    document.getElementById("mm-send-cart-btn")?.addEventListener("click", sendCartToMatchMind);
    document.getElementById("mm-rescan-btn")?.addEventListener("click", scanPage);
    document.getElementById("mm-toggle-table")?.addEventListener("click", () => {
      showDetailsTable = !showDetailsTable;
      renderWidget();
    });
  }

  function scanPage() {
    const singleMatch = detectSingleMatch();
    const homeName = singleMatch ? singleMatch.home : "Casa";
    const awayName = singleMatch ? singleMatch.away : "Ospite";

    // Calcolo delle probabilità statistiche MatchMind per la partita
    const forecast = calculateMatchMindForecast(homeName, awayName);
    const mmProbs = forecast.probabilities;

    // Raccogli bottoni quota di Sisal
    const oddButtons = Array.from(document.querySelectorAll("button, [role='button'], [class*='odd'], [class*='quota'], [class*='selection']")).filter(el => {
      if (el.closest("#mm-widget")) return false;
      const text = el.innerText || "";
      return /\b\d+[.,]\d{2}\b/.test(text) && text.length < 50;
    });

    if (!oddButtons.length) {
      renderWidget();
      return;
    }

    const calculations = [];

    oddButtons.forEach(btn => {
      const text = (btn.innerText || "").trim();
      const val = parseOddsValue(text);
      if (!val) return;

      let label = "";
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      for (const line of lines) {
        if (!/\b\d+[.,]\d{2}\b/.test(line)) {
          label = line;
          break;
        }
      }
      if (!label && lines.length) label = lines[0].replace(/\b\d+[.,]\d{2}\b/, "").trim();

      const contextText = (btn.closest("[class*='market'], [class*='group'], [class*='section']")?.innerText || "") + " " + label + " " + text;
      const market = parseSisalMarket(contextText);

      if (market && mmProbs[market.key]) {
        const prob = mmProbs[market.key];
        const fairOdds = 1 / prob;
        const ev = (prob * val) - 1;

        calculations.push({
          btn,
          odd: val,
          key: market.key,
          label: market.label,
          modelProb: prob,
          fairOdds,
          ev
        });
      }
    });

    if (!calculations.length) {
      renderWidget();
      return;
    }

    // Scelta della scommessa consigliata:
    // Privilegia la selezione con il miglior bilanciamento tra EV positivo e solidità probabilistica
    let topPick = null;
    let bestScore = -999;

    calculations.forEach(c => {
      // Score: probabilità + bonus per EV positivo
      let score = c.modelProb + (c.ev > 0 ? c.ev * 1.5 : c.ev * 0.5);
      if (c.odd >= 1.25 && c.odd <= 2.35) score += 0.15; // quota in range giocabile
      if (score > bestScore) {
        bestScore = score;
        topPick = c;
      }
    });

    currentAnalysis = {
      home: homeName,
      away: awayName,
      recommended: topPick,
      calculations: calculations.sort((a, b) => (b.modelProb || 0) - (a.modelProb || 0))
    };

    // Inietta i badge sui pulsanti Sisal
    calculations.forEach(c => {
      const btn = c.btn;
      if (!btn || btn.dataset.mmTagged) return;
      btn.dataset.mmTagged = "true";

      const pct = (c.modelProb * 100).toFixed(0);
      const isTop = c === topPick;

      if (isTop) {
        btn.classList.add("mm-highlight-btn");
        const badge = document.createElement("div");
        badge.className = "mm-badge-recommended";
        badge.innerHTML = `★ CONSIGLIATA ${pct}%`;
        btn.appendChild(badge);
      } else {
        const tag = document.createElement("div");
        tag.className = "mm-prob-tag";
        tag.textContent = `🧠 ${pct}%`;
        tag.title = `Stima MatchMind: ${pct}% · Quota equa: ${c.fairOdds.toFixed(2)}`;
        btn.appendChild(tag);
      }

      // Bottone rapido "⚡ MM"
      const sendBtn = document.createElement("button");
      sendBtn.type = "button";
      sendBtn.className = "mm-send-btn";
      sendBtn.innerHTML = "⚡ MM";
      sendBtn.title = `Invia ${c.label} (${pct}%) a MatchMind`;
      sendBtn.onclick = (e) => window.sendToMatchMind(e, homeName, awayName, c.key, c.label, c.odd);
      btn.appendChild(sendBtn);
    });

    renderWidget();
  }

  // Observer per aggiornamenti dinamici Single Page App Sisal
  let scanTimer = null;
  const observer = new MutationObserver((mutations) => {
    let shouldScan = false;
    for (const m of mutations) {
      if (m.addedNodes.length > 0) {
        let internal = false;
        for (const n of m.addedNodes) {
          if (n.id === "mm-widget" || (n.classList && (n.classList.contains("mm-prob-tag") || n.classList.contains("mm-badge-recommended") || n.classList.contains("mm-send-btn")))) {
            internal = true;
            break;
          }
        }
        if (!internal) {
          shouldScan = true;
          break;
        }
      }
    }
    if (shouldScan) {
      if (scanTimer) clearTimeout(scanTimer);
      scanTimer = setTimeout(scanPage, 400);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener("load", () => {
    setTimeout(scanPage, 1000);
  });
  setTimeout(scanPage, 1200);

})();
