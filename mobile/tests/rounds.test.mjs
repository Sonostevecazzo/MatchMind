import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
const source=await readFile(new URL("../rounds.js",import.meta.url),"utf8");
const window={};vm.runInNewContext(source,{window,Math,Number,String,Map,Set,Array,Object,Date});
const R=window.MatchMindRounds;
test("standings snapshot excludes target date and later results",()=>{const rows=[{date:"2025-08-20",home:"A",away:"B",hg:2,ag:0},{date:"2025-08-21",home:"C",away:"D",hg:0,ag:1},{date:"2025-08-22",home:"A",away:"C",hg:0,ag:3},{date:"2025-08-23",home:"A",away:"E",hg:1,ag:0}];const t=R.standingsBefore(rows,"2025-08-22");assert.equal(t.find(x=>x.name==="A").pts,3);assert.equal(t.find(x=>x.name==="C").played,1);assert.equal(t.some(x=>x.name==="E"),false);});
test("league table resets at season boundary",()=>{const rows=[{date:"2024-05-20",home:"A",away:"B",hg:4,ag:0}];assert.equal(R.standingsBefore(rows,"2024-08-20").length,0);});
test("all three ticket markets combine probabilities and withhold estimates when any leg lacks sample",()=>{
 const rows=[
  {date:"2025-08-20",round:1,home:"A",away:"B",hg:null,ag:null},
  {date:"2025-08-20",round:1,home:"C",away:"D",hg:null,ag:null}
 ];
 const forecast=()=>({sampleEnough:true,probabilities:{home:.5,draw:.25,away:.25,btts:.6,o25:.4}});
 const complete=R.buildTicket(rows,forecast,{isUpcoming:()=>true});
 assert.equal(complete.fixtures.length,2);
 assert.ok(Math.abs(complete.tickets.oneXtwo.probability-.25)<1e-12);
 assert.ok(Math.abs(complete.tickets.btts.probability-.36)<1e-12);
 assert.ok(Math.abs(complete.tickets.underOver.probability-.36)<1e-12);
 assert.equal(complete.fixtures[0].oneXtwo.label,"1");
 assert.equal(complete.fixtures[0].btts.label,"Gol");
 assert.equal(complete.fixtures[0].total.label,"Under 2,5");
 const incomplete=R.buildTicket(rows,match=>match.home==="A"?forecast():{sampleEnough:false},{isUpcoming:()=>true});
 assert.equal(incomplete.fixtures.filter(leg=>leg.eligible).length,1);
 for(const market of ["oneXtwo","btts","underOver"])assert.equal(incomplete.tickets[market].probability,null);
});
test("context labels are explicitly derived from standings",()=>{const table=Array.from({length:20},(_,i)=>({name:"T"+i,rank:i+1,pts:60-i*2,gd:20-i}));const c=R.teamContext("T19",table);assert.equal(c.objective,"Zona retrocessione");assert.equal(c.rank,20);});

test("past unplayed fixtures are excluded from the next ticket",()=>{const rows=[{date:"2025-08-20",round:1,home:"Old A",away:"Old B",hg:null,ag:null},{date:"2025-08-22",round:2,home:"New A",away:"New B",hg:null,ag:null}];const f=()=>({sampleEnough:true,probabilities:{home:.5,draw:.25,away:.25,btts:.6,o25:.4}});const r=R.buildTicket(rows,f,{now:new Date(2025,7,21,12)});assert.equal(r.fixtures.length,1);assert.equal(r.fixtures[0].match.home,"New A");});
test("non-numeric round labels are matched as exact identifiers",()=>{const rows=[{date:"2025-08-20",round:"Regular Season - 1",home:"A",away:"B",hg:null,ag:null},{date:"2025-08-21",round:"Regular Season - 1",home:"C",away:"D",hg:null,ag:null},{date:"2025-08-22",round:"Regular Season - 2",home:"E",away:"F",hg:null,ag:null}];const f=()=>({sampleEnough:true,probabilities:{home:.5,draw:.25,away:.25,btts:.6,o25:.4}});const r=R.buildTicket(rows,f,{isUpcoming:()=>true});assert.equal(r.fixtures.length,2);assert.equal(r.round,"Regular Season - 1");});
test("malformed probability vectors suppress combined ticket estimates",()=>{const rows=[{date:"2025-08-20",round:1,home:"A",away:"B",hg:null,ag:null}];const r=R.buildTicket(rows,()=>({sampleEnough:true,probabilities:{home:2,draw:.2,away:.2,btts:.5,o25:.5}}),{isUpcoming:()=>true});assert.equal(r.tickets.oneXtwo.probability,null);assert.equal(r.fixtures[0].eligible,false);});

test("same-day fixtures after the current time remain upcoming",()=>{const rows=[{date:"2025-08-21",time:"11:00",home:"Past",away:"A",hg:null,ag:null},{date:"2025-08-21",time:"19:00",home:"Future",away:"B",hg:null,ag:null}];const f=()=>({sampleEnough:true,probabilities:{home:.5,draw:.25,away:.25,btts:.6,o25:.4}});const r=R.buildTicket(rows,f,{now:new Date(2025,7,21,15)});assert.equal(r.fixtures.length,1);assert.equal(r.fixtures[0].match.home,"Future");});
test("blank scores are not treated as played matches",()=>{const rows=[{date:"2025-08-20",home:"A",away:"B",hg:"",ag:""}];assert.equal(R.standingsBefore(rows,"2025-08-21").length,0);});

test("bet assistant finds a 4-leg ticket inside the configured payout range",()=>{const candidates=Array.from({length:5},(_,i)=>({matchKey:"m"+i,matchLabel:"Match "+i,market:"1X2",selection:"1",odd:2,probability:.7,ev:.08,book:"TestBook"}));const r=R.buildAssistant(candidates,{stake:2,minPayout:20,maxPayout:40,minLegs:4,maxLegs:6});assert.equal(r.available,true);assert.equal(r.legs.length,4);assert.equal(r.odds,16);assert.equal(r.payout,32);assert.ok(Math.abs(r.probability-.7**4)<1e-12);});
test("bet assistant never repeats a match and refuses weak or out-of-range candidates",()=>{const candidates=[{matchKey:"same",matchLabel:"Same",market:"1X2",selection:"1",odd:3,probability:.6,ev:.1},{matchKey:"same",matchLabel:"Same",market:"BTTS",selection:"Yes",odd:3,probability:.6,ev:.1},{matchKey:"other",matchLabel:"Other",market:"1X2",selection:"X",odd:3,probability:.5,ev:-.1}];const r=R.buildAssistant(candidates,{stake:2,minPayout:20,maxPayout:40,minLegs:2,maxLegs:2});assert.equal(r.available,false);});
