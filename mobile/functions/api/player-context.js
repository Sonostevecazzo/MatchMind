const API_BASE = "https://v3.football.api-sports.io";
const SERIE_A_ID = 135;
const CACHE_ROOT = "/__matchmind_internal_cache/";

function responseJson(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function currentSeason(now = new Date()) {
  const year = now.getUTCFullYear();
  return now.getUTCMonth() >= 6 ? year : year - 1;
}

function hasProviderErrors(errors) {
  if (Array.isArray(errors)) return errors.length > 0;
  if (errors && typeof errors === "object") return Object.keys(errors).length > 0;
  return Boolean(errors);
}

async function providerGet(path, params, context, ttlSeconds) {
  const providerUrl = new URL(path, API_BASE + "/");
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value) !== "") {
      providerUrl.searchParams.set(key, String(value));
    }
  }

  let cache;
  let cacheKey;
  try {
    cache = caches.default;
    const requestUrl = new URL(context.request.url);
    const keyUrl = new URL(CACHE_ROOT + encodeURIComponent(path), requestUrl.origin);
    keyUrl.search = providerUrl.search;
    cacheKey = new Request(keyUrl.toString(), { method: "GET" });
    const cached = await cache.match(cacheKey);
    if (cached) return await cached.json();
  } catch {
    cache = null;
    cacheKey = null;
  }

  let response;
  try {
    response = await fetch(providerUrl.toString(), {
      method: "GET",
      headers: { "x-apisports-key": context.env.API_FOOTBALL_KEY },
      signal: AbortSignal.timeout(12000)
    });
  } catch {
    throw new Error("provider_unreachable");
  }

  if (!response.ok) {
    if (response.status === 429) throw new Error("provider_rate_limited");
    throw new Error("provider_http_error");
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error("provider_invalid_json");
  }
  if (hasProviderErrors(payload.errors)) {
    const errorText = JSON.stringify(payload.errors).toLowerCase();
    if (errorText.includes("rate limit") || errorText.includes("too many requests")) {
      throw new Error("provider_rate_limited");
    }
    if (errorText.includes("invalid api key") || errorText.includes("unauthorized")) {
      throw new Error("provider_invalid_key");
    }
    throw new Error("provider_rejected_request");
  }

  if (cache && cacheKey && payload && typeof payload === "object") {
    try {
      await cache.put(cacheKey, new Response(JSON.stringify(payload), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=" + ttlSeconds
        }
      }));
    } catch {
      // Caching is an optimization; a valid provider response remains usable without it.
    }
  }
  return payload;
}

function normalizeStats(playerItem) {
  const player = playerItem && playerItem.player ? playerItem.player : {};
  const statsList = Array.isArray(playerItem && playerItem.statistics) ? playerItem.statistics : [];
  const stats = statsList.find(item => Number(item && item.league && item.league.id) === SERIE_A_ID) || statsList[0] || {};
  const games = stats.games || {};
  const goals = stats.goals || {};
  const shots = stats.shots || {};
  const passes = stats.passes || {};
  return {
    id: player.id == null ? null : Number(player.id),
    name: player.name || "Giocatore non identificato",
    age: player.age == null ? null : player.age,
    nationality: player.nationality || null,
    photo: player.photo || null,
    team: {
      id: stats.team && stats.team.id != null ? Number(stats.team.id) : null,
      name: stats.team && stats.team.name ? stats.team.name : "Squadra non disponibile"
    },
    position: games.position || null,
    season: {
      appearances: games.appearences == null ? (games.appearances == null ? 0 : Number(games.appearances)) : Number(games.appearences),
      starts: Number(games.lineups || 0),
      minutes: Number(games.minutes || 0),
      rating: games.rating == null || games.rating === "" ? null : Number(games.rating),
      goals: Number(goals.total || 0),
      assists: Number(goals.assists || 0),
      shots: Number(shots.total || 0),
      keyPasses: Number(passes.key || 0)
    }
  };
}

function isoDate(value) {
  if (!value) return "";
  const text = String(value);
  return text.length >= 10 ? text.slice(0, 10) : "";
}

function addDays(date, count) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + count);
  return result.toISOString().slice(0, 10);
}

