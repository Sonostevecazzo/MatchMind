import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const bets = readFileSync(resolve(ROOT, "bets.js"), "utf8");
const betsHtml = readFileSync(resolve(ROOT, "bets.html"), "utf8");
const matchesHtml = readFileSync(resolve(ROOT, "matches.html"), "utf8");
const sitePages = readFileSync(resolve(ROOT, "site-pages.js"), "utf8");
const nba = readFileSync(resolve(ROOT, "nba.js"), "utf8");
const script = readFileSync(resolve(ROOT, "scripts/sisal-matchmind.user.js"), "utf8");

test("Sisal userscript compiles and matches the production and preview app domains", () => {
  assert.doesNotThrow(() => new Function(script));
  assert.match(script, /^\/\/ @version\s+2\.10\.0$/m);
  assert.match(script, /^\/\/ @updateURL\s+https:\/\/raw\.githubusercontent\.com\/Sonostevecazzo\/MatchMind\/recovery\/nba-mainline-20261110\/mobile\/scripts\/sisal-matchmind\.user\.js$/m);
  assert.match(script, /^\/\/ @match\s+https:\/\/matchmind-3te\.pages\.dev\/\*$/m);
  assert.match(script, /^\/\/ @match\s+https:\/\/\*\.matchmind-3te\.pages\.dev\/\*$/m);
});

test("the imported queue is rendered in both empty and populated widget states", () => {
  assert.equal((script.match(/renderPlayQueue\(widget\);/g) || []).length, 2);
  assert.match(script, /box\.id = "mm-play-queue"/);
  assert.match(script, /data-mm-add-queue/);
  assert.match(script, /addQueuedSelection\(button\.dataset\.mmAddQueue\)/);
});

