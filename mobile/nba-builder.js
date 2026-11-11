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
  function buildProposal(games,options={}){
    const now=Number.isFinite(Number(options.now))?Number(options.now):Date.now();
    const threshold=Number.isFinite(Number(options.minProbability))?Math.max(0.5,Math.min(0.95,Number(options.minProbability))):0.55;
    const max=Number.isFinite(Number(options.maxSelections))?Math.max(1,Math.min(15,Math.floor(Number(options.maxSelections)))):4;
    const period=options.periodDays==="all"?null:Math.max(1,Math.min(180,Number(options.periodDays)||7));
    const query=String(options.query||"").trim().toLowerCase();
    const date=String(options.date||"");
    const candidates=[];
    const seen=new Set();
    for(const game of Array.isArray(games)?games:[]){
      if(!game||game.status==="FT"||!game.id||!game.home||!game.away||!game.prediction)continue;
      const kickoff=Date.parse(game.start||"");
      if(!Number.isFinite(kickoff)||kickoff<now-6*60*60*1000)continue;
      if(date&&String(game.start).slice(0,10)!==date)continue;
      if(!date&&period!==null&&kickoff>now+period*86400000)continue;
      if(query&&!String(game.home+" "+game.away).toLowerCase().includes(query))continue;
      const id=String(game.id);if(seen.has(id))continue;seen.add(id);
      const prediction=game.prediction;
      const home=Number(prediction.homeWin),away=Number(prediction.awayWin);
      if(!Number.isFinite(home)||!Number.isFinite(away)||home<=0||away<=0||home>=1||away>=1)continue;
      const side=home>=away?"home":"away",probability=side==="home"?home:away;
      if(probability<threshold)continue;
      candidates.push({
        id, eventId:id, home:String(game.home), away:String(game.away),
        homeAbbr:String(game.homeAbbr||""),awayAbbr:String(game.awayAbbr||""),
        start:String(game.start),date:String(game.start).slice(0,10),
        side,team:side==="home"?String(game.home):String(game.away),
        marketKey:"nbaMoneyline:"+side,probability,prob:probability,
        odds:null,reliable:Boolean(prediction.reliable),
        homeWin:home,awayWin:away,spread:Number(prediction.spread),total:Number(prediction.total),
        homePoints:Number(prediction.homePoints),awayPoints:Number(prediction.awayPoints)
      });
    }
    candidates.sort((a,b)=>b.probability-a.probability||Number(b.reliable)-Number(a.reliable)||a.start.localeCompare(b.start));
    const selections=candidates.slice(0,max);
    return {
      available:selections.length>0,selections,eligibleGames:candidates.length,
      threshold,periodDays:period,
      probability:selections.reduce((product,item)=>product*item.probability,1),
      warning:"Probabilità Elo indicative; le selezioni senza almeno cinque partite di campione per squadra sono segnalate come poco affidabili. Nessuna quota viene inventata."
    };
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
  const api={calculate,buildProposal,toArchiveTicket};
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.MMNbaBuilder=api;
})(typeof window!=="undefined"?window:null);
