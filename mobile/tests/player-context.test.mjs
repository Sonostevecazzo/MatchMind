import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet } from "../functions/api/player-context.js";

function makeContext(url, env = {}) {
  return {
    request: new Request(url),
    env
  };
}

function apiResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

test("API route fails clearly and without leaking secrets when key is missing", async () => {
  const response = await onRequestGet(makeContext("https://matchmind.test/api/player-context?type=status"));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.configured, false);
  assert.match(body.error, /API_FOOTBALL_KEY/);
  assert.equal(body.error.includes("test-secret"), false);
});

test("status route reads quota-free API-Football usage without exposing account data", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (url, init) => {
    assert.equal(new URL(String(url)).pathname, "/status");
    assert.equal(init.headers["x-apisports-key"], "test-secret");
    return apiResponse({
      errors: [],
      response: {
        account: { firstname: "Private", email: "private@example.test" },
        subscription: { plan: "Free", active: true },
        requests: { current: 37, limit_day: 100 }
      }
    });
  };
  const response = await onRequestGet(makeContext("https://matchmind.test/api/player-context?type=status", { API_FOOTBALL_KEY: "test-secret" }));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.configured, true);
  assert.equal(body.source, "API-Football");
  assert.equal(body.freePlanRequestsPerDay, 100);
  assert.deepEqual({
    available: body.apiFootballUsage.available,
    current: body.apiFootballUsage.current,
    limitDay: body.apiFootballUsage.limitDay,
    remaining: body.apiFootballUsage.remaining,
    usedPercent: body.apiFootballUsage.usedPercent,
    plan: body.apiFootballUsage.plan,
    subscriptionActive: body.apiFootballUsage.subscriptionActive
  }, {
    available: true,
    current: 37,
    limitDay: 100,
    remaining: 63,
    usedPercent: 37,
    plan: "Free",
    subscriptionActive: true
  });
  assert.equal(JSON.stringify(body).includes("test-secret"), false);
  assert.equal(JSON.stringify(body).includes("private@example.test"), false);
  assert.equal(JSON.stringify(body).includes("Private"), false);
});

test("status reports each configured provider without exposing key values", async () => {
  const response = await onRequestGet(makeContext("https://matchmind.test/api/player-context?type=status", {
    ODDSPAPI_API_KEY: "odds-secret",
    FOOTBALL_DATA_API_KEY: "football-secret"
  }));
  const body = await response.json();
  assert.equal(body.configured, true);
  assert.deepEqual(body.providers, { apiFootball: false, sisalOdds: true, footballData: true });
  assert.equal(JSON.stringify(body).includes("secret"), false);
});

test("Sisal OddsPapi quotes work without API-Football and stay server-side", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const date = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  globalThis.fetch = async (url) => {
    const parsed = new URL(String(url));
    assert.equal(parsed.hostname, "api.oddspapi.io");
    assert.equal(parsed.searchParams.get("apiKey"), "odds-secret");
    if (parsed.pathname.endsWith("/fixtures")) {
      assert.equal(parsed.searchParams.get("bookmakers"), "sisal.it");
      return apiResponse([{
        fixtureId: "fixture-1", participant1Name: "Bologna", participant2Name: "Monza",
        startTime: date + "T12:00:00Z", updatedAt: "2026-10-29T10:00:00Z"
      }]);
    }
    if (parsed.pathname.endsWith("/markets")) return apiResponse([{
      marketId: "1", marketName: "Full Time Result", marketType: "1x2", period: "Full Time",
      outcomes: [
        { outcomeId: "1", outcomeName: "Bologna" },
        { outcomeId: "2", outcomeName: "Draw" },
        { outcomeId: "3", outcomeName: "Monza" }
      ]
    }]);
    if (parsed.pathname.endsWith("/odds")) {
      assert.equal(parsed.searchParams.get("bookmakers"), "sisal.it");
      return apiResponse({
        updatedAt: "2026-10-29T10:00:00Z",
        bookmakerOdds: { "sisal.it": { bookmakerIsActive: true, markets: { "1": {
          marketActive: true, outcomes: {
            "1": { players: { "0": { price: 1.8, active: true, bookmakerChangedAt: "2026-10-29T10:00:00Z" } } },
            "2": { players: { "0": { price: 3.5, active: true, bookmakerChangedAt: "2026-10-29T10:00:00Z" } } },
            "3": { players: { "0": { price: 4.5, active: true, bookmakerChangedAt: "2026-10-29T10:00:00Z" } } }
          }
        } } } }
      });
    }
    throw new Error("unexpected provider endpoint " + parsed.pathname);
  };

  const response = await onRequestGet(makeContext(
    "https://matchmind.test/api/player-context?type=match&date=" + date + "&home=Bologna&away=Monza",
    { ODDSPAPI_API_KEY: "odds-secret" }
  ));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.fixtureFound, true);
  assert.equal(body.oddsAvailable, true);
  assert.equal(body.oddsSource, "Sisal · OddsPapi");
  assert.equal(body.oddsUpdatedAt, "2026-10-29T10:00:00Z");
  assert.equal(body.injuriesAvailable, false);
  assert.equal(body.bookmakers[0].name, "Sisal");
  assert.deepEqual(body.bookmakers[0].bets[0].values.map(value => value.value), ["Home", "Draw", "Away"]);
  assert.equal(JSON.stringify(body).includes("odds-secret"), false);
});

