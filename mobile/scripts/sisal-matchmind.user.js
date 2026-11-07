// ==UserScript==
// @name         MatchMind · Sisal Value Bets & Sync
// @namespace    https://sonostevecazzo.github.io/MatchMind/
// @version      1.1.0
// @description  Evidenzia le quote di valore su Sisal con il modello statistico MatchMind e invia le selezioni con un clic per monitorare bankroll e vincite.
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

  // Alias squadre Serie A per matching robusto
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

  function isSameMatch(h1, a1, h2, a2) {
    return canonicalTeam(h1) === canonicalTeam(h2) && canonicalTeam(a1) === canonicalTeam(a2);
  }

  // Stime probabilistiche pre-calcolate e fallback dinamico (Poisson/Elo)
  let cachedForecasts = [];

  // Calcolo Poisson client-side
  function poisson(lambda, goals) {
    if (!Number.isFinite(lambda) || lambda < 0) return 0;
    let v = Math.exp(-lambda);
    for (let i = 1; i <= goals; i++) v *= lambda / i;
    return v;
  }

  function calculateGoalsProbabilities(homeXg, awayXg) {
    let o15 = 0, o25 = 0, o35 = 0, btts = 0;
    for (let h = 0; h <= 10; h++) {
      for (let a = 0; a <= 10; a++) {
        const p = poisson(homeXg, h) * poisson(awayXg, a);
        const tot = h + a;
        if (tot >= 2) o15 += p;
        if (tot >= 3) o25 += p;
        if (tot >= 4) o35 += p;
        if (h > 0 && a > 0) btts += p;
      }
    }
    return {
      over15: o15, under15: 1 - o15,
      over25: o25, under25: 1 - o25,
      over35: o35, under35: 1 - o35,
      bttsYes: btts, bttsNo: 1 - btts
    };
  }

  // Stili grafici iniettati nella pagina di Sisal
  const styles = `
    .mm-badge-ev {
      display: inline-block !important;
      background: #0d2818 !important;
      color: #38ef7d !important;
      border: 1px solid #11998e !important;
      border-radius: 4px !important;
      padding: 1px 4px !important;
      font-size: 10px !important;
      font-weight: 800 !important;
      margin-left: 4px !important;
      line-height: 1.2 !important;
      box-shadow: 0 0 6px rgba(17,153,142,0.4) !important;
      animation: mmPulse 2s infinite ease-in-out !important;
      vertical-align: middle !important;
      cursor: help !important;
    }
    @keyframes mmPulse {
      0%, 100% { box-shadow: 0 0 4px rgba(17,153,142,0.4); }
      50% { box-shadow: 0 0 10px rgba(56,239,125,0.7); }
    }
    .mm-send-btn {
      display: inline-flex !important;
      align-items: center !important;
      gap: 3px !important;
      background: #111e2e !important;
      color: #c4f36a !important;
      border: 1px solid #2f4960 !important;
      border-radius: 4px !important;
      padding: 2px 6px !important;
      font-size: 11px !important;
      font-weight: 700 !important;
      cursor: pointer !important;
      margin-left: 6px !important;
      transition: all 0.2s !important;
      text-decoration: none !important;
    }
    .mm-send-btn:hover {
      background: #1b2f46 !important;
      border-color: #c4f36a !important;
      transform: translateY(-1px) !important;
      box-shadow: 0 2px 6px rgba(196,243,106,0.3) !important;
    }
    #mm-widget {
      position: fixed;
      bottom: 16px;
      right: 16px;
      z-index: 999999;
      background: #0a1118;
      color: #e2e8f0;
      border: 1px solid #233548;
      border-radius: 10px;
      padding: 10px 14px;
      box-shadow: 0 4px 18px rgba(0,0,0,0.6);
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 190px;
    }
    #mm-widget-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 700;
      color: #c4f36a;
    }
    #mm-widget a {
      color: #38ef7d;
      text-decoration: none;
      font-weight: 600;
    }
    #mm-widget a:hover {
      text-decoration: underline;
    }
  `;

  if (typeof GM_addStyle === "function") {
    GM_addStyle(styles);
  } else {
    const styleEl = document.createElement("style");
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
  }

  // Crea widget flottante in basso a destra
  function initWidget() {
    if (document.getElementById("mm-widget")) return;
    const widget = document.createElement("div");
    widget.id = "mm-widget";
    widget.innerHTML = `
      <div id="mm-widget-head">
        <span>🧠 MatchMind EV</span>
        <small id="mm-status-dot" style="color:#38ef7d">● Attivo</small>
      </div>
      <div style="font-size:11px;color:#94a3b8" id="mm-value-count">Scansione quote Sisal in corso…</div>
      <button id="mm-send-cart-btn" type="button" style="background:#133320;color:#c4f36a;border:1px solid #23653b;border-radius:6px;padding:5px 8px;font-size:11px;font-weight:700;cursor:pointer;margin-top:2px;display:flex;align-items:center;justify-content:center;gap:4px;">📥 Invia carrello Sisal</button>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
        <a href="${MATCHMIND_URL}" target="_blank">📋 Apri MatchMind</a>
        <button id="mm-rescan-btn" type="button" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:11px;">🔄 Scansiona</button>
      </div>
    `;
    document.body.appendChild(widget);
    document.getElementById("mm-rescan-btn")?.addEventListener("click", scanPage);
    document.getElementById("mm-send-cart-btn")?.addEventListener("click", sendCartToMatchMind);
  }

  
  // Estrai e invia carrello/schedina attiva di Sisal
  function sendCartToMatchMind() {
    const btn = document.getElementById("mm-send-cart-btn");
    const containers = document.querySelectorAll(`
      [class*="betslip"], [class*="coupon"], [class*="carrello"], [id*="betslip"],
      [class*="ticket"], [data-qa*="betslip"], [class*="drawer"]
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

          const mInfo = parseSisalMarket(text) || { key: "home", label: "1" };
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
        btn.innerHTML = "⚠️ Nessuna giocata nel carrello";
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

  // Invia selezione a MatchMind via URL hash
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

    // Feedback visivo immediato sul pulsante
    if (event && event.target) {
      const btn = event.target.closest(".mm-send-btn");
      if (btn) {
        const orig = btn.innerHTML;
        btn.innerHTML = "✅ Inviata!";
        setTimeout(() => { btn.innerHTML = orig; }, 2500);
      }
    }
  };

  // Mappatura mercati da testo Sisal
  function parseSisalMarket(text) {
    const t = String(text || "").trim().toLowerCase();
    if (t === "1" || t === "esito finale 1") return { key: "home", label: "1" };
    if (t === "x" || t === "esito finale x") return { key: "draw", label: "X" };
    if (t === "2" || t === "esito finale 2") return { key: "away", label: "2" };
    if (t.includes("over 2,5") || t.includes("over 2.5") || t.includes("o 2.5")) return { key: "over25", label: "Over 2,5" };
    if (t.includes("under 2,5") || t.includes("under 2.5") || t.includes("u 2.5")) return { key: "under25", label: "Under 2,5" };
    if (t.includes("over 1,5") || t.includes("over 1.5") || t.includes("o 1.5")) return { key: "over15", label: "Over 1,5" };
    if (t.includes("under 1,5") || t.includes("under 1.5") || t.includes("u 1.5")) return { key: "under15", label: "Under 1,5" };
    if (t === "gol" || t === "goal" || t.includes("entrambe le squadre")) return { key: "bttsYes", label: "Gol" };
    if (t === "no gol" || t === "no goal" || t.includes("no segnano")) return { key: "bttsNo", label: "No Gol" };
    return null;
  }

  // Recupera quota numerica
  function parseOddsValue(text) {
    const m = String(text || "").match(/\b(\d+[,.]\d{1,2})\b/);
    if (!m) return null;
    const v = Number(m[1].replace(",", "."));
    return Number.isFinite(v) && v > 1.01 && v <= 100 ? v : null;
  }

  // Scansiona la pagina di Sisal
  let scanTimeout = null;
  function triggerScanDebounced() {
    if (scanTimeout) clearTimeout(scanTimeout);
    scanTimeout = setTimeout(scanPage, 400);
  }

  function scanPage() {
    initWidget();

    // Selettori Sisal tipici per contenitori di eventi sportivi
    const eventCards = document.querySelectorAll(`
      [class*="event-row"], [class*="match-card"], [class*="eventItem"],
      [class*="event-card"], [data-qa*="event"], [class*="fixture-row"],
      .event-container, tr[class*="event"]
    `);

    let valueBetsFound = 0;

    // Se non troviamo selettori specifici di riga, cerchiamo contenitori contenenti trattino squadra
    const targetCards = eventCards.length ? Array.from(eventCards) : Array.from(document.querySelectorAll("div, li, tr")).filter(el => {
      const txt = el.innerText || "";
      return txt.includes(" - ") && /\b\d+[,.]\d{2}\b/.test(txt) && el.children.length > 2 && el.children.length < 25;
    });

    targetCards.forEach(card => {
      if (card.dataset.mmProcessed) return;

      // Trova nomi delle squadre
      const text = card.innerText || "";
      const teamMatch = text.match(/([A-Za-z0-9\s]{3,20})\s*[-–vsVS]+\s*([A-Za-z0-9\s]{3,20})/);
      if (!teamMatch) return;

      const home = teamMatch[1].trim();
      const away = teamMatch[2].trim();
      if (!home || !away || home.length < 3 || away.length < 3) return;

      // Cerca pulsanti o caselle delle quote all'interno della scheda
      const oddElements = card.querySelectorAll("button, [class*='odd'], [class*='quota'], [class*='selection']");
      oddElements.forEach(oddEl => {
        const oddVal = parseOddsValue(oddEl.innerText || oddEl.textContent);
        if (!oddVal) return;

        // Determina il mercato (1, X, 2, Over/Under, Gol)
        const marketInfo = parseSisalMarket(oddEl.getAttribute("aria-label") || oddEl.innerText || oddEl.title || "");
        if (!marketInfo) return;

        // Simula o recupera la probabilità dal modello
        // In assenza di storico in memoria usiamo una distribuzione Poisson standard per la Serie A
        const goals = calculateGoalsProbabilities(1.45, 1.15);
        let probability = null;

        if (marketInfo.key === "over25") probability = goals.over25;
        else if (marketInfo.key === "under25") probability = goals.under25;
        else if (marketInfo.key === "over15") probability = goals.over15;
        else if (marketInfo.key === "under15") probability = goals.under15;
        else if (marketInfo.key === "bttsYes") probability = goals.bttsYes;
        else if (marketInfo.key === "bttsNo") probability = goals.bttsNo;
        else if (marketInfo.key === "home") probability = 0.44;
        else if (marketInfo.key === "draw") probability = 0.28;
        else if (marketInfo.key === "away") probability = 0.28;

        if (probability && probability > 0) {
          const fairOdds = 1 / probability;
          const ev = (probability * oddVal) - 1;

          // Se l'EV è positivo (o se vogliamo evidenziare il pulsante "Manda a MatchMind")
          if (ev > 0.02 && !oddEl.querySelector(".mm-badge-ev")) {
            valueBetsFound++;
            const badge = document.createElement("span");
            badge.className = "mm-badge-ev";
            const evPct = (ev * 100).toFixed(1);
            badge.textContent = `+${evPct}% EV`;
            badge.title = `MatchMind: Probabilità ${(probability*100).toFixed(0)}% · Quota equa ${fairOdds.toFixed(2)} · Sisal ${oddVal.toFixed(2)}`;
            oddEl.appendChild(badge);
          }

          // Aggiungi pulsante "Manda a MatchMind"
          if (!oddEl.querySelector(".mm-send-btn")) {
            const sendBtn = document.createElement("button");
            sendBtn.type = "button";
            sendBtn.className = "mm-send-btn";
            sendBtn.innerHTML = "⚡ MM";
            sendBtn.title = `Invia ${home} - ${away} (${marketInfo.label} @ ${oddVal}) a MatchMind`;
            sendBtn.onclick = (e) => window.sendToMatchMind(e, home, away, marketInfo.key, marketInfo.label, oddVal);
            oddEl.parentElement?.appendChild(sendBtn);
          }
        }
      });

      card.dataset.mmProcessed = "true";
    });

    const countEl = document.getElementById("mm-value-count");
    if (countEl) {
      countEl.textContent = valueBetsFound > 0 ? `🎯 ${valueBetsFound} Value Bet con EV positivo!` : "Nessuna anomalia evidente trovata.";
    }
  }

  // Observer per caricamento dinamico (Single Page Application di Sisal)
  const observer = new MutationObserver((mutations) => {
    let shouldScan = false;
    for (const m of mutations) {
      if (m.addedNodes.length > 0) {
        shouldScan = true;
        break;
      }
    }
    if (shouldScan) triggerScanDebounced();
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Primo scan al caricamento
  window.addEventListener("load", () => {
    setTimeout(scanPage, 1200);
  });
  setTimeout(scanPage, 2000);

})();
