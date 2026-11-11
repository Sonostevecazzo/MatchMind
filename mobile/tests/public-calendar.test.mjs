import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet } from "../functions/api/public-calendar.js";

test("public calendar merges club competitions and keyless ESPN Nations League fixtures", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const csv = "gw,date,time,home,away,ft_home,ft_away,ft_result,ht_home,ht_away,ht_result,home_shots,away_shots,home_target,away_target,home_fouls,away_fouls,home_corners,away_corners,home_corners_1h,away_corners_1h,home_corners_2h,away_corners_2h,home_yellow,away_yellow,home_red,away_red,goal_minutes,source\n";
  globalThis.fetch = async (url) => {
    const value = String(url);
    if (value.includes("uefa.nations/scoreboard")) {
      return new Response(JSON.stringify({ events: [{ id: "nl-2026-01", date: "2026-09-05T18:45:00Z", competitions: [{ status: { type: { state: "post", completed: true, shortDetail: "FT" } }, competitors: [{ homeAway: "home", score: "2", team: { displayName: "Italy" } }, { homeAway: "away", score: "1", team: { displayName: "France" } }] }] }] }), { status: 200 });
    }
    if (value.includes("results_2627.csv")) {
      const isSerieA = value.includes("ITA_1_serie-a");
      return new Response(csv + (isSerieA
        ? "1,2026-10-30,20:45,Inter,Milan,2,1,H,1,0,H,12,8,5,3,10,11,6,4,3,2,3,2,2,3,0,0,15,fd.co.uk\n"
        : "1,2026-10-29,21:00,Arsenal,Barcelona,1,1,D,,,,,,,,,,,,,,,,,,,,,fixturedl\n"), { status: 200 });
    }
    if (value.includes("fixtures_2627.csv")) {
      return new Response("gw,date,time,home,away\n2,2026-11-10,20:45,Roma,Napoli\n", { status: 200 });
    }
    if (value.includes("openfootball/football.json")) {
      return new Response(JSON.stringify({ matches: [{ date: "2025-09-01", round: "Matchday 1", team1: "Inter", team2: "Roma", score: { ft: [2, 0] } }] }), { status: 200 });
    }
    return new Response("not found", { status: 404 });
  };
  const response = await onRequestGet();
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.source, "open-matchday + openfootball + ESPN Nations League");
  assert.deepEqual([...new Set(body.matches.map(x => x.competition))].sort(), ["champions-league", "europa-league", "nations-league", "serie-a"]);
  const serieResult = body.matches.find(x => x.competition === "serie-a" && x.hg === 2);
  assert.equal(serieResult.hc, 6);
  assert.equal(serieResult.hs, 12);
  assert.equal(serieResult.hy, 2);
  assert.ok(body.matches.some(x => x.home === "Roma" && x.hg === null));
  assert.ok(body.matches.some(x => x.competition === "nations-league" && x.home === "Italy" && x.away === "France" && x.hg === 2));
  assert.ok(body.history.some(x => x.competition === "nations-league" && x.hg === 2));
  assert.ok(body.history.some(x => x.source === "openfootball · archivio storico" && x.hg === 2));
  assert.equal(JSON.stringify(body).includes("API_FOOTBALL_KEY"), false);
});
