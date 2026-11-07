const test = require("node:test");
const assert = require("node:assert/strict");
const bets = require("../bets-engine.js");

test("expected value calculation handles typical Sisal bookmaker odds", () => {
  // 50% probability with odds 2.20 -> EV = +10%
  const evPos = bets.expectedValue(0.50, 2.20);
  assert.ok(Math.abs(evPos - 0.10) < 1e-6);

  // 40% probability with odds 2.00 -> EV = -20%
  const evNeg = bets.expectedValue(0.40, 2.00);
  assert.ok(Math.abs(evNeg - (-0.20)) < 1e-6);

  // Fair odds
  assert.equal(bets.fairOdds(0.50), 2.0);
  assert.equal(bets.fairOdds(0.25), 4.0);
});

test("fair odds returns null for non-positive or impossible probabilities", () => {
  assert.equal(bets.fairOdds(0), null);
  assert.equal(bets.fairOdds(-0.1), null);
  assert.equal(bets.fairOdds(1.5), null);
});

test("expected value returns null for invalid odds or probabilities", () => {
  assert.equal(bets.expectedValue(0, 2.0), null);
  assert.equal(bets.expectedValue(0.5, 0.9), null);
  assert.equal(bets.expectedValue(null, 2.0), null);
});
