const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const builder = require("../nba-builder.js");

const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("NBA page loads the Sisal bridge before the NBA transfer controller", () => {
  const html = read("nba.html");
  assert.ok(html.indexOf("sisal-bridge.js") >= 0);
  assert.ok(html.indexOf("sisal-bridge.js") < html.indexOf("nba-builder.js"));
  assert.ok(html.indexOf("nba-builder.js") < html.indexOf("nba.js"));
  assert.match(read("nba.js"), /window\.MatchMindSisalBridge/);
});

test("NBA PWA shell includes the page and every required data/model asset", () => {
  const sw = read("sw.js");
  for (const asset of ["./nba.html", "./nba.css?v=20261114-nba-fix-1", "./nba-builder.js?v=20261114-nba-fix-1", "./nba.js?v=20261114-nba-fix-1", "./nba-engine.mjs"]) {
    assert.ok(sw.includes(asset), "Service worker missing " + asset);
  }
  assert.match(sw, /matchmind-pwa-v155-/);
});

test("NBA is reachable from the shared application navigation", () => {
  assert.match(read("site-core.js"), /\['nba\.html','nba','NBA','nba'\]/);
});

test("NBA archive preserves real model reliability and never upgrades unknown samples", () => {
  const now = new Date("2026-11-14T10:00:00.000Z");
  const reliable = builder.toArchiveTicket([{
    id: "nba-1", home: "Boston Celtics", away: "New York Knicks",
    date: "2026-11-15", side: "home", team: "Boston Celtics",
    marketKey: "nbaMoneyline:home", probability: 0.67, odds: 1.8,
    reliable: true, sampleEnough: true, predictionMethod: "NBA Elo"
  }], 5, now);
  assert.equal(reliable.selections[0].sampleEnough, true);
  assert.equal(reliable.selections[0].historyCount, 0);
  assert.equal(reliable.selections[0].predictionMethod, "NBA Elo");

  const unknown = builder.toArchiveTicket([{
    id: "nba-2", home: "Dallas Mavericks", away: "Denver Nuggets",
    date: "2026-11-15", side: "away", probability: 0.61, odds: 2.1
  }], 5, now);
  assert.equal(unknown.selections[0].sampleEnough, false);
  assert.equal(unknown.selections[0].predictionMethod, "NBA Elo");
});

test("NBA picks record the model's actual reliability flag at selection time", () => {
  const js = read("nba.js");
  assert.match(js, /sampleEnough:g\.prediction\.reliable===true/);
  assert.match(js, /sampleEnough:x\.reliable===true/);
});
