import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source=await readFile(new URL("../research-engine.js",import.meta.url),"utf8");
const window={MM:{sameTeam:(a,b)=>String(a).toLowerCase()===String(b).toLowerCase(),getMatchInjuries:()=>({hasData:false,freshness:{fresh:false}})}};
vm.runInNewContext(source,{window,Date,Math,Number,String,Object,Array});

function history(count=24){
 return Array.from({length:count},(_,i)=>({
  date:new Date(Date.UTC(2025,0,1+i)).toISOString().slice(0,10),
  home:i%2?"Beta":"Alpha",away:i%2?"Alpha":"Beta",
  hg:i%3?2:0,ag:i%3?0:1,competition:"serie-a",
  source:"open-matchday",hs:i%2?null:10,as:i%2?null:7,hc:null,ac:null
 }));
}

test("dossier uses only earlier fixtures from the same competition",()=>{
 const rows=history();
 rows.push({date:"2025-02-10",home:"Alpha",away:"Beta",hg:4,ag:0,competition:"serie-a",source:"future"});
 rows.push({date:"2025-02-01",home:"Alpha",away:"Beta",hg:3,ag:0,competition:"premier-league",source:"other"});
 const match={date:"2025-02-01",home:"Alpha",away:"Beta",competition:"serie-a"};
 const dossier=window.MatchMindResearch.buildDossier(match,rows,{updatedAt:Date.now(),source:"Open Matchday",historyScope:"five-season-archive"},{predictionMethod:"elo-1x2-poisson-goals"});
 assert.equal(dossier.historyCount,24);
 assert.equal(dossier.sourceCounts["open-matchday"],24);
 assert.equal(dossier.forecastMethod,"elo-1x2-poisson-goals");
 assert.equal(dossier.probabilityImpact,"none");
 assert.equal(dossier.home.last10.played,10);
 assert.equal(dossier.away.last10.played,10);
});

test("missing statistics remain missing and do not inflate coverage",()=>{
 const rows=history().map(row=>({...row,hs:null,as:null,hc:null,ac:null}));
 const dossier=window.MatchMindResearch.buildDossier({date:"2025-02-01",home:"Alpha",away:"Beta",competition:"serie-a"},rows,{updatedAt:Date.now()});
 assert.equal(dossier.statisticsRows,0);
 assert.equal(dossier.fieldCoverage.hs,0);
});

test("shadow simulation reports evidence coverage and never changes probabilities",()=>{
 const result=window.MatchMindResearch.simulate(history(60),"serie-a");
 assert.equal(result.played,60);
 assert.ok(result.walkForwardCases>0);
 assert.ok(result.adequateSamples>0);
 assert.equal(result.probabilitiesChanged,false);
 assert.equal(result.method,"chronological evidence-coverage audit");
});
