(function(root){
 "use strict";
 const finite=value=>Number.isFinite(Number(value))?Number(value):null;
 const scored=row=>row&&row.date&&finite(row.hg)!==null&&finite(row.ag)!==null;
 const normalize=value=>String(value||"").normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
 function sameTeam(a,b){return root.MM&&typeof root.MM.sameTeam==="function"?root.MM.sameTeam(a,b):normalize(a)===normalize(b);}
 function outcome(row,team){
  const home=sameTeam(row.home,team),gf=home?finite(row.hg):finite(row.ag),ga=home?finite(row.ag):finite(row.hg);
  return {gf,ga,points:gf>ga?3:gf===ga?1:0,btts:gf>0&&ga>0,over25:gf+ga>=3};
 }
 function summarize(rows,team,venue,max=10){
  const selected=rows.filter(row=>(sameTeam(row.home,team)||sameTeam(row.away,team))&&(!venue||sameTeam(row[venue],team))).slice().sort((a,b)=>a.date.localeCompare(b.date)).slice(-max);
  if(!selected.length)return {played:0,from:null,to:null,gf:null,ga:null,pointsPerGame:null,bttsRate:null,over25Rate:null,form:[]};
  const values=selected.map(row=>outcome(row,team));
  const avg=key=>values.reduce((sum,value)=>sum+value[key],0)/values.length;
  return {played:selected.length,from:selected[0].date,to:selected[selected.length-1].date,gf:avg("gf"),ga:avg("ga"),pointsPerGame:avg("points"),bttsRate:avg("btts"),over25Rate:avg("over25"),form:values.map(value=>value.points===3?"W":value.points===1?"D":"L")};
 }
 function buildDossier(match,history,data,forecast){
  const competition=match&&match.competition||"serie-a",before=String(match&&match.date||"");
  const prior=(Array.isArray(history)?history:[]).filter(row=>scored(row)&&row.date<before&&(row.competition||"serie-a")===competition).sort((a,b)=>a.date.localeCompare(b.date));
  const home={last5:summarize(prior,match.home,null,5),last10:summarize(prior,match.home,null,10),homeOnly:summarize(prior,match.home,"home",8)};
  const away={last5:summarize(prior,match.away,null,5),last10:summarize(prior,match.away,null,10),awayOnly:summarize(prior,match.away,"away",8)};
  const sourceCounts={};
  for(const row of prior){const key=String(row.source||"fonte non dichiarata");sourceCounts[key]=(sourceCounts[key]||0)+1;}
  const fields=["ht","at","hs","as","hst","ast","hf","af","hc","ac","hy","ay","hr","ar"];
  const statRows=prior.filter(row=>fields.some(field=>finite(row[field])!==null));
  const fieldCoverage=Object.fromEntries(fields.map(field=>[field,prior.length?prior.filter(row=>finite(row[field])!==null).length/prior.length:0]));
  const completeStats=prior.length?statRows.length/prior.length:0;
  const timestamp=Number(data&&data.updatedAt||0),ageMs=timestamp?Math.max(0,Date.now()-timestamp):null;
  const fresh=ageMs!==null&&ageMs<=6*60*60*1000&&!data?.stale;
  const sampleEnough=home.last10.played>=10&&away.last10.played>=10;
  const sampleScore=Math.min(1,Math.min(home.last10.played,away.last10.played)/10);
  const freshnessScore=fresh?1:ageMs===null?.25:ageMs<=24*60*60*1000?.65:.2;
  const qualityScore=Math.round(100*(.55*sampleScore+.25*freshnessScore+.20*completeStats));
  const injuries=root.MM&&typeof root.MM.getMatchInjuries==="function"?root.MM.getMatchInjuries(match.home,match.away):null;
  return {
   version:"local-research-v1",competition,asOf:before,historyCount:prior.length,
   historyStart:prior[0]?.date||null,historyEnd:prior[prior.length-1]?.date||null,
   home,away,sourceCounts,fieldCoverage,statisticsRows:statRows.length,
   freshness:{fresh,ageHours:ageMs===null?null:Math.round(ageMs/360000)/10,updatedAt:timestamp?new Date(timestamp).toISOString():null,offline:Boolean(data&&data.stale)},
   source:data&&data.source||"non dichiarata",historyScope:data&&data.historyScope||"scope non dichiarato",
   qualityScore,sampleEnough,forecastMethod:forecast&&forecast.predictionMethod||"non disponibile",
   injuries:injuries?{available:Boolean(injuries.hasData),fresh:Boolean(injuries.freshness&&injuries.freshness.fresh),home:Boolean(injuries.home),away:Boolean(injuries.away)}:null,
   probabilityImpact:"none",
   warnings:[
    !sampleEnough?"Campione insufficiente per almeno una delle due squadre.":null,
    !fresh?"Dati non aggiornati nelle ultime 6 ore o timestamp non disponibile.":null,
    completeStats<.5?"Statistiche avanzate disponibili su meno della metà delle partite storiche.":null,
    data&&data.historyScope&&data.historyScope!=="five-season-archive"?"Archivio pluristagionale non disponibile per questa competizione.":null
   ].filter(Boolean)
  };
 }
 function simulate(rows,competition){
  const played=(Array.isArray(rows)?rows:[]).filter(row=>scored(row)&&(row.competition||"serie-a")===(competition||"serie-a")).sort((a,b)=>a.date.localeCompare(b.date));
  let eligible=0,complete=0,homeSamples=0,awaySamples=0,statRows=0;
  for(let i=0;i<played.length;i++){
   const target=played[i],prior=played.slice(0,i).filter(row=>row.date<target.date);
   const h=summarize(prior,target.home,null,10),a=summarize(prior,target.away,null,10);
   if(prior.length>=30){eligible++;if(h.played>=10&&a.played>=10)complete++;}
   if(h.played>=10)homeSamples++;if(a.played>=10)awaySamples++;
   if(prior.some(row=>["hs","as","hc","ac","hy","ay"].some(field=>finite(row[field])!==null)))statRows++;
  }
  return {competition:competition||"serie-a",played:played.length,walkForwardCases:eligible,adequateSamples:complete,adequateSampleRate:eligible?complete/eligible:0,fixturesWithAdvancedStats:statRows,advancedStatsRate:played.length?statRows/played.length:0,method:"chronological evidence-coverage audit",probabilitiesChanged:false};
 }
 root.MatchMindResearch={version:"local-research-v1",buildDossier,simulate,summarize};
})(window);
