import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const script = readFileSync(resolve(ROOT, "scripts/sisal-matchmind.user.js"), "utf8");
const nba = readFileSync(resolve(ROOT, "nba.js"), "utf8");
const core = readFileSync(resolve(ROOT, "site-core.js"), "utf8");
const bets = readFileSync(resolve(ROOT, "bets.js"), "utf8");
const bridge = readFileSync(resolve(ROOT, "sisal-bridge.js"), "utf8");

test("Sisal userscript compiles and reports the current version and installer URL", () => {
  assert.doesNotThrow(() => new Function(script));
  assert.match(script, /^\/\/ @version\s+2\.14\.0$/m);
  assert.match(script, /^\/\/ @updateURL\s+https:\/\/raw\.githubusercontent\.com\/Sonostevecazzo\/MatchMind\/recovery\/nba-mainline-20261110\/mobile\/scripts\/sisal-matchmind\.user\.js$/m);
  assert.match(script, /https:\/\/www\.sisal\.it\/scommesse/);
});

test("empty-state message interpolates NBA and unavailable-model states instead of printing source code", () => {
  assert.doesNotMatch(script, /\\\$\{currentAnalysis\?\.sport/);
  assert.ok(script.includes('${currentAnalysis?.sport === "nba"'));
  assert.ok(script.includes('currentAnalysis?.forecastUnavailable'));
});

test("legacy queue markup remains unreachable in minimal Sisal mode", () => {
  assert.match(script, /document\.getElementById\("mm-widget"\)\?\.remove\(\)/);
  assert.match(script, /document\.getElementById\("mm-floating-badge"\)\?\.remove\(\)/);
  assert.match(script, /id="mm-play-queue-items" style="display:'/);
  assert.match(script, /function updatePageBadges\(\) \{[\s\S]*?return;/);
  assert.match(script, /markSelectedMarket\(hit\.btn, item, hit\.odd\)/);


});

test("NBA selections transfer their probability and use the NBA-specific market scanner", () => {
  assert.match(nba, /bridge\.createUrl\(rows\)/);
  assert.match(script, /sport: x\.sport === "nba" \? "nba" : "football"/);
  assert.match(script, /function scanNbaSelections\(queue\)/);
  assert.match(script, /const isBasketballPage =/);
  assert.match(script, /function findQueuedSelection\(item\) \{\s*const scanned = item\.sport === "nba" \? scanNbaSelections\(\[item\]\) : scanFootballSelections\(\[item\]\);/);
  assert.match(script, /function addQueuedSelection\(index\) \{[\s\S]*?const hit = findQueuedSelection\(item\);[\s\S]*?markSelectedMarket\(hit\.btn, item, hit\.odd\)/);
});

test("football market resolver recognizes localized Over and Under outcome labels", () => {
  assert.match(script, /const hasOverLabel =/);
  assert.match(script, /const hasUnderLabel =/);
  assert.match(script, /hasOverLabel \|\| hasUnderLabel/);
  assert.match(script, /for \(let i = 0; i < 8 && curr/);
});

test("a matching event without a confirmed market stays pending instead of being marked as a false failure", () => {
  assert.match(script, /item\.status = "pending"; item\.errorType = "";/);
  assert.match(script, /mercato non ancora identificato/i);
  assert.match(script, /function findQueuedSelection\(item\)/);
});

test("Sisal transfer only highlights matching markets for manual selection", () => {
  const start = script.indexOf("function addQueuedSelection(index)");
  const end = script.indexOf("function markSelectedMarket", start);
  assert.ok(start >= 0 && end > start);
  const action = script.slice(start, end);
  assert.match(action, /markSelectedMarket\(hit\.btn, item, hit\.odd\)/);
  assert.match(action, /scrollIntoView/);
  assert.doesNotMatch(action, /\.click\s*\(/);
  const autoStart = script.indexOf("function autoPlayQueue(calculations)");
  const autoEnd = script.indexOf("function renderPlayQueue(widget)", autoStart);
  assert.ok(autoStart >= 0 && autoEnd > autoStart);
  assert.match(script.slice(autoStart, autoEnd), /markSelectedMarket\(hit\.btn, item, hit\.odd\)/);
  assert.doesNotMatch(script.slice(autoStart, autoEnd), /addQueuedSelection|autoAddIndexes/);
  assert.match(script, /DA SELEZIONARE · evidenziata/);
  assert.match(script, /non clicca e non invia scommesse/i);
  assert.doesNotMatch(script, /placeBet|submitBet|confirmBet/i);
});

test("persistent betslip navigation exposes football, live, NBA, slip and more", () => {
  assert.match(core, /\['matches\.html','matches','Calcio'\]/);
  assert.match(core, /\['live\.html','live','Live'\]/);
  assert.match(core, /\['nba\.html','nba','NBA'\]/);
  assert.match(core, /\['bets\.html','bets','Schedina'\]/);
  assert.match(core, /global-slip-dock/);
  assert.match(core, /mobile-primary-nav/);
  assert.match(core, /mobile-drawer-title/);
  assert.match(core, /competitionSelect/);
  assert.match(core, /Apri schedina NBA/);
  assert.match(core, /data-slip-confirm/);
  assert.match(core, /_globalIndex:index/);
  assert.match(core, /Schedina mista/);
});

test("football transfer reads every stored competition rather than the active filter only", () => {
  assert.match(bets, /const allFootball=readPicks\(\)\.filter\(p=>p&&p\.sport!=="nba"\)/);
  assert.ok(bridge.includes('const competition = sport === "nba" ? "nba" : String(match.competition'));
  assert.ok(bridge.includes("sport, probability: validProbability"));
  assert.match(script, /competition: String\(x\.competition/);
});

test("shared bottom drawer removes the original stored item, not its filtered display index", () => {
  assert.match(core, /_globalIndex:index/);
  assert.match(core, /data-slip-remove/);
  assert.match(core, /all\.splice\(index,1\)/);
});

test("NBA transfer uses the same tested bridge as football", () => {
  assert.match(nba, /bridge\.createUrl\(rows\)/);
  assert.match(nba, /result\.payload\.items\.length/);
  assert.match(bridge, /NBA_MARKETS/);
  assert.match(script, /sport: x\.sport === "nba" \? "nba" : "football"/);
});

test("Sisal minimal mode removes overlays and disables generic badges", () => { const start = script.indexOf("function renderWidget()"); const end = script.indexOf("function pillStatusText", start); const body = script.slice(start, end); assert.match(body, /mm-widget.*remove/); assert.match(body, /mm-floating-badge.*remove/); assert.match(body, /return;/); assert.match(script, /function updatePageBadges\(\) \{[\s\S]*?return;/); });
