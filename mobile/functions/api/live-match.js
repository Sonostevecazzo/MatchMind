const API_BASE = "https://v3.football.api-sports.io";
const LEAGUES = { "serie-a": 135, "champions-league": 2 };

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

export async function onRequestGet(context) {
  const key = providerKey(context);
  if (!key) return json({
    configured: false,
    code: "missing_api_football_key",
    error: "Live non configurato. Aggiungi API_FOOTBALL_KEY tra i secret di Cloudflare Pages."
  }, 503);

  const requestUrl = new URL(context.request.url);
  const competition = LEAGUES[requestUrl.searchParams.get("competition")] ? requestUrl.searchParams.get("competition") : "serie-a";
  const fixtureId = requestUrl.searchParams.get("fixture");
  try {
    if (fixtureId) {
      if (!/^\d{1,12}$/.test(fixtureId)) return json({ configured: true, error: "Identificativo partita non valido." }, 400);
      // API-Football returns the fixture, events, lineups, statistics and player stats
      // together from /fixtures?id=..., avoiding three separate quota-consuming calls.
      const fixturePayload = await providerGet("fixtures", { id: fixtureId, timezone: "Europe/Rome" }, context, 300);
      const rawFixture = Array.isArray(fixturePayload.response) ? fixturePayload.response[0] : null;
      if (!rawFixture) return json({ configured: true, fixture: null, error: "Partita non trovata nel provider live." }, 404);
      return json({
        configured: true,
        source: "API-Football",
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
    return json({ configured: true, source: "API-Football", competition, updatedAt: new Date().toISOString(), matches });
  } catch (error) {
    return json({
      configured: true,
      error: error instanceof Error ? error.message : "Errore durante il recupero dei dati live."
    }, 502);
  }
}
