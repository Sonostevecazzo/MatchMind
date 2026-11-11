"use strict";
(function (root, factory) {
  const bridge = factory();
  if (typeof module === "object" && module.exports) module.exports = bridge;
  if (root) root.MatchMindSisalBridge = bridge;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const SISAL_URL = "https://www.sisal.it/scommesse";
  const NBA_SISAL_URL = "https://www.sisal.it/scommesse-matchpoint/sport/basket/usa/nba";
  const NBA_MARKETS = new Set(["nbaMoneyline:home", "nbaMoneyline:away"]);
  const SUPPORTED_MARKETS = new Set([
    "home", "draw", "away", "dc1X", "dcX2", "dc12",
    "over15", "under15", "over25", "under25", "over35", "under35",
    "bttsYes", "bttsNo"
  ]);

  function validDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return "";
    const date = new Date(value + "T00:00:00.000Z");
    return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value ? "" : value;
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
      const supported = sport === "nba" ? NBA_MARKETS.has(marketKey) : SUPPORTED_MARKETS.has(marketKey);
      if (!home || !away || !supported) return;
      const rawDate = String(match.date || row.date || "").trim();
      const date = validDate(rawDate);
      const label = String(row.marketLabel || row.label || marketKey).trim() || marketKey;
      const probability = Number(row && row.probability);
      const validProbability = Number.isFinite(probability) && probability > 0 && probability < 1 ? probability : null;
      const competition = sport === "nba" ? "nba" : String(match.competition || row.competition || "serie-a");
      const eventId = String(match.id || row.eventId || row.id || "");
      const item = { home, away, marketKey, label, date, competition, eventId, sport, probability: validProbability };
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
      sentAt: Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now(),
      items
    };
    return { payload, skipped: source.length - items.length, total: source.length };
  }

  function createUrl(rows, options) {
    const result = prepare(rows, options && options.sentAt);
    if (!result.payload.items.length) return { ...result, url: null };
    const encoded = encodeURIComponent(JSON.stringify(result.payload));
    const hasFootball = result.payload.items.some(item => item.sport !== "nba");
    const hasNba = result.payload.items.some(item => item.sport === "nba");
    const base = hasNba && !hasFootball ? NBA_SISAL_URL : SISAL_URL;
    return { ...result, url: base + "#mmplay=" + encoded };
  }

  return { prepare, createUrl };
});
