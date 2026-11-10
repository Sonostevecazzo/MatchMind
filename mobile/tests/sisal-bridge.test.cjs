const test = require("node:test");
const assert = require("node:assert/strict");
const bridge = require("../sisal-bridge.js");

test("builds the exact Sisal userscript hash payload for supported selections", () => {
  const selection = {
    match: { home: "Roma", away: "Lazio", date: "2026-11-15" },
    marketKey: "home",
    marketLabel: "1"
  };
  const result = bridge.createUrl([selection], { sentAt: 12345 });
  assert.equal(result.skipped, 0);
  assert.equal(result.total, 1);
  assert.equal(result.payload.sentAt, 12345);
  assert.match(result.url, /^https:\/\/www\.sisal\.it\/scommesse#mmplay=/);
  assert.deepEqual(result.payload.items, [{
    home: "Roma",
    away: "Lazio",
    marketKey: "home",
    label: "1",
    date: "2026-11-15",
    sport: "football"
  }]);
  assert.equal("odds" in result.payload.items[0], false);

  const hash = result.url.slice(result.url.indexOf("#"));
  const match = hash.match(/[#&]mmplay=([^&]+)/);
  const decoded = JSON.parse(decodeURIComponent(match[1]));
  assert.deepEqual(decoded, result.payload);
  assert.equal(selection.match.home, "Roma");
});

test("reports and excludes combined markets while preserving supported standard markets", () => {
  const rows = [
    { match: { home: "Roma", away: "Lazio" }, marketKey: "combo:home:over25", marketLabel: "1 + Over 2,5" },
    { match: { home: "Inter", away: "Milan", date: "2026-11-16" }, marketKey: "over25", marketLabel: "Over 2,5" }
  ];
  const result = bridge.createUrl(rows, { sentAt: 1 });
  assert.equal(result.skipped, 1);
  assert.equal(result.payload.items.length, 1);
  assert.equal(result.payload.items[0].marketKey, "over25");
});

test("returns no Sisal URL when no supported selection remains", () => {
  const result = bridge.createUrl([
    { match: { home: "Roma", away: "Lazio" }, marketKey: "combo:home:bttsYes" }
  ], { sentAt: 1 });
  assert.equal(result.url, null);
  assert.equal(result.skipped, 1);
  assert.deepEqual(result.payload.items, []);
});

test("accepts only the standard football markets supported by the Sisal script", () => {
  const keys = [
    "home", "draw", "away", "dc1X", "dcX2", "dc12",
    "over15", "under15", "over25", "under25", "over35", "under35",
    "bttsYes", "bttsNo"
  ];
  const rows = keys.map((marketKey, index) => ({
    home: "Casa " + index,
    away: "Ospite " + index,
    marketKey
  }));
  const result = bridge.prepare(rows, 1);
  assert.equal(result.skipped, 0);
  assert.deepEqual(result.payload.items.map(item => item.marketKey), keys);
});

test("ignores malformed rows and invalid dates rather than creating invalid selections", () => {
  const result = bridge.createUrl([
    null,
    { match: { home: "", away: "Lazio" }, marketKey: "home" },
    { match: { home: "Roma", away: "Lazio", date: "2026-99-90" }, marketKey: "unknown" }
  ], { sentAt: 1 });
  assert.equal(result.url, null);
  assert.equal(result.skipped, 3);
  assert.equal(bridge.prepare([
    { match: { home: "Roma", away: "Lazio", date: "2026-99-90" }, marketKey: "home" }
  ], 1).payload.items[0].date, "");
});
