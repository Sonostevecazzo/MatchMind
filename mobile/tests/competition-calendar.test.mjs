import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet } from "../functions/api/competition-calendar.js";

const request = competition => new Request("https://matchmind.test/api/competition-calendar?competition="+competition);
const csvResults = "date,gw,home,away,ft_home,ft_away,ht_home,ht_away,home_shots,away_shots,home_target,away_target,home_fouls,away_fouls,home_corners,away_corners,home_yellow,away_yellow,home_red,away_red,goal_minutes\n2026-08-01,1,Roma,Milan,1,0,1,0,10,8,4,3,12,11,5,3,2,1,0,0,30";
const csvFixtures = "date,gw,home,away,ft_home,ft_away\n2026-11-20,12,Inter,Juventus,,,";
test("current-season open-matchday feed serves selected competition and Serie A history", async t => {
 const originalFetch=globalThis.fetch;t.after(()=>{globalThis.fetch=originalFetch;});
 const seen=[];
 globalThis.fetch=async input=>{
  const url=String(input);seen.push(url);
  if(url.includes("results_2627.csv"))return new Response(csvResults,{status:200});
  if(url.includes("fixtures_2627.csv"))return new Response(csvFixtures,{status:200});
  if(url.includes("/it.1.json"))return new Response(JSON.stringify({matches:[{date:"2025-09-01",round:"1",team1:"Roma",team2:"Milan",score:{ft:[1,0],ht:[1,0]}}]}),{status:200});
  return new Response("not found",{status:404});
 };
 const response=await onRequestGet({request:request("serie-a")}),body=await response.json();
 assert.equal(response.status,200);
 assert.equal(body.matches.length,2);
 assert.equal(body.matches[0].competition,"serie-a");
 assert.ok(body.matches.some(row=>row.source==="open-matchday"&&row.status==="NS"));
 assert.ok(body.history.some(row=>row.source==="openfootball · archivio storico"));
 assert.ok(seen.some(url=>url.includes("ITA_1_serie-a/results_2627.csv")));
 assert.equal(seen.filter(url=>url.includes("/it.1.json")).length,5);
});
test("all configured club competitions map to current-season open-matchday feeds", async t=>{
 const originalFetch=globalThis.fetch;t.after(()=>{globalThis.fetch=originalFetch;});
 const seen=[];
 globalThis.fetch=async input=>{
  const url=String(input);seen.push(url);
  if(url.endsWith("results_2627.csv"))return new Response(csvResults,{status:200});
  if(url.endsWith("fixtures_2627.csv"))return new Response(csvFixtures,{status:200});
  return new Response(JSON.stringify({matches:[]}),{status:200});
 };
 for(const id of ["serie-a","serie-b","premier-league","la-liga","bundesliga","ligue-1","champions-league","europa-league","conference-league","coppa-italia"]){
  const response=await onRequestGet({request:request(id)}),body=await response.json();
  assert.equal(response.status,200,id);
  assert.ok(body.matches.length>0,id);
  assert.ok(body.matches.every(row=>row.competition===id),id);
 }
 for(const folder of ["ITA_1_serie-a","ITA_2_serie-b","ENG_1_premier-league","ESP_1_la-liga","GER_1_bundesliga","FRA_1_ligue-1","UEFA_1_champions-league","UEFA_1_europa-league","UEFA_1_conference-league","ITA_CUP_coppa-italia"])
  assert.ok(seen.some(url=>url.includes("/"+folder+"/")),folder);
});
test("a missing selected competition feed returns a clear error instead of fake fixtures",async t=>{
 const originalFetch=globalThis.fetch;t.after(()=>{globalThis.fetch=originalFetch;});
 globalThis.fetch=async()=>new Response("missing",{status:404});
 const response=await onRequestGet({request:request("serie-b")}),body=await response.json();
 assert.equal(response.status,503);
 assert.equal(body.matches.length,0);
 assert.ok(body.errors.some(error=>error.includes("serie-b")));
});


test("75 Open Matchday competitions are registered and calendar-year leagues request the correct dataset", async t=>{
 const originalFetch=globalThis.fetch;t.after(()=>{globalThis.fetch=originalFetch;});
 const source=await (await import("node:fs/promises")).readFile(new URL("../functions/api/competition-calendar.js",import.meta.url),"utf8");
 const feedCount=[...source.matchAll(/feed: "[A-Za-z0-9_-]+"/g)].length;
 assert.equal(feedCount,75,"all 75 competitions in the upstream 2026/27 index must have a feed");
 const seen=[];
 globalThis.fetch=async input=>{
  const url=String(input);seen.push(url);
  if(url.endsWith("results_2026.csv"))return new Response(["date,gw,home,away,ft_home,ft_away","2026-02-01,1,Flamengo,Palmeiras,2,1"].join("\\n"),{status:200});
  if(url.endsWith("fixtures_2026.csv"))return new Response(["date,gw,home,away","2026-11-20,2,Santos,Corinthians"].join("\\n"),{status:200});
  return new Response("not found",{status:404});
 };
 const response=await onRequestGet({request:request("bra-1-serie-a")}),body=await response.json();
 assert.equal(response.status,200);
 assert.ok(seen.some(url=>url.endsWith("BRA_1_serie-a/results_2026.csv")));
 assert.equal(body.historyScope,"current-season-only");
 assert.equal(body.coverage.completed,1);
});
