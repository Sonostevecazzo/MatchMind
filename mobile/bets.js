/* MatchMind: local statistical bet builder. No bookmaker or odds dependencies. */
(function(){
"use strict";
const $=id=>document.getElementById(id),ENGINE=()=>window.MatchMindBets;
const PICKS_KEY="matchmind-manual-selections-v1",CONTEXT_KEY="matchmind-match-context-v2",ARCHIVE_KEY="matchmind-slip-archive-v2";
let data=null,fixtures=[],picks=[],contexts={},archive=[],proposal=[],visibleFixtureLimit=12,slipExpanded=false,proposalGenerated=false;
const esc=value=>window.MM.esc(String(value==null?"":value));
const pct=value=>Number.isFinite(value)?(value*100).toLocaleString("it-IT",{maximumFractionDigits:1})+"%":"—";
const norm=value=>window.MM.norm(value);
const fixtureKey=m=>[(m.competition||"serie-a"),m.date,norm(m.home),norm(m.away)].join("|");
const engineKey=m=>[norm(m.home),norm(m.away)].sort().join("|")+"|"+m.date;
const read=(key,fallback)=>{try{const value=JSON.parse(localStorage.getItem(key)||"null");return value==null?fallback:value;}catch(_){return fallback;}};
const save=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch(_){$("globalStatus").textContent="Spazio locale insufficiente per salvare i dati."; }};
const markets=()=>ENGINE().marketChoices();
function getContext(match){return contexts[fixtureKey(match)]||{};}
function getForecast(match){return window.MM.forecast(match,data.history,getContext(match));}
function marketProbability(forecast,key){return ENGINE().marketProbability(forecast,key);}
function readPicks(){const stored=read(PICKS_KEY,[]);return Array.isArray(stored)?stored:[];}
function writePicks(){save(PICKS_KEY,picks);}
function selectedFor(match){return picks.find(p=>fixtureKey(p)===fixtureKey(match));}
function selectOptions(value){return [0,1,2,3].map(n=>'<option value="'+n+'"'+(Number(value||0)===n?' selected':'')+'>'+n+'</option>').join("");}
function motivationOptions(value){return [{v:-1,t:"Bassa"},{v:0,t:"Neutra / automatica"},{v:1,t:"Alta"}].map(x=>'<option value="'+x.v+'"'+(Number(value||0)===x.v?' selected':'')+'>'+x.t+'</option>').join("");}
function renderFixture(match){
 const f=getForecast(match),selected=selectedFor(match),ctx=getContext(match),p=f.probabilities;
 const form=x=>x.form&&x.form.length?x.form.join(" · "):"n.d.";
 const stand=x=>x.available?"#"+x.rank+" · "+x.points+" pt · "+x.objective:"classifica non disponibile";
 const choices=markets().map(([key,label])=>({key,label,probability:marketProbability(f,key)}));
 const buttons=choices.map(item=>'<button type="button" class="fixture-market-button'+(selected&&selected.marketKey===item.key?' is-selected':'')+'" data-pick="'+esc(fixtureKey(match))+'" data-market="'+esc(item.key)+'" aria-pressed="'+String(Boolean(selected&&selected.marketKey===item.key))+'"><span>'+esc(item.label)+'</span><b>'+pct(item.probability)+'</b></button>').join("");
 const fields=[
  ["attackingAbsencesHome","Attaccanti titolari assenti · "+match.home,ctx.attackingAbsencesHome],
  ["defensiveAbsencesHome","Difensori titolari assenti · "+match.home,ctx.defensiveAbsencesHome],
  ["attackingAbsencesAway","Attaccanti titolari assenti · "+match.away,ctx.attackingAbsencesAway],
  ["defensiveAbsencesAway","Difensori titolari assenti · "+match.away,ctx.defensiveAbsencesAway]
 ];
 const absenceHtml=fields.map(([key,label,value])=>'<label class="context-field">'+esc(label)+'<select data-context="'+esc(fixtureKey(match))+'" data-context-field="'+key+'">'+selectOptions(value)+'</select></label>').join("");
 const motivationHtml='<div class="context-motivation"><label class="context-field">Motivazione '+esc(match.home)+'<select data-context="'+esc(fixtureKey(match))+'" data-context-field="motivationHome">'+motivationOptions(ctx.motivationHome)+'</select></label><label class="context-field">Motivazione '+esc(match.away)+'<select data-context="'+esc(fixtureKey(match))+'" data-context-field="motivationAway">'+motivationOptions(ctx.motivationAway)+'</select></label></div>';
 return '<article class="manual-fixture-card"><div class="manual-fixture-heading"><div><b>'+esc(match.home)+' – '+esc(match.away)+'</b><small>'+esc(window.MM.shortDate(match))+(match.time?' · '+esc(match.time):'')+' · confidenza '+esc(f.confidence)+'</small></div>'+(selected?'<span class="manual-picked-label">'+esc(selected.marketLabel||selected.marketKey)+'</span>':'')+'</div>'+
 '<div class="fixture-forecast-strip"><span>1 <b>'+pct(p.home)+'</b></span><span>X <b>'+pct(p.draw)+'</b></span><span>2 <b>'+pct(p.away)+'</b></span><span>xG <b>'+f.homeXg.toFixed(2)+' – '+f.awayXg.toFixed(2)+'</b></span></div>'+
 '<div class="fixture-form-context"><span>'+esc(match.home)+' forma: <b>'+esc(form(f.home))+'</b></span><span>'+esc(match.away)+' forma: <b>'+esc(form(f.away))+'</b></span><span>'+esc(stand(f.standings.home))+'</span><span>'+esc(stand(f.standings.away))+'</span></div>'+
 '<div class="fixture-market-options">'+buttons+'</div><details class="manual-other-markets"><summary>Contesto squadra: assenze, infortuni e motivazione</summary><div class="context-controls"><div class="context-grid">'+absenceHtml+'</div>'+motivationHtml+'<small>Inserisci solo titolari realmente indisponibili. Le assenze sono una correzione indicativa, non una valutazione del valore individuale del giocatore. La motivazione automatica deriva dalla classifica; l’impostazione manuale è una tua valutazione.</small></div></details></article>';
}
function renderFixtures(){
 const target=$("manualFixtures"),query=norm($("matchSearch").value),date=$("betsDate")?.value||"",team=$("betsTeam")?.value||"",round=$("betsRound")?.value||"";
 const rows=fixtures.filter(m=>(!query||norm(m.home).includes(query)||norm(m.away).includes(query))&&(!date||m.date===date)&&(!team||norm(m.home)===norm(team)||norm(m.away)===norm(team))&&(!round||String(m.round||"")===round));
 const visible=rows.slice(0,visibleFixtureLimit);
 target.innerHTML=visible.length?visible.map(renderFixture).join(""):'<div class="empty-state">Nessuna partita corrisponde ai filtri. Modifica la ricerca.</div>';
 const count=$("betsFixtureCount");if(count)count.textContent=rows.length+" partite trovate · visualizzate "+visible.length;
 const more=$("moreBetFixtures");if(more)more.hidden=rows.length<=visibleFixtureLimit;
}
function selectedRows(){
 return picks.map(p=>{const match=fixtures.find(m=>fixtureKey(m)===fixtureKey(p));if(!match)return null;const forecast=getForecast(match),market=markets().find(x=>x[0]===p.marketKey);if(!market)return null;return{match,marketKey:p.marketKey,marketLabel:market[1],probability:marketProbability(forecast,p.marketKey),forecast};}).filter(Boolean);
}
function renderSlip(){
 const target=$("manualSlipSummary"),rows=selectedRows();
 if(!rows.length){target.innerHTML="";slipExpanded=false;return;}
 const probability=rows.reduce((v,x)=>v*(Number.isFinite(x.probability)?x.probability:0),1);
 target.innerHTML='<details class="manual-slip-dropdown" '+(slipExpanded?'open':'')+'><summary><span>Anteprima schedina · '+rows.length+' pronostici</span><b>'+pct(probability)+'</b></summary><div class="manual-summary-card"><div class="manual-summary-top"><div><span class="eyebrow">SCHEDINA CORRENTE</span><b>'+rows.length+' eventi</b></div><div class="manual-combined-probability"><span>Probabilità stimata</span><b class="bet-percent bet-percent-total">'+pct(probability)+'</b></div></div><div class="manual-selected-list">'+rows.map(row=>'<div class="manual-selected-row"><span><b>'+esc(row.match.home)+' – '+esc(row.match.away)+'</b><small>'+esc(row.marketLabel)+' · '+esc(row.match.date)+' · '+pct(row.probability)+'</small></span><button type="button" class="manual-remove-button" data-remove="'+esc(fixtureKey(row.match))+'" aria-label="Rimuovi selezione">×</button></div>').join("")+'</div><div class="manual-summary-actions"><button type="button" id="archiveCurrentSlip" class="primary">Salva schedina</button><button type="button" id="clearCurrentSlip" class="secondary">Svuota</button></div></div></details>';
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
  return '<article class="archive-ticket"><div class="archive-ticket-head"><b>Schedina · '+esc(ticket.createdAt?new Date(ticket.createdAt).toLocaleString("it-IT"):"—")+'</b><span class="ticket-state '+(live?"live":"scheduled")+'">'+state+'</span></div><small>'+done+'/'+selections.length+' eventi conclusi · probabilità al salvataggio '+pct(ticket.probability)+'</small>'+
   selections.map(selection=>'<div class="data-row"><span><b>'+esc(selection.home)+' – '+esc(selection.away)+'</b><small>'+esc(selection.market)+' · '+esc(selection.date)+'</small></span><b class="ticket-monitor-state">'+esc(selection.status||"Da giocare")+(selection.result?' · '+esc(selection.result):'')+'</b></div>').join("")+
   '<div class="settings-actions"><button type="button" class="secondary" data-share="'+esc(ticket.id)+'">Condividi</button><button type="button" class="secondary" data-delete="'+esc(ticket.id)+'">Elimina</button></div></article>';
 }).join("");
}
function renderArchive(){
 const target=$("slipArchive");if(!target)return;
 const closed=archive.filter(ticket=>(ticket.selections||[]).length&&(ticket.selections||[]).every(selection=>terminalStatus(selection.status||"Da giocare")));
 if(!closed.length){target.innerHTML='<div class="empty-state">Le schedine concluse appariranno qui dopo l’aggiornamento dei risultati.</div>';return;}
 target.innerHTML=closed.map(ticket=>'<article class="archive-ticket"><div class="archive-ticket-head"><b>Schedina · '+esc(ticket.createdAt?new Date(ticket.createdAt).toLocaleString("it-IT"):"—")+'</b><span>Conclusa</span></div><small>Probabilità stimata al salvataggio: '+pct(ticket.probability)+'</small>'+ticket.selections.map(selection=>'<div class="data-row"><span><b>'+esc(selection.home)+' – '+esc(selection.away)+'</b><small>'+esc(selection.market)+' · '+esc(selection.date)+'</small></span><b class="ticket-monitor-state '+(selection.status==="Vinta"?"won":selection.status==="Persa"?"lost":"")+'">'+esc(selection.status||"Conclusa")+(selection.result?' · '+esc(selection.result):'')+'</b></div>').join("")+'<div class="settings-actions"><button type="button" class="secondary" data-share="'+esc(ticket.id)+'">Condividi</button><button type="button" class="secondary" data-delete="'+esc(ticket.id)+'">Elimina</button></div></article>').join("");
}
function setBetTab(tab){
 const selected=["create","live","archive"].includes(tab)?tab:"create";
 document.querySelectorAll("[data-bets-tab]").forEach(button=>{const active=button.dataset.betsTab===selected;button.classList.toggle("active",active);button.setAttribute("aria-selected",String(active));});
 ["create","live","archive"].forEach(name=>{const panel=$("betsTab"+name[0].toUpperCase()+name.slice(1));if(panel)panel.hidden=name!==selected;});
}
function saveCurrentSlip(){
 const rows=selectedRows();if(!rows.length){$("archiveStatus").textContent="Non ci sono selezioni da salvare.";return;}
 const probability=rows.reduce((v,x)=>v*x.probability,1);
 const item={id:"slip-"+Date.now(),createdAt:new Date().toISOString(),probability,selections:rows.map(x=>({home:x.match.home,away:x.match.away,date:x.match.date,market:x.marketLabel,marketKey:x.marketKey,probability:x.probability,competition:x.match.competition||window.MM.getSelectedCompetition(),status:"Da giocare"}))};
 archive.unshift(item);archive=archive.slice(0,100);save(ARCHIVE_KEY,archive);renderOpenTickets();renderArchive();$("archiveStatus").textContent="Schedina salvata su questo dispositivo.";setBetTab("live");
}
function buildProposal(){
 proposalGenerated=true;
 const target=Number($("targetProbability").value)/100,maxLegs=Number($("maxLegs").value);
 const upcoming=fixtures.slice().sort((a,b)=>(a.date+(a.time||"")).localeCompare(b.date+(b.time||"")));
 const first=upcoming[0],candidateFixtures=!first?[]:(first.round!==null&&first.round!==undefined?upcoming.filter(m=>String(m.round)===String(first.round)):upcoming.filter(m=>Math.abs(Date.parse(m.date+"T12:00:00")-Date.parse(first.date+"T12:00:00"))<=3*86400000));
 const overrides={};picks.forEach(p=>{const match=candidateFixtures.find(m=>fixtureKey(m)===fixtureKey(p));if(match)overrides[engineKey(match)]=p.marketKey;});
 const result=ENGINE().buildTicket(candidateFixtures,m=>getForecast(m),target,{maxLegs,marketOverrides:overrides});
 if(!result.available){$("ticketResults").innerHTML='<div class="notice warning">'+esc(result.reason)+'</div><small>Partite analizzate: '+(result.upcomingFixtures||0)+' · campioni utilizzabili: '+(result.eligibleFixtures||0)+'. Per le squadre con meno di tre risultati precedenti il modello non genera una proposta.</small>';proposal=[];return;}
 proposal=result.selections.map(x=>({match:x.match,marketKey:x.marketKey,marketLabel:x.market,probability:x.probability,confidence:x.confidence,preferredByUser:x.preferredByUser}));
 $("ticketResults").innerHTML='<div class="metric"><span>PROBABILITÀ STIMATA DELLA COMBINAZIONE</span><b class="bet-percent bet-percent-total">'+pct(result.probability)+'</b><small>Obiettivo combinazione: '+pct(result.threshold)+' · profilo '+esc(result.marketProfile)+' · mercato singolo orientato a '+pct(result.desiredMarketProbability)+' · '+proposal.length+' eventi · '+(result.thresholdReached?'obiettivo raggiunto':'obiettivo non raggiungibile con i dati e il limite selezionato')+'</small></div>'+
 proposal.map(x=>'<div class="data-row"><span><b>'+esc(x.match.home)+' – '+esc(x.match.away)+'</b><small>'+esc(x.match.date)+' · '+esc(x.marketLabel)+' · confidenza '+esc(x.confidence)+(x.preferredByUser?' · tua preferenza':'')+'</small></span><b class="bet-percent">'+pct(x.probability)+'</b></div>').join("")+
 '<button id="addProposal" type="button" class="primary" style="width:100%;margin-top:12px">Aggiungi proposta alla schedina</button>'+
 '<div class="notice warning">'+(result.thresholdReached?'Obiettivo probabilistico raggiunto secondo il modello. ':'Obiettivo non raggiunto: mostro comunque la combinazione più vicina disponibile, senza dichiararla conforme alla soglia. ')+esc(result.assumption)+' '+esc(result.warning||"")+'</div>';
}
function applyProposal(){
 proposal.forEach(x=>{const m=x.match,p={competition:m.competition||window.MM.getSelectedCompetition(),date:m.date,home:m.home,away:m.away,marketKey:x.marketKey};const index=picks.findIndex(y=>fixtureKey(y)===fixtureKey(p));if(index>=0)picks[index]=p;else if(picks.length<15)picks.push(p);});
 writePicks();slipExpanded=true;renderFixtures();renderSlip();$("manualBuilderStatus").textContent="Proposta aggiunta alla schedina. Puoi modificare o rimuovere ogni esito.";
}
function evaluateMarket(key,homeGoals,awayGoals){
 const total=homeGoals+awayGoals;
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
 const button=$("refreshArchive");button.disabled=true;button.textContent="Aggiorno…";
 try{
  const fresh=await window.MM.loadData(true),all=[...(fresh.matches||[]),...(fresh.history||[])];
  let liveMatches=[];
  try{
   const response=await fetch("./api/live-match?competition="+encodeURIComponent(window.MM.getSelectedCompetition()),{headers:{Accept:"application/json"},cache:"no-store"});
   if(response.ok){const payload=await response.json();if(Array.isArray(payload.matches))liveMatches=payload.matches;}
  }catch(_){/* Public results still update if the optional live provider is unavailable. */}
  const normDate=value=>String(value||"").slice(0,10);
  archive=archive.map(ticket=>({...ticket,selections:(ticket.selections||[]).map(selection=>{
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
  save(ARCHIVE_KEY,archive);renderOpenTickets();renderArchive();
  $("archiveStatus").textContent="Schedine aggiornate: risultati conclusi dal calendario pubblico; punteggi live quando API-Football è configurata.";
 }catch(e){$("archiveStatus").textContent="Aggiornamento non riuscito: "+e.message;}
 finally{button.disabled=false;button.textContent="Aggiorna";}
}
async function shareTicket(ticket){
 const body=["MatchMind · Schedina",...ticket.selections.map(x=>x.home+" – "+x.away+" | "+x.market+" | "+pct(x.probability)),"Probabilità combinata stimata: "+pct(ticket.probability)].join("\n");
 try{if(navigator.share)await navigator.share({title:"Schedina MatchMind",text:body});else{await navigator.clipboard.writeText(body);$("archiveStatus").textContent="Schedina copiata negli appunti.";}}catch(e){if(e.name!=="AbortError")$("archiveStatus").textContent="Condivisione non disponibile in questo browser.";}
}
function initEvents(){
 document.querySelectorAll("[data-bets-tab]").forEach(button=>button.addEventListener("click",()=>{setBetTab(button.dataset.betsTab);if(button.dataset.betsTab==="live")updateArchive();}));
 $("matchSearch").addEventListener("input",()=>{visibleFixtureLimit=12;renderFixtures();});
 ["betsDate","betsTeam","betsRound"].forEach(id=>$(id)?.addEventListener("change",()=>{visibleFixtureLimit=12;renderFixtures();}));
 $("clearBetsFilters")?.addEventListener("click",()=>{$("matchSearch").value="";$("betsDate").value="";$("betsTeam").value="";$("betsRound").value="";visibleFixtureLimit=12;renderFixtures();});
 $("moreBetFixtures")?.addEventListener("click",()=>{visibleFixtureLimit+=12;renderFixtures();});
 $("manualFixtures").addEventListener("click",event=>{
  const b=event.target.closest("[data-pick]");if(!b)return;
  const fixture=fixtures.find(m=>fixtureKey(m)===b.dataset.pick);if(!fixture)return;
  const market=markets().find(x=>x[0]===b.dataset.market);if(!market)return;
  const index=picks.findIndex(p=>fixtureKey(p)===fixtureKey(fixture));
  if(index>=0&&picks[index].marketKey===market[0])picks.splice(index,1);
  else{const p={competition:fixture.competition||window.MM.getSelectedCompetition(),date:fixture.date,home:fixture.home,away:fixture.away,marketKey:market[0]};if(index>=0)picks[index]=p;else if(picks.length<15)picks.push(p);else{$("manualBuilderStatus").textContent="Limite di 15 partite raggiunto.";return;}}
  writePicks();slipExpanded=true;renderFixtures();renderSlip();
 });
 $("manualFixtures").addEventListener("change",event=>{
  const el=event.target.closest("[data-context-field]");if(!el)return;
  const key=el.dataset.context,field=el.dataset.contextField;contexts[key]=contexts[key]||{};contexts[key][field]=Number(el.value);save(CONTEXT_KEY,contexts);renderFixtures();renderSlip();
 });
 $("manualSlipSummary").addEventListener("click",event=>{
  const remove=event.target.closest("[data-remove]");if(remove){picks=picks.filter(p=>fixtureKey(p)!==remove.dataset.remove);writePicks();renderFixtures();renderSlip();return;}
  if(event.target.closest("#archiveCurrentSlip"))saveCurrentSlip();
  if(event.target.closest("#clearCurrentSlip")){picks=[];slipExpanded=false;writePicks();renderFixtures();renderSlip();}
 });
 $("targetProbability").addEventListener("input",()=>{$("targetProbabilityLabel").textContent=$("targetProbability").value+"%";if(proposalGenerated)buildProposal();});
 $("maxLegs").addEventListener("change",()=>{if(proposalGenerated)buildProposal();});
 $("buildTicket").addEventListener("click",buildProposal);
 $("ticketResults").addEventListener("click",event=>{if(event.target.closest("#addProposal"))applyProposal();});
 $("refreshArchive").addEventListener("click",updateArchive);
 ["slipArchive","openTickets"].forEach(id=>$(id)?.addEventListener("click",event=>{
  const del=event.target.closest("[data-delete]");if(del){archive=archive.filter(x=>x.id!==del.dataset.delete);save(ARCHIVE_KEY,archive);renderOpenTickets();renderArchive();return;}
  const shared=event.target.closest("[data-share]");if(shared){const ticket=archive.find(x=>x.id===shared.dataset.share);if(ticket)shareTicket(ticket);}
 }));
}
let monitorTimer=null;
function hasTodayOpenTicket(){
 const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Rome",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 return archive.some(ticket=>(ticket.selections||[]).some(selection=>selection.date===today&&!terminalStatus(selection.status||"Da giocare")));
}
document.addEventListener("DOMContentLoaded",async()=>{
 initEvents();$("globalStatus").textContent="Carico calendario e risultati storici…";
 try{
  data=window.MM.forCompetition(await window.MM.loadData());
  fixtures=(data.matches||[]).filter(window.MM.upcoming).slice().sort((a,b)=>(a.date+(a.time||"")).localeCompare(b.date+(b.time||"")));
  picks=readPicks().filter(p=>(p.competition||"serie-a")===window.MM.getSelectedCompetition()&&fixtures.some(m=>fixtureKey(m)===fixtureKey(p)));
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
  if(teamSelect)teamSelect.innerHTML='<option value="">Tutte le squadre</option>'+window.MM.getTeams(fixtures).map(t=>'<option value="'+esc(t)+'">'+esc(t)+'</option>').join("");
  if(roundSelect){const rounds=[...new Set(fixtures.map(m=>String(m.round||"")).filter(Boolean))].sort((a,b)=>Number(a)-Number(b));roundSelect.innerHTML='<option value="">Tutte le giornate</option>'+rounds.map(n=>'<option value="'+esc(n)+'">Giornata '+esc(n)+'</option>').join("");}
  renderFixtures();renderSlip();renderOpenTickets();renderArchive();
  $("globalStatus").textContent=(data.source==="cache"?"Dati caricati dalla cache locale":"Dati aggiornati")+" · "+fixtures.length+" partite future · "+data.history.length+" risultati storici.";
  $("targetProbabilityLabel").textContent=$("targetProbability").value+"%";
  monitorTimer=window.setInterval(()=>{const active=document.querySelector("[data-bets-tab=\"live\"]")?.getAttribute("aria-selected")==="true";if(active&&!document.hidden&&hasTodayOpenTicket())updateArchive();},900000);
 }catch(e){$("globalStatus").textContent="Dati non disponibili: "+(e.message||"errore sconosciuto");$("manualFixtures").innerHTML='<div class="notice warning">Calendario non disponibile. Riprova quando la fonte dati sarà raggiungibile.</div>';}
});
window.addEventListener("pagehide",()=>{if(monitorTimer)clearInterval(monitorTimer);});
})();