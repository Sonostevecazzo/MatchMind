// Unified public football calendar. ESPN supplies current fixtures/results for every
// supported competition; historical Serie A data remains sourced from openfootball.
const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/";
const HISTORY_ROOT = "https://raw.githubusercontent.com/openfootball/football.json/master/";
const seasonFolder = year => String(year) + "-" + String(year + 1).slice(-2);
const COMPETITIONS = {
  "serie-a": { name: "Serie A", slug: "ita.1", sport: "football" },
  "serie-b": { name: "Serie B", slug: "ita.2", sport: "football" },
  "premier-league": { name: "Premier League", slug: "eng.1", sport: "football" },
  "la-liga": { name: "La Liga", slug: "esp.1", sport: "football" },
  "bundesliga": { name: "Bundesliga", slug: "ger.1", sport: "football" },
  "ligue-1": { name: "Ligue 1", slug: "fra.1", sport: "football" },
  "champions-league": { name: "Champions League", slug: "uefa.champions", sport: "football" },
  "europa-league": { name: "Europa League", slug: "uefa.europa", sport: "football" },
  "conference-league": { name: "Conference League", slug: "uefa.europa.conf", sport: "football" },
  "coppa-italia": { name: "Coppa Italia", slug: "ita.coppa_italia", sport: "football" },
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
async function fetchCompetition(id, competition, startDate, endDate) {
  const windows = [];
  for (let cursor = new Date(startDate); cursor <= endDate; ) {
    const from = new Date(cursor), to = new Date(cursor);
    to.setUTCDate(to.getUTCDate()+6);
    if (to > endDate) to.setTime(endDate.getTime());
    windows.push([ymd(from), ymd(to)]);
    cursor = new Date(to); cursor.setUTCDate(cursor.getUTCDate()+1);
  }
  const batches = await Promise.all(windows.map(async ([from,to]) => {
    const url = ESPN_BASE + competition.slug + "/scoreboard?dates=" + from + "-" + to + "&limit=500";
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(18000) });
    if (!response.ok) throw new Error(id + " ESPN HTTP " + response.status + " (" + from + "-" + to + ")");
    const payload = await response.json();
    return (Array.isArray(payload.events) ? payload.events : []).map(event => normalizeEvent(event, competition)).filter(Boolean);
  }));
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
  const startDate = new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()-2));
  const endDate = new Date(startDate); endDate.setUTCDate(endDate.getUTCDate()+92);
  const entries = await Promise.all([[selected,competition]].map(async ([id, config]) => {
    try { return { id, matches: await fetchCompetition(id, config, startDate, endDate), error: null }; }
    catch (error) { return { id, matches: [], error: String(error?.message || error) }; }
  }));
  const matches = entries.flatMap(x => x.matches).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const history = matches.filter(match => match.status === "FT" && match.hg !== null && match.ag !== null);
  // Preserve the five-season Serie A archive used by the Elo/Poisson forecasts.
  const historicalYears = await Promise.allSettled(Array.from({ length: 5 }, (_, index) => year - 1 - index).map(async historicalYear => {
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
  }));
  const historyErrors = [];
  historicalYears.forEach((result, index) => {
    if (result.status === "fulfilled") history.push(...result.value);
    else historyErrors.push("Archivio Serie A " + seasonFolder(year - 1 - index) + " non disponibile");
  });
  history.sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
  if (!matches.length) return json({ configured: true, type: "calendar", matches: [], history: [], errors: entries.map(x => x.error).filter(Boolean), error: "Nessuna competizione ha restituito partite. Verificare il provider ESPN." }, 503);
  const counts = Object.fromEntries(entries.map(x => [x.id, x.matches.length]));
  return json({
    configured: true, type: "calendar", season: year, matches, history,
    source: "ESPN public scoreboard + openfootball historical Serie A", sourceMode: "multi-competition-public",
    counts, errors: entries.filter(x => x.error).map(x => x.error).concat(historyErrors),
    updatedAt: new Date().toISOString(),
    note: "Calendari multi-competizione da ESPN; archivio storico Serie A da openfootball. Le statistiche avanzate, le quote e le formazioni non vengono inventate."
  });
}
export async function onRequestGet({ request }) { return getCalendar(request); }
