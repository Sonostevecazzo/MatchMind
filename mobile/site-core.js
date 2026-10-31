/* MatchMind shared data and navigation layer. No forecast output is fabricated. */
(function(){
  const BASE='https://raw.githubusercontent.com/oladeeayo/open-matchday/master/data/ITA_1_serie-a/';
  const HIST='https://raw.githubusercontent.com/qhtexas/football-dataset/main/datasets/serie-a/';
  const CACHE_KEY='matchmind-multipage-cache-v1';
  const $=id=>document.getElementById(id);
  const seasonStart=()=>{const d=new Date();return d.getMonth()>=6?d.getFullYear():d.getFullYear()-1};
  const seasonCode=y=>String(y).slice(-2)+String(y+1).slice(-2);
  function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function norm(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');}
  function parseCSV(text){
    const out=[];let row=[],cell='',quoted=false;
    for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(c==='"')quoted=false;else cell+=c;}
      else if(c==='"')quoted=true;else if(c===','){row.push(cell);cell='';}
      else if(c==='\n'){row.push(cell.replace(/\r$/,''));if(row.some(v=>v.trim()!==''))out.push(row);row=[];cell='';}else cell+=c;}
    if(cell.length||row.length){row.push(cell.replace(/\r$/,''));out.push(row);}
    if(!out.length)return [];
    const heads=out.shift().map(x=>x.trim().replace(/^\uFEFF/,'' ));
    return out.map(vals=>Object.fromEntries(heads.map((h,i)=>[h,(vals[i]??'').trim()])));
  }
  const num=v=>{if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null;};
  function toISO(v){if(!v)return '';if(/^\d{4}-\d{2}-\d{2}$/.test(v))return v;const m=String(v).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);if(m){let y=Number(m[3]);if(y<100)y+=y<70?2000:1900;return y+'-'+String(Number(m[2])).padStart(2,'0')+'-'+String(Number(m[1])).padStart(2,'0');}return '';}
  function parseOpen(rows){return rows.filter(r=>r.home&&r.away&&r.date).map(r=>({date:r.date,time:r.time||'',round:num(r.gw??r.GW??r.round??r.Round??r.matchday??r.Matchday),home:r.home,away:r.away,hg:num(r.ft_home),ag:num(r.ft_away),hs:num(r.home_shots),as:num(r.away_shots),ht:num(r.ht_home),at:num(r.ht_away),source:'open-matchday',oddsH:null,oddsD:null,oddsA:null}));}
  function parseHist(rows){return rows.filter(r=>(r.HomeTeam||r.home)&&(r.AwayTeam||r.away)&&(r.Date||r.date)).map(r=>({date:toISO(r.Date||r.date),time:r.Time||'',round:num(r.gw??r.GW??r.round??r.Round??r.Matchday??r.matchday),home:r.HomeTeam||r.home,away:r.AwayTeam||r.away,hg:num(r.FTHG??r.ft_home),ag:num(r.FTAG??r.ft_away),hs:num(r.HS),as:num(r.AS),ht:num(r.HTHG),at:num(r.HTAG),source:'football-data',oddsH:num(r.B365H??r.AvgH),oddsD:num(r.B365D??r.AvgD),oddsA:num(r.B365A??r.AvgA)})).filter(m=>m.date);}
  async function fetchText(url){const res=await fetch(url,{cache:'no-store'});if(!res.ok)throw new Error('HTTP '+res.status);return res.text();}
  function readCache(){try{const own=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');if(own)return own;const old=JSON.parse(localStorage.getItem('matchmind-cache')||'null');return old&&Array.isArray(old.matches)?{...old,updatedAt:old.savedAt||0,source:'cache'}:null;}catch{return null;}}
  let dataPromise=null, data={matches:[],history:[],season:seasonStart(),source:'open-matchday',updatedAt:null};
  async function loadData(force=false){
    if(dataPromise&&!force)return dataPromise;
    dataPromise=(async()=>{
      const y=seasonStart(),code=seasonCode(y),cached=readCache();
      if(!force&&cached&&cached.season===y&&Array.isArray(cached.matches)&&cached.matches.length){data={...cached};}
      let source='open-matchday',fresh=[],primaryFailed=false;
      try{
        const [results,fixtures]=await Promise.all([fetchText(BASE+'results_'+code+'.csv'),fetchText(BASE+'fixtures_'+code+'.csv').catch(()=> '')]);
        fresh=parseOpen(parseCSV(results));
        const scheduled=fixtures?parseOpen(parseCSV(fixtures)).filter(m=>m.hg===null||m.ag===null):[];
        fresh.push(...scheduled);
        if(!scheduled.length){
          try{
            const backup=await playerApi('type=fixtures&season='+y,'football-data-fixtures:'+y,6*60*60*1000);
            const extra=(backup.matches||[]).filter(m=>m.hg===null||m.ag===null);
            if(extra.length){fresh.push(...extra);source='open-matchday + football-data.org';}
          }catch{}
        }
      }catch(error){primaryFailed=true;try{
        const backup=await playerApi('type=fixtures&season='+y,'football-data-fixtures:'+y,6*60*60*1000);
        fresh=Array.isArray(backup.matches)?backup.matches:[];source='football-data.org';
      }catch(fallbackError){if(!data.matches.length)throw new Error('Calendario principale e fonte di riserva non disponibili: '+fallbackError.message);data.source='cache';}}
      if(fresh.length){
        const deduped=[];
        fresh.forEach(m=>{const idx=deduped.findIndex(x=>x.date===m.date&&sameTeam(x.home,m.home)&&sameTeam(x.away,m.away));if(idx<0)deduped.push(m);else{const prev=deduped[idx];deduped[idx]={...m,...prev,round:prev.round??m.round,time:prev.time||m.time,hg:prev.hg??m.hg,ag:prev.ag??m.ag,hs:prev.hs??m.hs,as:prev.as??m.as,ht:prev.ht??m.ht,at:prev.at??m.at};}});
        const current=deduped;
        let older=[];
        const histFresh=cached&&cached.season===y&&Array.isArray(cached.history)&&Date.now()-Number(cached.historySavedAt||cached.updatedAt||0)<7*24*60*60*1000;
        if(histFresh)older=cached.history.filter(m=>m.source!=='open-matchday');
        else older=(await Promise.all([y-1,y-2,y-3,y-4,y-5].map(async yy=>{try{return parseHist(parseCSV(await fetchText(HIST+'season-'+seasonCode(yy)+'.csv')));}catch{return []}}))).flat();
        const histMap=new Map();[...older,...current.filter(m=>m.hg!==null&&m.ag!==null)].forEach(m=>histMap.set(m.date+'|'+norm(m.home)+'|'+norm(m.away),m));
        data={matches:current,history:[...histMap.values()],season:y,source,updatedAt:Date.now(),historySavedAt:histFresh?cached.historySavedAt:Date.now()};
        try{localStorage.setItem(CACHE_KEY,JSON.stringify(data));}catch{}
      }else if(!data.matches.length)throw new Error('Il calendario non ha restituito partite.');
      return data;
    })().catch(error=>{dataPromise=null;const cached=readCache();if(cached&&cached.matches){data={...cached,source:'cache'};return data;}throw error;});
    return dataPromise;
  }
  const sameTeam=(a,b)=>{const x=norm(a),y=norm(b);if(!x||!y)return false;if(x===y||(Math.min(x.length,y.length)>=5&&(x.includes(y)||y.includes(x))))return true;const groups=[['inter','internazionale','intermilan'],['milan','acmilan'],['verona','hellasverona'],['roma','asroma'],['lazio','sslazio'],['juventus','juve'],['napoli','sscnapoli'],['fiorentina','acffiorentina'],['sassuolo','ussassuolo'],['cagliari','cagliaricalcio'],['udinese','udinesecalcio'],['torino','torinofc'],['genoa','genoacfc'],['parma','parmacalcio'],['lecce','uslecce'],['pisa','pisasc']];return groups.some(g=>g.includes(x)&&g.includes(y));};
  const hasScore=m=>m&&m.hg!==null&&m.hg!==undefined&&m.ag!==null&&m.ag!==undefined&&Number.isFinite(Number(m.hg))&&Number.isFinite(Number(m.ag));
  const dateLabel=m=>{if(!m||!m.date)return 'Data da definire';const d=new Date(m.date+'T12:00:00');return d.toLocaleDateString('it-IT',{weekday:'long',day:'2-digit',month:'long'})+(m.time?' · '+m.time:'');};
  const shortDate=m=>{if(!m||!m.date)return 'Data da definire';return new Date(m.date+'T12:00:00').toLocaleDateString('it-IT',{weekday:'short',day:'2-digit',month:'short'});};
  const upcoming=m=>{if(hasScore(m)||!m.date)return false;const time=/^\d{1,2}:\d{2}$/.test(String(m.time||''))?m.time:'23:59';const kickoff=new Date(m.date+'T'+time+':00').getTime();return Number.isFinite(kickoff)&&kickoff>=Date.now();};
  const matchUrl=m=>'match.html?date='+encodeURIComponent(m.date)+'&home='+encodeURIComponent(m.home)+'&away='+encodeURIComponent(m.away);
  const teamUrl=name=>'team.html?team='+encodeURIComponent(name);
  const playerUrl='players.html';
  function teamInitials(name){return String(name||'?').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase().slice(0,2);}
  function teamColor(name){let n=0;for(const c of String(name||''))n=(n*31+c.charCodeAt(0))|0;return 'hsl('+Math.abs(n)%360+' 35% 28%)';}
  const TEAM_LOGOS={atalanta:499,bologna:500,cagliari:490,como:895,cremonese:520,frosinone:512,fiorentina:502,genoa:495,inter:505,internazionale:505,juventus:496,lazio:487,lecce:867,milan:489,monza:1579,napoli:492,parma:523,pisa:4177,roma:497,sassuolo:488,torino:503,udinese:494,venezia:517,verona:504,hellasverona:504};
  function logoId(name){const k=norm(name);if(TEAM_LOGOS[k])return TEAM_LOGOS[k];for(const [alias,id] of Object.entries(TEAM_LOGOS)){if(k===alias||k.includes(alias)||alias.includes(k))return id;}return null;}
  function badge(name){const id=logoId(name),fallback=esc(teamInitials(name));return '<span class="team-crest" style="--crest:'+teamColor(name)+'">'+(id?'<img class="team-logo" src="https://media.api-sports.io/football/teams/'+id+'.png" alt="" loading="lazy" decoding="async" onload="this.nextElementSibling.hidden=true" onerror="this.remove()">':'')+'<span class="team-crest-fallback">'+fallback+'</span></span>';}
  function getTeams(rows){return [...new Set(rows.flatMap(m=>[m.home,m.away]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'it'));}
  function groupByDate(rows){const map=new Map();rows.forEach(m=>{const k=m.date||'unknown';if(!map.has(k))map.set(k,[]);map.get(k).push(m);});return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0]));}
  function standings(rows){
    const map=new Map(),get=name=>{const k=norm(name);if(!map.has(k))map.set(k,{name,played:0,w:0,d:0,l:0,gf:0,ga:0,pts:0});return map.get(k);};
    rows.filter(hasScore).forEach(m=>{const h=get(m.home),a=get(m.away),hg=Number(m.hg),ag=Number(m.ag);h.played++;a.played++;h.gf+=hg;h.ga+=ag;a.gf+=ag;a.ga+=hg;if(hg>ag){h.w++;a.l++;h.pts+=3;}else if(hg<ag){a.w++;h.l++;a.pts+=3;}else{h.d++;a.d++;h.pts++;a.pts++;}});
    return [...map.values()].map(t=>({...t,gd:t.gf-t.ga})).sort((a,b)=>b.pts-a.pts||b.gd-a.gd||b.gf-a.gf||a.name.localeCompare(b.name,'it'));
  }
  function poisson(l,g){if(l<=0)return g===0?1:0;let p=Math.exp(-l);for(let i=1;i<=g;i++)p*=l/i;return p;}
  function probs(lh,la){let h=0,d=0,a=0,btts=0,o15=0,o25=0,o35=0,total=0;for(let x=0;x<=12;x++)for(let y=0;y<=12;y++){const p=poisson(lh,x)*poisson(la,y);total+=p;if(x>y)h+=p;else if(x===y)d+=p;else a+=p;if(x>0&&y>0)btts+=p;if(x+y>=2)o15+=p;if(x+y>=3)o25+=p;if(x+y>=4)o35+=p;}return{home:h/total,draw:d/total,away:a/total,btts:btts/total,o15:o15/total,o25:o25/total,o35:o35/total};}
  function teamStats(team,rows){const k=norm(team),list=rows.filter(m=>hasScore(m)&&(norm(m.home)===k||norm(m.away)===k)).sort((a,b)=>a.date.localeCompare(b.date)).slice(-10);if(!list.length)return{played:0,for:1.25,against:1.25,form:[]};let gf=0,ga=0;for(const m of list){const home=norm(m.home)===k;gf+=home?Number(m.hg):Number(m.ag);ga+=home?Number(m.ag):Number(m.hg);}return{played:list.length,for:gf/list.length,against:ga/list.length,form:list.slice(-5).map(m=>{const x=Number(m.hg),y=Number(m.ag),home=norm(m.home)===k;return(home?x>y:y>x)?'W':x===y?'D':'L';})};}
  function forecast(match,history){const hist=history.filter(x=>hasScore(x)&&x.date<match.date);const league=hist.length?hist.reduce((s,x)=>s+Number(x.hg),0)/hist.length:1.35;const awayLeague=hist.length?hist.reduce((s,x)=>s+Number(x.ag),0)/hist.length:1.1;const h=teamStats(match.home,hist),a=teamStats(match.away,hist);const homeXg=Math.max(.15,Math.min(4.5,league*((h.for+.7)/(league+.7))*((a.against+.7)/(awayLeague+.7))*1.06));const awayXg=Math.max(.15,Math.min(4.5,awayLeague*((a.for+.7)/(awayLeague+.7))*((h.against+.7)/(league+.7))));const dates=hist.map(m=>m.date).filter(Boolean).sort();return{historyCount:hist.length,historyStart:dates[0]||null,historyEnd:dates.at(-1)||null,home:h,away:a,homeXg,awayXg,probabilities:probs(homeXg,awayXg),sampleEnough:h.played>=10&&a.played>=10};}
  function backtest(rows){
    const played=rows.filter(m=>hasScore(m)&&m.date).slice().sort((a,b)=>a.date.localeCompare(b.date));
    const scored=[],outcomes={home:0,draw:0,away:0};
    for(let i=0;i<played.length;i++){
      const target=played[i],prior=played.slice(0,i).filter(m=>m.date<target.date);
      if(prior.length<30)continue;
      const f=forecast(target,prior);
      if(!f.sampleEnough)continue;
      const actual=Number(target.hg)>Number(target.ag)?'home':Number(target.hg)<Number(target.ag)?'away':'draw';
      const counts={home:0,draw:0,away:0};
      prior.forEach(m=>{const k=Number(m.hg)>Number(m.ag)?'home':Number(m.hg)<Number(m.ag)?'away':'draw';counts[k]++;});
      const baseline={home:(counts.home+1)/(prior.length+3),draw:(counts.draw+1)/(prior.length+3),away:(counts.away+1)/(prior.length+3)};
      const p=f.probabilities,pp=p[actual],bp=baseline[actual];
      const winner=Object.keys(p).sort((a,b)=>p[b]-p[a])[0],baseWinner=Object.keys(baseline).sort((a,b)=>baseline[b]-baseline[a])[0];
      scored.push({date:target.date,actual,p:{home:p.home,draw:p.draw,away:p.away},baseline,confidence:p[winner],hit:winner===actual,baseHit:baseWinner===actual,logLoss:-Math.log(Math.max(1e-15,pp)),baseLogLoss:-Math.log(Math.max(1e-15,bp)),brier:(p.home-(actual==='home'?1:0))**2+(p.draw-(actual==='draw'?1:0))**2+(p.away-(actual==='away'?1:0))**2,baseBrier:(baseline.home-(actual==='home'?1:0))**2+(baseline.draw-(actual==='draw'?1:0))**2+(baseline.away-(actual==='away'?1:0))**2});
    }
    const n=scored.length;if(!n)return{count:0,available:played.length,threshold:10};
    const avg=k=>scored.reduce((s,x)=>s+x[k],0)/n;
    const bins=Array.from({length:5},(_,i)=>{const items=scored.filter(x=>x.confidence>=i*.2&&(i===4?x.confidence<=1:x.confidence<(i+1)*.2));return{range:(i*.2*100)+'–'+((i+1)*20)+'%',count:items.length,confidence:items.length?items.reduce((s,x)=>s+x.confidence,0)/items.length:null,hitRate:items.length?items.filter(x=>x.hit).length/items.length:null};}).filter(x=>x.count);
    const dates=scored.map(x=>x.date).sort();
    return{count:n,available:played.length,from:dates[0],to:dates.at(-1),model:{accuracy:avg('hit'),logLoss:avg('logLoss'),brier:avg('brier')},baseline:{accuracy:avg('baseHit'),logLoss:avg('baseLogLoss'),brier:avg('baseBrier')},bins,beatsBaseline:avg('brier')<avg('baseBrier')&&avg('logLoss')<avg('baseLogLoss')};
  }
  function localCache(key){try{return JSON.parse(localStorage.getItem(key)||'{}');}catch{return {};}}
  function saveCache(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{}}
  async function playerApi(query,key,ttl=21600000){const cache=localCache('matchmind-player-cache-v1'),item=cache[key];if(item&&Date.now()-item.at<ttl)return item.data;const headers={Accept:'application/json'};try{const sessionKey=sessionStorage.getItem('matchmind-api-football-session-key');if(sessionKey)headers['X-MatchMind-API-Key']=sessionKey;}catch{}const res=await fetch('./api/player-context?'+query,{headers,cache:'no-store'});let body;try{body=await res.json();}catch{throw new Error('Risposta non valida dal servizio giocatori.');}if(!res.ok)throw new Error(body.error||'Errore nel recupero dati.');if(body.configured===false||body.error)throw new Error(body.error||'Fonte dati non configurata.');cache[key]={at:Date.now(),data:body};saveCache('matchmind-player-cache-v1',cache);return body;}
  const isFavorite=name=>{try{return (JSON.parse(localStorage.getItem('matchmind-favorites-v1')||'[]')).includes(name);}catch{return false;}};
  function toggleFavorite(name){const list=(()=>{try{return JSON.parse(localStorage.getItem('matchmind-favorites-v1')||'[]');}catch{return [];}})();const next=list.includes(name)?list.filter(x=>x!==name):[...list,name];saveCache('matchmind-favorites-v1',next);return next.includes(name);}
  function nav(active){
    const icons={
      home:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg>',
      matches:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M7 2v4m10-4v4M3 9h18m-13 4h3m-3 4h6"/></svg>',
      explore:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 21 8v8l-9 5-9-5V8z"/><path d="m3 8 9 5 9-5M12 13v8m-4-16 4 5 4-5"/></svg>',
      mind:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5m0 14h16M7 15l4-4 3 2 5-7"/><path d="M16 6h3v3"/></svg>',
      settings:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.5.9l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.5-.9l-1.7.6-1.4-2.4 1.4-1.1a7 7 0 0 1 0-1.8l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.5-.9l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.5.9l1.7-.6 1.4 2.4-1.4 1.1a7 7 0 0 1 0 1.8Z"/></svg>'
    };
    const links=[['index.html','home','Home','home'],['matches.html','matches','Partite','matches'],['explore.html','explore','Club','explore'],['analysis-lab.html','mind','Analisi','mind'],['settings.html','settings','Impostazioni','settings']];
    const mobile=links.map(([href,key,label])=>'<a class="nav-item '+(active===key?'active':'')+'" href="'+href+'" '+(active===key?'aria-current="page"':'')+'><span class="nav-icon">'+icons[key]+'</span><span>'+label+'</span></a>').join('');
    const desktop=links.map(([href,key,label])=>'<a class="'+(active===key?'active':'')+'" href="'+href+'" '+(active===key?'aria-current="page"':'')+'>'+label+'</a>').join('');
    return '<header class="site-header"><a class="brand-link" href="index.html" aria-label="MatchMind Home"><span class="brand-mark"><span>M</span></span><span class="brand-copy"><b>MatchMind</b><small>FOOTBALL INTELLIGENCE</small></span></a><nav class="desktop-nav" aria-label="Navigazione principale">'+desktop+'</nav><div class="header-actions"><button class="refresh-data install-action" id="installApp" type="button" hidden><span class="action-symbol">＋</span><span>Installa</span></button><button class="refresh-data refresh-action" id="globalRefresh" type="button" aria-label="Aggiorna dati"><span class="action-symbol">↻</span><span>Aggiorna</span></button></div></header><nav class="mobile-nav" aria-label="Navigazione principale">'+mobile+'</nav>';
  }
  function mountShell(active,title,subtitle){
    const header=$('siteHeader');if(header)header.innerHTML=nav(active);
    if(document.body.dataset.page==='match'){const back=document.createElement('button');back.className='detail-back';back.type='button';back.innerHTML='‹ <span>Torna alle partite</span>';back.addEventListener('click',()=>{if(history.length>1)history.back();else location.href='matches.html';});const main=document.querySelector('.page-wrap');if(main)main.prepend(back);}
    const titleEl=$('pageTitle');if(titleEl)titleEl.textContent=title||'MatchMind';
    const subEl=$('pageSubtitle');if(subEl)subEl.textContent=subtitle||'';
    $('globalRefresh')?.addEventListener('click',async()=>{const b=$('globalRefresh');b.disabled=true;b.classList.add('spinning');try{await loadData(true);location.reload();}catch(e){const s=$('globalStatus');if(s)s.textContent=e.message;}finally{b.disabled=false;b.classList.remove('spinning');}});
  }
  document.addEventListener('DOMContentLoaded',()=>{const page=document.body.dataset.page||'home';const active=page==='home'?'home':(page==='matches'||page==='match')?'matches':page==='mind'?'mind':(page==='explore'||page==='league'||page==='team'||page==='players')?'explore':(page==='data'||page==='settings')?'settings':'';mountShell(active,document.body.dataset.title||'MatchMind',document.body.dataset.subtitle||'');if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(reg=>reg.update().catch(()=>{})).catch(()=>{});let installPrompt=null;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;const b=$('installApp');if(b)b.hidden=false;});$('installApp')?.addEventListener('click',async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('installApp').hidden=true;});});
  window.MM={$,esc,norm,loadData,backtest,get data(){return data;},hasScore,upcoming,dateLabel,shortDate,matchUrl,teamUrl,teamInitials,badge,getTeams,groupByDate,standings,forecast,teamStats,probs,playerApi,isFavorite,toggleFavorite,seasonStart,formatNumber:(n,d=0)=>Number(n||0).toLocaleString('it-IT',{maximumFractionDigits:d}),status:m=>hasScore(m)?'Terminata':upcoming(m)?'In programma':'Da aggiornare'};
})();