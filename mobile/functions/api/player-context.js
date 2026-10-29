const API_BASE = "https://v3.football.api-sports.io";
const ODDS_API_BASE = "https://api.the-odds-api.com/v4";
const FOOTBALL_DATA_BASE = "https://api.football-data.org/v4";
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
    payload = response.status === 204 ? { response: [], errors: [] } : await response.json();
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

async function cachedExternalJson(context, providerName, url, cacheId, headers, ttlSeconds) {
  let cache;
  let cacheKey;
  try {
    cache = caches.default;
    const requestUrl = new URL(context.request.url);
    cacheKey = new Request(new URL(CACHE_ROOT + encodeURIComponent(cacheId), requestUrl.origin).toString());
    const cached = await cache.match(cacheKey);
    if (cached) return await cached.json();
  } catch {
    cache = null;
    cacheKey = null;
  }

  let response;
  try {
    response = await fetch(url, { method: "GET", headers, signal: AbortSignal.timeout(12000) });
  } catch {
    throw new Error(providerName + "_unreachable");
  }
  if (!response.ok) {
    let errorText = "";
    try { errorText = (await response.clone().text()).toUpperCase(); } catch { /* use the HTTP status below */ }
    if (providerName === "odds" && errorText.includes("OUT_OF_USAGE_CREDITS")) throw new Error("odds_quota_exceeded");
    if (errorText.includes("INVALID_KEY") || errorText.includes("DEACTIVATED_KEY")) throw new Error(providerName + "_invalid_key");
    if (response.status === 429) throw new Error(providerName + "_rate_limited");
    if (providerName === "odds" && response.status === 402) throw new Error("odds_quota_exceeded");
    if (response.status === 401 || response.status === 403) throw new Error(providerName + "_invalid_key");
    throw new Error(providerName + "_http_error");
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(providerName + "_invalid_json");
  }
  if (cache && cacheKey) {
    try {
      await cache.put(cacheKey, new Response(JSON.stringify(payload), {
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=" + ttlSeconds }
      }));
    } catch {
      // A valid provider response remains usable when edge caching is unavailable.
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
      teamId: team.id == null ? null : Number(team.id),
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
  if (error.message.endsWith("_invalid_key")) return 502;
  if (error.message.endsWith("_rate_limited") || error.message === "odds_quota_exceeded") return 429;
  if (error.message.endsWith("_unreachable")) return 503;
  return 502;
}

function publicError(error) {
  const messages = {
    provider_invalid_key: "La chiave API-Football non è valida. Controlla il secret API_FOOTBALL_KEY su Cloudflare.",
    provider_rate_limited: "Limite API raggiunto. Il piano gratuito consente 100 richieste al giorno; riprova dopo il ripristino della quota.",
    provider_unreachable: "Il servizio dati non è raggiungibile in questo momento.",
    provider_http_error: "Il servizio dati ha restituito un errore.",
    provider_invalid_json: "Il servizio dati ha restituito una risposta non leggibile.",
    provider_rejected_request: "Il servizio dati ha rifiutato la richiesta. Verifica la copertura della Serie A e la chiave API.",
    odds_invalid_key: "La chiave The Odds API non è valida. Controlla il secret THE_ODDS_API_KEY su Cloudflare.",
    odds_rate_limited: "The Odds API ha limitato le richieste. Riprova più tardi.",
    odds_quota_exceeded: "Crediti mensili The Odds API esauriti. La quota si rinnova secondo il piano del provider.",
    odds_unreachable: "The Odds API non è raggiungibile in questo momento.",
    odds_http_error: "The Odds API ha restituito un errore.",
    odds_invalid_json: "The Odds API ha restituito una risposta non leggibile.",
    football_data_invalid_key: "Il token football-data.org non è valido. Controlla il secret FOOTBALL_DATA_API_KEY su Cloudflare.",
    football_data_rate_limited: "Limite football-data.org raggiunto. Il piano gratuito consente 10 richieste al minuto; riprova tra poco.",
    football_data_unreachable: "football-data.org non è raggiungibile in questo momento.",
    football_data_http_error: "football-data.org ha restituito un errore.",
    football_data_invalid_json: "football-data.org ha restituito una risposta non leggibile."
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


function normalizeTeamName(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

const TEAM_NAME_GROUPS = [
  ["inter", "internazionale", "intermilan"],
  ["milan", "acmilan"],
  ["verona", "hellasverona"],
  ["roma", "asroma"],
  ["lazio", "sslazio"],
  ["juventus", "juve"],
  ["napoli", "sscnapoli"],
  ["fiorentina", "acffiorentina"],
  ["sassuolo", "ussassuolo"],
  ["cagliari", "cagliaricalcio"],
  ["udinese", "udinesecalcio"],
  ["torino", "torinofc"],
  ["genoa", "genoacfc"],
  ["parma", "parmacalcio"],
  ["lecce", "uslecce"],
  ["pisa", "pisasc"]
];

function sameTeamName(left, right) {
  const a = normalizeTeamName(left);
  const b = normalizeTeamName(right);
  if (!a || !b) return false;
  if (a === b || (Math.min(a.length, b.length) >= 5 && (a.includes(b) || b.includes(a)))) return true;
  return TEAM_NAME_GROUPS.some(group => group.includes(a) && group.includes(b));
}

function oddsEventsCacheKey() {
  return "the-odds-api/serie-a/eu/h2h-totals";
}

async function getOddsEvents(context) {
  const key = context.env && context.env.THE_ODDS_API_KEY;
  if (!key) return { configured: false, events: [], error: "THE_ODDS_API_KEY non configurata." };
  const url = new URL(ODDS_API_BASE + "/sports/soccer_italy_serie_a/odds/");
  url.searchParams.set("apiKey", key);
  url.searchParams.set("regions", "eu");
  url.searchParams.set("markets", "h2h,totals");
  url.searchParams.set("oddsFormat", "decimal");
  url.searchParams.set("dateFormat", "iso");
  const events = await cachedExternalJson(context, "odds", url.toString(), oddsEventsCacheKey(), {}, 90 * 60);
  return { configured: true, events: Array.isArray(events) ? events : [] };
}

function localDateTime(utcDate) {
  const date = new Date(utcDate);
  if (!Number.isFinite(date.getTime())) return { date: "", time: "" };
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(date);
  const part = name => (parts.find(item => item.type === name) || {}).value || "";
  return { date: part("year") + "-" + part("month") + "-" + part("day"), time: part("hour") + ":" + part("minute") };
}

function findOddsEvent(events, date, home, away) {
  return events.find(event => {
    const kickoff = localDateTime(event && event.commence_time);
    return kickoff.date === date && sameTeamName(home, event && event.home_team) && sameTeamName(away, event && event.away_team);
  }) || null;
}

function normalizeOddsBookmakers(event) {
  const bookmakers = Array.isArray(event && event.bookmakers) ? event.bookmakers : [];
  return bookmakers.map(bookmaker => {
    const bets = [];
    for (const market of Array.isArray(bookmaker && bookmaker.markets) ? bookmaker.markets : []) {
      const outcomes = Array.isArray(market && market.outcomes) ? market.outcomes : [];
      if (market.key === "h2h") {
        bets.push({
          name: "Match Winner",
          values: outcomes.map(outcome => {
            const name = outcome.name || "";
            const value = normalizeTeamName(name) === "draw" || normalizeTeamName(name) === "tie"
              ? "Draw"
              : (sameTeamName(name, event.home_team) ? "Home" : (sameTeamName(name, event.away_team) ? "Away" : name));
            return { value, odd: outcome.price };
          })
        });
      } else if (market.key === "totals") {
        bets.push({
          name: "Goals Over/Under",
          values: outcomes.map(outcome => ({
            value: outcome.name + (outcome.point == null ? "" : " " + outcome.point),
            handicap: outcome.point == null ? "" : String(outcome.point),
            odd: outcome.price
          }))
        });
      }
    }
    return { name: bookmaker.title || bookmaker.key || "Bookmaker", bets };
  }).filter(bookmaker => bookmaker.bets.length);
}

function oddsEventUpdatedAt(event) {
  const updates = (Array.isArray(event && event.bookmakers) ? event.bookmakers : [])
    .flatMap(bookmaker => Array.isArray(bookmaker && bookmaker.markets) ? bookmaker.markets : [])
    .map(market => market && market.last_update)
    .filter(value => typeof value === "string" && Number.isFinite(Date.parse(value)));
  return updates.sort().at(-1) || null;
}

async function getFootballDataFixtures(context, season) {
  const key = context.env && context.env.FOOTBALL_DATA_API_KEY;
  if (!key) {
    return responseJson({
      configured: false,
      type: "fixtures",
      error: "FOOTBALL_DATA_API_KEY non configurata. Aggiungi il token football-data.org come secret su Cloudflare Pages."
    });
  }
  const url = new URL(FOOTBALL_DATA_BASE + "/competitions/SA/matches");
  url.searchParams.set("season", String(season));
  const payload = await cachedExternalJson(context, "football_data", url.toString(), "football-data/serie-a/" + season, { "X-Auth-Token": key }, 6 * 60 * 60);
  const sourceMatches = Array.isArray(payload && payload.matches) ? payload.matches : [];
  const matches = sourceMatches.filter(item => item && item.homeTeam && item.awayTeam && item.utcDate)
    .map(item => {
      const kickoff = localDateTime(item.utcDate);
      const fullTime = item.score && item.score.fullTime || {};
      return {
        date: kickoff.date,
        time: kickoff.time,
        round: item.matchday == null ? null : Number(item.matchday),
        home: item.homeTeam.name || item.homeTeam.shortName || "",
        away: item.awayTeam.name || item.awayTeam.shortName || "",
        hg: fullTime.home == null ? null : Number(fullTime.home),
        ag: fullTime.away == null ? null : Number(fullTime.away),
        hs: null,
        as: null,
        ht: null,
        at: null,
        source: "football-data.org",
        oddsH: null,
        oddsD: null,
        oddsA: null
      };
    });
  return responseJson({ configured: true, type: "fixtures", source: "football-data.org", season, updatedAt: new Date().toISOString(), matches });
}

function hasAbsenceStatus(item) {
  const value = String(item && item.status || "").toLowerCase();
  return value.includes("missing") || value.includes("questionable") || value.includes("suspend") || value.includes("injur");
}

async function getMatchContext(context, season, requestUrl) {
  const date = requestUrl.searchParams.get("date") || "";
  const home = (requestUrl.searchParams.get("home") || "").trim();
  const away = (requestUrl.searchParams.get("away") || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !home || !away || home.length > 80 || away.length > 80) {
    return responseJson({ configured: true, type: "match", error: "Partita o data non validi." }, 400);
  }

  const today = new Date().toISOString().slice(0, 10);
  const latest = addDays(new Date(today + "T00:00:00.000Z"), 14);
  if (date < today || date > latest) {
    return responseJson({ configured: true, type: "match", error: "I dati prematch sono richiesti solo per le partite dei prossimi 14 giorni." }, 400);
  }

  const apiFootballKey = context.env && context.env.API_FOOTBALL_KEY;
  const oddsApiKey = context.env && context.env.THE_ODDS_API_KEY;
  const [fixtureLookup, oddsLookup] = await Promise.allSettled([
    apiFootballKey ? providerGet("fixtures", { league: SERIE_A_ID, season, date, timezone: "Europe/Rome" }, context, 12 * 60 * 60) : Promise.resolve(null),
    oddsApiKey ? getOddsEvents(context) : Promise.resolve({ configured: false, events: [] })
  ]);
  const fixturePayload = fixtureLookup.status === "fulfilled" ? fixtureLookup.value : null;
  const fixtures = Array.isArray(fixturePayload && fixturePayload.response) ? fixturePayload.response : [];
  const fixture = fixtures.find(item => {
    const teams = item && item.teams || {};
    return sameTeamName(home, teams.home && teams.home.name) && sameTeamName(away, teams.away && teams.away.name);
  }) || null;
  const oddsData = oddsLookup.status === "fulfilled" ? oddsLookup.value : null;
  const oddsEvent = findOddsEvent(oddsData && oddsData.events || [], date, home, away);
  const fixtureId = fixture && fixture.fixture && fixture.fixture.id != null ? Number(fixture.fixture.id) : null;

  let injuryResult = null;
  let apiFootballOddsResult = null;
  if (fixtureId != null) {
    const results = await Promise.allSettled([
      providerGet("injuries", { fixture: fixtureId }, context, 4 * 60 * 60),
      oddsApiKey && oddsEvent ? Promise.resolve(null) : providerGet("odds", { fixture: fixtureId }, context, 3 * 60 * 60)
    ]);
    injuryResult = results[0];
    apiFootballOddsResult = results[1];
  }

  let injuries = injuryResult && injuryResult.status === "fulfilled" ? normalizeInjuries(injuryResult.value) : [];
  const actionable = injuries.filter(hasAbsenceStatus);
  const selected = actionable.slice(0, 4);
  let injuryStatsComplete = Boolean(injuryResult && injuryResult.status === "fulfilled") && actionable.length <= selected.length && selected.every(item => item.playerId != null);
  const statResults = injuryResult && injuryResult.status === "fulfilled"
    ? await Promise.allSettled(selected.map(item => providerGet("players", { id: item.playerId, league: SERIE_A_ID, season }, context, 12 * 60 * 60)))
    : [];

  const statsByPlayer = new Map();
  statResults.forEach((result, index) => {
    if (result.status !== "fulfilled") {
      injuryStatsComplete = false;
      return;
    }
    const rows = Array.isArray(result.value && result.value.response) ? result.value.response : [];
    if (!rows.length) {
      injuryStatsComplete = false;
      return;
    }
    statsByPlayer.set(String(selected[index].playerId), normalizeStats(rows[0]));
  });

  injuries = injuries.map(item => ({
    ...item,
    playerStats: item.playerId == null ? null : (statsByPlayer.get(String(item.playerId)) || null)
  }));
  if (actionable.some(item => !statsByPlayer.has(String(item.playerId)))) injuryStatsComplete = false;

  const apiFootballOddsPayload = apiFootballOddsResult && apiFootballOddsResult.status === "fulfilled" ? apiFootballOddsResult.value : null;
  const oddsRecord = Array.isArray(apiFootballOddsPayload && apiFootballOddsPayload.response) ? apiFootballOddsPayload.response[0] : null;
  const oddsApiBookmakers = oddsEvent ? normalizeOddsBookmakers(oddsEvent) : [];
  const bookmakers = oddsApiBookmakers.length ? oddsApiBookmakers : (Array.isArray(oddsRecord && oddsRecord.bookmakers) ? oddsRecord.bookmakers : []);
  const oddsAvailable = bookmakers.length > 0;
  const oddsSource = oddsApiBookmakers.length ? "The Odds API" : (bookmakers.length ? "API-Football" : null);
  const fixtureFound = Boolean(fixtureId != null || oddsEvent);
  const injuryError = injuryResult && injuryResult.status === "rejected"
    ? publicError(injuryResult.reason)
    : (!apiFootballKey
      ? "API_FOOTBALL_KEY non configurata: indisponibili e statistiche giocatore non disponibili."
      : (fixtureLookup.status === "rejected" ? publicError(fixtureLookup.reason) : (!fixtureId ? "La partita non è stata trovata da API-Football per recuperare le assenze." : null)));
  const oddsError = oddsAvailable ? null : (oddsLookup.status === "rejected"
    ? publicError(oddsLookup.reason)
    : (apiFootballOddsResult && apiFootballOddsResult.status === "rejected" ? publicError(apiFootballOddsResult.reason)
      : (!oddsApiKey && !apiFootballKey ? "Aggiungi THE_ODDS_API_KEY per le quote internazionali oppure API_FOOTBALL_KEY." : "Quote prematch non disponibili per questa partita.")));

  return responseJson({
    configured: true,
    type: "match",
    fixtureFound,
    fixtureId,
    homeTeamId: fixture && fixture.teams && fixture.teams.home ? Number(fixture.teams.home.id) : null,
    awayTeamId: fixture && fixture.teams && fixture.teams.away ? Number(fixture.teams.away.id) : null,
    season,
    source: oddsSource || (fixtureId != null ? "API-Football" : null),
    updatedAt: new Date().toISOString(),
    injuriesAvailable: Boolean(injuryResult && injuryResult.status === "fulfilled"),
    injuryError,
    injuryStatsComplete,
    injuries,
    oddsAvailable,
    oddsSource,
    oddsError,
    oddsUpdatedAt: oddsEvent ? oddsEventUpdatedAt(oddsEvent) : (oddsRecord && oddsRecord.update || null),
    bookmakers,
    message: !fixtureFound ? "Partita non trovata nelle fonti quote o API-Football per questa data." : null
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
  const env = context.env || {};
  const apiFootballConfigured = Boolean(env.API_FOOTBALL_KEY);
  const oddsApiConfigured = Boolean(env.THE_ODDS_API_KEY);
  const footballDataConfigured = Boolean(env.FOOTBALL_DATA_API_KEY);
  const season = currentSeason();
  const type = requestUrl.searchParams.get("type") || "";
  try {
    if (type === "status") return responseJson({
      configured: apiFootballConfigured || oddsApiConfigured || footballDataConfigured,
      type: "status",
      source: apiFootballConfigured ? "API-Football" : (oddsApiConfigured ? "The Odds API" : (footballDataConfigured ? "football-data.org" : null)),
      season,
      freePlanRequestsPerDay: apiFootballConfigured ? 100 : null,
      error: apiFootballConfigured || oddsApiConfigured || footballDataConfigured ? null : "API_FOOTBALL_KEY, THE_ODDS_API_KEY o FOOTBALL_DATA_API_KEY non configurata.",
      providers: {
        apiFootball: apiFootballConfigured,
        oddsApi: oddsApiConfigured,
        footballData: footballDataConfigured
      }
    });
    if (type === "fixtures") {
      const requestedSeason = Number(requestUrl.searchParams.get("season") || season);
      if (!Number.isInteger(requestedSeason) || requestedSeason < 1990 || requestedSeason > season + 1) {
        return responseJson({ configured: true, type: "fixtures", error: "Stagione non valida." }, 400);
      }
      return await getFootballDataFixtures(context, requestedSeason);
    }
    if (["injuries", "search", "form"].includes(type) && !apiFootballConfigured) {
      return responseJson({
        configured: false,
        error: "API_FOOTBALL_KEY non configurata. Aggiungi la chiave come secret su Cloudflare Pages per attivare indisponibili e dati giocatore."
      });
    }
    if (type === "injuries") return await getInjuries(context, season);
    if (type === "match") return await getMatchContext(context, season, requestUrl);
    if (type === "search") return await searchPlayers(context, season, (requestUrl.searchParams.get("q") || "").trim());
    if (type === "form") return await getPlayerForm(context, season, requestUrl);
    return responseJson({ configured: true, error: "Tipo richiesta non supportato." }, 400);
  } catch (error) {
    return responseJson({
      configured: true,
      error: publicError(error),
      retryable: error.message.endsWith("_rate_limited") || error.message.endsWith("_unreachable") || error.message.endsWith("_http_error") || error.message === "odds_quota_exceeded"
    }, errorStatus(error));
  }
}
