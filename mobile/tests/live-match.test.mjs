import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeFixture,
  normalizeEvents,
  normalizeStatistics,
  normalizeLineups,
  normalizeEspnFixture,
  normalizeEspnEvents,
  onRequestGet
} from "../functions/api/live-match.js";

test("normalizes a live API-Football fixture without losing score or minute", () => {
  const row = {
    fixture: { id: 12345, date: "2026-11-04T20:00:00+00:00", timestamp: 1793822400, venue: { name: "Stadio" }, status: { short: "2H", long: "Second Half", elapsed: 67, extra: 2 } },
    league: { name: "Serie A" },
    teams: { home: { id: 1, name: "Home FC", logo: "home.png" }, away: { id: 2, name: "Away FC", logo: "away.png" } },
    goals: { home: 2, away: 1 },
    score: { halftime: { home: 1, away: 1 } }
  };
  const result = normalizeFixture(row);
  assert.equal(result.id, 12345);
  assert.equal(result.elapsed, 67);
  assert.equal(result.extra, 2);
  assert.deepEqual(result.goals, { home: 2, away: 1 });
  assert.equal(result.home.name, "Home FC");
  assert.equal(result.status, "2H");
});

test("normalizes chronological API-Football events and preserves team attribution", () => {
  const result = normalizeEvents([
    { time: { elapsed: 68 }, team: { id: 2, name: "Away FC" }, player: { name: "Away striker" }, type: "Goal", detail: "Normal Goal" },
    { time: { elapsed: 12 }, team: { id: 1, name: "Home FC" }, player: { name: "Home defender" }, type: "Card", detail: "Yellow Card" }
  ]);
  assert.deepEqual(result.map(item => item.minute), [12, 68]);
  assert.equal(result[1].teamId, 2);
  assert.equal(result[1].player, "Away striker");
});

test("normalizes API-Football statistics", () => {
  const result = normalizeStatistics([
    { team: { id: 1, name: "Home FC" }, statistics: [{ type: "Ball Possession", value: "61%" }, { type: "Total Shots", value: 9 }] },
    { team: { id: 2, name: "Away FC" }, statistics: [{ type: "Ball Possession", value: "39%" }, { type: "Total Shots", value: 4 }] }
  ]);
  assert.equal(result.length, 2);
  assert.equal(result[0].values[0].value, "61%");
  assert.equal(result[1].teamId, 2);
});

test("uses ESPN as a keyless live fallback when the API-Football key is missing", async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async url => {
    assert.match(String(url), /site\.api\.espn\.com\/apis\/site\/v2\/sports\/soccer\/ita\.1\/scoreboard/);
    return new Response(JSON.stringify({
      events: [{
        id: "espn-123",
        date: "2026-11-04T18:00:00Z",
        competitions: [{
          status: { period: 2, displayClock: "67:12", type: { state: "in", name: "STATUS_IN_PROGRESS", shortDetail: "67'" } },
          competitors: [
            { homeAway: "home", score: "2", team: { id: "10", displayName: "Inter", logo: "inter.png" } },
            { homeAway: "away", score: "1", team: { id: "20", displayName: "Milan", logo: "milan.png" } }
          ]
        }]
      }]
    }), { status: 200 });
  };
  const response = await onRequestGet({
    request: new Request("https://matchmind.example/api/live-match?competition=serie-a"),
    env: {}
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.source, "ESPN");
  assert.equal(body.fallback, true);
  assert.equal(body.matches.length, 1);
  assert.equal(body.matches[0].status, "2H");
  assert.equal(body.matches[0].goals.home, 2);
  assert.equal(body.matches[0].home.name, "Inter");
});

test("falls back to ESPN when API-Football returns an error", async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let calls = 0;
  globalThis.fetch = async url => {
    calls++;
    if (String(url).includes("v3.football.api-sports.io")) return new Response("unavailable", { status: 503 });
    return new Response(JSON.stringify({ events: [] }), { status: 200 });
  };
  const response = await onRequestGet({
    request: new Request("https://matchmind.example/api/live-match?competition=serie-a"),
    env: { API_FOOTBALL_KEY: "valid_key_12345" }
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.source, "ESPN");
  assert.match(body.fallbackReason, /API-Football/);
  assert.equal(calls, 2);
});

test("uses ESPN as the keyless Nations League live source", async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async url => {
    assert.match(String(url), /site\\.api\\.espn\\.com\\/apis\\/site\\/v2\\/sports\\/soccer\\/uefa\\.nations\\/scoreboard/);
    return new Response(JSON.stringify({ events: [{
      id: "nl-live-1", date: "2026-11-11T18:45:00Z",
      competitions: [{ status: { period: 2, displayClock: "62:00", type: { state: "in", name: "STATUS_IN_PROGRESS", shortDetail: "62'" } },
        competitors: [
          { homeAway: "home", score: "1", team: { id: "10", displayName: "Italy" } },
          { homeAway: "away", score: "0", team: { id: "20", displayName: "France" } }
        ] }]
    }] }), { status: 200 });
  };
  const response = await onRequestGet({
    request: new Request("https://matchmind.example/api/live-match?competition=nations-league"),
    env: {}
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.source, "ESPN");
  assert.equal(body.competition, "nations-league");
  assert.equal(body.matches[0].league, "UEFA Nations League");
  assert.equal(body.matches[0].home.name, "Italy");
  assert.equal(body.matches[0].status, "2H");
});

test("normalizes ESPN live fixture and clock", () => {
  const result = normalizeEspnFixture({
    id: "espn-123",
    date: "2026-11-04T18:00:00Z",
    competitions: [{
      status: { period: 2, displayClock: "67:12", type: { state: "in", name: "STATUS_IN_PROGRESS", shortDetail: "67'" } },
      competitors: [
        { homeAway: "home", score: "2", team: { id: "10", displayName: "Inter", logo: "inter.png" } },
        { homeAway: "away", score: "1", team: { id: "20", displayName: "Milan" } }
      ]
    }]
  }, "Italian Serie A");
  assert.equal(result.id, "espn-123");
  assert.equal(result.status, "2H");
  assert.equal(result.elapsed, 67);
  assert.equal(result.goals.home, 2);
  assert.equal(result.home.name, "Inter");
  assert.equal(result.league, "Italian Serie A");
});

test("normalizes ESPN event feed", () => {
  const result = normalizeEspnEvents([
    { clock: { displayValue: "68'" }, team: { id: "20", displayName: "Milan" }, participants: [{ athlete: { displayName: "Forward" } }], type: { text: "Goal" }, text: "Goal!" }
  ]);
  assert.equal(result[0].minute, 68);
  assert.equal(result[0].teamId, "20");
  assert.equal(result[0].player, "Forward");
});

test("normalizes starting XI formation and player grid", () => {
  const result = normalizeLineups([
    {
      team: { id: 1, name: "Home FC" },
      formation: "4-3-3",
      coach: { name: "Coach" },
      startXI: [
        { player: { id: 10, name: "Goalkeeper", number: 1, pos: "G", grid: "1:1" } },
        { player: { id: 11, name: "Defender", number: 4, pos: "D", grid: "2:2" } }
      ],
      substitutes: [{ player: { id: 12, name: "Reserve", number: 18, pos: "F" } }]
    }
  ]);
  assert.equal(result[0].formation, "4-3-3");
  assert.equal(result[0].startXI[0].number, 1);
  assert.deepEqual(result[0].startXI[0].grid, { row: 1, column: 1 });
  assert.deepEqual(result[0].substitutes[0].name, "Reserve");
});
