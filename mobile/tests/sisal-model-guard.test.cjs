const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "../scripts/sisal-matchmind.user.js"),
  "utf8"
);
const match = source.match(/function isCalibratedTeamRating\(rating\) \{[\s\S]*?\n  \}/);
assert.ok(match, "the fail-closed rating validator must exist");
const isCalibratedTeamRating = vm.runInNewContext("(" + match[0] + ")");

test("rejects absent or unverified team ratings", () => {
  assert.equal(isCalibratedTeamRating(null), false);
  assert.equal(isCalibratedTeamRating({ att: 1.1, def: 1.0, homeBoost: 0.1 }), false);
  assert.equal(isCalibratedTeamRating({
    validated: true, att: 1.1, def: 1.0, homeBoost: 0.1,
    source: "dataset", datasetVersion: "v1"
  }), true);
});

test("rejects incomplete or implausible rating data", () => {
  const base = {
    validated: true, att: 1.1, def: 1.0, homeBoost: 0.1,
    source: "dataset", datasetVersion: "v1"
  };
  assert.equal(isCalibratedTeamRating({ ...base, att: null }), false);
  assert.equal(isCalibratedTeamRating({ ...base, def: 0 }), false);
  assert.equal(isCalibratedTeamRating({ ...base, homeBoost: 0.8 }), false);
  assert.equal(isCalibratedTeamRating({ ...base, source: "" }), false);
  assert.equal(isCalibratedTeamRating({ ...base, datasetVersion: "" }), false);
});

test("does not fall back to synthetic neutral ratings or probabilities", () => {
  assert.match(source, /if \(!isCalibratedTeamRating\(h\) \|\| !isCalibratedTeamRating\(a\)\)/);
  assert.match(source, /forecastAvailable: false/);
  assert.doesNotMatch(source, /TEAM_RATINGS\[hKey\] \|\| \{ att:/);
  assert.doesNotMatch(source, /TEAM_RATINGS\[aKey\] \|\| \{ att:/);
});

test("basketball routes bypass the football forecast engine", () => {
  assert.match(source, /if \(isBasketballPage\) \{[\s\S]*?sport: "nba"[\s\S]*?renderWidget\(\);\s*return;/);
  assert.match(source, /const isBasketballPage =/);
});
