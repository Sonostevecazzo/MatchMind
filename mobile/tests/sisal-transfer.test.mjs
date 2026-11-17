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

test("restores the last Lovable Sisal userscript, version 3.6.1 (Lovable 2.4.2 core), with valid metadata and syntax", () => {
  assert.doesNotMatch(script, /\[truncated/i);
  assert.doesNotThrow(() => new Function(script));
  assert.match(script, /^\/\/ @version\s+3\.6\.1$/m);
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
});

test("keeps the existing football and NBA transfer path compatible with the current v3 fragment", () => {
  assert.match(script, /function captureIncomingPlays\(\)/);
  assert.match(script, /incoming\.v === 3/);
  assert.match(script, /incoming\.i\.map\(row/);
  assert.match(script, /function autoPlayQueue\(/);
  assert.match(bridge, /base \+ "#mmplay=" \+ encoded/);
  assert.match(bets, /#mmplay=/);
});

test("removes the unwanted live-odds capture panel and its disconnected handler", () => {
  assert.doesNotMatch(betsHtml, /captureSisalOdds|sisalCaptureAnalysis/);
  assert.doesNotMatch(bets, /startSisalOddsCapture|handleSisalOddsMessage/);
  assert.doesNotMatch(script, /MATCHMIND_SISAL_ODDS|CAPTURE_SESSION_KEY/);
});

test("detects palinsesto fixtures when Sisal changes or removes event-card CSS classes", () => {
  assert.match(script, /function normalizeTeamText\(value\)/);
  assert.match(script, /const ambiguousAliases = new Set/);
  assert.match(script, /const odds = Array\.from\(document\.querySelectorAll/);
  assert.match(script, /if \(teamHits\.length === 2\)/);
  assert.match(script, /if \(!matches\.length\)/);
});
