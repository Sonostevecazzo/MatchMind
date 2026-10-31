/* Independent page controllers for the MatchMind multi-screen PWA. */
(function(){
 const MM=()=>window.MM, $=id=>document.getElementById(id);
 const qs=new URLSearchParams(location.search);
 const fmt=(v,d=0)=>Number(v||0).toLocaleString('it-IT',{maximumFractionDigits:d});
 const esc=s=>MM().esc(s);
 const matchCard=m=>{
  const done=MM().hasScore(m),state=MM().status(m),score=done?m.hg+' – '+m.ag:(m.time||'VS');
  const statusClass=done?'finished':state==='Da aggiornare'?'stale':'scheduled';
  const centerLabel=done?'RISULTATO FINALE':state==='Da aggiornare'?'ORARIO DA DEFINIRE':'CALCIO D’INIZIO';
  const forecast=!done&&MM().upcoming(m)?MM().forecast(m,MM().data.history):null;
  const preview=forecast?'<div class="fixture-preview"><div class="preview-head"><span>STIMA MATCHMIND</span><small>'+(forecast.sampleEnough?'Campione adeguato':'Campione limitato')+'</small></div><div class="preview-probs">'+[['1',forecast.probabilities.home],['X',forecast.probabilities.draw],['2',forecast.probabilities.away]].map(([label,value])=>'<div><span>'+label+'</span><b>'+fmt(value*100,0)+'%</b><i><em style="width:'+Math.max(0,Math.min(100,value*100))+'%"></em></i></div>').join('')+'</div></div>':'';
  return '<article class="fixture"><div class="fixture-head"><span class="league-label"><img class="competition-logo-small" src="https://media.api-sports.io/football/leagues/135.png" alt="" loading="lazy" onerror="this.remove()"> SERIE A'+(m.round?' <span class="fixture-round">· GIORNATA '+m.round+'</span>':'')+'</span><span class="fixture-state '+statusClass+'">'+state+'</span></div>'+
   '<div class="fixture-main fixture-horizontal"><a class="fixture-side home" href="'+MM().teamUrl(m.home)+'">'+MM().badge(m.home)+'<b>'+esc(m.home)+'</b></a><div class="fixture-center"><strong class="fixture-score '+(done?'':'pending')+'">'+score+'</strong><span class="fixture-center-label">'+centerLabel+'</span></div><a class="fixture-side away" href="'+MM().teamUrl(m.away)+'">'+MM().badge(m.away)+'<b>'+esc(m.away)+'</b></a></div>'+preview+
   '<div class="fixture-foot"><span class="fixture-date">'+esc(MM().shortDate(m))+(m.time?' · '+esc(m.time):'')+'</span><a href="'+MM().matchUrl(m)+'">Match center <span aria-hidden="true">↗</span></a></div></article>';
 };
 const groupCards=(rows,reverse=false)=>{const groups=MM().groupByDate(rows);if(reverse)groups.reverse();return groups.map(([date,list])=>'<div class="date-divider"><span>'+esc(MM().shortDate(list[0]))+'</span><small>'+list.length+' '+(list.length===1?'partita':'partite')+'</small></div>'+list.map(matchCard).join('')).join('');};
 function setStatus(message,kind=''){const e=$('globalStatus');if(e)e.innerHTML=(kind?'<i class="status-dot '+kind+'"></i>':'')+esc(message);}
 async function initHome(d){
   const current=d.matches,played=current.filter(MM().hasScore),next=current.filter(MM().upcoming).sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||'')));
   $('homePlayed').textContent=fmt(played.length);$('homeUpcoming').textContent=fmt(next.length);$('homeTeams').textContent=fmt(MM().getTeams(current).length);
   $('homeStatus').textContent=d.source==='cache'?'Dati locali salvati · fonte non aggiornata':'Calendario Serie A caricato · '+new Date(d.updatedAt||Date.now()).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
   $('homeDot').classList.toggle('ok',d.source!=='cache');
   $('homeNext').innerHTML=next.length?next.slice(0,5).map(matchCard).join(''):'<div class="empty-state">Nessuna prossima partita disponibile nel feed attuale.</div>';
   const favs=(()=>{try{return JSON.parse(localStorage.getItem('matchmind-favorites-v1')||'[]')}catch{return []}})();
   $('homeFavorites').innerHTML=favs.length?favs.map(n=>'<a class="team-tile" href="'+MM().teamUrl(n)+'">'+MM().badge(n)+'<b>'+esc(n)+'</b></a>').join(''):'<div class="empty-state" style="grid-column:1/-1">Non hai ancora salvato squadre. Apri Esplora e tocca la stella accanto a un club.</div>';
 }
 let matchFilter='upcoming',shownLimit=45,activeMatches=[];
 function initMatches(d){
   const round=$('matchRound'),teamSelect=$('matchTeam');teamSelect.innerHTML='<option value="">Tutte le squadre</option>'+MM().getTeams(d.matches).map(t=>'<option value="'+esc(t)+'">'+esc(t)+'</option>').join('');const rounds=[...new Set(d.matches.map(m=>Number(m.round)).filter(n=>Number.isInteger(n)&&n>0))].sort((a,b)=>a-b);
   round.innerHTML='<option value="">Tutte le giornate</option>'+rounds.map(n=>'<option value="'+n+'">Giornata '+n+'</option>').join('');
   const render=()=>{
    const q=MM().norm($('matchSearch').value),date=$('matchDate').value,team=teamSelect.value,gw=round.value,season=$('matchSeason').value;
    const previousStart=MM().seasonStart()-1,previousFrom=previousStart+'-07-01',previousTo=MM().seasonStart()+'-07-01';let base=season==='previous'?d.history.filter(m=>MM().hasScore(m)&&m.date>=previousFrom&&m.date<previousTo):d.matches;
    activeMatches=base.filter(m=>(!q||MM().norm(m.home).includes(q)||MM().norm(m.away).includes(q))&&(!date||m.date===date)&&(!team||MM().norm(m.home)===MM().norm(team)||MM().norm(m.away)===MM().norm(team))&&(!gw||Number(m.round)===Number(gw)));
    if(matchFilter==='upcoming')activeMatches=activeMatches.filter(MM().upcoming);
    else if(matchFilter==='finished')activeMatches=activeMatches.filter(MM().hasScore);
    else if(matchFilter==='stale')activeMatches=activeMatches.filter(m=>!MM().hasScore(m)&&!MM().upcoming(m));
    activeMatches.sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||'')));
    if(matchFilter==='finished'||matchFilter==='stale')activeMatches.reverse();
    const target=$('matchList'),visible=activeMatches.slice(0,shownLimit);
    $('matchListTitle').textContent={upcoming:'In programma',finished:'Risultati',stale:'Da aggiornare',all:'Tutte le partite'}[matchFilter];
    $('matchListSummary').textContent=activeMatches.length+' partite trovate · '+(season==='previous'?'stagione precedente':'stagione corrente');
    target.innerHTML=visible.length?groupCards(visible,matchFilter==='finished'||matchFilter==='stale'):'<div class="empty-state">Nessuna partita corrisponde ai filtri selezionati.</div>';
    $('moreMatches').hidden=activeMatches.length<=shownLimit;
   };
   ['matchSearch','matchDate','matchTeam','matchRound','matchSeason'].forEach(id=>$(id).addEventListener(id==='matchSearch'?'input':'change',()=>{shownLimit=45;render()}));
   $('clearMatchFilters').addEventListener('click',()=>{$('matchSearch').value='';$('matchDate').value='';teamSelect.value='';round.value='';$('matchSeason').value='current';shownLimit=45;render()});
   $('matchFilters').querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{matchFilter=b.dataset.filter;$('matchFilters').querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));shownLimit=45;render()}));
   $('moreMatches').addEventListener('click',()=>{shownLimit+=45;render()});
   render();
 }
 function initExplore(d){
   const target=$('teamDirectory'),search=$('teamSearch');
   const teams=MM().getTeams(d.matches);
   function render(){const q=MM().norm(search.value),list=teams.filter(t=>MM().norm(t).includes(q));target.innerHTML=list.length?list.map(n=>'<div class="team-tile"><a href="'+MM().teamUrl(n)+'" style="display:flex;align-items:center;gap:7px;flex:1;min-width:0">'+MM().badge(n)+'<b>'+esc(n)+'</b></a><button class="favorite-toggle" data-fav="'+esc(n)+'" title="Segui squadra" aria-label="Segui '+esc(n)+'">'+(MM().isFavorite(n)?'★':'☆')+'</button></div>').join(''):'<div class="empty-state">Nessuna squadra trovata.</div>';}
   search.addEventListener('input',render);
   target.addEventListener('click',e=>{const b=e.target.closest('[data-fav]');if(!b)return;const active=MM().toggleFavorite(b.dataset.fav);b.textContent=active?'★':'☆';});
   render();
 }
 function tableHTML(rows){
  if(!rows.length)return '<div class="empty-state">Classifica non disponibile: servono risultati conclusi nel feed.</div>';
  return '<div class="table-scroll"><table class="league-table"><thead><tr><th>#</th><th>Squadra</th><th>PG</th><th>V</th><th>N</th><th>P</th><th>DR</th><th>PT</th></tr></thead><tbody>'+
   rows.map((t,i)=>'<tr><td>'+(i+1)+'</td><td class="club"><a href="'+MM().teamUrl(t.name)+'">'+MM().badge(t.name)+esc(t.name)+'</a></td><td>'+t.played+'</td><td>'+t.w+'</td><td>'+t.d+'</td><td>'+t.l+'</td><td>'+t.gd+'</td><td class="points">'+t.pts+'</td></tr>').join('')+'</tbody></table></div>';
 }
 function initLeague(d){
  const table=MM().standings(d.matches.filter(MM().hasScore));$('leagueSeason').textContent='Stagione '+d.season+'/'+String(d.season+1).slice(-2)+' · '+table.length+' squadre con risultati';
  $('standingsBody').innerHTML=tableHTML(table);
  const future=d.matches.filter(MM().upcoming).sort((a,b)=>a.date.localeCompare(b.date));
  $('leagueFixtureList').innerHTML=future.length?groupCards(future):'<div class="empty-state">Nessuna partita futura disponibile.</div>';
  const played=d.matches.filter(MM().hasScore),goals=played.reduce((s,m)=>s+Number(m.hg)+Number(m.ag),0);
  const home=played.filter(m=>m.hg>m.ag).length,draw=played.filter(m=>m.hg===m.ag).length,away=played.filter(m=>m.hg<m.ag).length;
  $('leagueStatsGrid').innerHTML='<div class="metric"><span>PARTITE CONCLUSE</span><b>'+played.length+'</b><small>risultati nel feed della stagione</small></div><div class="metric"><span>GOL TOTALI</span><b>'+goals+'</b><small>'+fmt(played.length?goals/played.length:0,2)+' per partita</small></div><div class="metric"><span>VITTORIE CASA</span><b>'+home+'</b><small>esiti con successo della squadra di casa</small></div><div class="metric"><span>PAREGGI / TRASFERTE</span><b>'+draw+' / '+away+'</b><small>pareggi e vittorie in trasferta</small></div>';
  $('leagueTabs').querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{const view=b.dataset.view;$('leagueTabs').querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));$('leagueStandings').hidden=view!=='standings';$('leagueFixtures').hidden=view!=='fixtures';$('leagueStats').hidden=view!=='stats';}));
 }
 function initTeam(d){
  const name=qs.get('team')||'';const normName=MM().norm(name);const rows=d.matches.filter(m=>MM().norm(m.home)===normName||MM().norm(m.away)===normName).sort((a,b)=>a.date.localeCompare(b.date));
  if(!name||!rows.length){$('teamContent').innerHTML='<div class="empty-state">Squadra non trovata nei dati attualmente disponibili. Torna a <a class="text-link" href="explore.html">Esplora</a>.</div>';return;}
  const played=rows.filter(MM().hasScore),up=rows.filter(MM().upcoming),form=MM().teamStats(name,d.history);
  const wins=form.form.filter(x=>x==='W').length,draws=form.form.filter(x=>x==='D').length;
  $('teamContent').innerHTML='<div class="team-hero">'+MM().badge(name)+'<div style="flex:1"><h1>'+esc(name)+'</h1><p>Serie A · profilo squadra</p></div><button id="teamFavorite">'+(MM().isFavorite(name)?'★ Seguita':'☆ Segui')+'</button></div>'+
  '<div class="stat-strip"><div class="stat-cell"><b>'+played.length+'</b><span>RISULTATI NEL FEED</span></div><div class="stat-cell"><b>'+wins+'V · '+draws+'N</b><span>ULTIME CINQUE</span></div><div class="stat-cell"><b>'+up.length+'</b><span>PROSSIME PARTITE</span></div></div>'+
  '<section class="section"><div class="section-head"><div><h2>Forma recente</h2><p>Ultimi risultati storici disponibili.</p></div></div><div class="panel panel-pad"><div class="form-row">'+(form.form.length?form.form.map(x=>'<span class="form-chip '+x+'">'+x+'</span>').join(''):'<span class="notice">Forma non disponibile</span>')+'</div><div class="data-row"><span>Gol segnati medi (ultime 10)</span><b>'+fmt(form.for,2)+'</b></div><div class="data-row"><span>Gol subiti medi (ultime 10)</span><b>'+fmt(form.against,2)+'</b></div></div></section>'+
  '<section class="section"><div class="section-head"><div><h2>Calendario e risultati</h2><p>Partite in cui compare '+esc(name)+'.</p></div></div><div class="fixture-list">'+groupCards(rows.slice(-25),true)+'</div></section>';
  $('teamFavorite').addEventListener('click',()=>{const on=MM().toggleFavorite(name);$('teamFavorite').textContent=on?'★ Seguita':'☆ Segui';});
 }
 function probCard(label,value){const pct=value*100;return '<div class="prob"><span>'+label+'</span><b>'+fmt(pct,1)+'%</b><div class="track"><i style="width:'+Math.max(0,Math.min(100,pct))+'%"></i></div></div>';}
 async function initMatch(d){
  const date=qs.get('date'),home=qs.get('home'),away=qs.get('away'),key=MM().norm;
  const match=d.matches.find(m=>m.date===date&&key(m.home)===key(home)&&key(m.away)===key(away))||d.history.find(m=>m.date===date&&key(m.home)===key(home)&&key(m.away)===key(away));
  if(!match){$('matchDetail').innerHTML='<div class="empty-state">Partita non trovata. <a class="text-link" href="matches.html">Torna al calendario ↗</a></div>';return;}
  const done=MM().hasScore(match),f=MM().forecast(match,d.history),p=f.probabilities;
  const seasonContext=window.MatchMindRounds?.matchContext(match,d.history,d.matches);
  const seasonContextHtml=seasonContext?'<section class="section"><div class="section-head"><div><h2>Classifica e obiettivi stagionali</h2><p>Fotografia alla data della partita, senza usare risultati successivi.</p></div></div><div class="panel panel-pad">'+[seasonContext.home,seasonContext.away].map(t=>'<div class="data-row"><span>'+esc(t.team)+' · posizione '+(t.rank??'—')+' · '+(t.points??'—')+' pt</span><b>'+esc(t.objective)+'</b></div><small style="display:block;color:#91a0ae;font-size:9px;margin:0 0 10px">PG '+(t.played??'—')+' · DR '+(t.goalDifference??'—')+(t.pointsToFourth!==null&&t.pointsToFourth!==undefined?' · distanza 4ª: '+t.pointsToFourth+' pt':'')+(t.pointsToSixth!==null&&t.pointsToSixth!==undefined?' · distanza 6ª: '+t.pointsToSixth+' pt':'')+(t.pointsAboveSafety!==null&&t.pointsAboveSafety!==undefined?' · margine 17ª: '+t.pointsAboveSafety+' pt':'')+'</small>').join('')+'<small style="color:#91a0ae;font-size:9px;line-height:1.5">'+esc(seasonContext.disclaimer)+'</small></div></section>':'';
  $('matchDetail').innerHTML='<div class="match-detail-score"><div class="match-detail-meta"><img class="competition-logo-small" src="https://media.api-sports.io/football/leagues/135.png" alt="" onerror="this.remove()"> SERIE A · '+esc(MM().dateLabel(match))+(match.round?' · GIORNATA '+match.round:'')+'</div><div class="match-detail-teams"><div class="match-detail-side"><a href="'+MM().teamUrl(match.home)+'">'+MM().badge(match.home)+'</a><b>'+esc(match.home)+'</b></div><div class="match-detail-result '+(done?'':'pending')+'">'+(done?match.hg+' – '+match.ag:(match.time||'VS'))+'</div><div class="match-detail-side"><a href="'+MM().teamUrl(match.away)+'">'+MM().badge(match.away)+'</a><b>'+esc(match.away)+'</b></div></div><div style="margin-top:12px;color:#91a0ae;font-size:8px">'+(done?'RISULTATO ARCHIVIATO':MM().status(match).toUpperCase())+'</div></div>'+
  '<section class="section analysis-section" style="margin-top:18px"><div class="section-head"><div><div class="eyebrow">MODELLO STATISTICO</div><h2>Analisi MatchMind</h2><p>Modello Poisson · '+f.historyCount+' partite archiviate nel campione.</p></div></div>'+(f.sampleEnough?'<div class="notice good">Base storica completa per questa stima: almeno 10 partite precedenti per ciascuna squadra. Le probabilità restano indicative e non sono una previsione certa.</div>':'<div class="notice warning">Campione squadra incompleto: '+esc(match.home)+' '+f.home.played+'/10 e '+esc(match.away)+' '+f.away.played+'/10 partite disponibili. Le probabilità sono esplorative e non vanno considerate robuste.</div>')+
  '<div class="section-head" style="margin-top:12px"><div><h2>Probabilità 1X2</h2><p>Distribuzione stimata degli esiti</p></div></div><div class="prob-grid">'+probCard('1 · Casa',p.home)+probCard('X · Pareggio',p.draw)+probCard('2 · Trasferta',p.away)+'</div>'+
  '<div class="section-head" style="margin-top:13px"><div><h2>Mercati goal</h2><p>Probabilità derivate dalla distribuzione Poisson</p></div></div><div class="prob-grid">'+probCard('Gol',p.btts)+probCard('No Gol',1-p.btts)+probCard('Over 2,5',p.o25)+'</div><div class="prob-grid" style="margin-top:7px">'+probCard('Over 1,5',p.o15)+probCard('Over 3,5',p.o35)+probCard('Under 2,5',1-p.o25)+'</div>'+
  '<div class="panel panel-pad match-model-context" style="margin-top:14px"><div class="context-heading"><span>CONTESTO DEL MODELLO</span><small>Stime, non dati osservati</small></div><div class="data-row"><span>Partite usate · '+esc(match.home)+'</span><b>'+f.home.played+'</b></div><div class="data-row"><span>Partite usate · '+esc(match.away)+'</span><b>'+f.away.played+'</b></div><div class="data-row"><span>Periodo storico complessivo</span><b>'+(f.historyStart&&f.historyEnd?esc(f.historyStart)+' – '+esc(f.historyEnd):'Non disponibile')+'</b></div><div class="data-row"><span>Gol attesi stimati · '+esc(match.home)+'</span><b>'+fmt(f.homeXg,2)+'</b></div><div class="data-row"><span>Gol attesi stimati · '+esc(match.away)+'</span><b>'+fmt(f.awayXg,2)+'</b></div><div class="data-row"><span>Forma '+esc(match.home)+'</span><div class="form-row">'+(f.home.form.length?f.home.form.map(x=>'<i class="form-chip '+x+'">'+x+'</i>').join(''):'—')+'</div></div><div class="data-row"><span>Forma '+esc(match.away)+'</span><div class="form-row">'+(f.away.form.length?f.away.form.map(x=>'<i class="form-chip '+x+'">'+x+'</i>').join(''):'—')+'</div></div></div></section>'+
  seasonContextHtml+
  (done?'<div class="notice">Partita conclusa: il contesto prematch e le quote non vengono presentati come dati correnti.</div>':'<section class="section provider-section"><div class="section-head"><div><div class="eyebrow">DATI ESTERNI</div><h2>Quote e indisponibili</h2><p>Solo dati restituiti dal provider, quando disponibili.</p></div></div><div id="matchContext" class="panel panel-pad"><div class="loading-state">Verifica copertura e contesto partita…</div></div></section>')+
  '<div style="margin-top:12px"><a class="text-link" href="analysis-lab.html">Apri il centro MatchMind Intelligence ↗</a></div>';
  if(!done){
   try{
    const c=await MM().playerApi('type=match&date='+encodeURIComponent(match.date)+'&home='+encodeURIComponent(match.home)+'&away='+encodeURIComponent(match.away),'match:'+match.date+':'+MM().norm(match.home)+':'+MM().norm(match.away),5*60*1000);
    const injuries=(c.injuries||[]).filter(i=>MM().norm(i.team)===MM().norm(match.home)||MM().norm(i.team)===MM().norm(match.away));
    const markets=(c.bookmakers||[]).flatMap(book=>(book.bets||[]).map(market=>({book:book.name,market:market.name,values:market.values||[]})));
    const bestByMarket=new Map();
    markets.forEach(m=>m.values.forEach(v=>{
      const odd=Number(v.odd);if(!Number.isFinite(odd)||odd<=1)return;
      let group='',value='',label='',modelProb=null;
      if(m.market==='Match Winner'){
        group='1X2';value=v.value;
        label=value==='Home'?'1 · '+match.home:value==='Away'?'2 · '+match.away:'X · Pareggio';
        modelProb={Home:p.home,Draw:p.draw,Away:p.away}[value];
      }else if(m.market==='Both Teams To Score'){
        const answer=String(v.value||'').trim().toLowerCase();
        if(!['yes','no','gol','no gol','both teams to score','both teams not to score'].includes(answer))return;
        group='BTTS';value=['yes','gol','both teams to score'].includes(answer)?'yes':'no';
        label=value==='yes'?'Gol':'No Gol';modelProb=value==='yes'?p.btts:1-p.btts;
      }else if(m.market==='Goals Over/Under'){
        const matchTotal=String(v.value||'').match(/^(Over|Under)\s+(\d+(?:[.,]\d+)?)$/i);
        if(!matchTotal)return;
        const side=matchTotal[1].toLowerCase(),line=Number(matchTotal[2].replace(',','.'));
        const key=line===1.5?'o15':line===2.5?'o25':line===3.5?'o35':null;
        if(!key)return;
        group='TOTAL '+line;value=side;label=(side==='over'?'Over ':'Under ')+line.toFixed(1).replace('.',',');
        const over=p[key];modelProb=side==='over'?over:1-over;
      }else return;
      if(!Number.isFinite(modelProb))return;
      const k=group+'|'+value,old=bestByMarket.get(k);
      if(!old||odd>old.odd)bestByMarket.set(k,{group,value,label,odd,book:m.book,modelProb});
    }));
    const allQuotes=[...bestByMarket.values()];
    const grouped=new Map();allQuotes.forEach(q=>{if(!grouped.has(q.group))grouped.set(q.group,[]);grouped.get(q.group).push(q);});
    const candidates=[...grouped.values()].filter(group=>group.length>=2).flatMap(group=>{
      const margin=group.reduce((sum,q)=>sum+1/q.odd,0);
      return group.map(q=>({...q,marketProb:(1/q.odd)/margin,edge:q.modelProb-(1/q.odd)/margin,ev:q.modelProb*q.odd-1}));
    }).sort((a,b)=>b.ev-a.ev);
    const bestValue=candidates[0]||null;
    const marketPrices=allQuotes.filter(q=>q.group==='1X2');
    const outcomeRows=allQuotes;
    const oddsFresh=c.oddsUpdatedAt&&Number.isFinite(Date.parse(c.oddsUpdatedAt))?Math.max(0,(Date.now()-Date.parse(c.oddsUpdatedAt))/60000):null;
    const valueHtml=bestValue&&f.sampleEnough&&oddsFresh!==null&&oddsFresh<=120&&bestValue.ev>0.03
      ?'<div class="notice good"><b>Possibile valore da verificare: '+esc(bestValue.label)+'</b><br>Quota migliore '+fmt(bestValue.odd,2)+' presso '+esc(bestValue.book)+'. Probabilità modello '+fmt(bestValue.modelProb*100,1)+'%, probabilità implicita depurata dal margine '+fmt(bestValue.marketProb*100,1)+'%, vantaggio stimato '+fmt(bestValue.edge*100,1)+' punti. EV teorico '+(bestValue.ev>=0?'+':'')+fmt(bestValue.ev*100,1)+'% per unità puntata.<br><small>Segnale esplorativo: non è una raccomandazione né una garanzia di profitto.</small></div>'
      :'<div class="notice warning">'+(!bestValue?'Non ci sono mercati con almeno due esiti confrontabili.':!f.sampleEnough?'Nessun suggerimento: campione storico insufficiente.':oddsFresh===null?'Nessun suggerimento: manca l’orario di aggiornamento delle quote.':oddsFresh>120?'Nessun suggerimento: quote troppo vecchie.':'Nessun mercato supera la soglia prudenziale di valore atteso (+3%).')+'</div>';
    const odds=c.oddsAvailable
      ?'<div class="data-row"><span>Fonte quote</span><b>'+esc(c.oddsSource||'Provider')+'</b></div><div class="data-row"><span>Ultimo aggiornamento quote</span><b>'+(c.oddsUpdatedAt?new Date(c.oddsUpdatedAt).toLocaleString('it-IT'):'Non comunicato')+'</b></div><div class="data-row"><span>Bookmaker / quote</span><b>'+new Set(outcomeRows.map(v=>v.book)).size+' / '+outcomeRows.length+'</b></div>'+valueHtml+
       (outcomeRows.length?'<div class="eyebrow" style="margin-top:12px">QUOTE SISAL RILEVATE</div>'+outcomeRows.map(v=>'<div class="data-row"><span>'+(v.group==='1X2'?(v.value==='Home'?'1 · '+esc(match.home):v.value==='Away'?'2 · '+esc(match.away):'X · Pareggio'):esc(v.label))+'</span><b>'+fmt(v.odd,2)+' · '+esc(v.book)+'</b></div>').join(''):'')
      :'<div class="notice warning">Quote non disponibili: '+esc(c.oddsError||'la fonte non ha restituito mercati per questa partita')+'</div>';
    const abs=injuries.length?injuries.map(i=>'<div class="data-row"><span>'+esc(i.name)+' · '+esc(i.team)+'</span><b>'+esc(i.status||'Segnalazione')+'</b></div>').join(''):'<div class="notice">Nessuna indisponibilità riportata dalla fonte. Non equivale alla conferma di una formazione completa.</div>';
    const modelMap={Home:p.home,Draw:p.draw,Away:p.away};
    const mostLikely=Object.entries(modelMap).sort((a,b)=>b[1]-a[1])[0];
    const likelyLabel=mostLikely[0]==='Home'?'1 · '+esc(match.home):mostLikely[0]==='Away'?'2 · '+esc(match.away):'X · Pareggio';
    const suggestion='<div class="section-head" style="margin-top:13px"><div><h2>Come leggere la scommessa</h2><p>Probabilità e convenienza sono due cose diverse.</p></div></div><div class="notice">L’esito più probabile secondo il modello è '+likelyLabel+' ('+fmt(mostLikely[1]*100,1)+'%). Non significa che sia conveniente: per valutare il prezzo confronta probabilità modello e quota. Se non emerge un margine positivo e dati aggiornati, la scelta razionale è non puntare.</div>';
    $('matchContext').innerHTML='<div class="context-heading"><span>QUOTE E VALORE ATTESO</span><small>Fonte esterna · disponibilità variabile</small></div>'+odds+suggestion+'<div style="margin-top:14px" class="eyebrow">INDISPONIBILI · API-FOOTBALL</div>'+abs+'<div class="notice" style="margin-top:10px">Fonti prematch: '+esc(c.oddsSource||'quote non disponibili')+' per le quote; API-Football per fixture e indisponibili. Le quote possono cambiare rapidamente.</div>';
   }catch(e){$('matchContext').innerHTML='<div class="notice warning">Dati prematch non disponibili: '+esc(e.message)+'</div>';}
  }
 }
 let playerResults=[];
 function initPlayers(){
  const status=$('playerApiStatus');
  const search=async()=>{
   const q=$('playerSearch').value.trim();if(q.length<4){status.textContent='Inserisci almeno quattro caratteri.';return;}
   const b=$('playerSearchBtn');b.disabled=true;b.textContent='Cerco…';$('playerResults').innerHTML='<div class="loading-state">Ricerca giocatore…</div>';
   try{
    const data=await MM().playerApi('type=search&q='+encodeURIComponent(q),'search:'+MM().norm(q));
    playerResults=data.players||[];status.textContent='Fonte API-Football · stagione '+(data.season||'non indicata');
    $('playerResults').innerHTML=playerResults.length?playerResults.map((p,i)=>'<article class="player-item"><div class="player-item-head"><span><b>'+esc(p.name)+'</b><br><small>'+esc(p.team?.name||'Squadra non disponibile')+(p.position?' · '+esc(p.position):'')+'</small></span><button class="primary" data-form="'+i+'" '+(!p.id||!p.team?.id?'disabled':'')+'>Forma recente</button></div><div class="player-metrics"><div><b>'+fmt(p.season?.appearances)+'</b><span>Presenze</span></div><div><b>'+fmt(p.season?.goals)+'</b><span>Gol</span></div><div><b>'+fmt(p.season?.assists)+'</b><span>Assist</span></div></div></article>').join(''):'<div class="empty-state">Nessun risultato trovato dal provider.</div>';
   }catch(e){status.textContent='Dati non disponibili · '+e.message;$('playerResults').innerHTML='<div class="notice warning">'+esc(e.message)+'</div>';}
   finally{b.disabled=false;b.textContent='Cerca';}
  };
  $('playerSearchBtn').addEventListener('click',search);$('playerSearch').addEventListener('keydown',e=>{if(e.key==='Enter')search();});
  $('playerResults').addEventListener('click',async e=>{
   const b=e.target.closest('[data-form]');if(!b)return;const p=playerResults[Number(b.dataset.form)];if(!p)return;b.disabled=true;b.textContent='Carico…';$('playerForm').innerHTML='<div class="loading-state">Recupero ultime presenze…</div>';
   try{const d=await MM().playerApi('type=form&player='+encodeURIComponent(p.id)+'&team='+encodeURIComponent(p.team.id),'form:'+p.id+':'+p.team.id,6*60*60*1000),s=d.summary||{},a=d.appearances||[];
    $('playerForm').innerHTML='<article class="player-item"><b>'+esc(p.name)+'</b><small> · '+esc(p.team.name)+'</small><div class="player-metrics"><div><b>'+fmt(s.minutes)+'</b><span>Minuti</span></div><div><b>'+fmt(s.goals)+'</b><span>Gol</span></div><div><b>'+fmt(s.assists)+'</b><span>Assist</span></div></div>'+a.map(x=>'<div class="data-row"><span>'+esc(x.date)+' · '+esc(x.opponent)+' ('+esc(x.score)+')</span><b>'+fmt(x.minutes)+' min · '+fmt(x.goals)+' G · '+fmt(x.assists)+' A</b></div>').join('')+'</article>';
   }catch(e){$('playerForm').innerHTML='<div class="notice warning">'+esc(e.message)+'</div>';}finally{b.disabled=false;b.textContent='Forma recente';}
  });
 }
 async function initSettings(){
  const keyInput=$('apiFootballKey'),status=$('settingsProviderStatus'),usage=$('settingsApiUsage');
  const readKey=()=>{try{return sessionStorage.getItem('matchmind-api-football-session-key')||''}catch{return ''}};
  keyInput.value=readKey();
  const headers=()=>{const h={Accept:'application/json'};const k=readKey();if(k)h['X-MatchMind-API-Key']=k;return h;};
  async function verify(){
   status.innerHTML='<div class="loading-state">Verifica della chiave con API-Football…</div>';usage.innerHTML='';
   try{
    const res=await fetch('./api/player-context?type=status',{headers:headers(),cache:'no-store'}),d=await res.json(),p=d.providers||{},u=d.apiFootballUsage;
    if(!res.ok||!p.apiFootball||!u||!u.available)throw new Error(d.error||'Chiave non verificata dal provider.');
    status.innerHTML='<div class="notice good">Connessione verificata · '+esc(u.plan||'Piano attivo')+' · '+fmt(u.remaining)+' richieste residue oggi.</div>';
    usage.innerHTML='<div class="data-row"><span>Consumo giornaliero</span><b>'+fmt(u.current)+' / '+fmt(u.limitDay)+'</b></div><div class="data-row"><span>Residue</span><b>'+fmt(u.remaining)+'</b></div><div class="data-row"><span>Ultima verifica</span><b>'+new Date(u.checkedAt).toLocaleTimeString('it-IT')+'</b></div>';
   }catch(e){status.innerHTML='<div class="notice warning">'+esc(e.message)+' Se hai appena inserito la chiave, controlla che sia corretta e che il piano sia attivo.</div>';}
  }
  $('saveSessionKey').addEventListener('click',async()=>{
   const value=keyInput.value.trim();
   if(!/^[A-Za-z0-9_-]{20,256}$/.test(value)){status.innerHTML='<div class="notice warning">Formato non valido. Incolla la chiave API-Football completa.</div>';return;}
   try{sessionStorage.setItem('matchmind-api-football-session-key',value);}catch{status.innerHTML='<div class="notice warning">Il browser non consente di salvare la chiave nella sessione.</div>';return;}
   await verify();
  });
  $('clearSessionKey').addEventListener('click',()=>{try{sessionStorage.removeItem('matchmind-api-football-session-key')}catch{}keyInput.value='';status.innerHTML='<div class="notice">Chiave rimossa dalla sessione corrente. Le richieste useranno il secret Cloudflare, se configurato.</div>';usage.innerHTML='';});
  $('testSessionKey').addEventListener('click',verify);
  $('copyCloudflareSteps').addEventListener('click',()=>GenCopy('API_FOOTBALL_KEY'));
  if(readKey())await verify();else status.innerHTML='<div class="notice">Nessuna chiave inserita in questa sessione. Il calendario pubblico e il modello locale continuano a funzionare.</div>';
 }
 function GenCopy(value){try{navigator.clipboard.writeText(value);$('settingsProviderStatus').innerHTML='<div class="notice good">Nome del secret copiato.</div>';}catch{$('settingsProviderStatus').innerHTML='<div class="notice">Nome del secret: <b>'+value+'</b></div>';}}
 async function initData(){
  const check=async()=>{const target=$('providerStatus');target.innerHTML='<div class="loading-state">Verifica…</div>';try{const h={Accept:'application/json'};try{const k=sessionStorage.getItem('matchmind-api-football-session-key');if(k)h['X-MatchMind-API-Key']=k}catch{}const r=await fetch('./api/player-context?type=status',{headers:h,cache:'no-store'});const d=await r.json(),p=d.providers||{};const rows=[['Calendario e risultati','open-matchday · dati pubblici',true],['Probabilità statistiche','Modello Poisson locale',true],['Quote bookmaker','Sisal IT · OddsPapi',!!p.sisalOdds],['Infortuni e forma giocatori','API-Football',!!p.apiFootball],['Calendario di riserva','football-data.org',!!p.footballData]];const usage=d.apiFootballUsage;
   const usageHtml=!p.apiFootball?'':(usage&&usage.available
    ?'<div class="data-row"><span>API-Football · consumo oggi</span><b>'+fmt(usage.current)+' / '+fmt(usage.limitDay)+' ('+fmt(usage.usedPercent,1)+'%)</b></div><small style="display:block;color:#7f8d9b;font-size:8px;margin:0 0 8px">Residue: '+fmt(usage.remaining)+(usage.plan?' · Piano '+esc(usage.plan):'')+(usage.subscriptionActive===false?' · Abbonamento non attivo':'')+' · Verificato '+new Date(usage.checkedAt).toLocaleTimeString('it-IT')+'</small>'
    :'<div class="data-row"><span>API-Football · consumo oggi</span><b style="color:var(--amber)">Non leggibile</b></div><small style="display:block;color:#7f8d9b;font-size:8px;margin:0 0 8px">La chiave è configurata, ma il provider non ha restituito il contatore. Verifica chiave e stato del servizio.</small>');
   target.innerHTML=rows.map(([a,b,on])=>'<div class="data-row"><span>'+a+'</span><b style="color:'+(on?'var(--mint)':'var(--amber)')+'">'+(on?'Chiave configurata · validità da verificare':'Non configurato')+'</b></div><small style="display:block;color:#7f8d9b;font-size:8px;margin:0 0 8px">'+b+'</small>').join('')+usageHtml;}catch(e){target.innerHTML='<div class="notice warning">Non riesco a verificare i provider. Il calendario e il modello locale possono comunque funzionare.</div>';}}
  $('checkProviders').addEventListener('click',check);await check();
 }
 function backtestHTML(r,e){
  if(!r.count)return '<div class="notice warning">Backtest non disponibile: nei dati caricati non ci sono abbastanza partite precedenti per entrambe le squadre (almeno 10 ciascuna) e almeno 30 partite complessive.</div>';
  const pct=x=>fmt(x*100,1)+'%',metric=(label,a,b)=>'<div class="data-row"><span>'+label+'</span><b>'+fmt(a,3)+' · baseline '+fmt(b,3)+'</b></div>';
  const bins=r.bins.map(x=>'<div class="data-row"><span>'+x.range+' · '+x.count+' pronostici</span><b>'+pct(x.confidence)+' previste / '+pct(x.hitRate)+' reali</b></div>').join('');
  const classNames={home:'Vittoria casa',draw:'Pareggio',away:'Vittoria trasferta'};
  const classRows=Object.entries(r.byClass||{}).map(([k,v])=>'<div class="data-row"><span>'+classNames[k]+' · probabilità media / frequenza reale</span><b>'+pct(v.predicted)+' / '+pct(v.observed)+'</b></div>').join('');
  const seasonRows=Object.entries(r.bySeason||{}).map(([y,v])=>'<div class="data-row"><span>Stagione '+y+' · '+v.count+' test</span><b>'+pct(v.accuracy)+' · LL '+fmt(v.logLoss,3)+' · Brier '+fmt(v.brier,3)+'</b></div>').join('');
  const enough=r.count>=100;
  return '<div class="notice '+(enough?'good':'warning')+'">'+(enough?'Campione di verifica utilizzabile, ma non sufficiente da solo a dimostrare un vantaggio stabile.':'Campione ridotto: risultati preliminari, non conclusivi.')+' Il test usa solo risultati precedenti alla data di ogni partita.</div>'+
   '<div class="stat-strip"><div class="stat-cell"><b>'+fmt(r.count)+'</b><span>PRONOSTICI TESTATI</span></div><div class="stat-cell"><b>'+pct(r.model.accuracy)+'</b><span>ESITO PIÙ PROBABILE CORRETTO</span></div><div class="stat-cell"><b>'+pct(r.baseline.accuracy)+'</b><span>BASELINE CORRETTA</span></div></div>'+
   '<div class="data-row"><span>Finestra test</span><b>'+esc(r.from)+' – '+esc(r.to)+'</b></div>'+
   '<div class="data-row"><span>IC 95% accuracy (Wilson)</span><b>'+pct(r.model.accuracyCI[0])+' – '+pct(r.model.accuracyCI[1])+'</b></div>'+
   '<div class="eyebrow" style="margin-top:12px">QUALITÀ PROBABILISTICA · PIÙ BASSO È MEGLIO</div>'+
   metric('Log loss · modello',r.model.logLoss,r.baseline.logLoss)+metric('Brier score 1X2 · modello',r.model.brier,r.baseline.brier)+'<div class="eyebrow" style="margin-top:14px">ESPERIMENTO ELO · CONFRONTO INDIPENDENTE</div>'+'<div class="data-row"><span>Pronostici Elo testati</span><b>'+fmt(e?.count||0)+'</b></div>'+'<div class="data-row"><span>Accuratezza Elo</span><b>'+pct(e?.model?.accuracy||0)+'</b></div>'+'<div class="data-row"><span>Log loss Elo</span><b>'+fmt(e?.model?.logLoss||0,3)+'</b></div>'+'<div class="data-row"><span>Brier Elo</span><b>'+fmt(e?.model?.brier||0,3)+'</b></div>'+'<div class="notice warning">Elo sperimentale non calibrato: K=20, vantaggio casa=40 punti, rating iniziale=1500. Le metriche vanno lette insieme al numero di pronostici testati; il modello non sostituisce Poisson.</div>'+'<small style="display:block;color:#7f8d9b;font-size:9px;line-height:1.5">Le partite della stessa data sono pronosticate dallo stesso snapshot dei rating. Gli aggiornamenti Elo avvengono solo dopo aver elaborato la data. Squadre non presenti in archivio partono da 1500.</small>'+
   '<div class="eyebrow" style="margin-top:12px">CALIBRAZIONE PER ESITO</div>'+
   '<p style="color:#91a0ae;font-size:10px;line-height:1.5">Probabilità media assegnata a ciascun esito e frequenza osservata nel campione.</p>'+classRows+
   '<div class="eyebrow" style="margin-top:12px">CALIBRAZIONE DEL SEGNO PIÙ PROBABILE</div>'+bins+
   '<div class="eyebrow" style="margin-top:12px">STABILITÀ NEL TEMPO</div>'+seasonRows+
   '<div class="notice '+(r.beatsBaseline?'good':'warning')+'">'+(r.beatsBaseline?'Il modello batte la baseline sia in Brier score sia in log loss nel campione testato.':'Il modello non batte la baseline su entrambe le metriche: non emerge un vantaggio predittivo dimostrato.')+'</div>'+
   '<small style="display:block;color:#7f8d9b;font-size:9px;line-height:1.5">Baseline: frequenze 1X2 delle sole partite antecedenti, con smoothing Laplace. Esclusi i casi con meno di 10 gare storiche per una delle squadre. Non è un test di redditività: non include quote, margini, stake o commissioni.</small>';
 }
 async function initMind(d){
  const rows=d.matches.filter(MM().upcoming).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,8);
  $('mindFixtures').innerHTML=rows.length?rows.map(matchCard).join(''):'<div class="empty-state">Nessuna partita futura disponibile per l’analisi.</div>';
  const assistantButton=$('assistantGenerate');
  if(assistantButton){
   assistantButton.addEventListener('click',async()=>{
    const result=$('assistantResult'),stake=Number($('assistantStake').value),minPayout=Number($('assistantMinPayout').value),maxPayout=Number($('assistantMaxPayout').value),legRange=String($('assistantLegs').value||'4-6').split('-').map(Number);
    const minLegs=legRange[0]||4,maxLegs=legRange[1]||6;
    if(!Number.isFinite(stake)||stake<=0||!Number.isFinite(minPayout)||!Number.isFinite(maxPayout)||minPayout<=0||maxPayout<minPayout){result.innerHTML='<div class="notice warning">Controlla puntata e intervallo della vincita potenziale.</div>';return;}
    assistantButton.disabled=true;assistantButton.textContent='Analisi in corso…';result.innerHTML='<div class="loading-state">Controllo campioni, quote e mercati prematch…</div>';
    try{
     const fixtures=d.matches.filter(MM().upcoming).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,12),candidates=[],coverage={fixtures:fixtures.length,eligible:0,missingOdds:0,staleOdds:0,weakSample:0};
     for(const match of fixtures){
      const forecast=MM().forecast(match,d.history);
      if(!forecast.sampleEnough){coverage.weakSample++;continue;}
      try{
       const c=await MM().playerApi('type=match&date='+encodeURIComponent(match.date)+'&home='+encodeURIComponent(match.home)+'&away='+encodeURIComponent(match.away),'match:'+match.date+':'+MM().norm(match.home)+':'+MM().norm(match.away),5*60*1000);
       const age=c.oddsUpdatedAt&&Number.isFinite(Date.parse(c.oddsUpdatedAt))?Math.max(0,(Date.now()-Date.parse(c.oddsUpdatedAt))/60000):null;
       if(!c.oddsAvailable||!Array.isArray(c.bookmakers)||!c.bookmakers.length){coverage.missingOdds++;continue;}
       if(age===null||age>120){coverage.staleOdds++;continue;}
       const p=forecast.probabilities,matchKey=match.date+'|'+MM().norm(match.home)+'|'+MM().norm(match.away),matchLabel=match.home+' – '+match.away;
       c.bookmakers.forEach(book=>{
        (book.bets||[]).forEach(market=>{
         const marketName=String(market.name||''),mapped=(market.values||[]).map(v=>{
          const odd=Number(v.odd);if(!Number.isFinite(odd)||odd<=1)return null;
          let selection='',probability=null,group='';
          if(marketName==='Match Winner'){
           selection=v.value==='Home'?'1':v.value==='Draw'?'X':v.value==='Away'?'2':'';
           probability={Home:p.home,Draw:p.draw,Away:p.away}[v.value];group='1X2';
          }else if(marketName==='Both Teams To Score'){
           const answer=String(v.value||'').trim().toLowerCase();
           if(['yes','gol','both teams to score'].includes(answer)){selection='Gol';probability=p.btts;}
           else if(['no','no gol','both teams not to score'].includes(answer)){selection='No Gol';probability=1-p.btts;}
           group='Gol/No Gol';
          }else if(marketName==='Goals Over/Under'){
           const parsed=String(v.value||'').match(/^(Over|Under)\s+(1\.5|2\.5|3\.5)$/i);
           if(parsed){const line=Number(parsed[2]),over=line===1.5?p.o15:line===2.5?p.o25:p.o35;selection=parsed[1].toLowerCase()==='over'?'Over '+line.toFixed(1):'Under '+line.toFixed(1);probability=parsed[1].toLowerCase()==='over'?over:1-over;group='U/O '+line.toFixed(1);}
          }
          return selection&&Number.isFinite(probability)?{selection,probability,odd,group}:null;
         }).filter(Boolean);
         if(mapped.length<2)return;
         const margin=mapped.reduce((sum,x)=>sum+1/x.odd,0);
         mapped.forEach(x=>{
          const implied=(1/x.odd)/margin,ev=x.probability*x.odd-1,edge=x.probability-implied;
          if(ev>0.03&&edge>0)candidates.push({matchKey,matchLabel,market:x.group,selection:x.selection,odd:x.odd,probability:x.probability,book:book.name||'Provider',ev,edge,updatedAt:c.oddsUpdatedAt});
         });
        });
       });
       coverage.eligible++;
      }catch(error){coverage.missingOdds++;}
     }
     const proposal=window.MatchMindRounds.buildAssistant(candidates,{stake,minPayout,maxPayout,minLegs,maxLegs});
     const pct=x=>fmt(x*100,2)+'%';
     const coverageHtml='<div class="notice">Controlli: '+coverage.fixtures+' partite · '+coverage.eligible+' con quote fresche e campione sufficiente · '+coverage.weakSample+' campione insufficiente · '+coverage.missingOdds+' senza quote · '+coverage.staleOdds+' quote non aggiornate.</div>';
     if(!proposal.available){
      result.innerHTML=coverageHtml+'<div class="notice warning" style="margin-top:9px">'+esc(proposal.reason)+'</div><small style="display:block;color:#91a0ae;margin-top:8px">Nessuna quota è stata stimata o inventata. Riprova quando provider e campioni avranno copertura sufficiente.</small>';
     }else{
      const legsHtml=proposal.legs.map((x,i)=>'<div class="data-row"><span><b>'+(i+1)+'. '+esc(x.matchLabel)+'</b><small style="display:block;color:#91a0ae">'+esc(x.market)+' · '+esc(x.selection)+' · '+esc(x.book)+'</small></span><b>'+fmt(x.odd,2)+'<small style="display:block;color:#91a0ae">'+pct(x.probability)+' · EV +'+fmt(x.ev*100,1)+'%</small></b></div>').join('');
      result.innerHTML=coverageHtml+'<div class="metric-grid" style="margin-top:10px"><div class="metric"><span>QUOTA COMPLESSIVA</span><b>'+fmt(proposal.odds,2)+'</b></div><div class="metric"><span>VINCITA POTENZIALE</span><b>€ '+fmt(proposal.payout,2)+'</b></div><div class="metric"><span>PROBABILITÀ CONGIUNTA</span><b>'+pct(proposal.probability)+'</b></div><div class="metric"><span>EVENTI</span><b>'+proposal.legs.length+'</b></div></div><div class="eyebrow" style="margin-top:12px">PROPOSTA · QUOTE DEL PROVIDER</div>'+legsHtml+'<div class="notice warning" style="margin-top:10px">La combinazione massimizza la probabilità stimata tra quelle che rispettano i parametri e superano il filtro EV +3%. Non è una garanzia di vincita. '+esc(proposal.disclaimer)+'</div>';
     }
    }catch(error){result.innerHTML='<div class="notice warning">Assistente non disponibile: '+esc(error.message)+'</div>';}
    finally{assistantButton.disabled=false;assistantButton.textContent='Analizza di nuovo';}
   });
  }
  const ticketTarget=$('roundTickets');
  if(ticketTarget&&window.MatchMindRounds){
   try{
    const ticket=window.MatchMindRounds.buildTicket(d.matches,m=>MM().forecast(m,d.history),{isUpcoming:MM().upcoming});
    if(!ticket.available){ticketTarget.innerHTML='<div class="notice warning">'+esc(ticket.reason)+'</div>';}
    else{
     const pct=x=>x===null||x===undefined?'Non calcolabile':fmt(x*100,4)+'%';
     const marketRows=[['1X2',ticket.tickets.oneXtwo],['Gol / No Gol',ticket.tickets.btts],['Under / Over 2,5',ticket.tickets.underOver]];
     const cards=marketRows.map(([name,t])=>'<div class="data-row"><span>'+name+' · '+t.legs+'/'+t.required+' selezioni valide</span><b>'+pct(t.probability)+'</b></div>').join('');
     const rows=ticket.fixtures.map(x=>'<div class="data-row"><span>'+esc(x.match.home)+' – '+esc(x.match.away)+'<small style="display:block;color:#91a0ae;font-size:9px">'+(x.context?[x.context.home,x.context.away].map(t=>esc(t.team)+' '+(t.rank??'—')+'° · '+(t.points??'—')+' pt · '+esc(t.objective)).join(' / '):esc(x.reason||''))+'</small></span><b style="text-align:right">'+(x.eligible?'1X2 '+x.oneXtwo.label+' '+pct(x.oneXtwo.probability)+'<br>BTTS '+x.btts.label+' '+pct(x.btts.probability)+'<br>U/O '+x.total.label+' '+pct(x.total.probability):'Non disponibile')+'</b></div>').join('');
     ticketTarget.innerHTML='<div class="notice">Turno '+(ticket.round??'prossimo calendario')+' · '+esc(ticket.from)+' – '+esc(ticket.to)+' · '+ticket.fixtures.length+' partite. Selezione automatica: esito con probabilità marginale più alta per ciascun mercato.</div><div class="eyebrow">PROBABILITÀ STIMATA DI CENTRARE TUTTE LE SELEZIONI</div>'+cards+'<div class="eyebrow" style="margin-top:12px">DETTAGLIO PARTITE E CONTESTO</div>'+rows+'<small style="display:block;color:#91a0ae;font-size:9px;line-height:1.5;margin-top:10px">'+esc(ticket.disclaimer)+' '+esc(ticket.tickets.oneXtwo.assumption||'Se una o più partite non hanno campione adeguato, la probabilità complessiva non viene calcolata.')+'</small>';
    }
   }catch(e){ticketTarget.innerHTML='<div class="notice warning">Schedine non calcolate: '+esc(e.message)+'</div>';}
  }
  const target=$('forecastBacktest');
  if(target){target.innerHTML='<div class="loading-state">Calcolo del backtest cronologico sui risultati storici…</div>';setTimeout(()=>{try{target.innerHTML=backtestHTML(MM().backtest(d.history),MM().eloBacktest?MM().eloBacktest(d.history):null);}catch(e){target.innerHTML='<div class="notice warning">Backtest non completato: '+esc(e.message)+'</div>';}},20);}
 }
 document.addEventListener('DOMContentLoaded',async()=>{
  const page=document.body.dataset.page||'home';
  try{const d=await MM().loadData();setStatus(d.source==='cache'?'Stai usando i dati salvati localmente.':'Dati aggiornati · Serie A '+d.season+'/'+String(d.season+1).slice(-2),d.source==='cache'?'':'ok');
   if(page==='home')initHome(d);else if(page==='matches')initMatches(d);else if(page==='explore')initExplore(d);else if(page==='league')initLeague(d);else if(page==='team')initTeam(d);else if(page==='match')await initMatch(d);else if(page==='players')initPlayers();else if(page==='data')initData();else if(page==='settings')initSettings();else if(page==='mind')initMind(d);
  }catch(e){setStatus('Dati non disponibili: '+e.message,'err');if(page==='settings')initSettings();else if(page==='data')initData();else{const targets={home:'homeNext',matches:'matchList',explore:'teamDirectory',league:'standingsBody',team:'teamContent',match:'matchDetail',mind:'mindFixtures'};const id=targets[page];if(id&&$(id))$(id).innerHTML='<div class="notice warning">'+esc(e.message)+'</div>';}}
 });
})();