test("selection click requires an explicit per-selection user action and never submits a bet", () => {
  const start = script.indexOf("function addQueuedSelection(index)");
  const end = script.indexOf("function autoPlayQueue(calculations)", start);
  assert.ok(start >= 0 && end > start);
  const action = script.slice(start, end);
  assert.match(action, /hit\.btn\.click\(\)/);
  assert.match(action, /item\.status = "clicked"/);
  assert.match(script, /box\.querySelectorAll\("\[data-mm-add-queue\]"\)/);
  assert.match(script, /button\.addEventListener\("click"/);
  const scanStart = script.indexOf("function autoPlayQueue(calculations)");
  const scanEnd = script.indexOf("function renderPlayQueue(widget)", scanStart);
  assert.ok(scanStart >= 0 && scanEnd > scanStart);
  assert.doesNotMatch(script.slice(scanStart, scanEnd), /\.click\s*\(/);
  assert.doesNotMatch(script, /placeBet|submitBet|confirmBet/i);
});

test("football payload maps only supported markets and excludes NBA and combinations", () => {
  const start = bets.indexOf("const SISAL_MARKET_LABELS =");
  const end = bets.indexOf("function playOnSisal()", start);
  assert.ok(start >= 0 && end > start);
  const buildSisalItems = new Function(bets.slice(start, end) + "; return buildSisalItems;")();
  const items = buildSisalItems([
    { home: "Inter", away: "Milan", marketKey: "home", odds: 2.1, date: "2026-11-12" },
    { home: "Roma", away: "Lazio", marketKey: "over25", odds: 1.9, date: "2026-11-12" },
    { home: "Napoli", away: "Juventus", marketKey: "combo:home:over25", odds: 3.2 },
    { home: "Boston Celtics", away: "LA Lakers", marketKey: "nbaMoneyline:home", sport: "nba" }
  ]);
  assert.equal(items.length, 2);
  assert.deepEqual(items.map(x => x.label), ["1", "Over 2.5"]);
  assert.equal(items[0].sport, "football");
  assert.equal(items[0].odds, 2.1);
});


test("match page exposes a real Sisal handoff for selected football picks", () => {
  assert.match(matchesHtml, /id="matchSlipActions"/);
  assert.match(matchesHtml, /id="sendMatchPicksSisal"/);
  assert.match(matchesHtml, /id="matchSlipCount"/);
  assert.match(sitePages, /const sendMatchPicksToSisal=/);
  assert.match(sitePages, /addEventListener\("click",sendMatchPicksToSisal\)/);
  assert.match(sitePages, /#mmplay=/);
  assert.match(sitePages, /item\.marketKey\]\)\.map/);
  assert.match(sitePages, /status\.textContent=.*La conferma resta manuale/s);
});

test("bet builder renders and wires its own upcoming match browser", () => {
  for (const id of ["matchSearch", "betsDate", "betsTeam", "betsRound", "betsFixtureCount", "manualFixtures", "moreBetFixtures"]) {
    assert.match(betsHtml, new RegExp('id="' + id + '"'));
  }
  assert.match(bets, /\$\("manualFixtures"\)\?\.addEventListener\("click"/);
  assert.match(bets, /\$\("moreBetFixtures"\)\?\.addEventListener\("click"/);
  assert.match(bets, /\["matchSearch","betsDate","betsTeam","betsRound"\]/);
  assert.match(bets, /const hasRound=Boolean\(first&&first\.round/);
  assert.match(bets, /if\(!candidateFixtures\.length&&upcoming\.length\)/);
});


test("builder honors selected max legs instead of silently capping every strategy at four", () => {
  assert.match(bets, /balanced:makeLegs\(balPool,maxLegs,variantCycleIndex\)/);
  assert.match(bets, /accuracy:makeLegs\(accPool,maxLegs,variantCycleIndex\)/);
  assert.match(bets, /value:makeLegs\(valPool,maxLegs,variantCycleIndex\)/);
  assert.doesNotMatch(bets, /Math\.min\(maxLegs,4\)/);
});

test("builder preserves shared selections and applies the target probability to proposal size", () => {
  assert.match(bets, /picks=readPicks\(\)\.filter\(p=>\(p\.competition\|\|"serie-a"\)===window\.MM\.getSelectedCompetition\(\)\);/);
  assert.match(bets, /const nextJoint=joint\*item\.probability,nextGap=Math\.abs\(nextJoint-target\)/);
});


test("builder writes preserve picks from other competitions and NBA", () => {
  const start = bets.indexOf("function readPicks()");
  const end = bets.indexOf('window.addEventListener("matchmind:picks-updated"', start);
  assert.ok(start >= 0 && end > start);
  const source = bets.slice(start, end);
  const storage = [
    { competition: "serie-a", home: "Inter", away: "Milan", marketKey: "home" },
    { competition: "champions-league", home: "Arsenal", away: "PSG", marketKey: "away" },
    { sport: "nba", competition: "nba", home: "Celtics", away: "Lakers", marketKey: "nbaMoneyline:home" }
  ];
  let saved = null, dispatched = false;
  const write = new Function("PICKS_KEY", "read", "save", "window", "Event", "picks",
    source + "; return writePicks;"
  )("matchmind-manual-selections-v1", (key, fallback) => storage, (key, value) => { saved = value; },
    { MM: { getSelectedCompetition: () => "serie-a" }, dispatchEvent: event => { dispatched = event.type === "matchmind:picks-updated"; } },
    class Event { constructor(type) { this.type = type; } },
    [{ home: "Roma", away: "Lazio", marketKey: "draw" }]
  );
  write();
  assert.deepEqual(saved.map(x => x.competition || x.sport), ["champions-league", "nba", "serie-a"]);
  assert.equal(saved[0].home, "Arsenal");
  assert.equal(saved[1].home, "Celtics");
  assert.equal(saved[2].home, "Roma");
  assert.equal(dispatched, true);
});

test("NBA market fallback accepts a true two-way winner market and excludes handicap or regulation", () => {
  const marketStart = script.indexOf("const NBA_EXCLUDED =");
  const activeStart = script.indexOf("function nbaActiveMarketText()", marketStart);
  const twoWayStart = script.indexOf("function nbaTwoWayButtons(container)", activeStart);
  const twoWayEnd = script.indexOf("\n  function ", twoWayStart + 10);
  assert.ok(marketStart >= 0 && activeStart > marketStart && twoWayStart > activeStart && twoWayEnd > twoWayStart);
  const helpers = new Function("document",
    script.slice(marketStart, activeStart) +
    script.slice(twoWayStart, twoWayEnd) +
    "; return { nbaWinnerMarket, nbaTwoWayButtons };"
  )({ querySelectorAll: () => [] });
  assert.equal(helpers.nbaWinnerMarket("Testa a Testa Risultato / 1-2"), true);
  assert.equal(helpers.nbaWinnerMarket("Testa a Testa Handicap"), false);
  assert.equal(helpers.nbaWinnerMarket("Vincente tempi regolamentari"), false);
  const buttons = [{ textContent: "1 2.40", closest: () => null }, { textContent: "2 1.60", closest: () => null }];
  const container = { querySelectorAll: () => buttons };
  assert.equal(helpers.nbaTwoWayButtons(container), true);
  assert.equal(helpers.nbaTwoWayButtons({ querySelectorAll: () => [...buttons, { textContent: "X 12.00", closest: () => null }] }), false);
});

test("football and NBA handoffs both use the mmplay payload contract", () => {
  assert.match(bets, /function playOnSisal\(\)/);
  assert.match(bets, /#mmplay=/);
  assert.match(bets, /event\.target\.closest\("#playOnSisal"\)/);
  assert.match(nba, /#mmplay=/);
  assert.match(nba, /sport:"nba"/);
  assert.match(nba, /eventId:String\(x\.id\|\|x\.eventId\)/);
});

test("Sisal widget escapes no interpolations and keeps the NBA market probability", () => {
  assert.equal(script.includes("\\${currentAnalysis?.sport"), false);
  assert.ok(script.includes('${currentAnalysis?.sport === "nba"'));
  assert.match(nba, /probability:Number\.isFinite\(Number\(x\.probability\)\)/);
  assert.match(script, /if \(hit\.btn && item\.marketKey === hit\.key\)\s*\{\s*markSelectedMarket/);
});

test("the imported selection queue is collapsed by default and can be expanded", () => {
  assert.match(script, /const expanded = gmGet\("mm_sisal_queue_expanded", "false"\) === "true"/);
  assert.match(script, /id="mm-play-toggle"/);
  assert.match(script, /id="mm-play-queue-items" style="display:' \+ \(expanded \? 'block' : 'none'\)/);
  assert.match(script, /max-height: 46dvh/);
  assert.match(script, /hasOverLabel = \\/\\b\\(over\\|oltre\\)\\b\\|piu/);
});
