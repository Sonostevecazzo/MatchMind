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
  function badge(name){return '<span class="team-crest" style="--crest:'+teamColor(name)+'">'+esc(teamInitials(name))+'</span>';}
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
  function forecast(match,history){const hist=history.filter(x=>hasScore(x)&&x.date<match.date);const league=hist.length?hist.reduce((s,x)=>s+Number(x.hg),0)/hist.length:1.35;const awayLeague=hist.length?hist.reduce((s,x)=>s+Number(x.ag),0)/hist.length:1.1;const h=teamStats(match.home,hist),a=teamStats(match.away,hist);const homeXg=Math.max(.15,Math.min(4.5,league*((h.for+.7)/(league+.7))*((a.against+.7)/(awayLeague+.7))*1.06));const awayXg=Math.max(.15,Math.min(4.5,awayLeague*((a.for+.7)/(awayLeague+.7))*((h.against+.7)/(league+.7))));return{historyCount:hist.length,home:h,away:a,homeXg,awayXg,probabilities:probs(homeXg,awayXg),sampleEnough:hist.length>=20&&h.played>=3&&a.played>=3};}
  function localCache(key){try{return JSON.parse(localStorage.getItem(key)||'{}');}catch{return {};}}
  function saveCache(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{}}
  async function playerApi(query,key,ttl=21600000){const cache=localCache('matchmind-player-cache-v1'),item=cache[key];if(item&&Date.now()-item.at<ttl)return item.data;const res=await fetch('./api/player-context?'+query,{headers:{Accept:'application/json'},cache:'no-store'});let body;try{body=await res.json();}catch{throw new Error('Risposta non valida dal servizio giocatori.');}if(!res.ok)throw new Error(body.error||'Errore nel recupero dati.');if(body.configured===false||body.error)throw new Error(body.error||'Fonte dati non configurata.');cache[key]={at:Date.now(),data:body};saveCache('matchmind-player-cache-v1',cache);return body;}
  const isFavorite=name=>{try{return (JSON.parse(localStorage.getItem('matchmind-favorites-v1')||'[]')).includes(name);}catch{return false;}};
  function toggleFavorite(name){const list=(()=>{try{return JSON.parse(localStorage.getItem('matchmind-favorites-v1')||'[]');}catch{return [];}})();const next=list.includes(name)?list.filter(x=>x!==name):[...list,name];saveCache('matchmind-favorites-v1',next);return next.includes(name);}
  function nav(active){
    const links=[['index.html','⌂','Home','home'],['matches.html','▤','Partite','matches'],['explore.html','◈','Esplora','explore'],['analysis-lab.html','◉','MatchMind','mind']];
    const mobile=links.map(([href,icon,label,key])=>'<a class="nav-item '+(active===key?'active':'')+'" href="'+href+'"><span class="nav-icon">'+icon+'</span><span>'+label+'</span></a>').join('');
    const desktop=links.map(([href,,label,key])=>'<a class="'+(active===key?'active':'')+'" href="'+href+'">'+label+'</a>').join('');
    return '<header class="site-header"><a class="brand-link" href="index.html"><span class="brand-mark">M</span><span><b>MatchMind</b><small>FOOTBALL INTELLIGENCE</small></span></a><nav class="desktop-nav">'+desktop+'</nav><button class="refresh-data" id="installApp" type="button" hidden>＋ <span>Installa</span></button><button class="refresh-data" id="globalRefresh" type="button">↻ <span>Aggiorna</span></button></header><nav class="mobile-nav" aria-label="Navigazione principale">'+mobile+'</nav>';
  }
  function mountShell(active,title,subtitle){
    const header=$('siteHeader');if(header)header.innerHTML=nav(active);
    const titleEl=$('pageTitle');if(titleEl)titleEl.textContent=title||'MatchMind';
    const subEl=$('pageSubtitle');if(subEl)subEl.textContent=subtitle||'';
    $('globalRefresh')?.addEventListener('click',async()=>{const b=$('globalRefresh');b.disabled=true;b.classList.add('spinning');try{await loadData(true);location.reload();}catch(e){const s=$('globalStatus');if(s)s.textContent=e.message;}finally{b.disabled=false;b.classList.remove('spinning');}});
  }
  document.addEventListener('DOMContentLoaded',()=>{const page=document.body.dataset.page||'home';const active=page==='home'?'home':(page==='matches'||page==='match')?'matches':page==='mind'?'mind':(page==='explore'||page==='league'||page==='team'||page==='players'||page==='data')?'explore':'';mountShell(active,document.body.dataset.title||'MatchMind',document.body.dataset.subtitle||'');if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});let installPrompt=null;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;const b=$('installApp');if(b)b.hidden=false;});$('installApp')?.addEventListener('click',async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('installApp').hidden=true;});});
  window.MM={$,esc,norm,loadData,get data(){return data;},hasScore,upcoming,dateLabel,shortDate,matchUrl,teamUrl,teamInitials,badge,getTeams,groupByDate,standings,forecast,teamStats,probs,playerApi,isFavorite,toggleFavorite,seasonStart,formatNumber:(n,d=0)=>Number(n||0).toLocaleString('it-IT',{maximumFractionDigits:d}),status:m=>hasScore(m)?'Terminata':upcoming(m)?'In programma':'Da aggiornare'};
})();