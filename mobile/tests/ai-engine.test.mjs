import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source=await readFile(new URL("../ai-engine.js",import.meta.url),"utf8");
function engine(){
  const store=new Map(),window={};
  const localStorage={getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value)};
  vm.runInNewContext(source,{window,localStorage,Date,Math,Number,String,Object,Array,JSON});
  return {api:window.MatchMindAI,store};
}
const outcome=(i)=>{
  const predicted=Math.floor(i/5)%3;
  const slot=i%5;
  const actual=slot<3?predicted:(slot===3?(predicted+1)%3:(predicted+2)%3);
  const scores=[[2,0],[1,1],[0,2]];
  return scores[actual];
};

test("temperature scaling preserves a normalized 1X2 distribution",()=>{
  const {api}=engine();
  const calibrated=api.applyTemperature({home:.7,draw:.2,away:.1},1.4);
  assert.ok(Math.abs(calibrated.home+calibrated.draw+calibrated.away-1)<1e-12);
  assert.ok(calibrated.home<.7);
  assert.ok(calibrated.draw>.2);
});

test("daily training is strictly chronological and gates promotion on out-of-sample improvement",()=>{
  const {api,store}=engine();
  const history=Array.from({length:260},(_,i)=>{
    const [hg,ag]=outcome(i);
    return {date:new Date(Date.UTC(2025,0,1+i)).toISOString().slice(0,10),home:"Alpha FC",away:"Beta FC",hg,ag,competition:"serie-a"};
  });
  let calls=0;
  const model=api.train(history,(target,prior)=>{
    calls++;
    assert.ok(prior.every(row=>row.date<target.date),"training forecast saw same-day or future result");
    const i=history.findIndex(row=>row.date===target.date);
    const predicted=Math.floor(i/5)%3;
    const p=[.7,.2,.1];
    return {sampleEnough:true,probabilities:{home:p[(0-predicted+3)%3],draw:p[(1-predicted+3)%3],away:p[(2-predicted+3)%3]}};
  },"serie-a");
  assert.ok(calls>100);
  assert.equal(model.status,"approved");
  assert.equal(model.approved,true);
  assert.ok(model.validation.improvementLogLoss>0);
  assert.ok(model.validation.improvementBrier>0);
  assert.equal(api.modelFor("serie-a").approved,true);
  assert.ok(store.has("matchmind-ai-model-v1"));
});

test("calibration is not promoted with an insufficient sample",()=>{
  const {api}=engine();
  const history=Array.from({length:60},(_,i)=>({date:new Date(Date.UTC(2025,0,1+i)).toISOString().slice(0,10),home:"Alpha FC",away:"Beta FC",hg:i%2,ag:(i+1)%2,competition:"serie-a"}));
  const model=api.train(history,()=>({sampleEnough:true,probabilities:{home:.7,draw:.2,away:.1}}),"serie-a");
  assert.equal(model.status,"insufficient_sample");
  assert.equal(model.approved,false);
  assert.equal(api.modelFor("serie-a"),null);
});

test("calibration is not promoted when validation does not beat baseline",()=>{
  const {api}=engine();
  const history=Array.from({length:240},(_,i)=>({date:new Date(Date.UTC(2025,0,1+i)).toISOString().slice(0,10),home:"Alpha FC",away:"Beta FC",hg:i%3===0?2:i%3===1?0:1,ag:i%3===0?0:i%3===1?2:1,competition:"serie-a"}));
  const model=api.train(history,()=>({sampleEnough:true,probabilities:{home:1/3,draw:1/3,away:1/3}}),"serie-a");
  assert.equal(model.approved,false);
  assert.equal(model.temperature,1);
  assert.equal(api.modelFor("serie-a"),null);
});

test("daily training reuses an unchanged model signature",()=>{
  const {api}=engine();
  const history=Array.from({length:240},(_,i)=>({date:new Date(Date.UTC(2025,0,1+i)).toISOString().slice(0,10),home:"Alpha FC",away:"Beta FC",hg:i%2,ag:(i+1)%2,competition:"serie-a"}));
  let calls=0;
  const forecast=()=>{calls++;return{sampleEnough:true,probabilities:{home:.34,draw:.33,away:.33}}};
  api.train(history,forecast,"serie-a");
  const first=calls;
  api.train(history,forecast,"serie-a");
  assert.equal(calls,first);
});
