/* MatchMind Elo engine: chronological benchmark and pre-match 1X2 probabilities. */
(function(){
 'use strict';
 const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const aliases={
  inter:'inter',internazionale:'inter',intermilan:'inter',internazionalemilano:'inter',fcinternazionalemilano:'inter',
  milan:'milan',acmilan:'milan',acmilan1899:'milan',
  verona:'verona',hellasverona:'verona',hellasveronafc:'verona',
  roma:'roma',asroma:'roma',asromafc:'roma',lazio:'lazio',sslazio:'lazio',
  juventus:'juventus',juve:'juventus',juventusfc:'juventus',napoli:'napoli',sscnapoli:'napoli',
  fiorentina:'fiorentina',acffiorentina:'fiorentina',
  sassuolo:'sassuolo',ussassuolo:'sassuolo',ussassuolocalcio:'sassuolo',
  cagliari:'cagliari',cagliaricalcio:'cagliari',
  udinese:'udinese',udinesecalcio:'udinese',
  torino:'torino',torinofc:'torino',torinofc1906:'torino',genoa:'genoa',genoacfc:'genoa',genoacfc1893:'genoa',
  parma:'parma',parmacalcio:'parma',parmacalcio1913:'parma',lecce:'lecce',uslecce:'lecce',
  pisa:'pisa',pisasc:'pisa',pisasportingclub:'pisa',acpisa1909:'pisa',
  atalantabc:'atalanta',atalantabergamasca:'atalanta',atalantabergamascacalcio:'atalanta',
  bolognafc:'bologna',bolognafc1909:'bologna',como1907:'como',uscremonese:'cremonese',
  empolifc:'empoli',empolifc1920:'empoli',acmonza:'monza',monza1912:'monza',
  veneziafc:'venezia',ucsampdoria:'sampdoria',frosinonecalcio:'frosinone',ussalernitana1919:'salernitana'
 };
 const key=s=>aliases[norm(s)]||norm(s);
 const valid=m=>m&&m.date&&m.home&&m.away&&m.hg!==null&&m.hg!==undefined&&m.ag!==null&&m.ag!==undefined&&Number.isFinite(Number(m.hg))&&Number.isFinite(Number(m.ag));
 const actual=m=>Number(m.hg)>Number(m.ag)?'home':Number(m.hg)<Number(m.ag)?'away':'draw';
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 function eloBacktest(rows,options={}){
  const K=Number.isFinite(options.kFactor)?options.kFactor:20;
  const homeAdvantage=Number.isFinite(options.homeAdvantage)?options.homeAdvantage:40;
  const initial=Number.isFinite(options.initialRating)?options.initialRating:1500;
  if(K<=0||homeAdvantage<0)throw new Error('Parametri Elo non validi');
  const played=rows.filter(valid).slice().sort((a,b)=>a.date.localeCompare(b.date));
  const ratings=new Map(),counts=new Map(),scored=[];
  let priorDraws=0,priorMatches=0,lastDate='';
  const rating=t=>ratings.has(key(t))?ratings.get(key(t)):initial;
  for(let i=0;i<played.length;){
   const date=played[i].date;let j=i;while(j<played.length&&played[j].date===date)j++;
   const day=played.slice(i,j);
   // Every fixture on a calendar date is forecast from the same pre-date snapshot.
   const predictions=day.map(m=>{
    const h=key(m.home),a=key(m.away),rh=rating(m.home),ra=rating(m.away);
    const nh=counts.get(h)||0,na=counts.get(a)||0;
    const expected=1/(1+Math.pow(10,-((rh-ra+homeAdvantage)/400)));
    // Beta-smoothed draw prior; no outcomes from the target date enter this estimate.
    const draw=clamp((priorDraws+6)/(priorMatches+24),.12,.38);
    const ph=clamp(expected-draw/2,.005,1-draw-.005);
    const p={home:ph,draw,away:1-draw-ph};
    return {match:m,p,eligible:priorMatches>=30&&nh>=10&&na>=10};
   });
   // Score predictions before applying any result from this date.
   for(const item of predictions){
    if(!item.eligible)continue;
    const y=actual(item.match),p=item.p,winner=Object.keys(p).reduce((a,b)=>p[a]>=p[b]?a:b);
    scored.push({date,actual:y,p,hit:winner===y,logLoss:-Math.log(Math.max(1e-15,p[y])),brier:(p.home-(y==='home'?1:0))**2+(p.draw-(y==='draw'?1:0))**2+(p.away-(y==='away'?1:0))**2});
   }
   // Simultaneous date update: calculate every delta from the same snapshot, then apply.
   const deltas=new Map();
   for(const m of day){
    const h=key(m.home),a=key(m.away),rh=rating(m.home),ra=rating(m.away);
    const expected=1/(1+Math.pow(10,-((rh-ra+homeAdvantage)/400)));
    const score=Number(m.hg)>Number(m.ag)?1:Number(m.hg)<Number(m.ag)?0:.5;
    const delta=K*(score-expected);
    deltas.set(h,(deltas.get(h)||0)+delta);
    deltas.set(a,(deltas.get(a)||0)-delta);
    counts.set(h,(counts.get(h)||0)+1);counts.set(a,(counts.get(a)||0)+1);
    priorMatches++;if(score===.5)priorDraws++;
   }
   for(const [team,delta] of deltas)ratings.set(team,rating(team)+delta);
   lastDate=date;i=j;
  }
  const n=scored.length;if(!n)return{count:0,available:played.length,model:null,from:null,to:null,parameters:{kFactor:K,homeAdvantage,initialRating:initial}};
  const avg=k=>scored.reduce((s,x)=>s+x[k],0)/n,accuracy=scored.filter(x=>x.hit).length/n;
  const z=1.96,den=1+z*z/n,center=(accuracy+z*z/(2*n))/den,margin=z*Math.sqrt((accuracy*(1-accuracy)+z*z/(4*n))/n)/den;
  const dates=scored.map(x=>x.date);
  return {count:n,available:played.length,from:dates[0],to:dates[dates.length-1],model:{accuracy,accuracyCI:[Math.max(0,center-margin),Math.min(1,center+margin)],logLoss:avg('logLoss'),brier:avg('brier')},parameters:{kFactor:K,homeAdvantage,initialRating:initial,drawPrior:'Beta(6,18)',sameDateSnapshot:true,aliasNormalization:true},limitations:'Elo non calibrato; parametri fissi non ottimizzati sul campione test. Il rating iniziale delle squadre nuove è neutro.'};
 }

 function eloProbabilities(match,history,options={}){
  const K=Number.isFinite(options.kFactor)?options.kFactor:20;
  const homeAdvantage=Number.isFinite(options.homeAdvantage)?options.homeAdvantage:40;
  const initial=Number.isFinite(options.initialRating)?options.initialRating:1500;
  const competition=match&&match.competition||'serie-a';
  const played=(history||[]).filter(m=>valid(m)&&m.date<String(match.date||'')&&(m.competition||'serie-a')===competition).slice().sort((a,b)=>a.date.localeCompare(b.date));
  if(played.length<30)return null;
  const ratings=new Map(),counts=new Map();let priorDraws=0,priorMatches=0;
  const rating=t=>ratings.has(key(t))?ratings.get(key(t)):initial;
  for(let i=0;i<played.length;){
   const date=played[i].date;let j=i;while(j<played.length&&played[j].date===date)j++;
   const day=played.slice(i,j),deltas=new Map();
   for(const m of day){
    const h=key(m.home),a=key(m.away),rh=rating(m.home),ra=rating(m.away);
    const expected=1/(1+Math.pow(10,-((rh-ra+homeAdvantage)/400)));
    const score=Number(m.hg)>Number(m.ag)?1:Number(m.hg)<Number(m.ag)?0:.5;
    const delta=K*(score-expected);
    deltas.set(h,(deltas.get(h)||0)+delta);deltas.set(a,(deltas.get(a)||0)-delta);
    counts.set(h,(counts.get(h)||0)+1);counts.set(a,(counts.get(a)||0)+1);
    priorMatches++;if(score===.5)priorDraws++;
   }
   for(const [team,delta] of deltas)ratings.set(team,rating(team)+delta);
   i=j;
  }
  const homeCount=counts.get(key(match.home))||0,awayCount=counts.get(key(match.away))||0;
  if(homeCount<10||awayCount<10)return null;
  const expected=1/(1+Math.pow(10,-((rating(match.home)-rating(match.away)+homeAdvantage)/400)));
  const draw=clamp((priorDraws+6)/(priorMatches+24),.12,.38);
  const home=clamp(expected-draw/2,.005,1-draw-.005);
  return {home,draw,away:1-draw-home,method:'Elo',kFactor:K,homeAdvantage,homeRating:rating(match.home),awayRating:rating(match.away),historyCount:priorMatches};
 }

 if(window.MM){window.MM.eloBacktest=eloBacktest;window.MM.eloProbabilities=eloProbabilities;}
 window.MatchMindElo={eloBacktest,eloProbabilities};
})();