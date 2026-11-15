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
const core = readFileSync(resolve(ROOT, "site-core.js"), "utf8");
const pages = readFileSync(resolve(ROOT, "site-pages.js"), "utf8");

test("Sisal userscript v3 is scoped to Sisal, top frame only, and parses", () => {
  assert.doesNotThrow(() => new Function(script));
  assert.match(script, /^\/\/ @version\s+3\.1\.0$/m);
  assert.match(script, /^\/\/ @noframes$/m);
  assert.match(script, /^\/\/ @match\s+https:\/\/www\.sisal\.it\/scommesse\*$/m);
  assert.match(script, /^\/\/ @match\s+https:\/\/www\.sisal\.it\/scommesse-matchpoint\/\*$/m);
  assert.match(script, /^\/\/ @updateURL\s+https:\/\/raw\.githubusercontent\.com\/Sonostevecazzo\/MatchMind\/main\/mobile\/scripts\/sisal-matchmind\.user\.js$/m);
  assert.doesNotMatch(script, /@match\s+https:\/\/\*\.sisal\.it/);
  assert.doesNotMatch(script, /@match\s+https:\/\/.*matchmind/);
});

test("QuotaLab bridge captures Sisal odds and returns them only to the QuotaLab origin", () => {
  assert.match(script, /function decodeQuotaLabHash\(\)/);
  assert.match(script, /function quotaLabMarketKey\(key\)/);
  assert.match(script, /function scanQuotaLabOdds\(\)/);
  assert.match(script, /type:"QUOTALAB_SISAL_ODDS"/);
  assert.match(script, /window\.opener\.postMessage/);
  assert.match(script, /https:\/\/sonostevecazzo\.github\.io/);
  assert.match(script, /function quotaLabOddsFromButton\(button\)/);
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
  assert.match(script, /new URLSearchParams\(location.search/);
  assert.match(script, /query.get\("mmplay"\)/);
  assert.match(script, /hash.get\("mmplay"\)/);
  assert.match(script, /row\.predictions/);
  assert.match(script, /netherlands: \["netherlands", "holland", "the netherlands", "olanda", "paesi bassi", "nederland"\]/);
  assert.match(script, /greece: \["greece", "grecia", "hellas"\]/);
  assert.match(script, /function includesTeam\(text, name\)/);
  assert.match(script, /function eventText\(root\)/);
  assert.match(script, /data-home-team/);
  assert.match(script, /function eventRootCandidates\(button, rootCache\)/);
});

test("Sisal scanner is scoped to the visible area and rescans on scroll", () => {
  assert.match(script, /getBoundingClientRect\(\)/);
  assert.match(script, /rect\.bottom < -margin \|\| rect\.top > viewportHeight \+ margin/);
  assert.match(script, /new WeakMap\(\)/);
  assert.match(script, /window\.addEventListener\("scroll"/);
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

test("app transfers only the market explicitly selected in MatchMind", () => {
  assert.match(bets, /function exportSisalPredictions\(row\)/);
  assert.match(bets, /const probability=Number\(row\.probability\)/);
  assert.match(bets, /marketKey:row\.marketKey,label:row\.marketLabel/);
  assert.doesNotMatch(bets, /const candidates=ENGINE\(\)\.marketCandidates\("auto"\)/);
  assert.match(bets, /const allSelections=selectedRows\(\)\.map/);
  assert.match(bets, /predictions:exportSisalPredictions\(row\)/);
});

test("transfer confirmation lists the markets selected in the MatchMind slip", () => {
  assert.match(bets, /const selectedMarkets=\[\.\.\.new Set\(result\.payload\.items\.map/);
  assert.match(bets, /Mercati scelti:/);
  assert.match(bets, /badge MM ✓/);
});

test("the automatic builder treats the chosen market family as a hard filter", () => {
  assert.match(bets, /const allowedMarkets=ENGINE\(\)\.marketCandidates\(marketMode\)/);
  assert.match(bets, /const candidateKeys=allowedMarkets\.map\(item=>item\.key\)/);
  assert.doesNotMatch(bets, /const overrides=/);
  for (const mode of ["1x2", "goals", "btts", "single", "combo-goals", "combo-btts"]) {
    assert.ok(betsHtml.includes('value="' + mode + '"'), "Missing market option " + mode);
  }
});

test("Sisal highlights the exact selected market, including combined markets", () => {
  assert.match(script, /const comboTotal = compactOutcome\.match/);
  assert.match(script, /const comboBtts = compactOutcome\.match/);
  assert.match(script, /return "combo:" \+ resultKey \+ ":" \+ comboTotal\[2\] \+ comboTotal\[3\]/);
  assert.match(script, /badge\.textContent = selected \? "MM ✓ " \+ formatPercent/);
  assert.match(script, /matchedSelections = selectionsSeen/);
  assert.match(script, /mercati selezionati riconosciuti/);
});

test("archived tickets retain real sample quality when reopened and transferred", () => {
  assert.match(bets, /sampleEnough:s\.sampleEnough===true/);
  assert.match(bets, /sampleEnough:x\.sport==="nba"\?\(x\.sampleEnough===true\)/);
  assert.match(bets, /sampleEnough:selection\.sampleEnough===true/);
  assert.match(bets, /historyCount:Number\(selection\.historyCount\)\|\|0/);
  assert.doesNotMatch(bets, /sampleEnough:true,historyCount:0/);
});

test("bridge uses a URL fragment for Sisal handoff", () => {
  assert.match(bridge, /base \+ "#mmplay=" \+ encoded/);
  assert.doesNotMatch(bridge, /base \+ "\?mmplay="/);
});

test("closed archive tickets expose full edit and Sisal transfer actions", () => {
  assert.match(bets, /data-edit-ticket=/);
  assert.match(bets, /data-transfer-ticket=/);
  assert.match(bets, /function startEditTicket\(ticket\)/);
  assert.match(bets, /function cancelEditTicket\(\)/);
  assert.match(bets, /editingTicketId/);
  assert.match(bets, /archive\[index\]=item/);
  assert.match(bets, /ticketTransferUrl\(ticket\)/);
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

test("Sisal overlay opens the main MatchMind betting workspace, not the abandoned QuotaLab page", () => {
  assert.match(script, /const APP_URL = "https:\/\/matchmind-3te\.pages\.dev\/bets\.html"/);
});

test("saved tickets can be duplicated without changing the original or carrying settled results", () => {
  assert.match(bets, /function duplicateTicket\(ticket\)/);
  assert.match(bets, /copy\.id="slip-copy-"/);
  assert.match(bets, /status:"Da giocare",result:null/);
  assert.match(bets, /delete copy\.actualPayout/);
  assert.match(bets, /data-duplicate-ticket=/);
  assert.match(bets, /duplicateTicket\(ticket\)/);
});
