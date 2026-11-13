import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const script = readFileSync(resolve(ROOT, "scripts/sisal-matchmind.user.js"), "utf8");
const bets = readFileSync(resolve(ROOT, "bets.js"), "utf8");
const bridge = readFileSync(resolve(ROOT, "sisal-bridge.js"), "utf8");
const core = readFileSync(resolve(ROOT, "site-core.js"), "utf8");
const pages = readFileSync(resolve(ROOT, "site-pages.js"), "utf8");

test("Sisal userscript v3 is scoped to Sisal, top frame only, and parses", () => {
  assert.doesNotThrow(() => new Function(script));
  assert.match(script, /^\/\/ @version\s+3\.0\.1$/m);
  assert.match(script, /^\/\/ @noframes$/m);
  assert.match(script, /^\/\/ @match\s+https:\/\/www\.sisal\.it\/scommesse\*$/m);
  assert.match(script, /^\/\/ @match\s+https:\/\/www\.sisal\.it\/scommesse-matchpoint\/\*$/m);
  assert.match(script, /^\/\/ @updateURL\s+https:\/\/raw\.githubusercontent\.com\/Sonostevecazzo\/MatchMind\/recovery\/nba-mainline-20261110\/mobile\/scripts\/sisal-matchmind\.user\.js$/m);
  assert.doesNotMatch(script, /@match\s+https:\/\/\*\.sisal\.it/);
  assert.doesNotMatch(script, /@match\s+https:\/\/.*matchmind/);
});

test("Sisal script is an inline percentage overlay, not a floating widget", () => {
  assert.match(script, /const ROOT_ID = "mm-sisal-status-v3"/);
  assert.match(script, /const BADGE_CLASS = "mm-sisal-prediction-v3"/);
  assert.match(script, /function createStatus\(\)/);
  assert.match(script, /function addPredictionBadge\(/);
  assert.doesNotMatch(script, /function renderWidget\(/);
  assert.doesNotMatch(script, /id="mm-widget"/);
  assert.match(script, /#mm-widget,#mm-floating-badge,#mm-play-queue\{display:none/);
});

test("Sisal consumes prediction arrays from the app and supports Italian team aliases", () => {
  assert.match(script, /function normalizePredictions\(row\)/);
  assert.match(script, /row\.predictions/);
  assert.match(script, /netherlands: \["netherlands", "holland", "the netherlands", "olanda", "paesi bassi", "nederland"\]/);
  assert.match(script, /greece: \["greece", "grecia", "hellas"\]/);
  assert.match(script, /function includesTeam\(text, name\)/);
  assert.match(script, /function eventRootCandidates\(button\)/);
});

test("Sisal can display 1X2, double chance, goals and both-teams-to-score forecasts", () => {
  assert.match(script, /function marketKeyFor\(button, eventRoot\)/);
  assert.match(script, /return "bttsYes"/);
  assert.match(script, /return "bttsNo"/);
  assert.match(script, /return "dc1X"/);
  assert.match(script, /return "dcX2"/);
  assert.match(script, /return "dc12"/);
  assert.match(script, /return \(isOver \? "over" : "under"\) \+ line/);
  assert.match(script, /return "home"/);
  assert.match(script, /return "draw"/);
  assert.match(script, /return "away"/);
});

test("Sisal displays limited-sample model estimates without relabelling them as calibrated", () => {
  assert.match(script, /badge\.dataset\.mmLimited/);
  assert.match(script, /prediction\.sampleEnough/);
  assert.match(script, /Stima MatchMind/);
  assert.doesNotMatch(script, /TEAM_RATINGS|isCalibratedTeamRating|forecastUnavailable/);
});

test("Sisal script never clicks, adds, confirms or submits a wager", () => {
  assert.doesNotMatch(script, /\.click\s*\(/);
  assert.doesNotMatch(script, /placeBet|submitBet|confirmBet|autoAddIndexes/i);
  assert.match(script, /addPredictionBadge\(button/);
});

test("Sisal scanner is event-driven and has no polling loop", () => {
  assert.match(script, /new MutationObserver/);
  assert.match(script, /scheduleScan\(450\)/);
  assert.match(script, /visibilitychange/);
  assert.doesNotMatch(script, /setInterval\s*\(/);
  assert.doesNotMatch(script, /setInterval\(\(\) => scanPage/);
});

test("app exports all calculated markets for each selected football match", () => {
  assert.match(bets, /function exportSisalPredictions\(row\)/);
  assert.match(bets, /ENGINE\(\)\.marketCandidates\("auto"\)/);
  assert.match(bets, /marketProbability\(forecast,item\.key\)/);
  assert.match(bets, /marketKey:"dc1X"/);
  assert.match(bets, /marketKey:"dcX2"/);
  assert.match(bets, /marketKey:"dc12"/);
  assert.match(bets, /predictions:exportSisalPredictions\(row\)/);
  assert.match(bets, /predictionMethod:row\.forecast\?\.predictionMethod/);
});

test("bridge preserves all predictions and sample metadata in version 3 payload", () => {
  assert.match(bridge, /version: 3/);
  assert.match(bridge, /predictions,/);
  assert.match(bridge, /sampleEnough/);
  assert.match(bridge, /historyCount/);
  assert.match(bridge, /COMBO_MARKET/);
  assert.match(bridge, /number >= 0 && number <= 1/);
});

test("national-team presentation uses Italian Sisal labels and national flags", () => {
  assert.match(core, /netherlands:'Olanda'/);
  assert.match(core, /greece:'Grecia'/);
  assert.match(core, /const NATIONAL_TEAM_FLAGS/);
  assert.match(core, /https:\/\/flagcdn\.com\/w80\//);
  assert.match(pages, /MM\(\)\.displayTeamName/);
});
