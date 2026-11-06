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
 const motivationHtml='<div class="context-motivation"><label class="context-field">Motivazione '+esc(match.home)+'<select data-context="'+esc(fixtureKey(match))+'" data-context-field="motivationHome">'+motivationOptions(ctx.motivationHome)+'</select></label><label class="context-field">Motivazione '+esc(match.away)+'<select data-context="'+esc(fixtureKey(match))+'" data-context-field="motivationAway">'+motivationOptions(ctx.motivationAway)+'</select></label></div>';
 return '<article class="manual-fixture-card"><div class="manual-fixture-heading"><div><b>'+esc(match.home)+' – '+esc(match.away)+'</b><small>'+esc(window.MM.shortDate(match))+(match.time?' · '+esc(match.time):'')+' · confidenza '+esc(f.confidence)+'</small></div>'+(selected?'<span class="manual-picked-label">'+esc(marketLabel(selected.marketKey))+'</span>':'')+'</div>'+
 '<div class="fixture-forecast-strip"><span>1 <b>'+pct(p.home)+'</b></span><span>X <b>'+pct(p.draw)+'</b></span><span>2 <b>'+pct(p.away)+'</b></span><span>xG <b>'+f.homeXg.toFixed(2)+' – '+f.awayXg.toFixed(2)+'</b></span></div>'+
 '<div class="fixture-form-context"><span>'+esc(match.home)+' forma: <b>'+esc(form(f.home))+'</b></span><span>'+esc(match.away)+' forma: <b>'+esc(form(f.away))+'</b></span><span>'+esc(stand(f.standings.home))+'</span><span>'+esc(stand(f.standings.away))+'</span></div>'+
 '<div class="fixture-market-options">'+buttons+'</div><details class="manual-other-markets"><summary>Contesto squadra: assenze, infortuni e motivazione</summary><div class="context-controls"><div class="context-grid">'+absenceHtml+'</div>'+motivationHtml+'<small>Inserisci solo titolari realmente indisponibili. Le assenze sono una correzione indicativa, non una valutazione del valore individuale del giocatore. La motivazione automatica deriva dalla classifica; l’impostazione manuale è una tua valutazione.</small></div></details></article>';
}
function renderFixtures(){
 const target=$("manualFixtures");if(!target)return;
 const query=norm($("matchSearch").value),date=$("betsDate")?.value||"",team=$("betsTeam")?.value||"",round=$("betsRound")?.value||"";
 const rows=fixtures.filter(m=>(!query||norm(m.home).includes(query)||norm(m.away).includes(query))&&(!date||m.date===date)&&(!team||norm(m.home)===norm(team)||norm(m.away)===norm(team))&&(!round||String(m.round||"")===round));
 const visible=rows.slice(0,visibleFixtureLimit);
 target.innerHTML=visible.length?visible.map(renderFixture).join(""):'<div class="empty-state">Nessuna partita corrisponde ai filtri. Modifica la ricerca.</div>';
 const count=$("betsFixtureCount");if(count)count.textContent=rows.length+" partite trovate · visualizzate "+visible.length;
 const more=$("moreBetFixtures");if(more)more.hidden=rows.length<=visibleFixtureLimit;
}
function marketLabel(key){
 const item=ENGINE().marketCandidates("auto").find(x=>x.key===key);
 return item?item.label:String(key||"Mercato");
}
function selectedRows(){
 return picks.map(p=>{const match=fixtures.find(m=>fixtureKey(m)===fixtureKey(p));if(!match)return null;const forecast=getForecast(match);const odds=p.odds!=null&&Number.isFinite(Number(p.odds))&&Number(p.odds)>1&&Number(p.odds)<=1000?Number(p.odds):null;return{match,marketKey:p.marketKey,marketLabel:marketLabel(p.marketKey),probability:marketProbability(forecast,p.marketKey),forecast,odds};}).filter(Boolean);
}
function updateSlipCalculations(){
 const rows=selectedRows();if(!rows.length)return;
 const probability=rows.reduce((v,x)=>v*(Number.isFinite(x.probability)?x.probability:0),1);
 const fairCombinedOdds=ENGINE().fairOdds(probability);
 const validOdds=rows.map(r=>r.odds).filter(o=>Number.isFinite(o)&&o>1);
 const hasAllOdds=validOdds.length===rows.length&&rows.length>0;
 const computedOdds=hasAllOdds?validOdds.reduce((acc,o)=>acc*o,1):null;
 const totalOdds=Number.isFinite(computedOdds)?computedOdds:null;
 const potentialWin=totalOdds!=null?currentStake*totalOdds:null;
 const ev=totalOdds!=null?ENGINE().expectedValue(probability,totalOdds):null;
 const evAmount=ev!=null?currentStake*ev:null;
 const summary= $("manualSlipSummary")?.querySelector("details > summary span");
 if(summary)summary.textContent="Anteprima schedina · "+rows.length+" pronostici"+(potentialWin!=null?" · vincita "+curr(potentialWin):"");

 const totalOddsEl=$("slipTotalOddsVal");if(totalOddsEl)totalOddsEl.innerHTML=totalOdds!=null?fmtOdds(totalOdds):'<small class="text-muted">'+validOdds.length+'/'+rows.length+' quote</small>';
 const fairOddsEl=$("slipFairOddsVal");if(fairOddsEl)fairOddsEl.textContent=fmtOdds(fairCombinedOdds);
 const potWinEl=$("slipPotWinVal");if(potWinEl)potWinEl.textContent=curr(potentialWin);
 const evEl=$("slipEvVal");if(evEl){evEl.textContent=ev!=null?fmtEv(ev)+" · "+(evAmount>=0?"+":"")+curr(evAmount):"—";evEl.className="financial-value "+(ev!=null?(ev>=0?"ev-pos":"ev-neg"):"");}

 rows.forEach(row=>{
  const fKey=fixtureKey(row.match);
  const singleEv=ENGINE().expectedValue(row.probability,row.odds);
  const pill=document.querySelector('[data-ev-for="'+CSS.escape(fKey)+'"]');
  if(pill){
   if(singleEv!=null){pill.className="financial-pill "+(singleEv>=0?"ev-pos":"ev-neg");pill.innerHTML='EV: <b>'+fmtEv(singleEv)+'</b>';}
   else{pill.className="financial-pill text-muted";pill.innerHTML='EV: <i>inserisci quota</i>';}
  }
 });
}

