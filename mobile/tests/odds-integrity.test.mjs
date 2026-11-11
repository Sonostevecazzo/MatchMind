import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source=await readFile(new URL("../site-core.js",import.meta.url),"utf8");
const futureDate=()=>new Date(Date.now()+3*86400000).toISOString().slice(0,10);
function createMM(payload,now=Date.now()){
  class FixedDate extends Date{
    constructor(...args){super(...(args.length?args:[now]));}
    static now(){return now;}
  }
  const window={};
  const document={addEventListener(){},getElementById(){return null;},body:{dataset:{}}};
  const localStorage={getItem(){return null;},setItem(){},removeItem(){}};
  const context={window,document,localStorage,Date:FixedDate,Math,Number,String,Object,Array,Map,Set,Intl,URLSearchParams,AbortSignal,console,
    fetch:async()=>({ok:true,json:async()=>payload})};
  vm.runInNewContext(source,context);
  return window.MM;
}
const fixture=(overrides={})=>({
  division:"I1",competition:"serie-a",date:futureDate(),time:"18:00",home:"Inter",away:"Milan",
  odds:{bookmaker:"Bet365 / Media",home:2.1,draw:3.2,away:3.4,over25:1.9,under25:1.9},
  ...overrides
});
const payload=(matches,updatedAt=new Date().toISOString())=>({source:"football-data.co.uk",updatedAt,count:matches.length,matches});

test("odds are returned only for the exact competition and fixture date",async()=>{
  const row=fixture();
  const mm=createMM(payload([row]));
  await mm.loadOdds();
  const exact=mm.matchOdds({date:row.date,home:"Internazionale",away:"Milan",competition:"serie-a"});
  assert.equal(exact.home,2.1);
  assert.equal(exact.source,"football-data.co.uk");
  assert.equal(mm.matchOdds({date:futureDate(),home:"Inter",away:"Milan",competition:"serie-b"}),null);
  const otherDate=new Date(Date.parse(row.date+"T12:00:00Z")+86400000).toISOString().slice(0,10);
  assert.equal(mm.matchOdds({date:otherDate,home:"Inter",away:"Milan",competition:"serie-a"}),null);
});

test("stale odds feeds are rejected rather than shown as current prices",async()=>{
  const now=Date.now(),old=new Date(now-25*60*60*1000).toISOString();
  const row=fixture();
  const mm=createMM(payload([row],old),now);
  await mm.loadOdds();
  assert.equal(mm.matchOdds({date:row.date,home:row.home,away:row.away,competition:"serie-a"}),null);
  assert.equal(mm.getOddsMeta().fresh,false);
  assert.equal(mm.getOddsMeta().reason,"feed_expired");
});

test("ambiguous duplicate fixture records are rejected",async()=>{
  const row=fixture();
  const duplicate={...row,odds:{...row.odds,home:9.9}};
  const mm=createMM(payload([row,duplicate]));
  await mm.loadOdds();
  assert.equal(mm.matchOdds({date:row.date,home:row.home,away:row.away,competition:"serie-a"}),null);
});

test("a feed without a valid source timestamp is not trusted",async()=>{
  const row=fixture();
  const mm=createMM({source:"unknown",matches:[row]});
  await mm.loadOdds();
  assert.equal(mm.matchOdds({date:row.date,home:row.home,away:row.away,competition:"serie-a"}),null);
  assert.equal(mm.getOddsMeta().reason,"timestamp_missing");
});
