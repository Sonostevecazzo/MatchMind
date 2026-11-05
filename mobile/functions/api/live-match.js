const API_BASE = "https://v3.football.api-sports.io";
const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/";
const LEAGUES = { "serie-a": 135, "champions-league": 2, "europa-league": 3 };
const ESPN_LEAGUES = { "serie-a": "ita.1", "champions-league": "uefa.champions", "europa-league": "uefa.europa" };

const json = (body, status = 200, cacheSeconds = 0) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": cacheSeconds ? "public, max-age=" + cacheSeconds : "no-store",
    "X-Content-Type-Options": "nosniff"
  }
});

export function normalizeFixture(row) {
  const fixture = row?.fixture || {};
  const status = fixture.status || {};
  const home = row?.teams?.home || {};
  const away = row?.teams?.away || {};
  return {
    id: Number(fixture.id),
    date: fixture.date || null,
    timestamp: Number(fixture.timestamp) || null,
    elapsed: status.elapsed !== null && status.elapsed !== undefined && Number.isFinite(Number(status.elapsed)) ? Number(status.elapsed) : null,
    extra: status.extra !== null && status.extra !== undefined && Number.isFinite(Number(status.extra)) ? Number(status.extra) : null,
    status: status.short || "UNK",
    statusLong: status.long || "Stato non disponibile",
    venue: fixture.venue?.name || null,
    referee: fixture.referee || null,
    league: row?.league?.name || null,
    home: { id: home.id ?? null, name: home.name || "Casa", logo: home.logo || null },
    away: { id: away.id ?? null, name: away.name || "Trasferta", logo: away.logo || null },
    goals: { home: row?.goals?.home ?? null, away: row?.goals?.away ?? null },
    halftime: { home: row?.score?.halftime?.home ?? null, away: row?.score?.halftime?.away ?? null }
  };
}

export function normalizeEvents(rows) {
  return (Array.isArray(rows) ? rows : []).map(item => ({
    minute: Number(item?.time?.elapsed) || 0,
    extra: Number(item?.time?.extra) || null,
    team: item?.team?.name || null,
    teamId: item?.team?.id ?? null,
    player: item?.player?.name || null,
    assist: item?.assist?.name || null,
    type: item?.type || "Evento",
    detail: item?.detail || "",
    comments: item?.comments || ""
  })).sort((a, b) => a.minute - b.minute || (a.extra || 0) - (b.extra || 0));
}

export function normalizeLineups(rows) {
  return (Array.isArray(rows) ? rows : []).map(team => ({
    team: team?.team?.name || null,
    teamId: team?.team?.id ?? null,
    formation: team?.formation || null,
    coach: team?.coach?.name || null,
    startXI: (Array.isArray(team?.startXI) ? team.startXI : []).map((entry, index) => {
      const player = entry?.player || {};
      const gridParts = String(player.grid || "").split(":").map(Number);
      const grid = gridParts.length === 2 && gridParts.every(value => Number.isInteger(value) && value > 0)
        ? { row: gridParts[0], column: gridParts[1] }
        : null;
      return {
        id: player.id ?? null,
        name: player.name || "Giocatore " + (index + 1),
        number: Number.isFinite(Number(player.number)) ? Number(player.number) : index + 1,
        position: player.pos || null,
        grid
      };
    }),
    substitutes: (Array.isArray(team?.substitutes) ? team.substitutes : []).map((entry, index) => {
      const player = entry?.player || {};
      return {
        id: player.id ?? null,
        name: player.name || "Riserva " + (index + 1),
        number: Number.isFinite(Number(player.number)) ? Number(player.number) : index + 1,
        position: player.pos || null
      };
    })
  }));
}

export function normalizeStatistics(rows) {
  return (Array.isArray(rows) ? rows : []).map(team => ({
    team: team?.team?.name || null,
    teamId: team?.team?.id ?? null,
    values: (Array.isArray(team?.statistics) ? team.statistics : []).map(item => ({
      type: String(item?.type || ""),
      value: item?.value ?? null
    }))
  }));
}

