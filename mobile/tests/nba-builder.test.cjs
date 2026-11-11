const test=require("node:test");
const assert=require("node:assert/strict");
const builder=require("../nba-builder.js");

test("NBA builder calculates combined probability and financials only with verified odds",()=>{
 const rows=[
  {home:"Boston Celtics",away:"New York Knicks",date:"2026-11-11",side:"home",team:"Boston Celtics",marketKey:"nbaMoneyline:home",probability:0.65,odds:1.8},
  {home:"Milwaukee Bucks",away:"Orlando Magic",date:"2026-11-12",side:"away",team:"Orlando Magic",marketKey:"nbaMoneyline:away",probability:0.58,odds:2.1}
 ];
 const result=builder.calculate(rows,10);
 assert.ok(Math.abs(result.probability-0.377)<1e-12);
 assert.ok(Math.abs(result.totalOdds-3.78)<1e-12);
 assert.ok(Math.abs(result.potentialWin-37.8)<1e-12);
 assert.ok(Math.abs(result.expectedValue-(0.377*3.78-1))<1e-12);
});
test("NBA builder does not invent total odds when one leg has no bookmaker quote",()=>{
 const result=builder.calculate([{probability:0.7,odds:1.8},{probability:0.6,odds:null}],10);
 assert.equal(result.probability,0.42);
 assert.equal(result.totalOdds,null);
 assert.equal(result.potentialWin,null);
 assert.equal(result.expectedValue,null);
});
test("NBA archive ticket preserves market, probability, odds and pending status",()=>{
 const rows=[{id:"nba-event-123",home:"Boston Celtics",away:"New York Knicks",date:"2026-11-11",side:"home",team:"Boston Celtics",marketKey:"nbaMoneyline:home",probability:0.65,odds:1.9}];
 const ticket=builder.toArchiveTicket(rows,5,new Date("2026-11-10T17:00:00Z"));
 assert.equal(ticket.sport,"nba");
 assert.equal(ticket.competition,"nba");
 assert.equal(ticket.stake,5);
 assert.equal(ticket.selections[0].marketKey,"nbaMoneyline:home");
 assert.equal(ticket.selections[0].eventId,"nba-event-123");
 assert.equal(ticket.selections[0].side,"home");
 assert.equal(ticket.selections[0].sport,"nba");
 assert.equal(ticket.selections[0].status,"Da giocare");
 assert.equal(ticket.selections[0].odds,1.9);
});
test("NBA builder rejects invalid stake or missing model probabilities",()=>{
 assert.throws(()=>builder.toArchiveTicket([{probability:null,odds:2}],5),/non valida/);
 assert.throws(()=>builder.toArchiveTicket([{probability:0.6,odds:2}],0),/non valida/);
});


test("NBA proposal generator filters by probability and the selected period, without inventing odds",()=>{
 const now=Date.parse("2026-11-11T12:00:00Z");
 const games=[
  {id:"game-a",home:"Boston Celtics",away:"New York Knicks",start:"2026-11-12T00:30:00Z",status:"NS",prediction:{homeWin:0.68,awayWin:0.32,reliable:true,spread:4,total:220,homePoints:112,awayPoints:108}},
  {id:"game-b",home:"Milwaukee Bucks",away:"Orlando Magic",start:"2026-11-14T00:00:00Z",status:"NS",prediction:{homeWin:0.44,awayWin:0.56,reliable:true,spread:-2,total:218,homePoints:108,awayPoints:110}},
  {id:"game-c",home:"Denver Nuggets",away:"Phoenix Suns",start:"2026-12-01T02:00:00Z",status:"NS",prediction:{homeWin:0.72,awayWin:0.28,reliable:false,spread:6,total:225,homePoints:116,awayPoints:109}},
  {id:"game-d",home:"Miami Heat",away:"Chicago Bulls",start:"2026-11-10T01:00:00Z",status:"FT",prediction:{homeWin:0.7,awayWin:0.3,reliable:true}}
 ];
 const result=builder.buildProposal(games,{now,minProbability:0.55,maxSelections:5,periodDays:7});
 assert.equal(result.available,true);
 assert.deepEqual(result.selections.map(x=>x.id),["game-a","game-b"]);
 assert.equal(result.selections[0].side,"home");
 assert.equal(result.selections[1].side,"away");
 assert.ok(result.selections.every(x=>x.odds===null));
 assert.ok(result.selections.every(x=>x.marketKey.startsWith("nbaMoneyline:")));
});


test("NBA proposal accepts user-selected threshold and up to thirty fixtures",()=>{
 const now=Date.parse("2026-11-11T12:00:00Z");
 const games=Array.from({length:32},(_,i)=>({
  id:"bulk-"+i,home:"Home "+i,away:"Away "+i,
  start:new Date(now+(i+1)*3600000).toISOString(),status:"NS",
  prediction:{homeWin:0.91-i*0.001,awayWin:0.09+i*0.001,reliable:true,spread:1,total:220,homePoints:111,awayPoints:109}
 }));
 const result=builder.buildProposal(games,{now,minProbability:0.9,maxSelections:30,periodDays:7});
 assert.equal(result.threshold,0.9);
 assert.equal(result.selections.length,30);
 assert.equal(result.eligibleGames,32);
 const capped=builder.buildProposal(games,{now,minProbability:0.5,maxSelections:99,periodDays:7});
 assert.equal(capped.selections.length,30);
});
