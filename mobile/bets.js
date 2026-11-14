/* MatchMind: local statistical bet builder. No bookmaker or odds dependencies. */
(function(){
"use strict";
const $=id=>document.getElementById(id),ENGINE=()=>window.MatchMindBets;
const PICKS_KEY="matchmind-manual-selections-v1",CONTEXT_KEY="matchmind-match-context-v2",ARCHIVE_KEY="matchmind-slip-archive-v2",STAKE_KEY="matchmind-slip-default-stake";
let currentStake=10;
try{const storedStake=Number(JSON.parse(localStorage.getItem(STAKE_KEY)||"10"));if(Number.isFinite(storedStake)&&storedStake>=0.5&&storedStake<=100000)currentStake=storedStake;}catch(_){}
const curr=v=>Number.isFinite(v)?v.toLocaleString("it-IT",{minimumFractionDigits:2,maximumFractionDigits:2})+" €":"—";
const fmtOdds=v=>Number.isFinite(v)&&v>0?v.toLocaleString("it-IT",{minimumFractionDigits:2,maximumFractionDigits:2}):"—";
const fmtEv=v=>Number.isFinite(v)?(v>=0?"+":"")+(v*100).toLocaleString("it-IT",{maximumFractionDigits:1})+"%":"—";
let data=null,allData=null,fixtures=[],picks=[],contexts={},archive=[],proposal=[],visibleFixtureLimit=12,slipExpanded=false,proposalGenerated=false;
const esc=value=>window.MM.esc(String(value==null?"":value));
const pct=value=>Number.isFinite(value)?(value*100).toLocaleString("it-IT",{maximumFractionDigits:1})+"%":"—";
const norm=value=>window.MM.norm(value);
const displayTeam=name=>window.MM.displayTeamName?window.MM.displayTeamName(name):String(name||"");
const TEAM_ALIASES = {
  inter: ["inter", "internazionale", "fc inter", "fc internazionale"],
  milan: ["milan", "ac milan", "acmilan"],
  juventus: ["juventus", "juve", "juventus fc"],
  roma: ["roma", "as roma"],
  lazio: ["lazio", "ss lazio"],
  napoli: ["napoli", "ssc napoli"],
  verona: ["verona", "hellas verona", "hellas"],
  atalanta: ["atalanta", "atalanta bc"],
  fiorentina: ["fiorentina", "acf fiorentina"],
  bologna: ["bologna", "bologna fc"],
  torino: ["torino", "toro", "torino fc"],
  monza: ["monza", "ac monza"],
  udinese: ["udinese", "udinese calcio"],
  lecce: ["lecce", "us lecce"],
  empoli: ["empoli", "empoli fc"],
  cagliari: ["cagliari", "cagliari calcio"],
  genoa: ["genoa", "genoa cfc"],
  parma: ["parma", "parma calcio"],
  como: ["como", "como 1907"],
  venezia: ["venezia", "venezia fc"]
};

function canonicalTeam(name) {
  const n = norm(name);
  for (const [canon, aliases] of Object.entries(TEAM_ALIASES)) {
    if (canon === n || aliases.some(a => norm(a) === n)) return canon;
  }
  const clean = String(name || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
  const words = clean.split(/\s+/).filter(w => !["fc", "ac", "ss", "as", "cfc", "bc", "1907", "calcio", "spa"].includes(w));
  for (const [canon, aliases] of Object.entries(TEAM_ALIASES)) {
    if (words.includes(canon) || aliases.some(a => words.includes(a))) return canon;
  }
  return n;
}

function isSameMatch(h1, a1, h2, a2) {
  return canonicalTeam(h1) === canonicalTeam(h2) && canonicalTeam(a1) === canonicalTeam(a2);
}

const fixtureKey=m=>[(m.competition||"serie-a"),m.date,norm(m.home),norm(m.away)].join("|");
const engineKey=m=>[norm(m.home),norm(m.away)].sort().join("|")+"|"+m.date;
const read=(key,fallback)=>{try{const value=JSON.parse(localStorage.getItem(key)||"null");return value==null?fallback:value;}catch(_){return fallback;}};
const save=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch(_){$("globalStatus").textContent="Spazio locale insufficiente per salvare i dati."; }};
const markets=()=>ENGINE().marketChoices();
function getContext(match){
  const key = fixtureKey(match);
  const manual = contexts[key];
  if (manual && manual.__manual) return manual;
  const inj = (window.MM && window.MM.getMatchInjuries) ? window.MM.getMatchInjuries(match.home, match.away) : null;
  if (manual && Object.keys(manual).length > 0) return manual;
  if (inj && inj.hasData) return { ...inj.autoContext, __auto: true };
  return {};
}

function renderInjuriesCard(match) {
  const inj = (window.MM && window.MM.getMatchInjuries) ? window.MM.getMatchInjuries(match.home, match.away) : null;
  if (!inj || !inj.hasData) return '';
  const h = inj.home, a = inj.away;
  const hTot = h ? h.totale_assenze : 0;
  const aTot = a ? a.totale_assenze : 0;
  const formatList = (team) => {
    if (!team) return '<li>Dati non disponibili</li>';
    const items = [];
    if (team.infortunati && team.infortunati.length) {
      team.infortunati.forEach(p => items.push('<li><span class="injury-role-badge">' + esc(p.role) + '</span> <b>' + esc(p.player) + '</b>: <small>' + esc(p.detail) + '</small></li>'));
    }
    if (team.squalificati && team.squalificati.length) {
      team.squalificati.forEach(p => items.push('<li class="text-danger">🔴 <b>' + esc(p.player) + '</b> (squalificato): <small>' + esc(p.detail) + '</small></li>'));
    }
    if (team.diffidati && team.diffidati.length) {
      items.push('<li class="text-muted"><small>🟡 Diffidati: ' + team.diffidati.map(p => esc(p.player)).join(', ') + '</small></li>');
    }
    return items.length ? items.join('') : '<li>Nessuna assenza segnalata (rosa al completo)</li>';
  };

  return '<details class="injury-auto-drawer">' +
    '<summary class="injury-auto-summary">' +
      '<span>🏥 <b>Infermeria & Assenze ufficiali</b>: ' + esc(displayTeam(match.home)) + ' (' + hTot + ') vs ' + esc(displayTeam(match.away)) + ' (' + aTot + ')</span>' +
      '<small class="injury-toggle-btn">Bollettino ▾</small>' +
    '</summary>' +
    '<div class="injury-auto-body">' +
      '<div class="injury-team-col">' +
        '<h6>' + esc(displayTeam(match.home)) + ' (' + hTot + ' assenti)</h6>' +
        '<ul class="injury-player-list">' + formatList(h) + '</ul>' +
      '</div>' +
      '<div class="injury-team-col">' +
        '<h6>' + esc(displayTeam(match.away)) + ' (' + aTot + ' assenti)</h6>' +
        '<ul class="injury-player-list">' + formatList(a) + '</ul>' +
      '</div>' +
      '<div class="injury-auto-footer">' +
        '<small>⚡ Le assenze di titolari in attacco e difesa sono già conteggiate in automatico nelle probabilità e nell’EV.</small>' +
      '</div>' +
    '</div>' +
  '</details>';
}
function getForecast(match){return window.MM.forecast(match,(allData||data).history,getContext(match));}
function marketProbability(forecast,key){return ENGINE().marketProbability(forecast,key);}
function readPicks(){const stored=read(PICKS_KEY,[]);return Array.isArray(stored)?stored:[];}
function writePicks(){const stored=readPicks(),competition=window.MM.getSelectedCompetition(),retained=stored.filter(p=>p&&(p.sport==="nba"||(p.competition||"serie-a")!==competition)),current=picks.map(p=>({...p,competition:p.competition||competition}));save(PICKS_KEY,retained.concat(current));window.dispatchEvent(new Event("matchmind:picks-updated"));}
window.addEventListener("matchmind:picks-updated",()=>{picks=readPicks().filter(p=>(p.competition||"serie-a")===window.MM.getSelectedCompetition());if(data){renderSlip();}});
function selectedFor(match){return picks.find(p=>fixtureKey(p)===fixtureKey(match));}
function selectOptions(value){return [0,1,2,3].map(n=>'<option value="'+n+'"'+(Number(value||0)===n?' selected':'')+'>'+n+'</option>').join("");}
function motivationOptions(value){return [{v:-1,t:"Bassa"},{v:0,t:"Neutra / automatica"},{v:1,t:"Alta"}].map(x=>'<option value="'+x.v+'"'+(Number(value||0)===x.v?' selected':'')+'>'+x.t+'</option>').join("");}
function renderFixture(match){
 const f=getForecast(match),selected=selectedFor(match),ctx=getContext(match),p=f.probabilities;
 const form=x=>x.form&&x.form.length?x.form.join(" · "):"n.d.";
 const stand=x=>x.available?"#"+x.rank+" · "+x.points+" pt · "+x.objective:"classifica non disponibile";
 const choices=markets().map(([key,label])=>({key,label,probability:marketProbability(f,key)}));
 const renderMarketGroup=(title,items)=>'<div class="fixture-market-group"><h4>'+title+'</h4><div class="fixture-market-grid">'+items.map(item=>'<button type="button" class="fixture-market-button'+(selected&&selected.marketKey===item.key?' is-selected':'')+'" data-pick="'+esc(fixtureKey(match))+'" data-market="'+esc(item.key)+'" aria-pressed="'+String(Boolean(selected&&selected.marketKey===item.key))+'"><span>'+esc(item.label)+'</span><b>'+pct(item.probability)+'</b></button>').join("")+'</div></div>';
 const buttons=renderMarketGroup("Mercati singoli",choices.filter(item=>!item.key.startsWith("combo:")))+renderMarketGroup("1X2 + Gol / No Gol",choices.filter(item=>item.key.startsWith("combo:")&&["bttsYes","bttsNo"].includes(item.key.split(":")[2])))+renderMarketGroup("1X2 + Over / Under",choices.filter(item=>item.key.startsWith("combo:")&&!["bttsYes","bttsNo"].includes(item.key.split(":")[2])));
 const fields=[
  ["attackingAbsencesHome","Attaccanti titolari assenti · "+match.home,ctx.attackingAbsencesHome],
  ["defensiveAbsencesHome","Difensori titolari assenti · "+match.home,ctx.defensiveAbsencesHome],
  ["attackingAbsencesAway","Attaccanti titolari assenti · "+match.away,ctx.attackingAbsencesAway],
  ["defensiveAbsencesAway","Difensori titolari assenti · "+match.away,ctx.defensiveAbsencesAway]
 ];
 const absenceHtml=fields.map(([key,label,value])=>'<label class="context-field">'+esc(label)+'<select data-context="'+esc(fixtureKey(match))+'" data-context-field="'+key+'">'+selectOptions(value)+'</select></label>').join("");
 const motivationHtml='<div class="context-motivation"><label class="context-field">Motivazione '+esc(displayTeam(match.home))+'<select data-context="'+esc(fixtureKey(match))+'" data-context-field="motivationHome">'+motivationOptions(ctx.motivationHome)+'</select></label><label class="context-field">Motivazione '+esc(displayTeam(match.away))+'<select data-context="'+esc(fixtureKey(match))+'" data-context-field="motivationAway">'+motivationOptions(ctx.motivationAway)+'</select></label></div>';
 return '<article class="manual-fixture-card"><div class="manual-fixture-heading"><div><b>'+esc(displayTeam(match.home))+' – '+esc(displayTeam(match.away))+'</b><small>'+esc(window.MM.shortDate(match))+(match.time?' · '+esc(match.time):'')+' · confidenza '+esc(f.confidence)+'</small></div>'+(selected?'<span class="manual-picked-label">'+esc(marketLabel(selected.marketKey))+'</span>':'')+'</div>'+
 '<div class="fixture-forecast-strip"><span>1 <b>'+pct(p.home)+'</b></span><span>X <b>'+pct(p.draw)+'</b></span><span>2 <b>'+pct(p.away)+'</b></span><span>xG <b>'+f.homeXg.toFixed(2)+' – '+f.awayXg.toFixed(2)+'</b></span></div>'+
 '<div class="fixture-form-context"><span>'+esc(displayTeam(match.home))+' forma: <b>'+esc(form(f.home))+'</b></span><span>'+esc(displayTeam(match.away))+' forma: <b>'+esc(form(f.away))+'</b></span><span>'+esc(stand(f.standings.home))+'</span><span>'+esc(stand(f.standings.away))+'</span></div>'+
 renderInjuriesCard(match)+
 '<div class="fixture-market-options">'+buttons+'</div><details class="manual-other-markets"><summary>Contesto squadra: assenze, infortuni e motivazione</summary><div class="context-controls"><div class="context-grid">'+absenceHtml+'</div>'+motivationHtml+'<small>Inserisci solo titolari realmente indisponibili. Le assenze sono una correzione indicativa, non una valutazione del valore individuale del giocatore. La motivazione automatica deriva dalla classifica; l’impostazione manuale è una tua valutazione.</small></div></details></article>';
}
function renderFixtures(){
 const target=$("manualFixtures");if(!target)return;
 const query=norm($("matchSearch").value),date=$("betsDate")?.value||"",team=$("betsTeam")?.value||"",round=$("betsRound")?.value||"";
 const rows=fixtures.filter(m=>(!query||norm(m.home).includes(query)||norm(displayTeam(m.home)).includes(query)||norm(m.away).includes(query)||norm(displayTeam(m.away)).includes(query))&&(!date||m.date===date)&&(!team||norm(m.home)===norm(team)||norm(m.away)===norm(team))&&(!round||String(m.round||"")===round));
 const visible=rows.slice(0,visibleFixtureLimit);
 target.innerHTML=visible.length?visible.map(renderFixture).join(""):'<div class="empty-state">Nessuna partita corrisponde ai filtri. Modifica la ricerca.</div>';
 const count=$("betsFixtureCount");if(count)count.textContent=rows.length+" partite trovate · visualizzate "+visible.length;
 const more=$("moreBetFixtures");if(more)more.hidden=rows.length<=visibleFixtureLimit;
}
function marketLabel(key){
 if(key==="nbaMoneyline:home")return "NBA · Vince casa";
 if(key==="nbaMoneyline:away")return "NBA · Vince trasferta";
 const item=ENGINE().marketCandidates("auto").find(x=>x.key===key);
 return item?item.label:String(key||"Mercato");
}
function selectedRows(){
 const storedFootball=readPicks().filter(p=>p&&p.sport!=="nba");
 const footballRows=storedFootball.map(p=>{
  const competition=p.competition||"serie-a";
  const sourceMatches=[...(allData?.matches||fixtures),...(allData?.history||[])];
  let match=sourceMatches.find(m=>(m.competition||"serie-a")===competition&&m.date===p.date&&norm(m.home)===norm(p.home)&&norm(m.away)===norm(p.away));
  if(!match)match=sourceMatches.find(m=>(m.competition||"serie-a")===competition&&isSameMatch(m.home,m.away,p.home,p.away));
  if(!match&&p.home&&p.away){
   match={home:p.home,away:p.away,date:p.date||new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Rome"}).format(new Date()),competition};
  }
  if(!match)return null;
  const forecast=getForecast(match);
  const odds=p.odds!=null&&Number.isFinite(Number(p.odds))&&Number(p.odds)>1&&Number(p.odds)<=1000?Number(p.odds):null;
  const modelProbability=forecast?marketProbability(forecast,p.marketKey):null;
  const savedProbability=Number(p.probability);
  const prob=Number.isFinite(modelProbability)&&modelProbability>0&&modelProbability<1?modelProbability:
   (Number.isFinite(savedProbability)&&savedProbability>0&&savedProbability<1?savedProbability:null);
  return{match,marketKey:p.marketKey,marketLabel:marketLabel(p.marketKey),probability:prob,forecast,odds,bookmaker:p.bookmaker||null,sport:"football",removeKey:fixtureKey(match)};
 }).filter(Boolean);
 const nbaRows=readPicks().filter(p=>p&&p.sport==="nba"&&p.home&&p.away).map(p=>{
  const id=String(p.id||p.eventId||"");
  const probability=Number(p.probability??p.prob);
  if(!id||!Number.isFinite(probability)||probability<=0||probability>=1)return null;
  const side=p.side==="home"?"home":"away";
  const marketKey=p.marketKey||("nbaMoneyline:"+side);
  const label=side==="home"?"Vince casa":"Vince trasferta";
  const match={id,home:String(p.home),away:String(p.away),date:String(p.date||String(p.start||"").slice(0,10)),time:"",start:String(p.start||""),competition:"nba",sport:"nba"};
  const odds=Number.isFinite(Number(p.odds))&&Number(p.odds)>1&&Number(p.odds)<=1000?Number(p.odds):null;
  return{match,marketKey,marketLabel:label,probability,forecast:null,odds,bookmaker:p.bookmaker||null,sport:"nba",removeKey:"nba|"+id,nbaPickId:id};
 }).filter(Boolean);
 return footballRows.concat(nbaRows);
}
function updateSlipCalculations(){
 const rows=selectedRows();if(!rows.length)return;
 const hasAllProbabilities=rows.every(x=>Number.isFinite(x.probability)&&x.probability>0&&x.probability<1);
 const probability=hasAllProbabilities?rows.reduce((v,x)=>v*x.probability,1):null;
 const fairCombinedOdds=probability!=null?ENGINE().fairOdds(probability):null;
 const validOdds=rows.map(r=>r.odds).filter(o=>Number.isFinite(o)&&o>1);
 const hasAllOdds=validOdds.length===rows.length&&rows.length>0;
 const computedOdds=hasAllOdds?validOdds.reduce((acc,o)=>acc*o,1):null;
 const totalOdds=Number.isFinite(computedOdds)?computedOdds:null;
 const potentialWin=totalOdds!=null?currentStake*totalOdds:null;
 const ev=totalOdds!=null&&probability!=null?ENGINE().expectedValue(probability,totalOdds):null;
 const evAmount=ev!=null?currentStake*ev:null;
 const summary= $("manualSlipSummary")?.querySelector("details > summary span");
 if(summary)summary.textContent="Anteprima schedina · "+rows.length+" "+(rows.length===1?"pronostico":"pronostici")+(potentialWin!=null?" · vincita "+curr(potentialWin):"");

 const totalOddsEl=$("slipTotalOddsVal");if(totalOddsEl)totalOddsEl.innerHTML=totalOdds!=null?fmtOdds(totalOdds):'<small class="text-muted">'+validOdds.length+'/'+rows.length+' quote</small>';
 const fairOddsEl=$("slipFairOddsVal");if(fairOddsEl)fairOddsEl.textContent=fmtOdds(fairCombinedOdds);
 const potWinEl=$("slipPotWinVal");if(potWinEl)potWinEl.textContent=curr(potentialWin);
 const evEl=$("slipEvVal");if(evEl){evEl.textContent=ev!=null?fmtEv(ev)+" · "+(evAmount>=0?"+":"")+curr(evAmount):"—";evEl.className="financial-value "+(ev!=null?(ev>=0?"ev-pos":"ev-neg"):"");}

 rows.forEach(row=>{
  const fKey=row.removeKey||fixtureKey(row.match);
  const singleEv=ENGINE().expectedValue(row.probability,row.odds);
  const pill=document.querySelector('[data-ev-for="'+CSS.escape(fKey)+'"]');
  if(pill){
   if(singleEv!=null){pill.className="financial-pill "+(singleEv>=0?"ev-pos":"ev-neg");pill.innerHTML='EV: <b>'+fmtEv(singleEv)+'</b>';}
   else{pill.className="financial-pill text-muted";pill.innerHTML='EV: <i>inserisci quota</i>';}
  }
 });
}

function exportSisalPredictions(row){
 if(row.sport==="nba"){
  return Number.isFinite(row.probability)?[{
   marketKey:row.marketKey,label:row.marketLabel,probability:row.probability,
   sampleEnough:true,historyCount:0,model:"NBA Elo"
  }]:[];
 }
 const forecast=row.forecast;
 if(!forecast||!forecast.probabilities)return [];
 const candidates=ENGINE().marketCandidates("auto");
 const rows=candidates.map(item=>({
  marketKey:item.key,label:item.label,
  probability:marketProbability(forecast,item.key),
  sampleEnough:forecast.sampleEnough===true,
  historyCount:Number(forecast.historyCount)||0,
  model:forecast.predictionMethod||"Poisson/Elo"
 }));
 const p=forecast.probabilities;
 rows.push(
  {marketKey:"dc1X",label:"Doppia chance 1X",probability:p.home+p.draw,sampleEnough:forecast.sampleEnough===true,historyCount:Number(forecast.historyCount)||0,model:forecast.predictionMethod||"Poisson/Elo"},
  {marketKey:"dcX2",label:"Doppia chance X2",probability:p.draw+p.away,sampleEnough:forecast.sampleEnough===true,historyCount:Number(forecast.historyCount)||0,model:forecast.predictionMethod||"Poisson/Elo"},
  {marketKey:"dc12",label:"Doppia chance 12",probability:p.home+p.away,sampleEnough:forecast.sampleEnough===true,historyCount:Number(forecast.historyCount)||0,model:forecast.predictionMethod||"Poisson/Elo"}
 );
 const unique=new Map();
 rows.forEach(item=>{
  if(Number.isFinite(item.probability)&&item.probability>=0&&item.probability<=1)unique.set(item.marketKey,item);
 });
 return Array.from(unique.values());
}

function updateSisalTransfer(){
 const link=$("sendSelectionsToSisal"),status=$("sisalBridgeStatus");
 if(!link||!status)return;
 const bridge=window.MatchMindSisalBridge;
 // Export the loaded upcoming calendar, not only manually selected picks.
 // The v3 compact payload is tested for 11 fixtures and mobile URL limits.
 const calendarRows=(Array.isArray(fixtures)?fixtures:[])
  .filter(match=>match&&match.home&&match.away&&match.date&&(!match.status||!["FT","AET","PEN","CANC","POSTP"].includes(String(match.status).toUpperCase())))
  .slice(0,11)
  .map(match=>{
   const forecast=getForecast(match);
   if(!forecast||!forecast.probabilities)return null;
   return {match,marketKey:"home",marketLabel:"Esito 1",probability:forecast.probabilities.home,forecast,odds:null,sport:"football"};
  }).filter(Boolean);
 const rowsByKey=new Map(calendarRows.map(row=>[fixtureKey(row.match),row]));
 selectedRows().forEach(row=>rowsByKey.set(fixtureKey(row.match),row));
 const allSelections=Array.from(rowsByKey.values()).map(row=>({
  ...row,sport:row.sport||"football",
  marketLabel:row.marketLabel||"Esito 1",
  probability:Number.isFinite(Number(row.probability))?row.probability:null,
  predictions:exportSisalPredictions(row),
  sampleEnough:row.forecast?.sampleEnough===true,
  historyCount:Number(row.forecast?.historyCount)||0,
  predictionMethod:row.forecast?.predictionMethod||(row.sport==="nba"?"NBA Elo":"MatchMind")
 }));
 const result=bridge?bridge.createUrl(allSelections):null;
 if(!result||!result.url){
  link.removeAttribute("href");
  link.setAttribute("aria-disabled","true");
  link.setAttribute("tabindex","-1");
  link.textContent="Aggiungi selezioni supportate";
  if(!bridge)status.textContent="Ponte Sisal non caricato. Ricarica la pagina e riprova.";
  else if(result.skipped)status.textContent=(result.skipped===1?"1 selezione non trasferibile":result.skipped+" selezioni non trasferibili")+": il mercato non è supportato o i dati della partita sono incompleti.";
  else status.textContent="Nessuna partita con previsioni disponibili da trasferire.";
  return;
 }
 link.href=result.url;
 link.removeAttribute("aria-disabled");
 link.removeAttribute("tabindex");
 link.textContent="Apri Sisal con "+result.payload.items.length+" partite";
 const skippedNote=result.skipped?(result.skipped===1?" 1 partita non trasferibile è stata esclusa.":" "+result.skipped+" partite non trasferibili sono state escluse."):"";
 const competitions=[...new Set(result.payload.items.map(item=>item.competition||"serie-a"))];
 status.textContent="Previsioni trasferite: "+result.payload.items.length+" partite in "+competitions.length+" competizioni. Il bridge non aggiunge né conferma giocate."+skippedNote;
}
function renderSlip(){
 const target=$("manualSlipSummary"),rows=selectedRows();
 const allPicks=readPicks(),count=$("betWorkspacePickCount"),saveButton=$("saveManualSlip");
 if(count)count.textContent=String(allPicks.length);
 if(saveButton)saveButton.disabled=allPicks.length===0;
 updateSisalTransfer(rows);
 if(!rows.length){target.innerHTML='<div class="empty-state">La schedina è vuota. Aggiungi una selezione dal <a href="./matches.html">calendario calcio</a> oppure apri il <a href="./bets.html?sport=nba#betWorkspaceBuilder">calendario NBA</a>.</div>';slipExpanded=false;return;}
 const hasAllProbabilities=rows.every(x=>Number.isFinite(x.probability)&&x.probability>0&&x.probability<1);
 const probability=hasAllProbabilities?rows.reduce((v,x)=>v*x.probability,1):null;
 const fairCombinedOdds=probability!=null?ENGINE().fairOdds(probability):null;
 const validOdds=rows.map(r=>r.odds).filter(o=>Number.isFinite(o)&&o>1);
 const hasAllOdds=validOdds.length===rows.length&&rows.length>0;
 const computedOdds=hasAllOdds?validOdds.reduce((acc,o)=>acc*o,1):null;
 const totalOdds=Number.isFinite(computedOdds)?computedOdds:null;
 const potentialWin=totalOdds!=null?currentStake*totalOdds:null;
 const ev=totalOdds!=null&&probability!=null?ENGINE().expectedValue(probability,totalOdds):null;

 const rowsHtml=rows.map(row=>{
  const fKey=row.removeKey||fixtureKey(row.match);
  const fairOdds=Number.isFinite(row.probability)?ENGINE().fairOdds(row.probability):null;
  const singleEv=Number.isFinite(row.probability)?ENGINE().expectedValue(row.probability,row.odds):null;
  const evClass=singleEv!=null?(singleEv>=0?"ev-pos":"ev-neg"):"";
  return '<div class="manual-selected-row" data-fixture="'+esc(fKey)+'">'+
   '<div class="manual-selected-row-main">'+
    '<span><b>'+esc(displayTeam(row.match.home))+' – '+esc(displayTeam(row.match.away))+'</b>'+
    '<small>'+(row.sport==="nba"?"NBA · ":"Calcio · ")+esc(row.marketLabel)+' · '+esc(row.match.date)+' · prob. '+pct(row.probability)+'</small></span>'+
    '<button type="button" class="manual-remove-button" data-remove="'+esc(fKey)+'" aria-label="Rimuovi selezione">×</button>'+
   '</div>'+
   '<div class="manual-selected-row-financials">'+
    '<label class="manual-odds-label">Quota: '+
     '<input type="number" step="0.01" min="1.01" max="1000" placeholder="es. 1.85" class="manual-odds-input" data-odds-for="'+esc(fKey)+'" value="'+(row.odds||'')+'">'+
    '</label>'+
    '<span class="financial-pill">Equa: <b>'+fmtOdds(fairOdds)+'</b></span>'+
    '<span class="financial-pill '+(singleEv!=null?evClass:"text-muted")+'" data-ev-for="'+esc(fKey)+'">'+(singleEv!=null?'EV: <b>'+fmtEv(singleEv)+'</b>':'EV: <i>inserisci quota</i>')+'</span>'+
   '</div>'+
  '</div>';
 }).join("");
 const financialSummaryHtml=
  '<div class="manual-financial-grid">'+
   '<div class="financial-metric-card">'+
    '<span class="financial-label">Puntata (€)</span>'+
    '<input type="number" id="slipStakeInput" min="0.5" step="0.5" value="'+currentStake+'" class="slip-stake-input">'+
   '</div>'+
   '<div class="financial-metric-card">'+
    '<span class="financial-label">Quota totale</span>'+
    '<b class="financial-value" id="slipTotalOddsVal">'+(totalOdds!=null?fmtOdds(totalOdds):'<small class="text-muted">'+validOdds.length+'/'+rows.length+' quote</small>')+'</b>'+
   '</div>'+
   '<div class="financial-metric-card">'+
    '<span class="financial-label">Quota equa modello</span>'+
    '<b class="financial-value" id="slipFairOddsVal">'+fmtOdds(fairCombinedOdds)+'</b>'+
   '</div>'+
   '<div class="financial-metric-card">'+
    '<span class="financial-label">Incasso potenziale lordo</span>'+
    '<b class="financial-value highlight-win" id="slipPotWinVal">'+curr(potentialWin)+'</b>'+
   '</div>'+
   '<div class="financial-metric-card">'+
    '<span class="financial-label">EV stimato · ROI</span>'+
    '<b class="financial-value '+(ev!=null?(ev>=0?"ev-pos":"ev-neg"):"")+'" id="slipEvVal">'+fmtEv(ev)+'</b>'+
   '</div>'+
  '</div>';

 target.innerHTML='<details class="manual-slip-dropdown" '+(slipExpanded?'open':'')+'>'+
  '<summary><span>Anteprima schedina · '+rows.length+' '+(rows.length===1?'pronostico':'pronostici')+(potentialWin!=null?' · vincita '+curr(potentialWin):'')+'</span><b>'+pct(probability)+'</b></summary>'+
  '<div class="manual-summary-card">'+
   '<div class="manual-summary-top">'+
    '<div><span class="eyebrow">SCHEDINA CORRENTE</span><b>'+rows.length+' eventi</b></div>'+
    '<div class="manual-combined-probability"><span>Probabilità stimata</span><b class="bet-percent bet-percent-total">'+pct(probability)+'</b></div>'+
   '</div>'+
   financialSummaryHtml+
   '<div class="manual-selected-list">'+rowsHtml+'</div>'+
   '<div class="manual-summary-actions">'+
    '<button type="button" id="clearCurrentSlip" class="secondary">Svuota selezioni</button>'+
   '</div>'+
  '</div>'+
 '</details>';
 const details=target.querySelector("details");if(details)details.addEventListener("toggle",()=>{slipExpanded=details.open;});
}
function terminalStatus(status){return ["Vinta","Persa","Conclusa"].includes(status);}
function renderOpenTickets(){
 const target=$("openTickets");if(!target)return;
 const open=archive.filter(ticket=>(ticket.selections||[]).some(selection=>!terminalStatus(selection.status||"Da giocare")));
 if(!open.length){target.innerHTML='<div class="empty-state">Nessuna schedina aperta. Le schedine salvate e non ancora concluse appariranno qui.</div>';return;}
 target.innerHTML=open.map(ticket=>{
  const selections=ticket.selections||[],live=selections.filter(item=>item.status==="In corso").length,done=selections.filter(item=>terminalStatus(item.status)).length;
  const state=live?"In corso":"Da giocare";
  const stake=Number(ticket.stake)||null,potWin=Number(ticket.potentialWin)||null,totalOdds=Number(ticket.totalOdds)||null,ev=Number(ticket.expectedValue)||null;
  const financialMeta=stake!=null?
   '<div class="ticket-financial-meta">'+
    '<span>Puntata: <b>'+curr(stake)+'</b></span>'+
    (totalOdds?'<span>Quota: <b>'+fmtOdds(totalOdds)+'</b></span>':'')+
    (potWin?'<span>Vincita potenziale: <b>'+curr(potWin)+'</b></span>':'')+
    (ev!=null?'<span>EV: <b class="'+(ev>=0?'ev-pos':'ev-neg')+'">'+fmtEv(ev)+'</b></span>':'')+
   '</div>':'';
  return '<article class="archive-ticket"><div class="archive-ticket-head"><b>Schedina · '+esc(ticket.createdAt?new Date(ticket.createdAt).toLocaleString("it-IT"):"—")+'</b><span class="ticket-state '+(live?"live":"scheduled")+'">'+state+'</span></div><small>'+done+'/'+selections.length+' eventi conclusi · probabilità al salvataggio '+pct(ticket.probability)+'</small>'+
   financialMeta+
   selections.map(selection=>{
    const selOdds=selection.odds?' · quota '+fmtOdds(selection.odds):'';
    return '<div class="data-row"><span><b>'+esc(selection.home)+' – '+esc(selection.away)+'</b><small>'+esc(selection.market)+selOdds+' · '+esc(selection.date)+'</small></span><b class="ticket-monitor-state">'+esc(selection.status||"Da giocare")+(selection.result?' · '+esc(selection.result):'')+'</b></div>';
   }).join("")+
   '<div class="settings-actions">' +
    '<button type="button" class="secondary settle-btn-win" data-settle-win="'+esc(ticket.id)+'">🏆 Segna Vinta</button>' +
    '<button type="button" class="secondary settle-btn-loss" data-settle-loss="'+esc(ticket.id)+'">❌ Segna Persa</button>' +
    '<button type="button" class="secondary" data-share="'+esc(ticket.id)+'">Condividi</button>' +
    '<button type="button" class="secondary" data-delete="'+esc(ticket.id)+'">Elimina</button>' +
   '</div></article>';
 }).join("");
}
function renderArchive(){
 const target=$("slipArchive");if(!target)return;
 const closed=archive.filter(ticket=>(ticket.selections||[]).length&&(ticket.selections||[]).every(selection=>terminalStatus(selection.status||"Da giocare")));
 if(!closed.length){target.innerHTML='<div class="empty-state">Le schedine concluse appariranno qui dopo l’aggiornamento dei risultati.</div>';return;}

 const settled=closed.filter(ticket=>(ticket.selections||[]).every(selection=>selection.status==="Vinta"||selection.status==="Persa")&&Number.isFinite(Number(ticket.stake))&&Number(ticket.stake)>0);
 let totalStaked=0,totalWon=0,wonCount=0,lostCount=0;
 settled.forEach(ticket=>{
  const stake=Number(ticket.stake)||0;totalStaked+=stake;
  const isWon=(ticket.selections||[]).every(s=>s.status==="Vinta");
  const isLost=(ticket.selections||[]).some(s=>s.status==="Persa");
  if(isWon){
   wonCount++;
   const actualWon=Number.isFinite(Number(ticket.actualPayout))?Number(ticket.actualPayout):(Number(ticket.potentialWin)||(stake*(Number(ticket.totalOdds)||1)));
   totalWon+=actualWon;
  }else if(isLost){
   lostCount++;
   if(Number.isFinite(Number(ticket.actualPayout))&&Number(ticket.actualPayout)>0){totalWon+=Number(ticket.actualPayout);}
  }
 });
 const netProfit=totalWon-totalStaked;
 const roi=totalStaked>0?(netProfit/totalStaked):null;
 const winRate=settled.length>0?(wonCount/settled.length):null;

 const bankrollCard=
  '<div class="bankroll-dashboard-card">'+
   '<div class="bankroll-dashboard-head"><span class="eyebrow">IL TUO BANKROLL</span><h3>Riepilogo finanziario schedine</h3></div>'+
   '<div class="bankroll-stats-grid">'+
    '<div class="bankroll-stat-item"><span>Totale puntato</span><b>'+curr(totalStaked)+'</b></div>'+
    '<div class="bankroll-stat-item"><span>Totale incassato</span><b>'+curr(totalWon)+'</b></div>'+
    '<div class="bankroll-stat-item"><span>Bilancio netto</span><b class="'+(netProfit>=0?'profit-pos':'profit-neg')+'">'+(netProfit>=0?'+':'')+curr(netProfit)+'</b></div>'+
    '<div class="bankroll-stat-item"><span>ROI</span><b class="'+(roi!=null?(roi>=0?'profit-pos':'profit-neg'):'')+'">'+(roi!=null?(roi>=0?'+':'')+(roi*100).toFixed(1)+'%':'—')+'</b></div>'+
    '<div class="bankroll-stat-item"><span>Win Rate</span><b>'+(winRate!=null?(winRate*100).toFixed(1)+'% ('+wonCount+'/'+closed.length+')':'—')+'</b></div>'+
   '</div>'+
  '</div>';

 const ticketsHtml=closed.map(ticket=>{
  const isWon=(ticket.selections||[]).every(s=>s.status==="Vinta");
  const isLost=(ticket.selections||[]).some(s=>s.status==="Persa");
  const ticketStatusLabel=isWon?"Vinta":isLost?"Persa":"Conclusa";
  const ticketStatusClass=isWon?"ticket-state-won":isLost?"ticket-state-lost":"";
  const stake=Number(ticket.stake)||null,potWin=Number(ticket.potentialWin)||null,totalOdds=Number(ticket.totalOdds)||null;
  const profitLoss=isWon?(potWin!=null&&stake!=null?potWin-stake:null):isLost?(stake!=null?-stake:null):null;

  const financialMeta=stake!=null?
   '<div class="ticket-financial-meta">'+
    '<span>Puntata: <b>'+curr(stake)+'</b></span>'+
    (totalOdds?'<span>Quota: <b>'+fmtOdds(totalOdds)+'</b></span>':'')+
    (potWin?'<span>Incasso potenziale: <b>'+curr(potWin)+'</b></span>':'')+
    (ticket.actualPayout!=null?'<span>Incasso effettivo: <b class="profit-pos">'+curr(Number(ticket.actualPayout))+'</b></span>':(isWon&&potWin?'<span>Incasso: <b class="profit-pos">'+curr(potWin)+'</b></span>':'<span>Incasso: <b>0,00 €</b></span>'))+
    (profitLoss!=null?'<span>Bilancio: <b class="'+(profitLoss>=0?'profit-pos':'profit-neg')+'">'+(profitLoss>=0?'+':'')+curr(profitLoss)+'</b></span>':'')+
    (ticket.bookmaker?'<span>Bookmaker: <b>'+esc(ticket.bookmaker)+'</b></span>':'')+
   '</div>':'';

  return '<article class="archive-ticket"><div class="archive-ticket-head"><b>Schedina · '+esc(ticket.createdAt?new Date(ticket.createdAt).toLocaleString("it-IT"):"—")+'</b><span class="ticket-state '+ticketStatusClass+'">'+ticketStatusLabel+'</span></div><small>Probabilità stimata al salvataggio: '+pct(ticket.probability)+'</small>'+
   financialMeta+
   ticket.selections.map(selection=>{
    const selOdds=selection.odds?' · quota '+fmtOdds(selection.odds):'';
    return '<div class="data-row"><span><b>'+esc(selection.home)+' – '+esc(selection.away)+'</b><small>'+esc(selection.market)+selOdds+' · '+esc(selection.date)+'</small></span><b class="ticket-monitor-state '+(selection.status==="Vinta"?"won":selection.status==="Persa"?"lost":"")+'">'+esc(selection.status||"Conclusa")+(selection.result?' · '+esc(selection.result):'')+'</b></div>';
   }).join("")+'<div class="settings-actions">' +
    '<button type="button" class="secondary settle-btn-win" data-settle-win="'+esc(ticket.id)+'">🏆 Segna Vinta</button>' +
    '<button type="button" class="secondary settle-btn-loss" data-settle-loss="'+esc(ticket.id)+'">❌ Segna Persa</button>' +
    '<button type="button" class="secondary" data-share="'+esc(ticket.id)+'">Condividi</button>' +
    '<button type="button" class="secondary" data-delete="'+esc(ticket.id)+'">Elimina</button>' +
   '</div></article>';
 }).join("");

 target.innerHTML=bankrollCard+ticketsHtml;
}
function setBetTab(tab){
 const selected=["create","live","archive"].includes(tab)?tab:"create";
 document.querySelectorAll("[data-bets-tab]").forEach(button=>{const active=button.dataset.betsTab===selected;button.classList.toggle("active",active);button.setAttribute("aria-selected",String(active));});
 ["create","live","archive"].forEach(name=>{const panel=$("betsTab"+name[0].toUpperCase()+name.slice(1));if(panel)panel.hidden=name!==selected;});
}

function setBetWorkspaceTab(tab){
 const selected=tab==="slip"?"slip":"builder";
 document.querySelectorAll("[data-bet-workspace-tab]").forEach(button=>{
  const active=button.dataset.betWorkspaceTab===selected;
  button.classList.toggle("active",active);
  button.setAttribute("aria-selected",String(active));
 });
 const builder=$("betWorkspaceBuilder"),slip=$("betWorkspaceSlip");
 if(builder)builder.hidden=selected!=="builder";
 if(slip)slip.hidden=selected!=="slip";
}
function saveCurrentSlip(){
 const rows=selectedRows();if(!rows.length){$("manualBuilderStatus").textContent="Non ci sono selezioni da salvare. Aggiungi prima una giocata da Partite.";return;}
 const hasAllProbabilities=rows.every(x=>Number.isFinite(x.probability)&&x.probability>0&&x.probability<1);
 const probability=hasAllProbabilities?rows.reduce((v,x)=>v*x.probability,1):null;
 const validOdds=rows.map(r=>r.odds).filter(o=>Number.isFinite(o)&&o>1);
 const hasAllOdds=validOdds.length===rows.length&&rows.length>0;
 const computedOdds=hasAllOdds?validOdds.reduce((acc,o)=>acc*o,1):null;
 const totalOdds=Number.isFinite(computedOdds)?computedOdds:null;
 const potentialWin=totalOdds!=null?currentStake*totalOdds:null;
 const netWin=potentialWin!=null?potentialWin-currentStake:null;
 const expectedValue=totalOdds!=null&&probability!=null?ENGINE().expectedValue(probability,totalOdds):null;

 const item={
  id:"slip-"+Date.now(),
  createdAt:new Date().toISOString(),
  stake:currentStake,
  totalOdds:totalOdds!=null?Number(totalOdds.toFixed(2)):null,
  potentialWin:potentialWin!=null&&Number.isFinite(potentialWin)?Number(potentialWin.toFixed(2)):null,
  netWin:netWin!=null&&Number.isFinite(netWin)?Number(netWin.toFixed(2)):null,
  expectedValue:expectedValue!=null?Number(expectedValue.toFixed(4)):null,
  probability,
  selections:rows.map(x=>({
   sport:x.sport||"football",
   home:x.match.home,
   away:x.match.away,
   date:x.match.date,
   eventId:x.sport==="nba"?(x.match.id||x.nbaPickId||null):null,
   start:x.sport==="nba"?(x.match.start||null):null,
   side:x.sport==="nba"?(String(x.marketKey).endsWith(":home")?"home":"away"):null,
   team:x.sport==="nba"?(String(x.marketKey).endsWith(":home")?x.match.home:x.match.away):null,
   market:x.marketLabel,
   marketKey:x.marketKey,
   probability:x.probability,
   odds:x.odds||null,
   fairOdds:ENGINE().fairOdds(x.probability),
bookmaker:x.bookmaker||null,
   competition:x.match.competition||window.MM.getSelectedCompetition(),
   status:"Da giocare"
  }))
 };
 archive.unshift(item);archive=archive.slice(0,100);save(ARCHIVE_KEY,archive);picks=[];save(PICKS_KEY,[]);window.dispatchEvent(new Event("matchmind:picks-updated"));renderSlip();renderOpenTickets();renderArchive();$("manualBuilderStatus").textContent="Schedina salvata con puntata e quote registrate.";setBetTab("live");
}
let currentBuilderStrategy='balanced';
let proposalTarget=0.55,proposalPeriodLabel='prossima giornata';
let proposalVariants={};
let variantCycleIndex=0;

function generateMotivation(match,marketKey,marketLabel,prob,oddsVal,forecast){
 const h=forecast?.home||{},a=forecast?.away||{};
 const hXg=Number(forecast?.homeXg||1.3),aXg=Number(forecast?.awayXg||1.1);
 const totXg=hXg+aXg;
 const pPct=Math.round(prob*100);
 const evVal=oddsVal&&oddsVal>1?(prob*oddsVal-1):null;
 const evText=evVal!=null?' (Valore atteso: '+(evVal>=0?'+':'')+Math.round(evVal*100)+'% EV)':'';
 const oddsRef=oddsVal?' @'+oddsVal.toFixed(2)+evText:'';
 if(marketKey==='home'){
  const ppg=Number(h.pointsPerGame||1.3).toFixed(1);
  return esc(displayTeam(match.home))+' solida nel rendimento interno (media '+ppg+' pt/gara, '+hXg.toFixed(1)+' xG attesi). Il modello Poisson/Elo stima il '+pPct+'% di vittoria interna'+oddsRef+'.';
 }
 if(marketKey==='away'){
  const ppg=Number(a.pointsPerGame||1.2).toFixed(1);
  return esc(displayTeam(match.away))+' superiore nelle metriche esterne ('+ppg+' pt/gara). MatchMind stima il '+pPct+'% per il successo ospite'+oddsRef+'.';
 }
 if(marketKey==='draw'){
  return 'Elevato equilibrio tattico tra '+esc(displayTeam(match.home))+' e '+esc(displayTeam(match.away))+' (xG attesi '+hXg.toFixed(1)+' vs '+aXg.toFixed(1)+'). Probabilità pareggio stimata al '+pPct+'%'+oddsRef+'.';
 }
 if(marketKey==='over25'||marketKey==='over15'||marketKey==='over35'){
  return 'Indice offensivo combinato elevato ('+totXg.toFixed(1)+' xG attesi complessivi). La distribuzione Poisson assegna il '+pPct+'% a '+esc(marketLabel)+oddsRef+'.';
 }
 if(marketKey==='under25'||marketKey==='under15'||marketKey==='under35'){
  return 'Solidità difensiva e volume di occasioni contenuto (somma '+totXg.toFixed(1)+' xG). Il modello calcola il '+pPct+'% per '+esc(marketLabel)+oddsRef+'.';
 }
 if(marketKey==='bttsYes'){
  return 'Entrambe le formazioni presentano regolarità realizzativa e concessioni difensive recenti. Probabilità Gol al '+pPct+'%'+oddsRef+'.';
 }
 if(marketKey==='bttsNo'){
  return 'Almeno una squadra evidenzia difficoltà offensive o tenuta difensiva superiore. Probabilità No Gol al '+pPct+'%'+oddsRef+'.';
 }
 if(String(marketKey).startsWith('combo:')){
  return 'Esito congiunto ricavato dalla matrice 6×6 dei punteggi esatti. Stima reale del '+pPct+'% considerando la correlazione statistica tra esito e gol'+oddsRef+'.';
 }
 return 'Stima statistica MatchMind calcolata al '+pPct+'%'+oddsRef+' su storico recente e metriche di rendimento.';
}

function resolveOddForMarket(oddsObj,marketKey,prob){
 if(!oddsObj)return{odd:Number((1/Math.max(0.01,prob)).toFixed(2)),isReal:false,bookmaker:'Stima equa MM'};
 let val=null;
 if(marketKey==='home')val=oddsObj.home;
 else if(marketKey==='draw')val=oddsObj.draw;
 else if(marketKey==='away')val=oddsObj.away;
 else if(marketKey==='over25')val=oddsObj.over25;
 else if(marketKey==='under25')val=oddsObj.under25;
 if(Number.isFinite(val)&&val>1)return{odd:val,isReal:true,bookmaker:oddsObj.bookmaker||'Bet365 / Media'};
 return{odd:Number((1/Math.max(0.01,prob)).toFixed(2)),isReal:false,bookmaker:'Stima equa MM'};
}

function buildProposal(){
 proposalGenerated=true;
 const target=Number($("targetProbability").value)/100,maxLegs=Math.max(1,Math.min(15,Number($("maxLegs").value)||5));
 proposalTarget=target;
 const upcoming=fixtures.slice().sort((a,b)=>(a.date+(a.time||"")).localeCompare(b.date+(b.time||"")));
 const period=$("builderPeriod")?.value||"next-round";
 const first=upcoming[0],today=new Date();today.setHours(0,0,0,0);
 let candidateFixtures=upcoming;
 if(period==="next-round"){
  candidateFixtures=!first?[]:(first.round!==null&&first.round!==undefined?upcoming.filter(m=>String(m.round)===String(first.round)):upcoming.filter(m=>Math.abs(Date.parse(m.date+"T12:00:00")-Date.parse(first.date+"T12:00:00"))<=3*86400000));
  proposalPeriodLabel="prossima giornata / turno";
 }else if(period!=="all"){
  const days=Math.max(1,Number(period)||7),end=today.getTime()+days*86400000;
  candidateFixtures=upcoming.filter(m=>{const date=Date.parse(m.date+"T12:00:00");return Number.isFinite(date)&&date>=today.getTime()&&date<=end;});
  proposalPeriodLabel="prossimi "+days+" giorni";
 }else proposalPeriodLabel="tutte le partite future della competizione";
 const overrides={};picks.forEach(p=>{const match=candidateFixtures.find(m=>fixtureKey(m)===fixtureKey(p));if(match)overrides[engineKey(match)]=p.marketKey;});
 const marketMode=$("marketMode")?.value||"auto";

 // Evaluate all candidate selections across matches
 const allEvaluations=[];
 candidateFixtures.forEach(m=>{
  const forecast=getForecast(m);
  if(!forecast||!forecast.probabilities)return;
  const o=window.MM.matchOdds?window.MM.matchOdds(m):null;
  const overrideKey=overrides[engineKey(m)];
  const candidateKeys=overrideKey?[overrideKey]:(marketMode==='single'?[
   'home','draw','away','over15','under15','over25','under25','over35','under35','bttsYes','bttsNo'
  ]:marketMode==='combo-goals'?[
   'home','away','over25','under25','combo:home:over25','combo:home:under25','combo:away:over25','combo:away:under25'
  ]:marketMode==='combo-btts'?[
   'home','away','bttsYes','bttsNo','combo:home:bttsYes','combo:home:bttsNo','combo:away:bttsYes','combo:away:bttsNo'
  ]:[
   'home','draw','away','over15','under15','over25','under25','bttsYes','bttsNo','combo:home:over25','combo:away:over25'
  ]);

  candidateKeys.forEach(mKey=>{
   const prob=ENGINE().marketProbability(forecast,mKey);
   if(!Number.isFinite(prob)||prob<0.15)return;
   const oddInfo=resolveOddForMarket(o,mKey,prob);
   const ev=oddInfo.isReal?(prob*oddInfo.odd)-1:0;
   const label=marketLabel(mKey);
   allEvaluations.push({
    match:m,
    marketKey:mKey,
    marketLabel:label,
    probability:prob,
    odds:oddInfo.odd,
    isRealOdd:oddInfo.isReal,
    bookmaker:oddInfo.bookmaker,
    ev:ev,
    confidence:forecast.sampleEnough?'Campione solido':'Campione parziale',
    preferredByUser:Boolean(overrideKey&&overrideKey===mKey),
    reason:generateMotivation(m,mKey,label,prob,oddInfo.isReal?oddInfo.odd:null,forecast)
   });
  });
 });

 if(!allEvaluations.length){
  $("ticketResults").innerHTML='<div class="notice warning">Nessuna partita analizzabile trovata per il turno selezionato.</div>';
  proposal=[];return;
 }

 // Build 4 distinct strategy pools
 const poolByMatch=(comparator)=>{
  const seenMatches=new Set();
  const sorted=allEvaluations.slice().sort(comparator);
  const picked=[];
  for(const item of sorted){
   const mKey=fixtureKey(item.match);
   if(!seenMatches.has(mKey)){
    seenMatches.add(mKey);
    picked.push(item);
   }
  }
  return picked;
 };

 const accPool=poolByMatch((a,b)=>b.probability-a.probability);
 const valPool=poolByMatch((a,b)=>{
  if(a.isRealOdd&&!b.isRealOdd)return -1;
  if(!a.isRealOdd&&b.isRealOdd)return 1;
  return (b.ev||0)-(a.ev||0);
 }).filter(item=>item.isRealOdd&&item.ev>0);
 const balPool=poolByMatch((a,b)=>{
  const scoreA=(a.probability*0.6)+(Math.max(0,a.ev||0)*0.4);
  const scoreB=(b.probability*0.6)+(Math.max(0,b.ev||0)*0.4);
  return scoreB-scoreA;
 });
 const dblPool=accPool.filter(x=>x.odds>=1.20&&x.odds<=1.75).slice(0,2);

 const makeLegs=(pool,count,offset=0)=>{
  if(!pool.length||!count)return[];
  const actualCount=Math.min(count,pool.length);
  const start=offset%pool.length;
  const ordered=pool.slice(start).concat(pool.slice(0,start));
  const picked=[];let joint=1;
  for(const item of ordered){
   if(picked.length>=actualCount)break;
   const next=joint*item.probability;
   if(picked.length&&next+1e-12<target)continue;
   picked.push(item);joint=next;
  }
  if(!picked.length)picked.push(ordered[0]);
  return picked;
 };

 proposalVariants={
  balanced:makeLegs(balPool,maxLegs,variantCycleIndex),
  accuracy:makeLegs(accPool,maxLegs,variantCycleIndex),
  value:makeLegs(valPool,maxLegs,variantCycleIndex),
  double:makeLegs(dblPool.length===2?dblPool:accPool,2,variantCycleIndex)
 };

 proposal=proposalVariants[currentBuilderStrategy]||proposalVariants.balanced;
 renderProposalUI();
}

function renderProposalUI(){
 if(!proposal||!proposal.length){
  $("ticketResults").innerHTML=currentBuilderStrategy==='value'?'<div class="notice warning">Nessuna opportunità +EV verificabile: servono quote bookmaker reali. Su GitHub Pages le quote non sono disponibili.</div>':'<div class="empty-state">Nessuna selezione generata per questa combinazione.</div>';
  return;
 }
 const mult=proposal.reduce((acc,x)=>acc*(x.odds||1),1);
 const jointProb=proposal.reduce((acc,x)=>acc*x.probability,1);
 const allRealOdds=proposal.every(item=>item.isRealOdd);
 const combEv=allRealOdds?(jointProb*mult)-1:null;
 const estWin10=(10*mult).toFixed(2);
 const proposalDate=value=>{if(!value)return 'Data da definire';const date=new Date(value+'T12:00:00');return Number.isNaN(date.getTime())?String(value):date.toLocaleDateString('it-IT',{weekday:'short',day:'2-digit',month:'short'});};

 const tabsHtml='<div class="proposal-variant-tabs" role="tablist">'+
  [['balanced','⚖️ Bilanciata'],['accuracy','🎯 Più Probabili'],['value','📈 Valore (+EV)'],['double','💰 Raddoppio (~2x)']].map(([key,lbl])=>
   '<button type="button" class="variant-tab'+(currentBuilderStrategy===key?' active':'')+'" data-switch-strategy="'+key+'">'+lbl+'</button>'
  ).join('')+'</div>';

 const thresholdHtml='<div class="proposal-target-status '+(jointProb+1e-12>=proposalTarget?'reached':'not-reached')+'">Obiettivo '+pct(proposalTarget)+' · '+(jointProb+1e-12>=proposalTarget?'raggiunto':'non raggiunto')+' · '+esc(proposalPeriodLabel)+'</div>';
 const summaryHtml=thresholdHtml+'<section class="proposal-summary">'+
  '<div class="proposal-summary-head"><span class="eyebrow">RISULTATO DEL MODELLO</span><span class="proposal-state reached">'+(currentBuilderStrategy==='value'?'Focus Valore':currentBuilderStrategy==='accuracy'?'Focus Accuratezza':currentBuilderStrategy==='double'?'Obiettivo Raddoppio':'Combinazione Ottimale')+'</span></div>'+
  '<div class="proposal-total"><span>'+(allRealOdds?'Quota totale bookmaker':'Moltiplicatore indicativo')+'</span><b>@'+mult.toFixed(2)+'</b></div>'+
  '<div class="proposal-meta">'+
   '<span><small>Probabilità stimata</small><b>'+pct(jointProb)+'</b></span>'+
   '<span><small>Partite</small><b>'+proposal.length+'</b></span>'+
   '<span><small>'+(allRealOdds?'Incasso potenziale · 10€':'Incasso teorico · 10€')+'</small><b>'+estWin10+'€</b></span>'+
   '<span><small>Valore atteso</small><b class="'+(combEv!=null&&combEv>=0?'ev-pos-text':'')+'">'+(combEv==null?'Non calcolabile senza quote reali':(combEv>=0?'+':'')+Math.round(combEv*100)+'% EV')+'</b></span>'+
  '</div>'+
  '<p class="proposal-disclaimer">I calcoli assumono indipendenza statistica tra gli incontri. Quote e probabilità sono stime teoriche; senza quote bookmaker reali, moltiplicatore e incasso sono indicativi e il valore atteso non è calcolabile.</p>'+
 '</section>';

 const listHtml='<div class="proposal-list-heading"><b>Analisi e selezioni proposte</b><small>Tocca una partita per sostituirla o inseriscila singolarmente</small></div>'+
 proposal.map((x,i)=>{
  const evPill=x.isRealOdd?'<span class="pill-ev '+(x.ev>=0?'ev-pos':'ev-neg')+'">'+(x.ev>=0?'+':'')+Math.round(x.ev*100)+'% EV</span>':'<span class="pill-ev" style="background:#1b2430;color:#94a3b8">Quota equa</span>';
  return '<article class="proposal-leg" data-leg-index="'+i+'">'+
   '<div class="proposal-leg-top"><span class="proposal-leg-number">PARTITA '+(i+1)+'</span><time>'+esc(proposalDate(x.match.date))+(x.match.time?' · '+esc(x.match.time):'')+'</time></div>'+
   '<div class="proposal-leg-match">'+esc(displayTeam(x.match.home))+' <span>–</span> '+esc(displayTeam(x.match.away))+'</div>'+
   '<div class="proposal-leg-bottom">'+
    '<div class="proposal-leg-pick"><small>ESITO PROPOSTO</small><b>'+esc(x.marketLabel)+'</b><div class="proposal-leg-odds">Quota <b>@'+Number(x.odds).toFixed(2)+'</b> ('+esc(x.bookmaker)+') '+evPill+'</div></div>'+
    '<div class="proposal-leg-prob"><small>STIMA MM</small><b>'+pct(x.probability)+'</b></div>'+
   '</div>'+
   '<div class="proposal-leg-reason"><div class="reason-head">💡 MOTIVAZIONE MATCHMIND</div><p>'+x.reason+'</p></div>'+
   '<div class="proposal-leg-actions">'+
    '<button type="button" class="ghost small-btn add-single-leg" data-leg-idx="'+i+'">➕ Aggiungi singola</button>'+
    '<button type="button" class="ghost small-btn swap-single-leg" data-leg-idx="'+i+'">🔄 Cambia match</button>'+
   '</div>'+
  '</article>';
 }).join('');

 const actionsHtml='<div class="proposal-action-bar">'+
  '<button id="addProposal" type="button" class="primary proposal-add-button">Aggiungi '+proposal.length+' selezioni alla schedina</button>'+
  '<button id="shuffleProposal" type="button" class="secondary" style="margin-top:8px;width:100%">🎲 Genera variante alternativa</button>'+
 '</div>';

 $("ticketResults").innerHTML=tabsHtml+summaryHtml+listHtml+actionsHtml;
 if($("remixTicket"))$("remixTicket").style.display='inline-block';
}
function applyProposal(){
 proposal.forEach(x=>{
  const m=x.match;
  const p={competition:m.competition||window.MM.getSelectedCompetition(),date:m.date,home:m.home,away:m.away,marketKey:x.marketKey,odds:x.isRealOdd?x.odds:null,bookmaker:x.isRealOdd?x.bookmaker:null};
  const index=picks.findIndex(y=>fixtureKey(y)===fixtureKey(p));
  if(index>=0)picks[index]=p;else if(picks.length<15)picks.push(p);
 });
 writePicks();slipExpanded=true;renderSlip();
 $("manualBuilderStatus").textContent="Proposta aggiunta alla schedina ("+proposal.length+" selezioni con quote e calcoli EV).";
}
function evaluateMarket(key,homeGoals,awayGoals){
 const total=homeGoals+awayGoals;
 if(String(key).startsWith("combo:")){
  const parts=String(key).split(":");
  if(parts.length!==3)return null;
  const result=evaluateMarket(parts[1],homeGoals,awayGoals),secondary=evaluateMarket(parts[2],homeGoals,awayGoals);
  return result===null||secondary===null?null:result&&secondary;
 }
 switch(key){
  case "home":return homeGoals>awayGoals;
  case "draw":return homeGoals===awayGoals;
  case "away":return homeGoals<awayGoals;
  case "bttsYes":return homeGoals>0&&awayGoals>0;
  case "bttsNo":return homeGoals===0||awayGoals===0;
  case "over15":return total>=2;
  case "under15":return total<=1;
  case "over25":return total>=3;
  case "under25":return total<=2;
  case "over35":return total>=4;
  case "under35":return total<=3;
  default:return null;
 }
}
async function updateArchive(){
 const previousStatuses=new Map();archive.forEach(ticket=>(ticket.selections||[]).forEach(selection=>previousStatuses.set([ticket.id,selection.date,norm(selection.home),norm(selection.away)].join("|"),selection.status||"Da giocare")));
 const button=$("refreshArchive");button.disabled=true;button.textContent="Aggiorno…";
 try{
  const fresh=await window.MM.loadData(true),all=[...(fresh.matches||[]),...(fresh.history||[])];
  let liveMatches=[],nbaGames=[];
  try{
   const response=await fetch("./api/live-match?competition="+encodeURIComponent(window.MM.getSelectedCompetition()),{headers:{Accept:"application/json"},cache:"no-store"});
   if(response.ok){const payload=await response.json();if(Array.isArray(payload.matches))liveMatches=payload.matches;}
  }catch(_){/* Public results still update if the optional live provider is unavailable. */}
  if(archive.some(ticket=>(ticket.selections||[]).some(selection=>selection.sport==="nba"||selection.competition==="nba"))){
   try{const response=await fetch("./api/public/nba",{headers:{Accept:"application/json"},cache:"no-store"});if(response.ok){const payload=await response.json();if(Array.isArray(payload.games))nbaGames=payload.games;}}catch(_){/* NBA results remain pending when the public feed is unavailable. */}
  }
  const normDate=value=>String(value||"").slice(0,10);
  archive=archive.map(ticket=>({...ticket,selections:(ticket.selections||[]).map(selection=>{
   if(selection.sport==="nba"||selection.competition==="nba"){
    const game=nbaGames.find(item=>String(item.id)===String(selection.eventId||selection.id||""));
    if(!game)return selection;
    const homeScore=Number(game.hp),awayScore=Number(game.ap),finished=["FT","FINAL","STATUS_FINAL"].includes(String(game.status||"").toUpperCase());
    if(finished&&Number.isFinite(homeScore)&&Number.isFinite(awayScore)){
     const won=selection.side==="home"?homeScore>awayScore:selection.side==="away"?awayScore>homeScore:null;
     return {...selection,result:homeScore+"–"+awayScore,status:won===null?"Conclusa":won?"Vinta":"Persa",settledAt:new Date().toISOString()};
    }
    if(String(game.status||"").toUpperCase()==="LIVE")return {...selection,status:"In corso",result:(Number.isFinite(homeScore)?homeScore:"—")+"–"+(Number.isFinite(awayScore)?awayScore:"—")};
    return terminalStatus(selection.status)?selection:{...selection,status:"Da giocare",result:null};
   }
   const match=all.find(item=>(item.competition||"serie-a")===(selection.competition||"serie-a")&&item.date===selection.date&&norm(item.home)===norm(selection.home)&&norm(item.away)===norm(selection.away));
   if(match&&window.MM.hasScore(match)){
    const homeGoals=Number(match.hg),awayGoals=Number(match.ag),won=evaluateMarket(selection.marketKey,homeGoals,awayGoals);
    return {...selection,result:homeGoals+"–"+awayGoals,status:won===null?"Conclusa":won?"Vinta":"Persa",settledAt:new Date().toISOString()};
   }
   const live=liveMatches.find(item=>normDate(item.date)===normDate(selection.date)&&norm(item.home?.name)===norm(selection.home)&&norm(item.away?.name)===norm(selection.away));
   if(live)return {...selection,status:"In corso",result:(live.goals.home??"—")+"–"+(live.goals.away??"—")+(live.elapsed!==null?" · "+live.elapsed+"′":"")};
   if(selection.status==="In corso")return {...selection,status:"Risultato da confermare"};
   return terminalStatus(selection.status)?selection:{...selection,status:"Da giocare",result:null};
  })}));
  archive.forEach(ticket=>(ticket.selections||[]).forEach(selection=>{
   const key=[ticket.id,selection.date,norm(selection.home),norm(selection.away)].join("|"),old=previousStatuses.get(key),api=window.MMNotifications;
   if(!api||!old||old===selection.status)return;
   if(old==="Da giocare"&&selection.status==="In corso")api.notifyOnce("ticket-start:"+key,"tickets","Schedina · partita iniziata",selection.home+" – "+selection.away+" è iniziata. "+(selection.result||"Risultato in aggiornamento"),"ticket-"+ticket.id,"./bets.html");
   if(old==="In corso"&&["Vinta","Persa","Conclusa"].includes(selection.status))api.notifyOnce("ticket-end:"+key,"tickets","Schedina · esito aggiornato",selection.home+" – "+selection.away+": "+selection.status+" ("+(selection.result||"risultato finale")+")","ticket-"+ticket.id,"./bets.html");
  }));
  save(ARCHIVE_KEY,archive);renderOpenTickets();renderArchive();
  $("archiveStatus").textContent="Schedine aggiornate: risultati conclusi dal calendario pubblico; punteggi live quando API-Football è configurata.";
 }catch(e){$("archiveStatus").textContent="Aggiornamento non riuscito: "+e.message;}
 finally{button.disabled=false;button.textContent="Aggiorna";}
}
async function shareTicket(ticket){
 const financial=ticket.stake!=null?["Puntata: "+curr(Number(ticket.stake)),"Quota totale: "+fmtOdds(Number(ticket.totalOdds)),"Incasso lordo potenziale: "+curr(Number(ticket.potentialWin)),"EV stimato: "+fmtEv(Number(ticket.expectedValue))]:[];
 const body=["MatchMind · Schedina",...ticket.selections.map(x=>x.home+" – "+x.away+" | "+x.market+(x.odds?" @ "+fmtOdds(Number(x.odds)):"")+" | "+pct(x.probability)),"Probabilità combinata stimata: "+pct(ticket.probability),...financial].join("\n");
 try{if(navigator.share)await navigator.share({title:"Schedina MatchMind",text:body});else{await navigator.clipboard.writeText(body);$("archiveStatus").textContent="Schedina copiata negli appunti.";}}catch(e){if(e.name!=="AbortError")$("archiveStatus").textContent="Condivisione non disponibile in questo browser.";}
}

function handleUrlImport(){
 let raw="";
 const hash=window.location.hash||"";
 if(hash.startsWith("#import=")) raw=hash.slice(8);
 else if(hash.startsWith("#import-slip=")) raw=hash.slice(13);
 else if(window.location.search){const params=new URLSearchParams(window.location.search);raw=params.get("import")||"";}
 if(!raw)return;
 try{
  let payload=null;
  try{payload=JSON.parse(raw);}catch(_){try{payload=JSON.parse(atob(raw));}catch(__){}}
  if(!payload)return;
  const items=Array.isArray(payload.selections)?payload.selections:(Array.isArray(payload)?payload:[payload]);
  const defaultBkmk=String(payload.bookmaker||"Esterno");
  const catalog=Array.isArray(allData?.matches)?allData.matches:fixtures;
  let count=0,skipped=0;
  items.forEach(item=>{
   if(!item||!item.home||!item.away||!item.marketKey){skipped++;return;}
   const home=String(item.home).trim(),away=String(item.away).trim();
   const candidates=catalog.filter(m=>isSameMatch(m.home,m.away,home,away));
   const requestedCompetition=String(item.competition||"");
   const match=(requestedCompetition?candidates.find(m=>(m.competition||"serie-a")===requestedCompetition):null)||candidates[0]||null;
   const comp=requestedCompetition||(match&&match.competition)||window.MM.getSelectedCompetition()||"serie-a";
   const date=(match&&match.date)||String(item.date||"");
   const oddsNum=Number(item.odds);
   const odds=Number.isFinite(oddsNum)&&oddsNum>1&&oddsNum<=1000?oddsNum:null;
   const bkmk=String(item.bookmaker||defaultBkmk);
   const pickData={
    competition:comp,date:date||new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Rome"}).format(new Date()),
    home:match?match.home:home,away:match?match.away:away,marketKey:String(item.marketKey),
    odds,bookmaker:bkmk,oddsSource:bkmk,oddsUpdatedAt:Number(item.oddsUpdatedAt||item.timestamp||payload.timestamp||Date.now()),
    oddsImportedAt:Date.now(),oddsEventId:String(item.eventId||"")
   };
   const fKey=fixtureKey(pickData);
   if(item.context&&typeof item.context==="object"){contexts[fKey]={...(contexts[fKey]||{}),...item.context};save(CONTEXT_KEY,contexts);}
   const existingIdx=picks.findIndex(p=>p&&p.sport!=="nba"&&(p.competition||"serie-a")===comp&&isSameMatch(p.home,p.away,pickData.home,pickData.away)&&p.marketKey===pickData.marketKey);
   if(existingIdx>=0)picks[existingIdx]={...picks[existingIdx],...pickData};
   else if(picks.length<30)picks.push(pickData);
   else {skipped++;return;}
   count++;
  });
  if(count>0){
   if(payload.stake&&Number(payload.stake)>=0.5){currentStake=Number(payload.stake);save(STAKE_KEY,currentStake);}
   writePicks();slipExpanded=true;setBetTab("create");setBetWorkspaceTab("slip");renderSlip();updateSlipCalculations();
   const statusLine=$("manualBuilderStatus");
   if(statusLine)statusLine.innerHTML='<span style="color:#c4f36a;font-weight:700;">Quote importate: '+count+' selezioni da '+esc(defaultBkmk)+'.</span> '+(skipped?skipped+' elementi ignorati. ':'')+'Le probabilità restano quelle del modello MatchMind; verifica sempre la quota prima di giocare.';
   if(window.history&&window.history.replaceState)window.history.replaceState(null,"",window.location.pathname+window.location.search);
  }else{
   const statusLine=$("manualBuilderStatus");if(statusLine)statusLine.textContent="Nessuna selezione Sisal importabile. Controlla partita e mercato.";
  }
 }catch(err){console.warn("MatchMind import error:",err);const statusLine=$("manualBuilderStatus");if(statusLine)statusLine.textContent="Importazione quote non riuscita: "+(err.message||"payload non valido");}
}

function initEvents(){

 document.querySelectorAll("[data-bets-tab]").forEach(button=>button.addEventListener("click",()=>{setBetTab(button.dataset.betsTab);if(button.dataset.betsTab==="live")updateArchive();}));
 document.querySelectorAll("[data-bet-workspace-tab]").forEach(button=>button.addEventListener("click",()=>setBetWorkspaceTab(button.dataset.betWorkspaceTab)));
 $("saveManualSlip")?.addEventListener("click",saveCurrentSlip);
 const handleContextChange=event=>{
  const select=event.target.closest("[data-context-field]");
  if(select){
   const fKey=select.dataset.context,field=select.dataset.contextField;
   if(fKey&&field){
    contexts[fKey]=contexts[fKey]||{};
    contexts[fKey][field]=Number(select.value);
    save(CONTEXT_KEY,contexts);
    renderSlip();
    renderFixtures();
   }
  }
 };
 $("manualSlipSummary").addEventListener("change",handleContextChange);
 $("manualFixtures")?.addEventListener("change",handleContextChange);

 $("manualSlipSummary").addEventListener("input",event=>{
  const oddsInput=event.target.closest(".manual-odds-input");
  if(oddsInput){
   const fKey=oddsInput.dataset.oddsFor,val=Number(oddsInput.value);
   if(fKey.startsWith("nba|")){const id=fKey.slice(4),all=readPicks(),pick=all.find(p=>p&&p.sport==="nba"&&String(p.id||p.eventId)===id);if(pick){pick.odds=(Number.isFinite(val)&&val>1&&val<=1000)?val:null;save(PICKS_KEY,all);window.dispatchEvent(new Event("matchmind:picks-updated"));renderSlip();}return;}
   const all=readPicks();
   const pick=all.find(p=>p&&p.sport!=="nba"&&fixtureKey({...p,competition:p.competition||"serie-a"})===fKey);
   if(pick){pick.odds=(Number.isFinite(val)&&val>1&&val<=1000)?val:null;save(PICKS_KEY,all);window.dispatchEvent(new Event("matchmind:picks-updated"));renderSlip();}
   return;
  }
  const stakeInput=event.target.closest("#slipStakeInput");
  if(stakeInput){
   const val=Number(stakeInput.value);
   if(Number.isFinite(val)&&val>=0.5&&val<=100000){currentStake=val;save(STAKE_KEY,currentStake);updateSlipCalculations();}
  }
 });
 $("manualSlipSummary").addEventListener("click",event=>{
  const presetBtn=event.target.closest("[data-context-preset]");
  if(presetBtn){
   const fKey=presetBtn.dataset.contextPreset;
   const type=presetBtn.dataset.presetType;
   contexts[fKey]=contexts[fKey]||{};
   if(type==="heavy-abs-home"){
    contexts[fKey].attackingAbsencesHome=2;
    contexts[fKey].defensiveAbsencesHome=1;
   }else if(type==="heavy-abs-away"){
    contexts[fKey].attackingAbsencesAway=2;
    contexts[fKey].defensiveAbsencesAway=1;
   }else if(type==="high-mot-home"){
    contexts[fKey].motivationHome=1;
   }else if(type==="high-mot-away"){
    contexts[fKey].motivationAway=1;
   }else if(type==="reset"){
    delete contexts[fKey];
   }
   save(CONTEXT_KEY,contexts);
   renderSlip();
   renderFixtures();
   return;
  }
  const remove=event.target.closest("[data-remove]");if(remove){
    const key=remove.dataset.remove,all=readPicks();
    const remaining=key.startsWith("nba|")
      ?all.filter(p=>!(p&&p.sport==="nba"&&String(p.id||p.eventId)===key.slice(4)))
      :all.filter(p=>!(p&&p.sport!=="nba"&&fixtureKey({...p,competition:p.competition||"serie-a"})===key));
    save(PICKS_KEY,remaining);
    picks=remaining.filter(p=>p&&p.sport!=="nba"&&(p.competition||"serie-a")===window.MM.getSelectedCompetition());
    window.dispatchEvent(new Event("matchmind:picks-updated"));renderSlip();return;
   }
  const market=event.target.closest("[data-pick]");if(market){const fixture=fixtures.find(item=>fixtureKey(item)===market.dataset.pick);if(!fixture)return;const current=selectedFor(fixture);if(current&&current.marketKey===market.dataset.market)picks=picks.filter(item=>fixtureKey(item)!==fixtureKey(fixture));else if(current)current.marketKey=market.dataset.market;else if(picks.length<15)picks.push({competition:fixture.competition||window.MM.getSelectedCompetition(),date:fixture.date,home:fixture.home,away:fixture.away,marketKey:market.dataset.market});writePicks();renderFixtures();renderSlip();return;}
  if(event.target.closest("#archiveCurrentSlip"))saveCurrentSlip();
  if(event.target.closest("#clearCurrentSlip")){picks=[];slipExpanded=false;save(PICKS_KEY,[]);window.dispatchEvent(new Event("matchmind:picks-updated"));renderSlip();}
 });
 $("targetProbability").addEventListener("input",()=>{$("targetProbabilityLabel").textContent=$("targetProbability").value+"%";if(proposalGenerated)buildProposal();});
 $("maxLegs").addEventListener("change",()=>{if(proposalGenerated)buildProposal();});
 $("marketMode").addEventListener("change",()=>{if(proposalGenerated)buildProposal();});
 $("builderPeriod")?.addEventListener("change",()=>{if(proposalGenerated)buildProposal();});
 $("buildTicket").addEventListener("click",buildProposal);
 $("ticketResults").addEventListener("click",event=>{
  const addAll=event.target.closest("#addProposal");
  if(addAll){applyProposal();return;}
  const switchBtn=event.target.closest("[data-switch-strategy]");
  if(switchBtn){
   currentBuilderStrategy=switchBtn.dataset.switchStrategy;
   updateBuilderPillUI(currentBuilderStrategy);
   proposal=proposalVariants[currentBuilderStrategy]||proposalVariants.balanced;
   renderProposalUI();
   return;
  }
  const shuffleBtn=event.target.closest("#shuffleProposal");
  if(shuffleBtn){
   variantCycleIndex++;
   buildProposal();
   return;
  }
  const addSingle=event.target.closest(".add-single-leg");
  if(addSingle){
   const idx=Number(addSingle.dataset.legIdx);
   const item=proposal[idx];
   if(item){
    const m=item.match,p={competition:m.competition||window.MM.getSelectedCompetition(),date:m.date,home:m.home,away:m.away,marketKey:item.marketKey,odds:item.isRealOdd?item.odds:null,bookmaker:item.isRealOdd?item.bookmaker:null};
    const existingIdx=picks.findIndex(y=>fixtureKey(y)===fixtureKey(p));
    if(existingIdx>=0)picks[existingIdx]=p;else if(picks.length<15)picks.push(p);
    writePicks();slipExpanded=true;renderSlip();
    addSingle.textContent='✓ Aggiunta!';
    setTimeout(()=>{if(addSingle)addSingle.textContent='➕ Aggiungi singola';},2000);
   }
   return;
  }
  const swapBtn=event.target.closest(".swap-single-leg");
  if(swapBtn){
   variantCycleIndex++;
   buildProposal();
   return;
  }
 });

 function updateBuilderPillUI(stratKey){
  $("builderStrategyPills")?.querySelectorAll("button").forEach(btn=>{
   const active=btn.dataset.bstrategy===stratKey;
   btn.classList.toggle("active",active);
   btn.setAttribute("aria-pressed",String(active));
  });
  const descEl=$("builderStrategyDesc");
  if(descEl){
   descEl.textContent=stratKey==='accuracy'?'Massima probabilità: esiti con elevata affidabilità statistica (≥58%).':stratKey==='value'?'Massima remuneratività: selezioni con quota del bookmaker superiore alla stima equa (+EV).':stratKey==='double'?'Raddoppio: 2 eventi solidi selezionati per raggiungere circa quota @2.00 complessiva.':'Bilanciamento ideale: quote con valore atteso positivo ed esiti solidi.';
  }
 }

 $("builderStrategyPills")?.addEventListener("click",event=>{
  const btn=event.target.closest("[data-bstrategy]");
  if(!btn)return;
  currentBuilderStrategy=btn.dataset.bstrategy;
  updateBuilderPillUI(currentBuilderStrategy);
  if(proposalGenerated){
   proposal=proposalVariants[currentBuilderStrategy]||proposalVariants.balanced;
   renderProposalUI();
  }
 });

 $("remixTicket")?.addEventListener("click",()=>{
  variantCycleIndex++;
  buildProposal();
 });
 $("refreshArchive").addEventListener("click",updateArchive);
 ["slipArchive","openTickets"].forEach(id=>$(id)?.addEventListener("click",event=>{
  const del=event.target.closest("[data-delete]");if(del){archive=archive.filter(x=>x.id!==del.dataset.delete);save(ARCHIVE_KEY,archive);renderOpenTickets();renderArchive();return;}
  const shared=event.target.closest("[data-share]");if(shared){const ticket=archive.find(x=>x.id===shared.dataset.share);if(ticket)shareTicket(ticket);return;}
  const winBtn=event.target.closest("[data-settle-win]");if(winBtn){
   const ticket=archive.find(x=>x.id===winBtn.dataset.settleWin);
   if(ticket){
    (ticket.selections||[]).forEach(s=>s.status="Vinta");
    save(ARCHIVE_KEY,archive);renderOpenTickets();renderArchive();
    $("archiveStatus").textContent="Schedina segnata come Vinta. Incasso accreditato nel bankroll.";
   }
   return;
  }
  const lossBtn=event.target.closest("[data-settle-loss]");if(lossBtn){
   const ticket=archive.find(x=>x.id===lossBtn.dataset.settleLoss);
   if(ticket){
    (ticket.selections||[]).forEach(s=>s.status="Persa");
    ticket.actualPayout=0;
    save(ARCHIVE_KEY,archive);renderOpenTickets();renderArchive();
    $("archiveStatus").textContent="Schedina segnata come Persa.";
   }
   return;
  }
  const reopenBtn=event.target.closest("[data-reopen]");if(reopenBtn){
   const ticket=archive.find(x=>x.id===reopenBtn.dataset.reopen);
   if(ticket){
    (ticket.selections||[]).forEach(s=>s.status="Da giocare");
    delete ticket.actualPayout;
    save(ARCHIVE_KEY,archive);renderOpenTickets();renderArchive();
   }
   return;
  }
  const editPayoutBtn=event.target.closest("[data-edit-payout]");if(editPayoutBtn){
   const ticket=archive.find(x=>x.id===editPayoutBtn.dataset.editPayout);
   if(ticket){
    const currentVal=ticket.actualPayout!=null?ticket.actualPayout:(ticket.potentialWin||0);
    const inputVal=window.prompt("Inserisci l'incasso effettivo (€) per questa schedina:",currentVal);
    if(inputVal!==null){
     const numVal=parseFloat(inputVal.replace(",","."));
     if(Number.isFinite(numVal)&&numVal>=0){
      ticket.actualPayout=numVal;
      save(ARCHIVE_KEY,archive);renderArchive();
      $("archiveStatus").textContent="Incasso effettivo aggiornato a "+curr(numVal)+".";
     }
    }
   }
   return;
  }
 }));
 window.addEventListener("hashchange",handleUrlImport);
}
let monitorTimer=null;
function hasTodayOpenTicket(){
 const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Rome",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 return archive.some(ticket=>(ticket.selections||[]).some(selection=>selection.date===today&&!terminalStatus(selection.status||"Da giocare")));
}
document.addEventListener("DOMContentLoaded",async()=>{
 initEvents();
 const initialPicks=readPicks();
 setBetWorkspaceTab(location.hash.includes("manualBuilder")||location.hash.includes("saveManualSlip")||initialPicks.length?"slip":"builder");
 $("globalStatus").textContent="Carico calendario e risultati storici…";
 try{
  await window.MM.loadOdds?.();
  await window.MM.loadInjuries?.();
  allData=await window.MM.loadData();data=window.MM.forCompetition(allData);
  fixtures=(data.matches||[]).filter(window.MM.upcoming).slice().sort((a,b)=>(a.date+(a.time||"")).localeCompare(b.date+(b.time||"")));
  picks=readPicks().filter(p=>p&&p.sport!=="nba"&&(p.competition||"serie-a")===window.MM.getSelectedCompetition()&&fixtures.some(m=>fixtureKey(m)===fixtureKey(p)));
  contexts=read(CONTEXT_KEY,{});
  archive=read(ARCHIVE_KEY,[]);
  if(!Array.isArray(archive))archive=[];
  if(!archive.length){
    const legacy=read("matchmind-slip-archive-v1",[]);
    if(Array.isArray(legacy)&&legacy.length){
      archive=legacy.map(ticket=>({...ticket,probability:Number.isFinite(ticket.probability)?ticket.probability:(ticket.selections||[]).reduce((v,item)=>v*(Number.isFinite(item.probability)?item.probability:1),1)}));
      save(ARCHIVE_KEY,archive);
    }
  }
  const teamSelect=$("betsTeam"),roundSelect=$("betsRound");
  if(teamSelect)teamSelect.innerHTML='<option value="">Tutte le squadre</option>'+window.MM.getTeams(fixtures).map(t=>'<option value="'+esc(t)+'">'+esc(displayTeam(t))+'</option>').join("");
  if(roundSelect){const rounds=[...new Set(fixtures.map(m=>String(m.round||"")).filter(Boolean))].sort((a,b)=>Number(a)-Number(b));roundSelect.innerHTML='<option value="">Tutte le giornate</option>'+rounds.map(n=>'<option value="'+esc(n)+'">Giornata '+esc(n)+'</option>').join("");}
  renderFixtures();renderSlip();renderOpenTickets();renderArchive();
  handleUrlImport();
  $("globalStatus").textContent=(data.source==="cache"?"Dati caricati dalla cache locale":"Dati aggiornati")+" · "+fixtures.length+" partite future · "+data.history.length+" risultati storici.";
  $("targetProbabilityLabel").textContent=$("targetProbability").value+"%";
  monitorTimer=window.setInterval(()=>{const active=document.querySelector("[data-bets-tab=\"live\"]")?.getAttribute("aria-selected")==="true";if(active&&!document.hidden&&hasTodayOpenTicket())updateArchive();},900000);
 }catch(e){$("globalStatus").textContent="Dati non disponibili: "+(e.message||"errore sconosciuto");$("manualBuilderStatus").textContent="Calendario non disponibile: impossibile calcolare le probabilità delle selezioni.";}
});
window.addEventListener("pagehide",()=>{if(monitorTimer)clearInterval(monitorTimer);});
})();