function renderSlip(){
 const target=$("manualSlipSummary"),rows=selectedRows();
 if(!rows.length){target.innerHTML='<div class="empty-state">Nessuna selezione. Vai su <a href="./matches.html">Partite</a> e aggiungi gli esiti che vuoi inserire nella schedina.</div>';slipExpanded=false;return;}
 const probability=rows.reduce((v,x)=>v*(Number.isFinite(x.probability)?x.probability:0),1);
 const fairCombinedOdds=ENGINE().fairOdds(probability);
 const validOdds=rows.map(r=>r.odds).filter(o=>Number.isFinite(o)&&o>1);
 const hasAllOdds=validOdds.length===rows.length&&rows.length>0;
 const computedOdds=hasAllOdds?validOdds.reduce((acc,o)=>acc*o,1):null;
 const totalOdds=Number.isFinite(computedOdds)?computedOdds:null;
 const potentialWin=totalOdds!=null?currentStake*totalOdds:null;
 const ev=totalOdds!=null?ENGINE().expectedValue(probability,totalOdds):null;

 const rowsHtml=rows.map(row=>{
  const fKey=fixtureKey(row.match);
  const fairOdds=ENGINE().fairOdds(row.probability);
  const singleEv=ENGINE().expectedValue(row.probability,row.odds);
  const evClass=singleEv!=null?(singleEv>=0?"ev-pos":"ev-neg"):"";
  return '<div class="manual-selected-row" data-fixture="'+esc(fKey)+'">'+
   '<div class="manual-selected-row-main">'+
    '<span><b>'+esc(row.match.home)+' – '+esc(row.match.away)+'</b>'+
    '<small>'+esc(row.marketLabel)+' · '+esc(row.match.date)+' · prob. '+pct(row.probability)+'</small></span>'+
    '<button type="button" class="manual-remove-button" data-remove="'+esc(fKey)+'" aria-label="Rimuovi selezione">×</button>'+
   '</div>'+
   '<div class="manual-selected-row-financials">'+
    '<label class="manual-odds-label">Quota: '+
     '<input type="number" step="0.01" min="1.01" max="1000" placeholder="es. 1.85" class="manual-odds-input" data-odds-for="'+esc(fKey)+'" value="'+(row.odds||'')+'">'+
    '</label>'+
    '<span class="financial-pill">Equa: <b>'+fmtOdds(fairOdds)+'</b></span>'+
    '<span class="financial-pill '+(singleEv!=null?evClass:'text-muted')+'" data-ev-for="'+esc(fKey)+'">'+(singleEv!=null?'EV: <b>'+fmtEv(singleEv)+'</b>':'EV: <i>inserisci quota</i>')+'</span>'+
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
  '<summary><span>Anteprima schedina · '+rows.length+' pronostici'+(potentialWin!=null?' · vincita '+curr(potentialWin):'')+'</span><b>'+pct(probability)+'</b></summary>'+
  '<div class="manual-summary-card">'+
   '<div class="manual-summary-top">'+
    '<div><span class="eyebrow">SCHEDINA CORRENTE</span><b>'+rows.length+' eventi</b></div>'+
    '<div class="manual-combined-probability"><span>Probabilità stimata</span><b class="bet-percent bet-percent-total">'+pct(probability)+'</b></div>'+
   '</div>'+
   financialSummaryHtml+
   '<div class="manual-selected-list">'+rowsHtml+'</div>'+
   '<div class="manual-summary-actions">'+
    '<button type="button" id="archiveCurrentSlip" class="primary">Salva schedina</button>'+
    '<button type="button" id="clearCurrentSlip" class="secondary">Svuota</button>'+
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
   '<div class="settings-actions"><button type="button" class="secondary" data-share="'+esc(ticket.id)+'">Condividi</button><button type="button" class="secondary" data-delete="'+esc(ticket.id)+'">Elimina</button></div></article>';
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
  if(isWon){wonCount++;totalWon+=Number(ticket.potentialWin)||(stake*(Number(ticket.totalOdds)||1));}
  else if(isLost){lostCount++;}
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
    (potWin?'<span>Incasso: <b>'+(isWon?curr(potWin):'0,00 €')+'</b></span>':'')+
    (profitLoss!=null?'<span>Esito netto: <b class="'+(profitLoss>=0?'profit-pos':'profit-neg')+'">'+(profitLoss>=0?'+':'')+curr(profitLoss)+'</b></span>':'')+
   '</div>':'';

  return '<article class="archive-ticket"><div class="archive-ticket-head"><b>Schedina · '+esc(ticket.createdAt?new Date(ticket.createdAt).toLocaleString("it-IT"):"—")+'</b><span class="ticket-state '+ticketStatusClass+'">'+ticketStatusLabel+'</span></div><small>Probabilità stimata al salvataggio: '+pct(ticket.probability)+'</small>'+
   financialMeta+
   ticket.selections.map(selection=>{
    const selOdds=selection.odds?' · quota '+fmtOdds(selection.odds):'';
    return '<div class="data-row"><span><b>'+esc(selection.home)+' – '+esc(selection.away)+'</b><small>'+esc(selection.market)+selOdds+' · '+esc(selection.date)+'</small></span><b class="ticket-monitor-state '+(selection.status==="Vinta"?"won":selection.status==="Persa"?"lost":"")+'">'+esc(selection.status||"Conclusa")+(selection.result?' · '+esc(selection.result):'')+'</b></div>';
   }).join("")+'<div class="settings-actions"><button type="button" class="secondary" data-share="'+esc(ticket.id)+'">Condividi</button><button type="button" class="secondary" data-delete="'+esc(ticket.id)+'">Elimina</button></div></article>';
 }).join("");

 target.innerHTML=bankrollCard+ticketsHtml;
}
function setBetTab(tab){
 const selected=["create","live","archive"].includes(tab)?tab:"create";
 document.querySelectorAll("[data-bets-tab]").forEach(button=>{const active=button.dataset.betsTab===selected;button.classList.toggle("active",active);button.setAttribute("aria-selected",String(active));});
 ["create","live","archive"].forEach(name=>{const panel=$("betsTab"+name[0].toUpperCase()+name.slice(1));if(panel)panel.hidden=name!==selected;});
}
function saveCurrentSlip(){
 const rows=selectedRows();if(!rows.length){$("manualBuilderStatus").textContent="Non ci sono selezioni da salvare. Aggiungi prima una giocata da Partite.";return;}
 const probability=rows.reduce((v,x)=>v*x.probability,1);
 const validOdds=rows.map(r=>r.odds).filter(o=>Number.isFinite(o)&&o>1);
 const hasAllOdds=validOdds.length===rows.length&&rows.length>0;
 const computedOdds=hasAllOdds?validOdds.reduce((acc,o)=>acc*o,1):null;
 const totalOdds=Number.isFinite(computedOdds)?computedOdds:null;
 const potentialWin=totalOdds!=null?currentStake*totalOdds:null;
 const netWin=potentialWin!=null?potentialWin-currentStake:null;
 const expectedValue=totalOdds!=null?ENGINE().expectedValue(probability,totalOdds):null;

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
   home:x.match.home,
   away:x.match.away,
   date:x.match.date,
   market:x.marketLabel,
   marketKey:x.marketKey,
   probability:x.probability,
   odds:x.odds||null,
   fairOdds:ENGINE().fairOdds(x.probability),
   competition:x.match.competition||window.MM.getSelectedCompetition(),
   status:"Da giocare"
  }))
 };
 archive.unshift(item);archive=archive.slice(0,100);save(ARCHIVE_KEY,archive);picks=[];writePicks();renderSlip();renderOpenTickets();renderArchive();$("manualBuilderStatus").textContent="Schedina salvata con puntata e quote registrate.";setBetTab("live");
}
function buildProposal(){
 proposalGenerated=true;
 const target=Number($("targetProbability").value)/100,maxLegs=Number($("maxLegs").value);
 const upcoming=fixtures.slice().sort((a,b)=>(a.date+(a.time||"")).localeCompare(b.date+(b.time||"")));
 const first=upcoming[0],candidateFixtures=!first?[]:(first.round!==null&&first.round!==undefined?upcoming.filter(m=>String(m.round)===String(first.round)):upcoming.filter(m=>Math.abs(Date.parse(m.date+"T12:00:00")-Date.parse(first.date+"T12:00:00"))<=3*86400000));
 const overrides={};picks.forEach(p=>{const match=candidateFixtures.find(m=>fixtureKey(m)===fixtureKey(p));if(match)overrides[engineKey(match)]=p.marketKey;});
 const marketMode=$("marketMode")?.value||"auto";
 const result=ENGINE().buildTicket(candidateFixtures,m=>getForecast(m),target,{maxLegs,marketOverrides:overrides,marketMode});
 if(!result.available){$("ticketResults").innerHTML='<div class="notice warning">'+esc(result.reason)+'</div><small>Partite analizzate: '+(result.upcomingFixtures||0)+' · campioni utilizzabili: '+(result.eligibleFixtures||0)+'. Per le squadre con meno di tre risultati precedenti il modello non genera una proposta.</small>';proposal=[];return;}
 proposal=result.selections.map(x=>({match:x.match,marketKey:x.marketKey,marketLabel:x.market,probability:x.probability,confidence:x.confidence,preferredByUser:x.preferredByUser}));
 const profileLabel=marketMode==='combo-goals'?'1X2 + Over/Under':marketMode==='combo-btts'?'1X2 + Gol/No Gol':marketMode==='single'?'Mercati singoli':'Automatico';
 const proposalDate=value=>{if(!value)return 'Data da definire';const date=new Date(value+'T12:00:00');return Number.isNaN(date.getTime())?String(value):date.toLocaleDateString('it-IT',{weekday:'short',day:'2-digit',month:'short'});};
 $("ticketResults").innerHTML='<section class="proposal-summary"><div class="proposal-summary-head"><span class="eyebrow">RISULTATO DEL MODELLO</span><span class="proposal-state '+(result.thresholdReached?'reached':'not-reached')+'">'+(result.thresholdReached?'Obiettivo raggiunto':'Obiettivo non raggiunto')+'</span></div><div class="proposal-total"><span>Probabilità stimata della schedina</span><b>'+pct(result.probability)+'</b></div><div class="proposal-meta"><span><small>Obiettivo</small><b>'+pct(result.threshold)+'</b></span><span><small>Eventi</small><b>'+proposal.length+'</b></span><span><small>Profilo</small><b>'+esc(profileLabel)+'</b></span></div><p>Probabilità media richiesta per selezione: <b>'+pct(result.desiredMarketProbability)+'</b></p></section>'+
 '<div class="proposal-list-heading"><b>Selezioni proposte</b><small>La percentuale a destra riguarda il singolo evento</small></div>'+
 proposal.map((x,i)=>'<article class="proposal-leg"><div class="proposal-leg-top"><span class="proposal-leg-number">EVENTO '+(i+1)+'</span><time>'+esc(proposalDate(x.match.date))+(x.match.time?' · '+esc(x.match.time):'')+'</time></div><div class="proposal-leg-match">'+esc(x.match.home)+' <span>–</span> '+esc(x.match.away)+'</div><div class="proposal-leg-bottom"><div class="proposal-leg-pick"><small>GIOCATA</small><b>'+esc(x.marketLabel)+'</b><small>Confidenza: '+esc(x.confidence)+(x.preferredByUser?' · tua preferenza':'')+'</small></div><div class="proposal-leg-prob"><small>PROBABILITÀ</small><b>'+pct(x.probability)+'</b></div></div></article>').join("")+
 '<button id="addProposal" type="button" class="primary proposal-add-button">Aggiungi '+proposal.length+' selezioni alla schedina</button>'+
 '<div class="notice warning proposal-caveat">'+(result.thresholdReached?'La soglia è stata raggiunta secondo il modello. ':'La soglia non è stata raggiunta: questa è la combinazione più vicina disponibile, non una proposta conforme all’obiettivo. ')+esc(result.assumption)+' '+esc(result.warning||"")+'</div>';
}
function applyProposal(){
 proposal.forEach(x=>{const m=x.match,p={competition:m.competition||window.MM.getSelectedCompetition(),date:m.date,home:m.home,away:m.away,marketKey:x.marketKey};const index=picks.findIndex(y=>fixtureKey(y)===fixtureKey(p));if(index>=0)picks[index]=p;else if(picks.length<15)picks.push(p);});
 writePicks();slipExpanded=true;renderSlip();$("manualBuilderStatus").textContent="Proposta aggiunta alla schedina. Puoi modificare o rimuovere ogni esito.";
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
function initEvents(){
 document.querySelectorAll("[data-bets-tab]").forEach(button=>button.addEventListener("click",()=>{setBetTab(button.dataset.betsTab);if(button.dataset.betsTab==="live")updateArchive();}));
 $("saveManualSlip")?.addEventListener("click",saveCurrentSlip);
 $("manualSlipSummary").addEventListener("input",event=>{
  const oddsInput=event.target.closest(".manual-odds-input");
  if(oddsInput){
   const fKey=oddsInput.dataset.oddsFor,val=Number(oddsInput.value);
   const pick=picks.find(p=>fixtureKey(p)===fKey);
   if(pick){pick.odds=(Number.isFinite(val)&&val>1&&val<=1000)?val:null;writePicks();updateSlipCalculations();}
   return;
  }
  const stakeInput=event.target.closest("#slipStakeInput");
  if(stakeInput){
   const val=Number(stakeInput.value);
   if(Number.isFinite(val)&&val>=0.5&&val<=100000){currentStake=val;save(STAKE_KEY,currentStake);updateSlipCalculations();}
  }
 });
 $("manualSlipSummary").addEventListener("click",event=>{
  const remove=event.target.closest("[data-remove]");if(remove){picks=picks.filter(p=>fixtureKey(p)!==remove.dataset.remove);writePicks();renderSlip();return;}
  const market=event.target.closest("[data-pick]");if(market){const fixture=fixtures.find(item=>fixtureKey(item)===market.dataset.pick);if(!fixture)return;const current=selectedFor(fixture);if(current&&current.marketKey===market.dataset.market)picks=picks.filter(item=>fixtureKey(item)!==fixtureKey(fixture));else if(current)current.marketKey=market.dataset.market;else if(picks.length<15)picks.push({competition:fixture.competition||window.MM.getSelectedCompetition(),date:fixture.date,home:fixture.home,away:fixture.away,marketKey:market.dataset.market});writePicks();renderFixtures();renderSlip();return;}
  if(event.target.closest("#archiveCurrentSlip"))saveCurrentSlip();
  if(event.target.closest("#clearCurrentSlip")){picks=[];slipExpanded=false;writePicks();renderSlip();}
 });
 $("targetProbability").addEventListener("input",()=>{$("targetProbabilityLabel").textContent=$("targetProbability").value+"%";if(proposalGenerated)buildProposal();});
 $("maxLegs").addEventListener("change",()=>{if(proposalGenerated)buildProposal();});
 $("marketMode").addEventListener("change",()=>{if(proposalGenerated)buildProposal();});
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
 }catch(e){$("globalStatus").textContent="Dati non disponibili: "+(e.message||"errore sconosciuto");$("manualBuilderStatus").textContent="Calendario non disponibile: impossibile calcolare le probabilità delle selezioni.";}
});
window.addEventListener("pagehide",()=>{if(monitorTimer)clearInterval(monitorTimer);});
})();