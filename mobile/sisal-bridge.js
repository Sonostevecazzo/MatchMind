"use strict";
(function (root, factory) {
  const bridge = factory();
  if (typeof module === "object" && module.exports) module.exports = bridge;
  if (root) root.MatchMindSisalBridge = bridge;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const SISAL_URL = "https://www.sisal.it/scommesse";
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
      const marketKey = String(row && row.marketKey || "");
      const home = String(match && match.home || "").trim();
      const away = String(match && match.away || "").trim();
      if (!home || !away || !SUPPORTED_MARKETS.has(marketKey)) return;
      const rawDate = String(match.date || row.date || "").trim();
      const date = validDate(rawDate);
      const label = String(row.marketLabel || row.label || marketKey).trim() || marketKey;
      items.push({ home, away, marketKey, label, date, sport: "football" });
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
    return { ...result, url: SISAL_URL + "#mmplay=" + encoded };
  }

  return { prepare, createUrl };
});
