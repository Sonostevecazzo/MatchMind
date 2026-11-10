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
