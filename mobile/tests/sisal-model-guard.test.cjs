const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const script = fs.readFileSync(path.join(root, "scripts/sisal-matchmind.user.js"), "utf8");
const bridge = fs.readFileSync(path.join(root, "sisal-bridge.js"), "utf8");

test("restored Lovable script contains the built-in Sisal market-analysis engine", () => {
  assert.match(script, /function calculateMatchMindForecast\(/);
  assert.match(script, /function evaluateMarketSelection\(/);
  assert.match(script, /function resolveOddsButton\(btn\)/);
  assert.match(script, /STANDARD_MARKETS/);
});

test("the script reads the active Sisal page and MatchMind transfer queue", () => {
  assert.match(script, /function scanPage\(\)/);
  assert.match(script, /function captureIncomingPlays\(\)/);
  assert.match(script, /function autoPlayQueue\(/);
  assert.match(script, /incoming\.v === 3/);
  assert.match(bridge, /#mmplay=/);
});

test("the script does not submit or confirm a wager", () => {
  assert.doesNotMatch(script, /placeBet|submitBet|confirmBet|autoAddIndexes/i);
  assert.match(script, /function autoPlayQueue\(/);
});
