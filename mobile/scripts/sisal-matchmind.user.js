// ==UserScript==
// @name         MatchMind · Sisal Predictions
// @namespace    https://sonostevecazzo.github.io/MatchMind/
// @version      3.0.7
// @description  Percentuali MatchMind sulle quote Sisal, senza widget invasivi o invio automatico.
// @author       MatchMind
// @match        https://www.sisal.it/scommesse*
// @match        https://www.sisal.it/scommesse-matchpoint/*
// @match        https://scommesse.sisal.it/*
// @noframes
// @updateURL    https://raw.githubusercontent.com/Sonostevecazzo/MatchMind/main/mobile/scripts/sisal-matchmind.user.js
// @downloadURL  https://raw.githubusercontent.com/Sonostevecazzo/MatchMind/main/mobile/scripts/sisal-matchmind.user.js
// @icon         https://sonostevecazzo.github.io/MatchMind/icon.svg
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  const VERSION = "3.0.7";
  const APP_URL = "https://sonostevecazzo.github.io/MatchMind/bets.html";
  const STORAGE_KEY = "mm_sisal_predictions_v3";
  const ROOT_ID = "mm-sisal-status-v3";
  const BADGE_CLASS = "mm-sisal-prediction-v3";
  const LEGACY_STYLE_ID = "mm-sisal-legacy-cleanup-v3";
  const KNOWN_MARKET_KEYS = new Set([
    "home", "draw", "away", "dc1X", "dcX2", "dc12",
    "over15", "under15", "over25", "under25", "over35", "under35",
    "bttsYes", "bttsNo"
  ]);

  if (window.top !== window.self || !document.documentElement) return;
  if (document.getElementById(ROOT_ID)) return;

  const normalize = value => String(value || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  const compact = value => normalize(value).replace(/\s+/g, "");

  const TEAM_ALIASES = {
    inter: ["inter", "internazionale", "fc inter", "inter milan", "inter milano"],
    milan: ["milan", "ac milan", "acmilan"],
    juventus: ["juventus", "juve", "juventus fc"],
    roma: ["roma", "as roma"],
    lazio: ["lazio", "ss lazio"],
    napoli: ["napoli", "ssc napoli"],
    verona: ["verona", "hellas verona", "hellas"],
    atalanta: ["atalanta", "atalanta bc"],
    fiorentina: ["fiorentina", "acf fiorentina"],
    bologna: ["bologna", "bologna fc"],
    torino: ["torino", "torino fc"],
    monza: ["monza", "ac monza"],
    udinese: ["udinese", "udinese calcio"],
    lecce: ["lecce", "us lecce"],
    empoli: ["empoli", "empoli fc"],
    cagliari: ["cagliari", "cagliari calcio"],
    genoa: ["genoa", "genoa cfc"],
    parma: ["parma", "parma calcio"],
    como: ["como", "como 1907"],
    venezia: ["venezia", "venezia fc"],
    sassuolo: ["sassuolo", "us sassuolo"],
    palermo: ["palermo", "palermo fc"],
    sampdoria: ["sampdoria", "uc sampdoria"],
    cremonese: ["cremonese", "us cremonese"],
    pisa: ["pisa", "pisa sc", "pisa sporting club"],
    spezia: ["spezia", "spezia calcio"],
    bari: ["bari", "ssc bari"],
    frosinone: ["frosinone", "frosinone calcio"],
    cesena: ["cesena", "cesena fc"],
    catanzaro: ["catanzaro", "us catanzaro"],
    reggiana: ["reggiana", "ac reggiana"],
    modena: ["modena", "modena fc"],
    sudtirol: ["sudtirol", "sud tirol", "fc sudtirol", "suedtirol"],
    arsenal: ["arsenal", "arsenal fc"],
    chelsea: ["chelsea", "chelsea fc"],
    liverpool: ["liverpool", "liverpool fc"],
    manchestercity: ["manchester city", "man city"],
    manchesterunited: ["manchester united", "man utd", "man united"],
    newcastle: ["newcastle", "newcastle united"],
    astonvilla: ["aston villa", "aston villa fc"],
    tottenham: ["tottenham", "tottenham hotspur", "spurs"],
    brighton: ["brighton", "brighton and hove albion"],
    westham: ["west ham", "west ham united"],
    wolverhampton: ["wolverhampton", "wolverhampton wanderers", "wolves"],
    brentford: ["brentford", "brentford fc"],
    everton: ["everton", "everton fc"],
    fulham: ["fulham", "fulham fc"],
    nottinghamforest: ["nottingham forest", "nott forest"],
    crystalpalace: ["crystal palace"],
    burnley: ["burnley", "burnley fc"],
    sunderland: ["sunderland", "sunderland afc"],
    bournemouth: ["bournemouth", "afc bournemouth"],
    leeds: ["leeds", "leeds united"],
    realmadrid: ["real madrid", "real madrid cf"],
    barcellona: ["barcelona", "fc barcelona", "barcellona", "barca"],
    atletico: ["atletico madrid", "atletico de madrid", "atletico"],
    athleticbilbao: ["athletic bilbao", "athletic club", "athletic club bilbao"],
    realbetis: ["real betis", "betis"],
    realsociedad: ["real sociedad"],
    sevilla: ["sevilla", "sevilla fc"],
    valencia: ["valencia", "valencia cf"],
    villarreal: ["villarreal", "villarreal cf"],
    girona: ["girona", "girona fc"],
    celta: ["celta", "celta vigo"],
    osasuna: ["osasuna"],
    mallorca: ["mallorca", "rcd mallorca"],
    getafe: ["getafe"],
    rayo: ["rayo vallecano"],
    espanyol: ["espanyol", "rcd espanyol"],
    elche: ["elche", "elche cf"],
    alaves: ["alaves", "deportivo alaves"],
    oviedo: ["real oviedo", "oviedo"],
    levante: ["levante", "levante ud"],
    bayern: ["bayern", "bayern munich", "bayern munchen", "bayern monaco", "fc bayern"],
    dortmund: ["borussia dortmund", "dortmund", "bvb"],
    leverkusen: ["bayer leverkusen", "leverkusen"],
    leipzig: ["rb leipzig", "red bull leipzig"],
    stuttgart: ["stuttgart", "vfb stuttgart"],
    frankfurt: ["eintracht frankfurt", "frankfurt"],
    freiburg: ["freiburg", "sc freiburg", "friburgo"],
    augsburg: ["augsburg"],
    mainz: ["mainz", "mainz 05"],
    heidenheim: ["heidenheim", "fc heidenheim"],
    hoffenheim: ["hoffenheim", "tsg hoffenheim"],
    werderbremen: ["werder bremen", "werder brema"],
    wolfsburg: ["wolfsburg"],
    unionberlin: ["union berlin", "union berlino"],
    stpauli: ["st pauli", "fc st pauli"],
    gladbach: ["borussia monchengladbach", "monchengladbach", "gladbach"],
    psg: ["paris saint germain", "paris saint-germain", "psg"],
    marseille: ["marseille", "olympique de marseille"],
    lyon: ["lyon", "olympique lyonnais"],
    monaco: ["as monaco", "monaco"],
    lille: ["lille", "losc lille"],
    nice: ["nice", "ogc nice"],
    brest: ["brest", "stade brestois"],
    lorient: ["lorient"],
    nantes: ["nantes"],
    rennes: ["rennes"],
    toulouse: ["toulouse"],
    strasbourg: ["strasbourg"],
    angers: ["angers"],
    auxerre: ["auxerre"],
    parisfc: ["paris fc"],
    ajax: ["ajax", "afc ajax"],
    psv: ["psv", "psv eindhoven"],
    feyenoord: ["feyenoord"],
    porto: ["porto", "fc porto"],
    benfica: ["benfica", "sl benfica"],
    sporting: ["sporting cp", "sporting lisbona", "sporting clube de portugal"],
    galatasaray: ["galatasaray"],
    fenerbahce: ["fenerbahce", "fenerbahce sk"],
    celtic: ["celtic", "celtic fc"],
    rangers: ["rangers", "glasgow rangers"],
    netherlands: ["netherlands", "holland", "the netherlands", "olanda", "paesi bassi", "nederland"],
    greece: ["greece", "grecia", "hellas"],
    italy: ["italy", "italia", "italia nazionale"],
    germany: ["germany", "germania", "deutschland"],
    france: ["france", "francia"],
    spain: ["spain", "spagna", "espana"],
    england: ["england", "inghilterra"],
    belgium: ["belgium", "belgio"],
    portugal: ["portugal", "portogallo"],
    croatia: ["croatia", "croazia"],
    denmark: ["denmark", "danimarca"],
    sweden: ["sweden", "svezia"],
    norway: ["norway", "norvegia"],
    poland: ["poland", "polonia"],
    czechrepublic: ["czech republic", "repubblica ceca", "czechia"],
    romania: ["romania"],
    ireland: ["ireland", "republic of ireland", "irlanda"],
    scotland: ["scotland", "scozia"],
    wales: ["wales", "galles"],
    ukraine: ["ukraine", "ucraina"],
    serbia: ["serbia"],
    albania: ["albania"],
    turkey: ["turkey", "turchia", "turkiye"],
    slovenia: ["slovenia", "slovenija"],
    switzerland: ["switzerland", "svizzera", "schweiz"],
    slovakia: ["slovakia", "slovacchia"],
    northmacedonia: ["north macedonia", "macedonia del nord", "north macedonia national team"],
    faroeislands: ["faroe islands", "isole faroe", "faroe"],
    moldova: ["moldova", "moldavia"],
    kazakhstan: ["kazakhstan", "kazakistan"],
    andorra: ["andorra"],
    gibraltar: ["gibraltar"],
    montenegro: ["montenegro"],
    bosnia: ["bosnia and herzegovina", "bosnia erzegovina", "bosnia"],
    luxembourg: ["luxembourg", "lussemburgo"],
    iceland: ["iceland", "islanda"],
    finland: ["finland", "finlandia"],
    israel: ["israel"]
  };

  const ALIAS_INDEX = new Map();
  Object.entries(TEAM_ALIASES).forEach(([canonical, aliases]) => {
    [canonical, ...aliases].forEach(alias => ALIAS_INDEX.set(compact(alias), canonical));
  });

  function readStored() {
    try {
      if (typeof GM_getValue === "function") {
        const value = GM_getValue(STORAGE_KEY, []);
        return Array.isArray(value) ? value : [];
      }
    } catch (_) {}
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch (_) { return []; }
  }

  function writeStored(value) {
    try {
      if (typeof GM_setValue === "function") GM_setValue(STORAGE_KEY, value);
    } catch (_) {}
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch (_) {}
  }

  function teamAliases(name) {
    const raw = String(name || "").trim();
    const canonical = ALIAS_INDEX.get(compact(raw));
    if (!canonical) return [raw].filter(Boolean);
    return [raw, canonical, ...(TEAM_ALIASES[canonical] || [])].filter(Boolean);
  }

  function includesTeam(text, name) {
    const haystack = " " + normalize(text) + " ";
    const compactHaystack = compact(text);
    return teamAliases(name).some(alias => {
      const normalized = normalize(alias);
      if (!normalized) return false;
      const needle = " " + normalized + " ";
      if (needle.length > 2 && haystack.includes(needle)) return true;
      // Sisal sometimes exposes team names in aria-labels, image alt text or
      // data attributes without preserving spaces in the visible card text.
      const compactAlias = compact(alias);
      return compactAlias.length >= 4 && compactHaystack.includes(compactAlias);
    });
  }

  function eventText(root) {
    const parts = [root.innerText || root.textContent || ""];
    const nodes = root.querySelectorAll(
      "[aria-label],[title],[data-team],[data-team-name],[data-home-team],[data-away-team],img[alt],svg[aria-label]"
    );
    nodes.forEach(node => {
      ["aria-label", "title", "data-team", "data-team-name", "data-home-team", "data-away-team", "alt"]
        .forEach(attr => {
          const value = node.getAttribute(attr);
          if (value) parts.push(value);
        });
    });
    return parts.join(" ").slice(0, 16000);
  }

  function sameEvent(text, item) {
    return includesTeam(text, item.home) && includesTeam(text, item.away);
  }

  function validProbability(value) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 && number <= 1 ? number : null;
  }

  function normalizePredictions(row) {
    const result = Object.create(null);
    const source = Array.isArray(row.predictions) ? row.predictions : [];
    source.forEach(entry => {
      if (!entry || !entry.marketKey) return;
      const probability = validProbability(entry.probability);
      if (probability === null) return;
      result[String(entry.marketKey)] = {
        probability,
        label: String(entry.label || entry.marketKey),
        sampleEnough: entry.sampleEnough === true || row.sampleEnough === true,
        historyCount: Number.isFinite(Number(entry.historyCount)) && entry.historyCount !== null
          ? Number(entry.historyCount)
          : (Number.isFinite(Number(row.historyCount)) ? Number(row.historyCount) : 0),
        model: String(entry.model || row.predictionMethod || "MatchMind")
      };
    });
    if (!Object.keys(result).length) {
      const probability = validProbability(row.probability);
      if (probability !== null && row.marketKey) {
        result[String(row.marketKey)] = {
          probability,
          label: String(row.label || row.marketKey),
          sampleEnough: row.sampleEnough === true,
          historyCount: Number.isFinite(Number(row.historyCount)) ? Number(row.historyCount) : 0,
          model: String(row.predictionMethod || "MatchMind")
        };
      }
    }
    return result;
  }

  function decodeIncomingHash() {
    const query = new URLSearchParams(location.search || "");
    const hash = new URLSearchParams(String(location.hash || "").replace(/^#/, ""));
    const encoded = query.get("mmplay") || hash.get("mmplay");
    if (!encoded) return false;
    try {
      let payload;
      try { payload = JSON.parse(encoded); }
      catch (_) { payload = JSON.parse(decodeURIComponent(encoded)); }
      // Inflate compact v3 tuple payloads; retain support for older object payloads.
      if (payload && payload.v === 3 && Array.isArray(payload.i)) {
        payload = {
          version: 3,
          sentAt: Number(payload.t) || Date.now(),
          items: payload.i.map(tuple => {
            if (!Array.isArray(tuple)) return null;
            const [
              home, away, marketKey, label, date, competition, eventId, sport,
              selectedProbability, compactPredictions, sampleEnough, historyCount,
              predictionMethod, start, homeAbbr, awayAbbr, side, team
            ] = tuple;
            return {
              home, away, marketKey, label, date, competition, eventId, sport,
              probability: selectedProbability,
              predictions: (Array.isArray(compactPredictions) ? compactPredictions : [])
                .filter(pair => Array.isArray(pair) && pair.length >= 2)
                .map(pair => ({ marketKey: pair[0], probability: pair[1] })),
              sampleEnough: sampleEnough === 1,
              historyCount, predictionMethod, start, homeAbbr, awayAbbr, side, team
            };
          }).filter(Boolean)
        };
      }
      const source = Array.isArray(payload) ? payload : (Array.isArray(payload.items) ? payload.items : []);
      const incoming = source.filter(row => row && row.home && row.away).map(row => ({
        home: String(row.home),
        away: String(row.away),
        date: String(row.date || ""),
        competition: String(row.competition || "serie-a"),
        sport: String(row.sport || "football"),
        marketKey: String(row.marketKey || ""),
        predictions: normalizePredictions(row),
        sentAt: Number(payload.sentAt) || Date.now()
      })).filter(row => Object.keys(row.predictions).length > 0);
      if (incoming.length) {
        const merged = new Map(readStored().map(item => [eventKey(item), item]));
        incoming.forEach(item => {
          const key = eventKey(item);
          const old = merged.get(key);
          merged.set(key, old ? {
            ...old,
            ...item,
            predictions: { ...(old.predictions || {}), ...item.predictions }
          } : item);
        });
        writeStored(Array.from(merged.values()).slice(-40));
      }
      try {
        const cleanUrl = new URL(location.href);
        cleanUrl.searchParams.delete("mmplay");
        cleanUrl.hash = "";
        history.replaceState(null, "", cleanUrl.pathname + cleanUrl.search);
      } catch (_) {}
      return incoming.length > 0;
    } catch (_) {
      return false;
    }
  }

  function eventKey(item) {
    return [item.sport || "football", item.competition || "", compact(item.home), compact(item.away), item.date || ""].join("|");
  }

  function clearLegacyInterface() {
    const style = document.createElement("style");
    style.id = LEGACY_STYLE_ID;
    style.textContent = [
      "#mm-widget,#mm-floating-badge,#mm-play-queue{display:none!important;visibility:hidden!important;pointer-events:none!important}",
      ".mm-selected-app-tag,.mm-prob-tag,.mm-badge-recommended{display:none!important}"
    ].join("");
    (document.head || document.documentElement).appendChild(style);
  }

  function addStyles() {
    const style = document.createElement("style");
    style.id = "mm-sisal-predictions-style-v3";
    style.textContent = [
      "#"+ROOT_ID+"{position:fixed;right:10px;bottom:92px;z-index:2147483000;display:inline-flex;align-items:center;gap:5px;padding:5px 9px;border:1px solid rgba(16,185,129,.55);border-radius:999px;background:rgba(8,24,24,.94);color:#b7f7d8;font:700 11px/1.1 system-ui,-apple-system,sans-serif;box-shadow:0 2px 9px rgba(0,0,0,.2);text-decoration:none;opacity:.92;}",
      "#"+ROOT_ID+" .mm-dot{width:6px;height:6px;border-radius:50%;background:#19c784;box-shadow:0 0 0 3px rgba(25,199,132,.13)}",
      "."+BADGE_CLASS+"{display:inline-flex!important;align-items:center!important;justify-content:center!important;vertical-align:middle!important;margin:2px 0 0 4px!important;padding:2px 5px!important;border:1px solid #64748b!important;border-radius:5px!important;background:#1e293b!important;color:#f8fafc!important;font:800 10px/1.15 system-ui,-apple-system,sans-serif!important;letter-spacing:.1px!important;white-space:nowrap!important;pointer-events:none!important;box-shadow:none!important;}",
      "."+BADGE_CLASS+".mm-picked{outline:2px solid #facc15!important;outline-offset:1px!important;}",
      "."+BADGE_CLASS+".mm-best{border-color:#16a34a!important;background:#dcfce7!important;color:#166534!important;}",
      "."+BADGE_CLASS+".mm-value{border-color:#2563eb!important;background:#dbeafe!important;color:#1d4ed8!important;}",
      "."+BADGE_CLASS+".mm-avoid{border-color:#dc2626!important;background:#fee2e2!important;color:#991b1b!important;}",
      "."+BADGE_CLASS+"[data-mm-limited='true']{border-style:dashed!important;}",
      "@media(max-width:600px){#"+ROOT_ID+"{right:8px;bottom:88px;padding:4px 8px;font-size:10px;}}"
    ].join("");
    (document.head || document.documentElement).appendChild(style);
  }

  let statusRoot = null;
  let lastScan = 0;
  let scheduled = false;
  let scanTimer = null;
  let matchedMatches = 0;
  let matchedMarkets = 0;

  function createStatus() {
    statusRoot = document.getElementById(ROOT_ID);
    if (statusRoot) statusRoot.remove();
    statusRoot = document.createElement("a");
    statusRoot.id = ROOT_ID;
    statusRoot.href = APP_URL;
    statusRoot.target = "_blank";
    statusRoot.rel = "noopener noreferrer";
    statusRoot.setAttribute("aria-label", "MatchMind attivo. Apri il costruttore delle schedine.");
    statusRoot.setAttribute("data-mm-sisal-ui", "true");
    statusRoot.innerHTML = '<span class="mm-dot"></span><span>MM attivo</span>';
    (document.body || document.documentElement).appendChild(statusRoot);
    setStatus();
  }

  function setStatus() {
    if (!statusRoot) return;
    const imported = readStored().length;
    const title = matchedMarkets
      ? "MatchMind attivo · " + matchedMarkets + " percentuali mostrate su " + matchedMatches + " partite riconosciute."
      : imported
        ? "MatchMind attivo · " + imported + " partite importate, ma nessun mercato riconosciuto su questa schermata."
        : "MatchMind attivo, ma non ha ricevuto previsioni dall'app. Trasferisci la schedina da MatchMind.";
    const label = matchedMarkets ? "MM · " + matchedMarkets + " %" : imported ? "MM · " + imported + " partite" : "MM · trasferisci";
    statusRoot.querySelector("span:last-child").textContent = label;
    statusRoot.title = title;
    statusRoot.setAttribute("aria-label", title + " Apri il costruttore MatchMind.");
  }

  function getActionButtons() {
    const selector = "button,[role='button'],a[role='button'],[data-outcome],[data-selection-name]";
    const viewportHeight = Math.max(window.innerHeight || document.documentElement.clientHeight || 700, 480);
    const margin = Math.min(720, Math.max(240, viewportHeight * 0.65));
    return Array.from(document.querySelectorAll(selector)).filter(button => {
      if (button.closest("#"+ROOT_ID) || button.closest("[data-mm-sisal-ui]")) return false;
      if (!button.getClientRects().length) return false;
      const rect = button.getBoundingClientRect();
      if (rect.bottom < -margin || rect.top > viewportHeight + margin) return false;
      const text = buttonText(button);
      if (!text || text.length > 140) return false;
      const hasOdds = /\b\d+[.,]\d{1,3}\b/.test(text);
      const label = normalize(text);
      const likelyOutcome = /^(1|x|2|1 x|x 2|1 2|si|sì|no|gol|no gol|goal|no goal|over|under|o|u)$/.test(label);
      return hasOdds || likelyOutcome ||
        button.hasAttribute("data-outcome") || button.hasAttribute("data-selection-name");
    });
  }

  function buttonText(button) {
    const attributes = ["data-outcome", "data-selection-name", "data-name", "aria-label", "title"]
      .map(name => button.getAttribute(name) || "").filter(Boolean);
    return attributes.concat([button.innerText || button.textContent || ""]).join(" ").trim();
  }

  function eventRootCandidates(button, rootCache) {
    const roots = [];
    let current = button.parentElement;
    for (let depth = 0; depth < 14 && current && current !== document.body; depth++, current = current.parentElement) {
      let metrics = rootCache.get(current);
      if (!metrics) {
        metrics = {
          text: eventText(current),
          count: current.querySelectorAll("button,[role='button'],a[role='button'],[data-outcome]").length
        };
        rootCache.set(current, metrics);
      }
      if (!metrics.text || metrics.text.length > 16000) continue;
      if (metrics.count > 0 && metrics.count <= 80) roots.push({ root: current, text: metrics.text });
    }
    return roots;
  }

  function isMarketHeading(text) {
    return /1x2|esito finale|risultato finale|doppia chance|under|over|gol|goal|segna|entrambe|both teams|btts/i.test(String(text || ""));
  }

  function marketContext(button, eventRoot) {
    const pieces = [];
    const selectors = "h2,h3,h4,h5,[data-market-name],[data-market-title],[class*='market-title'],[class*='marketTitle']";
    const headings = Array.from(eventRoot.querySelectorAll(selectors)).filter(node => {
      const text = (node.innerText || node.textContent || "").trim();
      if (!text || text.length > 120 || !isMarketHeading(text)) return false;
      const relation = node.compareDocumentPosition(button);
      return Boolean(relation & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    if (headings.length) {
      const nearest = headings[headings.length - 1];
      pieces.push(nearest.innerText || nearest.textContent || "");
    }
    let current = button;
    for (let depth = 0; depth < 5 && current && current !== eventRoot; depth++, current = current.parentElement) {
      const parent = current.parentElement;
      if (!parent) break;
      const select = parent.querySelector("select");
      if (select) pieces.push(select.value || select.options?.[select.selectedIndex]?.text || "");
      ["data-market", "data-market-name", "data-market-title", "aria-label"].forEach(attr => {
        const value = parent.getAttribute(attr);
        if (value && value.length < 120) pieces.push(value);
      });
      const siblings = Array.from(parent.children);
      const index = siblings.indexOf(current);
      for (let i = index - 1; i >= 0 && i >= index - 2; i--) {
        const text = (siblings[i].innerText || siblings[i].textContent || "").trim();
        if (text && text.length < 120 && isMarketHeading(text)) pieces.push(text);
      }
    }
    return pieces.join(" ");
  }

  function outcomeLabel(button) {
    const explicit = ["data-outcome", "data-selection-name", "data-name"]
      .map(name => button.getAttribute(name) || "").find(value => value.trim());
    const raw = explicit || (button.innerText || button.textContent || "");
    return String(raw).replace(/\b\d+[.,]\d{1,3}\b/g, " ").replace(/\s+/g, " ").trim();
  }

  function marketKeyFor(button, eventRoot) {
    const label = outcomeLabel(button);
    const normalizedLabel = normalize(label);
    const context = marketContext(button, eventRoot);
    const all = normalize(context + " " + buttonText(button));
    const dataKey = button.getAttribute("data-market-key") ||
      button.getAttribute("data-market") || button.getAttribute("data-market-type");
    if (dataKey) {
      const compactKey = String(dataKey).replace(/\s+/g, "");
      if (KNOWN_MARKET_KEYS.has(compactKey) || /^combo:(home|draw|away):(over15|under15|over25|under25|over35|under35|bttsYes|bttsNo)$/.test(compactKey)) return compactKey;
    }

    if (all.includes("doppia chance") || /^(1x|x2|12)$/.test(compactKeyLabel(normalizedLabel))) {
      if (normalizedLabel === "1x" || normalizedLabel === "1 x") return "dc1X";
      if (normalizedLabel === "x2" || normalizedLabel === "x 2") return "dcX2";
      if (normalizedLabel === "12" || normalizedLabel === "1 2") return "dc12";
    }

    if (/segna entrambe|entrambe le squadre|gol no gol|goal no goal|both teams to score|\bbtts\b|segneranno entrambe/.test(all)) {
      if (/^(si|sì|yes|gol|goal)$/.test(normalizedLabel)) return "bttsYes";
      if (/^(no|nogoal|no gol|no goal)$/.test(normalizedLabel)) return "bttsNo";
    }

    if (all.includes("under over") || all.includes("over under") || all.includes("underover") ||
        /\bover\b|\bunder\b/.test(all)) {
      const line = all.includes("1 5") ? "15" :
        all.includes("3 5") ? "35" : all.includes("2 5") ? "25" : "";
      const isOver = /\bover\b|oltre|piu di|piu'.*di/.test(all);
      const isUnder = /\bunder\b|meno di/.test(all);
      if (line && isOver !== isUnder) return (isOver ? "over" : "under") + line;
      if (line && normalizedLabel === "o") return "over" + line;
      if (line && normalizedLabel === "u") return "under" + line;
    }

    if (all.includes("esito finale") || all.includes("risultato finale") || all.includes("1x2")) {
      if (normalizedLabel === "1") return "home";
      if (normalizedLabel === "x") return "draw";
      if (normalizedLabel === "2") return "away";
    }
    return "";
  }

  function compactKeyLabel(value) {
    return String(value || "").replace(/[^a-z0-9]/g, "");
  }

  function formatPercent(value) {
    return (value * 100).toLocaleString("it-IT", { maximumFractionDigits: 1 }) + "%";
  }

  function oddsFromButton(button) {
    const values = (buttonText(button).match(/[0-9]+(?:[.,][0-9]+)?/g) || []).map(value => Number(value.replace(',', '.')));
    return values.find(value => Number.isFinite(value) && value > 1 && value < 1000) || null;
  }
  function marketFamily(key) {
    if (['home', 'draw', 'away'].includes(key)) return '1x2';
    if (['dc1X', 'dcX2', 'dc12'].includes(key)) return 'double-chance';
    if (/^(over|under)(15|25|35)$/.test(key)) return key.slice(-2);
    if (['bttsYes', 'bttsNo'].includes(key)) return 'btts';
    return key;
  }
  function addPredictionBadge(button, prediction, selected, classification) {
    let badge = button.querySelector(':scope > .' + BADGE_CLASS);
    if (!badge) { badge = document.createElement('span'); badge.className = BADGE_CLASS; badge.setAttribute('data-mm-sisal-ui', 'true'); button.appendChild(badge); }
    badge.textContent = formatPercent(prediction.probability);
    badge.dataset.mmLimited = String(!prediction.sampleEnough);
    badge.title = classification.title + ' - ' + (prediction.sampleEnough ? 'campione adeguato' : 'campione limitato') + (prediction.historyCount ? ' · ' + prediction.historyCount + ' risultati storici' : '') + ' - ' + prediction.model;
    badge.classList.toggle('mm-picked', Boolean(selected));
    badge.classList.toggle('mm-best', classification.type === 'best');
    badge.classList.toggle('mm-value', classification.type === 'value');
    badge.classList.toggle('mm-avoid', classification.type === 'avoid');
    button.setAttribute('data-mm-prediction', prediction.marketKey || '');
  }
  function scan() {
    scheduled = false;
    scanTimer = null;
    if (document.hidden) return;
    const now = Date.now();
    if (now - lastScan < 1600) {
      scheduleScan(1700 - (now - lastScan));
      return;
    }
    lastScan = now;

    const queue = readStored().filter(item => item && item.predictions && Object.keys(item.predictions).length);
    if (!queue.length) {
      document.querySelectorAll("." + BADGE_CLASS).forEach(node => node.remove());
      document.querySelectorAll("[data-mm-prediction]").forEach(node => node.removeAttribute("data-mm-prediction"));
      matchedMatches = 0;
      matchedMarkets = 0;
      setStatus();
      return;
    }

    const buttons = getActionButtons();
    const rootCache = new WeakMap();
    const snapshots = buttons.map(button => ({ button, roots: eventRootCandidates(button, rootCache) }));
    buttons.forEach(button => {
      button.querySelectorAll("." + BADGE_CLASS).forEach(node => node.remove());
      button.removeAttribute("data-mm-prediction");
    });
    const eventMatchCache = new WeakMap();
    const rootMatches = (root, text, item) => {
      let cache = eventMatchCache.get(root);
      if (!cache) { cache = new Map(); eventMatchCache.set(root, cache); }
      const key = eventKey(item);
      if (!cache.has(key)) cache.set(key, sameEvent(text, item));
      return cache.get(key);
    };

    let matchesSeen = 0;
    let marketsSeen = 0;
    queue.forEach(item => {
      const predictions = item.predictions || {};
      let eventSeen = false;
      const found = [];
      snapshots.forEach(snapshot => {
        const candidate = snapshot.roots.find(entry => rootMatches(entry.root, entry.text, item));
        if (!candidate) return;
        eventSeen = true;
        const key = marketKeyFor(snapshot.button, candidate.root);
        const prediction = predictions[key];
        if (prediction) found.push({ button: snapshot.button, key, prediction, odds: oddsFromButton(snapshot.button) });
      });
      if (eventSeen) matchesSeen++;
      const families = new Map();
      found.forEach(entry => { const family = marketFamily(entry.key); if (!families.has(family)) families.set(family, []); families.get(family).push(entry); });
      found.forEach(entry => {
        const group = families.get(marketFamily(entry.key));
        let classification = { type: 'neutral', title: 'Stima MatchMind' };
        if (group.length > 1) {
          const maxP = Math.max(...group.map(value => value.prediction.probability));
          const minP = Math.min(...group.map(value => value.prediction.probability));
          const odds = group.filter(value => value.odds !== null);
          const maxOdds = odds.length > 1 ? Math.max(...odds.map(value => value.odds)) : null;
          const isBest = Math.abs(entry.prediction.probability - maxP) < 1e-9;
          const isAvoid = Math.abs(entry.prediction.probability - minP) < 1e-9;
          const isValue = maxOdds !== null && entry.odds !== null && Math.abs(entry.odds - maxOdds) < 1e-9;
          if (isValue) classification = { type: 'value', title: 'Stima MatchMind · quota più alta tra le alternative confrontabili' };
          else if (isBest && !isAvoid) classification = { type: 'best', title: 'Stima MatchMind · probabilità più alta tra le alternative confrontabili' };
          else if (isAvoid && !isBest) classification = { type: 'avoid', title: 'Stima MatchMind · probabilità più bassa tra le alternative confrontabili' };
        }
        addPredictionBadge(entry.button, { ...entry.prediction, marketKey: entry.key }, entry.key === item.marketKey, classification);
        marketsSeen++;
      });
    });
    matchedMatches = matchesSeen;
    matchedMarkets = marketsSeen;
    setStatus();
  }

  function scheduleScan(delay) {
    if (scheduled) return;
    scheduled = true;
    scanTimer = window.setTimeout(scan, Math.max(0, Number(delay) || 0));
  }

  function captureAndPrepare() {
    const imported = decodeIncomingHash();
    const statusData = readStored();
    createStatus();
    setStatus();
    scheduleScan(imported ? 500 : 900);
    return statusData.length;
  }

  clearLegacyInterface();
  addStyles();
  captureAndPrepare();

  const observer = new MutationObserver(records => {
    if (document.hidden) return;
    for (const record of records) {
      if (record.target && record.target.closest && record.target.closest("[data-mm-sisal-ui]")) continue;
      const relevant = Array.from(record.addedNodes || []).some(node => {
        if (node.nodeType !== 1) return false;
        if (node.id === ROOT_ID || node.hasAttribute("data-mm-sisal-ui") || node.closest?.("[data-mm-sisal-ui]")) return false;
        if (/^(SCRIPT|STYLE|LINK|META)$/.test(node.tagName || "")) return false;
        return true;
      });
      if (relevant) { scheduleScan(450); break; }
    }
  });

  const startObserver = () => {
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  };
  if (document.body) startObserver();
  else document.addEventListener("DOMContentLoaded", startObserver, { once: true });

  document.addEventListener("click", event => {
    if (event.target.closest && event.target.closest("button,[role='button'],a")) scheduleScan(500);
  }, { passive: true });
  let scrollScanQueued = false;
  window.addEventListener("scroll", () => {
    if (scrollScanQueued || document.hidden) return;
    scrollScanQueued = true;
    window.setTimeout(() => {
      scrollScanQueued = false;
      scheduleScan(280);
    }, 220);
  }, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) scheduleScan(250);
  });
  window.addEventListener("popstate", () => scheduleScan(350));
  window.addEventListener("hashchange", () => {
    if (decodeIncomingHash()) {
      setStatus();
      scheduleScan(450);
    }
  });
})();