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
  function parseOpenFootball(payload){
    const rows=Array.isArray(payload?.matches)?payload.matches:[];
    return rows.map(r=>{
      const score=r.score?.ft??r.score?.fullTime??null;
      const scoreArray=Array.isArray(score)?score:null;
      const home=r.team1?.name||r.team1||r.homeTeam?.name||r.homeTeam||r.home||'';
      const away=r.team2?.name||r.team2||r.awayTeam?.name||r.awayTeam||r.away||'';
      const hg=scoreArray?num(scoreArray[0]):num(score?.home??r.goals?.home??r.ft_home);
      const ag=scoreArray?num(scoreArray[1]):num(score?.away??r.goals?.away??r.ft_away);
      const roundText=String(r.round||r.matchday||'');
      const roundMatch=roundText.match(/(\d+)/);
      return {date:toISO(r.date||r.utcDate||''),time:r.time||'',round:roundMatch?num(roundMatch[1]):num(r.round),home,away,hg,ag,hs:null,as:null,ht:null,at:null,source:'openfootball',oddsH:null,oddsD:null,oddsA:null};
    }).filter(m=>m.date&&m.home&&m.away);
  }
  function parseHist(rows){return rows.filter(r=>(r.HomeTeam||r.home)&&(r.AwayTeam||r.away)&&(r.Date||r.date)).map(r=>({date:toISO(r.Date||r.date),time:r.Time||'',round:num(r.gw??r.GW??r.round??r.Round??r.Matchday??r.matchday),home:r.HomeTeam||r.home,away:r.AwayTeam||r.away,hg:num(r.FTHG??r.ft_home),ag:num(r.FTAG??r.ft_away),hs:num(r.HS),as:num(r.AS),ht:num(r.HTHG),at:num(r.HTAG),source:'football-data',oddsH:num(r.B365H??r.AvgH),oddsD:num(r.B365D??r.AvgD),oddsA:num(r.B365A??r.AvgA)})).filter(m=>m.date);}
  async function fetchText(url){
    const controller=typeof AbortController!=='undefined'?new AbortController():null;
    const timeout=controller?setTimeout(()=>controller.abort(),12000):null;
    try{const res=await fetch(url,{cache:'no-store',signal:controller?.signal});if(!res.ok)throw new Error('HTTP '+res.status);return await res.text();}
    finally{if(timeout)clearTimeout(timeout);}
  }
  async function fetchJson(url){
    const controller=typeof AbortController!=='undefined'?new AbortController():null;
    const timeout=controller?setTimeout(()=>controller.abort(),12000):null;
    try{const res=await fetch(url,{cache:'no-store',signal:controller?.signal});if(!res.ok)throw new Error('HTTP '+res.status);return await res.json();}
    finally{if(timeout)clearTimeout(timeout);}
  }
  const footballJsonUrl=y=>'https://raw.githubusercontent.com/openfootball/football.json/master/'+y+'-'+String(y+1).slice(-2)+'/it.1.json';
  async function fetchOpenFootball(y){return parseOpenFootball(await fetchJson(footballJsonUrl(y)));}
  function readCache(){try{const own=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');if(own)return own;const old=JSON.parse(localStorage.getItem('matchmind-cache')||'null');return old&&Array.isArray(old.matches)?{...old,updatedAt:old.savedAt||0,source:'cache'}:null;}catch{return null;}}
  let dataPromise=null, data={matches:[],history:[],season:seasonStart(),source:'fonti pubbliche',updatedAt:null};
  async function loadData(force=false){
    if(dataPromise&&!force)return dataPromise;
    dataPromise=(async()=>{
      const y=seasonStart(),cached=readCache();
      if(!force&&cached&&cached.season===y&&Array.isArray(cached.matches)&&cached.matches.length){data={...cached};}
      let openRows=[],fixtureRows=[],jsonRows=[],used=[];
      try{
        const [results,fixtures]=await Promise.all([
          fetchText(BASE+'results_'+seasonCode(y)+'.csv'),
          fetchText(BASE+'fixtures_'+seasonCode(y)+'.csv').catch(()=> '')
        ]);
        openRows=parseOpen(parseCSV(results));
        if(fixtures)fixtureRows=parseOpen(parseCSV(fixtures)).filter(m=>m.hg===null||m.ag===null);
        if(openRows.length||fixtureRows.length)used.push('open-matchday');
      }catch{}
      // OpenFootball is an independent, keyless fallback and also fills missing future fixtures.
      const hasFuture=fixtureRows.some(m=>m.date>=new Date().toISOString().slice(0,10));
      if(!openRows.length||!hasFuture){
        try{
          jsonRows=await fetchOpenFootball(y);
          if(jsonRows.length)used.push('openfootball');
        }catch{}
      }
      let fresh=[...openRows,...fixtureRows];
      if(jsonRows.length){
        const primaryKeys=new Set(fresh.map(m=>m.date+'|'+norm(m.home)+'|'+norm(m.away)));
        jsonRows.forEach(m=>{if(!primaryKeys.has(m.date+'|'+norm(m.home)+'|'+norm(m.away)))fresh.push(m);});
      }
      // Use the optional backend only after both public feeds have failed completely.
      if(!fresh.length){
        try{
          const backup=await playerApi('type=fixtures&season='+y,'football-data-fixtures:'+y,6*60*60*1000);
          fresh=Array.isArray(backup.matches)?backup.matches:[];
          if(fresh.length)used.push('football-data.org · backend');
        }catch{}
      }
      if(fresh.length){
        const deduped=[];
        fresh.forEach(m=>{
          const idx=deduped.findIndex(x=>x.date===m.date&&sameTeam(x.home,m.home)&&sameTeam(x.away,m.away));
          if(idx<0)deduped.push(m);
          else{
            const prev=deduped[idx];
            deduped[idx]={...m,...prev,round:prev.round??m.round,time:prev.time||m.time,hg:prev.hg??m.hg,ag:prev.ag??m.ag,hs:prev.hs??m.hs,as:prev.as??m.as,ht:prev.ht??m.ht,at:prev.at??m.at};
          }
        });
        const current=deduped;
        let older=[];
        const histFresh=cached&&cached.season===y&&Array.isArray(cached.history)&&Date.now()-Number(cached.historySavedAt||cached.updatedAt||0)<7*24*60*60*1000;
        if(histFresh)older=cached.history.filter(m=>m.source!=='open-matchday'&&m.source!=='openfootball');
        else{
          const historical=await Promise.all([y-1,y-2,y-3,y-4,y-5].map(async yy=>{
            try{
              const csv=parseHist(parseCSV(await fetchText(HIST+'season-'+seasonCode(yy)+'.csv')));
              if(csv.length)return csv;
            }catch{}
            try{return await fetchOpenFootball(yy);}catch{return [];}
          }));
          older=historical.flat();
        }
        const histMap=new Map();
        [...older,...current.filter(m=>hasScore(m))].forEach(m=>histMap.set(m.date+'|'+norm(m.home)+'|'+norm(m.away),m));
        data={matches:current,history:[...histMap.values()],season:y,source:used.join(' + ')||'fonti pubbliche',updatedAt:Date.now(),historySavedAt:histFresh?cached.historySavedAt:Date.now(),sourceMode:'keyless-public'};
        try{localStorage.setItem(CACHE_KEY,JSON.stringify(data));}catch{}
      }else if(data.matches.length){
        // Preserve the last known dataset, but never label it as freshly retrieved.
        data={...data,source:'cache'};
      }else throw new Error('Nessuna fonte pubblica ha restituito partite. Controlla la connessione e riprova.');
      return data;
    })().catch(error=>{
      dataPromise=null;
      const cached=readCache();
      if(cached&&Array.isArray(cached.matches)&&cached.matches.length){data={...cached,source:'cache'};return data;}
      throw error;
    });
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
  function probs(lh,la){let h=0,d=0,a=0,btts=0,o15=0,o25=0,o35=0,total=0;for(let x=0;x<=30;x++)for(let y=0;y<=30;y++){const p=poisson(lh,x)*poisson(la,y);total+=p;if(x>y)h+=p;else if(x===y)d+=p;else a+=p;if(x>0&&y>0)btts+=p;if(x+y>=2)o15+=p;if(x+y>=3)o25+=p;if(x+y>=4)o35+=p;}return{home:h/total,draw:d/total,away:a/total,btts:btts/total,o15:o15/total,o25:o25/total,o35:o35/total};}
  function teamStats(team,rows){const k=norm(team),list=rows.filter(m=>hasScore(m)&&(norm(m.home)===k||norm(m.away)===k)).sort((a,b)=>a.date.localeCompare(b.date)).slice(-10);if(!list.length)return{played:0,for:1.25,against:1.25,form:[]};let gf=0,ga=0;for(const m of list){const home=norm(m.home)===k;gf+=home?Number(m.hg):Number(m.ag);ga+=home?Number(m.ag):Number(m.hg);}return{played:list.length,for:gf/list.length,against:ga/list.length,form:list.slice(-5).map(m=>{const x=Number(m.hg),y=Number(m.ag),home=norm(m.home)===k;return(home?x>y:y>x)?'W':x===y?'D':'L';})};}
  function forecast(match,history){const hist=history.filter(x=>hasScore(x)&&x.date<match.date);const league=hist.length?hist.reduce((s,x)=>s+Number(x.hg),0)/hist.length:1.35;const awayLeague=hist.length?hist.reduce((s,x)=>s+Number(x.ag),0)/hist.length:1.1;const h=teamStats(match.home,hist),a=teamStats(match.away,hist);const homeXg=Math.max(.15,Math.min(4.5,league*((h.for+.7)/(league+.7))*((a.against+.7)/(awayLeague+.7))*1.06));const awayXg=Math.max(.15,Math.min(4.5,awayLeague*((a.for+.7)/(awayLeague+.7))*((h.against+.7)/(league+.7))));const dates=hist.map(m=>m.date).filter(Boolean).sort();const scoreMatrix=[];let matrixMass=0;for(let homeGoals=0;homeGoals<=5;homeGoals++)for(let awayGoals=0;awayGoals<=5;awayGoals++){const probability=poisson(homeXg,homeGoals)*poisson(awayXg,awayGoals);matrixMass+=probability;scoreMatrix.push({homeGoals,awayGoals,probability});}return{historyCount:hist.length,historyStart:dates[0]||null,historyEnd:dates.at(-1)||null,home:h,away:a,homeXg,awayXg,probabilities:probs(homeXg,awayXg),scoreMatrix,scoreMatrixTail:Math.max(0,1-matrixMass),sampleEnough:h.played>=10&&a.played>=10};}
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
    const classes=['home','draw','away'];
    const byClass=Object.fromEntries(classes.map(k=>{const subset=scored;const meanP=subset.reduce((sum,x)=>sum+x.p[k],0)/n;const observed=subset.filter(x=>x.actual===k).length/n;const ll=subset.reduce((sum,x)=>sum-Math.log(Math.max(1e-15,x.p[k]===0&&x.actual===k?1e-15:x.actual===k?x.p[k]:1-x.p[k])),0)/n;const rows=Array.from({length:5},(_,i)=>{const selected=subset.filter(x=>x.p[k]>=i*.2&&(i===4?x.p[k]<=1:x.p[k]<(i+1)*.2));return{range:(i*20)+'–'+((i+1)*20)+'%',count:selected.length,predicted:selected.length?selected.reduce((sum,x)=>sum+x.p[k],0)/selected.length:null,observed:selected.length?selected.filter(x=>x.actual===k).length/selected.length:null};}).filter(x=>x.count);return[k,{predicted:meanP,observed,logLoss:ll,bins:rows}];}));
    const seasons=[...new Set(scored.map(x=>x.date.slice(0,4)))].sort();
    const bySeason=Object.fromEntries(seasons.map(y=>{const subset=scored.filter(x=>x.date.slice(0,4)===y),m=subset.length;return[y,{count:m,accuracy:subset.filter(x=>x.hit).length/m,logLoss:subset.reduce((sum,x)=>sum+x.logLoss,0)/m,brier:subset.reduce((sum,x)=>sum+x.brier,0)/m}];}));
    const accuracy=avg('hit'),z=1.96,den=1+z*z/n,center=(accuracy+z*z/(2*n))/den,margin=z*Math.sqrt((accuracy*(1-accuracy)+z*z/(4*n))/n)/den;
    return{count:n,available:played.length,from:dates[0],to:dates.at(-1),model:{accuracy,accuracyCI:[Math.max(0,center-margin),Math.min(1,center+margin)],logLoss:avg('logLoss'),brier:avg('brier')},baseline:{accuracy:avg('baseHit'),logLoss:avg('baseLogLoss'),brier:avg('baseBrier')},bins,byClass,bySeason,beatsBaseline:avg('brier')<avg('baseBrier')&&avg('logLoss')<avg('baseLogLoss')};
  }
  function localCache(key){try{return JSON.parse(localStorage.getItem(key)||'{}');}catch{return {};}}
  function saveCache(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{}}
  async function playerApi(query,key,ttl=21600000){const cache=localCache('matchmind-player-cache-v1'),item=cache[key];if(item&&Date.now()-item.at<ttl)return item.data;const headers={Accept:'application/json'};try{const keys=[['matchmind-api-football-session-key','X-MatchMind-API-Key'],['matchmind-oddspapi-session-key','X-MatchMind-OddsPapi-Key'],['matchmind-football-data-session-key','X-MatchMind-Football-Data-Key'],['matchmind-the-odds-api-session-key','X-MatchMind-The-Odds-API-Key']];keys.forEach(([storage,header])=>{const value=sessionStorage.getItem(storage);if(value)headers[header]=value;});}catch{}const res=await fetch('./api/player-context?'+query,{headers,cache:'no-store'});let body;try{body=await res.json();}catch{throw new Error('Risposta non valida dal servizio dati.');}if(!res.ok)throw new Error(body.error||'Errore nel recupero dati.');if(body.configured===false||body.error)throw new Error(body.error||'Fonte dati non configurata.');cache[key]={at:Date.now(),data:body};saveCache('matchmind-player-cache-v1',cache);return body;}
  const isFavorite=name=>{try{return (JSON.parse(localStorage.getItem('matchmind-favorites-v1')||'[]')).includes(name);}catch{return false;}};
  function toggleFavorite(name){const list=(()=>{try{return JSON.parse(localStorage.getItem('matchmind-favorites-v1')||'[]');}catch{return [];}})();const next=list.includes(name)?list.filter(x=>x!==name):[...list,name];saveCache('matchmind-favorites-v1',next);return next.includes(name);}
  function nav(active){
    const icons={
      home:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg>',
      matches:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M7 2v4m10-4v4M3 9h18m-13 4h3m-3 4h6"/></svg>',
      league:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 7.5v9L12 21 4 16.5v-9L12 3Z"/><path d="m4.5 8 7.5 4 7.5-4M12 12v8.5M8.5 5l3.5 4 3.5-4"/></svg>',
      mind:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5m0 14h16M7 15l4-4 3 2 5-7"/><path d="M16 6h3v3"/></svg>',
      more:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>',
      refresh:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.6 9a7 7 0 0 1 11.7-2L20 12M4 12l2.7 5a7 7 0 0 0 11.7-2"/></svg>',
      install:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 20h16"/></svg>'
    };
    const links=[
      ['index.html','home','Home'],
      ['matches.html','matches','Partite'],
      ['league.html','league','Serie A'],
      ['analysis-lab.html','mind','AI Insights'],
      ['explore.html','more','Altro']
    ];
    const mobile=links.map(([href,key,label])=>'<a class="nav-item '+(active===key?'active':'')+'" href="'+href+'" '+(active===key?'aria-current="page"':'')+'><span class="nav-icon">'+icons[key]+'</span><span>'+label+'</span></a>').join('');
    const desktop=links.map(([href,key,label])=>'<a class="'+(active===key?'active':'')+'" href="'+href+'" '+(active===key?'aria-current="page"':'')+'>'+label+'</a>').join('');
    return '<header class="site-header"><a class="brand-link" href="index.html" aria-label="MatchMind Home"><span class="brand-mark"><span>M</span></span><span class="brand-copy"><b>MatchMind</b><small>SERIE A INTELLIGENCE</small></span></a><nav class="desktop-nav" aria-label="Navigazione principale">'+desktop+'</nav><div class="header-actions"><button class="refresh-data install-action" id="installApp" type="button" aria-label="Installa MatchMind" title="Installa MatchMind" hidden><span class="action-symbol">'+icons.install+'</span><span>Installa</span></button><button class="refresh-data refresh-action" id="globalRefresh" type="button" aria-label="Aggiorna dati" title="Aggiorna dati"><span class="action-symbol">'+icons.refresh+'</span><span>Aggiorna</span></button></div></header><nav class="mobile-nav" aria-label="Navigazione principale">'+mobile+'</nav>';
  }
  function mountShell(active,title,subtitle){
    const header=$('siteHeader');if(header)header.innerHTML=nav(active);
    if(document.body.dataset.page==='match'){const back=document.createElement('button');back.className='detail-back';back.type='button';back.innerHTML='‹ <span>Torna alle partite</span>';back.addEventListener('click',()=>{if(history.length>1)history.back();else location.href='matches.html';});const main=document.querySelector('.page-wrap');if(main)main.prepend(back);}
    const titleEl=$('pageTitle');if(titleEl)titleEl.textContent=title||'MatchMind';
    const subEl=$('pageSubtitle');if(subEl)subEl.textContent=subtitle||'';
    $('globalRefresh')?.addEventListener('click',async()=>{const b=$('globalRefresh');b.disabled=true;b.classList.add('spinning');try{await loadData(true);location.reload();}catch(e){const s=$('globalStatus');if(s)s.textContent=e.message;}finally{b.disabled=false;b.classList.remove('spinning');}});
  }
  document.addEventListener('DOMContentLoaded',()=>{const page=document.body.dataset.page||'home';const active=page==='home'?'home':(page==='matches'||page==='match')?'matches':page==='league'?'league':page==='mind'?'mind':'more';mountShell(active,document.body.dataset.title||'MatchMind',document.body.dataset.subtitle||'');if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(reg=>reg.update().catch(()=>{})).catch(()=>{});let installPrompt=null;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;const b=$('installApp');if(b)b.hidden=false;});$('installApp')?.addEventListener('click',async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('installApp').hidden=true;});});
  window.MM={$,esc,norm,sameTeam,loadData,backtest,get data(){return data;},hasScore,upcoming,dateLabel,shortDate,matchUrl,teamUrl,teamInitials,badge,getTeams,groupByDate,standings,forecast,teamStats,probs,playerApi,isFavorite,toggleFavorite,seasonStart,formatNumber:(n,d=0)=>Number(n||0).toLocaleString('it-IT',{maximumFractionDigits:d}),status:m=>hasScore(m)?'Terminata':upcoming(m)?'In programma':'Da aggiornare'};
})();