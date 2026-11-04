/* Independent page controllers for the MatchMind multi-screen PWA. */
(function(){
 const MM=()=>window.MM, $=id=>document.getElementById(id);
 const qs=new URLSearchParams(location.search);
 const fmt=(v,d=0)=>Number(v||0).toLocaleString('it-IT',{maximumFractionDigits:d});
 const esc=s=>MM().esc(s);
 const favoriteIcon=filled=>'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" '+(filled?'fill="currentColor"':'fill="none"')+'/></svg>';
 const MATCH_PICKS_KEY="matchmind-manual-selections-v1";
 const matchPickKey=m=>[(m.competition||"serie-a"),m.date,MM().norm(m.home),MM().norm(m.away)].join("|");
 const readMatchPicks=()=>{try{const rows=JSON.parse(localStorage.getItem(MATCH_PICKS_KEY)||"[]");return Array.isArray(rows)?rows.filter(x=>x&&x.date&&x.home&&x.away&&x.marketKey):[]}catch(_){return[]}};
 const writeMatchPicks=rows=>{try{localStorage.setItem(MATCH_PICKS_KEY,JSON.stringify(rows))}catch(_){}};
 const marketCategoryForKey=key=>key==="bttsYes"||key==="bttsNo"?"btts":/^(over|under)15$/.test(key)?"goals15":/^(over|under)25$/.test(key)?"goals25":/^(over|under)35$/.test(key)?"goals35":"1x2";
 const marketOptions=(forecast,category)=>{
  const p=forecast.probabilities;
  const map={
   "1x2":[["home","1",p.home],["draw","X",p.draw],["away","2",p.away]],
   goals15:[["over15","Over 1,5",p.o15],["under15","Under 1,5",1-p.o15]],
   goals25:[["over25","Over 2,5",p.o25],["under25","Under 2,5",1-p.o25]],
   goals35:[["over35","Over 3,5",p.o35],["under35","Under 3,5",1-p.o35]],
   btts:[["bttsYes","Gol",p.btts],["bttsNo","No Gol",1-p.btts]]
  };
  return map[category]||map["1x2"];
 };
 const marketButtonsHtml=(m,forecast,category,selectedKey)=>{
  const key=matchPickKey(m);
  return '<div class="fixture-market-options'+(marketOptions(forecast,category).length===2?' two-outcome':'')+'">'+marketOptions(forecast,category).map(([marketKey,label,probability])=>{
   const available=Number.isFinite(probability),selected=selectedKey===marketKey;
   return '<button type="button" class="fixture-market-button'+(selected?' is-selected':'')+'" data-market-pick data-match-key="'+esc(key)+'" data-market-key="'+esc(marketKey)+'" aria-pressed="'+(selected?'true':'false')+'"'+(available?'':' disabled')+'><span>'+esc(label)+'</span><b>'+(available?fmt(probability*100,1)+'%':'—')+'</b></button>';
  }).join('')+'</div>';
 };
 const marketPickerHtml=(m,forecast,selected)=>{
  const key=matchPickKey(m),category=selected?marketCategoryForKey(selected.marketKey):"1x2",id="market-"+MM().norm(key);
  const options=[["1x2","1X2"],["goals15","Over/Under 1,5"],["goals25","Over/Under 2,5"],["goals35","Over/Under 3,5"],["btts","Gol / No Gol"]];
  return '<div class="fixture-market-panel" data-market-panel="'+esc(key)+'"><div class="fixture-market-picker"><label for="'+esc(id)+'">Mercato</label><select id="'+esc(id)+'" data-market-picker data-match-key="'+esc(key)+'">'+options.map(([value,label])=>'<option value="'+value+'"'+(value===category?' selected':'')+'>'+label+'</option>').join('')+'</select></div>'+
   marketButtonsHtml(m,forecast,category,selected&&selected.marketKey)+
   '<small class="fixture-market-sample">'+(forecast.sampleEnough?'Storico adeguato':'Campione storico limitato')+'</small></div>';
 };
 const updateMatchSlipActions=()=>{
  const dock=$('matchSlipActions');if(!dock)return;
  const competition=MM().getSelectedCompetition(),picks=readMatchPicks().filter(x=>(x.competition||"serie-a")===competition);
  dock.hidden=picks.length===0;$('matchSlipCount').textContent=String(picks.length);
  const data=MM().data,labels={home:"1",draw:"X",away:"2",over15:"Over 1,5",under15:"Under 1,5",over25:"Over 2,5",under25:"Under 2,5",over35:"Over 3,5",under35:"Under 3,5",bttsYes:"Gol",bttsNo:"No Gol"};
  let contexts={};try{contexts=JSON.parse(localStorage.getItem("matchmind-match-context-v2")||"{}")||{};}catch(_){}
  const rows=picks.map(p=>{const m=(data&&data.matches||[]).find(x=>(x.competition||"serie-a")===(p.competition||"serie-a")&&x.date===p.date&&MM().norm(x.home)===MM().norm(p.home)&&MM().norm(x.away)===MM().norm(p.away));if(!m||!data.history||!window.MatchMindBets)return null;const key=[m.competition||"serie-a",m.date,MM().norm(m.home),MM().norm(m.away)].join("|");const probability=window.MatchMindBets.marketProbability(MM().forecast(m,data.history,contexts[key]||{}),p.marketKey);return{match:m,label:labels[p.marketKey]||p.marketKey,probability};}).filter(Boolean);
  const combined=rows.length===picks.length?rows.reduce((v,x)=>v*(Number.isFinite(x.probability)?x.probability:0),1):null;
  $('matchSlipProbability').textContent='Probabilità stimata: '+(combined===null?'—':fmt(combined*100,1)+'%');
  const preview=$('matchSlipPreview');if(preview)preview.innerHTML=rows.map(x=>'<div class="match-slip-preview-row"><span><b>'+esc(x.match.home)+' – '+esc(x.match.away)+'</b><small>'+esc(x.label)+' · '+esc(MM().shortDate(x.match))+'</small></span><b>'+fmt((x.probability||0)*100,1)+'%</b></div>').join('')+'<small>Quote non utilizzate. Probabilità combinate con ipotesi di indipendenza.</small>';
  const toggle=$('toggleMatchSlip');if(toggle&&!toggle.dataset.bound){toggle.dataset.bound='1';toggle.addEventListener('click',()=>{preview.hidden=!preview.hidden;toggle.textContent=preview.hidden?'Mostra schedina':'Nascondi schedina';});}
 };
 const matchCard=(m,showMarketPicker=false)=>{
  const done=MM().hasScore(m),state=MM().status(m),score=done?m.hg+' – '+m.ag:(m.time||'VS'),competition=MM().competitionInfo(m);
  const statusClass=done?'finished':state==='Da aggiornare'?'stale':'scheduled';
  const centerLabel=done?'RISULTATO FINALE':state==='Da aggiornare'?'ORARIO DA DEFINIRE':'';
  const forecast=!done&&MM().upcoming(m)?MM().forecast(m,MM().data.history):null;
  const saved=showMarketPicker&&forecast?readMatchPicks().find(x=>matchPickKey(x)===matchPickKey(m)):null;
  const preview=forecast?(showMarketPicker?marketPickerHtml(m,forecast,saved):'<div class="fixture-preview"><div class="preview-head"><span>STIMA MATCHMIND</span><small>'+(forecast.sampleEnough?'Campione adeguato':'Campione limitato')+'</small></div><div class="preview-probs">'+[['1',forecast.probabilities.home],['X',forecast.probabilities.draw],['2',forecast.probabilities.away]].map(([label,value])=>'<div><span>'+label+'</span> <b>'+fmt(value*100,0)+'%</b></div>').join('')+'</div></div>'):'';
  return '<article class="fixture"><div class="fixture-head"><span class="league-label"><img class="competition-logo-small" src="https://media.api-sports.io/football/leagues/'+competition.logo+'.png" alt="" loading="lazy" onerror="this.remove()"> '+competition.name.toUpperCase()+(m.round?' <span class="fixture-round">· GIORNATA '+m.round+'</span>':'')+'</span><span class="fixture-state '+statusClass+'">'+state+'</span></div>'+
   '<div class="fixture-main fixture-horizontal"><a class="fixture-side home" href="'+MM().teamUrl(m.home)+'">'+MM().badge(m.home)+'<b>'+esc(m.home)+'</b></a><div class="fixture-center"><strong class="fixture-score '+(done?'':'pending')+'">'+score+'</strong><span class="fixture-center-label">'+centerLabel+'</span></div><a class="fixture-side away" href="'+MM().teamUrl(m.away)+'">'+MM().badge(m.away)+'<b>'+esc(m.away)+'</b></a></div>'+preview+
   '<div class="fixture-foot"><span class="fixture-date">'+esc(MM().shortDate(m))+(m.time?' · '+esc(m.time):'')+'</span><a href="'+MM().matchUrl(m)+'">Match center <span aria-hidden="true">↗</span></a></div></article>';
 };
 const groupCards=(rows,reverse=false,showMarketPickers=false)=>{const groups=MM().groupByDate(rows);if(reverse)groups.reverse();return groups.map(([date,list])=>'<div class="date-divider"><span>'+esc(MM().shortDate(list[0]))+'</span><small>'+list.length+' '+(list.length===1?'partita':'partite')+'</small></div>'+list.map(match=>matchCard(match,showMarketPickers)).join('')).join('');};
 function setStatus(message,kind=''){const e=$('globalStatus');if(e)e.innerHTML=(kind?'<i class="status-dot '+kind+'"></i>':'')+esc(message);}
 async function initHome(d){
   const competition=MM().competitionInfo(d.competition),heroKicker=document.querySelector('.hero-kicker');
   if(heroKicker)heroKicker.textContent='MATCHMIND · '+competition.name.toUpperCase();
   if($('homeTitle'))$('homeTitle').innerHTML=esc(competition.name)+'.<br><em>Dentro i numeri.</em>';
   const current=d.matches,played=current.filter(MM().hasScore),next=current.filter(MM().upcoming).sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||'')));
   $('homePlayed').textContent=fmt(played.length);$('homeUpcoming').textContent=fmt(next.length);$('homeTeams').textContent=fmt(MM().getTeams(current).length);
   $('homeStatus').textContent=d.source==='cache'?'Dati locali salvati · fonte non aggiornata':'Calendario '+competition.name+' caricato · '+new Date(d.updatedAt||Date.now()).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
   $('homeDot').classList.toggle('ok',d.source!=='cache');
   const homeTarget=$('homeNextMatches');
   if(homeTarget)homeTarget.innerHTML=next.length?next.slice(0,5).map(matchCard).join(''):'<div class="empty-state">Nessuna partita futura disponibile.</div>';
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
    $('matchListSummary').textContent=activeMatches.length+' partite trovate · '+(season==='previous'?'stagione precedente':'stagione corrente')+' · Seleziona un mercato e tocca un esito per aggiungerlo alla schedina.';
    target.innerHTML=visible.length?groupCards(visible,matchFilter==='finished'||matchFilter==='stale',true):'<div class="empty-state">Nessuna partita corrisponde ai filtri selezionati.</div>';
    updateMatchSlipActions();
    $('moreMatches').hidden=activeMatches.length<=shownLimit;
   };
   ['matchSearch','matchDate','matchTeam','matchRound','matchSeason'].forEach(id=>$(id).addEventListener(id==='matchSearch'?'input':'change',()=>{shownLimit=45;render()}));
   $('clearMatchFilters').addEventListener('click',()=>{$('matchSearch').value='';$('matchDate').value='';teamSelect.value='';round.value='';$('matchSeason').value='current';shownLimit=45;render()});
    $('matchFilters').querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{matchFilter=b.dataset.filter;$('matchFilters').querySelectorAll('button').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});shownLimit=45;render()}));
   $('matchList').addEventListener('change',event=>{
    const select=event.target.closest('[data-market-picker]');if(!select)return;
    const match=activeMatches.find(item=>matchPickKey(item)===select.dataset.matchKey);if(!match)return;
    const forecast=MM().forecast(match,d.history),saved=readMatchPicks().find(item=>matchPickKey(item)===select.dataset.matchKey);
    const panel=select.closest('.fixture-market-panel');if(panel)panel.querySelector('.fixture-market-options').outerHTML=marketButtonsHtml(match,forecast,select.value,saved&&saved.marketKey);
   });
   $('matchList').addEventListener('click',event=>{
    const button=event.target.closest('[data-market-pick]');if(!button)return;
    const match=activeMatches.find(item=>matchPickKey(item)===button.dataset.matchKey);if(!match)return;
    const competition=MM().getSelectedCompetition(),rows=readMatchPicks(),key=matchPickKey(match),index=rows.findIndex(item=>matchPickKey(item)===key),current=index>=0?rows[index]:null;
    if(current&&current.marketKey===button.dataset.marketKey)rows.splice(index,1);
    else{
     const count=rows.filter(item=>(item.competition||"serie-a")===competition).length;
     if(!current&&count>=15){$('matchPickNotice').textContent='Hai raggiunto il limite di 15 selezioni. Apri il Costruttore per modificare la schedina.';return;}
     const record={competition:match.competition||competition,date:match.date,home:match.home,away:match.away,marketKey:button.dataset.marketKey};
     if(index>=0)rows[index]=record;else rows.push(record);
    }
    writeMatchPicks(rows);$('matchPickNotice').textContent='';
    updateMatchSlipActions();
    const panel=button.closest('.fixture-market-panel'),forecast=MM().forecast(match,d.history),selected=rows.find(item=>matchPickKey(item)===key);
    const picker=panel&&panel.querySelector('[data-market-picker]');
    if(picker&&selected)picker.value=marketCategoryForKey(selected.marketKey);
    if(panel&&picker)panel.querySelector('.fixture-market-options').outerHTML=marketButtonsHtml(match,forecast,picker.value,selected&&selected.marketKey);
   });
   $('moreMatches').addEventListener('click',()=>{shownLimit+=45;render()});
   updateMatchSlipActions();
   render();
 }
 function initExplore(d){
   const competition=MM().competitionInfo(d.competition),logo=$('exploreCompetitionLogo');
   if(logo){logo.src='https://media.api-sports.io/football/leagues/'+competition.logo+'.png';logo.alt='Logo '+competition.name;}
   if($('exploreCompetitionName'))$('exploreCompetitionName').textContent=competition.name+' · '+competition.country;
   if($('exploreTeamsTitle'))$('exploreTeamsTitle').textContent='Squadre '+competition.name;
   const target=$('teamDirectory'),search=$('teamSearch');
   const teams=MM().getTeams(d.matches);
   function render(){const q=MM().norm(search.value),list=teams.filter(t=>MM().norm(t).includes(q));target.innerHTML=list.length?list.map(n=>'<div class="team-tile"><a href="'+MM().teamUrl(n)+'" style="display:flex;align-items:center;gap:7px;flex:1;min-width:0">'+MM().badge(n)+'<b>'+esc(n)+'</b></a><button class="favorite-toggle" data-fav="'+esc(n)+'" title="Segui squadra" aria-label="Segui '+esc(n)+'">'+(MM().isFavorite(n)?favoriteIcon(true):favoriteIcon(false))+'</button></div>').join(''):'<div class="empty-state">Nessuna squadra trovata.</div>';}
   search.addEventListener('input',render);
   target.addEventListener('click',e=>{const b=e.target.closest('[data-fav]');if(!b)return;const active=MM().toggleFavorite(b.dataset.fav);b.innerHTML=active?favoriteIcon(true):favoriteIcon(false);});
   render();
 }
 function tableHTML(rows){
  if(!rows.length)return '<div class="empty-state">Classifica non disponibile: servono risultati conclusi nel feed.</div>';
  return '<div class="table-scroll"><table class="league-table"><thead><tr><th>#</th><th>Squadra</th><th>PG</th><th>V</th><th>N</th><th>P</th><th>DR</th><th>PT</th></tr></thead><tbody>'+
   rows.map((t,i)=>'<tr><td>'+(i+1)+'</td><td class="club"><a href="'+MM().teamUrl(t.name)+'">'+MM().badge(t.name)+esc(t.name)+'</a></td><td>'+t.played+'</td><td>'+t.w+'</td><td>'+t.d+'</td><td>'+t.l+'</td><td>'+t.gd+'</td><td class="points">'+t.pts+'</td></tr>').join('')+'</tbody></table></div>';
 }
 function initLeague(d){
  const competition=MM().competitionInfo(d.competition),phaseRows=competition.id==='champions-league'?d.matches.filter(m=>m.stage==='League'||m.stage==='Group'):d.matches;
  document.body.dataset.title=competition.name;document.title='MatchMind · '+competition.name;if($('pageTitle'))$('pageTitle').textContent=competition.name;
  if($('pageSubtitle'))$('pageSubtitle').textContent=competition.id==='champions-league'?'Fase campionato, calendario e numeri del torneo.':'Classifica, calendario e numeri del campionato.';
  if($('leagueCompetitionName'))$('leagueCompetitionName').textContent=competition.name+' · '+competition.country;
  const logo=$('leagueCompetitionLogo');if(logo){logo.src='https://media.api-sports.io/football/leagues/'+competition.logo+'.png';logo.alt='Logo '+competition.name;}
  const badge=document.querySelector('.competition-fallback');if(badge)badge.textContent=competition.fallback;
  const table=MM().standings(phaseRows.filter(MM().hasScore));$('leagueSeason').textContent='Stagione '+d.season+'/'+String(d.season+1).slice(-2)+' · '+table.length+' squadre con risultati';
  $('standingsBody').innerHTML=tableHTML(table);
  const future=phaseRows.filter(MM().upcoming).sort((a,b)=>a.date.localeCompare(b.date));
  $('leagueFixtureList').innerHTML=future.length?groupCards(future):'<div class="empty-state">Nessuna partita futura disponibile.</div>';
  const played=phaseRows.filter(MM().hasScore),goals=played.reduce((s,m)=>s+Number(m.hg)+Number(m.ag),0);
  const home=played.filter(m=>m.hg>m.ag).length,draw=played.filter(m=>m.hg===m.ag).length,away=played.filter(m=>m.hg<m.ag).length;
  $('leagueStatsGrid').innerHTML='<div class="metric"><span>PARTITE CONCLUSE</span><b>'+played.length+'</b><small>risultati nel feed della stagione</small></div><div class="metric"><span>GOL TOTALI</span><b>'+goals+'</b><small>'+fmt(played.length?goals/played.length:0,2)+' per partita</small></div><div class="metric"><span>VITTORIE CASA</span><b>'+home+'</b><small>esiti con successo della squadra di casa</small></div><div class="metric"><span>PAREGGI / TRASFERTE</span><b>'+draw+' / '+away+'</b><small>pareggi e vittorie in trasferta</small></div>';
  $('leagueTabs').querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{const view=b.dataset.view;$('leagueTabs').querySelectorAll('button').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-selected',String(x===b));});$('leagueStandings').hidden=view!=='standings';$('leagueFixtures').hidden=view!=='fixtures';$('leagueStats').hidden=view!=='stats';}));
 }
 function initTeam(d){
  const name=qs.get('team')||'';const normName=MM().norm(name);const rows=d.matches.filter(m=>MM().norm(m.home)===normName||MM().norm(m.away)===normName).sort((a,b)=>a.date.localeCompare(b.date));
  if(!name||!rows.length){$('teamContent').innerHTML='<div class="empty-state">Squadra non trovata nei dati attualmente disponibili. Torna a <a class="text-link" href="explore.html">Esplora</a>.</div>';return;}
  const played=rows.filter(MM().hasScore),up=rows.filter(MM().upcoming),form=MM().teamStats(name,d.history);
  const wins=form.form.filter(x=>x==='W').length,draws=form.form.filter(x=>x==='D').length;
  $('teamContent').innerHTML='<div class="team-hero">'+MM().badge(name)+'<div style="flex:1"><h1>'+esc(name)+'</h1><p>'+esc(MM().competitionInfo(d.competition).name)+' · profilo squadra</p></div><button id="teamFavorite" class="favorite-action">'+(MM().isFavorite(name)?favoriteIcon(true)+' Seguita':favoriteIcon(false)+' Segui')+'</button></div>'+
  '<div class="stat-strip"><div class="stat-cell"><b>'+played.length+'</b><span>RISULTATI NEL FEED</span></div><div class="stat-cell"><b>'+wins+'V · '+draws+'N</b><span>ULTIME CINQUE</span></div><div class="stat-cell"><b>'+up.length+'</b><span>PROSSIME PARTITE</span></div></div>'+
  '<section class="section"><div class="section-head"><div><h2>Forma recente</h2><p>Ultimi risultati storici disponibili.</p></div></div><div class="panel panel-pad"><div class="form-row">'+(form.form.length?form.form.map(x=>'<span class="form-chip '+x+'">'+x+'</span>').join(''):'<span class="notice">Forma non disponibile</span>')+'</div><div class="data-row"><span>Gol segnati medi (ultime 10)</span><b>'+fmt(form.for,2)+'</b></div><div class="data-row"><span>Gol subiti medi (ultime 10)</span><b>'+fmt(form.against,2)+'</b></div></div></section>'+
  '<section class="section"><div class="section-head"><div><h2>Calendario e risultati</h2><p>Partite in cui compare '+esc(name)+'.</p></div></div><div class="fixture-list">'+groupCards(rows.slice(-25),true)+'</div></section>';
  $('teamFavorite').addEventListener('click',()=>{const on=MM().toggleFavorite(name);$('teamFavorite').innerHTML=on?favoriteIcon(true)+' Seguita':favoriteIcon(false)+' Segui';});
 }
 function probCard(label,value){const pct=value*100;return '<div class="prob"><span>'+label+'</span><b>'+fmt(pct,1)+'%</b><div class="track"><i style="width:'+Math.max(0,Math.min(100,pct))+'%"></i></div></div>';}
 async function initMatch(d){
  const date=qs.get('date'),home=qs.get('home'),away=qs.get('away'),key=MM().norm;
  const match=d.matches.find(m=>m.date===date&&key(m.home)===key(home)&&key(m.away)===key(away))||d.history.find(m=>m.date===date&&key(m.home)===key(home)&&key(m.away)===key(away));
  if(!match){$('matchDetail').innerHTML='<div class="empty-state">Partita non trovata. <a class="text-link" href="matches.html">Torna al calendario ↗</a></div>';return;}
  const done=MM().hasScore(match),f=MM().forecast(match,d.history),p=f.probabilities;
  const scoreMatrixHtml=(()=>{
   const rows=[];
   for(let homeGoals=0;homeGoals<=5;homeGoals++){
    const cells=[];
    for(let awayGoals=0;awayGoals<=5;awayGoals++){
     const cell=f.scoreMatrix.find(x=>x.homeGoals===homeGoals&&x.awayGoals===awayGoals);
     const value=cell?cell.probability:0,heat=f.scoreMatrix.reduce((max,x)=>Math.max(max,x.probability),0);
     cells.push('<td style="--heat:'+(heat?value/heat:0).toFixed(3)+'">'+fmt(value*100,1)+'%</td>');
    }
    rows.push('<tr><th scope="row">'+homeGoals+'</th>'+cells.join('')+'</tr>');
   }
   return '<section class="section score-matrix-section"><div class="section-head"><div><h2>Risultati esatti</h2><p>Probabilità dei punteggi più frequenti · casa per riga, trasferta per colonna.</p></div></div><div class="panel panel-pad"><div class="table-scroll"><table class="score-matrix-table"><thead><tr><th scope="col">CASA / OSPITE</th>'+[0,1,2,3,4,5].map(n=>'<th scope="col">'+n+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div><div class="score-matrix-tail">Altri punteggi (almeno una squadra oltre 5 gol): <b>'+fmt(f.scoreMatrixTail*100,1)+'%</b></div></div></section>';
  })();
  const seasonContext=match.competition==='champions-league'?null:window.MatchMindRounds?.matchContext(match,d.history,d.matches);
  const seasonContextHtml=seasonContext?'<section class="section"><div class="section-head"><div><h2>Classifica e obiettivi stagionali</h2><p>Fotografia alla data della partita, senza usare risultati successivi.</p></div></div><div class="panel panel-pad">'+[seasonContext.home,seasonContext.away].map(t=>'<div class="data-row"><span>'+esc(t.team)+' · posizione '+(t.rank??'—')+' · '+(t.points??'—')+' pt</span><b>'+esc(t.objective)+'</b></div><small style="display:block;color:#91a0ae;font-size:9px;margin:0 0 10px">PG '+(t.played??'—')+' · DR '+(t.goalDifference??'—')+(t.pointsToFourth!==null&&t.pointsToFourth!==undefined?' · distanza 4ª: '+t.pointsToFourth+' pt':'')+(t.pointsToSixth!==null&&t.pointsToSixth!==undefined?' · distanza 6ª: '+t.pointsToSixth+' pt':'')+(t.pointsAboveSafety!==null&&t.pointsAboveSafety!==undefined?' · margine 17ª: '+t.pointsAboveSafety+' pt':'')+'</small>').join('')+'<small style="color:#91a0ae;font-size:9px;line-height:1.5">'+esc(seasonContext.disclaimer)+'</small></div></section>':'';
  $('matchDetail').innerHTML='<div class="match-detail-score"><div class="match-detail-meta"><img class="competition-logo-small" src="https://media.api-sports.io/football/leagues/'+MM().competitionInfo(match).logo+'.png" alt="" onerror="this.remove()"> '+esc(MM().competitionInfo(match).name.toUpperCase())+' · '+esc(MM().dateLabel(match))+(match.round?' · GIORNATA '+match.round:'')+'</div><div class="match-detail-teams"><div class="match-detail-side"><a href="'+MM().teamUrl(match.home)+'">'+MM().badge(match.home)+'</a><b>'+esc(match.home)+'</b></div><div class="match-detail-result '+(done?'':'pending')+'">'+(done?match.hg+' – '+match.ag:(match.time||'VS'))+'</div><div class="match-detail-side"><a href="'+MM().teamUrl(match.away)+'">'+MM().badge(match.away)+'</a><b>'+esc(match.away)+'</b></div></div><div style="margin-top:12px;color:#91a0ae;font-size:8px">'+(done?'RISULTATO ARCHIVIATO':MM().status(match).toUpperCase())+'</div></div>'+
  '<section class="section analysis-section" style="margin-top:18px"><div class="section-head"><div><div class="eyebrow">MODELLO STATISTICO</div><h2>'+ (done?'Replay statistico storico':'Stima pre-partita') +'</h2><p>Modello Poisson · '+f.historyCount+' partite archiviate nel campione.</p></div></div>'+(f.sampleEnough?'<div class="notice good">Base storica completa per questa stima: almeno 10 partite precedenti per ciascuna squadra. Le probabilità restano indicative e non sono una previsione certa.</div>':'<div class="notice warning">Campione squadra incompleto: '+esc(match.home)+' '+f.home.played+'/10 e '+esc(match.away)+' '+f.away.played+'/10 partite disponibili. Le probabilità sono esplorative e non vanno considerate robuste.</div>')+
  '<div class="section-head" style="margin-top:12px"><div><h2>Probabilità 1X2</h2><p>Distribuzione stimata degli esiti</p></div></div><div class="prob-grid">'+probCard('1 · Casa',p.home)+probCard('X · Pareggio',p.draw)+probCard('2 · Trasferta',p.away)+'</div>'+
  '<div class="section-head" style="margin-top:13px"><div><h2>Mercati goal</h2><p>Probabilità derivate dalla distribuzione Poisson</p></div></div><div class="prob-grid">'+probCard('Gol',p.btts)+probCard('No Gol',1-p.btts)+probCard('Over 2,5',p.o25)+'</div><div class="prob-grid" style="margin-top:7px">'+probCard('Over 1,5',p.o15)+probCard('Over 3,5',p.o35)+probCard('Under 2,5',1-p.o25)+'</div>'+
  scoreMatrixHtml+
  (()=>{
   const e=MM().eventForecast(match,d.history);
   const detail=(label,x)=>'<div class="data-row"><span>'+label+'</span><b>'+ (x.available?fmt(x.home,1)+' / '+fmt(x.away,1):'Campione insufficiente')+'</b></div>';
   const metric=(label,x)=>'<div class="data-row"><span>'+label+'</span><b>'+ (x.available?fmt(x.total,1):'Non disponibile')+'</b></div>';
   const cards='<section class="section"><div class="section-head"><div><div class="eyebrow">STATISTICHE AVANZATE</div><h2>Corner e cartellini</h2><p>Medie storiche per sede, ultime 8 gare precedenti. Stime esplorative, non quote.</p></div></div><div class="panel panel-pad">'+detail('Corner attesi · casa / trasferta',e.corners)+metric('Corner totali stimati',e.corners)+detail('Ammonizioni · casa / trasferta',e.yellowCards)+metric('Ammonizioni totali stimate',e.yellowCards)+'<small style="color:#91a0ae">Minimo 5 osservazioni per componente. Espulsioni, arbitro e cartellini rossi non sono stimati.</small></div></section>';
   const ht='<section class="section"><div class="section-head"><div><h2>Primo tempo</h2><p>Stima esplorativa dei gol attesi nel primo tempo.</p></div></div><div class="panel panel-pad">'+(e.halfTime.available?'<div class="data-row"><span>Gol attesi casa / trasferta</span><b>'+fmt(e.halfTime.homeXg,2)+' / '+fmt(e.halfTime.awayXg,2)+'</b></div><div class="prob-grid">'+probCard('1° tempo · 1',e.halfTime.probabilities.home)+probCard('1° tempo · X',e.halfTime.probabilities.draw)+probCard('1° tempo · 2',e.halfTime.probabilities.away)+'</div>':'<div class="notice warning">Campione storico del primo tempo insufficiente: servono almeno 5 partite per ciascuna componente.</div>')+'</div></section>';
   return cards+ht;
  })()+
  '<div class="panel panel-pad match-model-context" style="margin-top:14px"><div class="context-heading"><span>CONTESTO DEL MODELLO</span><small>Stime, non dati osservati</small></div><div class="data-row"><span>Partite usate · '+esc(match.home)+'</span><b>'+f.home.played+'</b></div><div class="data-row"><span>Partite usate · '+esc(match.away)+'</span><b>'+f.away.played+'</b></div><div class="data-row"><span>Periodo storico complessivo</span><b>'+(f.historyStart&&f.historyEnd?esc(f.historyStart)+' – '+esc(f.historyEnd):'Non disponibile')+'</b></div><div class="data-row"><span>Gol attesi stimati · '+esc(match.home)+'</span><b>'+fmt(f.homeXg,2)+'</b></div><div class="data-row"><span>Gol attesi stimati · '+esc(match.away)+'</span><b>'+fmt(f.awayXg,2)+'</b></div><div class="data-row"><span>Forma '+esc(match.home)+'</span><div class="form-row">'+(f.home.form.length?f.home.form.map(x=>'<i class="form-chip '+x+'">'+x+'</i>').join(''):'—')+'</div></div><div class="data-row"><span>Forma '+esc(match.away)+'</span><div class="form-row">'+(f.away.form.length?f.away.form.map(x=>'<i class="form-chip '+x+'">'+x+'</i>').join(''):'—')+'</div></div></div></section>'+
  seasonContextHtml+
  (done?'<div class="notice warning">Replay storico: questa stima viene ricostruita dai dati precedenti alla partita. Non esiste una previsione pre-partita congelata e registrata all’epoca.</div>':'<section class="section provider-section"><div class="section-head"><div><div class="eyebrow">CENTRO LIVE</div><h2>Segui la partita</h2><p>Risultato, eventi e statistiche live, se il provider restituisce dati per questo incontro.</p></div></div><a class="shortcut" href="live.html"><span class="shortcut-icon">◉</span><span><b>Apri MatchMind Live</b><small>Campo 2D, statistiche ed eventi</small></span></a><div class="notice">Il campo 2D è una simulazione tattica illustrativa. Non mostra il tracking reale dei calciatori.</div></section>')+
  '<section class="section"><div class="section-head"><div><div class="eyebrow">COPERTURA DATI</div><h2>Fonti e limiti</h2></div></div><div class="panel panel-pad"><div class="notice">Calendario e storico provengono da dataset pubblici. Formazioni ufficiali, indisponibili e statistiche giocatore non sono mostrate quando manca una fonte verificabile.</div><a class="text-link" href="data.html">Consulta le fonti e la copertura ↗</a></div></section>'+
  '<div style="margin-top:12px"><a class="text-link" href="analysis-lab.html">Apri Analisi del modello ↗</a></div>';
 }
 async function initSettings(){
  const status=$('globalStatus');
  if(status)status.textContent='Fonti pubbliche attive: nessuna chiave API o secret richiesto.';
}
function GenCopy(value){try{navigator.clipboard.writeText(value);$('settingsProviderStatus').innerHTML='<div class="notice good">Nome del secret copiato.</div>';}catch{$('settingsProviderStatus').innerHTML='<div class="notice">Nome del secret: <b>'+value+'</b></div>';}}
 async function initData(){
  const target=$('providerStatus');
  if(target)target.innerHTML='<div class="data-row"><span>Calendario e risultati</span><b>openfootball · dataset pubblico</b></div><div class="data-row"><span>Chiavi API</span><b>Non utilizzate</b></div><div class="data-row"><span>Quote, assenze e dati evento</span><b>Disattivati</b></div>';
  const button=$('checkProviders');
  if(button)button.addEventListener('click',()=>{if(target)target.innerHTML='<div class="notice">La fonte pubblica viene verificata quando si aggiorna il calendario.</div>';});
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
  const upcoming=d.matches.filter(MM().upcoming);
  const forecasts=upcoming.map(match=>({match,forecast:MM().forecast(match,d.history)}));
  const adequate=forecasts.filter(item=>item.forecast.sampleEnough).length;
  const limited=forecasts.length-adequate;
  const meanHistory=forecasts.length?forecasts.reduce((sum,item)=>sum+(item.forecast.historyCount||0),0)/forecasts.length:0;
  const overview=$('analysisOverview');
  if(overview){
   overview.innerHTML='<div class="analysis-summary-grid">'+
    '<article class="analysis-summary"><span>Partite future</span><b>'+fmt(upcoming.length)+'</b><small>Competizione selezionata</small></article>'+
    '<article class="analysis-summary"><span>Campione adeguato</span><b>'+fmt(adequate)+'</b><small>Almeno 10 partite per squadra</small></article>'+
    '<article class="analysis-summary"><span>Campione limitato</span><b>'+fmt(limited)+'</b><small>Stime da leggere con cautela</small></article>'+
    '<article class="analysis-summary"><span>Storico medio</span><b>'+fmt(meanHistory,1)+'</b><small>Partite precedenti per incontro</small></article></div>'+
    '<div class="notice">'+(limited?'Sono presenti '+limited+' partite con campione insufficiente.':'Tutte le partite future hanno superato la soglia minima del campione.')+' La soglia è un controllo di copertura, non una misura di accuratezza o calibrazione.</div>';
  }
  const target=$('forecastBacktest');
  if(target){
   target.innerHTML='<div class="loading-state">Calcolo del backtest cronologico sui risultati storici…</div>';
   setTimeout(()=>{try{target.innerHTML=backtestHTML(MM().backtest(d.history),MM().eloBacktest?MM().eloBacktest(d.history):null);}catch(e){target.innerHTML='<div class="notice warning">Backtest non completato: '+esc(e.message)+'</div>'; }},20);
  }
 }
 document.addEventListener('DOMContentLoaded',async()=>{
  const page=document.body.dataset.page||'home';
  try{const d=MM().forCompetition(await MM().loadData());const retrieved=d.updatedAt?new Date(d.updatedAt).toLocaleString('it-IT'):'orario non disponibile';setStatus(d.source==='cache'?'Offline · dati salvati localmente.':'Fonti: '+(d.source||'fonti pubbliche')+' · scaricati '+retrieved,d.source==='cache'?'':'ok');
   const mindKicker=$('analysisCompetitionKicker');if(mindKicker)mindKicker.textContent='MATCHMIND · '+MM().competitionInfo(d.competition).name.toUpperCase()+' ANALYST';
   if(page==='home')initHome(d);else if(page==='matches')initMatches(d);else if(page==='explore')initExplore(d);else if(page==='league')initLeague(d);else if(page==='team')initTeam(d);else if(page==='match')await initMatch(d);else if(page==='players')setStatus('Statistiche individuali non integrate: non mostro dati giocatore privi di una fonte verificabile.');else if(page==='data')initData();else if(page==='settings')initSettings();else if(page==='mind')initMind(d);
  }catch(e){setStatus('Dati non disponibili: '+e.message,'err');if(page==='settings')initSettings();else if(page==='data')initData();else{const targets={home:'matchList',matches:'matchList',explore:'teamDirectory',league:'standingsBody',team:'teamContent',match:'matchDetail',mind:'mindFixtures'};const id=targets[page];if(id&&$(id))$(id).innerHTML='<div class="notice warning">'+esc(e.message)+'</div>';}}
 });
})();