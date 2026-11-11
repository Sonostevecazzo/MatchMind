import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet } from "../functions/api/competition-calendar.js";

const request = competition => new Request("https://matchmind.test/api/competition-calendar?competition="+competition);
const dateOffset = days => { const d=new Date(); d.setUTCDate(d.getUTCDate()+days); return d.toISOString().slice(0,10)+"T18:45:00Z"; };

test("selected competition calendar fetches short ESPN windows and historical Serie A results", async t => {
  const originalFetch=globalThis.fetch;
  t.after(()=>{globalThis.fetch=originalFetch;});
  const seen=[];
  globalThis.fetch=async input=>{
    const url=String(input);seen.push(url);
    if(url.includes("/scoreboard?")){
      const slug=url.match(/soccer\/([^/]+)\/scoreboard/)?.[1]||"ita.1";
      return new Response(JSON.stringify({events:[{
        id:"event-"+slug,date:dateOffset(1),
        competitions:[{status:{type:{state:"pre",completed:false}},competitors:[
          {homeAway:"home",team:{displayName:"Home "+slug}},
          {homeAway:"away",team:{displayName:"Away "+slug}}
        ]}]
      }]}),{status:200,headers:{"Content-Type":"application/json"}});
    }
    if(url.includes("/it.1.json"))return new Response(JSON.stringify({matches:[{
      date:"2025-09-01",round:"1",team1:"Roma",team2:"Milan",score:{ft:[1,0],ht:[1,0]}
    }]}),{status:200});
    return new Response("not found",{status:404});
  };
  const response=await onRequestGet({request:request("serie-a")});
  const body=await response.json();
  assert.equal(response.status,200);
  assert.equal(body.sourceMode,"multi-competition-public");
  assert.equal(body.matches.length,1);
  assert.equal(body.matches[0].competition,"serie-a");
  assert.equal(body.matches[0].status,"NS");
  assert.deepEqual(Object.keys(body.counts),["serie-a"]);
  assert.ok(body.history.some(row=>row.source==="openfootball · archivio storico"&&row.competition==="serie-a"));
  assert.ok(seen.some(url=>url.includes("dates=")));
  assert.ok(seen.filter(url=>url.includes("/scoreboard?")).length>1);
  assert.equal(seen.filter(url=>url.includes("/it.1.json")).length,5);
});

test("selected competition failure is reported instead of returning a false empty calendar", async t => {
  const originalFetch=globalThis.fetch;
  t.after(()=>{globalThis.fetch=originalFetch;});
  globalThis.fetch=async input=>{
    const url=String(input);
    if(url.includes("/scoreboard?"))return new Response("unavailable",{status:503});
    return new Response(JSON.stringify({matches:[]}),{status:200});
  };
  const response=await onRequestGet({request:request("serie-b")});
  const body=await response.json();
  assert.equal(response.status,503);
  assert.equal(body.matches.length,0);
  assert.ok(body.errors.some(error=>error.includes("serie-b")));
});


test("a failed ESPN week does not discard fixtures from successful weeks", async t => {
  const originalFetch=globalThis.fetch;
  t.after(()=>{globalThis.fetch=originalFetch;});
  let scoreboardCalls=0;
  globalThis.fetch=async input=>{
    const url=String(input);
    if(url.includes("/scoreboard?")){
      scoreboardCalls++;
      if(scoreboardCalls===2)return new Response("temporary failure",{status:503});
      return new Response(JSON.stringify({events:[{
        id:"partial-"+scoreboardCalls,date:dateOffset(10),
        competitions:[{status:{type:{state:"pre",completed:false}},competitors:[
          {homeAway:"home",team:{displayName:"Home "+scoreboardCalls}},
          {homeAway:"away",team:{displayName:"Away "+scoreboardCalls}}
        ]}]
      }]}),{status:200,headers:{"Content-Type":"application/json"}});
    }
    if(url.includes("/it.1.json"))return new Response(JSON.stringify({matches:[]}),{status:200});
    return new Response("not found",{status:404});
  };
  const response=await onRequestGet({request:request("serie-a")});
  const body=await response.json();
  assert.equal(response.status,200);
  assert.ok(scoreboardCalls>2);
  assert.ok(body.matches.length>0);
});
