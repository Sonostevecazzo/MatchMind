import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../bets.js", import.meta.url), "utf8");
const start = source.indexOf('document.addEventListener("DOMContentLoaded",async()=>{');
const end = source.indexOf('window.addEventListener("pagehide"', start);
assert.notEqual(start, -1, "bets.js must have a startup handler");
assert.notEqual(end, -1, "bets.js startup handler must have a closing boundary");
const startup = source.slice(start, end);
const calendarLoad = startup.indexOf("await window.MM.loadData()");
const oddsLoad = startup.indexOf("window.MM.loadOdds?.()");
const injuriesLoad = startup.indexOf("window.MM.loadInjuries?.()");

test("calendar loading is not blocked by optional odds and injury feeds", () => {
  assert.ok(calendarLoad > -1, "calendar must still load during startup");
  assert.ok(oddsLoad > -1 && oddsLoad < calendarLoad, "odds feed should start before calendar await");
  assert.ok(injuriesLoad > -1 && injuriesLoad < calendarLoad, "injury feed should start before calendar await");
  assert.doesNotMatch(startup, /await\s+window\.MM\.(?:loadOdds|loadInjuries)/);
  assert.match(startup, /Promise\.allSettled\(/);
});

test("injury context is rendered after the initial calendar when it arrives later", () => {
  assert.match(startup, /initialRenderComplete=false/);
  assert.match(startup, /initialRenderComplete=true/);
  assert.match(startup, /injuryFeed\?\.status==="fulfilled"&&injuryFeed\.value\)renderFixtures\(\)/);
});
