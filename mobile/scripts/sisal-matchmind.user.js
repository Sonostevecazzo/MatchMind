// ==UserScript==
// @name         MatchMind · Sisal Value Bets & Sync
// @namespace    https://sonostevecazzo.github.io/MatchMind/
// @version      1.4.0
// @description  Filtra le scommesse per probabilità desiderata (es. >=60%), widget trascinabile e riducibile a icona su Sisal.
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
      box-shadow: 0 8px 30px rgba(0,0,0,0.85);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 12px;
      display: flex;
      flex-direction: column;
      gap: 7px;
      max-width: 310px;
      min-width: 260px;
      touch-action: none;
      user-select: none;
    }
    #mm-widget.mm-is-minimized {
      min-width: unset !important;
      max-width: unset !important;
      padding: 6px 12px !important;
      border-radius: 24px !important;
      background: #090d16 !important;
      border: 1.5px solid #10b981 !important;
      cursor: pointer !important;
      box-shadow: 0 4px 16px rgba(0,0,0,0.7) !important;
    }
    #mm-widget-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 700;
      color: #c4f36a;
      border-bottom: 1px solid #1a2636;
      padding-bottom: 5px;
      cursor: grab;
    }
    #mm-widget-head:active {
      cursor: grabbing;
    }
    .mm-head-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .mm-icon-btn {
      background: transparent;
      border: 1px solid #334155;
      color: #94a3b8;
      border-radius: 4px;
      padding: 1px 6px;
      font-size: 11px;
      font-weight: bold;
      cursor: pointer;
      line-height: 1.2;
    }
    .mm-icon-btn:hover {
      background: #1e293b;
      color: #f1f5f9;
      border-color: #64748b;
    }
    .mm-filter-bar {
      display: flex;
      flex-direction: column;
      gap: 4px;
      background: #0f172a;
      padding: 6px 8px;
      border-radius: 6px;
      border: 1px solid #1e293b;
    }
    .mm-filter-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10.5px;
      font-weight: 600;
      color: #94a3b8;
    }
    .mm-chips-row {
      display: flex;
      gap: 4px;
      overflow-x: auto;
      padding-bottom: 2px;
    }
    .mm-chip {
      background: #1e293b;
      color: #94a3b8;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 2px 7px;
      font-size: 10px;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s;
    }
    .mm-chip.active {
      background: #059669;
      color: #ffffff;
      border-color: #10b981;
    }
    .mm-slider {
      width: 100%;
      accent-color: #10b981;
      height: 4px;
      cursor: pointer;
    }
    .mm-list-container {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-height: 180px;
      overflow-y: auto;
      padding-right: 2px;
    }
    .mm-list-container::-webkit-scrollbar {
      width: 4px;
    }
    .mm-list-container::-webkit-scrollbar-thumb {
      background: #334155;
      border-radius: 4px;
    }
    .mm-item-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #0f1a26;
      border: 1px solid #1e3a2e;
      border-radius: 6px;
      padding: 4px 6px;
      font-size: 11px;
    }
    .mm-item-row.is-top {
      border-left: 3px solid #10b981;
      background: #092019;
    }
    .mm-item-info {
      display: flex;
      flex-direction: column;
      gap: 1px;
      max-width: 160px;
      overflow: hidden;
    }
    .mm-item-name {
      font-weight: 700;
      color: #f1f5f9;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .mm-item-meta {
      font-size: 9.5px;
      color: #94a3b8;
    }
    .mm-item-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .mm-prob-badge {
      font-size: 12px;
      font-weight: 800;
      color: #34d399;
      background: #064e3b;
      padding: 2px 5px;
      border-radius: 4px;
      border: 1px solid #059669;
      white-space: nowrap;
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

  // Stato globale
  let currentAnalysis = null;
  let isMinimized = localStorage.getItem("mm_widget_minimized") === "true";
  let minProbThreshold = parseInt(localStorage.getItem("mm_min_prob") || "50", 10);
  if (isNaN(minProbThreshold)) minProbThreshold = 50;

  // Gestione Drag & Drop universale (Touch + Mouse)
  function initDraggable(widgetEl, handleEl) {
    let isDragging = false;
    let hasMoved = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    // Ripristina posizione salvata
    try {
      const savedPos = JSON.parse(localStorage.getItem("mm_widget_pos") || "null");
      if (savedPos && savedPos.left && savedPos.top) {
        widgetEl.style.bottom = "auto";
        widgetEl.style.right = "auto";
        widgetEl.style.left = savedPos.left;
        widgetEl.style.top = savedPos.top;
      }
    } catch(e) {}

    function onDragStart(clientX, clientY) {
      isDragging = true;
      hasMoved = false;
      const rect = widgetEl.getBoundingClientRect();
      startX = clientX;
      startY = clientY;
      initialLeft = rect.left;
      initialTop = rect.top;
      widgetEl.style.bottom = "auto";
      widgetEl.style.right = "auto";
      widgetEl.style.left = `${initialLeft}px`;
      widgetEl.style.top = `${initialTop}px`;
    }

    function onDragMove(clientX, clientY, e) {
      if (!isDragging) return;
      const dx = clientX - startX;
      const dy = clientY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasMoved = true;
      }
      let newLeft = initialLeft + dx;
      let newTop = initialTop + dy;

      const maxLeft = Math.max(10, window.innerWidth - widgetEl.offsetWidth - 6);
      const maxTop = Math.max(10, window.innerHeight - widgetEl.offsetHeight - 6);
      newLeft = Math.max(6, Math.min(newLeft, maxLeft));
      newTop = Math.max(6, Math.min(newTop, maxTop));

      widgetEl.style.left = `${newLeft}px`;
      widgetEl.style.top = `${newTop}px`;

      if (e && e.cancelable) {
        e.preventDefault();
      }
    }

    function onDragEnd() {
      if (!isDragging) return;
      isDragging = false;
      try {
        localStorage.setItem("mm_widget_pos", JSON.stringify({
          left: widgetEl.style.left,
          top: widgetEl.style.top
        }));
      } catch(err) {}
    }

    // Touch
    handleEl.addEventListener("touchstart", (e) => {
      if (e.target.closest("button, input, a")) return;
      if (e.touches.length === 1) {
        onDragStart(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: false });

    window.addEventListener("touchmove", (e) => {
      if (!isDragging || e.touches.length !== 1) return;
      onDragMove(e.touches[0].clientX, e.touches[0].clientY, e);
    }, { passive: false });

    window.addEventListener("touchend", onDragEnd);
    window.addEventListener("touchcancel", onDragEnd);

    // Mouse
    handleEl.addEventListener("mousedown", (e) => {
      if (e.target.closest("button, input, a")) return;
      onDragStart(e.clientX, e.clientY);

      const onMouseMove = (ev) => onDragMove(ev.clientX, ev.clientY, ev);
      const onMouseUp = () => {
        onDragEnd();
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    });

    return () => hasMoved;
  }

  function setThreshold(val) {
    minProbThreshold = Math.max(0, Math.min(100, Number(val)));
    localStorage.setItem("mm_min_prob", String(minProbThreshold));
    renderWidget();
    updatePageBadges();
  }

  function setMinimized(minimized) {
    isMinimized = Boolean(minimized);
    localStorage.setItem("mm_widget_minimized", String(isMinimized));
    renderWidget();
  }

  function renderWidget() {
    let widget = document.getElementById("mm-widget");
    if (!widget) {
      widget = document.createElement("div");
      widget.id = "mm-widget";
      document.body.appendChild(widget);
    }

    if (isMinimized) {
      widget.classList.add("mm-is-minimized");
      const matchCount = currentAnalysis && currentAnalysis.calculations
        ? currentAnalysis.calculations.filter(c => (c.modelProb * 100) >= minProbThreshold).length
        : 0;

      widget.innerHTML = `
        <div id="mm-widget-min-bar" style="display:flex;align-items:center;gap:8px;font-size:11px;font-weight:700;">
          <span style="color:#c4f36a;font-size:13px;">🧠 MM</span>
          <span class="mm-prob-badge" style="font-size:11px;padding:1px 6px;">${matchCount} quote ≥ ${minProbThreshold}%</span>
          <span style="color:#38bdf8;font-size:10px;text-decoration:underline;">Espandi ↗</span>
        </div>
      `;

      initDraggable(widget, widget);
      widget.onclick = (e) => {
        if (e.target.closest("button")) return;
        setMinimized(false);
      };
      return;
    }

    widget.classList.remove("mm-is-minimized");
    widget.onclick = null;

    if (!currentAnalysis || !currentAnalysis.calculations.length) {
      widget.innerHTML = `
        <div id="mm-widget-head">
          <span>🧠 MatchMind</span>
          <div class="mm-head-actions">
            <button id="mm-btn-minimize" class="mm-icon-btn" title="Riduci a icona">—</button>
          </div>
        </div>
        <div style="font-size:11px;color:#94a3b8;">Scansione quote Sisal in corso…</div>
        <button id="mm-send-cart-btn" class="mm-btn-cart">📥 Invia carrello Sisal</button>
        <div style="display:flex;justify-content:space-between;margin-top:2px;">
          <a href="${MATCHMIND_URL}" target="_blank" style="color:#7dd3fc;text-decoration:none;font-size:11px;">📋 Apri MatchMind</a>
          <span style="color:#64748b;font-size:11px;cursor:pointer;" id="mm-rescan-btn">🔄 Scansiona</span>
        </div>
      `;
      document.getElementById("mm-btn-minimize")?.addEventListener("click", () => setMinimized(true));
      document.getElementById("mm-send-cart-btn")?.addEventListener("click", sendCartToMatchMind);
      document.getElementById("mm-rescan-btn")?.addEventListener("click", scanPage);
      const headEl = document.getElementById("mm-widget-head");
      if (headEl) initDraggable(widget, headEl);
      return;
    }

    const { home, away, calculations } = currentAnalysis;
    const matching = calculations.filter(c => (c.modelProb * 100) >= minProbThreshold);

    const presets = [
      { label: "Tutte", val: 0 },
      { label: "≥40%", val: 40 },
      { label: "≥50%", val: 50 },
      { label: "≥60%", val: 60 },
      { label: "≥70%", val: 70 },
      { label: "≥80%", val: 80 }
    ];

    let itemsHtml = "";
    if (matching.length > 0) {
      itemsHtml = matching.map((c, idx) => {
        const pct = (c.modelProb * 100).toFixed(0);
        const ev = (c.ev * 100).toFixed(1);
        const isTop = idx === 0 && c.ev > 0;
        return `
          <div class="mm-item-row ${isTop ? 'is-top' : ''}">
            <div class="mm-item-info">
              <div class="mm-item-name">${c.label} @ ${c.odd.toFixed(2)}</div>
              <div class="mm-item-meta">
                Equa: ${c.fairOdds.toFixed(2)} · <span style="color:${c.ev > 0 ? '#34d399' : '#94a3b8'};font-weight:700;">${c.ev > 0 ? '+' + ev : ev}% EV</span>
              </div>
            </div>
            <div class="mm-item-actions">
              <span class="mm-prob-badge">${pct}%</span>
              <button class="mm-send-btn" title="Invia questa giocata a MatchMind" onclick="window.sendToMatchMind(event, '${home.replace(/'/g, "\'")}', '${away.replace(/'/g, "\'")}', '${c.key}', '${c.label}', ${c.odd})">
                ⚡ MM
              </button>
            </div>
          </div>
        `;
      }).join("");
    } else {
      itemsHtml = `
        <div style="font-size:11px;color:#94a3b8;padding:8px;text-align:center;background:#0f172a;border-radius:6px;">
          Nessuna quota con probabilità ≥ ${minProbThreshold}%.<br/>
          <span style="color:#38bdf8;cursor:pointer;font-weight:bold;" id="mm-reset-thresh">Abbassa a ≥ 50%</span>
        </div>
      `;
    }

    widget.innerHTML = `
      <div id="mm-widget-head">
        <span style="font-size:12px;">🧠 MatchMind · Filtro Probabilità</span>
        <div class="mm-head-actions">
          <button id="mm-btn-minimize" class="mm-icon-btn" title="Riduci a icona">—</button>
        </div>
      </div>

      <div style="font-size:11px;font-weight:700;color:#f8fafc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
        ⚽ ${home} - ${away}
      </div>

      <!-- Barra filtro percentuale -->
      <div class="mm-filter-bar">
        <div class="mm-filter-row">
          <span>Scegli probabilità desiderata:</span>
          <span style="color:#34d399;font-weight:800;font-size:12px;" id="mm-thresh-display">≥ ${minProbThreshold}%</span>
        </div>
        <div class="mm-chips-row">
          ${presets.map(p => `
            <button class="mm-chip ${minProbThreshold === p.val ? 'active' : ''}" data-val="${p.val}">
              ${p.label}
            </button>
          `).join("")}
        </div>
        <input type="range" class="mm-slider" id="mm-prob-slider" min="30" max="90" step="5" value="${minProbThreshold}">
      </div>

      <!-- Lista scommesse filtrate -->
      <div class="mm-list-container">
        ${itemsHtml}
      </div>

      <!-- Azioni carrello e matchmind -->
      <button id="mm-send-cart-btn" class="mm-btn-cart">
        📥 Invia carrello Sisal a MatchMind
      </button>

      <div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;">
        <a href="${MATCHMIND_URL}" target="_blank" style="color:#7dd3fc;text-decoration:none;">📋 Apri MatchMind</a>
        <span style="color:#64748b;cursor:pointer;" id="mm-rescan-btn">🔄 Aggiorna (${matching.length} trovate)</span>
      </div>
    `;

    // Eventi
    document.getElementById("mm-btn-minimize")?.addEventListener("click", () => setMinimized(true));
    document.getElementById("mm-send-cart-btn")?.addEventListener("click", sendCartToMatchMind);
    document.getElementById("mm-rescan-btn")?.addEventListener("click", scanPage);
    document.getElementById("mm-reset-thresh")?.addEventListener("click", () => setThreshold(50));

    const slider = document.getElementById("mm-prob-slider");
    if (slider) {
      slider.addEventListener("input", (e) => {
        const val = Number(e.target.value);
        document.getElementById("mm-thresh-display").textContent = `≥ ${val}%`;
      });
      slider.addEventListener("change", (e) => {
        setThreshold(Number(e.target.value));
      });
    }

    widget.querySelectorAll(".mm-chip").forEach(chip => {
      chip.addEventListener("click", (e) => {
        const val = Number(e.currentTarget.dataset.val);
        setThreshold(val);
      });
    });

    const headEl = document.getElementById("mm-widget-head");
    if (headEl) initDraggable(widget, headEl);
  }

  function updatePageBadges() {
    if (!currentAnalysis || !currentAnalysis.calculations) return;
    const { calculations, home, away } = currentAnalysis;

    calculations.forEach(c => {
      const btn = c.btn;
      if (!btn) return;

      const pct = Math.round(c.modelProb * 100);
      const meetsThreshold = pct >= minProbThreshold;

      // Se rispetta la soglia desiderata dall'utente, evidenzia il bottone Sisal
      if (meetsThreshold) {
        btn.classList.add("mm-highlight-btn");
      } else {
        btn.classList.remove("mm-highlight-btn");
      }

      // Aggiorna o crea il tag percentuale sul bottone
      let tag = btn.querySelector(".mm-prob-tag, .mm-badge-recommended");
      if (!tag) {
        tag = document.createElement("div");
        tag.className = "mm-prob-tag";
        btn.appendChild(tag);
      }

      if (meetsThreshold) {
        tag.className = "mm-badge-recommended";
        tag.innerHTML = `★ ${pct}%`;
      } else {
        tag.className = "mm-prob-tag";
        tag.innerHTML = `🧠 ${pct}%`;
      }
      tag.title = `Stima MatchMind: ${pct}% · Quota equa: ${c.fairOdds.toFixed(2)}`;

      // Assicurati che ci sia il bottone rapido "⚡ MM"
      if (!btn.querySelector(".mm-send-btn")) {
        const sendBtn = document.createElement("button");
        sendBtn.type = "button";
        sendBtn.className = "mm-send-btn";
        sendBtn.innerHTML = "⚡ MM";
        sendBtn.title = `Invia ${c.label} (${pct}%) a MatchMind`;
        sendBtn.onclick = (e) => window.sendToMatchMind(e, home, away, c.key, c.label, c.odd);
        btn.appendChild(sendBtn);
      }
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

    // Ordina per probabilità decrescente
    calculations.sort((a, b) => (b.modelProb || 0) - (a.modelProb || 0));

    currentAnalysis = {
      home: homeName,
      away: awayName,
      calculations
    };

    updatePageBadges();
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
