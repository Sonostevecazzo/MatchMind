/* MatchMind NBA UI. Uses the shared MatchMind slip store; no parallel NBA ticket store. */
(function(){
  "use strict";
  const $=id=>document.getElementById(id),KEY="matchmind-manual-selections-v1",LEGACY="matchmind-nba-picks-v1",PAGE=20;
  const state={view:"upcoming",query:"",shown:PAGE,data:null,loading:false};
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
    box.hidden=!rows.length;
    if(!rows.length)return;
    const combined=rows.reduce((a,x)=>a*(Number.isFinite(Number(x.probability))?Number(x.probability):0),1);
    box.innerHTML='<h2>Schedina condivisa · NBA ('+rows.length+')</h2>'+rows.map((x,i)=>'<div class="nba-slip-row"><span><b>'+esc(x.away)+' @ '+esc(x.home)+'</b><small>Vince '+esc(x.team)+' · '+esc(when(x.start))+' · stima '+pct(x.probability)+' · quote non disponibili</small></span><button type="button" class="ghost" data-remove="'+i+'" aria-label="Rimuovi selezione">Rimuovi</button></div>').join("")+'<p class="nba-note">Probabilità combinata indicativa: <b>'+pct(combined)+'</b>. Presuppone indipendenza tra partite. Nessuna quota o vincita viene stimata senza quote verificate.</p><div class="nba-slip-actions"><button type="button" class="secondary" id="nbaSlipClear">Svuota selezioni NBA</button><button type="button" class="primary" id="nbaPlaySisal">Apri NBA su Sisal ↗</button></div><small class="nba-note">L’apertura di Sisal non inserisce né conferma automaticamente le giocate: verifica e aggiungi manualmente ogni selezione.</small>';
  }
  function openSisal(){
    const rows=picks(),items=rows.map(x=>({sport:"nba",eventId:String(x.id||x.eventId),home:x.home,away:x.away,homeAbbr:x.homeAbbr||"",awayAbbr:x.awayAbbr||"",start:x.start,date:x.date,marketKey:x.marketKey,label:"Vincente incontro (supplementari inclusi): "+x.team}));
    const base="https://www.sisal.it/scommesse-matchpoint/sport/basket/usa/nba";
    const url=items.length?base+"#mmplay="+encodeURIComponent(JSON.stringify({sentAt:Date.now(),items})):base;
    let win=null;try{win=window.open(url,"_blank","noopener");}catch{}
    if(!win)window.location.href=url;
    $("globalStatus").textContent=items.length?"Aperta la pagina NBA di Sisal. Controlla e aggiungi manualmente le selezioni.":"Apro il palinsesto NBA di Sisal.";
  }
  function render(){
    renderSlip();if(!state.data)return;
    if(state.view==="ranking"){renderRanking();return;}
    const q=state.query.trim().toLowerCase(),now=Date.now();
    let rows=state.view==="results"?state.data.games.filter(g=>g.status==="FT"):state.data.games.filter(g=>g.status!=="FT"&&Date.parse(g.start)>=now-6*60*60*1000);
    rows=rows.filter(g=>!q||g.home.toLowerCase().includes(q)||g.away.toLowerCase().includes(q));
    $("nbaListTitle").textContent=state.view==="results"?"Risultati":"In programma";
    $("nbaSummary").textContent=rows.length+' partite · stagione '+state.data.season+' · fonte ESPN'+(state.data.errors?.length?' · '+state.data.errors.length+' richieste parziali non riuscite':"");
    $("nbaList").innerHTML=rows.length?rows.slice(0,state.shown).map(card).join(""):'<div class="empty-state">Nessuna partita trovata con questi filtri.</div>';
    $("nbaMore").hidden=rows.length<=state.shown;
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
    $("nbaList").addEventListener("click",event=>{const button=event.target.closest("[data-pick]");if(!button)return;const game=state.data?.games.find(x=>String(x.id)===button.dataset.pick);if(game?.prediction)togglePick(game,button.dataset.side);});
    $("nbaSlip").addEventListener("click",event=>{
      const remove=event.target.closest("[data-remove]");
      if(remove){const rows=picks(),target=rows[Number(remove.dataset.remove)];if(target)writeAll(readAll().filter(x=>!(x.sport==="nba"&&String(x.id||x.eventId)===String(target.id||target.eventId))));render();return;}
      if(event.target.closest("#nbaSlipClear")){writeAll(readAll().filter(x=>x.sport!=="nba"));render();return;}
      if(event.target.closest("#nbaPlaySisal"))openSisal();
    });
    $("nbaMore").addEventListener("click",()=>{state.shown+=PAGE;render();});
    $("nbaRefresh").addEventListener("click",()=>load(true));
    window.addEventListener("matchmind:picks-updated",renderSlip);
    window.addEventListener("storage",event=>{if(!event.key||event.key===KEY)renderSlip();});
    load();
  });
})();
