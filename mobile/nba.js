/* MatchMind NBA UI. Uses the shared MatchMind slip store; no parallel NBA ticket store. */
(function(){
  "use strict";
  const $=id=>document.getElementById(id),KEY="matchmind-manual-selections-v1",LEGACY="matchmind-nba-picks-v1",PAGE=20;
  const state={view:"upcoming",query:"",date:"",shown:PAGE,data:null,loading:false,proposal:[]};
  const ARCHIVE_KEY="matchmind-slip-archive-v2",STAKE_KEY="matchmind-slip-default-stake";
  let nbaStake=10;try{const saved=Number(JSON.parse(localStorage.getItem(STAKE_KEY)||"10"));if(Number.isFinite(saved)&&saved>=0.5&&saved<=100000)nbaStake=saved;}catch{}
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const pct=p=>Number.isFinite(Number(p))?Math.round(Number(p)*100)+"%":"—";
  const when=iso=>{const d=new Date(iso);return Number.isNaN(d.getTime())?"Data non disponibile":d.toLocaleDateString("it-IT",{weekday:"short",day:"2-digit",month:"short"})+" · "+d.toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit"});};
  const readAll=()=>{try{const x=JSON.parse(localStorage.getItem(KEY)||"[]");return Array.isArray(x)?x:[];}catch{return[];}};
  const writeAll=rows=>{try{localStorage.setItem(KEY,JSON.stringify(rows));window.dispatchEvent(new Event("matchmind:picks-updated"));window.dispatchEvent(new Event("storage"));}catch(e){$("globalStatus").textContent="Impossibile salvare le selezioni: memoria locale non disponibile.";}}
  function migrateLegacy(){
    let old=[];try{old=JSON.parse(localStorage.getItem(LEGACY)||"[]");}catch{}
    if(!Array.isArray(old)||!old.length)return;
    const all=readAll();
    for(const x of old){
      if(!x||!x.home||!x.away||!["home","away"].includes(x.side))continue;
      const id=String(x.id||x.eventId||"");
      if(all.some(p=>p.sport==="nba"&&String(p.id||p.eventId)===id&&p.side===x.side))continue;
      all.push({sport:"nba",competition:"nba",id,eventId:id,home:x.home,away:x.away,homeAbbr:x.homeAbbr||"",awayAbbr:x.awayAbbr||"",start:x.start||"",date:String(x.start||"").slice(0,10),side:x.side,team:x.team||(x.side==="home"?x.home:x.away),marketKey:"nbaMoneyline:"+x.side,probability:Number(x.probability??x.prob),prob:Number(x.probability??x.prob),odds:null});
    }
    writeAll(all);
    try{localStorage.removeItem(LEGACY);}catch{}
  }
  const picks=()=>readAll().filter(x=>x&&x.sport==="nba");
  const logo=src=>src?'<img src="'+esc(src)+'" alt="" loading="lazy" referrerpolicy="no-referrer">':"";
  function togglePick(g,side){
    const all=readAll(),existing=all.findIndex(x=>x.sport==="nba"&&String(x.id||x.eventId)===String(g.id));
    if(existing>=0&&all[existing].side===side)all.splice(existing,1);
    else{
      if(existing>=0)all.splice(existing,1);
      const prob=side==="home"?g.prediction.homeWin:g.prediction.awayWin;
      all.push({sport:"nba",competition:"nba",id:String(g.id),eventId:String(g.id),home:g.home,away:g.away,homeAbbr:g.homeAbbr||"",awayAbbr:g.awayAbbr||"",start:g.start,date:String(g.start).slice(0,10),side,team:side==="home"?g.home:g.away,marketKey:"nbaMoneyline:"+side,probability:prob,prob,odds:null});
    }
    writeAll(all);render();
    $("globalStatus").textContent="Selezioni NBA aggiornate nella schedina condivisa.";
  }
  function pickButton(g,side,prob,fav){
    const on=picks().some(x=>String(x.id||x.eventId)===String(g.id)&&x.side===side),team=side==="home"?g.homeAbbr||"casa":g.awayAbbr||"trasf.";
    return '<button type="button" class="nba-pick'+(fav?" fav":"")+(on?" on":"")+'" data-pick="'+esc(g.id)+'" data-side="'+side+'" aria-pressed="'+on+'"><span>Vittoria '+esc(team)+'</span><b>'+pct(prob)+'</b><small>'+(on?"✓ In schedina":"＋ Aggiungi")+'</small></button>';
  }
  function card(g){
    const done=g.status==="FT",score=done?(g.ap+" – "+g.hp):g.status==="LIVE"?"LIVE":"vs";
    const p=g.prediction;
    const prediction=p?'<div class="nba-pred">'+pickButton(g,"away",p.awayWin,p.awayWin>=p.homeWin)+pickButton(g,"home",p.homeWin,p.homeWin>=p.awayWin)+'<div class="nba-stat"><span>Scarto casa</span><b>'+(p.spread>0?"+":"")+p.spread+'</b></div><div class="nba-stat"><span>Totale punti</span><b>'+p.total+'</b></div></div><div class="nba-note">Punteggio previsto: '+esc(g.away)+' '+p.awayPoints+' – '+p.homePoints+' '+esc(g.home)+(p.reliable?"":" · campione ridotto: stima prudente")+'</div>':"";
    return '<article class="nba-card"><div class="nba-meta">'+esc(when(g.start))+(g.status==="LIVE"&&g.statusLabel?" · "+esc(g.statusLabel):"")+'</div><div class="nba-row"><div class="nba-team">'+logo(g.awayLogo)+'<span>'+esc(g.away)+'</span></div><div class="nba-score">'+esc(score)+'</div><div class="nba-team away"><span>'+esc(g.home)+'</span>'+logo(g.homeLogo)+'</div></div><div class="nba-meta">Trasferta a sinistra · casa a destra</div>'+prediction+'</article>';
  }
  function renderRanking(){
    const rows=state.data?.standings||[];
    $("nbaListTitle").textContent="Classifica forza · Elo";
    $("nbaSummary").textContent=rows.length+" squadre · "+(state.data?.sample||0)+" partite concluse usate dal modello";
    $("nbaList").innerHTML=rows.length?'<div class="nba-table-wrap"><table class="nba-table"><thead><tr><th># · Squadra</th><th>PG</th><th>V</th><th>P</th><th>Elo</th><th>PF</th><th>PS</th></tr></thead><tbody>'+rows.map((x,i)=>'<tr><td>'+(i+1)+'. '+esc(x.team)+'</td><td>'+x.games+'</td><td>'+x.wins+'</td><td>'+x.losses+'</td><td>'+x.elo+'</td><td>'+x.pointsFor+'</td><td>'+x.pointsAgainst+'</td></tr>').join("")+'</tbody></table></div>':'<div class="empty-state">Classifica non disponibile: servono risultati storici.</div>';
    $("nbaMore").hidden=true;
  }
  function renderSlip(){
    const box=$("nbaSlip"),rows=picks();
    if(!box)return;
    if(document.body.dataset.page!=="nba"){box.hidden=true;return;}
    box.hidden=false;
    const calc=window.MMNbaBuilder.calculate(rows,nbaStake);
    const list=rows.length?rows.map((x,i)=>'<div class="nba-slip-row"><span><b>'+esc(x.away)+' @ '+esc(x.home)+'</b><small>NBA · Vince: '+esc(x.team)+' · '+esc(when(x.start))+' · stima '+pct(x.probability)+'</small><label class="nba-odds-field">Quota verificata <input type="number" min="1.01" max="1000" step="0.01" placeholder="es. 1.90" value="'+(Number.isFinite(Number(x.odds))&&Number(x.odds)>1?esc(x.odds):'')+'" data-nba-odds="'+esc(x.id||x.eventId)+'"></label></span><button type="button" class="ghost" data-remove="'+i+'" aria-label="Rimuovi selezione">Rimuovi</button></div>').join(""):'<div class="empty-state">Nessuna selezione NBA. Scegli Vittoria casa o Vittoria trasferta nel calendario.</div>';
    box.innerHTML='<div class="section-head"><div><div class="eyebrow">NBA BET BUILDER</div><h2>Costruttore schedina NBA · '+rows.length+' eventi</h2><p>Selezioni multiple sul mercato vincente. Le probabilità provengono dal modello Elo; le quote vanno inserite da una fonte verificata.</p></div></div>'+list+
    '<div class="nba-builder-financials"><label>Puntata (€)<input id="nbaStake" type="number" min="0.5" max="100000" step="0.5" value="'+nbaStake+'"></label><div><small>Probabilità combinata stimata</small><b>'+(calc.probability===null?"—":pct(calc.probability))+'</b></div><div><small>Quota totale</small><b>'+(calc.totalOdds!==null?calc.totalOdds.toFixed(2):'Inserisci tutte le quote')+'</b></div><div><small>Incasso lordo potenziale</small><b>'+(calc.potentialWin!==null?calc.potentialWin.toFixed(2)+' €':'—')+'</b></div><div><small>EV stimato</small><b>'+(calc.expectedValue!==null?(calc.expectedValue>=0?'+':'')+(calc.expectedValue*100).toFixed(1)+'%':'—')+'</b></div></div>'+
    '<p class="nba-note">Il prodotto delle probabilità assume indipendenza tra partite. Non include mercati handicap o Over/Under: il modello attuale non dispone ancora di probabilità calibrate per questi mercati.</p>'+
    '<div class="nba-slip-actions"><button type="button" class="secondary" id="nbaSlipClear" '+(!rows.length?'disabled':'')+'>Svuota</button><button type="button" class="secondary" id="nbaSaveSlip" '+(!rows.length?'disabled':'')+'>Salva schedina</button><button type="button" class="primary" id="nbaPlaySisal" '+(!rows.length?'disabled':'')+'>Trasferisci a Sisal ↗</button></div><p id="nbaBuilderStatus" class="status-line" aria-live="polite"></p>';
  }
  function saveNbaSlip(){
    const rows=picks(),status=$("nbaBuilderStatus");
    if(!rows.length){if(status)status.textContent="Aggiungi almeno una selezione NBA.";return;}
    try{
      const ticket=window.MMNbaBuilder.toArchiveTicket(rows,nbaStake);
      let archive=[];try{const stored=JSON.parse(localStorage.getItem(ARCHIVE_KEY)||"[]");if(Array.isArray(stored))archive=stored;}catch{}
      archive.unshift(ticket);localStorage.setItem(ARCHIVE_KEY,JSON.stringify(archive.slice(0,100)));
      writeAll(readAll().filter(x=>x.sport!=="nba"));
      renderSlip();render();
      const currentStatus=$("nbaBuilderStatus");
      if(currentStatus)currentStatus.textContent="Schedina NBA salvata nell'archivio condiviso. Puoi ritrovarla nella sezione Scommesse.";
    }catch(error){if(status)status.textContent=error.message;}
  }
  function openSisal(){
    const rows=picks();
    const bridge=window.MatchMindSisalBridge;
    const result=bridge?bridge.createUrl(rows):null;
    if(!result||!result.url){
      $("globalStatus").textContent=!bridge?"Ponte Sisal non caricato: aggiorna la pagina.":"Nessuna selezione NBA trasferibile. Verifica partita e mercato.";
      return;
    }
    let win=null;
    try{win=window.open(result.url,"_blank");if(win)win.opener=null;}catch{}
    if(!win)window.location.href=result.url;
    const skipped=result.skipped? " · "+result.skipped+" selezioni escluse perché incomplete o non supportate":"";
    $("globalStatus").textContent="Trasferite "+result.payload.items.length+" selezioni NBA alla coda MatchMind su Sisal. Aggiungile e verifica manualmente ogni quota."+skipped;
  }

  function render(){
    renderSlip();if(!state.data)return;
    if(state.view==="ranking"){renderRanking();return;}
    const q=state.query.trim().toLowerCase(),now=Date.now();
    let rows=state.view==="results"?state.data.games.filter(g=>g.status==="FT").slice().reverse():state.data.games.filter(g=>g.status!=="FT"&&Date.parse(g.start)>=now-6*60*60*1000);
    rows=rows.filter(g=>(!q||g.home.toLowerCase().includes(q)||g.away.toLowerCase().includes(q))&&(!state.date||String(g.start||"").slice(0,10)===state.date));
    $("nbaListTitle").textContent=state.view==="results"?"Risultati":"In programma";
    $("nbaSummary").textContent=rows.length+' partite · stagione '+state.data.season+' · fonte ESPN'+(state.data.errors?.length?' · '+state.data.errors.length+' richieste parziali non riuscite':"");
    $("nbaList").innerHTML=rows.length?rows.slice(0,state.shown).map(card).join(""):'<div class="empty-state">Nessuna partita trovata con questi filtri.</div>';
    $("nbaMore").hidden=rows.length<=state.shown;
  }
  function renderNbaProposal(result){
    const box=$("nbaAutoProposal");if(!box)return;
    if(!result?.available||!result.selections?.length){
      box.innerHTML='<div class="empty-state">Nessuna proposta NBA con i criteri scelti. Riduci la probabilità minima o amplia il periodo.</div>';
      return;
    }
    const joint=result.probability;
    const list=result.selections.map((pick,index)=>
      '<article class="nba-proposal-row">'+
        '<div><small>EVENTO '+(index+1)+' · '+esc(when(pick.start))+'</small><b>'+esc(pick.away)+' @ '+esc(pick.home)+'</b>'+
        '<span>'+esc(pick.side==="home"?"Vince casa":"Vince trasferta")+' · '+esc(pick.team)+'</span></div>'+
        '<div class="nba-proposal-prob"><b>'+pct(pick.probability)+'</b><small>'+(pick.reliable?"Campione adeguato":"Campione ridotto")+'</small></div>'+
      '</article>'
    ).join("");
    box.innerHTML='<div class="nba-proposal-summary"><div><small>EVENTI SELEZIONATI</small><b>'+result.selections.length+'</b></div><div><small>PROBABILITÀ COMBINATA</small><b>'+pct(joint)+'</b></div><div><small>SOGLIA SINGOLA</small><b>'+pct(result.threshold)+'</b></div></div>'+
      list+
      '<p class="nba-note">'+esc(result.warning)+' La probabilità combinata moltiplica le probabilità marginali e assume indipendenza tra eventi.</p>'+
      '<button type="button" class="primary" id="addNbaProposalToSlip" style="width:100%">Aggiungi '+result.selections.length+' eventi alla schedina</button>';
  }
  function buildNbaProposal(){
    if(!state.data){$("nbaAutoProposal").innerHTML='<div class="empty-state">Calendario NBA non ancora disponibile.</div>';return;}
    const periodValue=$("nbaAutoPeriod")?.value||"7";
    const result=window.MMNbaBuilder.buildProposal(state.data.games,{
      minProbability:Number($("nbaAutoMinProbability")?.value||0.55),
      maxSelections:Number($("nbaAutoMaxSelections")?.value||3),
      periodDays:periodValue==="all"?"all":Number(periodValue),
      query:state.query,date:state.date,now:Date.now()
    });
    state.proposal=result.available?result.selections:[];
    renderNbaProposal(result);
  }
  function addNbaProposalToSlip(){
    if(!state.proposal.length)return;
    const existing=readAll();
    const proposedIds=new Set(state.proposal.map(x=>String(x.id)));
    const retained=existing.filter(x=>x&&!(x.sport==="nba"&&proposedIds.has(String(x.id||x.eventId))));
    const rows=state.proposal.map(x=>({
      sport:"nba",competition:"nba",id:String(x.id),eventId:String(x.id),
      home:x.home,away:x.away,homeAbbr:x.homeAbbr,awayAbbr:x.awayAbbr,
      start:x.start,date:x.date,side:x.side,team:x.team,marketKey:x.marketKey,
      probability:x.probability,prob:x.probability,odds:null
    }));
    writeAll(retained.concat(rows));render();
    $("globalStatus").textContent="Proposta NBA aggiunta alla schedina condivisa. Inserisci soltanto quote verificate prima del calcolo dell’EV.";
    $("nbaAutoProposal").scrollIntoView({behavior:"smooth",block:"nearest"});
  }
  async function load(force=false){
    if(state.loading)return;state.loading=true;
    $("nbaSummary").textContent="Caricamento calendario e risultati ESPN…";
    try{
      const response=await fetch("./api/public/nba",{headers:{Accept:"application/json"},cache:force?"no-store":"default",signal:AbortSignal.timeout(35000)});
      const body=await response.json();
      if(!response.ok)throw new Error(body.detail||body.error||("HTTP "+response.status));
      if(!Array.isArray(body.games))throw new Error("Formato dati NBA non valido");
      state.data=body;render();
    }catch(error){
      $("nbaList").innerHTML='<div class="empty-state">Calendario NBA temporaneamente non disponibile: '+esc(error.message)+'.<br><button type="button" class="ghost" id="nbaRetry">Riprova</button></div>';
      $("nbaSummary").textContent="Errore di caricamento · nessun dato inventato";
      $("nbaRetry")?.addEventListener("click",()=>load(true));
    }finally{state.loading=false;}
  }
  document.addEventListener("DOMContentLoaded",()=>{
    migrateLegacy();renderSlip();
    $("nbaTabs").addEventListener("click",event=>{
      const button=event.target.closest("[data-view]");if(!button)return;
      state.view=button.dataset.view;state.shown=PAGE;
      $("nbaTabs").querySelectorAll("[data-view]").forEach(x=>{const active=x===button;x.classList.toggle("active",active);x.setAttribute("aria-selected",String(active));});
      render();
    });
    $("nbaSearch").addEventListener("input",event=>{state.query=event.target.value;state.shown=PAGE;render();});
    $("nbaDateFilter")?.addEventListener("change",event=>{state.date=event.target.value;state.shown=PAGE;render();});
    $("nbaList").addEventListener("click",event=>{const button=event.target.closest("[data-pick]");if(!button)return;const game=state.data?.games.find(x=>String(x.id)===button.dataset.pick);if(game?.prediction)togglePick(game,button.dataset.side);});
    $("nbaSlip").addEventListener("click",event=>{
      const remove=event.target.closest("[data-remove]");
      if(remove){const rows=picks(),target=rows[Number(remove.dataset.remove)];if(target)writeAll(readAll().filter(x=>!(x.sport==="nba"&&String(x.id||x.eventId)===String(target.id||target.eventId))));render();return;}
      if(event.target.closest("#nbaSlipClear")){writeAll(readAll().filter(x=>x.sport!=="nba"));render();return;}
      if(event.target.closest("#nbaSaveSlip")){saveNbaSlip();return;}
      if(event.target.closest("#nbaPlaySisal"))openSisal();
    });
    $("nbaSlip").addEventListener("change",event=>{
      const odds=event.target.closest("[data-nba-odds]");
      if(odds){const pick=readAll().find(x=>x.sport==="nba"&&String(x.id||x.eventId)===odds.dataset.nbaOdds);if(pick){const value=Number(odds.value);pick.odds=Number.isFinite(value)&&value>1&&value<=1000?value:null;writeAll(readAll());renderSlip();}return;}
      const stake=event.target.closest("#nbaStake");
      if(stake){const value=Number(stake.value);if(Number.isFinite(value)&&value>=0.5&&value<=100000){nbaStake=value;try{localStorage.setItem(STAKE_KEY,JSON.stringify(value));}catch{}renderSlip();}}
    });
    $("nbaMore").addEventListener("click",()=>{state.shown+=PAGE;render();});
    $("nbaRefresh").addEventListener("click",()=>load(true));
    $("buildNbaProposal")?.addEventListener("click",buildNbaProposal);
    $("nbaAutoProposal")?.addEventListener("click",event=>{if(event.target.closest("#addNbaProposalToSlip"))addNbaProposalToSlip();});
    window.addEventListener("matchmind:picks-updated",()=>{renderSlip();render();});
    window.addEventListener("storage",event=>{if(!event.key||event.key===KEY)renderSlip();});
    load();
  });
})();
