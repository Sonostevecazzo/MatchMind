/* Shared, testable NBA bet-builder calculations. */
(function(root){
  "use strict";
  function calculate(rows,stake){
    const selections=Array.isArray(rows)?rows:[];
    const validStake=Number.isFinite(Number(stake))&&Number(stake)>=0.5&&Number(stake)<=100000?Number(stake):null;
    const probabilities=selections.map(x=>Number(x.probability));
    const validProbability=selections.length>0&&probabilities.every(x=>Number.isFinite(x)&&x>0&&x<1);
    const probability=validProbability?probabilities.reduce((a,b)=>a*b,1):null;
    const odds=selections.map(x=>Number(x.odds));
    const hasAllOdds=selections.length>0&&odds.every(x=>Number.isFinite(x)&&x>1&&x<=1000);
    const totalOdds=hasAllOdds?odds.reduce((a,b)=>a*b,1):null;
    const potentialWin=validStake!==null&&totalOdds!==null?validStake*totalOdds:null;
    const expectedValue=probability!==null&&totalOdds!==null?probability*totalOdds-1:null;
    return {stake:validStake,probability,totalOdds,potentialWin,netWin:potentialWin!==null?potentialWin-validStake:null,expectedValue};
  }
  function toArchiveTicket(rows,stake,now=new Date()){
    const calculations=calculate(rows,stake);
    if(!Array.isArray(rows)||!rows.length||calculations.probability===null||calculations.stake===null)throw new Error("Schedina NBA non valida: controlla selezioni e puntata.");
    return {
      id:"nba-slip-"+now.getTime(),sport:"nba",competition:"nba",createdAt:now.toISOString(),
      stake:calculations.stake,totalOdds:calculations.totalOdds,potentialWin:calculations.potentialWin,
      netWin:calculations.netWin,expectedValue:calculations.expectedValue,probability:calculations.probability,
      selections:rows.map(x=>({
        home:String(x.home),away:String(x.away),date:String(x.date||""),eventId:String(x.id||x.eventId||""),side:x.side==="home"?"home":"away",team:String(x.team||(x.side==="home"?x.home:x.away)),sport:"nba",
        market:String(x.market||("Vittoria "+(x.side==="home"?"casa":"trasferta"))),
        marketKey:String(x.marketKey||("nbaMoneyline:"+x.side)),
        probability:Number(x.probability),odds:Number.isFinite(Number(x.odds))&&Number(x.odds)>1?Number(x.odds):null,
        competition:"nba",status:"Da giocare"
      }))
    };
  }
  const api={calculate,toArchiveTicket};
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.MMNbaBuilder=api;
})(typeof window!=="undefined"?window:null);
