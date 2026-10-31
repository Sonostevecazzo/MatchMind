/* MatchMind round analysis: chronological league context and transparent accumulator probabilities. */
(function(){
 'use strict';
 const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const scored=m=>m&&m.date&&m.home&&m.away&&m.hg!==null&&m.hg!==undefined&&m.ag!==null&&m.ag!==undefined&&Number.isFinite(Number(m.hg))&&Number.isFinite(Number(m.ag));
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
  return {table,home:teamContext(match.home,table,totalTeams),away:teamContext(match.away,table,totalTeams),asOf:match.date,disclaimer:'Obiettivi inferiti dalla classifica alla data della partita; non sono dichiarazioni ufficiali dei club.'};
 }
 function buildTicket(rows,forecastFn){
  const upcoming=rows.filter(m=>m&&m.date&&(m.hg===null||m.hg===undefined||m.ag===null||m.ag===undefined)).slice().sort((a,b)=>a.date.localeCompare(b.date));
  if(!upcoming.length)return {available:false,reason:'Nessuna partita futura disponibile.'};
  const first=upcoming[0],round=first.round;
  const fixtures=round!==null&&round!==undefined?upcoming.filter(m=>Number(m.round)===Number(round)):upcoming.filter(m=>Math.abs(Date.parse(m.date+'T12:00:00')-Date.parse(first.date+'T12:00:00'))<=3*86400000);
  const legs=fixtures.map(match=>{
   const f=forecastFn(match),p=f&&f.probabilities;
   if(!p||!f.sampleEnough)return {match,eligible:false,reason:'Campione storico insufficiente'};
   const one=[['1',p.home],['X',p.draw],['2',p.away]].sort((a,b)=>b[1]-a[1])[0];
   const btts=[['Gol',p.btts],['No Gol',1-p.btts]].sort((a,b)=>b[1]-a[1])[0];
   const total=[['Over 2,5',p.o25],['Under 2,5',1-p.o25]].sort((a,b)=>b[1]-a[1])[0];
   return {match,eligible:true,oneXtwo:{label:one[0],probability:one[1]},btts:{label:btts[0],probability:btts[1]},total:{label:total[0],probability:total[1]},context:matchContext(match,rows,rows)};
  });
  const combine=key=>{const valid=legs.filter(x=>x.eligible);if(valid.length!==legs.length||!valid.length)return {probability:null,legs:valid.length,required:legs.length,complete:false};const log=valid.reduce((s,x)=>s+Math.log(Math.max(1e-15,x[key].probability)),0);return {probability:Math.exp(log),legs:valid.length,required:legs.length,complete:true,assumption:'Prodotto delle probabilità marginali; indipendenza tra partite assunta, non verificata.'};};
  return {available:true,round:first.round??null,from:fixtures[0].date,to:fixtures[fixtures.length-1].date,fixtures:legs,tickets:{oneXtwo:combine('oneXtwo'),btts:combine('btts'),underOver:combine('total')},selectionRule:'Per ogni mercato viene selezionato l’esito singolo con probabilità stimata più alta; linea totale fissa 2,5.',disclaimer:'Stime statistiche, non garanzie. Una schedina con molte selezioni può avere probabilità complessiva molto bassa.'};
 }
 window.MatchMindRounds={standingsBefore,teamContext,matchContext,buildTicket,seasonStart};
})();