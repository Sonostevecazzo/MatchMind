import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
const source=await readFile(new URL("../elo.js",import.meta.url),"utf8");
const window={MM:{}};
vm.runInNewContext(source,{window,Math,Number,String,Map,Set,Array,Object,Error});
const elo=window.MM.eloBacktest;
const predict=window.MM.eloProbabilities;
test("Elo metrics and confidence interval",()=>{const rows=[];for(let d=0;d<80;d++){const date=new Date(Date.UTC(2022,0,1+d)).toISOString().slice(0,10);rows.push({date,home:"Alpha FC",away:"Beta FC",hg:d%3===0?2:1,ag:d%3===0?0:1});}const r=elo(rows);assert.ok(r.count>0);assert.ok(Number.isFinite(r.model.logLoss));assert.ok(Number.isFinite(r.model.brier));assert.ok(r.model.accuracyCI[0]<=r.model.accuracy&&r.model.accuracy<=r.model.accuracyCI[1]);});
test("same-date results do not alter forecasts made on that date",()=>{const prior=[];for(let d=0;d<45;d++)prior.push({date:new Date(Date.UTC(2022,0,1+d)).toISOString().slice(0,10),home:"A",away:"B",hg:1,ag:0});const date="2022-02-15";const a=elo([...prior,{date,home:"A",away:"B",hg:5,ag:0},{date,home:"C",away:"D",hg:0,ag:4}]);const b=elo([...prior,{date,home:"A",away:"B",hg:5,ag:0},{date,home:"C",away:"D",hg:4,ag:0}]);assert.equal(a.count,b.count);assert.equal(a.model.logLoss,b.model.logLoss);});
test("aliases and new teams have stable neutral starting ratings",()=>{const rows=[];for(let d=0;d<45;d++)rows.push({date:new Date(Date.UTC(2022,0,1+d)).toISOString().slice(0,10),home:d%2?"Inter":"Internazionale",away:"New Team",hg:1,ag:0});const r=elo(rows);assert.ok(r.count>0);assert.equal(r.parameters.initialRating,1500);assert.equal(r.parameters.aliasNormalization,true);});
test("invalid parameters and insufficient history",()=>{assert.throws(()=>elo([],{kFactor:0}));assert.equal(elo([{date:"2024-01-01",home:"A",away:"B",hg:1,ag:0}]).count,0);});

test("Elo pre-match probabilities use only earlier results and sum to one",()=>{
 const rows=[];
 for(let d=0;d<50;d++){
  const date=new Date(Date.UTC(2023,0,1+d)).toISOString().slice(0,10);
  rows.push({date,home:d%2?'Alpha FC':'Beta FC',away:d%2?'Beta FC':'Alpha FC',hg:d%3===0?2:1,ag:d%3===0?0:1,competition:'serie-a'});
 }
 const match={date:'2023-03-01',home:'Alpha FC',away:'Beta FC',competition:'serie-a'};
 const p=predict(match,rows);
 assert.ok(p);
 assert.ok(Math.abs(p.home+p.draw+p.away-1)<1e-12);
 assert.ok(p.home>0&&p.draw>0&&p.away>0);
 const future=predict(match,rows.map(x=>({...x,date:'2023-04-01'})));
 assert.equal(future,null);
});
test("Elo pre-match prediction refuses insufficient team samples",()=>{
 const rows=Array.from({length:35},(_,i)=>({date:new Date(Date.UTC(2023,0,1+i)).toISOString().slice(0,10),home:'Alpha FC',away:'Beta FC',hg:1,ag:0,competition:'serie-a'}));
 assert.equal(predict({date:'2023-03-01',home:'New FC',away:'Beta FC',competition:'serie-a'},rows),null);
});