function providerKey(context) {
  const key = context?.env?.API_FOOTBALL_KEY || "";
  return /^[A-Za-z0-9_-]{8,256}$/.test(key) ? key : "";
}

async function providerGet(path, params, context, ttlSeconds) {
  const url = new URL(path, API_BASE + "/");
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  });

  let cache = null;
  let cacheKey = null;
  try {
    cache = caches.default;
    cacheKey = new Request(new URL("/__matchmind_cache/live/" + encodeURIComponent(url.pathname + url.search), context.request.url));
    const cached = await cache.match(cacheKey);
    if (cached) return await cached.json();
  } catch {
    cache = null;
    cacheKey = null;
  }

  const response = await fetch(url.toString(), {
    headers: { "x-apisports-key": providerKey(context) },
    signal: AbortSignal.timeout(12000)
  });
  if (response.status === 204) return { response: [], errors: [] };
  if (!response.ok) {
    if (response.status === 429) throw new Error("Limite richieste API-Football raggiunto.");
    throw new Error("Provider live non disponibile (HTTP " + response.status + ").");
  }
  const payload = await response.json();
  if (payload?.errors && (Array.isArray(payload.errors) ? payload.errors.length : Object.keys(payload.errors).length)) {
    const errors = JSON.stringify(payload.errors).toLowerCase();
    if (errors.includes("rate") || errors.includes("limit")) throw new Error("Limite richieste API-Football raggiunto.");
    if (errors.includes("key") || errors.includes("unauthorized")) throw new Error("Chiave API-Football non valida.");
    throw new Error("API-Football ha rifiutato la richiesta.");
  }
  if (cache && cacheKey && ttlSeconds > 0) {
    try {
      await cache.put(cacheKey, new Response(JSON.stringify(payload), {
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=" + ttlSeconds }
      }));
    } catch { /* Cache failure must not discard valid live data. */ }
  }
  return payload;
}

async function publicJson(url, cacheSeconds = 60) {
  let cache = null;
  let cacheKey = null;
  try {
    cache = caches.default;
    cacheKey = new Request(url);
    const cached = await cache.match(cacheKey);
    if (cached) return await cached.json();
  } catch {
    cache = null;
    cacheKey = null;
  }
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error("Fonte ESPN non disponibile (HTTP " + response.status + ").");
  const payload = await response.json();
  if (!payload || typeof payload !== "object") throw new Error("La fonte ESPN ha restituito un formato non riconosciuto.");
  if (cache && cacheKey && cacheSeconds > 0) {
    try {
      await cache.put(cacheKey, new Response(JSON.stringify(payload), {
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=" + cacheSeconds }
      }));
    } catch { /* Optional edge cache. */ }
  }
  return payload;
}

function dateInRome() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const part = type => parts.find(item => item.type === type)?.value || "01";
  return part("year") + part("month") + part("day");
}

function espnUrl(competition, date) {
  const league = ESPN_LEAGUES[competition] || ESPN_LEAGUES["serie-a"];
  const url = new URL(league + "/scoreboard", ESPN_BASE);
  url.searchParams.set("dates", String(date || dateInRome()).replace(/-/g, ""));
  url.searchParams.set("limit", "100");
  return url.toString();
}

function scoreNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function normalizeEspnFixture(event, leagueName = "Calcio") {
  const competition = event?.competitions?.[0] || event?.competition || {};
  const competitors = Array.isArray(competition.competitors) ? competition.competitors : [];
  const home = competitors.find(item => item?.homeAway === "home") || competitors[0] || {};
  const away = competitors.find(item => item?.homeAway === "away") || competitors[1] || {};
  const rawStatus = competition.status || event?.status || {};
  const statusType = rawStatus.type || rawStatus;
  const state = String(statusType.state || "").toLowerCase();
  const statusName = String(statusType.name || statusType.description || statusType.detail || "").toUpperCase();
  const displayClock = String(rawStatus.displayClock || statusType.displayClock || "");
  const clockMatch = displayClock.match(/(\d{1,3})/);
  const elapsed = clockMatch ? Number(clockMatch[1]) : null;
  const period = Number(rawStatus.period || statusType.period || 0);
  let short = "NS";
  if (statusType.completed || state === "post") short = "FT";
  else if (statusName.includes("HALFTIME") || statusName.includes("HALF_TIME") || statusName.includes("HALF TIME")) short = "HT";
  else if (state === "in") short = period > 2 ? "ET" : period >= 2 || (elapsed !== null && elapsed > 45) ? "2H" : "1H";
  const date = event?.date || competition.date || null;
  return {
    id: String(event?.id || competition.id || ""),
    date,
    timestamp: date ? Math.floor(Date.parse(date) / 1000) || null : null,
    elapsed: short === "NS" || short === "FT" ? null : elapsed,
    extra: null,
    status: short,
    statusLong: statusType.shortDetail || statusType.detail || statusType.description || (short === "FT" ? "Terminata" : short === "NS" ? "In programma" : "In corso"),
    venue: competition.venue?.fullName || competition.venue?.name || null,
    referee: null,
    league: event?.leagueName || leagueName,
    home: {
      id: home?.team?.id || home?.id || null,
      name: home?.team?.displayName || home?.team?.name || home?.team?.shortDisplayName || home?.displayName || home?.name || "Casa",
      logo: home?.team?.logo || home?.logo || null
    },
    away: {
      id: away?.team?.id || away?.id || null,
      name: away?.team?.displayName || away?.team?.name || away?.team?.shortDisplayName || away?.displayName || away?.name || "Trasferta",
      logo: away?.team?.logo || away?.logo || null
    },
    goals: {
      home: scoreNumber(home?.score),
      away: scoreNumber(away?.score)
    },
    halftime: { home: null, away: null }
  };
}

export function normalizeEspnEvents(rows) {
  return (Array.isArray(rows) ? rows : []).map(item => {
    const clock = item?.clock?.displayValue || item?.time?.displayValue || item?.clock || "";
    const timeMatch = String(clock).match(/(\d{1,3})/);
    const participants = Array.isArray(item?.participants) ? item.participants : [];
    const firstParticipant = participants[0] || {};
    const athlete = firstParticipant.athlete || firstParticipant;
    const type = item?.type?.text || item?.type?.name || item?.type || "Evento";
    return {
      minute: timeMatch ? Number(timeMatch[1]) : 0,
      extra: null,
      team: item?.team?.displayName || item?.team?.name || item?.competitor?.displayName || null,
      teamId: item?.team?.id || item?.competitor?.id || null,
      player: athlete?.displayName || athlete?.name || item?.athlete?.displayName || null,
      assist: item?.assist?.displayName || null,
      type: String(type),
      detail: item?.text || item?.shortText || item?.description || String(type),
      comments: ""
    };
  }).sort((a, b) => a.minute - b.minute);
}

export function normalizeEspnStatistics(rows) {
  return (Array.isArray(rows) ? rows : []).map(entry => {
    const team = entry?.team || entry?.competitor || {};
    const values = Array.isArray(entry?.statistics) ? entry.statistics : [];
    return {
      team: team.displayName || team.name || null,
      teamId: team.id || null,
      values: values.map(value => ({
        type: String(value?.label || value?.displayName || value?.name || value?.type || ""),
        value: value?.displayValue ?? value?.value ?? null
      }))
    };
  }).filter(entry => entry.team || entry.teamId);
}

