/* Independent page controllers for the MatchMind multi-screen PWA. */
(function(){
 const MM=()=>window.MM, $=id=>document.getElementById(id);
 const qs=new URLSearchParams(location.search);
 const fmt=(v,d=0)=>Number(v||0).toLocaleString('it-IT',{maximumFractionDigits:d});
 const esc=s=>MM().esc(s);
 const matchCard=m=>{
  const done=MM().hasScore(m),state=MM().status(m),score=done?m.hg+' – '+m.ag:'– : –';
  const statusClass=done?'finished':state==='Da aggiornare'?'stale':'scheduled';
  return '<article class="fixture"><div class="fixture-head"><span class="league-label"><i class="flag-it"></i> SERIE A'+(m.round?' · GIORNATA '+m.round:'')+'</span><span class="fixture-state '+statusClass+'">'+state+'</span></div>'+
   '<div class="fixture-main"><div class="fixture-teams"><a class="fixture-team" href="'+MM().teamUrl(m.home)+'">'+MM().badge(m.home)+'<b>'+esc(m.home)+'</b></a><a class="fixture-team" href="'+MM().teamUrl(m.away)+'">'+MM().badge(m.away)+'<b>'+esc(m.away)+'</b></a></div><div class="fixture-score '+(done?'':'pending')+'">'+score+'</div></div>'+
   '<div class="fixture-foot"><span>'+esc(MM().shortDate(m))+(m.time?' · '+esc(m.time):'')+'</span><a href="'+MM().matchUrl(m)+'">Dettaglio e analisi ↗</a></div></article>';
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
   const round=$('matchRound');const rounds=[...new Set(d.matches.map(m=>Number(m.round)).filter(n=>Number.isInteger(n)&&n>0))].sort((a,b)=>a-b);
   round.innerHTML='<option value="">Tutte le giornate</option>'+rounds.map(n=>'<option value="'+n+'">Giornata '+n+'</option>').join('');
   const render=()=>{
    const q=MM().norm($('matchSearch').value),date=$('matchDate').value,gw=round.value,season=$('matchSeason').value;
    const previousStart=MM().seasonStart()-1,previousFrom=previousStart+'-07-01',previousTo=MM().seasonStart()+'-07-01';let base=season==='previous'?d.history.filter(m=>MM().hasScore(m)&&m.date>=previousFrom&&m.date<previousTo):d.matches;
    activeMatches=base.filter(m=>(!q||MM().norm(m.home).includes(q)||MM().norm(m.away).includes(q))&&(!date||m.date===date)&&(!gw||Number(m.round)===Number(gw)));
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
   ['matchSearch','matchDate','matchRound','matchSeason'].forEach(id=>$(id).addEventListener(id==='matchSearch'?'input':'change',()=>{shownLimit=45;render()}));
   $('clearMatchFilters').addEventListener('click',()=>{$('matchSearch').value='';$('matchDate').value='';round.value='';$('matchSeason').value='current';shownLimit=45;render()});
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
  $('matchDetail').innerHTML='<div class="match-detail-score"><div class="match-detail-meta">SERIE A · '+esc(MM().dateLabel(match))+(match.round?' · GIORNATA '+match.round:'')+'</div><div class="match-detail-teams"><div class="match-detail-side"><a href="'+MM().teamUrl(match.home)+'">'+MM().badge(match.home)+'</a><b>'+esc(match.home)+'</b></div><div class="match-detail-result '+(done?'':'pending')+'">'+(done?match.hg+' – '+match.ag:(match.time||'VS'))+'</div><div class="match-detail-side"><a href="'+MM().teamUrl(match.away)+'">'+MM().badge(match.away)+'</a><b>'+esc(match.away)+'</b></div></div><div style="margin-top:12px;color:#91a0ae;font-size:8px">'+(done?'RISULTATO ARCHIVIATO':MM().status(match).toUpperCase())+'</div></div>'+
  '<section class="section" style="margin-top:13px"><div class="section-head"><div><h2>Analisi MatchMind</h2><p>Modello Poisson · '+f.historyCount+' partite precedenti considerate.</p></div></div>'+(f.sampleEnough?'<div class="notice good">Campione storico sufficiente per una stima di base. Non è una previsione certa.</div>':'<div class="notice warning">Campione storico ridotto: probabilità indicative, non robuste.</div>')+
  '<div class="section-head" style="margin-top:12px"><div><h2>Esito 1X2</h2></div></div><div class="prob-grid">'+probCard('1 · Casa',p.home)+probCard('X · Pareggio',p.draw)+probCard('2 · Trasferta',p.away)+'</div>'+
  '<div class="section-head" style="margin-top:13px"><div><h2>Gol e totale reti</h2></div></div><div class="prob-grid">'+probCard('Gol',p.btts)+probCard('No Gol',1-p.btts)+probCard('Over 2,5',p.o25)+'</div><div class="prob-grid" style="margin-top:7px">'+probCard('Over 1,5',p.o15)+probCard('Over 3,5',p.o35)+probCard('Under 2,5',1-p.o25)+'</div>'+
  '<div class="panel panel-pad" style="margin-top:12px"><div class="data-row"><span>Gol attesi · '+esc(match.home)+'</span><b>'+fmt(f.homeXg,2)+'</b></div><div class="data-row"><span>Gol attesi · '+esc(match.away)+'</span><b>'+fmt(f.awayXg,2)+'</b></div><div class="data-row"><span>Forma '+esc(match.home)+'</span><div class="form-row">'+(f.home.form.length?f.home.form.map(x=>'<i class="form-chip '+x+'">'+x+'</i>').join(''):'—')+'</div></div><div class="data-row"><span>Forma '+esc(match.away)+'</span><div class="form-row">'+(f.away.form.length?f.away.form.map(x=>'<i class="form-chip '+x+'">'+x+'</i>').join(''):'—')+'</div></div></div></section>'+
  (done?'<div class="notice">Partita conclusa: il contesto prematch e le quote non vengono presentati come dati correnti.</div>':'<section class="section"><div class="section-head"><div><h2>Quote e indisponibili</h2><p>Solo dati restituiti dal provider, quando disponibili.</p></div></div><div id="matchContext" class="panel panel-pad"><div class="loading-state">Verifica copertura e contesto partita…</div></div></section>')+
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
    const outcomeRows=marketPrices;
    const oddsFresh=c.oddsUpdatedAt&&Number.isFinite(Date.parse(c.oddsUpdatedAt))?Math.max(0,(Date.now()-Date.parse(c.oddsUpdatedAt))/60000):null;
    const valueHtml=bestValue&&f.sampleEnough&&oddsFresh!==null&&oddsFresh<=120&&bestValue.ev>0.03
      ?'<div class="notice good"><b>Possibile valore da verificare: '+esc(bestValue.label)+'</b><br>Quota migliore '+fmt(bestValue.odd,2)+' presso '+esc(bestValue.book)+'. Probabilità modello '+fmt(bestValue.modelProb*100,1)+'%, probabilità implicita depurata dal margine '+fmt(bestValue.marketProb*100,1)+'%, vantaggio stimato '+fmt(bestValue.edge*100,1)+' punti. EV teorico '+(bestValue.ev>=0?'+':'')+fmt(bestValue.ev*100,1)+'% per unità puntata.<br><small>Segnale esplorativo: non è una raccomandazione né una garanzia di profitto.</small></div>'
      :'<div class="notice warning">'+(!bestValue?'Non ci sono mercati con almeno due esiti confrontabili.':!f.sampleEnough?'Nessun suggerimento: campione storico insufficiente.':oddsFresh===null?'Nessun suggerimento: manca l’orario di aggiornamento delle quote.':oddsFresh>120?'Nessun suggerimento: quote troppo vecchie.':'Nessun mercato supera la soglia prudenziale di valore atteso (+3%).')+'</div>';
    const odds=c.oddsAvailable
      ?'<div class="data-row"><span>Fonte quote</span><b>'+esc(c.oddsSource||'Provider')+'</b></div><div class="data-row"><span>Ultimo aggiornamento quote</span><b>'+(c.oddsUpdatedAt?new Date(c.oddsUpdatedAt).toLocaleString('it-IT'):'Non comunicato')+'</b></div><div class="data-row"><span>Bookmaker / esiti</span><b>'+new Set(outcomeRows.map(v=>v.book)).size+' / '+outcomeRows.length+'</b></div>'+valueHtml+
       (marketPrices.length?'<div class="eyebrow" style="margin-top:12px">MIGLIORI QUOTE 1X2 RILEVATE</div>'+marketPrices.map(v=>'<div class="data-row"><span>'+(v.value==='Home'?'1 · '+esc(match.home):v.value==='Away'?'2 · '+esc(match.away):'X · Pareggio')+'</span><b>'+fmt(v.odd,2)+' · '+esc(v.book)+'</b></div>').join(''):'')
      :'<div class="notice warning">Quote non disponibili: '+esc(c.oddsError||'la fonte non ha restituito mercati per questa partita')+'</div>';
    const abs=injuries.length?injuries.map(i=>'<div class="data-row"><span>'+esc(i.name)+' · '+esc(i.team)+'</span><b>'+esc(i.status||'Segnalazione')+'</b></div>').join(''):'<div class="notice">Nessuna indisponibilità riportata dalla fonte. Non equivale alla conferma di una formazione completa.</div>';
    const modelMap={Home:p.home,Draw:p.draw,Away:p.away};
    const mostLikely=Object.entries(modelMap).sort((a,b)=>b[1]-a[1])[0];
    const likelyLabel=mostLikely[0]==='Home'?'1 · '+esc(match.home):mostLikely[0]==='Away'?'2 · '+esc(match.away):'X · Pareggio';
    const suggestion='<div class="section-head" style="margin-top:13px"><div><h2>Come leggere la scommessa</h2><p>Probabilità e convenienza sono due cose diverse.</p></div></div><div class="notice">L’esito più probabile secondo il modello è '+likelyLabel+' ('+fmt(mostLikely[1]*100,1)+'%). Non significa che sia conveniente: per valutare il prezzo confronta probabilità modello e quota. Se non emerge un margine positivo e dati aggiornati, la scelta razionale è non puntare.</div>';
    $('matchContext').innerHTML='<div class="eyebrow">QUOTE E VALORE ATTESO</div>'+odds+suggestion+'<div style="margin-top:14px" class="eyebrow">INDISPONIBILI · API-FOOTBALL</div>'+abs+'<div class="notice" style="margin-top:10px">Fonti prematch: '+esc(c.oddsSource||'quote non disponibili')+' per le quote; API-Football per fixture e indisponibili. Le quote possono cambiare rapidamente.</div>';
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
 async function initData(){
  const check=async()=>{const target=$('providerStatus');target.innerHTML='<div class="loading-state">Verifica…</div>';try{const r=await fetch('./api/player-context?type=status',{headers:{Accept:'application/json'},cache:'no-store'});const d=await r.json(),p=d.providers||{};const rows=[['Calendario e risultati','open-matchday · dati pubblici',true],['Probabilità statistiche','Modello Poisson locale',true],['Quote bookmaker','Sisal IT · OddsPapi',!!p.sisalOdds],['Infortuni e forma giocatori','API-Football',!!p.apiFootball],['Calendario di riserva','football-data.org',!!p.footballData]];target.innerHTML=rows.map(([a,b,on])=>'<div class="data-row"><span>'+a+'</span><b style="color:'+(on?'var(--mint)':'var(--amber)')+'">'+(on?'Disponibile':'Non configurato / non verificato')+'</b></div><small style="display:block;color:#7f8d9b;font-size:8px;margin:0 0 8px">'+b+'</small>').join('');}catch(e){target.innerHTML='<div class="notice warning">Non riesco a verificare i provider. Il calendario e il modello locale possono comunque funzionare.</div>';}}
  $('checkProviders').addEventListener('click',check);await check();
 }
 async function initMind(d){const rows=d.matches.filter(MM().upcoming).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,8);$('mindFixtures').innerHTML=rows.length?rows.map(matchCard).join(''):'<div class="empty-state">Nessuna partita futura disponibile per l’analisi.</div>';}
 document.addEventListener('DOMContentLoaded',async()=>{
  const page=document.body.dataset.page||'home';
  try{const d=await MM().loadData();setStatus(d.source==='cache'?'Stai usando i dati salvati localmente.':'Dati aggiornati · Serie A '+d.season+'/'+String(d.season+1).slice(-2),d.source==='cache'?'':'ok');
   if(page==='home')initHome(d);else if(page==='matches')initMatches(d);else if(page==='explore')initExplore(d);else if(page==='league')initLeague(d);else if(page==='team')initTeam(d);else if(page==='match')await initMatch(d);else if(page==='players')initPlayers();else if(page==='data')initData();else if(page==='mind')initMind(d);
  }catch(e){setStatus('Dati non disponibili: '+e.message,'err');const targets={home:'homeNext',matches:'matchList',explore:'teamDirectory',league:'standingsBody',team:'teamContent',match:'matchDetail',mind:'mindFixtures'};const id=targets[page];if(id&&$(id))$(id).innerHTML='<div class="notice warning">'+esc(e.message)+'</div>';}
 });
})();