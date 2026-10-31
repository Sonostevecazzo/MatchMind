/* MatchMind round analysis: chronological league context and transparent accumulator probabilities. */
(function(){
 'use strict';
 const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const scored=m=>m&&m.date&&m.home&&m.away&&m.hg!==null&&m.hg!==undefined&&m.hg!==''&&m.ag!==null&&m.ag!==undefined&&m.ag!==''&&Number.isFinite(Number(m.hg))&&Number.isFinite(Number(m.ag));
 const seasonStart=date=>{const y=Number(String(date).slice(0,4)),month=Number(String(date).slice(5,7));return (month>=7?y:y-1)+'-07-01';};
 function standingsBefore(rows,date){
  const start=seasonStart(date),map=new Map();
  const get=name=>{const k=norm(name);if(!map.has(k))map.set(k,{name,played:0,w:0,d:0,l:0,gf:0,ga:0,pts:0});return map.get(k);};
  rows.filter(m=>scored(m)&&m.date>=start&&m.date<date).forEach(m=>{const h=get(m.home),a=get(m.away),hg=Number(m.hg),ag=Number(m.ag);h.played++;a.played++;h.gf+=hg;h.ga+=ag;a.gf+=ag;a.ga+=hg;if(hg>ag){h.w++;a.l++;h.pts+=3;}else if(hg<ag){a.w++;h.l++;a.pts+=3;}else{h.d++;a.d++;h.pts++;a.pts++;}});
  return [...map.values()].map(t=>({...t,gd:t.gf-t.ga})).sort((a,b)=>b.pts-a.pts||b.gd-a.gd||b.gf-a.gf||a.name.localeCompare(b.name,'it')).map((t,i)=>({...t,rank:i+1}));
 }
 function teamContext(team,table,totalTeams=20){
  const t=table.find(x=>norm(x.name)===norm(team));
  if(!t)return {team,available:false,label:'Classifica non disponibile',objective:'Non valutabile'};
  const fourth=table[3],sixth=table[5],lastSafe=table[Math.max(0,totalTeams-4)],relegation=table.slice(-3);
  const gap=(target)=>target?Math.max(0,target.pts-t.pts):null;
  let objective='Zona salvezza';
  if(t.rank<=4)objective='Zona Champions';
  else if(t.rank<=6)objective='Zona Europa';
  else if(t.rank>=totalTeams-2)objective='Zona retrocessione';
  else if(fourth&&fourth.pts-t.pts<=6)objective='In corsa Champions';
  else if(sixth&&sixth.pts-t.pts<=6)objective='In corsa Europa';
  else if(lastSafe&&t.rank>=totalTeams-5&&t.pts-lastSafe.pts<=6)objective='Lotta salvezza';
  return {team,available:true,rank:t.rank,points:t.pts,played:t.played,goalDifference:t.gd,objective,pointsToFourth:gap(fourth),pointsToSixth:gap(sixth),pointsAboveSafety:lastSafe? t.pts-lastSafe.pts:null,inRelegationZone:relegation.some(x=>norm(x.name)===norm(team))};
 }
 function matchContext(match,rows,allTeamsRows=rows){
  const table=standingsBefore(rows,match.date),start=seasonStart(match.date),totalTeams=new Set(allTeamsRows.filter(m=>m&&m.date>=start).flatMap(m=>[m.home,m.away]).filter(Boolean).map(norm)).size||20;
  return {table,home:teamContext(match.home,table,totalTeams),away:teamContext(match.away,table,totalTeams),asOf:match.date,disclaimer:'Obiettivi inferiti dalla classifica alla data della partita; non sono dichiarazioni ufficiali dei club. Classifica provvisoria ordinata per punti, differenza reti e gol fatti; gli spareggi diretti non sono applicati.'};
 }
 function buildTicket(rows,forecastFn,options={}){
  const now=options.now instanceof Date?options.now:new Date();
  const localDate=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
  const isUpcoming=typeof options.isUpcoming==='function'?options.isUpcoming:m=>{
   if(!m||!m.date||scored(m)||m.date<localDate)return false;
   if(m.date>localDate)return true;
   const time=/^\d{1,2}:\d{2}$/.test(String(m.time||''))?m.time:'';
   if(!time)return true;
   const [hours,minutes]=time.split(':').map(Number);
   return new Date(now.getFullYear(),now.getMonth(),now.getDate(),hours,minutes).getTime()>=now.getTime();
  };
  const upcoming=rows.filter(m=>m&&m.date&&!scored(m)&&isUpcoming(m)).slice().sort((a,b)=>a.date.localeCompare(b.date));
  if(!upcoming.length)return {available:false,reason:'Nessuna partita futura disponibile.'};
  const first=upcoming[0],round=first.round;
  const roundKey=round===null||round===undefined?'':String(round).trim();
  const fixtures=roundKey?upcoming.filter(m=>String(m.round??'').trim()===roundKey):upcoming.filter(m=>Math.abs(Date.parse(m.date+'T12:00:00')-Date.parse(first.date+'T12:00:00'))<=3*86400000);
  const legs=fixtures.map(match=>{
   const f=forecastFn(match),p=f&&f.probabilities;
   if(!p||!f.sampleEnough)return {match,eligible:false,reason:'Campione storico insufficiente'};
   const values=[p.home,p.draw,p.away,p.btts,p.o25];
   if(!values.every(v=>Number.isFinite(v)&&v>=0&&v<=1)||Math.abs(p.home+p.draw+p.away-1)>.02)return {match,eligible:false,reason:'Probabilità del modello mancanti o non valide'};
   const one=[['1',p.home],['X',p.draw],['2',p.away]].sort((a,b)=>b[1]-a[1])[0];
   const btts=[['Gol',p.btts],['No Gol',1-p.btts]].sort((a,b)=>b[1]-a[1])[0];
   const total=[['Over 2,5',p.o25],['Under 2,5',1-p.o25]].sort((a,b)=>b[1]-a[1])[0];
   return {match,eligible:true,oneXtwo:{label:one[0],probability:one[1]},btts:{label:btts[0],probability:btts[1]},total:{label:total[0],probability:total[1]},context:matchContext(match,rows,rows)};
  });
  const combine=key=>{const valid=legs.filter(x=>x.eligible);if(valid.length!==legs.length||!valid.length)return {probability:null,legs:valid.length,required:legs.length,complete:false};if(valid.some(x=>x[key].probability===0))return {probability:0,legs:valid.length,required:legs.length,complete:true,assumption:'Prodotto delle probabilità marginali; indipendenza tra partite assunta, non verificata.'};const log=valid.reduce((s,x)=>s+Math.log(x[key].probability),0);return {probability:Math.exp(log),legs:valid.length,required:legs.length,complete:true,assumption:'Prodotto delle probabilità marginali; indipendenza tra partite assunta, non verificata.'};};
  return {available:true,round:first.round??null,from:fixtures[0].date,to:fixtures[fixtures.length-1].date,fixtures:legs,tickets:{oneXtwo:combine('oneXtwo'),btts:combine('btts'),underOver:combine('total')},selectionRule:'Per ogni mercato viene selezionato l’esito singolo con probabilità stimata più alta; linea totale fissa 2,5.',disclaimer:'Stime statistiche, non garanzie. Una schedina con molte selezioni può avere probabilità complessiva molto bassa.'};
 }
 function buildAssistant(candidates,options={}){
  const stake=Number(options.stake),minPayout=Number(options.minPayout),maxPayout=Number(options.maxPayout);
  const minLegs=Math.max(1,Math.floor(Number(options.minLegs)||4)),maxLegs=Math.max(minLegs,Math.floor(Number(options.maxLegs)||6));
  if(!Number.isFinite(stake)||stake<=0||!Number.isFinite(minPayout)||!Number.isFinite(maxPayout)||minPayout<=0||maxPayout<minPayout)return {available:false,reason:'Parametri di puntata o vincita non validi.'};
  const minOdds=minPayout/stake,maxOdds=maxPayout/stake;
  const valid=(Array.isArray(candidates)?candidates:[]).filter(x=>x&&x.matchKey&&x.matchLabel&&x.market&&x.selection&&Number.isFinite(x.odd)&&x.odd>1&&Number.isFinite(x.probability)&&x.probability>0&&x.probability<=1&&Number.isFinite(x.ev)&&x.ev>0.03);
  const grouped=new Map();
  valid.forEach(x=>{if(!grouped.has(x.matchKey))grouped.set(x.matchKey,[]);grouped.get(x.matchKey).push(x);});
  const groups=[...grouped.values()].map(g=>g.sort((a,b)=>b.ev-a.ev).slice(0,6));
  if(groups.length<minLegs)return {available:false,reason:'Non ci sono abbastanza partite con campione storico adeguato e almeno un mercato con valore atteso positivo superiore al 3%.'};
  let best=null,examined=0;const chosen=[];
  function visit(index,odds,probability,evSum){
   if(odds>maxOdds)return;
   if(chosen.length>=minLegs&&chosen.length<=maxLegs&&odds>=minOdds&&odds<=maxOdds){
    examined++;const candidate={legs:chosen.slice(),odds,probability,stake,payout:stake*odds,evSum};
    if(!best||candidate.probability>best.probability+1e-12||(Math.abs(candidate.probability-best.probability)<=1e-12&&candidate.evSum>best.evSum))best=candidate;
   }
   if(index>=groups.length||chosen.length===maxLegs)return;
   if(chosen.length+(groups.length-index)<minLegs)return;
   visit(index+1,odds,probability,evSum);
   for(const leg of groups[index]){const nextOdds=odds*leg.odd;if(nextOdds>maxOdds)continue;chosen.push(leg);visit(index+1,nextOdds,probability*leg.probability,evSum+leg.ev);chosen.pop();}
  }
  visit(0,1,1,0);
  if(!best)return {available:false,reason:'Nessuna combinazione di '+minLegs+'–'+maxLegs+' eventi raggiunge la quota obiettivo '+minOdds.toFixed(2)+'–'+maxOdds.toFixed(2)+' usando quote aggiornate e mercati con valore atteso positivo.',candidates:valid.length,matches:groups.length,examined};
  return {...best,available:true,minOdds,maxOdds,examined,assumption:'Probabilità congiunta calcolata come prodotto delle probabilità marginali; indipendenza tra partite assunta, non verificata.',disclaimer:'Stima statistica non calibrata come garanzia di vincita. Quote e disponibilità possono cambiare; controlla sempre il riepilogo del bookmaker prima di confermare.'};
 }
  window.MatchMindRounds={standingsBefore,teamContext,matchContext,buildTicket,buildAssistant,seasonStart};
})();