test("Sisal quota errors are reported without leaking the key", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const date = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  globalThis.fetch = async () => apiResponse({ error: { code: "REQUEST_LIMIT_EXCEEDED" } }, 429);
  const response = await onRequestGet(makeContext(
    "https://matchmind.test/api/player-context?type=match&date=" + date + "&home=Bologna&away=Monza",
    { ODDSPAPI_API_KEY: "odds-secret" }
  ));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.match(body.oddsError, /quota mensile/i);
  assert.equal(JSON.stringify(body).includes("odds-secret"), false);
});

test("API-Football still supplies injuries without providing fallback quotes", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const date = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  globalThis.fetch = async (url, options) => {
    const parsed = new URL(String(url));
    assert.equal(options.headers["x-apisports-key"], "football-secret");
    if (parsed.pathname.endsWith("/fixtures")) {
      return apiResponse({ errors: [], response: [{
        fixture: { id: 123, date: date + "T12:00:00+00:00" },
        teams: { home: { id: 10, name: "Bologna" }, away: { id: 11, name: "Monza" } }
      }] });
    }
    if (parsed.pathname.endsWith("/injuries")) return apiResponse({ errors: [], response: [] });
    throw new Error("unexpected provider endpoint " + parsed.pathname);
  };

  const response = await onRequestGet(makeContext(
    "https://matchmind.test/api/player-context?type=match&date=" + date + "&home=Bologna&away=Monza",
    { API_FOOTBALL_KEY: "football-secret" }
  ));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.fixtureFound, true);
  assert.equal(body.homeTeamId, 10);
  assert.equal(body.awayTeamId, 11);
  assert.equal(body.injuriesAvailable, true);
  assert.equal(body.oddsAvailable, false);
  assert.equal(JSON.stringify(body).includes("football-secret"), false);
});

test("football-data.org fixtures are normalized and its token is not returned", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (url, options) => {
    assert.match(String(url), /api\.football-data\.org\/v4\/competitions\/SA\/matches\?season=2026/);
    assert.equal(options.headers["X-Auth-Token"], "football-secret");
    return apiResponse({ matches: [{
      utcDate: "2026-10-31T12:00:00Z",
      matchday: 10,
      homeTeam: { name: "Bologna FC 1909", shortName: "Bologna" },
      awayTeam: { name: "AC Monza", shortName: "Monza" },
      score: { fullTime: { home: 2, away: 1 } }
    }] });
  };

  const response = await onRequestGet(makeContext(
    "https://matchmind.test/api/player-context?type=fixtures&season=2026",
    { FOOTBALL_DATA_API_KEY: "football-secret" }
  ));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.source, "football-data.org");
  assert.equal(body.matches.length, 1);
  assert.deepEqual(body.matches[0], {
    date: "2026-10-31", time: body.matches[0].time, round: 10,
    home: "Bologna FC 1909", away: "AC Monza", hg: 2, ag: 1,
    hs: null, as: null, ht: null, at: null, source: "football-data.org",
    oddsH: null, oddsD: null, oddsA: null
  });
  assert.match(body.matches[0].time, /^\d{2}:\d{2}$/);
  assert.equal(JSON.stringify(body).includes("football-secret"), false);
});

test("an invalid football-data season is rejected before making a provider call", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => { throw new Error("invalid season must not call provider"); };
  const response = await onRequestGet(makeContext(
    "https://matchmind.test/api/player-context?type=fixtures&season=NaN",
    { FOOTBALL_DATA_API_KEY: "football-secret" }
  ));
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.match(body.error, /Stagione non valida/);
});

test("player search validates minimum input before calling provider", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => { throw new Error("invalid search must not call provider"); };
  const response = await onRequestGet(makeContext("https://matchmind.test/api/player-context?type=search&q=abc", { API_FOOTBALL_KEY: "test-secret" }));
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.match(body.error, /4 caratteri/);
});

