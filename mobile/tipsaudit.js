/* TipsAudit public fair-odds feed. No API key; attribution is required. */
(function (root) {
  "use strict";
  const ENDPOINT = "https://tipsaudit.com/api/v1/predictions";
  const CACHE_MS = 5 * 60 * 1000;
  let cached = null;
  let cachedAt = 0;
  let pending = null;

  function normalize(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function sameTeam(a, b) {
    const x = normalize(a), y = normalize(b);
    return Boolean(x && y && (x === y || (Math.min(x.length, y.length) >= 5 && (x.includes(y) || y.includes(x))));
  }

  function localDate(iso) {
    const date = new Date(iso);
    if (!Number.isFinite(date.getTime())) return "";
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(date);
    const get = type => parts.find(part => part.type === type)?.value || "";
    return get("year") + "-" + get("month") + "-" + get("day");
  }

  async function getPredictions(force) {
    if (!force && cached && Date.now() - cachedAt < CACHE_MS) return cached;
    if (!force && pending) return pending;
    pending = fetch(ENDPOINT, { headers: { Accept: "application/json" }, cache: "no-store" })
      .then(response => {
        if (!response.ok) throw new Error("TipsAudit non disponibile (HTTP " + response.status + ").");
        return response.json();
      })
      .then(payload => {
        if (!payload || !Array.isArray(payload.predictions)) throw new Error("Risposta TipsAudit non valida.");
        cached = payload;
        cachedAt = Date.now();
        return payload;
      })
      .finally(() => { pending = null; });
    return pending;
  }

  async function findMatch(match, force) {
    const payload = await getPredictions(force);
    const date = String(match && match.date || "");
    return payload.predictions.find(item =>
      sameTeam(match.home, item.home) &&
      sameTeam(match.away, item.away) &&
      (!date || localDate(item.kickoff_utc) === date)
    ) || null;
  }

  function quoteFor(marketKey, prediction) {
    const selection = ({ home: "1", draw: "X", away: "2" })[marketKey];
    if (!selection || !prediction) return null;
    const fairOdds = Number(prediction.fair_odds && prediction.fair_odds[marketKey]);
    const fairProbability = Number(prediction.fair_probabilities && prediction.fair_probabilities[marketKey]);
    if (!Number.isFinite(fairOdds) || fairOdds <= 1 || !Number.isFinite(fairProbability) ||
        fairProbability <= 0 || fairProbability >= 1) return null;
    const value = prediction.value && String(prediction.value.selection || "").toUpperCase() === selection
      ? prediction.value : null;
    const softOdds = value && Number(value.best_soft_odds) > 1 ? Number(value.best_soft_odds) : null;
    const priceGap = value && Number.isFinite(Number(value.price_gap)) ? Number(value.price_gap) : null;
    return {
      selection, fairOdds, fairProbability, softOdds,
      bookmaker: softOdds ? String(value.bookmaker || "Bookmaker non specificato") : null,
      priceGap, status: value ? String(prediction.status || "non specificato") : String(prediction.status || "none"),
      fairSource: String(prediction.fair_source || "unknown"),
      generatedAt: prediction.fair_read_at || prediction.benchmark_read_at || null,
      matchUrl: typeof prediction.url === "string" ? prediction.url : null
    };
  }

  root.MatchMindTipsAudit = { getPredictions, findMatch, quoteFor, normalize };
})(typeof window !== "undefined" ? window : globalThis);
