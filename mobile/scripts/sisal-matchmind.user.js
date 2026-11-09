// ==UserScript==
// @name         MatchMind · Sisal Value Bets & Sync
// @namespace    https://sonostevecazzo.github.io/MatchMind/
// @version      1.8.0
// @description  Valutazione statistica chiara per tutti i mercati Sisal supportati, non solo quelli consigliati.
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
  const matchContexts = {};

  function getMatchContext(home, away) {
    const key = `${canonicalTeam(home)}|${canonicalTeam(away)}`;
    return matchContexts[key] || {
      attackingAbsencesHome: 0,
      defensiveAbsencesHome: 0,
      motivationHome: 0,
      attackingAbsencesAway: 0,
      defensiveAbsencesAway: 0,
      motivationAway: 0
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

    // 1. Fallback su pathname URL Sisal (es. /scommesse-matchpoint/.../roma-sassuolo o /roma-sassuolo-2026...)
    try {
      const path = (window.location.pathname || "").toLowerCase();
      const segments = path.split("/").filter(Boolean);
      for (let i = segments.length - 1; i >= 0; i--) {
        const seg = segments[i].replace(/-\d{6,}$/, "");
        const parts = seg.split("-");
        if (parts.length >= 2) {
          const h = parts[0].trim();
          const a = parts[1].trim();
          if (h.length >= 3 && a.length >= 3 && h !== a && !h.includes("scommesse") && !h.includes("evento") && !h.includes("calcio")) {
            return { home: h, away: a };
          }
        }
      }
    } catch (e) {}

    // 2. Title della pagina
    const titleMatch = document.title.match(teamSepRegex);
    if (titleMatch) {
      let h = titleMatch[1].replace(/^(quote|scommesse|partita|live)\s+/i, "").trim();
      let a = titleMatch[2].replace(/\s+(scommesse|quote|sisal|calcio|serie).*$/i, "").replace(/\s*\|.*$/, "").trim();
      if (h.length >= 3 && a.length >= 3 && h !== a) return { home: h, away: a };
    }

    // 3. Headings e titoli evento
    const headEls = document.querySelectorAll("h1, h2, [class*='title'], [class*='match-name'], [class*='scoreboard'], [data-qa*='match']");
    for (const el of headEls) {
      const txt = (el.innerText || "").trim();
      const m = txt.match(teamSepRegex);
      if (m) {
        let h = m[1].replace(/^(quote|scommesse|partita|live)\s+/i, "").trim();
        let a = m[2].replace(/\s+(scommesse|quote|sisal|calcio|serie).*$/i, "").replace(/\s*\|.*$/, "").trim();
        if (h.length >= 3 && a.length >= 3 && h !== a) return { home: h, away: a };
      }
    }

    // 4. Selettori squadre concorrenti
    const teamEls = Array.from(document.querySelectorAll("[class*='competitor'], [class*='team-name'], [class*='teamName'], [class*='participant']"));
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
        floatingBadge.title = "Apri MatchMind Widget";
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

      const countBadge = currentView === "all_markets"
        ? `${allMarketsList.length} Mercati`
        : `${activePicks.length} Consigliate`;

      widget.innerHTML = `
        <div id="mm-widget-min-bar" style="display:flex;align-items:center;gap:6px;font-size:11px;font-weight:700;line-height:1;user-select:none;">
          <span style="color:#c4f36a;font-size:13px;">🧠 MM</span>
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
          <div style="display:flex;align-items:center;gap:5px;"><span>🧠 MatchMind Sisal</span><span style="font-size:9px;background:#1e293b;padding:1px 4px;border-radius:4px;color:#94a3b8;">v1.8</span></div>
          <div class="mm-head-actions">
            <button id="mm-btn-minimize" class="mm-icon-btn" title="Riduci a pillola">—</button>
            <button id="mm-btn-close-w" class="mm-icon-btn" title="Nascondi">✕</button>
          </div>
        </div>
        <div style="font-size:11px;color:#94a3b8;padding:10px 0;text-align:center;">
          Nessuna quota calcistica rilevata.<br/><span style="font-size:10px;color:#64748b;">Apri una singola partita o il palinsesto.</span>
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
        <div style="display:flex;align-items:center;gap:5px;"><span>🧠 MatchMind Sisal</span><span style="font-size:9px;background:#1e293b;padding:1px 4px;border-radius:4px;color:#94a3b8;">v1.8</span></div>
        <div class="mm-head-actions"><button id="mm-btn-minimize" class="mm-icon-btn" title="Riduci a pillola">—</button><button id="mm-btn-close-w" class="mm-icon-btn" title="Nascondi">✕</button></div>
      </div>
      <div class="mm-match-title">${headerTitle}</div>
      <div style="font-size:9px;color:#fbbf24;background:#29200b;border:1px solid #854d0e;border-radius:5px;padding:4px 6px;line-height:1.3;">Stime indicative del modello MatchMind, non validate per questa partita. EV teorico, non garanzia.</div>
      ${!isMulti && currentAnalysis.home && currentAnalysis.away ? (() => {
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

  // Scansione principale della pagina Sisal
  function scanPage() {
    const singleMatch = detectSingleMatch();
    const multiMatches = detectMultipleMatches();
    const calculations = [];

    if (singleMatch) {
      const forecast = calculateMatchMindForecast(singleMatch.home, singleMatch.away);
      const mmProbs = forecast.probabilities;
      const foundOddsByMarket = new Map();
      const oddButtons = Array.from(document.querySelectorAll("button, [role='button'], [class*='odd'], [class*='quota'], [class*='selection']")).filter(el => {
        if (el.closest("#mm-widget")) return false;
        const txt = el.innerText || el.textContent || "";
        return /\b\d+[.,]\d{2}\b/.test(txt) && txt.length < 50;
      });

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

      currentAnalysis = { isMulti: false, home: singleMatch.home, away: singleMatch.away, matchCount: 1, calculations, allMarketsList };
    } else if (multiMatches.length > 0) {
      multiMatches.forEach(item => {
        const forecast = calculateMatchMindForecast(item.home, item.away);
        const mmProbs = forecast.probabilities;
        const oddButtons = Array.from(item.container.querySelectorAll("button, [role='button'], [class*='odd'], [class*='quota'], [class*='selection']")).filter(el => {
          if (el.closest("#mm-widget")) return false;
          const txt = el.innerText || el.textContent || "";
          return /\b\d+[.,]\d{2}\b/.test(txt) && txt.length < 50;
        });
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
      currentAnalysis = { isMulti: true, matchCount: multiMatches.length, calculations, allMarketsList: calculations };
    } else {
      currentAnalysis = { isMulti: false, home: "Partita", away: "In corso", matchCount: 0, calculations: [], allMarketsList: [] };
    }

    updatePageBadges();
    renderWidget();
  }

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


  // --- GESTIONE ISPETTORE QUOTA INTERATTIVO AL TAP ---
  
  // Click/tap sulle quote Sisal non intercettati: nessun popup o apertura automatica di MatchMind,
  // il click rimane 100% nativo per comporre la schedina Sisal in tranquillità.


  window.addEventListener("load", () => {
    setTimeout(scanPage, 1000);
  });
  setTimeout(scanPage, 1200);


  // Scansione periodica ogni 2.5 secondi per gestire la Single Page App di Sisal durante scroll e navigazione
  setInterval(() => {
    if (document.hidden) return;
    scanPage();
  }, 2500);

})();
