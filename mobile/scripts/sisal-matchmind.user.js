// ==UserScript==
// @name         MatchMind · Sisal Value Bets & Sync
// @namespace    https://sonostevecazzo.github.io/MatchMind/
// @version      2.16.3
// @description  Valutazione statistica chiara per tutti i mercati Sisal supportati, non solo quelli consigliati.
// @author       Simone Sedda & MatchMind
// @match        https://www.sisal.it/*
// @match        https://*.sisal.it/*
// @match        https://www.sisal.it/scommesse-matchpoint*
// @match        https://scommesse.sisal.it/*
// @match        https://sonostevecazzo.github.io/MatchMind/*
// @match        https://matchmind-3te.pages.dev/*
// @match        https://*.matchmind-3te.pages.dev/*
// @match        https://matchmind-arena-compass.lovable.app/*
// @match        http://localhost:8080/*
// @updateURL    https://raw.githubusercontent.com/Sonostevecazzo/MatchMind/recovery/nba-mainline-20261110/mobile/scripts/sisal-matchmind.user.js
// @downloadURL  https://raw.githubusercontent.com/Sonostevecazzo/MatchMind/recovery/nba-mainline-20261110/mobile/scripts/sisal-matchmind.user.js
// @icon         https://sonostevecazzo.github.io/MatchMind/icon.svg
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function() {
  'use strict';
  const MM_SCRIPT_VERSION = "2.16.3";
  const gmGet = (k, d) => { try { return typeof GM_getValue === "function" ? GM_getValue(k, d) : d; } catch (e) { return d; } };
  const gmSet = (k, v) => { try { if (typeof GM_setValue === "function") GM_setValue(k, v); } catch (e) {} };

  // --- PONTE MATCHMIND (v2.2): sulle pagine dell'app copia lo stato delle giocate inviate a Sisal ---
  if (!/(^|\.)sisal\.it$/i.test(location.hostname)) {
    if (!document.querySelector('body[data-page]') && !/bets\.html/.test(location.pathname)) return;
    const sync = () => {
      try {
        const raw = (typeof GM_getValue === "function" && GM_getValue("mm_play_queue", "")) || "[]";
        if (localStorage.getItem("mm_sisal_play_status") !== raw) {
          localStorage.setItem("mm_sisal_play_status", raw);
          window.dispatchEvent(new CustomEvent("mm-sisal-status"));
        }
        if (localStorage.getItem("mm_sisal_script_version") !== MM_SCRIPT_VERSION) localStorage.setItem("mm_sisal_script_version", MM_SCRIPT_VERSION);
        const seen = String(gmGet("mm_sisal_last_seen", "") || "");
        if (seen && localStorage.getItem("mm_sisal_seen_on_sisal") !== seen) localStorage.setItem("mm_sisal_seen_on_sisal", seen);
        const cart = String(gmGet("mm_sisal_cart", "") || "");
        if (cart && localStorage.getItem("mm_sisal_cart") !== cart) { localStorage.setItem("mm_sisal_cart", cart); window.dispatchEvent(new CustomEvent("mm-sisal-status")); }
      } catch (e) {}
    };
    sync(); setInterval(sync, 5000);
    return;
  }

  const MATCHMIND_URL = "https://recovery-nba-mainline-202611.matchmind-3te.pages.dev/bets.html";

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

  // Nessun rating di squadra viene assunto come xG verificato: usare baseline neutra finché non esiste una fonte versionata e validata.
  const TEAM_RATINGS = {};

  // Fail-closed gate: never publish probabilities from a neutral placeholder.
  // A rating is accepted only with an explicit validation flag and traceable dataset provenance.
  function isCalibratedTeamRating(rating) {
    if (!rating || rating.validated !== true) return false;
    if (typeof rating.source !== "string" || !rating.source.trim()) return false;
    if (typeof rating.datasetVersion !== "string" || !rating.datasetVersion.trim()) return false;
    return ["att", "def", "homeBoost"].every(key =>
      rating[key] !== null && rating[key] !== "" && Number.isFinite(Number(rating[key]))
    ) && Number(rating.att) > 0 && Number(rating.def) > 0 &&
      Number(rating.homeBoost) >= 0 && Number(rating.homeBoost) <= 0.5;
  }

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

  // Motore Poisson esplorativo MatchMind (matrice gol 0-12) con correttivi manuali non verificati.
  function calculateMatchMindForecast(homeName, awayName) {
    const hKey = canonicalTeam(homeName);
    const aKey = canonicalTeam(awayName);
    const ctx = getMatchContext(homeName, awayName);
    const ctxHash = `${ctx.attackingAbsencesHome||0}_${ctx.defensiveAbsencesHome||0}_${ctx.motivationHome||0}_${ctx.attackingAbsencesAway||0}_${ctx.defensiveAbsencesAway||0}_${ctx.motivationAway||0}`;
    const memoKey = `${hKey}|${aKey}|${ctxHash}`;

    if (forecastCache.has(memoKey)) {
      return forecastCache.get(memoKey);
    }

    const h = TEAM_RATINGS[hKey];
    const a = TEAM_RATINGS[aKey];
    if (!isCalibratedTeamRating(h) || !isCalibratedTeamRating(a)) {
      const unavailable = {
        homeName, awayName, homeXg: null, awayXg: null,
        forecastAvailable: false,
        dataQuality: "insufficient",
        reason: "Mancano rating squadra verificati e versionati per entrambe le formazioni.",
        probabilities: {
          home: null, draw: null, away: null, dc1X: null, dcX2: null, dc12: null,
          over15: null, under15: null, over25: null, under25: null,
          over35: null, under35: null, bttsYes: null, bttsNo: null
        }
      };
      forecastCache.set(memoKey, unavailable);
      return unavailable;
    }

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

    for (let hg = 0; hg <= 12; hg++) {
      for (let ag = 0; ag <= 12; ag++) {
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

    // Normalizza la matrice troncata: evita che le probabilità sommino meno di 1.
    const matrixMass = pHome + pDraw + pAway;
    if (matrixMass > 0) {
      pHome /= matrixMass; pDraw /= matrixMass; pAway /= matrixMass;
      o15 /= matrixMass; u15 /= matrixMass; o25 /= matrixMass; u25 /= matrixMass;
      o35 /= matrixMass; u35 /= matrixMass; bttsYes /= matrixMass; bttsNo /= matrixMass;
    }

    const result = {
      homeName,
      awayName,
      homeXg,
      awayXg,
      forecastAvailable: true,
      dataQuality: "validated-ratings",
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
    .mm-selected-from-app {
      outline: 3px solid #c4f36a !important;
      outline-offset: 1px !important;
      background: rgba(132,204,22,.18) !important;
      box-shadow: 0 0 0 3px rgba(132,204,22,.16) !important;
    }
    .mm-selected-app-tag {
      display: block !important;
      width: fit-content !important;
      max-width: 100% !important;
      margin: 3px auto 0 !important;
      padding: 2px 6px !important;
      border-radius: 5px !important;
      background: #365314 !important;
      border: 1px solid #a3e635 !important;
      color: #ecfccb !important;
      font-size: 10px !important;
      line-height: 1.25 !important;
      font-weight: 900 !important;
      pointer-events: none !important;
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
      touch-action: pan-y;
      overflow-y: auto;
      overscroll-behavior: contain;
      -webkit-overflow-scrolling: touch;
      box-sizing: border-box;
      backdrop-filter: blur(10px);
    }

    @media (max-width: 600px) {
      #mm-widget {
        width: min(370px, calc(100vw - 18px)) !important;
        max-width: calc(100vw - 18px) !important;
        max-height: 46dvh !important;
        right: 9px !important;
        bottom: calc(82px + env(safe-area-inset-bottom)) !important;
        padding: 8px !important;
        gap: 5px !important;
      }
      #mm-play-queue-items { max-height: 180px; overflow-y: auto; overscroll-behavior: contain; }
      #mm-play-toggle, #mm-play-clear { min-height: 32px; padding: 3px 7px; font-size: 10px; }
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
    for (let i = 0; i < 8 && curr && curr !== document.body; i++) {
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
    const lPlain = lNorm.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const mNorm = ((marketTitle || "") + " " + (attrText || "")).toLowerCase();
    const hasOverLabel = /\b(over|oltre)\b|piu\s+di|more\s+than/.test(lPlain.toLowerCase());
    const hasUnderLabel = /\bunder\b|meno\s+di|less\s+than/.test(lPlain.toLowerCase());

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
    if (lNorm === "UNDER" || lNorm === "OVER" || lNorm.startsWith("U ") || lNorm.startsWith("O ") ||
        hasOverLabel || hasUnderLabel || mNorm.includes("under") || mNorm.includes("over")) {
      const isOver = hasOverLabel || lNorm === "OVER" || lNorm.startsWith("O") ||
        (!hasUnderLabel && mNorm.includes("over"));
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
  function parseSisalTeamPair(value) {
    const text = String(value || "").replace(/\s+/g, " ").trim().slice(0, 360);
    if (!text) return null;
    const match = text.match(/([\p{L}\p{N}][\p{L}\p{N}\s.'’&()_-]{1,38}?)\s*(?:[-–—/]|\bvs\.?\b|\bv\.?\b)\s*([\p{L}\p{N}][\p{L}\p{N}\s.'’&()_-]{1,38})/iu);
    if (!match) return null;
    const clean = value => String(value || "").replace(/^(?:\d{1,2}:\d{2}\s+)?(quote|scommesse|partita|live)\s+/i, "").replace(/^\d{1,2}:\d{2}\s+/, "").replace(/\s+(scommesse|quote|sisal|calcio|serie).*$/i, "").trim();
    const home = clean(match[1]), away = clean(match[2]);
    if (home.length < 3 || away.length < 3 || canonicalTeam(home) === canonicalTeam(away)) return null;
    return { home, away };
  }

  function detectSingleMatch() {
    // URL: riconosce soltanto slug formati da due squadre note, mai sezioni come "serie-a".
    try {
      const segments = String(location.pathname || "").toLowerCase().split("/").filter(Boolean);
      for (let i = segments.length - 1; i >= 0; i--) {
        const words = segments[i].replace(/-\d{6,}$/, "").split("-").filter(Boolean);
        for (let split = 1; split < words.length; split++) {
          const home = words.slice(0, split).join(" ");
          const away = words.slice(split).join(" ");
          const h = canonicalTeam(home), a = canonicalTeam(away);
          if (TEAM_ALIASES[h] && TEAM_ALIASES[a] && h !== a) return { home, away };
        }
      }
    } catch (e) {}

    const titlePair = parseSisalTeamPair(document.title);
    if (titlePair) return titlePair;

    const headingSelector = "h1,h2,h3,h4,[class*='match-name' i],[class*='scoreboard' i],[data-qa*='match' i],[data-testid*='match' i]";
    for (const el of Array.from(document.querySelectorAll(headingSelector)).slice(0, 60)) {
      const pair = parseSisalTeamPair(el.textContent);
      if (pair) return pair;
    }

    const teamSelector = "[class*='competitor' i],[class*='team-name' i],[class*='teamName' i],[class*='participant' i],[data-qa*='competitor' i],[data-testid*='team' i]";
    const teamEls = Array.from(document.querySelectorAll(teamSelector)).filter(el => {
      if (el.closest("#mm-widget")) return false;
      const text = String(el.textContent || "").trim();
      return text.length >= 3 && text.length <= 45 && !/\d+[.,]\d{2}/.test(text);
    }).slice(0, 12);
    if (teamEls.length >= 2) {
      const home = teamEls[0].textContent.trim(), away = teamEls[1].textContent.trim();
      if (canonicalTeam(home) !== canonicalTeam(away)) return { home, away };
    }
    return null;
  }

  function detectMultipleMatches() {
    const selector = [
      "[data-qa*='event' i]", "[data-testid*='event' i]", "[data-event-id]",
      "[class*='event-card' i]", "[class*='match-row' i]", "[class*='match-item' i]",
      "[class*='single-event' i]", "[class*='eventItem' i]", "[class*='eventRow' i]",
      "[class*='row-event' i]", "[class*='fixture' i]", "[class*='match-card' i]",
      "[class*='event' i]", "[data-testid*='match' i]", "[data-qa*='match' i]"
    ].join(",");
    const candidates = Array.from(document.querySelectorAll(selector)).slice(0, 180);
    const unique = new Map();
    const teamSelector = "[class*='competitor' i],[class*='team-name' i],[class*='teamName' i],[class*='participant' i]";
    for (const container of candidates) {
      if (container.closest("#mm-widget") || !container.getClientRects().length) continue;
      const text = String(container.textContent || "").replace(/\s+/g, " ").trim();
      if (text.length < 12 || text.length > 1800) continue;
      let pair = parseSisalTeamPair(text);
      if (!pair) {
        const teams = Array.from(container.querySelectorAll(teamSelector)).slice(0, 4)
          .map(el => String(el.textContent || "").trim())
          .filter(v => v.length >= 3 && v.length <= 45 && !/\d+[.,]\d{2}/.test(v));
        if (teams.length >= 2 && canonicalTeam(teams[0]) !== canonicalTeam(teams[1])) pair = { home: teams[0], away: teams[1] };
      }
      if (!pair) continue;
      const key = canonicalTeam(pair.home) + "|" + canonicalTeam(pair.away);
      const previous = unique.get(key);
      if (!previous || text.length < previous.textLength) unique.set(key, { container, home: pair.home, away: pair.away, textLength: text.length });
    }
    return Array.from(unique.values()).slice(0, 40).map(({ container, home, away }) => ({ container, home, away }));
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
      context: getMatchContext(home, away),
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
      bookmaker: "Sisal",
      context: getMatchContext(c.home, c.away)
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
            bookmaker: "Sisal",
            context: getMatchContext(home, away)
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
  // Reset posizioni errate da v1.6.0
  if (localStorage.getItem("mm_widget_ver") !== "1.6.2") {
    localStorage.removeItem("mm_widget_pos");
    localStorage.setItem("mm_widget_ver", "1.6.2");
  }

  let currentAnalysis = null;
  let currentView = localStorage.getItem("mm_widget_view") || "all_markets";
  let currentCategoryFilter = localStorage.getItem("mm_widget_cat") || "all";

  function setView(view) {
    currentView = view;
    localStorage.setItem("mm_widget_view", view);
    renderWidget();
  }

  function setCategoryFilter(cat) {
    currentCategoryFilter = cat;
    localStorage.setItem("mm_widget_cat", cat);
    renderWidget();
  }

  let currentStrategy = localStorage.getItem("mm_widget_strategy") || "balanced"; // balanced, accurate, value, doubling
  let isMinimized = localStorage.getItem("mm_widget_minimized") !== "false"; // Default minimizzato a pillola per non disturbare
  let isHidden = localStorage.getItem("mm_widget_hidden") === "true";
  if (localStorage.getItem("mm_widget_version") !== MM_SCRIPT_VERSION) { isHidden = false; localStorage.setItem("mm_widget_hidden", "false"); localStorage.removeItem("mm_widget_pos"); localStorage.setItem("mm_widget_version", MM_SCRIPT_VERSION); }
  let minProbThreshold = parseInt(localStorage.getItem("mm_min_prob") || "50", 10);
  if (isNaN(minProbThreshold)) minProbThreshold = 50;

  let isMutatingDOM = false;

  // Gestione Drag & Drop universale pulita
  function initDraggable(widgetEl, handleEl) {
    try {
      const savedPos = JSON.parse(localStorage.getItem("mm_widget_pos") || "null");
      if (savedPos && savedPos.left && savedPos.top) {
        // Valida che sia all'interno dello schermo corrente
        const numTop = parseFloat(savedPos.top);
        const numLeft = parseFloat(savedPos.left);
        if (numTop >= 0 && numTop < window.innerHeight - 50 && numLeft >= 0 && numLeft < window.innerWidth - 60) {
          widgetEl.style.removeProperty("bottom");
          widgetEl.style.removeProperty("right");
          widgetEl.style.bottom = "auto";
          widgetEl.style.right = "auto";
          widgetEl.style.left = savedPos.left;
          widgetEl.style.top = savedPos.top;
        }
      }
    } catch(e) {}

    if (widgetEl.__mm_drag_initialized) return;
    widgetEl.__mm_drag_initialized = true;

    let isDragging = false;
    let hasMoved = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    function onDragStart(clientX, clientY) {
      isDragging = true;
      hasMoved = false;
      const rect = widgetEl.getBoundingClientRect();
      startX = clientX;
      startY = clientY;
      initialLeft = rect.left;
      initialTop = rect.top;
      widgetEl.style.removeProperty("bottom");
      widgetEl.style.removeProperty("right");
      widgetEl.style.bottom = "auto";
      widgetEl.style.right = "auto";
      widgetEl.style.left = `${initialLeft}px`;
      widgetEl.style.top = `${initialTop}px`;
    }

    function onDragMove(clientX, clientY, e) {
      if (!isDragging) return;
      const dx = clientX - startX;
      const dy = clientY - startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) hasMoved = true;

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
      if (hasMoved) {
        try {
          localStorage.setItem("mm_widget_pos", JSON.stringify({
            left: widgetEl.style.left,
            top: widgetEl.style.top
          }));
        } catch(err) {}
      }
    }

    // Touch
    widgetEl.addEventListener("touchstart", (e) => {
      if (e.target.closest("button, input, a, select")) return;
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
    widgetEl.addEventListener("mousedown", (e) => {
      if (e.target.closest("button, input, a, select")) return;
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

  function setHidden(hidden) {
    isHidden = Boolean(hidden);
    localStorage.setItem("mm_widget_hidden", String(isHidden));
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

  function renderWidget() {
    let widget = document.getElementById("mm-widget");
    let floatingBadge = document.getElementById("mm-floating-badge");

    if (isHidden) {
      if (widget) widget.style.display = "none";
      if (!floatingBadge) {
        floatingBadge = document.createElement("div");
        floatingBadge.id = "mm-floating-badge";
        floatingBadge.title = "MatchMind v" + MM_SCRIPT_VERSION + " attivo: tocca per aprire";
        floatingBadge.innerHTML = "🧠";
        floatingBadge.onclick = () => setHidden(false);
        document.body.appendChild(floatingBadge);
      }
      floatingBadge.style.display = "flex";
      return;
    } else {
      if (floatingBadge) floatingBadge.style.display = "none";
    }

    if (!widget) {
      widget = document.createElement("div");
      widget.id = "mm-widget";
      document.body.appendChild(widget);
    }
    widget.style.display = "flex";

    const calculations = currentAnalysis?.calculations || [];
    const allMarketsList = currentAnalysis?.allMarketsList || calculations;
    const activePicks = filterByStrategy(calculations, currentStrategy, minProbThreshold);

    if (isMinimized) {
      widget.classList.add("mm-is-minimized");
      widget.style.height = "34px";
      widget.style.maxHeight = "34px";
      widget.style.width = "auto";

      const queued = readPlayQueue().filter(q => q.status !== "added").length;
      const countBadge = currentView === "all_markets"
        ? `${allMarketsList.length} Mercati`
        : `${activePicks.length} Consigliate`;

      widget.innerHTML = `
        <div id="mm-widget-min-bar" style="display:flex;align-items:center;gap:6px;font-size:11px;font-weight:700;line-height:1;user-select:none;">
          <span id="mm-status-pill" style="color:#c4f36a;font-size:12px;">${pillStatusText(queued)}</span>
          <span style="background:#064e3b;color:#34d399;border:1px solid #10b981;border-radius:4px;font-size:9px;padding:2px 5px;">
            ${countBadge}
          </span>
          <span style="color:#38bdf8;font-size:10px;text-decoration:underline;">Espandi ↗</span>
          <span id="mm-min-hide-btn" style="color:#64748b;font-size:12px;padding-left:4px;cursor:pointer;" title="Nascondi widget">✕</span>
        </div>
      `;

      initDraggable(widget, widget);
      widget.onclick = (e) => {
        if (e.target.id === "mm-min-hide-btn") {
          e.stopPropagation();
          setHidden(true);
          return;
        }
        setMinimized(false);
      };
      return;
    }

    widget.classList.remove("mm-is-minimized");
    widget.style.height = "auto";
    widget.style.maxHeight = "58vh";
    widget.style.width = "335px";
    widget.onclick = null;

    if (!calculations.length && !allMarketsList.length) {
      widget.innerHTML = `
        <div id="mm-widget-head">
          <div style="display:flex;align-items:center;gap:5px;"><span>🧠 MatchMind Sisal</span><span style="font-size:9px;background:#1e293b;padding:1px 4px;border-radius:4px;color:#34d399;">v${MM_SCRIPT_VERSION} · Attivo</span></div>
          <div class="mm-head-actions">
            <button id="mm-btn-minimize" class="mm-icon-btn" title="Riduci a pillola">—</button>
            <button id="mm-btn-close-w" class="mm-icon-btn" title="Nascondi">✕</button>
          </div>
        </div>
        <div style="font-size:11px;color:#94a3b8;padding:10px 4px;text-align:center;">
          ${currentAnalysis?.sport === "nba"
            ? "Modalità NBA: il modello calcio è disattivato su questa pagina. Usa il costruttore NBA di MatchMind per le stime basket."
            : currentAnalysis?.forecastUnavailable
              ? "Analisi sospesa: mancano rating squadra verificati e versionati. Le quote si possono consultare e trasferire, ma MatchMind non mostra percentuali, quote eque, EV o consigli non supportati dai dati."
              : "Nessuna quota calcistica rilevata. Apri una singola partita o il palinsesto."}
          <br/><span style="font-size:10px;color:#64748b;">Nessuna probabilità viene inventata o presentata come calibrata.</span>
        </div>
        <button id="mm-send-cart-btn" class="mm-btn-cart">📥 Invia carrello Sisal</button>
        <div style="display:flex;justify-content:space-between;margin-top:2px;">
          <a href="${MATCHMIND_URL}" target="_blank" style="color:#7dd3fc;text-decoration:none;font-size:11px;">📋 Apri MatchMind</a>
          <span style="color:#64748b;font-size:11px;cursor:pointer;" id="mm-rescan-btn">🔄 Scansiona</span>
        </div>
      `;
      document.getElementById("mm-btn-minimize")?.addEventListener("click", () => setMinimized(true));
      document.getElementById("mm-btn-close-w")?.addEventListener("click", () => setHidden(true));
      document.getElementById("mm-send-cart-btn")?.addEventListener("click", sendCartToMatchMind);
      document.getElementById("mm-rescan-btn")?.addEventListener("click", scanPage);
      const headEl = document.getElementById("mm-widget-head");
      if (headEl) initDraggable(widget, headEl);
      renderPlayQueue(widget);
      return;
    }

    const isMulti = currentAnalysis.isMulti;
    const headerTitle = isMulti
      ? `⚽ Palinsesto (${currentAnalysis.matchCount} partite)`
      : `⚽ ${currentAnalysis.home} - ${currentAnalysis.away}`;

    let mainContentHtml = "";

    if (currentView === "all_markets") {
      let filteredMarkets = allMarketsList;
      if (currentCategoryFilter !== "all") {
        filteredMarkets = allMarketsList.filter(item => item.cat === currentCategoryFilter);
      }

      const cardsHtml = filteredMarkets.map(item => {
        const ev = item.evaluation;
        const matchTitle = isMulti ? `${item.home} - ${item.away}` : "";
        const oddVal = item.odd != null ? item.odd : null;
        const sendOdd = oddVal != null ? oddVal : item.fairOdds;

        return `
          <div class="mm-item-card is-${ev.type}">
            <div class="mm-card-head">
              <div>
                <div class="mm-item-cat">${item.catName}</div>
                <div class="mm-item-title">${item.label}</div>
                ${matchTitle ? `<div class="mm-item-match">${matchTitle}</div>` : ''}
              </div>
              <div class="mm-card-actions">
                ${item.hasRealOdd ? `<span class="mm-odd-badge">Quota <b>${oddVal.toFixed(2)}</b></span>` : `<span class="mm-odd-badge muted" title="Quota equa teorica">Equa <b>${item.fairOdds.toFixed(2)}</b></span>`}
                ${item.hasRealOdd ? `<button class="mm-send-btn" title="Invia questa giocata a MatchMind" onclick="window.sendToMatchMind(event, '${item.home.replace(/'/g, "\\'")}', '${item.away.replace(/'/g, "\\'")}', '${item.key}', '${item.label.replace(/'/g, "\\'")}', ${sendOdd})">⚡ MM</button>` : ''}
              </div>
            </div>

            <div class="mm-verdict-row">
              <span class="mm-verdict-badge ${ev.badgeClass}">${ev.badgeText}</span>
              <span class="mm-verdict-short">${ev.shortVerdict}</span>
            </div>

            <div class="mm-card-metrics">
              <span>Stima: <b>${ev.pct}%</b></span>
              <span>Quota Equa: <b>${ev.fairOdds.toFixed(2)}</b></span>
              ${item.hasRealOdd ? `<span style="color:${ev.evPct > 0 ? '#34d399' : (ev.evPct < -8 ? '#f87171' : '#fbbf24')};font-weight:800;">${ev.evPct > 0 ? '+' : ''}${ev.evPct}% EV</span>` : '<span style="color:#64748b;font-size:9px;">Stima preventiva</span>'}
            </div>

            <div class="mm-card-reason">
              <div class="mm-reason-desc">💡 ${ev.explanation}</div>
              ${ev.tacticalNote ? `<div class="mm-reason-tactical">⚽ ${ev.tacticalNote}</div>` : ''}
            </div>
          </div>
        `;
      }).join("");

      mainContentHtml = `
        <div class="mm-cat-row">
          <button class="mm-cat-btn ${currentCategoryFilter === 'all' ? 'active' : ''}" data-cat="all">🌐 Tutti (${allMarketsList.length})</button>
          <button class="mm-cat-btn ${currentCategoryFilter === '1x2' ? 'active' : ''}" data-cat="1x2">🏆 1X2</button>
          <button class="mm-cat-btn ${currentCategoryFilter === 'btts' ? 'active' : ''}" data-cat="btts">🥅 Gol/NoGol</button>
          <button class="mm-cat-btn ${currentCategoryFilter === 'uo' ? 'active' : ''}" data-cat="uo">⚽ Under/Over</button>
          <button class="mm-cat-btn ${currentCategoryFilter === 'dc' ? 'active' : ''}" data-cat="dc">🛡️ Doppia Chance</button>
        </div>
        <div class="mm-legend-bar">
          <span class="mm-legend-item"><i class="dot-val"></i> Valore</span>
          <span class="mm-legend-item"><i class="dot-high"></i> Probabile</span>
          <span class="mm-legend-item"><i class="dot-neu"></i> Neutra</span>
          <span class="mm-legend-item"><i class="dot-trap"></i> Rischiosa</span>
        </div>
        <div class="mm-list-container">
          ${cardsHtml || '<div style="font-size:11px;color:#94a3b8;padding:12px;text-align:center;">Nessun mercato in questa categoria.</div>'}
        </div>
      `;
    } else {
      const presets = [
        { label: "Tutte", val: 0 },
        { label: "≥40%", val: 40 },
        { label: "≥50%", val: 50 },
        { label: "≥60%", val: 60 },
        { label: "≥70%", val: 70 }
      ];

      let recItemsHtml = "";
      if (activePicks.length > 0) {
        recItemsHtml = activePicks.slice(0, 15).map(c => {
          const ev = c.evaluation;
          const matchTitle = isMulti ? `${c.home} - ${c.away}` : "";
          return `
            <div class="mm-item-card is-${ev.type}">
              <div class="mm-card-head">
                <div><div class="mm-item-cat">${c.catName || 'Consigliata'}</div><div class="mm-item-title">${c.label}</div>${matchTitle ? `<div class="mm-item-match">${matchTitle}</div>` : ''}</div>
                <div class="mm-card-actions"><span class="mm-odd-badge">Quota <b>${c.odd.toFixed(2)}</b></span><button class="mm-send-btn" title="Invia questa giocata a MatchMind" onclick="window.sendToMatchMind(event, '${c.home.replace(/'/g, "\\'")}', '${c.away.replace(/'/g, "\\'")}', '${c.key}', '${c.label.replace(/'/g, "\\'")}', ${c.odd})">⚡ MM</button></div>
              </div>
              <div class="mm-verdict-row"><span class="mm-verdict-badge ${ev.badgeClass}">${ev.badgeText}</span><span class="mm-verdict-short">${ev.shortVerdict}</span></div>
              <div class="mm-card-metrics"><span>Stima: <b>${ev.pct}%</b></span><span>Quota Equa: <b>${ev.fairOdds.toFixed(2)}</b></span><span style="color:${ev.evPct > 0 ? '#34d399' : '#94a3b8'};font-weight:800;">${ev.evPct > 0 ? '+' : ''}${ev.evPct}% EV</span></div>
              <div class="mm-card-reason"><div class="mm-reason-desc">💡 ${ev.explanation}</div>${ev.tacticalNote ? `<div class="mm-reason-tactical">⚽ ${ev.tacticalNote}</div>` : ''}</div>
            </div>
          `;
        }).join("");
      } else {
        recItemsHtml = `<div style="font-size:11px;color:#94a3b8;padding:12px;text-align:center;background:#0f172a;border-radius:6px;">Nessuna selezione per la strategia <b>${currentStrategy}</b> con soglia ≥ ${minProbThreshold}%.<br/><span style="color:#38bdf8;cursor:pointer;font-weight:bold;margin-top:5px;display:inline-block;" id="mm-reset-strat">Mostra Più Probabili</span></div>`;
      }

      mainContentHtml = `
        <div class="mm-strategy-tabs">
          <button class="mm-strat-tab ${currentStrategy === 'balanced' ? 'active' : ''}" data-strat="balanced">⚖️ Bilanciata</button>
          <button class="mm-strat-tab ${currentStrategy === 'accurate' ? 'active' : ''}" data-strat="accurate">🎯 Accuratezza</button>
          <button class="mm-strat-tab ${currentStrategy === 'value' ? 'active strat-value' : ''}" data-strat="value">💎 +EV Valore</button>
          <button class="mm-strat-tab ${currentStrategy === 'doubling' ? 'active' : ''}" data-strat="doubling">✌️ Raddoppio</button>
        </div>
        <div class="mm-filter-bar">
          <div class="mm-filter-row"><span>Soglia probabilità:</span><span style="color:#34d399;font-weight:800;font-size:11px;" id="mm-thresh-display">≥ ${minProbThreshold}%</span></div>
          <div class="mm-chips-row">${presets.map(p => `<button class="mm-chip ${minProbThreshold === p.val ? 'active' : ''}" data-val="${p.val}">${p.label}</button>`).join("")}</div>
          <input type="range" class="mm-slider" id="mm-prob-slider" min="30" max="90" step="5" value="${minProbThreshold}">
        </div>
        <div class="mm-list-container">${recItemsHtml}</div>
      `;
    }

    widget.innerHTML = `
      <div id="mm-widget-head">
        <div style="display:flex;align-items:center;gap:5px;"><span>🧠 MatchMind Sisal</span><span style="font-size:9px;background:#1e293b;padding:1px 4px;border-radius:4px;color:#34d399;">v${MM_SCRIPT_VERSION} · Attivo</span></div>
        <div class="mm-head-actions"><button id="mm-btn-minimize" class="mm-icon-btn" title="Riduci a pillola">—</button><button id="mm-btn-close-w" class="mm-icon-btn" title="Nascondi">✕</button></div>
      </div>
      <div class="mm-match-title">${headerTitle}</div>
      <div style="font-size:9px;color:#fbbf24;background:#29200b;border:1px solid #854d0e;border-radius:5px;padding:4px 6px;line-height:1.3;">Stime indicative del modello MatchMind, non validate per questa partita. EV teorico, non garanzia.</div>
      ${!isMulti && currentAnalysis.home && currentAnalysis.away && !currentAnalysis.forecastUnavailable ? (() => {
        const curCtx = getMatchContext(currentAnalysis.home, currentAnalysis.away);
        const isCustom = Boolean(curCtx.attackingAbsencesHome || curCtx.defensiveAbsencesHome || curCtx.motivationHome || curCtx.attackingAbsencesAway || curCtx.defensiveAbsencesAway || curCtx.motivationAway);
        return `
        <details class="mm-context-drawer" style="margin-top:4px;margin-bottom:6px;background:#0f172a;border:1px solid #334155;border-radius:6px;padding:6px;font-size:10px;">
          <summary style="cursor:pointer;color:#38bdf8;font-weight:700;display:flex;justify-content:space-between;align-items:center;">
            <span>⚙️ Correzione assenze & motivazione</span>
            ${isCustom ? '<span style="color:#34d399;font-weight:800;">⚡ Modificato</span>' : '<span style="color:#64748b;">Neutro</span>'}
          </summary>
          <div style="margin-top:6px;display:flex;flex-direction:column;gap:5px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-weight:700;color:#f8fafc;">${currentAnalysis.home}:</span>
              <div style="display:flex;gap:4px;">
                <button type="button" class="mm-ctx-btn" data-action="abs-home" style="padding:2px 6px;background:#1e293b;border:1px solid #475569;border-radius:4px;color:#f1f5f9;font-size:9px;cursor:pointer;">⚠️ Assenze (-10%)</button>
                <button type="button" class="mm-ctx-btn" data-action="mot-home" style="padding:2px 6px;background:#1e293b;border:1px solid #475569;border-radius:4px;color:#f1f5f9;font-size:9px;cursor:pointer;">🔥 Decisiva (+5%)</button>
              </div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-weight:700;color:#f8fafc;">${currentAnalysis.away}:</span>
              <div style="display:flex;gap:4px;">
                <button type="button" class="mm-ctx-btn" data-action="abs-away" style="padding:2px 6px;background:#1e293b;border:1px solid #475569;border-radius:4px;color:#f1f5f9;font-size:9px;cursor:pointer;">⚠️ Assenze (-10%)</button>
                <button type="button" class="mm-ctx-btn" data-action="mot-away" style="padding:2px 6px;background:#1e293b;border:1px solid #475569;border-radius:4px;color:#f1f5f9;font-size:9px;cursor:pointer;">🔥 Decisiva (+5%)</button>
              </div>
            </div>
            <div style="text-align:right;margin-top:2px;">
              <button type="button" class="mm-ctx-btn" data-action="reset" style="padding:2px 8px;background:#3f1d1d;border:1px solid #7f1d1d;border-radius:4px;color:#fca5a5;font-size:9px;cursor:pointer;">↺ Reset neutro</button>
            </div>
          </div>
        </details>`;
      })() : ''}
      <div style="font-size:10px;color:#fbbf24;background:#30250b;border:1px solid #854d0e;border-radius:5px;padding:6px;margin:4px 0;">Probabilità calcolate solo con rating squadra verificati e dataset versionato. Quote e EV sono stime: nessuna garanzia di risultato.</div>
      <div class="mm-view-tabs">
        <button class="mm-view-tab ${currentView === 'all_markets' ? 'active' : ''}" data-view="all_markets">📋 Tutti i Mercati (${allMarketsList.length})</button>
        <button class="mm-view-tab ${currentView === 'recommended' ? 'active' : ''}" data-view="recommended">⭐ Solo Consigliate (${activePicks.length})</button>
      </div>
      ${mainContentHtml}
      <div style="display:flex;flex-direction:column;gap:4px;margin-top:2px;">
        ${activePicks.length >= 2 ? `<button id="mm-send-top-combo-btn" class="mm-btn-combo">⚡ Invia Top ${Math.min(3, activePicks.length)} scelte a MatchMind</button>` : ''}
        <button id="mm-send-cart-btn" class="mm-btn-cart">📥 Invia carrello Sisal a MatchMind</button>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;">
        <a href="${MATCHMIND_URL}" target="_blank" style="color:#7dd3fc;text-decoration:none;">📋 Apri MatchMind</a>
        <span style="color:#64748b;cursor:pointer;" id="mm-rescan-btn">🔄 Aggiorna (${calculations.length} quote)</span>
      </div>
    `;

    document.getElementById("mm-btn-minimize")?.addEventListener("click", () => setMinimized(true));
    document.getElementById("mm-btn-close-w")?.addEventListener("click", () => setHidden(true));
    document.getElementById("mm-send-cart-btn")?.addEventListener("click", sendCartToMatchMind);
    document.getElementById("mm-rescan-btn")?.addEventListener("click", scanPage);
    document.getElementById("mm-reset-strat")?.addEventListener("click", () => setStrategy("accurate"));
    document.getElementById("mm-send-top-combo-btn")?.addEventListener("click", () => sendStrategyComboToMatchMind(activePicks));

    widget.querySelectorAll(".mm-view-tab").forEach(tab => tab.addEventListener("click", e => setView(e.currentTarget.dataset.view)));
    widget.querySelectorAll(".mm-cat-btn").forEach(btn => btn.addEventListener("click", e => setCategoryFilter(e.currentTarget.dataset.cat)));
    widget.querySelectorAll(".mm-strat-tab").forEach(tab => tab.addEventListener("click", e => setStrategy(e.currentTarget.dataset.strat)));

    const slider = document.getElementById("mm-prob-slider");
    if (slider) {
      slider.addEventListener("input", e => { const val = Number(e.target.value); document.getElementById("mm-thresh-display").textContent = `≥ ${val}%`; });
      slider.addEventListener("change", e => setThreshold(Number(e.target.value)));
    }
    widget.querySelectorAll(".mm-chip").forEach(chip => chip.addEventListener("click", e => setThreshold(Number(e.currentTarget.dataset.val))));

    widget.querySelectorAll(".mm-ctx-btn").forEach(btn => btn.addEventListener("click", e => {
      const action = e.currentTarget.dataset.action;
      const h = currentAnalysis.home, a = currentAnalysis.away;
      if (!h || !a) return;
      if (action === "abs-home") {
        setMatchContext(h, a, { attackingAbsencesHome: 2, defensiveAbsencesHome: 1 });
      } else if (action === "mot-home") {
        setMatchContext(h, a, { motivationHome: 1 });
      } else if (action === "abs-away") {
        setMatchContext(h, a, { attackingAbsencesAway: 2, defensiveAbsencesAway: 1 });
      } else if (action === "mot-away") {
        setMatchContext(h, a, { motivationAway: 1 });
      } else if (action === "reset") {
        setMatchContext(h, a, { attackingAbsencesHome: 0, defensiveAbsencesHome: 0, motivationHome: 0, attackingAbsencesAway: 0, defensiveAbsencesAway: 0, motivationAway: 0 });
      }
      scanPage();
    }));

    const headEl = document.getElementById("mm-widget-head");
    if (headEl) initDraggable(widget, headEl);
    renderPlayQueue(widget);
  }

  // Aggiorna badge visivi sui bottoni Sisal nella pagina
  function updatePageBadges() {
    // Non applicare badge statistici generici: su Sisal mostriamo solo le selezioni richieste da MatchMind.
    return;
    if (!currentAnalysis || !currentAnalysis.calculations) return;
    const { calculations } = currentAnalysis;
    isMutatingDOM = true;
    try {
      calculations.forEach(c => {
        const btn = c.btn;
        if (!btn || !document.body.contains(btn)) return;
        const evRes = c.evaluation;
        btn.classList.remove("mm-highlight-valore", "mm-highlight-highprob", "mm-highlight-trap");
        if (evRes.type === "value") btn.classList.add("mm-highlight-valore");
        else if (evRes.type === "highprob") btn.classList.add("mm-highlight-highprob");
        else if (evRes.type === "trap") btn.classList.add("mm-highlight-trap");

        let tag = btn.querySelector(".mm-prob-tag");
        if (!tag) { tag = document.createElement("div"); tag.className = "mm-prob-tag"; btn.appendChild(tag); }
        tag.className = `mm-prob-tag is-${evRes.type}`;
        tag.innerHTML = evRes.tagText;
        tag.title = `${c.label} · ${evRes.shortVerdict} (Stima: ${evRes.pct}%, Sisal: ${c.odd.toFixed(2)}, Equa: ${c.fairOdds.toFixed(2)})`;
        btn.querySelectorAll(".mm-send-btn").forEach(el => el.remove());
      });
    } finally { isMutatingDOM = false; }
  }

  let lastCartSyncAt = 0;
  let lastWidgetRenderSignature = "";
  function renderWidgetIfChanged() {
    const a = currentAnalysis || {};
    const signature = JSON.stringify({
      sport: a.sport, home: a.home, away: a.away, isMulti: a.isMulti, matchCount: a.matchCount,
      calculations: (a.calculations || []).map(x => [x.home, x.away, x.key, x.odd, x.modelProb, x.evaluation?.type]),
      markets: (a.allMarketsList || []).map(x => [x.home, x.away, x.key, x.odd, x.modelProb]),
      queue: readPlayQueue().map(x => [x.home, x.away, x.marketKey, x.status, x.sisalOdds, x.error]),
      view: currentView, strategy: currentStrategy, threshold: minProbThreshold,
      hidden: isHidden, minimized: isMinimized
    });
    if (signature === lastWidgetRenderSignature) return;
    lastWidgetRenderSignature = signature;
    renderWidget();
  }

  // Scansione principale della pagina Sisal
  function scanPage() {
    captureIncomingPlays();
    const nbaQueue = readPlayQueue().filter(q => q.sport === "nba");
    const pageContext = String(location.pathname || "") + " " + String(location.search || "") + " " + String(document.title || "");
    const isBasketballPage = /(?:^|\/)basket(?:\/|$)|(?:^|\/)nba(?:\/|$)|\bbasketball\b/i.test(pageContext);
    if (isBasketballPage) {
      if (nbaQueue.length) autoPlayQueue(scanNbaSelections(nbaQueue));
      // Non eseguire mai il modello calcistico su eventi NBA, anche con coda vuota.
      currentAnalysis = { isMulti: true, sport: "nba", matchCount: nbaQueue.length, calculations: [], allMarketsList: [], forecastUnavailable: true };
      renderWidgetIfChanged();
      return;
    }
    if (nbaQueue.length) autoPlayQueue(scanNbaSelections(nbaQueue));
    if (readPlayQueue().length && Date.now() - lastCartSyncAt > 4000) { syncCartState(); lastCartSyncAt = Date.now(); }
    const singleMatch = detectSingleMatch();
    const multiMatches = singleMatch ? [] : detectMultipleMatches();
    const calculations = [];

    if (singleMatch) {
      const forecast = calculateMatchMindForecast(singleMatch.home, singleMatch.away);
      const mmProbs = forecast.probabilities;
      const foundOddsByMarket = new Map();
      const oddButtons = forecast.forecastAvailable
        ? Array.from(document.querySelectorAll("button,[role='button'],[class*='odd' i],[class*='quota' i],[data-outcome]")).filter(el => {
            if (el.closest("#mm-widget")) return false;
            const txt = el.textContent || "";
            return txt.length < 70 && /\b\d+[.,]\d{2}\b/.test(txt);
          }).slice(0, 700)
        : [];

      oddButtons.forEach(btn => {
        const resolved = resolveOddsButton(btn);
        if (!resolved) return;
        if (mmProbs[resolved.key] != null) {
          const prob = mmProbs[resolved.key];
          const fairOdds = 1 / prob;
          const ev = (prob * resolved.odd) - 1;
          const evaluation = evaluateMarketSelection(prob, resolved.odd, fairOdds, ev, resolved.key, resolved.label, singleMatch.home, singleMatch.away, forecast.homeXg, forecast.awayXg);
          const item = { btn, home: singleMatch.home, away: singleMatch.away, odd: resolved.odd, key: resolved.key, label: resolved.label, shortLabel: resolved.shortLabel, cat: resolved.cat, catName: resolved.catName, modelProb: prob, fairOdds, ev, evaluation, hasRealOdd: true };
          calculations.push(item);
          if (!foundOddsByMarket.has(resolved.key)) foundOddsByMarket.set(resolved.key, item);
        }
      });

      const allMarketsList = [];
      STANDARD_MARKETS.forEach(def => {
        if (foundOddsByMarket.has(def.key)) {
          allMarketsList.push(foundOddsByMarket.get(def.key));
        } else if (mmProbs[def.key] != null) {
          const prob = mmProbs[def.key];
          const fairOdds = 1 / prob;
          const evaluation = evaluateMarketSelection(prob, null, fairOdds, null, def.key, def.label, singleMatch.home, singleMatch.away, forecast.homeXg, forecast.awayXg);
          allMarketsList.push({ btn: null, home: singleMatch.home, away: singleMatch.away, odd: null, key: def.key, label: def.label, shortLabel: def.shortLabel, cat: def.cat, catName: def.catName, modelProb: prob, fairOdds, ev: null, evaluation, hasRealOdd: false });
        }
      });

      currentAnalysis = { isMulti: false, home: singleMatch.home, away: singleMatch.away, matchCount: 1, calculations, allMarketsList, forecastUnavailable: !forecast.forecastAvailable, forecastReason: forecast.reason };
    } else if (multiMatches.length > 0) {
      let unavailableForecasts = 0;
      multiMatches.forEach(item => {
        const forecast = calculateMatchMindForecast(item.home, item.away);
        if (!forecast.forecastAvailable) { unavailableForecasts++; continue; }
        const mmProbs = forecast.probabilities;
        const oddButtons = Array.from(item.container.querySelectorAll("button,[role='button'],[class*='odd' i],[class*='quota' i],[data-outcome]"))
          .filter(el => {
            if (el.closest("#mm-widget")) return false;
            const txt = el.textContent || "";
            return txt.length < 70 && /\b\d+[.,]\d{2}\b/.test(txt);
          }).slice(0, 80);
        oddButtons.forEach(btn => {
          const resolved = resolveOddsButton(btn);
          if (!resolved) return;
          if (mmProbs[resolved.key] != null) {
            const prob = mmProbs[resolved.key];
            const fairOdds = 1 / prob;
            const ev = (prob * resolved.odd) - 1;
            const evaluation = evaluateMarketSelection(prob, resolved.odd, fairOdds, ev, resolved.key, resolved.label, item.home, item.away, forecast.homeXg, forecast.awayXg);
            calculations.push({ btn, home: item.home, away: item.away, odd: resolved.odd, key: resolved.key, label: resolved.label, shortLabel: resolved.shortLabel, cat: resolved.cat, catName: resolved.catName, modelProb: prob, fairOdds, ev, evaluation, hasRealOdd: true });
          }
        });
      });
      currentAnalysis = { isMulti: true, matchCount: multiMatches.length, calculations, allMarketsList: calculations, forecastUnavailable: calculations.length === 0, forecastSkippedCount: unavailableForecasts };
    } else {
      currentAnalysis = { isMulti: false, home: "Partita", away: "In corso", matchCount: 0, calculations: [], allMarketsList: [] };
    }

    const footballQueue = readPlayQueue().filter(q => q.sport !== "nba" && q.status !== "added");
    autoPlayQueue(footballQueue.length ? calculations.concat(scanFootballSelections(footballQueue)) : calculations);
    updatePageBadges();
    renderWidgetIfChanged();
  }
  // --- GIOCATE DA MATCHMIND → SISAL (v2.4.0) ---
  function pillStatusText(queued) {
    return "🎯 MatchMind v" + MM_SCRIPT_VERSION + " (Attivo) · " + queued + (queued === 1 ? " giocata in coda" : " giocate in coda");
  }
  // Testo normalizzato a parole: evita che «roma» combaci con «romania».
  function wordText(text) { return " " + String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() + " "; }
  function footballAliases(name) {
    const canon = canonicalTeam(name);
    const list = [name, canon].concat(TEAM_ALIASES[canon] || []);
    return Array.from(new Set(list.map(v => wordText(v).trim()).filter(v => v.length >= 3)));
  }
  // Testo di un contenitore con spazi tra i nodi: <span>Inter</span><span>Milan</span> non diventa «intermilan».
  function spacedText(node) {
    const parts = [];
    const walker = document.createTreeWalker(node, 4);
    while (walker.nextNode()) { const t = walker.currentNode.nodeValue; if (t && t.trim()) parts.push(t); if (parts.length > 400) break; }
    return parts.join(" ");
  }
  function footballTeamInText(text, name) {
    const clean = wordText(text);
    return footballAliases(name).some(a => clean.includes(" " + a + " "));
  }
  // Fallback calcio: se i contenitori palinsesto non riconoscono la partita, risale gli antenati di ogni quota.
  function scanFootballSelections(queue) {
    const todo = (queue || []).filter(q => q.sport !== "nba" && q.status !== "added");
    if (!todo.length) return [];
    const selector = "button,[role='button'],[class*='odd' i],[class*='quota' i],[class*='selection' i],[data-outcome]";
    const buttons = Array.from(new Set(Array.from(document.querySelectorAll(selector))
      .map(node => node.closest("button,[role='button']") || node)))
      .filter(btn => !btn.closest("#mm-widget") && !btn.closest(NBA_CART_SELECTOR) &&
        btn.getClientRects().length && String(btn.textContent || "").length < 70 &&
        /\b\d+[.,]\d{2}\b/.test(btn.textContent || ""))
      .slice(0, 700);

    // Il testo degli antenati viene costruito una volta sola, non una volta per ogni giocata in coda.
    const candidates = [];
    const contextCache = new WeakMap();
    for (const btn of buttons) {
      const contexts = [];
      let container = btn.parentElement;
      for (let depth = 0; depth < 8 && container && container !== document.body; depth++, container = container.parentElement) {
        let text = contextCache.get(container);
        if (text === undefined) {
          text = spacedText(container);
          contextCache.set(container, text);
        }
        if (text.length > 5000) break;
        contexts.push(text);
      }
      if (contexts.length) candidates.push({ btn, contexts });
    }

    const found = [];
    const matchedButtons = new Set();
    for (const item of todo) {
      let eventSeen = false;
      for (const candidate of candidates) {
        if (!candidate.contexts.some(text => footballTeamInText(text, item.home) && footballTeamInText(text, item.away))) continue;
        eventSeen = true;
        const resolved = resolveOddsButton(candidate.btn);
        if (resolved && resolved.key === item.marketKey && !matchedButtons.has(candidate.btn)) {
          matchedButtons.add(candidate.btn);
          found.push({ ...resolved, btn: candidate.btn, home: item.home, away: item.away,
            sport: "football", probability: item.probability, selectedByMatchMind: true, fallback: true });
        }
      }
      if (eventSeen) found.push({ home: item.home, away: item.away, sport: "football", key: "event", btn: null });
    }
    return found;
  }
  // Conta le righe visibili del biglietto Sisal e le condivide con MatchMind tramite il ponte.
  function syncCartState() {
    try {
      const rows = new Set();
      document.querySelectorAll(NBA_CART_SELECTOR).forEach(cart => {
        if (cart.closest("#mm-widget") || !cart.getClientRects().length) return;
        cart.querySelectorAll('[class*="betslip-item" i],[class*="selection" i],[data-testid*="selection" i],li').forEach(r => { if (/\d+[.,]\d{2}/.test(r.textContent || "") && (r.textContent || "").length < 600) rows.add((r.textContent || "").trim().slice(0, 120)); });
      });
      const queue = readPlayQueue();
      const state = JSON.stringify({ at: Date.now(), rows: rows.size, added: queue.filter(q => q.status === "added").length, queued: queue.filter(q => q.status !== "added").length, version: MM_SCRIPT_VERSION });
      gmSet("mm_sisal_cart", state);
      gmSet("mm_sisal_last_seen", String(Date.now()));
    } catch (e) {}
  }
  const PLAY_KEY = "mm_play_queue";
  function readPlayQueue() {
    try {
      const raw = (typeof GM_getValue === "function" && GM_getValue(PLAY_KEY, "")) || localStorage.getItem(PLAY_KEY) || "[]";
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  }
  function writePlayQueue(list) {
    const raw = JSON.stringify(list.slice(0, 30));
    try { if (typeof GM_setValue === "function") GM_setValue(PLAY_KEY, raw); } catch (e) {}
    try { localStorage.setItem(PLAY_KEY, raw); } catch (e) {}
  }
  // Reopen stale "not found" rows after an engine update: DOM scans must be retried against the current Sisal layout.
  const QUEUE_VERSION_KEY = "mm_sisal_queue_version";
  if (gmGet(QUEUE_VERSION_KEY, "") !== MM_SCRIPT_VERSION) {
    const migrated = readPlayQueue().map(item => item && item.status === "error"
      ? { ...item, status: "pending", error: "", errorType: "", updatedAt: Date.now() }
      : item);
    writePlayQueue(migrated);
    gmSet(QUEUE_VERSION_KEY, MM_SCRIPT_VERSION);
  }
  function nbaButtonSelected(btn) {
    return btn.getAttribute("aria-pressed") === "true" || btn.getAttribute("aria-checked") === "true" ||
      /^(?:selected|is-selected|checked|is-active)$/.test(btn.getAttribute("data-state") || "") ||
      Array.from(btn.classList || []).some(c => /^(?:selected|is-selected|checked|is-active|active)$/.test(c));
  }
  const NBA_CART_SELECTOR = '[class*="betslip" i], [id*="betslip" i], [class*="bet-slip" i], [id*="bet-slip" i], [data-qa*="betslip" i], [class*="coupon" i], [class*="carrello" i], [class*="biglietto" i], [class*="ticket" i], [id*="ticket" i], [data-testid*="betslip" i], [data-testid*="ticket" i]';
  function nbaMarketText(btn) {
    const parts = [];
    let node = btn;
    for (let depth = 0; node && node !== document.body && depth < 8; depth++, node = node.parentElement) {
      for (const attr of ['data-market-name', 'data-market', 'aria-label', 'title']) {
        const value = node.getAttribute(attr);
        if (value) parts.push(value);
      }
      const title = Array.from(node.querySelectorAll('h3,h4,h5,[class*="market-title" i],[class*="marketTitle" i],[data-qa*="market-name" i],[data-testid*="market-name" i],legend'))
        .find(t => !t.closest('button,[role="button"]') && (t.textContent || '').length < 140);
      if (title) { parts.push(title.textContent); break; }
      if (node.matches('td')) {
        const th = node.closest('table')?.querySelectorAll('thead th')[node.cellIndex];
        if (th) { parts.push(th.textContent); break; }
      }
    }
    return parts.join(' ').toLowerCase().replace(/[–—]/g, '-');
  }
  const NBA_EXCLUDED = /handicap|spread|under|over|quarto|quarter|tempo|half|regolament|senza.*supplement|1x2|parziale/;
  function nbaWinnerMarket(market) {
    return !NBA_EXCLUDED.test(market) &&
      /vincente|vincitore|money\s*line|winner|testa\s+a\s+testa|\bt\s*\/\s*t\b|esito finale|risultato finale|\b1\s*(?:-|\/)\s*2\b/.test(market);
  }
  function nbaActiveMarketText() {
    const parts = [];
    document.querySelectorAll("select").forEach(select => {
      const option = select.options && select.options[select.selectedIndex];
      if (option && !select.closest("#mm-widget")) parts.push(option.textContent);
    });
    document.querySelectorAll('[aria-selected="true"],[aria-current="true"],[class*="active" i][role="tab"],[role="tab"][class*="selected" i]')
      .forEach(tab => { if (!tab.closest("#mm-widget") && (tab.textContent || "").length < 80) parts.push(tab.textContent); });
    return parts.join(" ").toLowerCase().replace(/[–—]/g, "-");
  }
  function nbaTwoWayButtons(container) {
    if (!container) return false;
    const priced = Array.from(container.querySelectorAll("button, [role='button']"))
      .filter(button => !button.closest("#mm-widget") && /\d[.,]\d{2}(?!\d)/.test(button.textContent || "") && (button.textContent || "").length < 80);
    const unique = Array.from(new Set(priced.map(button => button.closest("button,[role='button']") || button)));
    return unique.length === 2 && !unique.some(button => /^\s*x(?![a-z])|pareggio/i.test(button.textContent || ""));
  }
  function nbaCartContains(item, hit) {
    const h = nbaTeamAliases(item.home, item.homeAbbr), a = nbaTeamAliases(item.away, item.awayAbbr);
    const side = item.marketKey.split(':')[1], selected = side === 'home' ? h : a;
    const containers = Array.from(document.querySelectorAll(NBA_CART_SELECTOR)).filter(c => !c.closest('#mm-widget') && c.getClientRects().length);
    return containers.some(cart => {
      const rows = Array.from(cart.querySelectorAll('[class*="item" i],[class*="selection" i],[class*="event" i],li,[data-testid*="selection" i]'));
      return rows.some(row => {
        const text = row.innerText || row.textContent || '';
        if (text.length > 1600 || nbaTeamPosition(text,h) < 0 || nbaTeamPosition(text,a) < 0 || !nbaWinnerMarket(text.toLowerCase())) return false;
        const outcome = row.querySelector('[data-outcome],[class*="outcome" i],[class*="selection-name" i],[data-testid*="outcome" i]');
        const label = outcome?.getAttribute('data-outcome') || outcome?.innerText || outcome?.textContent || '';
        if (label) return nbaTeamPosition(label,selected) >= 0 || (hit?.outcome && label.trim() === hit.outcome);
        return text.split(/[\r\n]+/).some(line => /vince|vincente\s*:|esito\s*:/i.test(line) && nbaTeamPosition(line,selected) >= 0 && nbaTeamPosition(line,side === 'home' ? a : h) < 0);
      });
    });
  }
  const NBA_TEAMS = [
    ["Atlanta Hawks", "ATL"], ["Boston Celtics", "BOS"], ["Brooklyn Nets", "BKN"],
    ["Charlotte Hornets", "CHA"], ["Chicago Bulls", "CHI"], ["Cleveland Cavaliers", "CLE"],
    ["Dallas Mavericks", "DAL"], ["Denver Nuggets", "DEN"], ["Detroit Pistons", "DET"],
    ["Golden State Warriors", "GSW"], ["Houston Rockets", "HOU"], ["Indiana Pacers", "IND"],
    ["LA Clippers", "LAC"], ["Los Angeles Lakers", "LAL"], ["Memphis Grizzlies", "MEM"],
    ["Miami Heat", "MIA"], ["Milwaukee Bucks", "MIL"], ["Minnesota Timberwolves", "MIN"],
    ["New Orleans Pelicans", "NOP"], ["New York Knicks", "NYK"], ["Oklahoma City Thunder", "OKC"],
    ["Orlando Magic", "ORL"], ["Philadelphia 76ers", "PHI"], ["Phoenix Suns", "PHX"],
    ["Portland Trail Blazers", "POR"], ["Sacramento Kings", "SAC"], ["San Antonio Spurs", "SAS"],
    ["Toronto Raptors", "TOR"], ["Utah Jazz", "UTA"], ["Washington Wizards", "WAS"]
  ];
  function nbaTeamAliases(name, abbr) {
    const row = NBA_TEAMS.find(t => norm(t[0]) === norm(name) || t[1] === abbr ||
      (norm(name).includes("clippers") && t[1] === "LAC"));
    return Array.from(new Set([name, abbr, ...(row ? [row[0], row[1], row[0].split(" ").slice(row[1] === "POR" ? 1 : -1).join(" "), row[1] === "LAC" ? "Los Angeles Clippers" : ""] : [])].filter(Boolean)))
      .map(v => String(v).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim());
  }
  function nbaTeamPosition(text, aliases) {
    const clean = " " + String(text).toLowerCase().replace(/[^a-z0-9]+/g, " ") + " ";
    const indexes = aliases.map(a => clean.indexOf(" " + a + " ")).filter(i => i >= 0);
    return indexes.length ? Math.min(...indexes) : -1;
  }
  function resolveNbaWinner(btn, item, context, container) {
    const market = nbaMarketText(btn);
    if (!nbaWinnerMarket(market)) {
      const active = nbaActiveMarketText();
      const supportedFallback = !NBA_EXCLUDED.test(market) &&
        (nbaWinnerMarket(active) || (!NBA_EXCLUDED.test(active) && nbaTwoWayButtons(container)));
      if (!supportedFallback) return null;
    }
    const raw = (btn.innerText || Array.from(btn.children).map(c => c.textContent).join(" ") || btn.textContent || "").trim();
    const odd = parseOddsValue(raw + " " + (btn.getAttribute("aria-label") || ""));
    if (!odd) return null;
    const label = (btn.getAttribute('data-outcome') || btn.getAttribute('data-selection-name') || raw.replace(/\b\d+[.,]\d{2}\b/g, "")).trim();
    const h = nbaTeamAliases(item.home, item.homeAbbr), a = nbaTeamAliases(item.away, item.awayAbbr);
    let side = nbaTeamPosition(label, h) >= 0 ? "home" : nbaTeamPosition(label, a) >= 0 ? "away" : null;
    if (!side && /^[12]$/.test(label)) {
      const hp = nbaTeamPosition(context, h), ap = nbaTeamPosition(context, a);
      if (hp >= 0 && ap >= 0) side = (label === "1") === (hp < ap) ? "home" : "away";
    }
    return side ? { key: "nbaMoneyline:" + side, odd, outcome: /^[12]$/.test(label) ? label : null } : null;
  }
  function scanNbaSelections(queue) {
    const found = [];
    const buttons = Array.from(new Set(Array.from(document.querySelectorAll("button, [role='button'], [class*='odd'], [class*='quota'], [class*='selection'], [data-outcome]"))
      .map(b => b.closest('button,[role="button"],a[data-outcome]') || b)))
      .filter(b => !b.closest("#mm-widget") && !b.closest(NBA_CART_SELECTOR) && b.getClientRects().length && (b.textContent || "").length < 140);
    for (const item of queue) {
      const h = nbaTeamAliases(item.home, item.homeAbbr), a = nbaTeamAliases(item.away, item.awayAbbr);
      let eventSeen = false;
      for (const btn of buttons) {
        let container = btn.parentElement;
        for (let depth = 0; depth < 7 && container && container !== document.body; depth++, container = container.parentElement) {
          const text = container.innerText || container.textContent || "";
          if (text.length > 4000 || container.querySelectorAll("button, [role='button']").length > 60) break;
          if (nbaTeamPosition(text, h) < 0 || nbaTeamPosition(text, a) < 0) continue;
          const dated = container.closest("[data-start], [data-date]") || container.querySelector("time[datetime]");
          const date = dated?.getAttribute("data-start") || dated?.getAttribute("data-date") || dated?.getAttribute("datetime");
          if (date && item.start && Date.parse(date) !== Date.parse(item.start) && date.slice(0, 10) !== item.date) break;
          eventSeen = true;
          const resolved = resolveNbaWinner(btn, item, text, container);
          if (resolved && !found.some(c => c.btn === btn && c.start === item.start)) found.push({ ...resolved, btn, home: item.home, away: item.away, sport: "nba", start: item.start });
          break;
        }
      }
      if (eventSeen) found.push({ home: item.home, away: item.away, sport: "nba", start: item.start, key: "event", btn: null });
    }
    return found;
  }
  function captureIncomingPlays() {
    const match = String(location.hash || "").match(/[#&]mmplay=([^&]+)/);
    if (!match) return false;
    let incoming;
    try {
      incoming = JSON.parse(decodeURIComponent(match[1]));
    } catch (error) {
      gmSet("mm_sisal_import_error", String(error && error.message || error));
      return false;
    }
    const sourceItems = Array.isArray(incoming) ? incoming : (incoming && Array.isArray(incoming.items) ? incoming.items : []);
    const items = sourceItems.filter(x => x && x.home && x.away && x.marketKey).map(x => ({
      home: String(x.home),
      away: String(x.away),
      marketKey: String(x.marketKey),
      label: String(x.label || x.marketKey),
      odds: Number(x.odds) > 1 ? Number(x.odds) : null,
      probability: Number.isFinite(Number(x.probability)) && Number(x.probability) > 0 && Number(x.probability) < 1 ? Number(x.probability) : null,
      date: x.date || "",
      competition: String(x.competition || (x.sport === "nba" ? "nba" : "serie-a")),
      sport: x.sport === "nba" ? "nba" : "football",
      eventId: String(x.eventId || ""),
      start: x.start || "",
      homeAbbr: x.homeAbbr || "",
      awayAbbr: x.awayAbbr || "",
      status: "pending",
      sentAt: Number(incoming && incoming.sentAt) || Date.now()
    }));
    if (!items.length) return false;
    const key = q => q.sport + "|" + (q.competition || "") + "|" + canonicalTeam(q.home) + "|" + canonicalTeam(q.away) + "|" + q.marketKey + "|" + (q.start || q.date || "");
    const previous = readPlayQueue();
    const next = incoming && incoming.retry
      ? previous.map(q => q.status === "added" ? q : (items.find(i => key(i) === key(q)) || q))
          .concat(items.filter(i => !previous.some(q => key(q) === key(i))))
      : previous.filter(q => !items.some(i => key(i) === key(q)))
          .concat(items.map(i => previous.find(q => key(q) === key(i) && q.status === "added") || i));
    writePlayQueue(next);
    isHidden = false;
    isMinimized = false;
    gmSet("mm_sisal_last_import", String(Date.now()));
    try { history.replaceState(null, "", location.pathname + location.search); } catch (error) {}
    return true;
  }
  // Sicurezza: il bridge non clicca mai quote Sisal automaticamente.
  // Le selezioni importate restano in coda e richiedono aggiunta manuale e verifica dell'utente.
  function footballCartContains(item) {
    const expected = {
      home: "1", draw: "x", away: "2", dc1X: "1x", dcX2: "x2", dc12: "12",
      over15: "over 1 5", under15: "under 1 5", over25: "over 2 5", under25: "under 2 5",
      over35: "over 3 5", under35: "under 3 5", bttsYes: "gol", bttsNo: "no gol"
    }[item.marketKey];
    const marketTerms = {
      home: ["esito finale", "risultato finale", "1x2"], draw: ["esito finale", "risultato finale", "1x2"],
      away: ["esito finale", "risultato finale", "1x2"],
      dc1X: ["doppia chance"], dcX2: ["doppia chance"], dc12: ["doppia chance"],
      over15: ["under over", "over under"], under15: ["under over", "over under"],
      over25: ["under over", "over under"], under25: ["under over", "over under"],
      over35: ["under over", "over under"], under35: ["under over", "over under"],
      bttsYes: ["gol no gol", "goal no goal", "entrambe segnano"],
      bttsNo: ["gol no gol", "goal no goal", "entrambe segnano"]
    }[item.marketKey] || [];
    if (!expected || !marketTerms.length) return false;
    const containers = Array.from(document.querySelectorAll(NBA_CART_SELECTOR))
      .filter(c => !c.closest("#mm-widget") && c.getClientRects().length);
    return containers.some(cart => {
      const rows = Array.from(cart.querySelectorAll('[class*="item" i],[class*="selection" i],[class*="event" i],li,[data-testid*="selection" i]'));
      return rows.some(row => {
        const text = spacedText(row);
        if (!footballTeamInText(text, item.home) || !footballTeamInText(text, item.away)) return false;
        const clean = wordText(text);
        const marketOk = marketTerms.some(term => clean.includes(term));
        let outcomeOk = clean.includes(" " + expected + " ");
        if (item.marketKey === "bttsYes") outcomeOk = /(?:^| )(?:gol|goal|gg|si)(?: |$)/.test(clean) && !/(?:^| )no (?:gol|goal)(?: |$)/.test(clean);
        if (item.marketKey === "bttsNo") outcomeOk = /(?:^| )no (?:gol|goal)(?: |$)/.test(clean);
        return marketOk && outcomeOk;
      });
    });
  }

  function findQueuedSelection(item) {
    const scanned = item.sport === "nba" ? scanNbaSelections([item]) : scanFootballSelections([item]);
    return scanned.find(c => c && c.btn && c.key === item.marketKey &&
      canonicalTeam(c.home) === canonicalTeam(item.home) &&
      canonicalTeam(c.away) === canonicalTeam(item.away)) || null;
  }

  // Assistenza manuale: non clicca mai quote o pulsanti Sisal.
  function addQueuedSelection(index) {
    const queue = readPlayQueue();
    const item = queue[Number(index)];
    if (!item) return;
    const hit = findQueuedSelection(item);
    if (!hit || !hit.btn) {
      item.status = "error";
      item.errorType = "notfound";
      item.error = "Non trovo ancora questo mercato nella pagina. Apri la partita o il mercato corretto e premi «Cerca quota».";
      item.updatedAt = Date.now();
      writePlayQueue(queue);
      renderWidget();
      return;
    }
    if (hit.btn.disabled || hit.btn.getAttribute("aria-disabled") === "true") {
      item.status = "error";
      item.errorType = "notfound";
      item.error = "Mercato individuato ma quota sospesa o non disponibile.";
      item.updatedAt = Date.now();
      writePlayQueue(queue);
      renderWidget();
      return;
    }
    item.status = "manual";
    item.errorType = "";
    item.error = "Quota evidenziata in verde. Selezionala manualmente su Sisal.";
    item.sisalOdds = hit.odd;
    item.sisalOutcome = hit.outcome || null;
    item.updatedAt = Date.now();
    writePlayQueue(queue);
    markSelectedMarket(hit.btn, item, hit.odd);
    hit.btn.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    hit.btn.classList.add("mm-highlight-pulse");
    setTimeout(() => hit.btn?.classList?.remove("mm-highlight-pulse"), 1800);
    renderWidget();
  }

  function markSelectedMarket(btn, item, odds) {
    if (!btn || !document.body.contains(btn)) return;
    const probability = Number(item && item.probability);
    const hasProbability = Number.isFinite(probability) && probability > 0 && probability < 1;
    btn.classList.add("mm-highlight-btn", "mm-selected-from-app");
    let tag = btn.querySelector(":scope > .mm-selected-app-tag");
    if (!tag) {
      tag = document.createElement("span");
      tag.className = "mm-selected-app-tag";
      btn.appendChild(tag);
    }
    tag.textContent = hasProbability
      ? "SELEZIONA · MatchMind " + Math.round(probability * 100) + "%"
      : "SELEZIONA · MatchMind";
    tag.title = "Mercato selezionato nell'app MatchMind" +
      (hasProbability ? " · probabilità stimata " + (probability * 100).toFixed(1) + "%" : "") +
      (Number(odds) > 1 ? " · quota Sisal " + Number(odds).toFixed(2) : "");
  }

  function autoPlayQueue(calculations) {
    const queue = readPlayQueue();
    let changed = false;
    for (let index = 0; index < queue.length; index++) {
      const item = queue[index];
      if (item.status === "added" || item.status === "error") continue;
      if (item.sport === "nba" && nbaCartContains(item, { outcome: item.sisalOutcome })) {
        item.status = "added"; item.error = ""; item.errorType = ""; item.updatedAt = Date.now(); changed = true; continue;
      }
      if (item.sport !== "nba" && footballCartContains(item)) {
        item.status = "added"; item.error = ""; item.errorType = ""; item.updatedAt = Date.now(); changed = true; continue;
      }
      if (item.status === "manual" || item.status === "clicked") {
        const existingHit = (calculations || []).find(c => c && c.btn && c.key === item.marketKey &&
          canonicalTeam(c.home) === canonicalTeam(item.home) &&
          canonicalTeam(c.away) === canonicalTeam(item.away));
        if (existingHit) markSelectedMarket(existingHit.btn, item, existingHit.odd);
        continue;
      }
      const h = canonicalTeam(item.home), a = canonicalTeam(item.away);
      const sameMatch = (calculations || []).filter(c => canonicalTeam(c.home) === h && canonicalTeam(c.away) === a &&
        (item.sport !== "nba" || (c.sport === "nba" && c.start === item.start)));
      if (!sameMatch.length) continue;
      const hit = sameMatch.find(c => c.btn && c.key === item.marketKey);
      if (!hit) {
        item.status = "pending"; item.errorType = "";
        item.error = "Partita riconosciuta; mercato non ancora identificato. Apri l'evento e usa «Trova quota».";
      } else if (hit.btn.disabled || hit.btn.getAttribute("aria-disabled") === "true") {
        item.status = "error"; item.errorType = "notfound"; item.error = "Quota sospesa o non disponibile su Sisal.";
      } else {
        item.status = "manual"; item.errorType = "";
        item.error = "Quota evidenziata in verde: selezionala manualmente su Sisal.";
        item.sisalOdds = hit.odd; item.sisalOutcome = hit.outcome || null;
        if (hit.btn && item.marketKey === hit.key) markSelectedMarket(hit.btn, item, hit.odd);
      }
      item.updatedAt = Date.now(); changed = true;
    }
    if (changed) { writePlayQueue(queue); if (typeof syncCartState === "function") syncCartState(); }
  }

  function renderPlayQueue(widget) {
    const queue = readPlayQueue();
    let box = document.getElementById("mm-play-queue");
    if (!queue.length) { if (box) box.remove(); return; }
    if (!box) { box = document.createElement("div"); box.id = "mm-play-queue"; }
    const done = queue.filter(q => q.status === "added").length;
    const expanded = gmGet("mm_sisal_queue_expanded", "false") === "true";
    box.innerHTML =
      '<div style="display:flex;align-items:center;gap:7px;font-weight:800;font-size:12px;margin-bottom:4px;">' +
        '<span style="flex:1;min-width:0;">🎯 MatchMind: ' + done + '/' + queue.length + ' nel biglietto</span>' +
        '<button type="button" id="mm-play-toggle" class="mm-icon-btn" aria-expanded="' + expanded + '">' + (expanded ? 'Nascondi' : 'Dettagli') + '</button>' +
        '<button type="button" id="mm-play-clear" class="mm-icon-btn" title="Svuota elenco">🗑</button>' +
      '</div>' +
      '<div id="mm-play-queue-items" style="display:' + (expanded ? 'block' : 'none') + ';">' +
      '<div style="font-size:10px;color:#94a3b8;margin-bottom:5px;">Seleziona manualmente su Sisal le quote evidenziate in verde. MatchMind non clicca e non invia scommesse.</div>' +
      queue.map((q, i) => {
        const state = q.status === "added" ? "✓ nel biglietto" :
          q.status === "clicked" ? "click inviato · verifica" :
          q.status === "error" ? "⚠ da verificare" :
          q.status === "manual" ? "DA SELEZIONARE · evidenziata" : "in attesa";
        const color = q.status === "added" || q.status === "manual" ? "#34d399" : q.status === "error" ? "#f87171" : "#fbbf24";
        const action = q.status === "added" ? "" :
          '<button type="button" data-mm-add-queue="' + i + '" style="border:1px solid #36536a;background:#123047;color:#e0f2fe;border-radius:6px;padding:5px 8px;font-size:10px;font-weight:800;white-space:nowrap;">' +
            (q.status === "manual" ? "Mostra quota" : q.status === "error" ? "Cerca quota" : "Cerca quota") + '</button>';
        return '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0;border-top:1px solid #1e293b;">' +
          '<span style="min-width:0;font-size:11px;">' + escapeHtml(q.home) + ' – ' + escapeHtml(q.away) + '<br><small>' + escapeHtml(q.competition || (q.sport === "nba" ? "NBA" : "Calcio")) + '</small><br><b>' + escapeHtml(q.label) + '</b>' +
          (Number.isFinite(Number(q.probability)) && Number(q.probability) > 0 && Number(q.probability) < 1 ? ' · ' + Math.round(Number(q.probability) * 100) + '%' : '') +
          (q.sisalOdds ? ' · @' + Number(q.sisalOdds).toFixed(2) : '') + '</span>' +
          '<span style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0;">' +
            '<span style="font-size:10px;color:' + color + ';">' + state + '</span>' + action +
          '</span></div>' +
          (q.error ? '<div style="font-size:10px;color:#cbd5e1;padding:0 0 5px;">' + escapeHtml(q.error) + '</div>' : '');
      }).join("") + '</div>';
    box.dataset.expanded = String(expanded);
    const anchor = document.getElementById("mm-resize-grip");
    if (anchor && anchor.parentElement === widget) widget.insertBefore(box, anchor);
    else widget.appendChild(box);
    box.querySelector("#mm-play-toggle")?.addEventListener("click", event => {
      event.stopPropagation();
      const nextExpanded = gmGet("mm_sisal_queue_expanded", "false") !== "true";
      gmSet("mm_sisal_queue_expanded", String(nextExpanded));
      renderPlayQueue(widget);
    });
    box.querySelector("#mm-play-clear")?.addEventListener("click", event => {
      event.stopPropagation();
      writePlayQueue([]);
      renderWidget();
    });
    box.querySelectorAll("[data-mm-add-queue]").forEach(button => {
      button.addEventListener("click", event => {
        event.stopPropagation();
        addQueuedSelection(button.dataset.mmAddQueue);
      });
    });
  }
  function escapeHtml(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }


  // Osservatore leggero: nessuna querySelector o lettura di textContent per ogni nodo mutato.
  const MIN_SCAN_INTERVAL = 1600;
  const MUTATION_DEBOUNCE = 550;
  let lastScanTime = 0;
  let scanTimer = null;

  function scheduleScan(delay = MUTATION_DEBOUNCE) {
    if (document.hidden || scanTimer) return;
    const wait = Math.max(delay, MIN_SCAN_INTERVAL - (Date.now() - lastScanTime));
    scanTimer = setTimeout(() => {
      scanTimer = null;
      if (document.hidden) return;
      lastScanTime = Date.now();
      scanPage();
    }, Math.max(0, wait));
  }

  const observer = new MutationObserver(mutations => {
    if (isMutatingDOM || document.hidden) return;
    for (const mutation of mutations) {
      if (mutation.type !== "childList") continue;
      let relevant = false;
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.id === "mm-widget" || node.closest?.("#mm-widget")) continue;
        if (/^(SCRIPT|STYLE|LINK|META)$/.test(node.tagName || "")) continue;
        relevant = true;
        break;
      }
      if (relevant) { scheduleScan(); break; }
    }
  });
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });

  // I cambi di menu, scheda o rotta anticipano la scansione; il click Sisal resta nativo.
  document.addEventListener("click", event => {
    if (event.target?.closest?.("#mm-widget")) return;
    if (event.target?.closest?.("button,a,[role='button'],[role='tab']")) scheduleScan(350);
  }, true);
  window.addEventListener("popstate", () => scheduleScan(250));
  window.addEventListener("hashchange", () => {
    captureIncomingPlays();
    scheduleScan(250);
  });
  window.addEventListener("load", () => scheduleScan(500), { once: true });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) scheduleScan(250);
    else if (scanTimer) { clearTimeout(scanTimer); scanTimer = null; }
  });

  // Fallback per le SPA che non notificano cambi DOM o cronologia.
  setInterval(() => { if (!document.hidden) scheduleScan(0); }, 10000);
  scheduleScan(900);
})();
