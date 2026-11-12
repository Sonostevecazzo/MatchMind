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
  assert.match(script, /^\/\/ @version\s+2\.16\.3$/m);
  assert.match(script, /^\/\/ @updateURL\s+https:\/\/raw\.githubusercontent\.com\/Sonostevecazzo\/MatchMind\/recovery\/nba-mainline-20261110\/mobile\/scripts\/sisal-matchmind\.user\.js$/m);
  assert.match(script, /https:\/\/www\.sisal\.it\/scommesse/ );
  assert.ok(script.includes("// @match        https://*.sisal.it/*"));
  assert.ok(!script.includes('document.getElementById("mm-widget")?.remove();'));
});

test("Sisal odds import preserves source, timestamp and competition-specific event matching", () => {
  assert.match(bets, /const catalog=Array\.isArray\(allData\?\.matches\)\?allData\.matches:fixtures/);
  assert.match(bets, /oddsSource:bkmk,oddsUpdatedAt:/);
  assert.match(bets, /p\.marketKey===pickData\.marketKey/);
  assert.match(script, /const MATCHMIND_URL = "https:\/\/recovery-nba-mainline-202611\.matchmind-3te\.pages\.dev\/bets\.html"/);
});
test("empty-state message interpolates NBA and unavailable-model states instead of printing source code", () => {
  assert.doesNotMatch(script, /\\\$\{currentAnalysis\?\.sport/);
  assert.ok(script.includes('${currentAnalysis?.sport === "nba"'));
  assert.ok(script.includes('currentAnalysis?.forecastUnavailable'));
});

test("Sisal widget and queue are rendered and remain manually controlled", () => {
  assert.match(script, /function renderWidget\(\) \{/);
  assert.match(script, /widget = document\.createElement\("div"\)/);
  assert.match(script, /id="mm-play-queue-items" style="display:/);
  assert.match(script, /markSelectedMarket\(hit\.btn, item, hit\.odd\)/);
  assert.doesNotMatch(script, /document\.getElementById\("mm-widget"\)\?\.remove\(\);\s*return;/);
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

test("shared navigation exposes football and live routes, with NBA as an in-page sport switch", () => {
  assert.ok(core.includes("['matches.html','matches','Calcio']"));
  assert.ok(core.includes("['live.html','live','Live']"));
  assert.ok(core.includes("['bets.html','bets','Schedina']"));
  assert.equal(core.includes("['nba.html','nba','NBA']"), false);
  const sportSwitch = readFileSync(resolve(ROOT, "sports-switch.js"), "utf8");
  assert.ok(sportSwitch.includes('data-sport="football"'));
  assert.ok(sportSwitch.includes('data-sport="nba"'));
  assert.ok(sportSwitch.includes("matchmind-sport-v1"));
  assert.ok(sportSwitch.includes("nbaIntegratedView"));
  assert.ok(core.includes("global-slip-dock"));
  assert.ok(core.includes("mobile-primary-nav"));
  assert.ok(core.includes("mobile-drawer-title"));
  assert.ok(core.includes("competitionSelect"));
  assert.ok(core.includes("Apri schedina NBA"));
  assert.ok(core.includes("data-slip-confirm"));
  assert.ok(core.includes("_globalIndex:index"));
  assert.ok(core.includes("Schedina mista"));
});

test("mixed slip combines active football selections and shared NBA selections for Sisal", () => {
  assert.ok(bets.includes('const storedFootball=readPicks().filter(p=>p&&p.sport!=="nba")'));
  assert.ok(bets.includes("const sourceMatches=allData?.matches||fixtures"));
  assert.ok(bets.includes('fixtureKey({...p,competition:p.competition||"serie-a"})===fKey'));
  assert.ok(bets.includes('fixtureKey({...p,competition:p.competition||"serie-a"})===fKey'));
  assert.ok(bets.includes('const pick=all.find(p=>p&&p.sport!=="nba"&&fixtureKey({...p,competition:p.competition||"serie-a"})===fKey)'));
  assert.ok(bets.includes('fixtureKey({...p,competition:p.competition||"serie-a"})===key'));
  assert.ok(bets.includes('eventId:x.sport==="nba"?(x.match.id||x.nbaPickId||null):null'));
  assert.ok(bets.includes('start:x.sport==="nba"?(x.match.start||null):null'));
  assert.ok(bets.includes('const allSelections=selectedRows().map'));
  assert.ok(bets.includes('const nbaRows=readPicks().filter(p=>p&&p.sport==="nba"'));
  assert.ok(bets.includes("return footballRows.concat(nbaRows)"));
  assert.ok(bets.includes("const allSelections=selectedRows().map"));
  assert.ok(bridge.includes('const competition = sport === "nba" ? "nba" : String(match.competition'));
  assert.ok(bridge.includes("sport, probability: validProbability"));
  assert.ok(bets.includes('row.sport==="nba"?"NBA · ":"Calcio · "'));
  assert.ok(bets.includes('key.startsWith("nba|")'));
  assert.ok(script.includes("competition: String(x.competition"));
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

test("Sisal widget is visible by default and hidden only by explicit user preference", () => {
  const start = script.indexOf("function renderWidget()");
  const end = script.indexOf("function pillStatusText", start);
  const body = script.slice(start, end);
  assert.match(body, /if \(isHidden\)/);
  assert.match(body, /document\.createElement\("div"\)/);
  assert.doesNotMatch(body, /mm-widget.*remove/);
})
test("Sisal scanner is event-driven and avoids aggressive full-page polling", () => {
  assert.match(script, /const MIN_SCAN_INTERVAL = 1600/);
  assert.match(script, /const MUTATION_DEBOUNCE = 550/);
  assert.match(script, /setInterval\(\(\) => \{[\s\S]*?\}, 10000\)/);
  assert.doesNotMatch(script, /if \(document\.hidden\) return;\s*scanPage\(\);\s*\}, 2500\)/);
  assert.doesNotMatch(script, /function isPotentialMarketMutation/);
});

test("Sisal match detection avoids duplicate full-page scans and recognizes localized team labels", () => {
  assert.match(script, /function parseSisalTeamPair\(value\)/);
  assert.match(script, /const multiMatches = singleMatch \? \[\] : detectMultipleMatches\(\)/);
  assert.match(script, /data-testid\*='event'/);
  assert.match(script, /function scanFootballSelections\(queue\)/);
  assert.match(script, /const candidates = \[\]/);
});

test("Sisal observer is lightweight and scans only after coalesced page changes", () => {
  assert.match(script, /const MIN_SCAN_INTERVAL = 1600/);
  assert.match(script, /const MUTATION_DEBOUNCE = 550/);
  assert.match(script, /setInterval\(\(\) => \{ if \(!document\.hidden\) scheduleScan\(0\); \}, 10000\)/);
  assert.doesNotMatch(script, /function isPotentialMarketMutation/);
  assert.match(script, /function renderWidgetIfChanged\(\)/);
});
