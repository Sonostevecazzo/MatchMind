import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet } from "../functions/api/competition-calendar.js";

test("unified calendar returns all reachable competitions and historical Serie A results", async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const year = new Date().getUTCMonth() >= 6 ? new Date().getUTCFullYear() : new Date().getUTCFullYear() - 1;
  const seen = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    seen.push(url);
    if (url.includes("/scoreboard?")) {
      const slug = url.match(/soccer\/([^/]+)\/scoreboard/)?.[1] || "ita.1";
      return new Response(JSON.stringify({
        events: [{
          id: "event-" + slug, date: year + "-09-01T18:45:00Z",
          competitions: [{ status: { type: { state: "post", completed: true, shortDetail: "FT" } },
            competitors: [
              { homeAway: "home", score: "2", team: { displayName: "Home " + slug } },
              { homeAway: "away", score: "1", team: { displayName: "Away " + slug } }
            ] }]
        }]
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.includes("/it.1.json")) {
      return new Response(JSON.stringify({ matches: [{
        date: (year - 1) + "-09-01", round: "1", team1: "Roma", team2: "Milan",
        score: { ft: [1, 0], ht: [1, 0] }
      }] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response("not found", { status: 404 });
  };
  const response = await onRequestGet();
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.sourceMode, "multi-competition-public");
  assert.equal(body.matches.length, 11);
  assert.equal(Object.keys(body.counts).length, 11);
  assert.ok(body.matches.some(row => row.competition === "conference-league"));
  assert.ok(body.matches.every(row => row.status === "FT" && row.hg === 2 && row.ag === 1));
  assert.ok(body.history.some(row => row.source === "openfootball · archivio storico" && row.competition === "serie-a"));
  assert.equal(seen.filter(url => url.includes("/scoreboard?")).length, 11);
  assert.equal(seen.filter(url => url.includes("/it.1.json")).length, 5);
});

test("a failed competition does not hide matches from the other competitions", async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async input => {
    const url = String(input);
    if (url.includes("/scoreboard?") && url.includes("/ita.2/")) return new Response("unavailable", { status: 503 });
    if (url.includes("/scoreboard?")) {
      const slug = url.match(/soccer\/([^/]+)\/scoreboard/)?.[1] || "ita.1";
      return new Response(JSON.stringify({ events: [{
        id: "event-" + slug, date: "2026-09-01T18:45:00Z",
        competitions: [{ competitors: [
          { homeAway: "home", score: "1", team: { displayName: "Home" } },
          { homeAway: "away", score: "0", team: { displayName: "Away" } }
        ], status: { type: { state: "post", completed: true } } }]
      }] }), { status: 200 });
    }
    return new Response(JSON.stringify({ matches: [] }), { status: 200 });
  };
  const response = await onRequestGet();
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.ok(body.matches.length >= 1);
  assert.equal(body.counts["serie-b"], 0);
  assert.ok(body.errors.some(error => error.includes("serie-b")));
});