function normalizeInjuries(payload, now = new Date()) {
  const start = now.toISOString().slice(0, 10);
  const end = addDays(now, 14);
  const unique = new Map();
  const records = Array.isArray(payload && payload.response) ? payload.response : [];
  for (const item of records) {
    const date = isoDate(item && item.fixture && item.fixture.date);
    if (!date || date < start || date > end) continue;
    const player = item.player || {};
    const team = item.team || {};
    const id = player.id == null ? (player.name || "unknown") : String(player.id);
    const key = String(team.id || team.name || "unknown") + "|" + id;
    const record = {
      playerId: player.id == null ? null : Number(player.id),
      name: player.name || "Giocatore non identificato",
      team: team.name || "Squadra non disponibile",
      status: player.type || item.status || "Indisponibile",
      reason: player.reason || item.reason || "",
      fixtureDate: date,
      fixtureId: item.fixture && item.fixture.id != null ? Number(item.fixture.id) : null
    };
    const previous = unique.get(key);
    if (!previous || record.fixtureDate < previous.fixtureDate) unique.set(key, record);
  }
  return Array.from(unique.values()).sort((a, b) => a.fixtureDate.localeCompare(b.fixtureDate));
}

function errorStatus(error) {
  if (error.message === "provider_invalid_key") return 502;
  if (error.message === "provider_rate_limited") return 429;
  if (error.message === "provider_unreachable") return 503;
  return 502;
}

function publicError(error) {
  const messages = {
    provider_invalid_key: "La chiave API-Football non è valida. Controlla il secret API_FOOTBALL_KEY su Cloudflare.",
    provider_rate_limited: "Limite API raggiunto. Il piano gratuito consente 100 richieste al giorno; riprova dopo il ripristino della quota.",
    provider_unreachable: "Il servizio dati non è raggiungibile in questo momento.",
    provider_http_error: "Il servizio dati ha restituito un errore.",
    provider_invalid_json: "Il servizio dati ha restituito una risposta non leggibile.",
    provider_rejected_request: "Il servizio dati ha rifiutato la richiesta. Verifica la copertura della Serie A e la chiave API."
  };
  return messages[error.message] || "Errore temporaneo durante il recupero dei dati.";
}

async function getInjuries(context, season) {
  const payload = await providerGet("injuries", { league: SERIE_A_ID, season }, context, 4 * 60 * 60);
  return responseJson({
    configured: true,
    type: "injuries",
    source: "API-Football",
    season,
    lookaheadDays: 14,
    updatedAt: new Date().toISOString(),
    injuries: normalizeInjuries(payload)
  });
}

async function searchPlayers(context, season, search) {
  if (search.length < 4) {
    return responseJson({ configured: true, type: "search", error: "Inserisci almeno 4 caratteri per cercare un giocatore." }, 400);
  }
  const payload = await providerGet("players", { league: SERIE_A_ID, season, search, page: 1 }, context, 6 * 60 * 60);
  const records = Array.isArray(payload && payload.response) ? payload.response : [];
  const candidates = records.map(normalizeStats).filter(player => player.id != null);
  const normalizedSearch = search.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  candidates.sort((a, b) => {
    const aExact = a.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === normalizedSearch ? 0 : 1;
    const bExact = b.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === normalizedSearch ? 0 : 1;
    return aExact - bExact || b.season.appearances - a.season.appearances;
  });
  return responseJson({
    configured: true,
    type: "search",
    source: "API-Football",
    season,
    updatedAt: new Date().toISOString(),
    players: candidates.slice(0, 8)
  });
}

function matchPlayerStats(fixturePayload, playerId) {
  const teams = Array.isArray(fixturePayload && fixturePayload.response) ? fixturePayload.response : [];
  for (const team of teams) {
    const players = Array.isArray(team && team.players) ? team.players : [];
    const found = players.find(row => String(row && row.player && row.player.id) === String(playerId));
    if (found) return found;
  }
  return null;
}

