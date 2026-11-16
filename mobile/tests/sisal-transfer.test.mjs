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
const nba = readFileSync(resolve(ROOT, "nba.js"), "utf8");

test("Sisal userscript v3 is scoped to Sisal, top frame only, and parses", () => {
  assert.doesNotThrow(() => new Function(script));
  assert.match(script, /^\/\/ @version\s+3\.4\.0$/m);
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
test("Sisal import runtime retains 60 fixtures across all four football competitions", () => {
  const probabilityStart = script.indexOf("  function validProbability(value) {");
  const normalizeStart = script.indexOf("  function normalizePredictions(row) {");
  const decodeStart = script.indexOf("  function decodeIncomingHash() {", normalizeStart);
  const eventStart = script.indexOf("  function eventKey(item) {", decodeStart);
  const cleanupStart = script.indexOf("  function clearLegacyInterface()", eventStart);
  assert.ok(probabilityStart >= 0 && normalizeStart > probabilityStart && decodeStart > normalizeStart && eventStart > decodeStart && cleanupStart > eventStart);
  const probabilitySource = script.slice(probabilityStart, normalizeStart);
  const normalizeSource = script.slice(normalizeStart, decodeStart);
  const decodeSource = script.slice(decodeStart, eventStart);
  const eventSource = script.slice(eventStart, cleanupStart);
  const competitions = ["serie-a", "champions-league", "europa-league", "nations-league"];
  const payload = {
    version: 3,
    sentAt: 123,
    items: Array.from({ length: 60 }, (_, index) => ({
      home: "Casa " + index, away: "Trasferta " + index,
      date: "2026-11-16", competition: competitions[index % competitions.length],
      sport: "football", marketKey: "home", probability: 0.6,
      predictions: [{ marketKey: "home", probability: 0.6 }]
    }))
  };
  const location = {
    search: "",
    hash: "#mmplay=" + encodeURIComponent(JSON.stringify(payload)),
    href: "https://www.sisal.it/scommesse-matchpoint/sport/calcio#mmplay=test"
  };
  const stored = [];
  let cleaned = false;
  const history = { replaceState() { cleaned = true; } };
  const compact = value => String(value || "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const decode = new Function("location", "history", "readStored", "writeStored",
    "URLSearchParams", "URL", "compact",
    probabilitySource + normalizeSource + decodeSource + eventSource + "return decodeIncomingHash;");
  const run = decode(location, history, () => stored, value => stored.splice(0, stored.length, ...value),
    URLSearchParams, URL, compact);
  assert.equal(run(), true);
  assert.equal(stored.length, 60);
  for (const competition of competitions) {
    assert.equal(stored.filter(item => item.competition === competition).length, 15);
  }
  assert.equal(cleaned, true);
});
test("Sisal import keeps at least 250 fixtures across multiple competitions", () => {
  assert.match(script, /writeStored\(Array\.from\(merged\.values\(\)\)\.slice\(-250\)\)/);
  assert.match(script, /function eventKey\(item\)/);
  assert.match(script, /item\.competition \|\| ""/);
});
test("the MatchMind transfer loads every configured football competition and NBA fixtures", () => {
  assert.match(bets, /async function collectAllSisalFixtures\(\)/);
  assert.match(bets, /window\.MM\.getCompetitions\(\)/);
  assert.match(bets, /api\/competition-calendar\?competition=/);
  assert.match(bets, /api\/public\/nba/);
  assert.match(bets, /window\.MM\.forecast\(match,history,getContext\(match\)\)/);
  assert.match(bets, /marketKey:base\.marketKey/);
  assert.match(bets, /selectedMarketKey:pick&&predictions\.some/);
  assert.match(bets, /nbaMoneyline:home/);
  assert.match(bets, /Trasferisci \"\+result\.payload\.items\.length\+\" partite su Sisal/);
});
test("Sisal can display 1X2, double chance, goals and both-teams-to-score forecasts", () => {
  assert.match(script, /function marketKeyFor\(button, eventRoot, item\)/);
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

test("runtime calendar collector transfers all four football competitions and NBA", async () => {
  const start = bets.indexOf("async function collectAllSisalFixtures(){");
  const end = bets.indexOf("\\nasync function updateSisalTransfer()", start);
  assert.ok(start >= 0 && end > start);
  const source = bets.slice(start, end);
  const competitions = ["serie-a", "champions-league", "europa-league", "nations-league"];
  const calls = [];
  const fakeFetch = async url => {
    calls.push(String(url));
    if (String(url).includes("/api/public/nba")) return {
      ok: true,
      json: async () => ({ games: [
        { id:"nba-1", home:"Boston Celtics", away:"New York Knicks", homeAbbr:"BOS", awayAbbr:"NYK", start:"2099-11-16T19:00:00Z", status:"NS", prediction:{homeWin:.63,awayWin:.37,reliable:true} },
        { id:"nba-2", home:"Los Angeles Lakers", away:"Golden State Warriors", homeAbbr:"LAL", awayAbbr:"GSW", start:"2099-11-16T21:00:00Z", status:"NS", prediction:{homeWin:.48,awayWin:.52,reliable:false} }
      ] })
    };
    const id = decodeURIComponent(String(url).split("competition=")[1]);
    return { ok:true, json:async()=>({matches:[{home:"Casa "+id,away:"Ospite "+id,date:"2099-11-16",time:"20:45",competition:id}],history:[{competition:id}]}) };
  };
  const MM = {
    getSelectedCompetition:()=>"serie-a",
    getCompetitions:()=>competitions.map(id=>({id,name:id})),
    upcoming:()=>true,
    forecast:()=>({sampleEnough:true,historyCount:20,predictionMethod:"test",probabilities:{home:.6,draw:.2,away:.2,over25:.55,under25:.45}})
  };
  const marketList=[["home","1"],["draw","X"],["away","2"],["over25","Over 2,5"],["under25","Under 2,5"]];
  const picks=[{competition:"champions-league",date:"2099-11-16",home:"Casa champions-league",away:"Ospite champions-league",marketKey:"over25"}];
  const factory=new Function("window","fetch","AbortSignal","sisalCalendarCache","sisalCalendarPromise","readPicks","markets","marketProbability","getContext","norm","allData","data",source+";return collectAllSisalFixtures;");
  const collect=factory({MM},fakeFetch,{timeout:()=>0},{at:0,rows:[],counts:{},errors:[]},null,()=>picks,()=>marketList,(forecast,key)=>forecast.probabilities[key],()=>({}),value=>String(value).toLowerCase(),null,null);
  const result=await collect();
  const football=result.rows.filter(row=>row.sport==="football"),nbaRows=result.rows.filter(row=>row.sport==="nba");
  assert.equal(football.length,4);
  assert.equal(nbaRows.length,2);
  assert.deepEqual([...new Set(football.map(row=>row.match.competition))],competitions);
  assert.ok(football.every(row=>row.predictions.length===5));
  assert.equal(football.find(row=>row.match.competition==="champions-league").selectedMarketKey,"over25");
  assert.ok(nbaRows.every(row=>row.predictions.length===2));
  assert.equal(calls.length,5);
});
test("NBA Sisal scanner identifies home/away outcomes, abbreviations and local date", () => {
  const dateStart=script.indexOf("  function eventDateMatch(text, date) {");
  const sameStart=script.indexOf("  function sameEvent(text, item, requireDate)",dateStart);
  const validStart=script.indexOf("  function validProbability",sameStart);
  const marketStart=script.indexOf("  function marketKeyFor(button, eventRoot, item)",validStart);
  const marketEnd=script.indexOf("\\n  function compactKeyLabel",marketStart);
  const familyStart=script.indexOf("  function marketFamily(key)",marketEnd);
  const familyEnd=script.indexOf("\\n  function addPredictionBadge",familyStart);
  assert.ok(dateStart>=0&&sameStart>dateStart&&validStart>sameStart&&marketStart>validStart&&marketEnd>marketStart&&familyStart>marketEnd);
  const normalize=value=>String(value||"").normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  const compact=value=>normalize(value).replace(/\\s+/g,"");
  const includesTeam=(text,name)=>Boolean(name)&&normalize(text).includes(normalize(name));
  const buttonText=button=>button.text,outcomeLabel=button=>button.label||button.text,marketContext=()=>"Moneyline";
  const source=script.slice(dateStart,sameStart)+script.slice(sameStart,validStart)+script.slice(marketStart,marketEnd)+script.slice(familyStart,familyEnd);
  const run=new Function("normalize","compact","includesTeam","buttonText","outcomeLabel","marketContext","item",source+`
    const button=text=>({text,label:text,getAttribute:()=>null});
    return {
      home:marketKeyFor(button("Boston Celtics"),{},item),
      away:marketKeyFor(button("New York Knicks"),{},item),
      abbreviation:marketKeyFor(button("BOS"),{},item),
      correctDate:sameEvent("Nov 16, 2026 Boston Celtics vs New York Knicks",item,true),
      wrongDate:sameEvent("Nov 17, 2026 Boston Celtics vs New York Knicks",item,true),
      family:marketFamily("nbaMoneyline:home")
    };
  `);
  const result=run(normalize,compact,includesTeam,buttonText,outcomeLabel,marketContext,{sport:"nba",home:"Boston Celtics",away:"New York Knicks",homeAbbr:"BOS",awayAbbr:"NYK",date:"2026-11-16"});
  assert.equal(result.home,"nbaMoneyline:home");
  assert.equal(result.away,"nbaMoneyline:away");
  assert.equal(result.abbreviation,"nbaMoneyline:home");
  assert.equal(result.correctDate,true);
  assert.equal(result.wrongDate,false);
  assert.equal(result.family,"nbaMoneyline");
});
test("NBA picks and Sisal transfer use Italy-local calendar dates consistently", () => {
  assert.ok(nba.includes('const localDate=iso=>'));
  assert.ok(nba.includes('timeZone:"Europe/Rome"'));
  assert.ok(nba.includes('date:localDate(g.start)'));
  assert.ok(bets.includes('timeZone:"Europe/Rome"'));
});

test("NBA transfer matches team names and abbreviations, recognizes moneyline and US date labels", () => {
  assert.match(script, /item\.sport === "nba"/);
  assert.match(script, /nbaMoneyline:home/);
  assert.match(script, /nbaMoneyline:away/);
  assert.match(script, /item\.homeAbbr/);
  assert.match(script, /item\.awayAbbr/);
  assert.match(script, /const monthFirst = \/\\b\(january\|jan/);
  assert.match(script, /key === "nbaMoneyline:home" \|\| key === "nbaMoneyline:away"/);
});
test("color ranking remains green probability, blue best Sisal odds, red lowest probability", () => {
  assert.match(script, /mm-best\{border-color:#16a34a/);
  assert.match(script, /mm-value\{border-color:#2563eb/);
  assert.match(script, /mm-avoid\{border-color:#dc2626/);
  assert.match(script, /quota più alta tra le alternative confrontabili/);
  assert.match(script, /probabilità più alta tra le alternative confrontabili/);
  assert.match(script, /probabilità più bassa tra le alternative confrontabili/);
  assert.match(script, /function marketFamily\(key\)/);
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

test("full-match transfer exports all model markets without marking an unselected outcome", () => {
  assert.match(bets, /const predictions=markets\(\)\.map\(\(\[key,label\]\)/);
  assert.match(bets, /selectedMarketKey:pick&&predictions\.some/);
  assert.match(bets, /predictions,sampleEnough:forecast\.sampleEnough===true/);
  assert.match(bets, /const allRows=\[\.\.\.unique\.values\(\),\.\.\.nbaRows\]/);
  assert.match(bridge, /selectedMarketKey/);
  assert.match(script, /hasExplicitSelection/);
  assert.match(script, /item\.selectedMarketKey === entry\.key/);
});
test("transfer confirmation reports all competitions and NBA coverage", () => {
  assert.match(bets, /Pronte \"\+counts\.football\+\" partite di calcio da tutte le competizioni MatchMind/);
  assert.match(bets, /\+counts\.nba\+\" partite NBA/);
  assert.match(bets, /verde = più alta, blu = quota Sisal più alta, rosso = più bassa/);
  assert.match(bets, /Dopo il trasferimento apri anche la sezione Basket\/NBA di Sisal/);
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
  assert.match(bets, /setBetTab\("live"\)/);
  assert.match(bets, /data-duplicate-ticket=/);
  assert.match(bets, /duplicateTicket\(ticket\)/);
});
