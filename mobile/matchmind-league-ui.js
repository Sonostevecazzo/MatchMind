/* MatchMind league interface controller.
   Reads the existing match feed and model functions; it does not alter forecast logic. */
let matchMindView = 'date';
function teamInitials(name){
  return String(name||'?').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase().slice(0,2);
}
function teamTint(name){
  let n=0;for(const c of String(name||''))n=(n*31+c.charCodeAt(0))|0;
  return 'hsl('+Math.abs(n)%360+' 36% 25%)';
}
function teamBadge(name){
  return '<span class="team-crest" style="--crest:'+teamTint(name)+'">'+esc(teamInitials(name))+'</span>';
}
function currentSeasonRows(){return matches.filter(hasScore);}
function buildLeagueTable(rows){
  const map=new Map();
  const get=(name)=>{const k=norm(name);if(!map.has(k))map.set(k,{name,played:0,w:0,d:0,l:0,gf:0,ga:0,pts:0});return map.get(k);};
  rows.forEach(m=>{
    if(!hasScore(m))return;
    const h=get(m.home),a=get(m.away),hg=Number(m.hg),ag=Number(m.ag);
    h.played++;a.played++;h.gf+=hg;h.ga+=ag;a.gf+=ag;a.ga+=hg;
    if(hg>ag){h.w++;a.l++;h.pts+=3;}
    else if(hg<ag){a.w++;h.l++;a.pts+=3;}
    else{h.d++;a.d++;h.pts++;a.pts++;}
  });
  return [...map.values()].map(t=>({...t,gd:t.gf-t.ga})).sort((a,b)=>b.pts-a.pts||b.gd-a.gd||b.gf-a.gf||a.name.localeCompare(b.name,'it'));
}
function standingsMarkup(table,compact=false){
  if(!table.length)return '<div class="empty"><strong>Classifica non ancora disponibile</strong>Servono risultati conclusi della stagione selezionata.</div>';
  const rows=(compact?table.slice(0,5):table).map((t,i)=>
    '<tr><td class="rank-cell">'+(i+1)+'</td><td class="club-cell">'+teamBadge(t.name)+'<strong>'+esc(t.name)+'</strong></td><td>'+t.played+'</td><td>'+t.w+'</td><td>'+t.d+'</td><td>'+t.l+'</td><td>'+t.gd+'</td><td class="points-cell">'+t.pts+'</td></tr>'
  ).join('');
  return '<div class="table-scroll"><table class="league-table"><thead><tr><th>#</th><th>Squadra</th><th>PG</th><th>V</th><th>N</th><th>P</th><th>DR</th><th>PT</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
    (compact?'':'<p class="data-disclaimer">PG partite giocate · DR differenza reti · PT punti. Classifica ricostruita dai soli risultati caricati, non feed ufficiale in tempo reale.</p>');
}
function renderLeagueOverview(){
  const upcoming=matches.filter(m=>!hasScore(m)).sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||'')));
  const next=upcoming[0],featured=$('featuredMatch');
  if(featured){
    if(!next)featured.innerHTML='<div class="featured-empty">Nessuna prossima partita presente nel calendario caricato.</div>';
    else featured.innerHTML='<div class="featured-date">'+esc(dateLabel(next))+'</div><div class="featured-teams"><div class="featured-team">'+teamBadge(next.home)+'<strong>'+esc(next.home)+'</strong></div><span class="versus">VS</span><div class="featured-team">'+teamBadge(next.away)+'<strong>'+esc(next.away)+'</strong></div></div><button class="primary featured-action" data-featured-analyse>Apri analisi partita ↗</button>';
    const action=featured.querySelector('[data-featured-analyse]');
    if(action)action.addEventListener('click',()=>analyse(next));
  }
  const table=buildLeagueTable(currentSeasonRows());
  if($('standingsPreview'))$('standingsPreview').innerHTML=standingsMarkup(table,true);
  if($('standingsTable'))$('standingsTable').innerHTML=standingsMarkup(table,false);
  if($('seasonLabel')){
    const selected=$('seasonSelect')?.value||'current';
    $('seasonLabel').textContent=selected==='previous'?'Stagione precedente':(seasonStart()+'/'+String(seasonStart()+1).slice(-2));
  }
  const played=currentSeasonRows(),teams=table.length,totalGoals=played.reduce((s,m)=>s+Number(m.hg)+Number(m.ag),0);
  const homeWins=played.filter(m=>m.hg>m.ag).length,draws=played.filter(m=>m.hg===m.ag).length,awayWins=played.filter(m=>m.hg<m.ag).length;
  const scorers=table.slice().sort((a,b)=>b.gf-a.gf).slice(0,5);
  if($('leagueStats')){
    $('leagueStats').innerHTML=
      '<article class="metric-card"><span>Partite concluse</span><strong>'+played.length+'</strong><small>nella stagione selezionata</small></article>'+
      '<article class="metric-card"><span>Gol totali</span><strong>'+totalGoals+'</strong><small>'+(played.length?(totalGoals/played.length).toFixed(2).replace('.',','):'—')+' per partita</small></article>'+
      '<article class="metric-card"><span>Squadre presenti</span><strong>'+teams+'</strong><small>con almeno un risultato</small></article>'+
      '<article class="metric-card"><span>Esiti</span><strong>'+homeWins+' / '+draws+' / '+awayWins+'</strong><small>vittorie casa / pareggi / trasferta</small></article>'+
      '<article class="metric-card wide"><span>Squadre con più gol segnati</span><div class="leaders-list">'+
      (scorers.length?scorers.map(t=>'<div>'+teamBadge(t.name)+'<span>'+esc(t.name)+'</span><b>'+t.gf+'</b></div>').join(''):'<small>Statistiche in attesa dei risultati.</small>')+
      '</div></article>';
  }
  const clubs=[...new Set(matches.flatMap(m=>[m.home,m.away]))].sort((a,b)=>a.localeCompare(b,'it'));
  const quick=$('teamQuickFilters');
  if(quick){
    quick.innerHTML=clubs.map(n=>'<button type="button" data-team-filter="'+esc(n)+'">'+teamBadge(n)+esc(n)+'</button>').join('');
    quick.querySelectorAll('[data-team-filter]').forEach(b=>b.addEventListener('click',()=>{
      $('searchTeam').value=b.dataset.teamFilter;matchMindView='date';
      document.querySelectorAll('[data-match-view]').forEach(x=>x.classList.toggle('active',x.dataset.matchView==='date'));
      renderMatches();
    }));
  }
}
function matchCard(m){
  const done=hasScore(m),id=matches.indexOf(m),status=done?'FT':(m.time||'ORARIO TBA');
  const score=done?m.hg+' – '+m.ag:'– : –';
  return '<article class="fixture-card"><div class="fixture-topline"><span class="fixture-competition"><span class="tiny-flag"></span> SERIE A</span><span class="fixture-status '+(done?'completed':'scheduled')+'">'+esc(status)+'</span></div>'+
    '<div class="fixture-body"><div class="fixture-clubs"><div class="fixture-club">'+teamBadge(m.home)+'<strong>'+esc(m.home)+'</strong></div><div class="fixture-club">'+teamBadge(m.away)+'<strong>'+esc(m.away)+'</strong></div></div><div class="fixture-score '+(done?'':'pending')+'">'+score+'</div></div>'+
    '<div class="fixture-bottom"><span>'+(m.hs!==null?'Tiri '+m.hs+' – '+(m.as??'—'):'Dati partita')+'</span><button class="analyse-button" data-analyse="'+id+'">Analizza <span>↗</span></button></div></article>';
}
function renderMatches(){
  const q=norm($('searchTeam')?.value||'');
  let rows=matches.filter(m=>!q||norm(m.home).includes(q)||norm(m.away).includes(q));
  rows=rows.filter(m=>filter==='all'||(filter==='finished'?hasScore(m):!hasScore(m)));
  rows.sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||'')));
  if(filter==='finished')rows.reverse();
  const target=$('matches');if(!target)return;
  if(!rows.length){
    target.innerHTML='<div class="empty"><strong>Nessuna partita trovata</strong>Prova a cambiare filtro o aggiorna il calendario.</div>';
    renderLeagueOverview();return;
  }
  if(matchMindView==='teams'&&!q){
    const clubs=[...new Set(rows.flatMap(m=>[m.home,m.away]))].sort((a,b)=>a.localeCompare(b,'it'));
    target.innerHTML=clubs.map(club=>{
      const games=rows.filter(m=>norm(m.home)===norm(club)||norm(m.away)===norm(club));
      return '<section class="team-fixture-group"><h4>'+teamBadge(club)+esc(club)+'</h4>'+games.map(matchCard).join('')+'</section>';
    }).join('');
  }else{
    const groups=new Map();
    rows.forEach(m=>{const key=m.date||'Data da definire';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(m);});
    target.innerHTML=[...groups.entries()].map(([date,games])=>
      '<section class="date-group"><div class="date-group-title"><span>'+esc(dateLabel({...games[0],time:''}).split(' · ')[0])+'</span><small>'+games.length+' '+(games.length===1?'partita':'partite')+'</small></div>'+games.map(matchCard).join('')+'</section>'
    ).join('');
  }
  target.querySelectorAll('[data-analyse]').forEach(b=>b.addEventListener('click',()=>analyse(matches[Number(b.dataset.analyse)])));
  renderLeagueOverview();
}
renderMatches = renderMatches;
document.querySelectorAll('[data-match-view]').forEach(b=>b.addEventListener('click',()=>{
  matchMindView=b.dataset.matchView;
  document.querySelectorAll('[data-match-view]').forEach(x=>x.classList.toggle('active',x===b));
  $('teamQuickFilters')?.classList.toggle('hidden',matchMindView!=='teams');
  renderMatches();
}));
$('searchTeam')?.addEventListener('input',renderMatches);
$('seasonSelect')?.addEventListener('change',()=>{renderMatches();renderLeagueOverview();});
document.querySelectorAll('.league-tabs a').forEach(a=>a.addEventListener('click',()=>{
  document.querySelectorAll('.league-tabs a').forEach(x=>x.classList.toggle('active',x===a));
}));
window.addEventListener('load',()=>{renderMatches();renderLeagueOverview();});
