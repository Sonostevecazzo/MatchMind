import test from "node:test";
import assert from "node:assert/strict";
import { normalizeFixture, normalizeEvents, normalizeStatistics, normalizeLineups, onRequestGet } from "../functions/api/live-match.js";

test("normalizes a live fixture without losing score or minute", () => {
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

test("normalizes chronological events and preserves team attribution", () => {
  const result = normalizeEvents([
    { time: { elapsed: 68 }, team: { id: 2, name: "Away FC" }, player: { name: "Away striker" }, type: "Goal", detail: "Normal Goal" },
    { time: { elapsed: 12 }, team: { id: 1, name: "Home FC" }, player: { name: "Home defender" }, type: "Card", detail: "Yellow Card" }
  ]);
  assert.deepEqual(result.map(item => item.minute), [12, 68]);
  assert.equal(result[1].teamId, 2);
  assert.equal(result[1].player, "Away striker");
});

test("normalizes the two teams' event statistics", () => {
  const result = normalizeStatistics([
    { team: { id: 1, name: "Home FC" }, statistics: [{ type: "Ball Possession", value: "61%" }, { type: "Total Shots", value: 9 }] },
    { team: { id: 2, name: "Away FC" }, statistics: [{ type: "Ball Possession", value: "39%" }, { type: "Total Shots", value: 4 }] }
  ]);
  assert.equal(result.length, 2);
  assert.equal(result[0].values[0].value, "61%");
  assert.equal(result[1].teamId, 2);
});

test("fails closed when the server-side provider secret is missing", async () => {
  const request = new Request("https://matchmind.example/api/live-match?competition=serie-a");
  const response = await onRequestGet({ request, env: {} });
  assert.equal(response.status, 503);
  const payload = await response.json();
  assert.equal(payload.configured, false);
  assert.equal(payload.code, "missing_api_football_key");
  assert.equal(JSON.stringify(payload).includes("secret"), true);
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
  assert.deepEqual(result[0].startXI[1].grid, { row: 2, column: 2 });
  assert.equal(result[0].substitutes[0].name, "Reserve");
});