function normalizeTeamQuery(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/\b(fc|cf|sc|ac|as|ss|calcio|club)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function teamQueryMatches(left, right) {
  const a = normalizeTeamQuery(left);
  const b = normalizeTeamQuery(right);
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  const aliases = [
    ["inter", "internazionale", "intermilan"],
    ["milan", "acmilan"],
    ["roma", "asroma"],
    ["lazio", "sslazio"],
    ["juventus", "juve"],
    ["napoli", "sscnapoli"]
  ];
  return aliases.some(group => group.includes(a) && group.includes(b));
}

function findEspnEvent(events, id, homeName, awayName) {
  if (id) {
    const byId = events.find(item => String(item?.id) === String(id));
    if (byId) return byId;
  }
  if (!homeName || !awayName) return null;
  return events.find(item => {
    const comp = item?.competitions?.[0] || {};
    const competitors = comp.competitors || [];
    const home = competitors.find(team => team.homeAway === "home") || competitors[0] || {};
    const away = competitors.find(team => team.homeAway === "away") || competitors[1] || {};
    const h = home?.team?.displayName || home?.team?.name || home?.displayName || home?.name;
    const a = away?.team?.displayName || away?.team?.name || away?.displayName || away?.name;
    return teamQueryMatches(h, homeName) && teamQueryMatches(a, awayName);
  }) || null;
}

function normalizeEspnDetail(summary, scoreboardEvent, leagueName) {
  const headerCompetition = summary?.header?.competitions?.[0] || null;
  const rawEvent = headerCompetition
    ? { ...(scoreboardEvent || {}), id: summary.header.id || scoreboardEvent?.id, date: headerCompetition.date || scoreboardEvent?.date, competitions: [headerCompetition], leagueName }
    : scoreboardEvent;
  const fixture = normalizeEspnFixture(rawEvent, leagueName);
  const eventRows = summary?.keyEvents || summary?.plays?.items || summary?.plays || [];
  const statsRows = summary?.boxscore?.teams || summary?.boxscore?.statistics || [];
  return {
    fixture,
    events: normalizeEspnEvents(eventRows),
    statistics: normalizeEspnStatistics(statsRows),
    lineups: [],
    updatedAt: new Date().toISOString()
  };
}

async function fetchEspnEvent(competition, fixtureId, date, home, away, source) {
  const leagueName = competition === "champions-league" ? "UEFA Champions League" : competition === "europa-league" ? "UEFA Europa League" : "Italian Serie A";
  if (source === "espn" && fixtureId) {
    try {
      const url = ESPN_BASE + ESPN_LEAGUES[competition] + "/summary?event=" + encodeURIComponent(fixtureId);
      const summary = await publicJson(url, 60);
      const detail = normalizeEspnDetail(summary, null, leagueName);
      if (detail.fixture?.id) return { ...detail, fixture: { ...detail.fixture, id: String(fixtureId) } };
    } catch { /* Fall back to the public scoreboard snapshot. */ }
  }
  const payload = await publicJson(espnUrl(competition, date), 60);
  const event = findEspnEvent(payload.events || [], source === "espn" ? fixtureId : null, home, away);
  if (!event) throw new Error("La fonte pubblica non ha trovato questa partita nel giorno indicato.");
  let summary = {};
  try {
    summary = await publicJson(ESPN_BASE + ESPN_LEAGUES[competition] + "/summary?event=" + encodeURIComponent(event.id), 60);
  } catch { /* A scoreboard-only detail is still useful and correctly marked as limited. */ }
  const detail = normalizeEspnDetail(summary, { ...event, leagueName }, leagueName);
  return { ...detail, fixture: { ...detail.fixture, id: String(event.id) } };
}

async function espnFallback(competition, requestUrl, reason, configured) {
  const fixtureId = requestUrl.searchParams.get("fixture");
  const source = requestUrl.searchParams.get("source") || "";
  if (fixtureId) {
    const detail = await fetchEspnEvent(
      competition,
      fixtureId,
      requestUrl.searchParams.get("date"),
      requestUrl.searchParams.get("home"),
      requestUrl.searchParams.get("away"),
      source
    );
    return json({
      configured,
      fallback: true,
      source: "ESPN",
      sourceLabel: "ESPN · fonte pubblica senza API key",
      fallbackReason: reason || null,
      updatedAt: detail.updatedAt,
      fixture: detail.fixture,
      events: detail.events || [],
      statistics: detail.statistics || [],
      lineups: detail.lineups || [],
      notes: {
        coverage: "ESPN è una fonte pubblica alternativa; cronologia eventi, statistiche e formazioni dipendono dalla copertura della singola partita.",
        field: "Il campo è una simulazione tattica illustrativa, non tracking GPS o posizioni live dei calciatori."
      }
    });
  }
  const payload = await publicJson(espnUrl(competition), 60);
  const leagueName = competition === "champions-league" ? "UEFA Champions League" : "Italian Serie A";
  const matches = (payload.events || []).map(event => normalizeEspnFixture({ ...event, leagueName }, leagueName))
    .filter(match => ["1H", "HT", "2H", "ET"].includes(match.status) && match.id)
    .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  return json({
    configured,
    fallback: true,
    source: "ESPN",
    sourceLabel: "ESPN · fonte pubblica senza API key",
    fallbackReason: reason || null,
    competition,
    updatedAt: new Date().toISOString(),
    matches,
    note: "Risultati live pubblici ESPN. La copertura e la frequenza di aggiornamento possono variare; le statistiche e le formazioni non sono garantite."
  });
}

export async function onRequestGet(context) {
  const key = providerKey(context);
  const requestUrl = new URL(context.request.url);
  const competition = LEAGUES[requestUrl.searchParams.get("competition")] ? requestUrl.searchParams.get("competition") : "serie-a";
  const fixtureId = requestUrl.searchParams.get("fixture");
  const source = requestUrl.searchParams.get("source") || "";
  if (source === "espn" || !key) {
    try {
      return await espnFallback(competition, requestUrl, key ? null : "API_FOOTBALL_KEY non configurata", Boolean(key));
    } catch (error) {
      return json({
        configured: Boolean(key),
        source: "none",
        error: "Fonte live senza chiave non disponibile: " + (error instanceof Error ? error.message : "errore di rete"),
        fallback: false
      }, 503);
    }
  }

  try {
    if (fixtureId) {
      if (!/^\d{1,12}$/.test(fixtureId)) return json({ configured: true, error: "Identificativo partita non valido." }, 400);
      // One API-Football request returns fixture, events, lineups and statistics.
      const fixturePayload = await providerGet("fixtures", { id: fixtureId, timezone: "Europe/Rome" }, context, 300);
      const rawFixture = Array.isArray(fixturePayload.response) ? fixturePayload.response[0] : null;
      if (!rawFixture) throw new Error("Partita non trovata nel provider API-Football.");
      return json({
        configured: true,
        source: "API-Football",
        sourceLabel: "API-Football",
        fallback: false,
        updatedAt: new Date().toISOString(),
        fixture: normalizeFixture(rawFixture),
        events: normalizeEvents(rawFixture.events),
        statistics: normalizeStatistics(rawFixture.statistics),
        lineups: normalizeLineups(rawFixture.lineups),
        notes: {
          events: "Cronologia degli eventi restituiti dal provider.",
          lineups: "Formazione iniziale e griglia tattica quando coperte dal provider.",
          field: "Le coordinate di formazione sono posizioni iniziali schematiche; non sono tracking GPS o posizioni live dei calciatori."
        }
      });
    }

    const payload = await providerGet("fixtures", { live: String(LEAGUES[competition]), timezone: "Europe/Rome" }, context, 300);
    const matches = (Array.isArray(payload.response) ? payload.response : []).map(normalizeFixture)
      .filter(item => Number.isFinite(item.id))
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    if (!matches.length) {
      try {
        const alternative = await espnFallback(competition, requestUrl, null, true);
        const body = await alternative.json();
        if (body.matches?.length) return json(body);
      } catch { /* Keep a valid empty result from the primary provider. */ }
    }
    return json({ configured: true, source: "API-Football", sourceLabel: "API-Football", fallback: false, competition, updatedAt: new Date().toISOString(), matches });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Errore durante il recupero dei dati live.";
    try {
      return await espnFallback(competition, requestUrl, "API-Football: " + reason, true);
    } catch (fallbackError) {
      return json({
        configured: true,
        source: "none",
        fallback: false,
        error: "API-Football non disponibile (" + reason + "). Anche ESPN non ha risposto: " + (fallbackError instanceof Error ? fallbackError.message : "errore di rete")
      }, 502);
    }
  }
}
