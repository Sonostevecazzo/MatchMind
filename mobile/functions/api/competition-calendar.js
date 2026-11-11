// Unified public football calendar. ESPN supplies current fixtures/results for every
// supported competition; historical Serie A data remains sourced from openfootball.
const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/";
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
async function fetchCompetition(id, competition, from, to) {
  const url = ESPN_BASE + competition.slug + "/scoreboard?dates=" + from + "-" + to + "&limit=500";
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(18000) });
  if (!response.ok) throw new Error(id + " ESPN HTTP " + response.status);
  const payload = await response.json();
  return (Array.isArray(payload.events) ? payload.events : []).map(event => normalizeEvent(event, competition)).filter(Boolean);
}
async function getCalendar() {
  const now = new Date();
  const year = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  const from = String(year) + "0701", to = String(year + 1) + "0630";
  const entries = await Promise.all(Object.entries(COMPETITIONS).map(async ([id, competition]) => {
    try { return { id, matches: await fetchCompetition(id, competition, from, to), error: null }; }
    catch (error) { return { id, matches: [], error: String(error?.message || error) }; }
  }));
  const matches = entries.flatMap(x => x.matches).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  if (!matches.length) return json({ configured: true, type: "calendar", matches: [], history: [], errors: entries.map(x => x.error).filter(Boolean), error: "Nessuna competizione ha restituito partite. Verificare il provider ESPN." }, 503);
  const counts = Object.fromEntries(entries.map(x => [x.id, x.matches.length]));
  return json({
    configured: true, type: "calendar", season: year, matches, history: [],
    source: "ESPN public scoreboard", sourceMode: "multi-competition-public",
    counts, errors: entries.filter(x => x.error).map(x => x.error),
    updatedAt: new Date().toISOString(),
    note: "Calendari e risultati ESPN. Le statistiche avanzate, le quote e le formazioni non vengono inventate."
  });
}
export async function onRequestGet() { return getCalendar(); }
