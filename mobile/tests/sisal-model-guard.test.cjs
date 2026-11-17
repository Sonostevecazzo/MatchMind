const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const script = fs.readFileSync(path.join(root, "scripts/sisal-matchmind.user.js"), "utf8");
const bridge = fs.readFileSync(path.join(root, "sisal-bridge.js"), "utf8");

test("Sisal overlay uses the existing Lovable engine without claiming calibration", () => {
  assert.match(script, /function calculateMatchMindForecast\(/);
  assert.match(script, /function evaluateMarketSelection\(/);
  assert.match(script, /function resolveOddsButton\(btn\)/);
  assert.match(script, /STANDARD_MARKETS/);
  assert.match(script, /const MODEL_EVIDENCE_VALIDATED = false/);
});

test("unrated teams do not receive generic model probabilities", () => {
  assert.match(script, /function isSupportedModelTeam\(name\)/);
  assert.match(script, /if \(!h \|\| !a\) return null/);
  assert.match(script, /isSupportedModelTeam\(home\) \|\| !isSupportedModelTeam\(away\)/);
});

test("the overlay does not show expected value while model evidence is unvalidated", () => {
  assert.match(script, /if \(strategy === "value" && !MODEL_EVIDENCE_VALIDATED\) return \[\]/);
  assert.match(script, /EV sospeso/);
  assert.match(script, /Modello non validato/);
});

test("live events are gated and quote controls are checked for availability", () => {
  assert.match(script, /function isLiveSisalPage\(\)/);
  assert.match(script, /if \(isLiveSisalPage\(\)\)/);
  assert.match(script, /function isUnavailableOddsButton\(btn\)/);
  assert.match(script, /if \(isUnavailableOddsButton\(btn\)/);
});

test("football/NBA handoff remains fragment based", () => {
  assert.match(script, /function captureIncomingPlays\(\)/);
  assert.match(script, /function autoPlayQueue\(/);
  assert.match(bridge, /base \+ "#mmplay=" \+ encoded/);
});
