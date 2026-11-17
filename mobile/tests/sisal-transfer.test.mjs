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

test("Sisal userscript 3.7.0 parses and has a matching update header", () => {
  assert.doesNotMatch(script, /\[truncated/i);
  assert.doesNotThrow(() => new Function(script));
  assert.match(script, /^\/\/ @version\s+3\.7\.0$/m);
  assert.match(script, /const MM_SCRIPT_VERSION = "3\.7\.0"/);
  assert.match(script, /^\/\/ @updateURL\s+https:\/\/raw\.githubusercontent\.com\/Sonostevecazzo\/MatchMind\/main\/mobile\/scripts\/sisal-matchmind\.user\.js$/m);
  assert.match(script, /^\/\/ @downloadURL\s+https:\/\/raw\.githubusercontent\.com\/Sonostevecazzo\/MatchMind\/main\/mobile\/scripts\/sisal-matchmind\.user\.js$/m);
  assert.match(script, /const MATCHMIND_URL = "https:\/\/matchmind-3te\.pages\.dev\/bets\.html"/);
});

test("quote parser accepts isolated plausible decimal odds only", () => {
  const start = script.indexOf("function parseOddsValue(text) {");
  const end = script.indexOf("\n  function isUnavailableOddsButton", start);
  assert.ok(start >= 0 && end > start);
  const source = script.slice(start, end);
  const parseOddsValue = new Function("MAX_DISPLAY_ODDS", source + "; return parseOddsValue;")(100);
  assert.equal(parseOddsValue("2.10"), 2.1);
  assert.equal(parseOddsValue("1,85"), 1.85);
  assert.equal(parseOddsValue("400.00"), null);
  assert.equal(parseOddsValue("2.5"), null);
  assert.equal(parseOddsValue("Quota 4.00"), null);
  assert.equal(parseOddsValue("1.00"), null);
});

test("suspended and disabled price controls are ignored", () => {
  const start = script.indexOf("function isUnavailableOddsButton(btn) {");
  const end = script.indexOf("\n  function getMarketContext", start);
  assert.ok(start >= 0 && end > start);
  const source = script.slice(start, end);
  const isUnavailableOddsButton = new Function("return (" + source + ");")();
  const button = options => ({
    disabled: Boolean(options.disabled),
    className: options.className || "",
    textContent: options.text || "",
    matches: () => false,
    getAttribute: name => name === "aria-disabled" && options.ariaDisabled ? "true" : null,
    querySelector: () => options.lock ? {} : null
  });
  assert.equal(isUnavailableOddsButton(button({ disabled: true })), true);
  assert.equal(isUnavailableOddsButton(button({ ariaDisabled: true })), true);
  assert.equal(isUnavailableOddsButton(button({ text: "Quota sospesa" })), true);
  assert.equal(isUnavailableOddsButton(button({ lock: true })), true);
  assert.equal(isUnavailableOddsButton(button({ text: "2.10" })), false);
});

test("unknown teams and maintenance banners cannot become forecast fixtures", () => {
  const start = script.indexOf("function detectSingleMatch() {");
  const end = script.indexOf("\n  // Invia selezione singola a MatchMind", start);
  assert.ok(start >= 0 && end > start);
  const source = script.slice(start, end);
  const supported = name => ["inter", "milan", "juventus", "roma", "lazio", "napoli", "atalanta", "arsenal", "liverpool"].includes(String(name).toLowerCase());
  const liveEvent = () => false;
  const container = (text, count = 4) => ({
    innerText: text,
    querySelectorAll: () => Array.from({ length: count }, () => ({}))
  });
  const multiDocument = rows => ({ querySelectorAll: () => rows });
  const helpers = new Function("window", "document", "isSupportedModelTeam", "isLikelyLiveEvent",
    source + "; return { detectSingleMatch, detectMultipleMatches };");

  const maintenanceDoc = {
    title: "Manutenzione programmata - Martedi",
    querySelectorAll: () => []
  };
  const maintenance = helpers({ location: { pathname: "/scommesse-matchpoint/sport/calcio" } },
    maintenanceDoc, supported, liveEvent);
  assert.equal(maintenance.detectSingleMatch(), null);

  const supportedDoc = { title: "Inter - Milan", querySelectorAll: () => [] };
  const supportedPair = helpers({ location: { pathname: "/scommesse-matchpoint/sport/calcio" } },
    supportedDoc, supported, liveEvent);
  assert.deepEqual(supportedPair.detectSingleMatch(), { home: "Inter", away: "Milan" });

  const rows = [container("Inter - Milan", 2), container("Inter - Milan", 8), container("Manutenzione programmata - Martedi", 1)];
  const multi = helpers({ location: { pathname: "/scommesse-matchpoint/sport/calcio" } },
    multiDocument(rows), supported, liveEvent);
  const events = multi.detectMultipleMatches();
  assert.equal(events.length, 1);
  assert.equal(events[0].container, rows[1]);
});

test("the model remains explicitly unvalidated and EV/value mode are suppressed", () => {
  assert.match(script, /const MODEL_EVIDENCE_VALIDATED = false/);
  assert.match(script, /if \(!MODEL_EVIDENCE_VALIDATED\)/);
  assert.match(script, /if \(strategy === "value" && !MODEL_EVIDENCE_VALIDATED\) return \[\]/);
  assert.match(script, /EV sospeso/);
  assert.match(script, /Modello non validato/);
});

test("pre-match estimates are not applied to Sisal Live pages", () => {
  assert.match(script, /function isLiveSisalPage\(\)/);
  assert.match(script, /if \(isLiveSisalPage\(\)\)/);
  assert.match(script, /Pagina LIVE non valutata/);
});

test("mobile navigation is compact while market views remain accessible", () => {
  assert.match(script, /class="mm-options-drawer"/);
  assert.match(script, /position:sticky !important; top:0/);
  assert.match(script, /max-height: min\(22vh, 210px\)/);
  assert.match(script, /widget\.style\.maxHeight = "48vh"/);
  assert.match(script, /Da verificare/);
});

test("football and NBA transfers keep the version 3 fragment contract", () => {
  assert.match(script, /function captureIncomingPlays\(\)/);
  assert.match(script, /incoming\.v === 3/);
  assert.match(script, /incoming\.i\.map\(row/);
  assert.match(script, /function autoPlayQueue\(/);
  assert.match(script, /function resolveNbaWinner\(/);
  assert.match(script, /isUnavailableOddsButton\(btn\)/);
  assert.match(bridge, /base \+ "#mmplay=" \+ encoded/);
  assert.match(bets, /#mmplay=/);
  assert.doesNotMatch(betsHtml, /captureSisalOdds|sisalCaptureAnalysis/);
});