async function playerRecentForm(context, season, playerId, teamId) {
  const fixturesPayload = await providerGet("fixtures", {
    team: teamId,
    last: 10,
    season,
    timezone: "Europe/Rome"
  }, context, 6 * 60 * 60);
  const fixtures = (Array.isArray(fixturesPayload && fixturesPayload.response) ? fixturesPayload.response : [])
    .filter(item => item && item.fixture && item.fixture.id != null && ["FT", "AET", "PEN"].includes(String(item.fixture.status && item.fixture.status.short || "")))
    .sort((a, b) => Number(b.fixture.timestamp || 0) - Number(a.fixture.timestamp || 0));

  const appearances = [];
  for (const fixture of fixtures) {
    if (appearances.length >= 5) break;
    const payload = await providerGet("fixtures/players", { fixture: fixture.fixture.id }, context, 6 * 60 * 60);
    const row = matchPlayerStats(payload, playerId);
    if (!row || !Array.isArray(row.statistics) || !row.statistics.length) continue;
    const stat = row.statistics[0] || {};
    const games = stat.games || {};
    const goals = stat.goals || {};
    const shots = stat.shots || {};
    const passes = stat.passes || {};
    const minutes = Number(games.minutes || 0);
    if (minutes <= 0) continue;

    const home = fixture.teams && fixture.teams.home ? fixture.teams.home : {};
    const away = fixture.teams && fixture.teams.away ? fixture.teams.away : {};
    const teamIsHome = String(home.id) === String(teamId);
    const opponent = teamIsHome ? away.name : home.name;
    const homeGoals = fixture.goals ? fixture.goals.home : null;
    const awayGoals = fixture.goals ? fixture.goals.away : null;
    appearances.push({
      date: isoDate(fixture.fixture.date),
      opponent: opponent || "Avversario non disponibile",
      venue: teamIsHome ? "Casa" : "Trasferta",
      score: homeGoals == null || awayGoals == null ? "—" : String(homeGoals) + "–" + String(awayGoals),
      minutes,
      goals: Number(goals.total || 0),
      assists: Number(goals.assists || 0),
      shots: Number(shots.total || 0),
      keyPasses: Number(passes.key || 0),
      rating: games.rating == null || games.rating === "" ? null : Number(games.rating)
    });
  }

  const rated = appearances.filter(item => Number.isFinite(item.rating));
  const totalGoals = appearances.reduce((sum, item) => sum + item.goals, 0);
  const totalAssists = appearances.reduce((sum, item) => sum + item.assists, 0);
  const totalMinutes = appearances.reduce((sum, item) => sum + item.minutes, 0);
  return {
    playerId: Number(playerId),
    teamId: Number(teamId),
    season,
    appearances,
    summary: {
      appearances: appearances.length,
      minutes: totalMinutes,
      goals: totalGoals,
      assists: totalAssists,
      averageRating: rated.length ? rated.reduce((sum, item) => sum + item.rating, 0) / rated.length : null
    },
    updatedAt: new Date().toISOString()
  };
}

async function getPlayerForm(context, season, requestUrl) {
  const playerId = requestUrl.searchParams.get("player");
  const teamId = requestUrl.searchParams.get("team");
  if (!/^\d{1,10}$/.test(playerId || "") || !/^\d{1,10}$/.test(teamId || "")) {
    return responseJson({ configured: true, type: "form", error: "Seleziona un giocatore valido dai risultati della ricerca." }, 400);
  }
  const data = await playerRecentForm(context, season, playerId, teamId);
  return responseJson({ configured: true, type: "form", source: "API-Football", ...data });
}

export async function onRequestGet(context) {
  const requestUrl = new URL(context.request.url);
  const key = context.env && context.env.API_FOOTBALL_KEY;
  if (!key) {
    return responseJson({
      configured: false,
      error: "API_FOOTBALL_KEY non configurata. Aggiungi la chiave come secret su Cloudflare Pages per attivare infortuni e forma giocatori."
    });
  }

  const season = currentSeason();
  const type = requestUrl.searchParams.get("type") || "";
  try {
    if (type === "injuries") return await getInjuries(context, season);
    if (type === "search") return await searchPlayers(context, season, (requestUrl.searchParams.get("q") || "").trim());
    if (type === "form") return await getPlayerForm(context, season, requestUrl);
    return responseJson({ configured: true, error: "Tipo richiesta non supportato." }, 400);
  } catch (error) {
    return responseJson({
      configured: true,
      error: publicError(error),
      retryable: ["provider_rate_limited", "provider_unreachable", "provider_http_error"].includes(error.message)
    }, errorStatus(error));
  }
}
