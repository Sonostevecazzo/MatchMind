// Unified public football calendar. Open Matchday supplies club competitions; ESPN supplies Nations League.
// Historical Serie A data remains sourced from openfootball.
const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/";
const HISTORY_ROOT = "https://raw.githubusercontent.com/openfootball/football.json/master/";
const DATA_ROOT = "https://raw.githubusercontent.com/oladeeayo/open-matchday/master/data/";
const seasonCode = year => String(year).slice(-2) + String(year + 1).slice(-2);
const seasonFolder = year => String(year) + "-" + String(year + 1).slice(-2);
const COMPETITIONS = {
  "serie-a": { name: "Serie A", slug: "ita.1", feed: "ITA_1_serie-a", sport: "football", calendarYear: false }
};
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=300, s-maxage=900, stale-while-revalidate=1800" }
});
function romeDateTime(value) {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return { date: "", time: "" };
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d).filter(x => x.type !== "literal").map(x => [x.type, x.value]));
  return { date: p.year + "-" + p.month + "-" + p.day, time: p.hour + ":" + p.minute };
}
function normalizeEvent(event, competition) {
  const comp = event?.competitions?.[0] || {};
  const teams = Array.isArray(comp.competitors) ? comp.competitors : [];
  const home = teams.find(x => x?.homeAway === "home") || teams[0] || {};
  const away = teams.find(x => x?.homeAway === "away") || teams[1] || {};
  const homeName = home?.team?.displayName || home?.team?.name || home?.displayName || home?.name;
  const awayName = away?.team?.displayName || away?.team?.name || away?.displayName || away?.name;
  const local = romeDateTime(event?.date || comp?.date);
  const status = comp?.status?.type || event?.status?.type || {};
  const completed = Boolean(status.completed) || String(status.state || "").toLowerCase() === "post";
  const score = value => value === null || value === undefined || value === "" ? null : Number.isFinite(Number(value)) ? Number(value) : null;
  if (!local.date || !homeName || !awayName) return null;
  return {
    id: String(event?.id || ""), date: local.date, time: local.time, round: null,
    stage: comp?.series?.name || comp?.notes?.[0]?.headline || competition.name,
    home: homeName, away: awayName,
    hg: completed ? score(home?.score) : null, ag: completed ? score(away?.score) : null,
    ht: null, at: null, hs: null, as: null, hst: null, ast: null, hf: null, af: null,
    hc: null, ac: null, hy: null, ay: null, hr: null, ar: null, goalMinutes: "",
    status: completed ? "FT" : String(status.state || "").toLowerCase() === "in" ? "LIVE" : "NS",
    statusLong: status.shortDetail || status.detail || (completed ? "Terminata" : "In programma"),
    competition: Object.keys(COMPETITIONS).find(key => COMPETITIONS[key] === competition),
    source: "ESPN"
  };
}
function ymd(date) {
  return date.getUTCFullYear().toString() + String(date.getUTCMonth()+1).padStart(2,"0") + String(date.getUTCDate()).padStart(2,"0");
}
function parseCsv(input) {
  const rows=[]; let row=[], field="", quoted=false;
  for(let i=0;i<input.length;i++){
    const ch=input[i];
    if(quoted){if(ch==='"'&&input[i+1]==='"'){field+='"';i++;}else if(ch==='"')quoted=false;else field+=ch;}
    else if(ch==='"')quoted=true;
    else if(ch===","){row.push(field);field="";}
    else if(ch==="\n"){row.push(field.replace(/\r$/,""));if(row.some(value=>value!==""))rows.push(row);row=[];field="";}
    else field+=ch;
  }
  if(field!==""||row.length){row.push(field.replace(/\r$/,""));rows.push(row);}
  if(!rows.length)return[];
  const headers=rows.shift();
  return rows.map(values=>Object.fromEntries(headers.map((key,index)=>[key,values[index]??""])));
}
function csvNumber(value){if(value===undefined||value===null||String(value).trim()==="")return null;const n=Number(value);return Number.isFinite(n)?n:null;}
function normalizeCsv(row,id,finished){
  const hg=csvNumber(row.ft_home),ag=csvNumber(row.ft_away),done=finished&&hg!==null&&ag!==null;
  return {id:null,date:String(row.date||""),time:String(row.time||""),round:csvNumber(row.gw),stage:row.gw?"Giornata "+row.gw:COMPETITIONS[id].name,home:String(row.home||""),away:String(row.away||""),hg:done?hg:null,ag:done?ag:null,ht:csvNumber(row.ht_home),at:csvNumber(row.ht_away),hs:csvNumber(row.home_shots),as:csvNumber(row.away_shots),hst:csvNumber(row.home_target),ast:csvNumber(row.away_target),hf:csvNumber(row.home_fouls),af:csvNumber(row.away_fouls),hc:csvNumber(row.home_corners),ac:csvNumber(row.away_corners),hy:csvNumber(row.home_yellow),ay:csvNumber(row.away_yellow),hr:csvNumber(row.home_red),ar:csvNumber(row.away_red),goalMinutes:String(row.goal_minutes||""),status:done?"FT":"NS",statusLong:done?"Terminata":"In programma",competition:id,source:"open-matchday"};
}
async function fetchOpenMatchday(id,competition){
  const now = new Date();
  const seasonYear = competition.calendarYear ? now.getUTCFullYear() : (now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1);
  const code = competition.calendarYear ? String(seasonYear) : seasonCode(seasonYear);
  const base=DATA_ROOT+competition.feed+"/";
  const urls=[base+"results_"+code+".csv",base+"fixtures_"+code+".csv"];
  const settled=await Promise.allSettled(urls.map(async(url,index)=>{
    const response=await fetch(url,{headers:{Accept:"text/plain"},signal:AbortSignal.timeout(18000)});
    if(!response.ok)throw new Error(id+" open-matchday HTTP "+response.status+" "+url);
    return parseCsv(await response.text()).map(row=>normalizeCsv(row,id,index===0)).filter(match=>match.date&&match.home&&match.away);
  }));
  const results=settled.filter(x=>x.status==="fulfilled").flatMap(x=>x.value);
  if(!results.length)throw settled.find(x=>x.status==="rejected")?.reason||new Error(id+" dataset vuoto");
  return results;
}
// Official UEFA fallback for the remaining 2026/27 league-phase matchdays.
// Used only when ESPN returns an empty Nations League scoreboard.
function nationsLeagueOfficialFallback(now = new Date()) {
  const rows = [
    ["2026-11-12","18:00","Türkiye","Belgium","A1"],["2026-11-12","18:00","Armenia","Cyprus","C2"],["2026-11-12","20:45","Italy","France","A1"],["2026-11-12","20:45","Czechia","Spain","A3"],["2026-11-12","20:45","England","Croatia","A3"],["2026-11-12","20:45","Albania","Finland","C1"],["2026-11-12","20:45","San Marino","Belarus","C1"],["2026-11-12","20:45","Montenegro","Latvia","C2"],
    ["2026-11-13","18:00","Moldova","Kazakhstan","C3"],["2026-11-13","20:45","Netherlands","Greece","A2"],["2026-11-13","20:45","Serbia","Germany","A2"],["2026-11-13","20:45","Scotland","North Macedonia","B1"],["2026-11-13","20:45","Slovenia","Switzerland","B1"],["2026-11-13","20:45","Slovakia","Faroe Islands","C3"],["2026-11-13","20:45","Bulgaria","Iceland","C4"],["2026-11-13","20:45","Luxembourg","Estonia","C4"],["2026-11-13","20:45","Andorra","Gibraltar","D1"],["2026-11-13","20:45","Liechtenstein","Azerbaijan","D2"],
    ["2026-11-14","15:00","Kosovo","Israel","B3"],["2026-11-14","18:00","Norway","Wales","A4"],["2026-11-14","18:00","Georgia","Hungary","B2"],["2026-11-14","20:45","Portugal","Denmark","A4"],["2026-11-14","20:45","Northern Ireland","Ukraine","B2"],["2026-11-14","20:45","Austria","Republic of Ireland","B3"],["2026-11-14","20:45","Romania","Poland","B4"],["2026-11-14","20:45","Sweden","Bosnia and Herzegovina","B4"],
    ["2026-11-15","15:00","Cyprus","Montenegro","C2"],["2026-11-15","15:00","Latvia","Armenia","C2"],["2026-11-15","18:00","Belarus","Albania","C1"],["2026-11-15","18:00","Finland","San Marino","C1"],["2026-11-15","20:45","Belgium","Italy","A1"],["2026-11-15","20:45","France","Türkiye","A1"],["2026-11-15","20:45","Croatia","Czechia","A3"],["2026-11-15","20:45","Spain","England","A3"],
    ["2026-11-16","16:00","Faroe Islands","Moldova","C3"],["2026-11-16","16:00","Kazakhstan","Slovakia","C3"],["2026-11-16","18:00","Estonia","Bulgaria","C4"],["2026-11-16","18:00","Iceland","Luxembourg","C4"],["2026-11-16","18:00","Lithuania","Liechtenstein","D2"],["2026-11-16","20:45","Germany","Netherlands","A2"],["2026-11-16","20:45","Greece","Serbia","A2"],["2026-11-16","20:45","North Macedonia","Slovenia","B1"],["2026-11-16","20:45","Switzerland","Scotland","B1"],["2026-11-16","20:45","Gibraltar","Malta","D1"],
    ["2026-11-17","20:45","Denmark","Norway","A4"],["2026-11-17","20:45","Wales","Portugal","A4"],["2026-11-17","20:45","Hungary","Northern Ireland","B2"],["2026-11-17","20:45","Ukraine","Georgia","B2"],["2026-11-17","20:45","Israel","Austria","B3"],["2026-11-17","20:45","Republic of Ireland","Kosovo","B3"],["2026-11-17","20:45","Bosnia and Herzegovina","Romania","B4"],["2026-11-17","20:45","Poland","Sweden","B4"]
  ];
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return rows.filter(([date]) => date >= today).map(([date,time,home,away,group], index) => ({
    id: "uefa-nl-2026-" + index, date, time, round: date <= "2026-11-14" ? 5 : 6,
    stage: "UEFA Nations League · " + group, home, away,
    hg: null, ag: null, ht: null, at: null, hs: null, as: null, hst: null, ast: null,
    hf: null, af: null, hc: null, ac: null, hy: null, ay: null, hr: null, ar: null,
    goalMinutes: "", status: "NS", statusLong: "In programma",
    competition: "nations-league", source: "UEFA · calendario ufficiale 2026/27"
  }));
}
async function fetchCompetitionFromEspn(id, competition, startDate, endDate) {
  const windows = [];
  for (let cursor = new Date(startDate); cursor <= endDate; ) {
    const from = new Date(cursor), to = new Date(cursor);
    to.setUTCDate(to.getUTCDate()+6);
    if (to > endDate) to.setTime(endDate.getTime());
    windows.push([ymd(from), ymd(to)]);
    cursor = new Date(to); cursor.setUTCDate(cursor.getUTCDate()+1);
  }
  const settled = await Promise.allSettled(windows.map(async ([from,to]) => {
    const url = ESPN_BASE + competition.slug + "/scoreboard?dates=" + from + "-" + to + "&limit=500";
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(18000) });
    if (!response.ok) throw new Error(id + " ESPN HTTP " + response.status + " (" + from + "-" + to + ")");
    const payload = await response.json();
    return (Array.isArray(payload.events) ? payload.events : []).map(event => normalizeEvent(event, competition)).filter(Boolean);
  }));
  const batches = settled.filter(result => result.status === "fulfilled").map(result => result.value);
  if (!batches.length) throw settled.find(result => result.status === "rejected")?.reason || new Error(id + " ESPN non disponibile");
  const unique = new Map();
  batches.flat().forEach(match => unique.set(String(match.id || [match.date,match.home,match.away].join("|")), match));
  return [...unique.values()];
}
async function fetchCompetition(id, competition, startDate, endDate) {
  if (competition.feed) {
    try { return await fetchOpenMatchday(id, competition); }
    catch (primaryError) {
      if (!competition.slug) throw primaryError;
      try {
        const fallback = await fetchCompetitionFromEspn(id, competition, startDate, endDate);
        if (fallback.length) return fallback.map(match => ({ ...match, source: "ESPN · fallback dopo Open Matchday" }));
      } catch (_) { /* Preserve the primary provider error below. */ }
      throw primaryError;
    }
  }
  let normalized;
  try { normalized = await fetchCompetitionFromEspn(id, competition, startDate, endDate); }
  catch (error) {
    if (id === "nations-league") return nationsLeagueOfficialFallback();
    throw error;
  }
  if (id === "nations-league" && normalized.length === 0) return nationsLeagueOfficialFallback();
  if (id === "nations-league") {
    for (const match of nationsLeagueOfficialFallback()) {
      const key = [match.date, match.home, match.away].join("|");
      if (!normalized.some(item => [item.date, item.home, item.away].join("|") === key)) normalized.push(match);
    }
    normalized.sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
  }
  return normalized;
}
async function getCalendar(request) {
  const params = new URL(request.url).searchParams;
  const selectedId = params.get("competition") || "serie-a";
  const selected = COMPETITIONS[selectedId] ? selectedId : "serie-a";
  const competition = COMPETITIONS[selected];
  const now = new Date();
  const year = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  const startDate = new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()-2));
  const endDate = new Date(startDate); endDate.setUTCDate(endDate.getUTCDate()+92);
  const entries = await Promise.all([[selected,competition]].map(async ([id, config]) => {
    try { return { id, matches: await fetchCompetition(id, config, startDate, endDate), error: null }; }
    catch (error) { return { id, matches: [], error: String(error?.message || error) }; }
  }));
  const matches = entries.flatMap(x => x.matches).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const history = matches.filter(match => match.status === "FT" && match.hg !== null && match.ag !== null);
  // Preserve the five-season Serie A archive used by the Elo/Poisson forecasts.
  const historicalYears = selected === "serie-a" ? await Promise.allSettled(Array.from({ length: 5 }, (_, index) => year - 1 - index).map(async historicalYear => {
    const url = HISTORY_ROOT + seasonFolder(historicalYear) + "/it.1.json";
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("Archivio Serie A HTTP " + response.status);
    const payload = await response.json();
    return (Array.isArray(payload.matches) ? payload.matches : []).map(row => {
      const ft = row?.score?.ft, ht = row?.score?.ht;
      const done = Array.isArray(ft) && ft.length >= 2 && ft[0] !== null && ft[1] !== null;
      const score = value => value === null || value === undefined || value === "" ? null : Number.isFinite(Number(value)) ? Number(value) : null;
      return {
        id: null, date: String(row.date || ""), time: String(row.time || ""),
        round: Number(String(row.round || "").match(/\\d+/)?.[0]) || null,
        stage: String(row.round || ""), home: String(row.team1 || ""), away: String(row.team2 || ""),
        hg: done ? score(ft[0]) : null, ag: done ? score(ft[1]) : null,
        ht: Array.isArray(ht) ? score(ht[0]) : null, at: Array.isArray(ht) ? score(ht[1]) : null,
        hs: null, as: null, hst: null, ast: null, hf: null, af: null,
        hc: null, ac: null, hy: null, ay: null, hr: null, ar: null,
        status: done ? "FT" : "NS", statusLong: done ? "Terminata" : "In programma",
        competition: "serie-a", source: "openfootball · archivio storico"
      };
    }).filter(match => match.date && match.home && match.away && match.hg !== null && match.ag !== null);
  })) : [];
  const historyErrors = [];
  historicalYears.forEach((result, index) => {
    if (result.status === "fulfilled") history.push(...result.value);
    else historyErrors.push("Archivio Serie A " + seasonFolder(year - 1 - index) + " non disponibile");
  });
  history.sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
  if (!matches.length) return json({ configured: true, type: "calendar", matches: [], history: [], errors: entries.map(x => x.error).filter(Boolean), error: "Nessuna partita disponibile dalla fonte selezionata. Verificare il feed della competizione." }, 503);
  const counts = Object.fromEntries(entries.map(x => [x.id, x.matches.length]));
  const statFields = ["ht", "at", "hs", "as", "hst", "ast", "hf", "af", "hc", "ac", "hy", "ay", "hr", "ar", "goalMinutes"];
  const selectedMatches = entries[0].matches;
  const coverage = {
    fixturesAndResults: selectedMatches.length,
    completed: selectedMatches.filter(match => match.status === "FT" && match.hg !== null && match.ag !== null).length,
    statistics: Object.fromEntries(statFields.map(field => [field, selectedMatches.filter(match => field === "goalMinutes" ? Boolean(match[field]) : Number.isFinite(match[field])).length]))
  };
  return json({
    configured: true, type: "calendar", season: year, matches, history,
    source: selected === "nations-league" ? "ESPN public scoreboard" : "Open Matchday CSV" + (entries[0].matches.some(match => String(match.source || "").includes("ESPN")) ? " + ESPN fallback" : ""), sourceMode: "multi-competition-public",
    counts, coverage, historyScope: selected === "serie-a" ? "five-season-archive" : selected === "nations-league" ? "current-window-only" : "current-season-only",
    errors: entries.filter(x => x.error).map(x => x.error).concat(historyErrors),
    updatedAt: new Date().toISOString(),
    note: "Calendario e risultati club da Open Matchday; ESPN è usato per Nations League e come fallback dove configurato. Lo storico pluristagionale è attualmente disponibile in modo verificato per la sola Serie A. Le statistiche non presenti restano null."
  });
}
export async function onRequestGet({ request }) { return getCalendar(request); }
