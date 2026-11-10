import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const bets = readFileSync(resolve(ROOT, "bets.js"), "utf8");
const nba = readFileSync(resolve(ROOT, "nba.js"), "utf8");
const script = readFileSync(resolve(ROOT, "scripts/sisal-matchmind.user.js"), "utf8");

test("Sisal userscript compiles and matches the production and preview app domains", () => {
  assert.doesNotThrow(() => new Function(script));
  assert.match(script, /^\/\/ @version\s+2\.6\.0$/m);
  assert.match(script, /^\/\/ @match\s+https:\/\/matchmind-3te\.pages\.dev\/\*$/m);
  assert.match(script, /^\/\/ @match\s+https:\/\/\*\.matchmind-3te\.pages\.dev\/\*$/m);
});

test("the imported queue is rendered in both empty and populated widget states", () => {
  assert.equal((script.match(/renderPlayQueue\(widget\);/g) || []).length, 2);
  assert.match(script, /id="mm-play-queue"/);
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
  const makeButton = text => ({ textContent: text, closest: selector => selector === "#mm-widget" ? null : this });
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
