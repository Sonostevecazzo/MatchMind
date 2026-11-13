"use strict";
(function (root, factory) {
  const bridge = factory();
  if (typeof module === "object" && module.exports) module.exports = bridge;
  if (root) root.MatchMindSisalBridge = bridge;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const SISAL_URL = "https://www.sisal.it/scommesse-matchpoint/sport/calcio";
  const NBA_SISAL_URL = "https://www.sisal.it/scommesse-matchpoint/sport/basket/usa/nba";
  const NBA_MARKETS = new Set(["nbaMoneyline:home", "nbaMoneyline:away"]);
  const FOOTBALL_MARKETS = new Set([
    "home", "draw", "away", "dc1X", "dcX2", "dc12",
    "over15", "under15", "over25", "under25", "over35", "under35",
    "bttsYes", "bttsNo"
  ]);
  const COMBO_MARKET = /^combo:(home|draw|away):(over15|under15|over25|under25|over35|under35|bttsYes|bttsNo)$/;

  function validDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
    if (!match) return "";
    const date = new Date(value + "T00:00:00.000Z");
    return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value ? "" : value;
  }

  function probability(value) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 && number <= 1 ? number : null;
  }

  function supportedMarket(key, sport) {
    const value = String(key || "");
    return sport === "nba" ? NBA_MARKETS.has(value) :
      FOOTBALL_MARKETS.has(value) || COMBO_MARKET.test(value);
  }

  function cleanPredictions(row, sport) {
    const entries = Array.isArray(row && row.predictions) ? row.predictions : [];
    const result = [];
    const seen = new Set();
    entries.forEach(entry => {
      if (!entry) return;
      const marketKey = String(entry.marketKey || entry.key || "");
      const value = probability(entry.probability);
      if (!supportedMarket(marketKey, sport) || value === null || seen.has(marketKey)) return;
      seen.add(marketKey);
      // Per-market metadata is inherited from the match item. Repeating it
      // for every market multiplies the handoff URL for multi-match slips.
      result.push({ marketKey, probability: value });
    });
    const selectedKey = String(row && row.marketKey || "");
    const selectedProbability = probability(row && row.probability);
    if (selectedKey && supportedMarket(selectedKey, sport) && selectedProbability !== null && !seen.has(selectedKey)) {
      result.push({
        marketKey: selectedKey,
        label: String(row.marketLabel || row.label || selectedKey),
        probability: selectedProbability,
        sampleEnough: row.sampleEnough === true,
        historyCount: Number.isFinite(Number(row.historyCount)) ? Math.max(0, Number(row.historyCount)) : 0,
        model: String(row.predictionMethod || (sport === "nba" ? "NBA Elo" : "MatchMind"))
      });
    }
    return result;
  }

  function prepare(rows, sentAt) {
    const source = Array.isArray(rows) ? rows : [];
    const items = [];
    source.forEach(row => {
      const match = row && row.match ? row.match : row;
      const sport = row && row.sport === "nba" ? "nba" : "football";
      const marketKey = String(row && row.marketKey || "");
      const home = String(match && match.home || "").trim();
      const away = String(match && match.away || "").trim();
      if (!home || !away || !supportedMarket(marketKey, sport)) return;
      const rawDate = String(match.date || row.date || "").trim();
      const date = validDate(rawDate);
      const selectedProbability = probability(row && row.probability);
      const predictions = cleanPredictions(row, sport);
      const selected = predictions.find(entry => entry.marketKey === marketKey);
      const label = String(row.marketLabel || row.label || selected?.label || marketKey).trim() || marketKey;
      const competition = sport === "nba" ? "nba" : String(match.competition || row.competition || "serie-a");
      const eventId = String(match.id || row.eventId || row.id || "");
      const sampleEnough = row.sampleEnough === true || Boolean(row.forecast && row.forecast.sampleEnough);
      const historyCount = Number.isFinite(Number(row.historyCount)) ? Number(row.historyCount) :
        Number(row.forecast && row.forecast.historyCount) || 0;
      const item = {
        home, away, marketKey, label, date, competition, eventId, sport,
        probability: selected ? selected.probability : selectedProbability,
        predictions,
        sampleEnough,
        historyCount: Math.max(0, historyCount),
        predictionMethod: String(row.predictionMethod || (row.forecast && row.forecast.predictionMethod) || (sport === "nba" ? "NBA Elo" : "MatchMind"))
      };
      if (sport === "nba") {
        item.start = String(match.start || row.start || "");
        item.homeAbbr = String(match.homeAbbr || row.homeAbbr || "");
        item.awayAbbr = String(match.awayAbbr || row.awayAbbr || "");
        item.side = marketKey.endsWith(":home") ? "home" : "away";
        item.team = String(row.team || (item.side === "home" ? home : away));
      }
      items.push(item);
    });
    const timestamp = Number(sentAt);
    const payload = {
      version: 3,
      sentAt: Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now(),
      items
    };
    return { payload, skipped: source.length - items.length, total: source.length };
  }

  function createUrl(rows, options) {
    const result = prepare(rows, options && options.sentAt);
    if (!result.payload.items.length) return { ...result, url: null };
    const hasFootball = result.payload.items.some(item => item.sport !== "nba");
    const hasNba = result.payload.items.some(item => item.sport === "nba");
    const base = hasNba && !hasFootball ? NBA_SISAL_URL : SISAL_URL;
    // Tuple-based wire format avoids repeating verbose JSON property names
    // across every event and market in a multi-selection slip.
    const wire = {
      v: 3,
      t: result.payload.sentAt,
      i: result.payload.items.map(item => [
        item.home, item.away, item.marketKey, item.label, item.date,
        item.competition, item.eventId, item.sport, item.probability,
        item.predictions.map(prediction => [prediction.marketKey, prediction.probability]),
        item.sampleEnough ? 1 : 0, item.historyCount, item.predictionMethod,
        item.start || "", item.homeAbbr || "", item.awayAbbr || "",
        item.side || "", item.team || ""
      ])
    };
    const encoded = encodeURIComponent(JSON.stringify(wire));
    // Keep the transfer payload in the fragment: it is available to the userscript but is not sent to Sisal/Akamai as a long query string.\n    return { ...result, url: base + "?mmplay=" + encoded };
  }

  return { prepare, createUrl, supportedMarket, cleanPredictions };
});