test("injuries are normalized, deduplicated, and restricted to upcoming 14 days", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const today = new Date();
  const upcoming = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const past = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  globalThis.fetch = async (url, options) => {
    assert.match(String(url), /injuries\?/);
    assert.equal(options.headers["x-apisports-key"], "test-secret");
    return apiResponse({
      errors: [],
      response: [
        { player: { id: 7, name: "Test Player", type: "Questionable", reason: "Ankle" }, team: { id: 10, name: "Team A" }, fixture: { id: 100, date: upcoming } },
        { player: { id: 7, name: "Test Player", type: "Questionable", reason: "Ankle" }, team: { id: 10, name: "Team A" }, fixture: { id: 101, date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString() } },
        { player: { id: 8, name: "Past Player", type: "Missing Fixture", reason: "Injury" }, team: { id: 20, name: "Team B" }, fixture: { id: 102, date: past } }
      ]
    });
  };
  const response = await onRequestGet(makeContext("https://matchmind.test/api/player-context?type=injuries", { API_FOOTBALL_KEY: "test-secret" }));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.configured, true);
  assert.equal(body.injuries.length, 1);
  assert.equal(body.injuries[0].name, "Test Player");
  assert.equal(body.injuries[0].team, "Team A");
  assert.equal(body.injuries[0].status, "Questionable");
  assert.equal(body.lookaheadDays, 14);
  assert.equal(today instanceof Date, true);
});

test("player search returns a safe, normalized season profile", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (url) => {
    assert.match(String(url), /players\?/);
    return apiResponse({
      errors: [],
      response: [{
        player: { id: 9, name: "Example Player", age: 26, nationality: "Italy", photo: null },
        statistics: [{
          team: { id: 10, name: "Team A" },
          league: { id: 135, name: "Serie A" },
          games: { appearences: 8, lineups: 7, minutes: 630, rating: "7.12", position: "Attacker" },
          goals: { total: 4, assists: 2 },
          shots: { total: 18 },
          passes: { key: 7 }
        }]
      }]
    });
  };
  const response = await onRequestGet(makeContext("https://matchmind.test/api/player-context?type=search&q=Example", { API_FOOTBALL_KEY: "test-secret" }));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.players.length, 1);
  assert.equal(body.players[0].name, "Example Player");
  assert.equal(body.players[0].season.appearances, 8);
  assert.equal(body.players[0].season.minutes, 630);
  assert.equal(body.players[0].season.goals, 4);
  assert.equal(body.players[0].season.rating, 7.12);
  assert.equal(body.players[0].team.id, 10);
});

test("recent form reports per-match appearances and a summary", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (url) => {
    const value = String(url);
    if (value.includes("/fixtures/players?")) {
      return apiResponse({
        errors: [],
        response: [{
          team: { id: 10, name: "Team A" },
          players: [{
            player: { id: 9, name: "Example Player" },
            statistics: [{
              games: { minutes: 90, rating: "7.6" },
              goals: { total: 1, assists: 0 },
              shots: { total: 4 },
              passes: { key: 2 }
            }]
          }]
        }]
      });
    }
    if (value.includes("/fixtures?")) {
      return apiResponse({
        errors: [],
        response: [{
          fixture: { id: 101, date: "2026-10-20T18:45:00+00:00", timestamp: 1792521900, status: { short: "FT" } },
          teams: { home: { id: 10, name: "Team A" }, away: { id: 20, name: "Team B" } },
          goals: { home: 2, away: 1 }
        }]
      });
    }
    throw new Error("unexpected provider endpoint " + value);
  };
  const response = await onRequestGet(makeContext("https://matchmind.test/api/player-context?type=form&player=9&team=10", { API_FOOTBALL_KEY: "test-secret" }));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.appearances.length, 1);
  assert.equal(body.appearances[0].opponent, "Team B");
  assert.equal(body.appearances[0].minutes, 90);
  assert.equal(body.appearances[0].goals, 1);
  assert.equal(body.summary.goals, 1);
  assert.equal(body.summary.averageRating, 7.6);
});

test("invalid player identifiers are rejected before provider calls", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => { throw new Error("invalid ID must not call provider"); };
  const response = await onRequestGet(makeContext("https://matchmind.test/api/player-context?type=form&player=nope&team=10", { API_FOOTBALL_KEY: "test-secret" }));
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.match(body.error, /giocatore valido/);
});

test("provider API-key errors do not leak provider response details", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => apiResponse({ errors: { token: "Invalid API key: test-secret" }, response: [] });
  const response = await onRequestGet(makeContext("https://matchmind.test/api/player-context?type=injuries", { API_FOOTBALL_KEY: "test-secret" }));
  const body = await response.json();
  assert.equal(response.status, 502);
  assert.match(body.error, /chiave API-Football non è valida/);
  assert.equal(JSON.stringify(body).includes("test-secret"), false);
});
