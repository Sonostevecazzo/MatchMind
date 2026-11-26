import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const script = readFileSync(resolve(ROOT, "scripts/sisal-matchmind.user.js"), "utf8");
const bets = readFileSync(resolve(ROOT, "bets.js"), "utf8");
const betsHtml = readFileSync(resolve(ROOT, "bets.html"), "utf8");
const bridge = readFileSync(resolve(ROOT, "sisal-bridge.js"), "utf8");

test("checks the current Sisal userscript release, version 3.6.5, with valid metadata and syntax", () => {
  assert.doesNotMatch(script, /\[truncated/i);
  assert.doesNotThrow(() => new Function(script));
  assert.match(script, /^\/\/ @version\s+3\.6\.5$/m);
  assert.match(script, /^\/\/ @updateURL\s+https:\/\/raw\.githubusercontent\.com\/Sonostevecazzo\/MatchMind\/main\/mobile\/scripts\/sisal-matchmind\.user\.js$/m);
  assert.match(script, /^\/\/ @downloadURL\s+https:\/\/raw\.githubusercontent\.com\/Sonostevecazzo\/MatchMind\/main\/mobile\/scripts\/sisal-matchmind\.user\.js$/m);
  assert.match(script, /^\/\/ @match\s+https:\/\/matchmind-3te\.pages\.dev\/\*$/m);
  assert.match(script, /const MATCHMIND_URL = "https:\/\/matchmind-3te\.pages\.dev\/bets\.html"/);
});

test("restores the original Sisal scanner and its main market-analysis flow", () => {
  assert.match(script, /function scanPage\(\)/);
  assert.match(script, /function resolveOddsButton\(btn\)/);
  assert.match(script, /function calculateMatchMindForecast\(/);
  assert.match(script, /function evaluateMarketSelection\(/);
  assert.match(script, /STANDARD_MARKETS/);
  assert.match(script, /function detectSingleMatch\(\)/);
  assert.match(script, /function detectMultipleMatches\(\)/);
  assert.match(script, /new MutationObserver/);
  assert.match(script, /function scheduleScan\(/);
  assert.match(script, /mutations\.some\(hasRelevantMutation\)/);
  assert.doesNotMatch(script, /setInterval\(\(\) => \{[\s\S]{0,120}scanPage\(\);[\s\S]{0,80}2500\)/);
  assert.match(script, /hasVisibleEventRows/);
  assert.match(script, /multiMatches.length === 0 && !hasVisibleEventRows/);
  assert.match(script, /text.length < previous.textLength/);
});

test("keeps the football transfer path compatible with the current v3 fragment and never clicks odds automatically", () => {
  assert.match(script, /function captureIncomingPlays\(\)/);
  assert.match(script, /incoming\.v === 3/);
  assert.match(script, /incoming\.i\.map\(row/);
  assert.match(script, /function autoPlayQueue\(/);
  assert.match(bridge, /base \+ "#mmplay=" \+ encoded/);
  assert.match(bets, /function handleUrlImport\(\)/);
  assert.match(bets, /hash\.startsWith\("#import="\)/);
  assert.match(script, /Quota individuata\. Se vuoi inserirla, conferma manualmente su Sisal/);
  assert.doesNotMatch(script, /hit\.btn\.click\(\)/);
});

test("removes the unwanted live-odds capture panel and its disconnected handler", () => {
  assert.doesNotMatch(betsHtml, /captureSisalOdds|sisalCaptureAnalysis/);
  assert.doesNotMatch(bets, /startSisalOddsCapture|handleSisalOddsMessage/);
  assert.doesNotMatch(script, /MATCHMIND_SISAL_ODDS|CAPTURE_SESSION_KEY/);
});

test("extreme quote/model gaps are quarantined and cannot become value recommendations", () => {
  const start = script.indexOf("  function validateQuoteData(prob, odd, marketKey) {");
  const end = script.indexOf("\n  function applyQuoteQuality", start);
  assert.ok(start >= 0 && end > start, "quote validator exists");
  const validate = new Function(script.slice(start, end) + "; return validateQuoteData;")();
  const anomaly = validate(0.74, 13, "dc1X");
  assert.equal(anomaly.valid, false);
  assert.match(anomaly.reason, /anomala|estremo/i);
  assert.equal(validate(0.74, 1.35, "dc1X").valid, true);
  assert.equal(validate(0.50, 10, "home").valid, false);
  assert.equal(validate(0.50, 2.10, "home").valid, true);
});

test("unknown or generic page titles cannot be treated as a known fixture", () => {
  assert.match(script, /function isKnownTeamName\(name\)/);
  assert.match(script, /TEAM_RATINGS\[key\]/);
  assert.match(script, /detectedSingleMatch && isKnownTeamName/);
  assert.match(script, /detectMultipleMatches\(\)\.filter\(item => isKnownTeamName/);
});

test("mobile widget navigation supports touch scrolling, horizontal market tabs and a scrollable list", () => {
  assert.match(script, /touch-action: pan-y/);
  assert.match(script, /scroll-snap-type:x proximity/);
  assert.match(script, /\.mm-list-container \{ flex:1 1 auto/);
  assert.match(script, /max-height: min\(56dvh, 520px\)/);
  assert.match(script, /mm-verdict-invalid/);
});


test("Sisal overlay prefers central MatchMind PWA probabilities for transferred fixtures", () => {
  assert.match(script, /modelProbability:\s*Number\.isFinite\(Number\(x\.probability\)\)/);
  assert.match(script, /predictions:\s*Array\.isArray\(x\.predictions\)/);
  assert.match(script, /predictionSource = "MatchMind PWA"/);
  assert.match(script, /Campione storico MatchMind insufficiente/);
  assert.match(script, /Probabilità della PWA MatchMind applicate alle partite trasferite/);
});
