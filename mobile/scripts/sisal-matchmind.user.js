// ==UserScript==
// @name         MatchMind · Sisal Value Bets & Sync
// @namespace    https://sonostevecazzo.github.io/MatchMind/
// @version      1.5.0
// @description  Analisi probabilistica MatchMind su Sisal: strategie (Accuratezza, +EV, Bilanciate), motivazioni analitiche, quote eque, widget mobile trascinabile e sincronizzazione schedina.
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

  // Alias squadre (Serie A, Serie B, Coppe Europee)
  const TEAM_ALIASES = {
    // Serie A
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
    venezia: ["venezia", "venezia fc"],
    // Serie B principali
    sassuolo: ["sassuolo", "us sassuolo"],
    palermo: ["palermo", "palermo fc"],
    sampdoria: ["sampdoria", "samp", "uc sampdoria"],
    cremonese: ["cremonese", "us cremonese"],
    pisa: ["pisa", "pisa sc"],
    spezia: ["spezia", "spezia calcio"],
    bari: ["bari", "sscalcio bari", "ssc bari"],
    frosinone: ["frosinone", "frosinone calcio"],
    brescia: ["brescia", "brescia calcio"],
    salernitana: ["salernitana", "us salernitana"],
    cesena: ["cesena", "cesena fc"],
    catanzaro: ["catanzaro", "us catanzaro"],
    reggiana: ["reggiana", "ac reggiana"],
    modena: ["modena", "modena fc"],
    sudtirol: ["sudtirol", "fc sudtirol", "suedtirol"],
    // Top UEFA Champions / Europa
    realmadrid: ["real madrid", "real", "madrid"],
    mancity: ["manchester city", "man city", "city"],
    bayern: ["bayern monaco", "bayern munich", "bayern", "fc bayern"],
    psg: ["paris saint germain", "paris sg", "psg", "paris"],
    arsenal: ["arsenal", "arsenal fc"],
    liverpool: ["liverpool", "liverpool fc"],
    barcelona: ["barcellona", "barcelona", "fc barcelona", "barca"],
    leverkusen: ["bayer leverkusen", "leverkusen", "bayer 04"],
    atleticomadrid: ["atletico madrid", "atletico", "atl madrid"],
    dortmund: ["borussia dortmund", "dortmund", "bvb"],
    astonvilla: ["aston villa", "villa"],
    benfica: ["benfica", "sl benfica"],
    sporting: ["sporting lisbona", "sporting cp", "sporting"],
    chelsea: ["chelsea", "chelsea fc"],
    tottenham: ["tottenham", "spurs", "tottenham hotspur"],
    manunited: ["manchester united", "man utd", "united"]
  };

  // Parametri offensivi/difensivi stimati (xG basati su stagione 2026/2027)
  const TEAM_RATINGS = {
    // Serie A
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
    venezia: { att: 0.95, def: 1.55, homeBoost: 0.08 },
    // Serie B
    sassuolo: { att: 1.40, def: 1.10, homeBoost: 0.12 },
    pisa: { att: 1.30, def: 1.05, homeBoost: 0.12 },
    spezia: { att: 1.25, def: 1.00, homeBoost: 0.12 },
    cremonese: { att: 1.30, def: 1.15, homeBoost: 0.12 },
    palermo: { att: 1.25, def: 1.20, homeBoost: 0.14 },
    sampdoria: { att: 1.20, def: 1.20, homeBoost: 0.12 },
    cesena: { att: 1.25, def: 1.25, homeBoost: 0.10 },
    bari: { att: 1.10, def: 1.15, homeBoost: 0.12 },
    frosinone: { att: 1.15, def: 1.25, homeBoost: 0.10 },
    brescia: { att: 1.10, def: 1.20, homeBoost: 0.10 },
    catanzaro: { att: 1.15, def: 1.25, homeBoost: 0.10 },
    salernitana: { att: 1.10, def: 1.30, homeBoost: 0.10 },
    // Top UEFA
    mancity: { att: 2.30, def: 0.80, homeBoost: 0.16 },
    realmadrid: { att: 2.25, def: 0.85, homeBoost: 0.16 },
    bayern: { att: 2.20, def: 0.90, homeBoost: 0.15 },
    barcelona: { att: 2.15, def: 0.95, homeBoost: 0.15 },
    liverpool: { att: 2.15, def: 0.90, homeBoost: 0.15 },
    arsenal: { att: 2.05, def: 0.80, homeBoost: 0.15 },
    psg: { att: 2.00, def: 0.95, homeBoost: 0.15 },
    leverkusen: { att: 1.95, def: 1.00, homeBoost: 0.14 },
    atleticomadrid: { att: 1.75, def: 0.85, homeBoost: 0.14 },
    dortmund: { att: 1.85, def: 1.15, homeBoost: 0.14 },
    chelsea: { att: 1.75, def: 1.10, homeBoost: 0.12 },
    tottenham: { att: 1.80, def: 1.25, homeBoost: 0.12 },
    sporting: { att: 1.85, def: 1.00, homeBoost: 0.12 },
    benfica: { att: 1.70, def: 1.05, homeBoost: 0.12 }
  };

  const norm = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

  function canonicalTeam(name) {
    const n = norm(name);
    for (const [canon, aliases] of Object.entries(TEAM_ALIASES)) {
      if (canon === n || aliases.some(a => norm(a) === n)) return canon;
    }
    const clean = String(name || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
    const words = clean.split(/\s+/).filter(w => !["fc", "ac", "ss", "as", "cfc", "bc", "1907", "calcio", "spa", "sc", "us", "uc"].includes(w));
    for (const [canon, aliases] of Object.entries(TEAM_ALIASES)) {
      if (words.includes(canon) || aliases.some(a => words.includes(a))) return canon;
    }
    return n;
  }

  // Cache dei calcoli Poisson per evitare ricalcoli inutili
  const forecastCache = new Map();

  function poisson(lambda, k) {
    if (lambda <= 0) return k === 0 ? 1 : 0;
    let p = Math.exp(-lambda);
    for (let i = 1; i <= k; i++) p *= lambda / i;
    return p;
  }

  // Motore Poisson MatchMind (matrice gol 0-7)
  function calculateMatchMindForecast(homeName, awayName) {
    const hKey = canonicalTeam(homeName);
    const aKey = canonicalTeam(awayName);
    const memoKey = `${hKey}|${aKey}`;

    if (forecastCache.has(memoKey)) {
      return forecastCache.get(memoKey);
    }

    const h = TEAM_RATINGS[hKey] || { att: 1.20, def: 1.20, homeBoost: 0.10 };
    const a = TEAM_RATINGS[aKey] || { att: 1.20, def: 1.20, homeBoost: 0.10 };

    const avgHome = 1.35;
    const avgAway = 1.10;

    const homeXg = Math.max(0.2, avgHome * (h.att / 1.25) * (a.def / 1.25) * 1.05 * (1 + h.homeBoost));
    const awayXg = Math.max(0.2, avgAway * (a.att / 1.25) * (h.def / 1.25) * (1 - a.homeBoost * 0.35));

    let pHome = 0, pDraw = 0, pAway = 0;
    let o15 = 0, u15 = 0, o25 = 0, u25 = 0, o35 = 0, u35 = 0;
    let bttsYes = 0, bttsNo = 0;

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

    const result = {
      homeName,
      awayName,
      homeXg,
      awayXg,
      probabilities: {
        home: pHome,
        draw: pDraw,
        away: pAway,
        dc1X: Math.min(0.99, pHome + pDraw),
        dcX2: Math.min(0.99, pDraw + pAway),
        dc12: Math.min(0.99, pHome + pAway),
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

    forecastCache.set(memoKey, result);
    return result;
  }

  // Generatore di motivazione analitica
  function generateMotivation(home, away, marketKey, marketLabel, prob, odd, fairOdds, ev, homeXg, awayXg) {
    const totXg = (homeXg + awayXg).toFixed(1);
    const pPct = Math.round(prob * 100);
    const evText = ev > 0 ? ` (+${(ev * 100).toFixed(1)}% EV)` : (ev < -0.05 ? ` (${(ev * 100).toFixed(1)}% EV)` : '');

    switch (marketKey) {
      case "home":
        return `${home} solida nel fattore campo (${homeXg.toFixed(1)} xG previsti vs ${awayXg.toFixed(1)}). MatchMind stima il ${pPct}% per vittoria interna${evText}.`;
      case "away":
        return `${away} favorita con ${awayXg.toFixed(1)} xG attesi fuori casa. Modello stima successo ospite al ${pPct}% (quota equa ${fairOdds.toFixed(2)}${evText}).`;
      case "draw":
        return `Elevato equilibrio tattico tra ${home} e ${away} (${homeXg.toFixed(1)} vs ${awayXg.toFixed(1)} xG). Pareggio stimato al ${pPct}%.`;
      case "dc1X":
        return `Doppia chance protettiva per ${home}: probabilità combinata del ${pPct}% basata sulla tenuta interna.`;
      case "dcX2":
        return `Copertura favorevole a ${away} (X2 al ${pPct}%): potenziale ospite superiore alla lavagna bookmaker.`;
      case "dc12":
        return `Gara con basso tasso di pareggio atteso: il modello stima il ${pPct}% di esito decisivo.`;
      case "over25":
      case "over15":
      case "over35":
        return `Indice offensivo congiunto elevato (${totXg} xG previsti). Poisson calcola il ${pPct}% per ${marketLabel}${evText}.`;
      case "under25":
      case "under15":
      case "under35":
        return `Solidità difensiva e volume di occasioni limitato (${totXg} xG previsti). Stima ${marketLabel} al ${pPct}%.`;
      case "bttsYes":
        return `Regolarità realizzativa per entrambe (${homeXg.toFixed(1)} e ${awayXg.toFixed(1)} xG). Esito Gol stimato al ${pPct}%.`;
      case "bttsNo":
        return `Almeno una squadra presenta difficoltà realizzative. Stima No Gol solida al ${pPct}%.`;
      default:
        return `Stima statistica MatchMind: ${pPct}% (quota equa ${fairOdds.toFixed(2)})${evText}.`;
    }
  }

  // Stili grafici avanzati
  const styles = `
    .mm-prob-tag {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      background: #081a2e !important;
      color: #38bdf8 !important;
      border: 1px solid #0284c7 !important;
      border-radius: 4px !important;
      font-size: 10px !important;
      font-weight: 800 !important;
      padding: 1px 4px !important;
      margin-left: 3px !important;
      line-height: 1.2 !important;
      vertical-align: middle !important;
      pointer-events: none !important;
      box-shadow: 0 1px 3px rgba(0,0,0,0.4) !important;
    }

    .mm-badge-recommended {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      background: #064e3b !important;
      color: #34d399 !important;
      border: 1px solid #10b981 !important;
      border-radius: 4px !important;
      font-size: 10px !important;
      font-weight: 900 !important;
      padding: 1px 5px !important;
      margin-left: 3px !important;
      line-height: 1.2 !important;
      vertical-align: middle !important;
      pointer-events: none !important;
      box-shadow: 0 1px 4px rgba(16,185,129,0.4) !important;
    }

    .mm-highlight-btn {
      outline: 2px solid #10b981 !important;
      outline-offset: -1px !important;
      background: rgba(16,185,129,0.12) !important;
    }

    .mm-send-btn {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      background: #0284c7 !important;
      color: #ffffff !important;
      border: none !important;
      border-radius: 4px !important;
      font-size: 9px !important;
      font-weight: 800 !important;
      padding: 2px 5px !important;
      margin-left: 4px !important;
      cursor: pointer !important;
      vertical-align: middle !important;
      pointer-events: auto !important;
      transition: background 0.15s ease !important;
    }
    .mm-send-btn:hover {
      background: #0369a1 !important;
    }

    #mm-widget {
      position: fixed !important;
      bottom: 12px !important;
      right: 12px !important;
      z-index: 999999 !important;
      background: #0b1324 !important;
      color: #e2e8f0 !important;
      border: 1px solid #1e293b !important;
      border-radius: 12px !important;
      box-shadow: 0 8px 30px rgba(0,0,0,0.85), 0 0 0 1px rgba(56,189,248,0.2) !important;
      width: 320px !important;
      max-width: calc(100vw - 20px) !important;
      max-height: 82vh !important;
      display: flex !important;
      flex-direction: column !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      font-size: 11px !important;
      padding: 10px !important;
      gap: 7px !important;
      touch-action: none;
      box-sizing: border-box !important;
      backdrop-filter: blur(10px) !important;
    }

    #mm-widget.mm-is-minimized {
      width: auto !important;
      max-width: calc(100vw - 24px) !important;
      padding: 6px 12px !important;
      border-radius: 24px !important;
      background: #081a2e !important;
      border: 1px solid #0284c7 !important;
      cursor: pointer !important;
      box-shadow: 0 4px 16px rgba(2,132,199,0.5) !important;
    }

    #mm-widget-head {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      font-weight: 800 !important;
      color: #38bdf8 !important;
      cursor: move !important;
      padding-bottom: 5px !important;
      border-bottom: 1px solid #1e293b !important;
      user-select: none !important;
    }

    .mm-head-actions {
      display: flex !important;
      align-items: center !important;
      gap: 6px !important;
    }

    .mm-icon-btn {
      background: #1e293b !important;
      color: #94a3b8 !important;
      border: none !important;
      border-radius: 4px !important;
      width: 22px !important;
      height: 22px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-size: 12px !important;
      font-weight: bold !important;
      cursor: pointer !important;
      padding: 0 !important;
    }
    .mm-icon-btn:hover {
      background: #334155 !important;
      color: #ffffff !important;
    }

    .mm-strategy-tabs {
      display: grid !important;
      grid-template-columns: repeat(4, 1fr) !important;
      gap: 3px !important;
      background: #0f172a !important;
      padding: 3px !important;
      border-radius: 8px !important;
      border: 1px solid #1e293b !important;
    }

    .mm-strat-tab {
      background: transparent !important;
      color: #94a3b8 !important;
      border: none !important;
      border-radius: 5px !important;
      padding: 4px 2px !important;
      font-size: 9px !important;
      font-weight: 700 !important;
      text-align: center !important;
      cursor: pointer !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      transition: all 0.15s ease !important;
    }
    .mm-strat-tab.active {
      background: #0284c7 !important;
      color: #ffffff !important;
      box-shadow: 0 1px 4px rgba(2,132,199,0.4) !important;
    }
    .mm-strat-tab.active.strat-value {
      background: #059669 !important;
    }

    .mm-filter-bar {
      background: #0f172a !important;
      border: 1px solid #1e293b !important;
      border-radius: 8px !important;
      padding: 6px !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 4px !important;
    }

    .mm-filter-row {
      display: flex !important;
      justify-content: space-between !important;
      align-items: center !important;
      font-size: 10px !important;
      color: #94a3b8 !important;
    }

    .mm-chips-row {
      display: flex !important;
      gap: 3px !important;
      overflow-x: auto !important;
      padding-bottom: 2px !important;
    }

    .mm-chip {
      background: #1e293b !important;
      color: #cbd5e1 !important;
      border: 1px solid #334155 !important;
      border-radius: 12px !important;
      font-size: 9px !important;
      padding: 2px 6px !important;
      cursor: pointer !important;
      white-space: nowrap !important;
    }
    .mm-chip.active {
      background: #0284c7 !important;
      border-color: #38bdf8 !important;
      color: #ffffff !important;
      font-weight: bold !important;
    }

    .mm-slider {
      width: 100% !important;
      height: 4px !important;
      border-radius: 2px !important;
      background: #1e293b !important;
      outline: none !important;
      cursor: pointer !important;
      accent-color: #38bdf8 !important;
      margin: 2px 0 !important;
    }

    .mm-list-container {
      display: flex !important;
      flex-direction: column !important;
      gap: 5px !important;
      overflow-y: auto !important;
      max-height: 280px !important;
      padding-right: 2px !important;
      touch-action: pan-y !important;
    }

    .mm-item-card {
      background: #111e38 !important;
      border: 1px solid #1e293b !important;
      border-radius: 7px !important;
      padding: 6px 8px !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 3px !important;
      transition: border-color 0.15s ease !important;
    }
    .mm-item-card.is-top {
      border-color: #10b981 !important;
      background: #0c2522 !important;
    }

    .mm-card-head {
      display: flex !important;
      justify-content: space-between !important;
      align-items: center !important;
    }

    .mm-item-title {
      font-weight: 700 !important;
      color: #f1f5f9 !important;
      font-size: 11px !important;
    }

    .mm-item-match {
      font-size: 9px !important;
      color: #94a3b8 !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      max-width: 180px !important;
    }

    .mm-card-actions {
      display: flex !important;
      align-items: center !important;
      gap: 4px !important;
    }

    .mm-prob-badge {
      background: #0284c7 !important;
      color: #ffffff !important;
      border-radius: 4px !important;
      font-size: 10px !important;
      font-weight: 800 !important;
      padding: 1px 5px !important;
    }
    .mm-prob-badge.is-value {
      background: #059669 !important;
    }

    .mm-card-metrics {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      font-size: 10px !important;
      color: #94a3b8 !important;
    }

    .mm-card-reason {
      font-size: 9px !important;
      color: #cbd5e1 !important;
      background: rgba(15,23,42,0.6) !important;
      border-radius: 4px !important;
      padding: 3px 5px !important;
      line-height: 1.25 !important;
      border-left: 2px solid #0284c7 !important;
    }
    .mm-item-card.is-top .mm-card-reason {
      border-left-color: #10b981 !important;
    }

    .mm-btn-cart {
      background: #10b981 !important;
      color: #022c22 !important;
      border: none !important;
      border-radius: 6px !important;
      font-weight: 800 !important;
      font-size: 10px !important;
      padding: 6px 10px !important;
      cursor: pointer !important;
      text-align: center !important;
      transition: background 0.15s ease !important;
      box-shadow: 0 2px 6px rgba(16,185,129,0.3) !important;
    }
    .mm-btn-cart:hover {
      background: #34d399 !important;
    }

    .mm-btn-combo {
      background: #0284c7 !important;
      color: #ffffff !important;
      border: none !important;
      border-radius: 6px !important;
      font-weight: 800 !important;
      font-size: 10px !important;
      padding: 5px 10px !important;
      cursor: pointer !important;
      text-align: center !important;
      transition: background 0.15s ease !important;
    }
  `;

  if (typeof GM_addStyle === "function") {
    GM_addStyle(styles);
  } else {
    const styleEl = document.createElement("style");
    styleEl.textContent = styles;
    document.head?.appendChild(styleEl);
  }

  // Rileva quote e mercati
  function parseOddsValue(text) {
    const m = String(text || "").match(/\b(\d+[.,]\d{2})\b/);
    if (!m) return null;
    const v = Number(m[1].replace(",", "."));
    return Number.isFinite(v) && v > 1.01 && v <= 100 ? v : null;
  }

  function parseSisalMarket(text) {
    const t = String(text || "").trim().toLowerCase();
    if (t === "1" || t.includes("esito finale 1") || t.endsWith(" 1")) return { key: "home", label: "1" };
    if (t === "x" || t.includes("esito finale x") || t.endsWith(" x")) return { key: "draw", label: "X" };
    if (t === "2" || t.includes("esito finale 2") || t.endsWith(" 2")) return { key: "away", label: "2" };
    if (t === "1x" || t.includes("1x")) return { key: "dc1X", label: "1X" };
    if (t === "x2" || t.includes("x2")) return { key: "dcX2", label: "X2" };
    if (t === "12" || t.includes("12")) return { key: "dc12", label: "12" };
    if (t.includes("over 2,5") || t.includes("over 2.5") || t === "over" || t.includes("u/o 2,5 over")) return { key: "over25", label: "Over 2.5" };
    if (t.includes("under 2,5") || t.includes("under 2.5") || t === "under" || t.includes("u/o 2,5 under")) return { key: "under25", label: "Under 2.5" };
    if (t.includes("over 1,5") || t.includes("over 1.5") || t.includes("u/o 1,5 over")) return { key: "over15", label: "Over 1.5" };
    if (t.includes("under 1,5") || t.includes("under 1.5") || t.includes("u/o 1,5 under")) return { key: "under15", label: "Under 1.5" };
    if (t.includes("over 3,5") || t.includes("over 3.5")) return { key: "over35", label: "Over 3.5" };
    if (t.includes("under 3,5") || t.includes("under 3.5")) return { key: "under35", label: "Under 3.5" };
    if (t === "goal" || t === "gol" || t.includes("entrambe segnano") || t.includes("gg") || t.includes("goal/goal")) return { key: "bttsYes", label: "Gol" };
    if (t === "nogoal" || t === "no goal" || t.includes("no gol") || t.includes("ng")) return { key: "bttsNo", label: "No Gol" };
    return null;
  }

  // Rilevamento partita singola
  function detectSingleMatch() {
    const titleMatch = document.title.match(/([A-Za-z0-9\s]{3,22})\s*[-–vsVS]+\s*([A-Za-z0-9\s]{3,22})/i);
    if (titleMatch) {
      let h = titleMatch[1].replace(/^(quote|scommesse|partita|live)\s+/i, "").trim();
      let a = titleMatch[2].replace(/\s+(scommesse|quote|sisal|calcio|serie).*$/i, "").trim();
      if (h.length >= 3 && a.length >= 3) return { home: h, away: a };
    }

    const headEls = document.querySelectorAll("h1, h2, [class*='title'], [class*='match-name'], [class*='scoreboard'], [data-qa*='match']");
    for (const el of headEls) {
      const txt = (el.innerText || "").trim();
      const m = txt.match(/([A-Za-z0-9\s]{3,22})\s*[-–vsVS]+\s*([A-Za-z0-9\s]{3,22})/i);
      if (m) {
        return { home: m[1].trim(), away: m[2].trim() };
      }
    }

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

  // Rilevamento partite multiple (Palinsesto / Serie A / Coppe)
  function detectMultipleMatches() {
    const containers = Array.from(document.querySelectorAll(`
      [data-qa*='event'], [class*='event-card'], [class*='match-row'], [class*='match-item'],
      [class*='single-event'], [class*='eventItem'], [class*='eventRow'], [class*='row-event']
    `));

    const matches = [];
    containers.forEach(container => {
      const text = container.innerText || "";
      const m = text.match(/([A-Za-z0-9\s]{3,20})\s*[-–vsVS\n]+\s*([A-Za-z0-9\s]{3,20})/);
      if (m) {
        const h = m[1].trim();
        const a = m[2].trim();
        if (h.length >= 3 && a.length >= 3 && h !== a && !h.toLowerCase().includes("quote")) {
          matches.push({ container, home: h, away: a });
        }
      }
    });

    return matches;
  }

  // Invia selezione singola a MatchMind
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

  // Invia le migliori scelte della strategia attiva a MatchMind
  function sendStrategyComboToMatchMind(items) {
    if (!items || !items.length) return;
    const selections = items.slice(0, 4).map(c => ({
      home: c.home,
      away: c.away,
      marketKey: c.key,
      marketLabel: c.label,
      odds: c.odd,
      bookmaker: "Sisal"
    }));

    const payload = {
      bookmaker: "Sisal",
      strategy: currentStrategy,
      selections: selections,
      date: new Date().toISOString().slice(0, 10),
      timestamp: Date.now()
    };

    const targetUrl = MATCHMIND_URL + "#import=" + encodeURIComponent(JSON.stringify(payload));
    window.open(targetUrl, "_blank");
  }

  // Invia carrello Sisal a MatchMind
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

  // STATO GLOBALE
  let currentAnalysis = null;
  let currentStrategy = localStorage.getItem("mm_widget_strategy") || "balanced"; // balanced, accurate, value, doubling
  let isMinimized = localStorage.getItem("mm_widget_minimized") === "true";
  let minProbThreshold = parseInt(localStorage.getItem("mm_min_prob") || "50", 10);
  if (isNaN(minProbThreshold)) minProbThreshold = 50;

  let isMutatingDOM = false;

  // Gestione Drag & Drop universale
  function initDraggable(widgetEl, handleEl) {
    let isDragging = false;
    let hasMoved = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;

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
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved = true;

      let newLeft = initialLeft + dx;
      let newTop = initialTop + dy;

      const maxLeft = Math.max(10, window.innerWidth - widgetEl.offsetWidth - 6);
      const maxTop = Math.max(10, window.innerHeight - widgetEl.offsetHeight - 6);
      newLeft = Math.max(6, Math.min(newLeft, maxLeft));
      newTop = Math.max(6, Math.min(newTop, maxTop));

      widgetEl.style.left = `${newLeft}px`;
      widgetEl.style.top = `${newTop}px`;

      if (e && e.cancelable) e.preventDefault();
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

  function setStrategy(strat) {
    currentStrategy = strat;
    localStorage.setItem("mm_widget_strategy", strat);
    renderWidget();
    updatePageBadges();
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

  // Filtra e ordina in base alla strategia selezionata
  function filterByStrategy(calculations, strategy, threshold) {
    if (!calculations || !calculations.length) return [];

    let filtered = [...calculations];

    if (strategy === "accurate") {
      // Massima probabilità (Accuratezza)
      filtered = filtered.filter(c => (c.modelProb * 100) >= Math.max(45, threshold));
      filtered.sort((a, b) => b.modelProb - a.modelProb);
    } else if (strategy === "value") {
      // Remuneratività (+EV: quota Sisal > quota equa MatchMind)
      filtered = filtered.filter(c => c.ev > 0 && (c.modelProb * 100) >= Math.max(25, threshold * 0.6));
      filtered.sort((a, b) => b.ev - a.ev);
    } else if (strategy === "balanced") {
      // Bilanciata: solida probabilità (>=48%) e quota remunerativa (>=1.38)
      filtered = filtered.filter(c => (c.modelProb * 100) >= Math.min(threshold, 50) && c.odd >= 1.35);
      filtered.sort((a, b) => {
        const scoreA = a.modelProb * Math.min(a.odd, 2.4) * (1 + Math.max(0, a.ev));
        const scoreB = b.modelProb * Math.min(b.odd, 2.4) * (1 + Math.max(0, b.ev));
        return scoreB - scoreA;
      });
    } else if (strategy === "doubling") {
      // Raddoppio: quote intorno a 1.70 - 2.30 con probabilità solida
      filtered = filtered.filter(c => c.odd >= 1.65 && c.odd <= 2.40 && (c.modelProb * 100) >= 42);
      filtered.sort((a, b) => (b.modelProb * (1 + b.ev)) - (a.modelProb * (1 + a.ev)));
    } else {
      // Fallback: soglia pura
      filtered = filtered.filter(c => (c.modelProb * 100) >= threshold);
      filtered.sort((a, b) => b.modelProb - a.modelProb);
    }

    return filtered;
  }

  // Render dell'interfaccia
  function renderWidget() {
    let widget = document.getElementById("mm-widget");
    if (!widget) {
      widget = document.createElement("div");
      widget.id = "mm-widget";
      document.body.appendChild(widget);
    }

    const calculations = currentAnalysis?.calculations || [];
    const activePicks = filterByStrategy(calculations, currentStrategy, minProbThreshold);

    if (isMinimized) {
      widget.classList.add("mm-is-minimized");
      const stratLabel = currentStrategy === "value" ? "+EV" : (currentStrategy === "accurate" ? "Accuratezza" : (currentStrategy === "doubling" ? "Raddoppio" : "Bilanciata"));

      widget.innerHTML = `
        <div id="mm-widget-min-bar" style="display:flex;align-items:center;gap:7px;font-size:11px;font-weight:700;">
          <span style="color:#c4f36a;font-size:12px;">🧠 MM</span>
          <span class="mm-prob-badge ${currentStrategy === 'value' ? 'is-value' : ''}" style="font-size:10px;padding:2px 6px;">
            ${activePicks.length} ${stratLabel}
          </span>
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

    if (!calculations.length) {
      widget.innerHTML = `
        <div id="mm-widget-head">
          <span>🧠 MatchMind Sisal</span>
          <div class="mm-head-actions">
            <button id="mm-btn-minimize" class="mm-icon-btn" title="Riduci a icona">—</button>
          </div>
        </div>
        <div style="font-size:11px;color:#94a3b8;padding:8px 0;text-align:center;">
          Nessuna quota calcistica rilevata nella schermata Sisal.<br/>
          <span style="font-size:10px;color:#64748b;">Apri una partita o il palinsesto Serie A.</span>
        </div>
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

    const isMulti = currentAnalysis.isMulti;
    const headerTitle = isMulti
      ? `⚽ Palinsesto (${currentAnalysis.matchCount} match)`
      : `⚽ ${currentAnalysis.home} - ${currentAnalysis.away}`;

    const presets = [
      { label: "Tutte", val: 0 },
      { label: "≥40%", val: 40 },
      { label: "≥50%", val: 50 },
      { label: "≥60%", val: 60 },
      { label: "≥70%", val: 70 }
    ];

    let itemsHtml = "";
    if (activePicks.length > 0) {
      itemsHtml = activePicks.slice(0, 15).map((c, idx) => {
        const pct = (c.modelProb * 100).toFixed(0);
        const ev = (c.ev * 100).toFixed(1);
        const isTop = idx === 0 && (c.ev > 0 || c.modelProb >= 0.65);
        const matchTitle = isMulti ? `${c.home} - ${c.away}` : "";

        return `
          <div class="mm-item-card ${isTop ? 'is-top' : ''}">
            <div class="mm-card-head">
              <div>
                <span class="mm-item-title">${c.label} @ ${c.odd.toFixed(2)}</span>
                ${matchTitle ? `<div class="mm-item-match">${matchTitle}</div>` : ''}
              </div>
              <div class="mm-card-actions">
                <span class="mm-prob-badge ${c.ev > 0 ? 'is-value' : ''}">${pct}%</span>
                <button class="mm-send-btn" title="Invia questa giocata a MatchMind" onclick="window.sendToMatchMind(event, '${c.home.replace(/'/g, "\'")}', '${c.away.replace(/'/g, "\'")}', '${c.key}', '${c.label}', ${c.odd})">
                  ⚡ MM
                </button>
              </div>
            </div>

            <div class="mm-card-metrics">
              <span>Equa: <b>${c.fairOdds.toFixed(2)}</b></span>
              <span style="color:${c.ev > 0 ? '#34d399' : '#94a3b8'};font-weight:700;">
                ${c.ev > 0 ? '+' + ev : ev}% EV
              </span>
            </div>

            <div class="mm-card-reason">
              💡 ${c.motivation}
            </div>
          </div>
        `;
      }).join("");
    } else {
      itemsHtml = `
        <div style="font-size:11px;color:#94a3b8;padding:12px;text-align:center;background:#0f172a;border-radius:6px;">
          Nessuna selezione per la strategia <b>${currentStrategy}</b> con soglia ≥ ${minProbThreshold}%.<br/>
          <span style="color:#38bdf8;cursor:pointer;font-weight:bold;margin-top:4px;display:inline-block;" id="mm-reset-strat">Mostra Più Probabili</span>
        </div>
      `;
    }

    widget.innerHTML = `
      <div id="mm-widget-head">
        <span style="font-size:12px;">🧠 MatchMind · Consigli Quote</span>
        <div class="mm-head-actions">
          <button id="mm-btn-minimize" class="mm-icon-btn" title="Riduci a icona">—</button>
        </div>
      </div>

      <div style="font-size:11px;font-weight:700;color:#f8fafc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
        ${headerTitle}
      </div>

      <!-- Schede Strategie (Accuratezza vs Remuneratività vs Bilanciate vs Raddoppio) -->
      <div class="mm-strategy-tabs">
        <button class="mm-strat-tab ${currentStrategy === 'balanced' ? 'active' : ''}" data-strat="balanced">
          ⚖️ Bilanciata
        </button>
        <button class="mm-strat-tab ${currentStrategy === 'accurate' ? 'active' : ''}" data-strat="accurate">
          🎯 Accuratezza
        </button>
        <button class="mm-strat-tab ${currentStrategy === 'value' ? 'active strat-value' : ''}" data-strat="value">
          💎 +EV Valore
        </button>
        <button class="mm-strat-tab ${currentStrategy === 'doubling' ? 'active' : ''}" data-strat="doubling">
          ✌️ Raddoppio
        </button>
      </div>

      <!-- Barra filtro probabilità percentuale -->
      <div class="mm-filter-bar">
        <div class="mm-filter-row">
          <span>Soglia probabilità:</span>
          <span style="color:#34d399;font-weight:800;font-size:11px;" id="mm-thresh-display">≥ ${minProbThreshold}%</span>
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

      <!-- Lista scommesse consigliate -->
      <div class="mm-list-container">
        ${itemsHtml}
      </div>

      <!-- Azioni rapide carrello e combo -->
      <div style="display:flex;flex-direction:column;gap:4px;">
        ${activePicks.length >= 2 ? `
          <button id="mm-send-top-combo-btn" class="mm-btn-combo">
            ⚡ Invia Top ${Math.min(3, activePicks.length)} scelte a MatchMind
          </button>
        ` : ''}
        <button id="mm-send-cart-btn" class="mm-btn-cart">
          📥 Invia carrello Sisal a MatchMind
        </button>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;">
        <a href="${MATCHMIND_URL}" target="_blank" style="color:#7dd3fc;text-decoration:none;">📋 Apri MatchMind</a>
        <span style="color:#64748b;cursor:pointer;" id="mm-rescan-btn">🔄 Aggiorna (${activePicks.length}/${calculations.length})</span>
      </div>
    `;

    // Event listeners
    document.getElementById("mm-btn-minimize")?.addEventListener("click", () => setMinimized(true));
    document.getElementById("mm-send-cart-btn")?.addEventListener("click", sendCartToMatchMind);
    document.getElementById("mm-rescan-btn")?.addEventListener("click", scanPage);
    document.getElementById("mm-reset-strat")?.addEventListener("click", () => setStrategy("accurate"));

    document.getElementById("mm-send-top-combo-btn")?.addEventListener("click", () => {
      sendStrategyComboToMatchMind(activePicks);
    });

    widget.querySelectorAll(".mm-strat-tab").forEach(tab => {
      tab.addEventListener("click", (e) => {
        const strat = e.currentTarget.dataset.strat;
        setStrategy(strat);
      });
    });

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

  // Aggiorna badge visivi sui bottoni Sisal nella pagina
  function updatePageBadges() {
    if (!currentAnalysis || !currentAnalysis.calculations) return;
    const { calculations } = currentAnalysis;

    isMutatingDOM = true;
    try {
      calculations.forEach(c => {
        const btn = c.btn;
        if (!btn || !document.body.contains(btn)) return;

        const pct = Math.round(c.modelProb * 100);
        const meetsThreshold = pct >= minProbThreshold;
        const hasValue = c.ev > 0;

        if ((currentStrategy === "value" && hasValue) || (currentStrategy !== "value" && meetsThreshold)) {
          btn.classList.add("mm-highlight-btn");
        } else {
          btn.classList.remove("mm-highlight-btn");
        }

        let tag = btn.querySelector(".mm-prob-tag, .mm-badge-recommended");
        if (!tag) {
          tag = document.createElement("div");
          tag.className = "mm-prob-tag";
          btn.appendChild(tag);
        }

        if (hasValue && c.ev >= 0.08) {
          tag.className = "mm-badge-recommended";
          tag.innerHTML = `★ ${pct}% (+${Math.round(c.ev * 100)}%)`;
        } else if (meetsThreshold) {
          tag.className = "mm-badge-recommended";
          tag.innerHTML = `★ ${pct}%`;
        } else {
          tag.className = "mm-prob-tag";
          tag.innerHTML = `🧠 ${pct}%`;
        }
        tag.title = `Stima MatchMind: ${pct}% · Quota equa: ${c.fairOdds.toFixed(2)} · EV: ${(c.ev * 100).toFixed(1)}%`;

        if (!btn.querySelector(".mm-send-btn")) {
          const sendBtn = document.createElement("button");
          sendBtn.type = "button";
          sendBtn.className = "mm-send-btn";
          sendBtn.innerHTML = "⚡";
          sendBtn.title = `Invia ${c.label} (${pct}%) a MatchMind`;
          sendBtn.onclick = (e) => window.sendToMatchMind(e, c.home, c.away, c.key, c.label, c.odd);
          btn.appendChild(sendBtn);
        }
      });
    } finally {
      isMutatingDOM = false;
    }
  }

  // Scansione principale
  function scanPage() {
    const singleMatch = detectSingleMatch();
    const multiMatches = detectMultipleMatches();

    const calculations = [];

    if (singleMatch) {
      // Modalità Singolo Match
      const forecast = calculateMatchMindForecast(singleMatch.home, singleMatch.away);
      const mmProbs = forecast.probabilities;

      const oddButtons = Array.from(document.querySelectorAll("button, [role='button'], [class*='odd'], [class*='quota'], [class*='selection']")).filter(el => {
        if (el.closest("#mm-widget")) return false;
        const text = el.innerText || "";
        return /\b\d+[.,]\d{2}\b/.test(text) && text.length < 50;
      });

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
          const motivation = generateMotivation(singleMatch.home, singleMatch.away, market.key, market.label, prob, val, fairOdds, ev, forecast.homeXg, forecast.awayXg);

          calculations.push({
            btn,
            home: singleMatch.home,
            away: singleMatch.away,
            odd: val,
            key: market.key,
            label: market.label,
            modelProb: prob,
            fairOdds,
            ev,
            motivation
          });
        }
      });

      currentAnalysis = {
        isMulti: false,
        home: singleMatch.home,
        away: singleMatch.away,
        matchCount: 1,
        calculations
      };
    } else if (multiMatches.length > 0) {
      // Modalità Palinsesto Multi-Match
      multiMatches.forEach(item => {
        const forecast = calculateMatchMindForecast(item.home, item.away);
        const mmProbs = forecast.probabilities;

        const oddButtons = Array.from(item.container.querySelectorAll("button, [role='button'], [class*='odd'], [class*='quota'], [class*='selection']")).filter(el => {
          if (el.closest("#mm-widget")) return false;
          const text = el.innerText || "";
          return /\b\d+[.,]\d{2}\b/.test(text) && text.length < 50;
        });

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

          const contextText = label + " " + text;
          const market = parseSisalMarket(contextText);

          if (market && mmProbs[market.key]) {
            const prob = mmProbs[market.key];
            const fairOdds = 1 / prob;
            const ev = (prob * val) - 1;
            const motivation = generateMotivation(item.home, item.away, market.key, market.label, prob, val, fairOdds, ev, forecast.homeXg, forecast.awayXg);

            calculations.push({
              btn,
              home: item.home,
              away: item.away,
              odd: val,
              key: market.key,
              label: market.label,
              modelProb: prob,
              fairOdds,
              ev,
              motivation
            });
          }
        });
      });

      currentAnalysis = {
        isMulti: true,
        matchCount: multiMatches.length,
        calculations
      };
    } else {
      currentAnalysis = {
        isMulti: false,
        home: "Partita",
        away: "In corso",
        matchCount: 0,
        calculations: []
      };
    }

    updatePageBadges();
    renderWidget();
  }

  // Observer ottimizzato per Single Page App Sisal (anti-lag, debounced)
  let scanTimer = null;
  let lastScanTime = 0;

  const observer = new MutationObserver((mutations) => {
    if (isMutatingDOM) return;

    let shouldScan = false;
    for (const m of mutations) {
      if (m.addedNodes.length > 0) {
        for (const n of m.addedNodes) {
          if (n.nodeType === 1 && (n.id === "mm-widget" || n.classList?.contains("mm-prob-tag") || n.classList?.contains("mm-badge-recommended") || n.classList?.contains("mm-send-btn"))) {
            continue;
          }
          shouldScan = true;
          break;
        }
      }
      if (shouldScan) break;
    }

    if (shouldScan) {
      const now = Date.now();
      if (now - lastScanTime < 1000) return; // Limita frequenza massima
      if (scanTimer) clearTimeout(scanTimer);
      scanTimer = setTimeout(() => {
        lastScanTime = Date.now();
        scanPage();
      }, 600);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener("load", () => {
    setTimeout(scanPage, 1000);
  });
  setTimeout(scanPage, 1200);

})();
