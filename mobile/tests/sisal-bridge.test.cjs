const test = require("node:test");
const assert = require("node:assert/strict");
const bridge = require("../sisal-bridge.js");

test("exports the selected match and every valid MatchMind market forecast", () => {
  const row = {
    match: { home: "Netherlands", away: "Greece", date: "2026-11-13", competition: "nations-league" },
    marketKey: "bttsYes",
    marketLabel: "Gol",
    probability: 0.522,
    sampleEnough: false,
    historyCount: 7,
    predictionMethod: "poisson",
    predictions: [
      { marketKey: "home", label: "1", probability: 0.41, sampleEnough: false, historyCount: 7, model: "elo-1x2-poisson-goals" },
      { marketKey: "draw", label: "X", probability: 0.28, sampleEnough: false, historyCount: 7, model: "elo-1x2-poisson-goals" },
      { marketKey: "away", label: "2", probability: 0.31, sampleEnough: false, historyCount: 7, model: "elo-1x2-poisson-goals" },
      { marketKey: "bttsYes", label: "Gol", probability: 0.522, sampleEnough: false, historyCount: 7, model: "poisson" },
      { marketKey: "over25", label: "Over 2,5", probability: 0.48, sampleEnough: false, historyCount: 7, model: "poisson" },
      { marketKey: "combo:home:over25", label: "1 + Over 2,5", probability: 0.21, sampleEnough: false, historyCount: 7, model: "poisson" },
      { marketKey: "invalid", label: "Non supportato", probability: 0.5 }
    ]
  };
  const result = bridge.createUrl([row], { sentAt: 12345 });
  assert.equal(result.skipped, 0);
  assert.equal(result.total, 1);
  assert.equal(result.payload.version, 3);
  assert.equal(result.payload.sentAt, 12345);
  assert.match(result.url, /^https:\/\/www\.sisal\.it\/scommesse#mmplay=/);
  const item = result.payload.items[0];
  assert.equal(item.home, "Netherlands");
  assert.equal(item.away, "Greece");
  assert.equal(item.marketKey, "bttsYes");
  assert.equal(item.probability, 0.522);
  assert.equal(item.sampleEnough, false);
  assert.equal(item.historyCount, 7);
  assert.deepEqual(item.predictions.map(x => x.marketKey), [
    "home", "draw", "away", "bttsYes", "over25", "combo:home:over25"
  ]);
  assert.equal(item.predictions.find(x => x.marketKey === "bttsYes").probability, 0.522);
  assert.equal(item.predictions[0].sampleEnough, false);

  const parsed = new URL(result.url);
  const decoded = JSON.parse(decodeURIComponent(parsed.hash.slice("#mmplay=".length)));
  assert.deepEqual(decoded, result.payload);
});

test("preserves an estimated forecast when the historical sample is limited", () => {
  const result = bridge.prepare([{
    home: "Netherlands", away: "Greece", date: "2026-11-13",
    competition: "nations-league", marketKey: "bttsYes",
    probability: 0.522, sampleEnough: false, historyCount: 7,
    predictions: [{ marketKey: "bttsYes", probability: 0.522, sampleEnough: false }]
  }], 1);
  assert.equal(result.skipped, 0);
  assert.equal(result.payload.items[0].predictions[0].probability, 0.522);
  assert.equal(result.payload.items[0].predictions[0].sampleEnough, false);
});

test("supports standard markets, double chance and supported same-match combinations", () => {
  const keys = [
    "home", "draw", "away", "dc1X", "dcX2", "dc12",
    "over15", "under15", "over25", "under25", "over35", "under35",
    "bttsYes", "bttsNo",
    "combo:home:over25", "combo:draw:bttsYes", "combo:away:under15"
  ];
  const rows = keys.map((marketKey, index) => ({
    home: "Casa " + index, away: "Ospite " + index, marketKey,
    probability: 0.5, predictions: [{ marketKey, probability: 0.5 }]
  }));
  const result = bridge.prepare(rows, 1);
  assert.equal(result.skipped, 0);
  assert.deepEqual(result.payload.items.map(item => item.marketKey), keys);
});

test("rejects invalid prediction values and unsupported market keys", () => {
  const result = bridge.prepare([{
    home: "Roma", away: "Lazio", marketKey: "home", probability: 0.7,
    predictions: [
      { marketKey: "home", probability: 0.7 },
      { marketKey: "draw", probability: -0.1 },
      { marketKey: "away", probability: 1.2 },
      { marketKey: "unknown", probability: 0.5 }
    ]
  }], 1);
  assert.equal(result.skipped, 0);
  assert.deepEqual(result.payload.items[0].predictions.map(item => item.marketKey), ["home"]);
});

test("preserves competition metadata for multiple supported leagues", () => {
  const rows = [
    { home: "Roma", away: "Lazio", competition: "serie-a", marketKey: "home", probability: 0.6 },
    { home: "Real Madrid", away: "Milan", competition: "champions-league", marketKey: "over25", probability: 0.55 },
    { home: "Aston Villa", away: "Roma", competition: "europa-league", marketKey: "bttsYes", probability: 0.51 },
    { home: "Olanda", away: "Grecia", competition: "nations-league", marketKey: "bttsYes", probability: 0.52 }
  ];
  const result = bridge.prepare(rows, 10);
  assert.equal(result.skipped, 0);
  assert.deepEqual(result.payload.items.map(item => item.competition), [
    "serie-a", "champions-league", "europa-league", "nations-league"
  ]);
});

test("keeps NBA moneyline on the NBA Sisal destination", () => {
  const result = bridge.createUrl([{
    sport: "nba", id: "401810001", eventId: "401810001",
    home: "Boston Celtics", away: "New York Knicks",
    homeAbbr: "BOS", awayAbbr: "NYK", start: "2026-11-12T00:30:00Z",
    date: "2026-11-12", side: "home", team: "Boston Celtics",
    marketKey: "nbaMoneyline:home", probability: 0.68,
    predictions: [{ marketKey: "nbaMoneyline:home", label: "Vince casa", probability: 0.68 }]
  }], { sentAt: 99 });
  assert.equal(result.skipped, 0);
  assert.match(result.url, /^https:\/\/www\.sisal\.it\/scommesse-matchpoint\/sport\/basket\/usa\/nba#mmplay=/);
  assert.equal(result.payload.items[0].predictions[0].probability, 0.68);
});

test("does not route mixed football and NBA handoffs to a single sport-specific page", () => {
  const result = bridge.createUrl([
    { home: "Roma", away: "Lazio", competition: "serie-a", marketKey: "home", probability: 0.6 },
    { sport: "nba", home: "Boston Celtics", away: "New York Knicks", marketKey: "nbaMoneyline:away", probability: 0.41 }
  ], { sentAt: 7 });
  assert.match(result.url, /^https:\/\/www\.sisal\.it\/scommesse#mmplay=/);
  assert.equal(result.payload.items.length, 2);
});

test("does not build an external URL from invalid or empty selections", () => {
  const result = bridge.createUrl([
    null,
    { home: "", away: "Lazio", marketKey: "home" },
    { home: "Roma", away: "Lazio", marketKey: "unsupported" }
  ], { sentAt: 1 });
  assert.equal(result.url, null);
  assert.equal(result.skipped, 3);
});
