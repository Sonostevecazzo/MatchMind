const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function load(fetchImpl) {
  const context = { fetch: fetchImpl, Date, Intl, URL, console };
  context.window = context;
  vm.runInNewContext(fs.readFileSync(__dirname + "/../tipsaudit.js", "utf8"), context);
  return context.MatchMindTipsAudit;
}

test("TipsAudit maps fair 1X2 prices and only exposes a soft price for the matching selection", () => {
  const api = load(async () => { throw new Error("not used"); });
  const prediction = {
    fair_odds: { home: 2, draw: 3.5, away: 4 },
    fair_probabilities: { home: 0.5, draw: 0.2857, away: 0.2143 },
    fair_source: "live", fair_read_at: "2026-11-03T10:00:00Z",
    status: "actionable",
    value: { selection: "1", best_soft_odds: 2.1, bookmaker: "Example", price_gap: 0.05 }
  };
  const home = api.quoteFor("home", prediction);
  assert.equal(home.fairOdds, 2);
  assert.equal(home.softOdds, 2.1);
  assert.equal(home.bookmaker, "Example");
  assert.equal(api.quoteFor("away", prediction).softOdds, null);
  assert.equal(api.quoteFor("over25", prediction), null);
});

test("TipsAudit fetch is keyless, validates payload and caches it for five minutes", async () => {
  let calls = 0;
  const api = load(async (url, options) => {
    calls++;
    assert.equal(url, "https://tipsaudit.com/api/v1/predictions");
    assert.equal(options.headers.Accept, "application/json");
    return { ok: true, json: async () => ({ predictions: [] }) };
  });
  await api.getPredictions();
  await api.getPredictions();
  assert.equal(calls, 1);
});

test("TipsAudit matches a fixture by teams and Italian local kickoff date", async () => {
  const api = load(async () => ({
    ok: true,
    json: async () => ({ predictions: [{
      home: "Bologna", away: "Hellas Verona", kickoff_utc: "2026-11-03T19:45:00Z",
      fair_odds: { home: 2, draw: 3, away: 4 },
      fair_probabilities: { home: 0.5, draw: 0.3, away: 0.2 }
    }] })
  }));
  const match = await api.findMatch({ home: "Bologna", away: "Verona", date: "2026-11-03" });
  assert.equal(match.home, "Bologna");
});
