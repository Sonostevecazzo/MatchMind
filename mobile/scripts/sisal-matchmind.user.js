// ==UserScript==
// @name         MatchMind · Sisal Value Bets & Sync
// @namespace    https://sonostevecazzo.github.io/MatchMind/
// @version      2.3.1
// @description  Valutazione statistica chiara per tutti i mercati Sisal supportati, non solo quelli consigliati.
// @author       Simone Sedda & MatchMind
// @match        https://www.sisal.it/scommesse*
// @match        https://www.sisal.it/scommesse-matchpoint*
// @match        https://scommesse.sisal.it/*
// @match        https://*.lovable.app/*
// @match        https://sonostevecazzo.github.io/MatchMind/*
// @match        http://localhost:8080/*
// @icon         https://sonostevecazzo.github.io/MatchMind/icon.svg
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function() {
  'use strict';

  // --- PONTE MATCHMIND (v2.2): sulle pagine dell'app copia lo stato delle giocate inviate a Sisal ---
  if (!/sisal\.it$/i.test(location.hostname)) {
    if (!document.querySelector('body[data-page]') && !/bets\.html/.test(location.pathname)) return;
    const sync = () => {
      try {
        const raw = (typeof GM_getValue === "function" && GM_getValue("mm_play_queue", "")) || "[]";
        if (localStorage.getItem("mm_sisal_play_status") !== raw) {
          localStorage.setItem("mm_sisal_play_status", raw);
          window.dispatchEvent(new CustomEvent("mm-sisal-status"));
        }
        localStorage.setItem("mm_sisal_bridge_seen", String(Date.now()));
      } catch (e) {}
    };
    sync(); setInterval(sync, 2000);
    return;
  }

  // Indirizzo della pagina Schedina di MatchMind: si può cambiare salvando "matchmind_url" (GM_setValue).
  const MATCHMIND_URL = (typeof GM_getValue === "function" && GM_getValue("matchmind_url", "")) || "https://sonostevecazzo.github.io/MatchMind/bets.html";

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
  const matchContexts = {};
  let injuriesData = null;

  function loadInjuriesData() {
    try {
      fetch("https://sonostevecazzo.github.io/MatchMind/injuries-data.json", { cache: "default" })
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d && d.teams) {
            injuriesData = d;
            forecastCache.clear();
            if (currentAnalysis && !currentAnalysis.isMulti) {
              updatePageBadges();
              renderWidget();
            }
          }
        })
        .catch(() => {});
    } catch (_) {}
  }
  loadInjuriesData();

  function findTeamInjuries(teamName) {
    if (!teamName || !injuriesData || !injuriesData.teams) return null;
    const can = canonicalTeam(teamName);
    for (const [k, v] of Object.entries(injuriesData.teams)) {
      if (canonicalTeam(k) === can) return v;
    }
    return null;
  }

  function getMatchContext(home, away) {
    const key = `${canonicalTeam(home)}|${canonicalTeam(away)}`;
    const manual = matchContexts[key];
    if (manual && manual.__manual) return manual;
    const hInj = findTeamInjuries(home);
    const aInj = findTeamInjuries(away);
    const autoAttH = Math.min(3, (hInj && hInj.assenze_attacco) || 0);
    const autoDefH = Math.min(3, (hInj && hInj.assenze_difesa) || 0);
    const autoAttA = Math.min(3, (aInj && aInj.assenze_attacco) || 0);
    const autoDefA = Math.min(3, (aInj && aInj.assenze_difesa) || 0);
    return {
      attackingAbsencesHome: manual ? (manual.attackingAbsencesHome ?? autoAttH) : autoAttH,
      defensiveAbsencesHome: manual ? (manual.defensiveAbsencesHome ?? autoDefH) : autoDefH,
      motivationHome: manual ? (manual.motivationHome ?? 0) : 0,
      attackingAbsencesAway: manual ? (manual.attackingAbsencesAway ?? autoAttA) : autoAttA,
      defensiveAbsencesAway: manual ? (manual.defensiveAbsencesAway ?? autoDefA) : autoDefA,
      motivationAway: manual ? (manual.motivationAway ?? 0) : 0,
      __isAuto: !manual || !manual.__manual
    };
  }

  function setMatchContext(home, away, ctx) {
    const key = `${canonicalTeam(home)}|${canonicalTeam(away)}`;
    matchContexts[key] = { ...(matchContexts[key] || {}), ...ctx };
    forecastCache.clear();
  }

  function poisson(lambda, k) {
    if (lambda <= 0) return k === 0 ? 1 : 0;
    let p = Math.exp(-lambda);
    for (let i = 1; i <= k; i++) p *= lambda / i;
    return p;
  }

  // Motore Poisson MatchMind (matrice gol 0-7) con supporto correttivi manuali assenze e motivazione
  function calculateMatchMindForecast(homeName, awayName) {
    const hKey = canonicalTeam(homeName);
    const aKey = canonicalTeam(awayName);
    const ctx = getMatchContext(homeName, awayName);
    const ctxHash = `${ctx.attackingAbsencesHome||0}_${ctx.defensiveAbsencesHome||0}_${ctx.motivationHome||0}_${ctx.attackingAbsencesAway||0}_${ctx.defensiveAbsencesAway||0}_${ctx.motivationAway||0}`;
    const memoKey = `${hKey}|${aKey}|${ctxHash}`;

    if (forecastCache.has(memoKey)) {
      return forecastCache.get(memoKey);
    }

    const h = TEAM_RATINGS[hKey] || { att: 1.20, def: 1.20, homeBoost: 0.10 };
    const a = TEAM_RATINGS[aKey] || { att: 1.20, def: 1.20, homeBoost: 0.10 };

    const avgHome = 1.35;
    const avgAway = 1.10;

    const attH = Math.max(0, Math.min(3, Number(ctx.attackingAbsencesHome) || 0));
    const defH = Math.max(0, Math.min(3, Number(ctx.defensiveAbsencesHome) || 0));
    const motH = Math.max(-1, Math.min(1, Number(ctx.motivationHome) || 0));

    const attA = Math.max(0, Math.min(3, Number(ctx.attackingAbsencesAway) || 0));
    const defA = Math.max(0, Math.min(3, Number(ctx.defensiveAbsencesAway) || 0));
    const motA = Math.max(-1, Math.min(1, Number(ctx.motivationAway) || 0));

    const homeXg = Math.max(0.15, avgHome * (h.att / 1.25) * (a.def / 1.25) * 1.05 * (1 + h.homeBoost) * (1 + motH * 0.03) * (1 - 0.04 * attH) * (1 + 0.04 * defA));
    const awayXg = Math.max(0.15, avgAway * (a.att / 1.25) * (h.def / 1.25) * (1 - a.homeBoost * 0.35) * (1 + motA * 0.03) * (1 - 0.04 * attA) * (1 + 0.04 * defH));

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

  // Catalogo standard dei mercati calcistici supportati
  const STANDARD_MARKETS = [
    { key: "home", label: "1 (Vittoria Casa)", shortLabel: "1", cat: "1x2", catName: "Esito Finale (1X2)" },
    { key: "draw", label: "X (Pareggio)", shortLabel: "X", cat: "1x2", catName: "Esito Finale (1X2)" },
    { key: "away", label: "2 (Vittoria Ospite)", shortLabel: "2", cat: "1x2", catName: "Esito Finale (1X2)" },
    { key: "dc1X", label: "1X (Casa o Pareggio)", shortLabel: "1X", cat: "dc", catName: "Doppia Chance" },
    { key: "dcX2", label: "X2 (Pareggio o Ospite)", shortLabel: "X2", cat: "dc", catName: "Doppia Chance" },
    { key: "dc12", label: "12 (Casa o Ospite)", shortLabel: "12", cat: "dc", catName: "Doppia Chance" },
    { key: "over15", label: "Over 1.5 Gol", shortLabel: "Over 1.5", cat: "uo", catName: "Under / Over" },
    { key: "under15", label: "Under 1.5 Gol", shortLabel: "Under 1.5", cat: "uo", catName: "Under / Over" },
    { key: "over25", label: "Over 2.5 Gol", shortLabel: "Over 2.5", cat: "uo", catName: "Under / Over" },
    { key: "under25", label: "Under 2.5 Gol", shortLabel: "Under 2.5", cat: "uo", catName: "Under / Over" },
    { key: "over35", label: "Over 3.5 Gol", shortLabel: "Over 3.5", cat: "uo", catName: "Under / Over" },
    { key: "under35", label: "Under 3.5 Gol", shortLabel: "Under 3.5", cat: "uo", catName: "Under / Over" },
    { key: "bttsYes", label: "Gol (Entrambe segnano)", shortLabel: "Gol", cat: "btts", catName: "Gol / No Gol" },
    { key: "bttsNo", label: "No Gol (Almeno una a secco)", shortLabel: "No Gol", cat: "btts", catName: "Gol / No Gol" }
  ];

  // Valutazione statistica trasparente e comprensibile per ciascun mercato
  function evaluateMarketSelection(prob, odd, fairOdds, ev, marketKey, marketLabel, home, away, homeXg, awayXg) {
    const pct = Math.round((prob || 0) * 100);
    const evPct = ev != null ? Math.round(ev * 100) : null;
    const totXg = ((homeXg || 0) + (awayXg || 0)).toFixed(1);

    let type = "neutral";
    let badgeText = `🟡 Equilibrata (${pct}%)`;
    let badgeClass = "mm-verdict-neutral";
    let tagText = `🟡 ${pct}%`;
    let shortVerdict = "Quota equilibrata";
    let explanation = "";

    if (odd != null && Number.isFinite(odd) && odd > 1.0) {
      // 1. Quota Trappola: quota molto bassa che non ripaga il rischio reale
      if (odd < 1.45 && ev < -0.06) {
        type = "trap";
        badgeText = "🔴 Quota Trappola";
        badgeClass = "mm-verdict-trap";
        tagText = `🔴 ${pct}%`;
        shortVerdict = "Sconsigliata: quota sgonfiata";
        explanation = `Sisal paga solo ${odd.toFixed(2)}, ma la probabilità reale è del ${pct}% (quota equa ${fairOdds.toFixed(2)}). Rendimento atteso negativo (${evPct}% EV): il rischio di sorpresa non è ripagato dalla vincita minima.`;
      }
      // 2. Ottimo Valore: quota Sisal più generosa della reale probabilità
      else if (ev >= 0.05 && prob >= 0.28) {
        type = "value";
        badgeText = `🟢 Ottimo Valore (+${evPct}% EV)`;
        badgeClass = "mm-verdict-value";
        tagText = `🟢 +EV ${pct}%`;
        shortVerdict = "Consigliata per valore (+EV)";
        explanation = `Sisal quota l'esito a ${odd.toFixed(2)}, nettamente sopra la quota equa stimata (${fairOdds.toFixed(2)} con stima reale al ${pct}%). EV nominale positivo secondo questa stima; non garantisce un risultato positivo.`;
      }
      // 3. Alta Probabilità: esito molto probabile e solido
      else if (prob >= 0.60 && ev >= -0.08) {
        type = "highprob";
        badgeText = `🔵 Molto Probabile (${pct}%)`;
        badgeClass = "mm-verdict-highprob";
        tagText = `🔵 Top ${pct}%`;
        shortVerdict = "Alta probabilità di riuscita";
        explanation = `Probabilità elevata (${pct}%). Esito stimato frequente; la probabilità non implica convenienza e la quota resta ${odd.toFixed(2)}.`;
      }
      // 4. Sconsigliata: probabilità bassa o quota troppo sbilanciata a favore del bookmaker
      else if (prob < 0.35 || ev < -0.15) {
        type = "sconsigliata";
        badgeText = "🔴 Sconsigliata";
        badgeClass = "mm-verdict-sconsigliata";
        tagText = `🔴 ${pct}% ⚠️`;
        shortVerdict = "Rischio elevato / Non conveniente";
        explanation = `Probabilità ridotta (${pct}%) e quota ${odd.toFixed(2)} che non compensa a sufficienza l'incertezza statistica (quota minima equa: ${fairOdds.toFixed(2)}).`;
      }
      // 5. Neutra: quota allineata alle probabilità
      else {
        type = "neutral";
        badgeText = `🟡 Equilibrata (${pct}%)`;
        badgeClass = "mm-verdict-neutral";
        tagText = `🟡 ${pct}%`;
        shortVerdict = "Quota allineata";
        explanation = `Probabilità stimata al ${pct}% con quota Sisal a ${odd.toFixed(2)} allineata al mercato (quota equa ${fairOdds.toFixed(2)}).`;
      }
    } else {
      // Valutazione teorica preventiva (se la quota Sisal non è ancora visibile a schermo)
      if (prob >= 0.60) {
        type = "highprob";
        badgeText = `🔵 Molto Probabile (${pct}%)`;
        badgeClass = "mm-verdict-highprob";
        tagText = `🔵 ${pct}%`;
        shortVerdict = "Alta probabilità stimata";
        explanation = `Stima MatchMind molto solida (${pct}%). Consigliata se Sisal offre una quota superiore a ${fairOdds.toFixed(2)}.`;
      } else if (prob <= 0.35) {
        type = "sconsigliata";
        badgeText = `🔴 Bassa Probabilità (${pct}%)`;
        badgeClass = "mm-verdict-sconsigliata";
        tagText = `🔴 ${pct}%`;
        shortVerdict = "Esito poco probabile";
        explanation = `Stima MatchMind al ${pct}%. Richiede una quota elevata (almeno ${fairOdds.toFixed(2)}) per avere valore.`;
      } else {
        type = "neutral";
        badgeText = `🟡 Media Probabilità (${pct}%)`;
        badgeClass = "mm-verdict-neutral";
        tagText = `🟡 ${pct}%`;
        shortVerdict = "In equilibrio";
        explanation = `Stima MatchMind al ${pct}% (quota equa teorica: ${fairOdds.toFixed(2)}).`;
      }
    }

    // Nota tattica contestuale e chiara
    let tacticalNote = "";
    if (marketKey === "home") {
      tacticalNote = `${home} favorita dal fattore campo (${(homeXg || 1.2).toFixed(1)} xG previsti vs ${(awayXg || 1.2).toFixed(1)} di ${away}).`;
    } else if (marketKey === "away") {
      tacticalNote = `${away} in trasferta con ${(awayXg || 1.2).toFixed(1)} xG previsti vs ${(homeXg || 1.2).toFixed(1)} di ${home}.`;
    } else if (marketKey === "draw") {
      tacticalNote = `Previsione di equilibrio tattico e pochi strappi (${(homeXg || 1.2).toFixed(1)} vs ${(awayXg || 1.2).toFixed(1)} xG).`;
    } else if (marketKey.startsWith("over")) {
      tacticalNote = `Indice offensivo complessivo aperto (${totXg} gol attesi previsti nel match).`;
    } else if (marketKey.startsWith("under")) {
      tacticalNote = `Difese solide o volume occasioni contenuto (${totXg} gol attesi complessivi).`;
    } else if (marketKey === "bttsYes") {
      tacticalNote = `Buone chance che entrambe le squadre vadano a segno (${(homeXg || 1.2).toFixed(1)} e ${(awayXg || 1.2).toFixed(1)} xG).`;
    } else if (marketKey === "bttsNo") {
      tacticalNote = "Probabile che almeno una squadra non riesca a trovare la via della rete.";
    } else if (marketKey.startsWith("dc")) {
      tacticalNote = "Opzione di copertura per ridurre il rischio rispetto all'esito secco.";
    }

    return {
      type,
      badgeText,
      badgeClass,
      tagText,
      shortVerdict,
      explanation,
      tacticalNote,
      pct,
      evPct,
      odd: odd || null,
      fairOdds: fairOdds || (prob ? 1 / prob : 2.0)
    };
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
    /* --- HUD ISPETTORE QUOTA INTERATTIVO --- */
    #mm-inspector-hud {
      position: fixed !important;
      bottom: 65px !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      width: calc(100vw - 24px) !important;
      max-width: 400px !important;
      background: #091224 !important;
      border: 1px solid #1e293b !important;
      border-radius: 12px !important;
      box-shadow: 0 10px 35px rgba(0,0,0,0.92), 0 0 0 1px rgba(56,189,248,0.3) !important;
      color: #f1f5f9 !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      padding: 10px 12px !important;
      z-index: 9999999 !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 6px !important;
      animation: mmSlideUp 0.22s cubic-bezier(0.16, 1, 0.3, 1) !important;
      box-sizing: border-box !important;
      backdrop-filter: blur(14px) !important;
    }

    @keyframes mmSlideUp {
      from { transform: translate(-50%, 35px); opacity: 0; }
      to { transform: translate(-50%, 0); opacity: 1; }
    }

    .mm-hud-top {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
    }

    .mm-hud-match {
      font-size: 11px !important;
      font-weight: 800 !important;
      color: #38bdf8 !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      max-width: 250px !important;
    }

    .mm-hud-close {
      background: #1e293b !important;
      border: none !important;
      color: #94a3b8 !important;
      width: 22px !important;
      height: 22px !important;
      border-radius: 11px !important;
      cursor: pointer !important;
      font-size: 12px !important;
      font-weight: bold !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 0 !important;
    }
    .mm-hud-close:hover {
      background: #334155 !important;
      color: #ffffff !important;
    }

    .mm-hud-selection-row {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      padding: 2px 0 !important;
    }

    .mm-hud-selection {
      font-size: 13px !important;
      font-weight: 900 !important;
      color: #ffffff !important;
    }

    .mm-hud-odd {
      color: #c4f36a !important;
      font-weight: 800 !important;
      font-size: 13px !important;
    }

    .mm-verdict-badge {
      display: inline-flex !important;
      align-items: center !important;
      padding: 2px 8px !important;
      border-radius: 4px !important;
      font-size: 10px !important;
      font-weight: 900 !important;
      letter-spacing: 0.3px !important;
      text-transform: uppercase !important;
    }
    .mm-verdict-value {
      background: #064e3b !important;
      color: #34d399 !important;
      border: 1px solid #10b981 !important;
    }
    .mm-verdict-highprob {
      background: #082f49 !important;
      color: #38bdf8 !important;
      border: 1px solid #0284c7 !important;
    }
    .mm-verdict-neutral {
      background: #451a03 !important;
      color: #fbbf24 !important;
      border: 1px solid #d97706 !important;
    }
    .mm-verdict-trap {
      background: #450a0a !important;
      color: #f87171 !important;
      border: 1px solid #ef4444 !important;
    }

    .mm-hud-metrics {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      font-size: 10px !important;
      color: #94a3b8 !important;
      background: #0f172a !important;
      padding: 5px 8px !important;
      border-radius: 6px !important;
      border: 1px solid #1e293b !important;
    }

    .mm-hud-metrics b {
      color: #f8fafc !important;
    }

    .mm-hud-reason {
      font-size: 10px !important;
      line-height: 1.35 !important;
      color: #e2e8f0 !important;
      padding: 5px 8px !important;
      border-radius: 5px !important;
      background: rgba(15,23,42,0.7) !important;
      border-left: 3px solid #0284c7 !important;
    }

    .mm-hud-actions {
      display: flex !important;
      align-items: center !important;
      gap: 6px !important;
      margin-top: 2px !important;
    }

    .mm-hud-send-btn {
      flex: 1 !important;
      background: #0284c7 !important;
      color: #ffffff !important;
      border: none !important;
      border-radius: 6px !important;
      padding: 7px 10px !important;
      font-size: 11px !important;
      font-weight: 800 !important;
      cursor: pointer !important;
      text-align: center !important;
      transition: background 0.15s ease !important;
    }
    .mm-hud-send-btn:hover {
      background: #0369a1 !important;
    }

    .mm-prob-tag {
      display: block !important;
      margin: 2px auto 0 auto !important;
      width: fit-content !important;
      max-width: 90% !important;
      background: #081a2e !important;
      color: #38bdf8 !important;
      border: 1px solid #0284c7 !important;
      border-radius: 4px !important;
      font-size: 10px !important;
      font-weight: 800 !important;
      padding: 1px 4px !important;
      line-height: 1.2 !important;
      text-align: center !important;
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

    #mm-resize-grip {
      position: sticky; align-self: flex-end; flex: 0 0 auto; bottom: -6px; width: 20px; height: 20px; margin: -14px -6px -6px auto;
      cursor: nwse-resize; touch-action: none; z-index: 5; opacity: .8;
      background: linear-gradient(135deg, transparent 0 45%, #64748b 45% 55%, transparent 55% 65%, #64748b 65% 75%, transparent 75%);
    }
    #mm-resize-grip:hover { opacity: 1; }
    #mm-widget {
      position: fixed;
      bottom: 70px;
      right: 12px;
      z-index: 999999;
      background: #0b1324;
      color: #e2e8f0;
      border: 1px solid #1e293b;
      border-radius: 12px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.85), 0 0 0 1px rgba(56,189,248,0.2);
      width: 320px;
      max-width: calc(100vw - 24px);
      max-height: 52vh;
      display: flex;
      flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 11px;
      padding: 10px;
      gap: 7px;
      touch-action: none;
      box-sizing: border-box;
      backdrop-filter: blur(10px);
    }

    #mm-widget.mm-is-minimized {
      width: auto !important;
      height: 34px !important;
      min-height: 34px !important;
      max-height: 34px !important;
      padding: 0 10px !important;
      border-radius: 17px !important;
      background: #081a2e !important;
      border: 1px solid #0284c7 !important;
      cursor: pointer !important;
      box-shadow: 0 4px 16px rgba(0,0,0,0.7) !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      overflow: hidden !important;
      gap: 6px !important;
    }

    #mm-floating-badge {
      position: fixed;
      bottom: 70px;
      right: 12px;
      width: 34px;
      height: 34px;
      border-radius: 17px;
      background: #081a2e;
      border: 1px solid #0284c7;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999998;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.6);
      font-size: 16px;
      user-select: none;
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
  

    /* Mercati completi e valutazioni leggibili */
    .mm-view-tabs { display:grid !important; grid-template-columns:1fr 1fr !important; gap:4px !important; background:#081224 !important; padding:3px !important; border-radius:8px !important; }
    .mm-view-tab { background:transparent !important; color:#94a3b8 !important; border:0 !important; border-radius:6px !important; padding:5px 3px !important; font-size:9px !important; font-weight:800 !important; cursor:pointer !important; }
    .mm-view-tab.active { background:#0284c7 !important; color:white !important; }
    .mm-cat-row { display:flex !important; gap:3px !important; overflow-x:auto !important; padding:1px 0 3px !important; }
    .mm-cat-btn { background:#152238 !important; color:#cbd5e1 !important; border:1px solid #334155 !important; border-radius:12px !important; font-size:9px !important; padding:3px 7px !important; white-space:nowrap !important; cursor:pointer !important; }
    .mm-cat-btn.active { background:#0284c7 !important; color:white !important; border-color:#38bdf8 !important; }
    .mm-legend-bar { display:flex !important; justify-content:space-between !important; font-size:8px !important; color:#cbd5e1 !important; gap:3px !important; }
    .mm-legend-item { white-space:nowrap !important; }
    .mm-legend-item i { display:inline-block !important; width:6px !important; height:6px !important; border-radius:50% !important; margin-right:2px !important; }
    .mm-legend-item .dot-val { background:#10b981 !important; }
    .mm-legend-item .dot-high { background:#38bdf8 !important; }
    .mm-legend-item .dot-neu { background:#facc15 !important; }
    .mm-legend-item .dot-trap { background:#ef4444 !important; }
    .mm-item-cat { font-size:8px !important; color:#94a3b8 !important; text-transform:uppercase !important; font-weight:800 !important; }
    .mm-odd-badge { background:#0f172a !important; border:1px solid #334155 !important; border-radius:5px !important; padding:2px 5px !important; color:#c4f36a !important; font-size:9px !important; white-space:nowrap !important; }
    .mm-odd-badge.muted { color:#94a3b8 !important; }
    .mm-verdict-row { display:flex !important; align-items:center !important; gap:5px !important; flex-wrap:wrap !important; }
    .mm-verdict-short { color:#cbd5e1 !important; font-size:9px !important; font-weight:700 !important; }
    .mm-verdict-sconsigliata { background:#2a1118 !important; color:#fda4af !important; border:1px solid #f43f5e !important; }
    .mm-card-reason { display:flex !important; flex-direction:column !important; gap:2px !important; line-height:1.35 !important; }
    .mm-reason-desc { color:#f1f5f9 !important; }
    .mm-reason-tactical { color:#94a3b8 !important; font-size:8px !important; }
    .mm-item-card.is-value { border-color:#10b981 !important; }
    .mm-item-card.is-highprob { border-color:#0284c7 !important; }
    .mm-item-card.is-trap, .mm-item-card.is-sconsigliata { border-color:#ef4444 !important; }
    .mm-item-card.is-neutral { border-color:#ca8a04 !important; }
    .mm-prob-tag.is-value { background:#064e3b !important; color:#34d399 !important; border-color:#10b981 !important; }
    .mm-prob-tag.is-highprob { background:#082f49 !important; color:#38bdf8 !important; border-color:#0284c7 !important; }
    .mm-prob-tag.is-neutral { background:#362507 !important; color:#fde047 !important; border-color:#ca8a04 !important; }
    .mm-prob-tag.is-trap, .mm-prob-tag.is-sconsigliata { background:#450a0a !important; color:#fca5a5 !important; border-color:#ef4444 !important; }
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

    // Estrae il titolo del mercato immediato e l'eventuale linea (Under/Over) per un bottone quota
  function getMarketContext(btn) {
    let marketTitle = "";
    let lineInfo = "";

    let curr = btn.parentElement;
    for (let i = 0; i < 4 && curr && curr !== document.body; i++) {
      if (!lineInfo) {
        const sel = curr.querySelector("select");
        if (sel) lineInfo = sel.value || (sel.options && sel.options[sel.selectedIndex]?.text) || "";
      }
      const titleEl = curr.querySelector("h3, h4, h5, [class*='market-title'], [class*='marketTitle'], [class*='market_title'], [class*='title']");
      if (titleEl && !titleEl.contains(btn) && !titleEl.closest("button")) {
        const t = (titleEl.innerText || titleEl.textContent || "").trim();
        if (t && !t.toUpperCase().includes("TOP SCOMMESSE") && t.length < 45) {
          marketTitle = t;
          break;
        }
      }
      let prev = curr.previousElementSibling;
      while (prev) {
        const t = (prev.innerText || prev.textContent || "").trim();
        if (t && t.length < 45 && !t.toUpperCase().includes("TOP SCOMMESSE")) {
          marketTitle = t;
          break;
        }
        prev = prev.previousElementSibling;
      }
      if (marketTitle) break;
      curr = curr.parentElement;
    }

    const attrText = (btn.getAttribute("aria-label") || "") + " " + (btn.getAttribute("title") || "") + " " + (btn.getAttribute("data-qa") || "");
    return { marketTitle, lineInfo, attrText };
  }

  // Risolve quota numerica e tipologia mercato Sisal per un bottone
  function resolveOddsButton(btn) {
    let label = "";
    let val = null;

    // 1. Cerca nei nodi figli diretti (escludendo badge MM)
    const children = Array.from(btn.children).filter(el => !el.classList.contains("mm-prob-tag") && !el.classList.contains("mm-badge-recommended"));
    if (children.length >= 2) {
      for (const c of children) {
        const txt = (c.innerText || c.textContent || "").trim();
        const m = txt.match(/^(\d+[.,]\d{2})$/);
        if (m && !val) val = parseFloat(m[1].replace(",", "."));
        else if (!label && txt.length < 25) label = txt;
      }
    }

    // 2. Fallback su righe di testo
    if (!val) {
      const rawText = (btn.innerText || btn.textContent || "").trim();
      const parts = rawText.split(/[\r\n\s]+/).map(p => p.trim()).filter(Boolean);
      for (const p of parts) {
        const m = p.match(/^(\d+[.,]\d{2})$/);
        if (m && !val) val = parseFloat(m[1].replace(",", "."));
        else if (!label && !m && p.length < 25) label = p;
      }
    }

    // 3. Fallback su aria-label
    if (!val) {
      const aria = btn.getAttribute("aria-label") || "";
      const m = aria.match(/\b(\d+[.,]\d{2})\b/);
      if (m) val = parseFloat(m[1].replace(",", "."));
    }

    if (!val || isNaN(val) || val <= 1.0) return null;

    const { marketTitle, lineInfo, attrText } = getMarketContext(btn);
    const lNorm = (label || "").trim().toUpperCase();
    const mNorm = ((marketTitle || "") + " " + (attrText || "")).toLowerCase();

    // Esclusioni mercati non supportati dal modello full-time 90 min
    if (mNorm.includes("1° t") || mNorm.includes("1° tempo") || mNorm.includes("primo tempo") ||
        mNorm.includes("2° t") || mNorm.includes("2° tempo") || mNorm.includes("secondo tempo") ||
        mNorm.includes("multigoal") || mNorm.includes("handicap") || mNorm.includes("combo") ||
        mNorm.includes("parziale") || mNorm.includes("corner") || mNorm.includes("cartellin") ||
        mNorm.includes("marcatore") || mNorm.includes("rigore") || mNorm.includes("espulsion") ||
        mNorm.includes("somma gol")) {
      return null;
    }

    // Doppia Chance
    if (lNorm === "1X" || lNorm === "1-X" || mNorm.includes("doppia chance 1x")) {
      return { key: "dc1X", label: "1X (Casa o Pareggio)", shortLabel: "1X", cat: "dc", catName: "Doppia Chance", odd: val };
    }
    if (lNorm === "X2" || lNorm === "X-2" || mNorm.includes("doppia chance x2")) {
      return { key: "dcX2", label: "X2 (Pareggio o Ospite)", shortLabel: "X2", cat: "dc", catName: "Doppia Chance", odd: val };
    }
    if (lNorm === "12" || lNorm === "1-2" || mNorm.includes("doppia chance 12")) {
      return { key: "dc12", label: "12 (Casa o Ospite)", shortLabel: "12", cat: "dc", catName: "Doppia Chance", odd: val };
    }

    // Goal / No Goal
    if (lNorm === "GOAL" || lNorm === "GOL" || lNorm === "GG" || (mNorm.includes("goal") && (lNorm === "SI" || lNorm === "SÌ"))) {
      return { key: "bttsYes", label: "Gol (Entrambe segnano)", shortLabel: "Gol", cat: "btts", catName: "Gol / No Gol", odd: val };
    }
    if (lNorm === "NOGOAL" || lNorm === "NO GOAL" || lNorm === "NO GOL" || lNorm === "NG" || (mNorm.includes("goal") && lNorm === "NO")) {
      return { key: "bttsNo", label: "No Gol (Almeno una a secco)", shortLabel: "No Gol", cat: "btts", catName: "Gol / No Gol", odd: val };
    }

    // Under / Over
    if (lNorm === "UNDER" || lNorm === "OVER" || lNorm.startsWith("U ") || lNorm.startsWith("O ") || mNorm.includes("under") || mNorm.includes("over")) {
      const isOver = lNorm === "OVER" || lNorm.startsWith("O") || mNorm.includes("over");
      let line = "2.5";
      const lineStr = (lineInfo + " " + mNorm + " " + (btn.textContent || ""));
      if (lineStr.includes("1.5") || lineStr.includes("1,5")) line = "1.5";
      else if (lineStr.includes("3.5") || lineStr.includes("3,5")) line = "3.5";
      else if (lineStr.includes("2.5") || lineStr.includes("2,5")) line = "2.5";

      if (line === "1.5") {
        return isOver ?
          { key: "over15", label: "Over 1.5 Gol", shortLabel: "Over 1.5", cat: "uo", catName: "Under / Over", odd: val } :
          { key: "under15", label: "Under 1.5 Gol", shortLabel: "Under 1.5", cat: "uo", catName: "Under / Over", odd: val };
      }
      if (line === "3.5") {
        return isOver ?
          { key: "over35", label: "Over 3.5 Gol", shortLabel: "Over 3.5", cat: "uo", catName: "Under / Over", odd: val } :
          { key: "under35", label: "Under 3.5 Gol", shortLabel: "Under 3.5", cat: "uo", catName: "Under / Over", odd: val };
      }
      return isOver ?
        { key: "over25", label: "Over 2.5 Gol", shortLabel: "Over 2.5", cat: "uo", catName: "Under / Over", odd: val } :
        { key: "under25", label: "Under 2.5 Gol", shortLabel: "Under 2.5", cat: "uo", catName: "Under / Over", odd: val };
    }

    // 1X2 Finale
    if (lNorm === "1") {
      return { key: "home", label: "1 (Vittoria Casa)", shortLabel: "1", cat: "1x2", catName: "Esito Finale (1X2)", odd: val };
    }
    if (lNorm === "X") {
      return { key: "draw", label: "X (Pareggio)", shortLabel: "X", cat: "1x2", catName: "Esito Finale (1X2)", odd: val };
    }
    if (lNorm === "2") {
      return { key: "away", label: "2 (Vittoria Ospite)", shortLabel: "2", cat: "1x2", catName: "Esito Finale (1X2)", odd: val };
    }

    return null;
  }

  // Compatibilità legacy
  function parseSisalMarket(text) {
    const t = String(text || "").trim().toLowerCase();
    if (t === "1") return { key: "home", label: "1 (Vittoria Casa)", shortLabel: "1", cat: "1x2", catName: "Esito Finale (1X2)" };
    if (t === "x") return { key: "draw", label: "X (Pareggio)", shortLabel: "X", cat: "1x2", catName: "Esito Finale (1X2)" };
    if (t === "2") return { key: "away", label: "2 (Vittoria Ospite)", shortLabel: "2", cat: "1x2", catName: "Esito Finale (1X2)" };
    if (t === "1x") return { key: "dc1X", label: "1X (Casa o Pareggio)", shortLabel: "1X", cat: "dc", catName: "Doppia Chance" };
    if (t === "x2") return { key: "dcX2", label: "X2 (Pareggio o Ospite)", shortLabel: "X2", cat: "dc", catName: "Doppia Chance" };
    if (t === "12") return { key: "dc12", label: "12 (Casa o Ospite)", shortLabel: "12", cat: "dc", catName: "Doppia Chance" };
    return null;
  }

  // Rilevamento partita singola con fallback su URL pathname, title e DOM
  function detectSingleMatch() {
    const teamSepRegex = /([A-Za-z0-9\s]{3,22})\s*(?:[-–—/]|[\r\n]+|\bvs\b|\bv\b|\bvs\.)\s*([A-Za-z0-9\s]{3,22})/i;

    // 1. Fallback su pathname URL Sisal (es. /sco

... [truncated — file is 111575 bytes, showing first 51200]