const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const script = fs.readFileSync(path.join(root, "scripts/sisal-matchmind.user.js"), "utf8");
const bridge = fs.readFileSync(path.join(root, "sisal-bridge.js"), "utf8");

test("Sisal userscript does not run its own football forecast model", () => {
  assert.doesNotMatch(script, /TEAM_RATINGS|isCalibratedTeamRating|forecastUnavailable/);
  assert.doesNotMatch(script, /function poisson\(|function forecast\(/);
  assert.match(script, /function normalizePredictions\(row\)/);
  assert.match(script, /row\.predictions/);
});

test("Sisal only displays probabilities explicitly delivered by MatchMind", () => {
  assert.match(script, /const probability = validProbability\(entry\.probability\)/);
  assert.match(script, /if \(probability === null\) return/);
  assert.match(script, /badge\.textContent = formatPercent\(prediction\.probability\)/);
  assert.doesNotMatch(script, /0\.5\s*\*\s*100|probability\s*=\s*0\.5/);
});

test("limited samples remain visible but are clearly identified in the badge title", () => {
  assert.match(script, /sampleEnough: entry\.sampleEnough === true/);
  assert.match(script, /prediction\.sampleEnough/);
  assert.match(script, /campione adeguato/);
  assert.match(script, /campione limitato/);
  assert.match(bridge, /sampleEnough: entry\.sampleEnough === true/);
});

test("probability transfer permits exact zero or one only when the app algorithm supplies it", () => {
  assert.match(bridge, /number >= 0 && number <= 1/);
  assert.match(script, /Number\.isFinite\(number\) && number >= 0 && number <= 1/);
});
