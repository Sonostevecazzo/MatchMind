/* MatchMind bet-slip analysis engine. Pure functions shared by browser and Node tests. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MatchMindBets = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const normalize = value => String(value || "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

  const MARKET_PATTERNS = [
    { key: "over15", label: "Over 1,5", re: /(?:u\s*\/\s*o\s*1[,.]5\s*[:\-]?\s*over|over\s*1[,.]5)/i },
    { key: "under15", label: "Under 1,5", re: /(?:u\s*\/\s*o\s*1[,.]5\s*[:\-]?\s*under|under\s*1[,.]5)/i },
    { key: "over25", label: "Over 2,5", re: /(?:u\s*\/\s*o\s*2[,.]5\s*[:\-]?\s*over|over\s*2[,.]5)/i },
    { key: "under25", label: "Under 2,5", re: /(?:u\s*\/\s*o\s*2[,.]5\s*[:\-]?\s*under|under\s*2[,.]5)/i },
    { key: "over35", label: "Over 3,5", re: /(?:u\s*\/\s*o\s*3[,.]5\s*[:\-]?\s*over|over\s*3[,.]5)/i },
    { key: "under35", label: "Under 3,5", re: /(?:u\s*\/\s*o\s*3[,.]5\s*[:\-]?\s*under|under\s*3[,.]5)/i },
    { key: "bttsNo", label: "No Gol", re: /(?:no\s+gol|no\s+goal|btts\s*no)/i },
    { key: "bttsYes", label: "Gol", re: /(?:both\s+teams\s+to\s+score|\bbtts\b|\bgol\b)/i }
  ];

  const BET_MARKETS = [
    ["over15", "Over 1,5"], ["under15", "Under 1,5"],
    ["over25", "Over 2,5"], ["under25", "Under 2,5"],
    ["over35", "Over 3,5"], ["under35", "Under 3,5"],
    ["bttsYes", "Gol"], ["bttsNo", "No Gol"],
    ["home", "1"], ["draw", "X"], ["away", "2"]
  ];

  function marketChoices() {
    return BET_MARKETS.map(([key, label]) => [key, label]);
  }

  function matchFixture(text, fixtures, isUpcoming) {
    const haystack = normalize(text);
    const eligible = (fixtures || []).filter(match => !isUpcoming || isUpcoming(match));
    return eligible.find(match => {
      const home = normalize(match.home), away = normalize(match.away);
      return home && away && haystack.includes(home) && haystack.includes(away);
    }) || null;
  }

  function parseMarket(text) {
    const value = String(text || "");
    for (const market of MARKET_PATTERNS) {
      if (market.re.test(value)) return { key: market.key, label: market.label };
    }
    const result = value.match(/(?:1x2|esito\s*(?:finale)?|risultato)\s*[:\-]?\s*([1x2])\b/i);
    if (result) return { key: ({ "1": "home", "x": "draw", "2": "away" })[result[1].toLowerCase()], label: "Esito " + result[1].toUpperCase() };
    return null;
  }

  function marketProbability(forecast, key) {
    const p = forecast && forecast.probabilities;
    if (!p) return null;
    const map = {
      over15: p.o15, under15: 1 - p.o15,
      over25: p.o25, under25: 1 - p.o25,
      over35: p.o35, under35: 1 - p.o35,
      bttsYes: p.btts, bttsNo: 1 - p.btts,
      home: p.home, draw: p.draw, away: p.away
    };
    const result = map[key];
    return Number.isFinite(result) && result >= 0 && result <= 1 ? result : null;
  }

  function readOdds(text) {
    const source = String(text || "");
    const explicit = source.match(/(?:quota|odd|odds|@)\s*[:=]?\s*(\d+(?:[,.]\d+)?)/i);
    if (explicit) {
      const value = Number(String(explicit[1]).replace(",", "."));
      return Number.isFinite(value) && value > 1 && value <= 1000 ? value : null;
    }
    const market = /(?:u\s*\/\s*o\s*[123][,.]5\s*[:\-]?\s*(?:over|under)|(?:over|under)\s*[123][,.]5)/i.exec(source);
    const suffix = market ? source.slice(market.index + market[0].length) : source;
    const matches = [...suffix.matchAll(/\b(\d+[,.]\d{1,3})\b/g)];
    for (const found of matches.reverse()) {
      const value = Number(String(found[1]).replace(",", "."));
      if (Number.isFinite(value) && value > 1 && value <= 1000) return value;
    }
    return null;
  }

  function parseSlip(text, fixtures, forecastFn, isUpcoming) {
    const lines = String(text || "").split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const blocks = [];
    let current = null;
    for (const line of lines) {
      const fixture = matchFixture(line, fixtures, isUpcoming);
      if (fixture) {
        if (current) blocks.push(current);
        current = { fixture, lines: [line] };
      } else if (current) current.lines.push(line);
      else {
        const fixtureInWholeLine = matchFixture(line, fixtures, isUpcoming);
        if (fixtureInWholeLine) current = { fixture: fixtureInWholeLine, lines: [line] };
      }
    }
    if (current) blocks.push(current);

    if (!blocks.length && lines.length) {
      const joined = lines.join(" ");
      const fixture = matchFixture(joined, fixtures, isUpcoming);
      if (fixture) blocks.push({ fixture, lines });
    }

    return blocks.map(block => {
      const source = block.lines.join(" ");
      const market = parseMarket(source);
      if (!market) return { ok: false, match: block.fixture, market: null, odds: readOdds(source), reason: "Mercato non riconosciuto: selezionalo manualmente per completare il controllo." };
      const forecast = forecastFn(block.fixture);
      const probability = marketProbability(forecast, market.key);
      if (probability === null) return { ok: false, match: block.fixture, market, reason: "Probabilità del mercato non disponibile nel modello." };
      const odds = readOdds(source);
      const sampleEnough = Boolean(forecast && forecast.sampleEnough);
      return {
        ok: true, match: block.fixture, market, probability, odds, sampleEnough,
        historyCount: Number(forecast.historyCount || 0),
        breakEvenProbability: odds ? 1 / odds : null,
        theoreticalEv: odds && sampleEnough ? probability * odds - 1 : null,
        reason: sampleEnough ? null : "Campione storico insufficiente: stima mostrata solo a titolo informativo."
      };
    });
  }

  function combineSelections(selections) {
    const rows = Array.isArray(selections) ? selections : [];
    if (!rows.length) return { available: false, reason: "Nessuna selezione valida." };
    if (rows.some(row => !row || !row.ok || !row.sampleEnough ||
        !Number.isFinite(row.probability) || row.probability < 0 || row.probability > 1)) {
      return { available: false, reason: "Non tutte le selezioni hanno probabilità e campione sufficienti." };
    }
    if (rows.some(row => !row.match || !row.match.home || !row.match.away || !row.match.date)) {
      return { available: false, reason: "Una o più selezioni non sono associate a una partita valida." };
    }
    const ids = rows.map(row => {
      const teams = [normalize(row.match.home), normalize(row.match.away)].sort();
      return teams.join("|") + "|" + row.match.date;
    });
    if (new Set(ids).size !== ids.length) {
      return { available: false, reason: "Sono presenti più selezioni sulla stessa partita: la probabilità congiunta richiede un modello di correlazione." };
    }
    const probability = rows.reduce((total, row) => total * row.probability, 1);
    return {
      available: true, probability,
      assumption: "Prodotto delle probabilità marginali; indipendenza tra partite assunta, non verificata."
    };
  }

  function buildTicket(fixtures, forecastFn, threshold, options) {
    const target = Number(threshold);
    const requestedMaxLegs = Number(options && options.maxLegs);
    const maxLegs = Number.isFinite(requestedMaxLegs) && requestedMaxLegs > 0
      ? Math.max(1, Math.min(15, Math.floor(requestedMaxLegs))) : 5;
    if (!Number.isFinite(target) || target < 0 || target > 1) {
      return { available: false, reason: "Soglia probabilistica non valida." };
    }
    if (typeof forecastFn !== "function") {
      return { available: false, reason: "Modello probabilistico non disponibile." };
    }

    const uniqueFixtures = [];
    const seen = new Set();
    for (const match of Array.isArray(fixtures) ? fixtures : []) {
      if (!match || !match.home || !match.away || !match.date) continue;
      const id = [normalize(match.home), normalize(match.away)].sort().join("|") + "|" + match.date;
      if (seen.has(id)) continue;
      seen.add(id);
      uniqueFixtures.push(match);
    }
    if (!uniqueFixtures.length) {
      return {
        available: false,
        reason: "Non ci sono partite future nella giornata selezionata.",
        eligibleFixtures: 0,
        upcomingFixtures: 0,
        threshold: target
      };
    }

    const candidates = [];
    for (const match of uniqueFixtures) {
      let forecast;
      try {
        forecast = forecastFn(match);
      } catch (_) {
        continue;
      }
      if (!forecast) continue;
      const support = Number.isFinite(forecast.minTeamSample) ? forecast.minTeamSample : (forecast.sampleEnough ? 10 : Math.min(forecast.home?.played || 0, forecast.away?.played || 0));
      if (support < 3) continue;
      let best = null;
      const fixtureKey = [normalize(match.home), normalize(match.away)].sort().join("|") + "|" + match.date;
      const preferredKey = options && options.marketOverrides && options.marketOverrides[fixtureKey];
      const preferred = BET_MARKETS.find(item => item[0] === preferredKey);
      if (preferred) {
        const probability = marketProbability(forecast, preferred[0]);
        if (probability !== null) best = { match, market: preferred[1], marketKey: preferred[0], probability, historyCount: forecast.historyCount || 0, confidence: forecast.confidence || "non valutata", sampleEnough: Boolean(forecast.sampleEnough), preferredByUser: true };
      }
      for (const [key, label] of BET_MARKETS) {
        if (best && best.preferredByUser) break;
        const probability = marketProbability(forecast, key);
        if (probability === null) continue;
        if (!best || probability > best.probability) best = { match, market: label, marketKey: key, probability, historyCount: forecast.historyCount || 0, confidence: forecast.confidence || "non valutata", sampleEnough: Boolean(forecast.sampleEnough), preferredByUser: false };
      }
      if (best) candidates.push(best);
    }

    candidates.sort((a, b) => Number(Boolean(b.preferredByUser)) - Number(Boolean(a.preferredByUser)) ||
      b.probability - a.probability || String(a.match.date).localeCompare(String(b.match.date)));
    if (!candidates.length) {
      return {
        available: false,
        reason: "Le partite ci sono, ma lo storico non raggiunge il campione minimo (10 risultati per squadra). Aggiorna i dati storici e riprova.",
        eligibleFixtures: 0,
        upcomingFixtures: uniqueFixtures.length,
        threshold: target
      };
    }

    const chosen = [];
    let joint = 1;
    for (const candidate of candidates) {
      if (chosen.length >= maxLegs) break;
      const next = joint * candidate.probability;
      if (next + 1e-12 < target) break;
      chosen.push(candidate);
      joint = next;
    }
    let thresholdReached = joint + 1e-12 >= target;
    if (!chosen.length) {
      chosen.push(candidates[0]);
      joint = candidates[0].probability;
      thresholdReached = joint + 1e-12 >= target;
    }
    return {
      available: true, selections: chosen, probability: joint, threshold: target, thresholdReached,
      eligibleFixtures: candidates.length,
      upcomingFixtures: uniqueFixtures.length,
      assumption: "Prodotto delle probabilità marginali; indipendenza tra partite assunta, non verificata.",
      warning: "Il modello non è una garanzia e non dimostra redditività. La combinazione va confrontata con quote aggiornate."
    };
  }

  return { normalize, matchFixture, parseMarket, marketProbability, readOdds, parseSlip, combineSelections, buildTicket, marketChoices };
});
