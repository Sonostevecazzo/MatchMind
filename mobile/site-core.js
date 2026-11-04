/* MatchMind shared data and navigation layer. No forecast output is fabricated. */
(function(){
  const CACHE_KEY='matchmind-multipage-cache-v4-public-dataset';
  const COMPETITIONS={
    'serie-a':{id:'serie-a',name:'Serie A',country:'Italia',logo:135,apiLeague:135,fallback:'A'},
    'champions-league':{id:'champions-league',name:'Champions League',country:'UEFA',logo:2,apiLeague:2,fallback:'CL'}
  };
  function getSelectedCompetition(){
    const params=new URLSearchParams(location.search),requested=params.get('competition');
    if(COMPETITIONS[requested]){try{localStorage.setItem('matchmind-competition-v1',requested);}catch{}return requested;}
    try{const saved=localStorage.getItem('matchmind-competition-v1');if(COMPETITIONS[saved])return saved;}catch{}
    return 'serie-a';
  }
  function competitionInfo(value){const id=typeof value==='string'?value:value&&value.competition;return COMPETITIONS[id]||COMPETITIONS['serie-a'];}
  function filterCompetition(rows,competition=getSelectedCompetition()){const id=COMPETITIONS[competition]?competition:'serie-a';return (rows||[]).filter(m=>(m.competition||'serie-a')===id);}
  function forCompetition(value,competition=getSelectedCompetition()){return {...value,matches:filterCompetition(value&&value.matches,competition),history:filterCompetition(value&&value.history,competition),competition};}
  const $=id=>document.getElementById(id);
  const seasonStart=()=>{const d=new Date();return d.getMonth()>=6?d.getFullYear():d.getFullYear()-1};
  const seasonCode=y=>String(y).slice(-2)+String(y+1).slice(-2);
  function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function norm(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');}
  const num=v=>{if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null;};
  function readCache(){try{const own=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');return own&&Array.isArray(own.matches)?own:null;}catch{return null;}}
  let dataPromise=null,data={matches:[],history:[],season:seasonStart(),source:'openfootball',updatedAt:null};
  async function loadData(force=false){
    if(dataPromise&&!force)return dataPromise;
    dataPromise=(async()=>{
      const y=seasonStart(),cached=readCache();
      if(!force&&cached&&cached.season===y&&Array.isArray(cached.matches)&&cached.matches.length&&Date.now()-Number(cached.updatedAt||0)<15*60*1000){data=cached;return data;}
      const headers={Accept:'application/json'};
      const response=await fetch('./api/public-calendar',{headers:{Accept:'application/json'},cache:'no-store'});
      let payload={};try{payload=await response.json();}catch{}
      if(!response.ok||payload.error||payload.configured===false){
        const message=payload.error||'Fonte pubblica openfootball non disponibile.';
        if(cached&&cached.matches?.length){data={...cached,source:'cache · openfootball',stale:true,error:message};return data;}
        throw new Error(message);
      }
      if(!Array.isArray(payload.matches)||!payload.matches.length)throw new Error('Il dataset pubblico non ha restituito partite per questa stagione.');
      data={matches:payload.matches,history:Array.isArray(payload.history)?payload.history:[],season:payload.season||y,source:'openfootball',updatedAt:Date.now(),sourceMode:'public-dataset'};
      try{localStorage.setItem(CACHE_KEY,JSON.stringify(data));}catch{}
      return data;
    })().catch(error=>{dataPromise=null;throw error;});
    return dataPromise;
  }
  const TEAM_ALIASES=[
    ['inter','internazionale','intermilan','internazionalemilano','fcinternazionalemilano'],
    ['milan','acmilan','acmilan1899'],
    ['verona','hellasverona','hellasveronafc'],
    ['roma','asroma','asromafc'],
    ['lazio','sslazio'],
    ['juventus','juve','juventusfc'],
    ['napoli','sscnapoli'],
    ['fiorentina','acffiorentina'],
    ['sassuolo','ussassuolo'],
    ['cagliari','cagliaricalcio'],
    ['udinese','udinesecalcio'],
    ['torino','torinofc','torinofc1906'],
    ['genoa','genoacfc','genoacfc1893'],
    ['parma','parmacalcio','parmacalcio1913'],
    ['lecce','uslecce'],
    ['pisa','pisasc','pisasportingclub'],
    ['atalanta','atalantabc','atalantabergamasca','atalantabergamascacalcio'],
    ['bologna','bolognafc','bolognafc1909'],
    ['como','como1907'],
    ['cremonese','uscremonese'],
    ['empoli','empolifc','empolifc1920'],
    ['monza','acmonza','monza1912'],
    ['venezia','veneziafc'],
    ['sampdoria','ucsampdoria'],
    ['frosinone','frosinonecalcio'],
    ['salernitana','ussalernitana1919'],
    ['aek','aekathens','aekathensfc'],
    ['arsenal','arsenalfc'],
    ['astonvilla','astonvillafc'],
    ['atleti','atleticodemadrid','atleticomadrid','clubatleticodemadrid'],
    ['barcelona','fcbarcelona'],
    ['bayernmuenchen','bayernmunchen','bayernmunich','fcbayernmunchen'],
    ['benfica','slbenfica','sportlisboaebenfica'],
    ['bodoglimt','bodglimt','fkbodoglimt'],
    ['borussiadortmund','dortmund','bdortmund'],
    ['clubbrugge','clubbruggekv'],
    ['fenerbahce','fenerbahcesk'],
    ['feyenoord','feyenoordrotterdam'],
    ['galatasaray','galatasaraysk'],
    ['lask','lasklinz','linzerask'],
    ['leipzig','rbleipzig'],
    ['lille','losclille','lilleosc'],
    ['lens','rclens'],
    ['liverpool','liverpoolfc'],
    ['manchestercity','mancity','mancityfc'],
    ['manchesterunited','manutd','manutdfc'],
    ['newcastle','newcastleunited','newcastleunitedfc'],
    ['paris','psg','parissaintgermain','parissaintgermainfc'],
    ['porto','fcporto'],
    ['psv','psveindhoven'],
    ['realbetis','betis','realbetisbalompie'],
    ['realmadrid','realmadridcf'],
    ['sabah','sabahfk'],
    ['shakhtar','shakhtardonetsk','fcshakhtardonetsk'],
    ['slaviapraha','slaviaprague','skslaviapraha'],
    ['slovanbratislava','skslovanbratislava','sslovanbratislava','sbratislava'],
    ['sportingcp','sportingclubedeportugal','sportinglisbon'],
    ['stuttgart','vfbstuttgart'],
    ['viking','vikingfk'],
    ['villarreal','villarrealcf']
  ];
  const sameTeam=(a,b)=>{
    const x=norm(a),y=norm(b);
    if(!x||!y)return false;
    if(x===y)return true;
    return TEAM_ALIASES.some(group=>group.includes(x)&&group.includes(y));
  };
  const hasScore=m=>m&&m.hg!==null&&m.hg!==undefined&&m.ag!==null&&m.ag!==undefined&&Number.isFinite(Number(m.hg))&&Number.isFinite(Number(m.ag));
  const dateLabel=m=>{if(!m||!m.date)return 'Data da definire';const d=new Date(m.date+'T12:00:00');return d.toLocaleDateString('it-IT',{weekday:'long',day:'2-digit',month:'long'})+(m.time?' · '+m.time:'');};
  const shortDate=m=>{if(!m||!m.date)return 'Data da definire';return new Date(m.date+'T12:00:00').toLocaleDateString('it-IT',{weekday:'short',day:'2-digit',month:'short'});};
  const upcoming=m=>{if(hasScore(m)||!m.date)return false;const time=/^\d{1,2}:\d{2}$/.test(String(m.time||''))?m.time:'23:59';const kickoff=new Date(m.date+'T'+time+':00').getTime();return Number.isFinite(kickoff)&&kickoff>=Date.now();};
  const matchUrl=m=>'match.html?date='+encodeURIComponent(m.date)+'&home='+encodeURIComponent(m.home)+'&away='+encodeURIComponent(m.away)+'&competition='+encodeURIComponent(m.competition||'serie-a');
  const teamUrl=name=>'team.html?team='+encodeURIComponent(name)+'&competition='+encodeURIComponent(getSelectedCompetition());
  const playerUrl='players.html';
  function teamInitials(name){return String(name||'?').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase().slice(0,2);}
  function teamColor(name){let n=0;for(const c of String(name||''))n=(n*31+c.charCodeAt(0))|0;return 'hsl('+Math.abs(n)%360+' 35% 28%)';}
  const TEAM_LOGOS={atalanta:499,bologna:500,cagliari:490,como:895,cremonese:520,frosinone:512,fiorentina:502,genoa:495,inter:505,internazionale:505,juventus:496,lazio:487,lecce:867,milan:489,monza:1579,napoli:492,parma:523,pisa:4177,roma:497,sassuolo:488,torino:503,udinese:494,venezia:517,verona:504,hellasverona:504,aek:575,aekathens:575,aekathensfc:575,arsenal:42,astonvilla:66,atleti:530,atleticodemadrid:530,barcelona:529,fcbarcelona:529,bayernmuenchen:157,bayernmunchen:157,bayernmunich:157,fcbayernmunchen:157,bdortmund:165,borussiadortmund:165,dortmund:165,bodglimt:327,bodoglimt:327,fkbodoglimt:327,clubbrugge:569,clubbruggekv:569,fenerbahce:611,fenerbahcesk:611,feyenoord:209,feyenoordrotterdam:209,galatasaray:645,galatasaraysk:645,lask:1026,lasklinz:1026,linzerask:1026,leipzig:173,rbleipzig:173,lens:116,rclens:116,lille:79,lilleosc:79,losclille:79,liverpool:40,liverpoolfc:40,mancity:50,mancityfc:50,manchestercity:50,manutd:33,manutdfc:33,manchesterunited:33,paris:85,psg:85,parissaintgermain:85,parissaintgermainfc:85,porto:212,fcporto:212,realbetis:543,betis:543,realbetisbalompie:543,realmadrid:541,realmadridcf:541,sbratislava:656,slovanbratislava:656,skslovanbratislava:656,sslovanbratislava:656,shakhtar:550,shakhtardonetsk:550,fcshakhtardonetsk:550,slaviapraha:560,slaviaprague:560,skslaviapraha:560,sportingcp:228,sportingclubedeportugal:228,sportinglisbon:228,stuttgart:172,vfbstuttgart:172,viking:759,vikingfk:759,villarreal:533,villarrealcf:533,psv:197,psveindhoven:197,sabah:"https://a.espncdn.com/i/teamlogos/soccer/500/21922.png"};
  function logoId(name){const k=norm(name);if(TEAM_LOGOS[k])return TEAM_LOGOS[k];for(const [alias,id] of Object.entries(TEAM_LOGOS)){if(k===alias||k.includes(alias)||alias.includes(k))return id;}return null;}
  function badge(name){const id=logoId(name),src=typeof id==='number'?'https://media.api-sports.io/football/teams/'+id+'.png':id,fallback=esc(teamInitials(name));return '<span class="team-crest">'+(src?'<img class="team-logo" src="'+esc(src)+'" alt="" loading="lazy" decoding="async" onload="this.nextElementSibling.hidden=true" onerror="this.remove()">':'')+'<span class="team-crest-fallback">'+fallback+'</span></span>';}
  function getTeams(rows){return [...new Set(rows.flatMap(m=>[m.home,m.away]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'it'));}
  function groupByDate(rows){const map=new Map();rows.forEach(m=>{const k=m.date||'unknown';if(!map.has(k))map.set(k,[]);map.get(k).push(m);});return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0]));}
  function standings(rows){
    const map=new Map(),get=name=>{const k=norm(name);if(!map.has(k))map.set(k,{name,played:0,w:0,d:0,l:0,gf:0,ga:0,pts:0});return map.get(k);};
    rows.filter(hasScore).forEach(m=>{const h=get(m.home),a=get(m.away),hg=Number(m.hg),ag=Number(m.ag);h.played++;a.played++;h.gf+=hg;h.ga+=ag;a.gf+=ag;a.ga+=hg;if(hg>ag){h.w++;a.l++;h.pts+=3;}else if(hg<ag){a.w++;h.l++;a.pts+=3;}else{h.d++;a.d++;h.pts++;a.pts++;}});
    return [...map.values()].map(t=>({...t,gd:t.gf-t.ga})).sort((a,b)=>b.pts-a.pts||b.gd-a.gd||b.gf-a.gf||a.name.localeCompare(b.name,'it'));
  }
  function poisson(l,g){if(l<=0)return g===0?1:0;let p=Math.exp(-l);for(let i=1;i<=g;i++)p*=l/i;return p;}
  function probs(lh,la){let h=0,d=0,a=0,btts=0,o15=0,o25=0,o35=0,total=0;for(let x=0;x<=30;x++)for(let y=0;y<=30;y++){const p=poisson(lh,x)*poisson(la,y);total+=p;if(x>y)h+=p;else if(x===y)d+=p;else a+=p;if(x>0&&y>0)btts+=p;if(x+y>=2)o15+=p;if(x+y>=3)o25+=p;if(x+y>=4)o35+=p;}return{home:h/total,draw:d/total,away:a/total,btts:btts/total,o15:o15/total,o25:o25/total,o35:o35/total};}
  function teamStats(team,rows){const list=(rows||[]).filter(m=>hasScore(m)&&(sameTeam(m.home,team)||sameTeam(m.away,team))).sort((a,b)=>a.date.localeCompare(b.date)).slice(-10);if(!list.length)return{played:0,for:1.25,against:1.25,form:[]};let gf=0,ga=0;const isHome=m=>sameTeam(m.home,team);for(const m of list){const home=isHome(m);gf+=home?Number(m.hg):Number(m.ag);ga+=home?Number(m.ag):Number(m.hg);}return{played:list.length,for:gf/list.length,against:ga/list.length,form:list.slice(-5).map(m=>{const x=Number(m.hg),y=Number(m.ag),home=isHome(m);return(home?x>y:y>x)?'W':x===y?'D':'L';})};}
  function forecast(match,history){const competition=match&&match.competition||'serie-a';const hist=(history||[]).filter(x=>hasScore(x)&&x.date<match.date&&(x.competition||'serie-a')===competition);const league=hist.length?hist.reduce((s,x)=>s+Number(x.hg),0)/hist.length:1.35;const awayLeague=hist.length?hist.reduce((s,x)=>s+Number(x.ag),0)/hist.length:1.1;const h=teamStats(match.home,hist),a=teamStats(match.away,hist);const homeXg=Math.max(.15,Math.min(4.5,league*((h.for+.7)/(league+.7))*((a.against+.7)/(awayLeague+.7))*1.06));const awayXg=Math.max(.15,Math.min(4.5,awayLeague*((a.for+.7)/(awayLeague+.7))*((h.against+.7)/(league+.7))));const dates=hist.map(m=>m.date).filter(Boolean).sort();const scoreMatrix=[];let matrixMass=0;for(let homeGoals=0;homeGoals<=5;homeGoals++)for(let awayGoals=0;awayGoals<=5;awayGoals++){const probability=poisson(homeXg,homeGoals)*poisson(awayXg,awayGoals);matrixMass+=probability;scoreMatrix.push({homeGoals,awayGoals,probability});}return{historyCount:hist.length,historyStart:dates[0]||null,historyEnd:dates.at(-1)||null,home:h,away:a,homeXg,awayXg,probabilities:probs(homeXg,awayXg),scoreMatrix,scoreMatrixTail:Math.max(0,1-matrixMass),sampleEnough:h.played>=10&&a.played>=10};}
  function eventForecast(match,history){
    const before=String(match&&match.date||''),competition=match&&match.competition||'serie-a';
    const samples=(team,venue,field,max=8)=>{
      const values=(history||[]).filter(m=>(m.competition||'serie-a')===competition&&hasScore(m)&&m.date&&m.date<before&&sameTeam(m[venue],team)&&Number.isFinite(m[field])&&m[field]>=0&&m[field]<=40)
        .sort((a,b)=>a.date.localeCompare(b.date)).slice(-max).map(m=>m[field]);
      return {count:values.length,mean:values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null};
    };
    const blend=(left,right,min=5)=>{
      if(left.count<min||right.count<min)return {available:false,expected:null,samples:[left.count,right.count],required:min};
      return {available:true,expected:(left.mean+right.mean)/2,samples:[left.count,right.count],required:min};
    };
    const hh={corners:samples(match.home,'home','hc'),cornersAgainst:samples(match.home,'home','ac'),yellow:samples(match.home,'home','hy'),yellowAgainst:samples(match.home,'home','ay'),htFor:samples(match.home,'home','ht'),htAgainst:samples(match.home,'home','at')};
    const aa={corners:samples(match.away,'away','ac'),cornersAgainst:samples(match.away,'away','hc'),yellow:samples(match.away,'away','ay'),yellowAgainst:samples(match.away,'away','hy'),htFor:samples(match.away,'away','at'),htAgainst:samples(match.away,'away','ht')};
    const cornersHome=blend(hh.corners,aa.cornersAgainst),cornersAway=blend(aa.corners,hh.cornersAgainst);
    const cardsHome=blend(hh.yellow,aa.yellowAgainst),cardsAway=blend(aa.yellow,hh.yellowAgainst);
    const halfHome=blend(hh.htFor,aa.htAgainst),halfAway=blend(aa.htFor,hh.htAgainst);
    const corners={available:cornersHome.available&&cornersAway.available,home:cornersHome.expected,away:cornersAway.expected,total:cornersHome.available&&cornersAway.available?cornersHome.expected+cornersAway.expected:null,samples:{home:cornersHome.samples,away:cornersAway.samples},required:5};
    const yellowCards={available:cardsHome.available&&cardsAway.available,home:cardsHome.expected,away:cardsAway.expected,total:cardsHome.available&&cardsAway.available?cardsHome.expected+cardsAway.expected:null,samples:{home:cardsHome.samples,away:cardsAway.samples},required:5};
    const halfTime={available:halfHome.available&&halfAway.available,homeXg:halfHome.expected,awayXg:halfAway.expected,probabilities:halfHome.available&&halfAway.available?probs(halfHome.expected,halfAway.expected):null,samples:{home:halfHome.samples,away:halfAway.samples},required:5};
    return {corners,yellowCards,halfTime,method:'Medie per sede (ultime 8 gare disponibili)',asOf:before,experimental:true};
  }
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
  async function playerApi(query,key,ttl=21600000){const cache=localCache('matchmind-player-cache-v1'),item=cache[key];if(item&&Date.now()-item.at<ttl)return item.data;const headers={Accept:'application/json'};try{const keys=[['matchmind-api-football-session-key','X-MatchMind-API-Key'],['matchmind-oddspapi-session-key','X-MatchMind-OddsPapi-Key']];keys.forEach(([storage,header])=>{const value=sessionStorage.getItem(storage);if(value)headers[header]=value;});}catch{}const res=await fetch('./api/player-context?'+query,{headers,cache:'no-store'});let body;try{body=await res.json();}catch{throw new Error('Risposta non valida dal servizio dati.');}if(!res.ok)throw new Error(body.error||'Errore nel recupero dati.');if(body.configured===false||body.error)throw new Error(body.error||'Fonte dati non configurata.');cache[key]={at:Date.now(),data:body};saveCache('matchmind-player-cache-v1',cache);return body;}
  const isFavorite=name=>{try{return (JSON.parse(localStorage.getItem('matchmind-favorites-v1')||'[]')).includes(name);}catch{return false;}};
  function toggleFavorite(name){const list=(()=>{try{return JSON.parse(localStorage.getItem('matchmind-favorites-v1')||'[]');}catch{return [];}})();const next=list.includes(name)?list.filter(x=>x!==name):[...list,name];saveCache('matchmind-favorites-v1',next);return next.includes(name);}
  function nav(active){
    const icons={
      home:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg>',
      matches:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M7 2v4m10-4v4M3 9h18m-13 4h3m-3 4h6"/></svg>',
      league:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 7.5v9L12 21 4 16.5v-9L12 3Z"/><path d="m4.5 8 7.5 4 7.5-4M12 12v8.5M8.5 5l3.5 4 3.5-4"/></svg>',
      mind:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5m0 14h16M7 15l4-4 3 2 5-7"/><path d="M16 6h3v3"/></svg>',
      bets:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/><path d="M8 8h8M8 12h5m-5 4h8"/></svg>',
      more:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>',
      refresh:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.6 9a7 7 0 0 1 11.7-2L20 12M4 12l2.7 5a7 7 0 0 0 11.7-2"/></svg>',
      install:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 20h16"/></svg>'
    };
    const links=[
      ['index.html','home','Home'],
      ['analysis-lab.html','mind','Analisi'],
      ['bets.html','bets','Scommesse'],
      ['explore.html','more','Altro']
    ];
    const mobile=links.map(([href,key,label])=>'<a class="nav-item '+(active===key?'active':'')+'" href="'+href+'" '+(active===key?'aria-current="page"':'')+'><span class="nav-icon">'+icons[key]+'</span><span>'+label+'</span></a>').join('');
    const desktop=links.map(([href,key,label])=>'<a class="'+(active===key?'active':'')+'" href="'+href+'" '+(active===key?'aria-current="page"':'')+'>'+label+'</a>').join('');
    return '<header class="site-header"><a class="brand-link" href="index.html" aria-label="MatchMind Home"><span class="brand-mark"><span>M</span></span><span class="brand-copy"><b>MatchMind</b><small>FOOTBALL INTELLIGENCE</small></span></a><nav class="desktop-nav" aria-label="Navigazione principale">'+desktop+'</nav><div class="header-actions"><button class="refresh-data install-action" id="installApp" type="button" aria-label="Installa MatchMind" title="Installa MatchMind" hidden><span class="action-symbol">'+icons.install+'</span><span>Installa</span></button><button class="refresh-data refresh-action" id="globalRefresh" type="button" aria-label="Aggiorna dati" title="Aggiorna dati"><span class="action-symbol">'+icons.refresh+'</span><span>Aggiorna</span></button></div></header><nav class="mobile-nav" aria-label="Navigazione principale">'+mobile+'</nav>';
  }
  function mountShell(active,title,subtitle){
    const header=$('siteHeader');if(header)header.innerHTML=nav(active);
    if(document.body.dataset.page==='match'){const back=document.createElement('button');back.className='detail-back';back.type='button';back.innerHTML='‹ <span>Torna alle partite</span>';back.addEventListener('click',()=>{if(history.length>1)history.back();else location.href='index.html#matchesSection';});const main=document.querySelector('.page-wrap');if(main)main.prepend(back);}
    const titleEl=$('pageTitle');if(titleEl)titleEl.textContent=title||'MatchMind';
    const subEl=$('pageSubtitle');if(subEl)subEl.textContent=subtitle||'';
    const intro=document.querySelector('.page-intro');
    if(intro&&!$('competitionSelect')){
      const field=document.createElement('div');field.className='field competition-picker';
      const label=document.createElement('label');label.htmlFor='competitionSelect';label.textContent='Competizione';
      const select=document.createElement('select');select.id='competitionSelect';
      Object.values(COMPETITIONS).forEach(item=>{const option=document.createElement('option');option.value=item.id;option.textContent=item.name;select.appendChild(option);});
      select.value=getSelectedCompetition();field.append(label,select);intro.appendChild(field);
      select.addEventListener('change',()=>{try{localStorage.setItem('matchmind-competition-v1',select.value);}catch{};const page=document.body.dataset.page;if(page==='match'||page==='team'){const target=page==='match'?'index.html':'explore.html';location.href=target+'?competition='+encodeURIComponent(select.value)+(page==='match'?'#matchesSection':'');}else{const url=new URL(location.href);url.searchParams.delete('import');url.searchParams.set('competition',select.value);location.href=url.toString();}});
    }
    $('globalRefresh')?.addEventListener('click',async()=>{const b=$('globalRefresh');b.disabled=true;b.classList.add('spinning');try{await loadData(true);location.reload();}catch(e){const s=$('globalStatus');if(s)s.textContent=e.message;}finally{b.disabled=false;b.classList.remove('spinning');}});
  }
  document.addEventListener('DOMContentLoaded',()=>{const page=document.body.dataset.page||'home';const active=page==='home'?'home':(page==='matches'||page==='match'||page==='league')?'home':page==='mind'?'mind':page==='bets'?'bets':'more';mountShell(active,document.body.dataset.title||'MatchMind',document.body.dataset.subtitle||'');if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(reg=>reg.update().catch(()=>{})).catch(()=>{});let installPrompt=null;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;const b=$('installApp');if(b)b.hidden=false;});$('installApp')?.addEventListener('click',async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('installApp').hidden=true;});const refreshIfStale=()=>{if(document.visibilityState!=='visible')return;const active=document.activeElement;if(active&&active.matches('input,textarea,select,[contenteditable="true"]'))return;let last=0;try{last=Number(sessionStorage.getItem('matchmind-last-auto-refresh')||0);}catch{}if(Date.now()-last<10*60*1000)return;try{sessionStorage.setItem('matchmind-last-auto-refresh',String(Date.now()));}catch{}location.reload();};window.setInterval(refreshIfStale,60*1000);document.addEventListener('visibilitychange',refreshIfStale);});
  window.MM={$,esc,norm,sameTeam,loadData,backtest,getSelectedCompetition,competitionInfo,filterCompetition,forCompetition,get data(){return data;},hasScore,upcoming,dateLabel,shortDate,matchUrl,teamUrl,teamInitials,badge,getTeams,groupByDate,standings,forecast,eventForecast,teamStats,probs,playerApi,isFavorite,toggleFavorite,seasonStart,formatNumber:(n,d=0)=>Number(n||0).toLocaleString('it-IT',{maximumFractionDigits:d}),status:m=>hasScore(m)?'Terminata':upcoming(m)?'In programma':'Da aggiornare'};
})();