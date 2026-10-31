const test = require("node:test");
const assert = require("node:assert/strict");
const bets = require("../bets-engine.js");

const fixtures = [
  { date: "2026-11-01", time: "15:00", home: "Bologna", away: "Monza" },
  { date: "2026-11-01", time: "18:00", home: "Udinese", away: "Roma" },
  { date: "2026-11-02", time: "20:45", home: "Milan", away: "Inter" }
];

const forecast = {
  sampleEnough: true,
  historyCount: 160,
  probabilities: {
    home: 0.42, draw: 0.28, away: 0.30,
    btts: 0.54, o15: 0.78, o25: 0.57, o35: 0.32
  }
};

const forecastFn = () => forecast;
const upcoming = () => true;

test("parses a Sisal-style multiline slip and reads the actual decimal odds", () => {
  const parsed = bets.parseSlip(
    "Bologna - Monza\n31/10 - 15:00\nU/O 2.5: OVER\n1.75\n\nUdinese - Roma\nU/O 1.5: OVER 1.15",
    fixtures,
    forecastFn,
    upcoming
  );
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].market.key, "over25");
  assert.equal(parsed[0].odds, 1.75);
  assert.equal(parsed[1].market.key, "over15");
  assert.equal(parsed[1].odds, 1.15);
});

test("does not interpret the goal line 2.5 as a bookmaker price", () => {
  assert.equal(bets.readOdds("U/O 2.5: OVER"), null);
  assert.equal(bets.readOdds("U/O 2.5: OVER quota 1.78"), 1.78);
});

test("parses No Gol before the generic Gol market", () => {
  assert.equal(bets.parseMarket("U/O BTTS: No Gol").key, "bttsNo");
  assert.equal(bets.parseMarket("BTTS: Gol").key, "bttsYes");
});

test("maps markets to model probabilities and complements correctly", () => {
  assert.equal(bets.marketProbability(forecast, "over25"), 0.57);
  assert.ok(Math.abs(bets.marketProbability(forecast, "under25") - 0.43) < 1e-12);
  assert.equal(bets.marketProbability(forecast, "home"), 0.42);
  assert.equal(bets.marketProbability(forecast, "draw"), 0.28);
});

test("rejects joint probability when multiple selections belong to one match", () => {
  const sameMatch = fixtures[0];
  const rows = [
    { ok: true, sampleEnough: true, probability: 0.7, match: sameMatch },
    { ok: true, sampleEnough: true, probability: 0.6, match: sameMatch }
  ];
  const result = bets.combineSelections(rows);
  assert.equal(result.available, false);
  assert.match(result.reason, /stessa partita/);
});

test("refuses a combined probability when any leg lacks historical sample", () => {
  const result = bets.combineSelections([
    { ok: true, sampleEnough: true, probability: 0.7, match: fixtures[0] },
    { ok: true, sampleEnough: false, probability: 0.8, match: fixtures[1] }
  ]);
  assert.equal(result.available, false);
});

test("builds only a complete proposal that reaches the requested joint threshold", () => {
  const result = bets.buildTicket(fixtures, forecastFn, 0.5, { maxLegs: 5 });
  assert.equal(result.available, true);
  assert.ok(result.probability >= 0.5);
  assert.ok(result.selections.length >= 1);
  assert.ok(result.selections.length <= fixtures.length);
});

test("does not invent a ticket when no eligible sample exists", () => {
  const result = bets.buildTicket(fixtures, () => ({ sampleEnough: false, probabilities: {} }), 0.5);
  assert.equal(result.available, false);
});
