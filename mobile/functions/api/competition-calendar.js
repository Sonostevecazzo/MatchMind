// Unified public football calendar. Open Matchday supplies club competitions; ESPN supplies Nations League.
// Historical Serie A data remains sourced from openfootball.
const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/";
const HISTORY_ROOT = "https://raw.githubusercontent.com/openfootball/football.json/master/";
const DATA_ROOT = "https://raw.githubusercontent.com/oladeeayo/open-matchday/master/data/";
const seasonCode = year => String(year).slice(-2) + String(year + 1).slice(-2);
const seasonFolder = year => String(year) + "-" + String(year + 1).slice(-2);
const COMPETITIONS = {
  "serie-a": { name: "Serie A", slug: "ita.1", feed: "ITA_1_serie-a", sport: "football" },
  "serie-b": { name: "Serie B", slug: "ita.2", feed: "ITA_2_serie-b", sport: "football" },
  "premier-league": { name: "Premier League", slug: "eng.1", feed: "ENG_1_premier-league", sport: "football" },
  "la-liga": { name: "La Liga", slug: "esp.1", feed: "ESP_1_la-liga", sport: "football" },
  "bundesliga": { name: "Bundesliga", slug: "ger.1", feed: "GER_1_bundesliga", sport: "football" },
  "ligue-1": { name: "Ligue 1", slug: "fra.1", feed: "FRA_1_ligue-1", sport: "football" },
  "champions-league": { name: "Champions League", slug: "uefa.champions", feed: "UEFA_1_champions-league", sport: "football" },
  "europa-league": { name: "Europa League", slug: "uefa.europa", feed: "UEFA_1_europa-league", sport: "football" },
  "conference-league": { name: "Conference League", slug: "uefa.europa.conf", feed: "UEFA_1_conference-league", sport: "football" },
  "coppa-italia": { name: "Coppa Italia", slug: "ita.coppa_italia", feed: "ITA_CUP_coppa-italia", sport: "football" },
  "nations-league": { name: "UEFA Nations League", slug: "uefa.nations", sport: "football" }
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
    else if(ch==="\\n"){row.push(field.replace(/\\r$/,""));if(row.some(value=>value!==""))rows.push(row);row=[];field="";}
    else field+=ch;
  }
  if(field!==""||row.length){row.push(field.replace(/\\r$/,""));rows.push(row);}
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
  const code=seasonCode(new Date().getUTCMonth()>=6?new Date().getUTCFullYear():new Date().getUTCFullYear()-1);
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
async function fetchCompetition(id, competition, startDate, endDate) {
  if (competition.feed) return fetchOpenMatchday(id, competition);
  if(competition.feed) return fetchOpenMatchday(id,competition);
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
  if (!batches.length) {
    const failure = settled.find(result => result.status === "rejected");
    throw failure?.reason || new Error(id + " ESPN: tutte le finestre calendario non disponibili");
  }
  const unique = new Map();
  batches.flat().forEach(match => unique.set(String(match.id || [match.date,match.home,match.away].join("|")), match));
  return [...unique.values()];
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
  return json({
    configured: true, type: "calendar", season: year, matches, history,
    source: "open-matchday CSV + ESPN Nations League + openfootball historical Serie A", sourceMode: "multi-competition-public",
    counts, errors: entries.filter(x => x.error).map(x => x.error).concat(historyErrors),
    updatedAt: new Date().toISOString(),
    note: "Calendari multi-competizione da ESPN; archivio storico Serie A da openfootball. Le statistiche avanzate, le quote e le formazioni non vengono inventate."
  });
}
export async function onRequestGet({ request }) { return getCalendar(request); }
