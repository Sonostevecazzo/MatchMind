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

test("keeps a recognised fixture editable when the market text is unknown", () => {
  const parsed = bets.parseSlip(
    "Bologna - Monza\nMercato non identificato",
    fixtures,
    forecastFn,
    upcoming
  );
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].ok, false);
  assert.equal(parsed[0].match.home, "Bologna");
  assert.equal(parsed[0].market, null);
});

test("supports a strict greater-than-50-percent joint target and returns quote-covered markets", () => {
  const result = bets.buildTicket(fixtures, forecastFn, 0.55, { maxLegs: 5 });
  assert.equal(result.available, true);
  assert.ok(result.probability >= 0.55);
  assert.ok(result.selections.every(item => Boolean(item.marketKey)));
});

test("does not invent a ticket when no eligible sample exists", () => {
  const result = bets.buildTicket(fixtures, () => ({ sampleEnough: false, probabilities: {} }), 0.5);
  assert.equal(result.available, false);
});

test("accepts a zero percent target and returns the maximum number of legs", () => {
  const result = bets.buildTicket(fixtures, forecastFn, 0, { maxLegs: 2 });
  assert.equal(result.available, true);
  assert.equal(result.selections.length, 2);
  assert.equal(result.thresholdReached, true);
});
test("returns the best available single selection when a 100 percent target is unreachable", () => {
  const result = bets.buildTicket(fixtures, forecastFn, 1, { maxLegs: 5 });
  assert.equal(result.available, true);
  assert.equal(result.thresholdReached, false);
  assert.equal(result.selections.length, 1);
  assert.equal(result.selections[0].probability, 0.78);
});
test("uses a user-selected market as the preferred outcome for a fixture", () => {
  const key = [bets.normalize("Bologna"), bets.normalize("Monza")].sort().join("|") + "|2026-11-01";
  const result = bets.buildTicket([fixtures[0]], forecastFn, 0, { maxLegs: 1, marketOverrides: { [key]: "home" } });
  assert.equal(result.selections[0].marketKey, "home");
  assert.equal(result.selections[0].preferredByUser, true);
});


test("adapts market selection to the requested risk profile", () => {
  const selective = bets.buildTicket([fixtures[0]], forecastFn, 0.2, { maxLegs: 1 });
  const prudent = bets.buildTicket([fixtures[0]], forecastFn, 0.95, { maxLegs: 1 });
  assert.equal(selective.available, true);
  assert.equal(prudent.available, true);
  assert.equal(selective.selections[0].marketKey, "bttsYes");
  assert.equal(prudent.selections[0].marketKey, "over15");
  assert.ok(selective.desiredMarketProbability < prudent.desiredMarketProbability);
});

test("team strength changes the selected market when the forecast favors a side", () => {
  const strongHomeForecast = {
    sampleEnough: true, minTeamSample: 12,
    probabilities: { home: 0.74, draw: 0.15, away: 0.11, btts: 0.48, o15: 0.79, o25: 0.59, o35: 0.34 }
  };
  const result = bets.buildTicket([fixtures[0]], () => strongHomeForecast, 0.95, { maxLegs: 1 });
  assert.equal(result.available, true);
  assert.equal(result.selections[0].marketKey, "home");
});
