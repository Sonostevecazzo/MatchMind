/* MatchMind shared data and navigation layer. No forecast output is fabricated. */
(function(){
  const CACHE_KEY='matchmind-multipage-cache-v5-open-matchday';
  const COMPETITIONS={ 'serie-a':{id:'serie-a',name:'Serie A',country:'Italia',logo:null,fallback:'A'}, 'champions-league':{id:'champions-league',name:'Champions League',country:'UEFA',logo:null,fallback:'CL'}, 'europa-league':{id:'europa-league',name:'Europa League',country:'UEFA',logo:null,fallback:'EL'} };
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
  const forecastMemo=new Map();
  function trainAvailableModels(history){if(!window.MatchMindAI)return;for(const competition of Object.keys(COMPETITIONS))window.MatchMindAI.train(history,(match,prior)=>forecast(match,prior,{__skipAI:true}),competition);}
  const DATA_ROOT='https://raw.githubusercontent.com/oladeeayo/open-matchday/master/data/';
  const HISTORY_ROOT='https://raw.githubusercontent.com/openfootball/football.json/master/';
  const LEAGUE_SOURCES=[
    {id:'serie-a',folder:'ITA_1_serie-a',history:true},
    {id:'champions-league',folder:'UEFA_1_champions-league',history:false},
    {id:'europa-league',folder:'UEFA_1_europa-league',history:false}
  ];

  function parseCsvRows(input){
    const rows=[];let row=[],field='',quoted=false;
    for(let i=0;i<input.length;i++){
      const ch=input[i];
      if(quoted){
        if(ch==='"'&&input[i+1]==='"'){field+='"';i++;}
        else if(ch==='"')quoted=false;
        else field+=ch;
      }else if(ch==='"')quoted=true;
      else if(ch===','){row.push(field);field='';}
      else if(ch==='\n'){row.push(field.replace(/\r$/,''));if(row.some(x=>x!==''))rows.push(row);row=[];field='';}
      else field+=ch;
    }
    if(field!==''||row.length){row.push(field.replace(/\r$/,''));rows.push(row);}
    if(!rows.length)return[];
    const headers=rows.shift();
    return rows.map(values=>Object.fromEntries(headers.map((key,index)=>[key,values[index]??''])));
  }

  function normalizeMatchRow(row,competition,finished){
    const hg=num(row.ft_home),ag=num(row.ft_away),done=finished&&hg!==null&&ag!==null;
    return {
      id:null,date:String(row.date||''),time:String(row.time||''),round:num(row.gw),
      stage:row.gw?'Giornata '+row.gw:'',home:String(row.home||''),away:String(row.away||''),
      hg:done?hg:null,ag:done?ag:null,ht:num(row.ht_home),at:num(row.ht_away),
      hs:num(row.home_shots),as:num(row.away_shots),hst:num(row.home_target),ast:num(row.away_target),
      hf:num(row.home_fouls),af:num(row.away_fouls),hc:num(row.home_corners),ac:num(row.away_corners),
      hc1:num(row.home_corners_1h),ac1:num(row.away_corners_1h),hc2:num(row.home_corners_2h),ac2:num(row.away_corners_2h),
      hy:num(row.home_yellow),ay:num(row.away_yellow),hr:num(row.home_red),ar:num(row.away_red),
      goalMinutes:String(row.goal_minutes||''),status:done?'FT':'NS',statusLong:done?'Terminata':'In programma',
      competition,source:'open-matchday'
    };
  }

  async function fetchDirectCalendar(){
    const y=seasonStart(),code=seasonCode(y);
    const jobs=LEAGUE_SOURCES.map(async league=>{
      const base=DATA_ROOT+league.folder+'/';
      const [resultsCsv,fixturesCsv]=await Promise.all([
        fetch(base+'results_'+code+'.csv',{signal:AbortSignal.timeout(15000)}).then(r=>r.ok?r.text():'').catch(()=>''),
        fetch(base+'fixtures_'+code+'.csv',{signal:AbortSignal.timeout(15000)}).then(r=>r.ok?r.text():'').catch(()=>'')
      ]);
      const results=resultsCsv?parseCsvRows(resultsCsv).map(r=>normalizeMatchRow(r,league.id,true)).filter(m=>m.date&&m.home&&m.away):[];
      const fixtures=fixturesCsv?parseCsvRows(fixturesCsv).map(r=>normalizeMatchRow(r,league.id,false)).filter(m=>m.date&&m.home&&m.away):[];
      return {league,results,fixtures};
    });
    const settled=await Promise.allSettled(jobs);
    const matches=[],history=[];
    for(let i=0;i<settled.length;i++){
      const s=settled[i];
      if(s.status==='fulfilled'){
        matches.push(...s.value.results,...s.value.fixtures);
        history.push(...s.value.results);
      }
    }
    const histJobs=[y-1,y-2,y-3].map(async year=>{
      const folder=year+'-'+String(year+1).slice(-2);
      const res=await fetch(HISTORY_ROOT+folder+'/it.1.json',{signal:AbortSignal.timeout(15000)}).catch(()=>null);
      if(!res||!res.ok)return [];
      const payload=await res.json().catch(()=>({}));
      return (payload.matches||[]).map(row=>{
        const ft=row.score?.ft||null,ht=row.score?.ht||null,done=Array.isArray(ft)&&ft.length>=2&&ft[0]!==null&&ft[1]!==null;
        return {
          id:null,date:String(row.date||''),time:String(row.time||''),round:num(String(row.round||'').match(/\d+/)?.[0]),
          stage:String(row.round||''),home:String(row.team1||''),away:String(row.team2||''),
          hg:done?num(ft[0]):null,ag:done?num(ft[1]):null,ht:Array.isArray(ht)?num(ht[0]):null,at:Array.isArray(ht)?num(ht[1]):null,
          hs:null,as:null,hst:null,ast:null,hf:null,af:null,hc:null,ac:null,hy:null,ay:null,hr:null,ar:null,
          status:done?'FT':'NS',statusLong:done?'Terminata':'In programma',competition:'serie-a',source:'openfootball · archivio storico'
        };
      }).filter(m=>m.date&&m.home&&m.away&&m.hg!==null&&m.ag!==null);
    });
    const histSettled=await Promise.allSettled(histJobs);
    histSettled.forEach(r=>{if(r.status==='fulfilled')history.push(...r.value);});

    matches.sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||'')));
    history.sort((a,b)=>a.date.localeCompare(b.date));

    if(!matches.length)throw new Error('I dataset pubblici non contengono partite accessibili per questa stagione.');
    return {
      matches,history,season:y,
      source:'open-matchday + openfootball',
      updatedAt:Date.now(),
      sourceMode:'public-dataset-direct'
    };
  }

  async function loadData(force=false){
    if(dataPromise&&!force)return dataPromise;
    dataPromise=(async()=>{
      const y=seasonStart(),cached=readCache();
      if(!force&&cached&&cached.season===y&&Array.isArray(cached.matches)&&cached.matches.length&&Date.now()-Number(cached.updatedAt||0)<15*60*1000){data=cached;return data;}
      let payload=null;
      try{
        const response=await fetch('./api/public-calendar',{headers:{Accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(25000)});
        if(response.ok){
          const body=await response.json().catch(()=>null);
          if(body&&Array.isArray(body.matches)&&body.matches.length)payload=body;
        }
      }catch(_){}

      if(!payload){
        try{
          payload=await fetchDirectCalendar();
        }catch(directErr){
          if(cached&&cached.matches?.length){
            data={...cached,source:'cache · openfootball',stale:true,error:directErr.message};
            return data;
          }
          throw new Error(directErr.message||'Fonte pubblica openfootball non disponibile.');
        }
      }

      data={
        matches:payload.matches,
        history:Array.isArray(payload.history)?payload.history:[],
        season:payload.season||y,
        source:payload.source||'openfootball',
        updatedAt:Date.now(),
        sourceMode:payload.sourceMode||'public-dataset'
      };
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
    ['villarreal','villarrealcf'],
    ['omonia','omonianicosia','acomonianicosia','omoniafc','acomonianicosiafc'],
    ['hapoelbeersheva','hapoelbeershevafc','hapoelbeershevafootballclub']
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
  const playerUrl=null;
  function teamInitials(name){return String(name||'?').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase().slice(0,2);}
  function teamColor(name){let n=0;for(const c of String(name||''))n=(n*31+c.charCodeAt(0))|0;return 'hsl('+Math.abs(n)%360+' 35% 28%)';}
  // Club crests are presentation assets, independent from the retired API-Football data feed.
  const LOGO_ROOT='https://raw.githubusercontent.com/JoseArroyave/football-logos/main/logos/';
  const TEAM_LOGOS={
    internazionale:'italy/Inter.svg',inter:'italy/Inter.svg',intermilan:'italy/Inter.svg',
    monza:'italy/AC_Monza.svg',udinese:'italy/Udinese.svg',como:'italy/Como_1907.svg',como1907:'italy/Como_1907.svg',
    genoa:'italy/Genoa.svg',napoli:'italy/Napoli.svg',parma:'italy/Parma.svg',cagliari:'italy/Cagliari.svg',
    frosinone:'italy/Frosinone_Calcio.svg',juventus:'italy/Juventus.svg',juventusturin:'italy/Juventus.svg',juve:'italy/Juventus.svg',juventusturin:'italy/Juventus.svg',venezia:'italy/Venezia.svg',
    lecce:'italy/Lecce.svg',atalanta:'italy/Atalanta.svg',sassuolo:'italy/Sassuolo.svg',
    torino:'italy/Torino.svg',milan:'italy/Milan.svg',fiorentina:'italy/Fiorentina.svg',
    bologna:'italy/Bologna.svg',lazio:'italy/Lazio.svg',roma:'italy/Roma.svg',hellasverona:'italy/Hellas_Verona.svg',
    arsenal:'england/Arsenal.svg',astonvilla:'england/Aston_Villa.svg',liverpool:'england/Liverpool_FC.svg',
    manchestercity:'england/Manchester_City.svg',mancity:'england/Manchester_City.svg',
    manchesterunited:'england/Manchester_United.svg',manutd:'england/Manchester_United.svg',
    newcastle:'england/Newcastle_United.svg',atleti:'spain/Atletico_Madrid.svg',
    atleticodemadrid:'spain/Atletico_Madrid.svg',barcelona:'spain/Barcelona.svg',
    villarreal:'spain/Villarreal.svg',realbetis:'spain/Real_Betis.svg',betis:'spain/Real_Betis.svg',
    realmadrid:'spain/Real_Madrid.svg',bayernmunchen:'germany/Bayern_München.svg',
    bayernmunich:'germany/Bayern_Munich.svg',borussiadortmund:'germany/Borussia_Dortmund.svg',bdortmund:'germany/Borussia_Dortmund.svg',
    dortmund:'germany/Borussia_Dortmund.svg',leipzig:'germany/RB_Leipzig.svg',
    rbleipzig:'germany/RB_Leipzig.svg',stuttgart:'germany/VfB_Stuttgart.svg',
    lille:'france/Lille.svg',lens:'france/RC_Lens.svg',psg:'france/Paris_Saint-Germain_(PSG).svg',
    paris:'france/Paris_Saint-Germain_(PSG).svg',porto:'portugal/FC_Porto.svg',
    benfica:'portugal/Benfica.svg',sportingcp:'portugal/Sporting_CP.svg',
    feyenoord:'netherlands/Feyenoord.svg',psv:'netherlands/PSV_Eindhoven.svg',
    galatasaray:'turkey/Galatasaray.svg',fenerbahce:'turkey/Fenerbahçe.svg',
    lask:'austria/LASK.svg',bodoglimt:'norway/BodøGlimt.svg',bodglimt:'norway/BodøGlimt.svg',viking:'norway/Viking_FK.svg',
    slovanbratislava:'slovakia/Slovan_Bratislava.svg',sbratislava:'slovakia/Slovan_Bratislava.svg',
    aek:'greece/AEK_Athens.svg',aekathens:'greece/AEK_Athens.svg',
    clubbrugge:'belgium/Club_Brugge.svg',shakhtar:'ukraine/Shakhtar.svg',shakhtardonetsk:'ukraine/Shakhtar.svg',
    slaviapraha:'czech-republic/SK_Slavia_Praha.svg',slaviaprague:'czech-republic/SK_Slavia_Praha.svg',
    milan:'italy/Milan.svg',juventus:'italy/Juventus.svg',
    crystalpalace:'england/Crystal_Palace.svg',sunderland:'england/Sunderland.svg',bournemouth:'england/Bournemouth.svg',
    lyon:'france/Olympique_Lyonnais.svg',marseille:'france/Marseille.svg',rennes:'france/Rennes.svg',
    leverkusen:'germany/Bayer_Leverkusen.svg',hoffenheim:'germany/Hoffenheim.svg',
    salzburg:'austria/Salzburg.svg',sturmgraz:'austria/Sturm_Graz.svg',
    anderlecht:'belgium/RSC_Anderlecht.svg',unionsg:'belgium/Union_Saint-Gilloise.svg',
    azalkmaar:'netherlands/AZ_Alkmaar.svg',nec:'netherlands/N.E.C._Nijmegen.svg',
    celtic:'scotland/Celtic.svg',
    besiktas:'turkey/Beşiktaş.svg',
    olympiacos:'greece/Olympiacos.svg',oficrete:'greece/OFI.svg',
    ferencvaros:'hungary/Ferencváros.svg',
    dynamozagreb:'croatia/GNK_Dinamo_Zagreb.svg',gnkdinamo:'croatia/GNK_Dinamo_Zagreb.svg',
    realsociedad:'spain/Real_Sociedad.svg',celta:'spain/Celta.svg',
    lechpoznan:'poland/Lech_Poznań.svg',jagiellonia:'poland/Jagiellonia_Białystok.svg',
    viktoriaplzen:'czech-republic/Viktoria_Plzeň.svg',spartapraha:'czech-republic/AC_Sparta_Praha.svg',
    necnijmegen:'netherlands/N.E.C._Nijmegen.svg',
    unionsaintgilloise:'belgium/Union_Saint-Gilloise.svg',unionstgilloise:'belgium/Union_Saint-Gilloise.svg',
    araratarmenia:'armenia/Ararat-Armenia.svg',
    levskisofia:'bulgaria/Levski_Sofia.svg',
    torreense:'portugal/S.C.U._Torreense.svg',sctorreense:'portugal/S.C.U._Torreense.svg',celje:'slovenia/Celje.svg',nkcelje:'slovenia/Celje.svg',
    lillestrom:'norway/Lillestrøm.svg',lillestrm:'norway/Lillestrøm.svg',
    sabah:'azerbaijan/Sabah.svg',
    omonia:'https://assets.footylogos.com/logos/ac-omonia-nicosia/ac-omonia-nicosia-logo-footylogos.svg',
    omonianicosia:'https://assets.footylogos.com/logos/ac-omonia-nicosia/ac-omonia-nicosia-logo-footylogos.svg',
    acomonianicosia:'https://assets.footylogos.com/logos/ac-omonia-nicosia/ac-omonia-nicosia-logo-footylogos.svg',
    hapoelbeersheva:'https://assets.footylogos.com/logos/hapoel-beer-sheva/hapoel-beer-sheva-logo-footylogos.svg',
    hapoelbeershevafc:'https://assets.footylogos.com/logos/hapoel-beer-sheva/hapoel-beer-sheva-logo-footylogos.svg',
    hapoelbeershevafootballclub:'https://assets.footylogos.com/logos/hapoel-beer-sheva/hapoel-beer-sheva-logo-footylogos.svg',
    bayerleverkusen:'germany/Bayer_Leverkusen.svg',bayer04leverkusen:'germany/Bayer_Leverkusen.svg',
    celticfc:'scotland/Celtic.svg',beiktas:'turkey/Beşiktaş.svg',
    fcaararatarmenia:'armenia/Ararat-Armenia.svg',ferencvarostc:'hungary/Ferencváros.svg',
    gnkdinamozagreb:'croatia/GNK_Dinamo_Zagreb.svg',
    jagielloniabialystok:'poland/Jagiellonia_Białystok.svg',lechpoznan:'poland/Lech_Poznań.svg',
    lillestrmsk:'norway/Lillestrøm.svg',oficretefc:'greece/OFI.svg',
    olympiacosfc:'greece/Olympiacos.svg',olympiquedemarseille:'france/Marseille.svg',
    olympiquelyonnais:'france/Olympique_Lyonnais.svg',redbullsalzburg:'austria/Salzburg.svg',
    rscanderlecht:'belgium/RSC_Anderlecht.svg',acspartapraha:'czech-republic/AC_Sparta_Praha.svg',
    stadederennais:'france/Rennes.svg',tsghoffenheim:'germany/Hoffenheim.svg',
    viktoriaplzen:'czech-republic/Viktoria_Plzeň.svg'
  };
  function teamLogoUrl(name){const path=TEAM_LOGOS[norm(name)];if(!path)return '';return /^https:\/\//i.test(path)?path:LOGO_ROOT+path.split('/').map(encodeURIComponent).join('/');}
  function badge(name){const fallback=esc(teamInitials(name)),src=teamLogoUrl(name);return '<span class="team-crest" aria-label="'+esc(name)+'">'+(src?'<img class="team-logo" src="'+src+'" alt="" loading="lazy" decoding="async" onerror="this.remove();if(this.nextElementSibling)this.nextElementSibling.style.display=\'inline-flex\'">':'')+'<span class="team-crest-fallback"'+(src?' style="display:none"':'')+'>'+fallback+'</span></span>';}
  function getTeams(rows){return [...new Set(rows.flatMap(m=>[m.home,m.away]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'it'));}
  function groupByDate(rows){const map=new Map();rows.forEach(m=>{const k=m.date||'unknown';if(!map.has(k))map.set(k,[]);map.get(k).push(m);});return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0]));}
  function standings(rows){
    const map=new Map(),get=name=>{const k=norm(name);if(!map.has(k))map.set(k,{name,played:0,w:0,d:0,l:0,gf:0,ga:0,pts:0});return map.get(k);};
    rows.filter(hasScore).forEach(m=>{const h=get(m.home),a=get(m.away),hg=Number(m.hg),ag=Number(m.ag);h.played++;a.played++;h.gf+=hg;h.ga+=ag;a.gf+=ag;a.ga+=hg;if(hg>ag){h.w++;a.l++;h.pts+=3;}else if(hg<ag){a.w++;h.l++;a.pts+=3;}else{h.d++;a.d++;h.pts++;a.pts++;}});
    return [...map.values()].map(t=>({...t,gd:t.gf-t.ga})).sort((a,b)=>b.pts-a.pts||b.gd-a.gd||b.gf-a.gf||a.name.localeCompare(b.name,'it'));
  }
  function poisson(l,g){if(l<=0)return g===0?1:0;let p=Math.exp(-l);for(let i=1;i<=g;i++)p*=l/i;return p;}
  function probs(lh,la){let h=0,d=0,a=0,btts=0,o15=0,o25=0,o35=0,total=0;for(let x=0;x<=30;x++)for(let y=0;y<=30;y++){const p=poisson(lh,x)*poisson(la,y);total+=p;if(x>y)h+=p;else if(x===y)d+=p;else a+=p;if(x>0&&y>0)btts+=p;if(x+y>=2)o15+=p;if(x+y>=3)o25+=p;if(x+y>=4)o35+=p;}return{home:h/total,draw:d/total,away:a/total,btts:btts/total,o15:o15/total,o25:o25/total,o35:o35/total};}
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  function teamStats(team,rows,venue){
    const all=(rows||[]).filter(m=>hasScore(m)&&(sameTeam(m.home,team)||sameTeam(m.away,team))).sort((a,b)=>a.date.localeCompare(b.date));
    const list=(venue?all.filter(m=>sameTeam(m[venue],team)):all).slice(-10);
    if(!list.length)return{played:0,for:1.25,against:1.25,pointsPerGame:1,form:[],venue:venue||"all"};
    const reference=Date.parse(list[list.length-1].date+"T12:00:00");
    let weightTotal=0,gf=0,ga=0,points=0;
    for(const m of list){const days=Math.max(0,(reference-Date.parse(m.date+"T12:00:00"))/86400000),w=Math.pow(0.5,days/120),home=sameTeam(m.home,team),scored=home?Number(m.hg):Number(m.ag),conceded=home?Number(m.ag):Number(m.hg);gf+=scored*w;ga+=conceded*w;points+=(scored>conceded?3:scored===conceded?1:0)*w;weightTotal+=w;}
    const form=all.slice(-5).map(m=>{const x=Number(m.hg),y=Number(m.ag),home=sameTeam(m.home,team);return(home?x>y:y>x)?"W":x===y?"D":"L";});
    return{played:list.length,for:gf/weightTotal,against:ga/weightTotal,pointsPerGame:points/weightTotal,form,venue:venue||"all",recentMatches:list.length};
  }
  function matchStandingsContext(match,history){
    const date=String(match&&match.date||""),year=Number(date.slice(0,4)),month=Number(date.slice(5,7)),seasonStart=(month>=7?year:year-1)+"-07-01";
    const rows=(history||[]).filter(m=>hasScore(m)&&m.date>=seasonStart&&m.date<date&&(m.competition||"serie-a")===(match.competition||"serie-a"));
    const map=new Map(),get=name=>{const k=norm(name);if(!map.has(k))map.set(k,{name,played:0,w:0,d:0,l:0,gf:0,ga:0,pts:0});return map.get(k);};
    rows.forEach(m=>{const h=get(m.home),a=get(m.away),hg=Number(m.hg),ag=Number(m.ag);h.played++;a.played++;h.gf+=hg;h.ga+=ag;a.gf+=ag;a.ga+=hg;if(hg>ag){h.w++;a.l++;h.pts+=3;}else if(hg<ag){a.w++;h.l++;a.pts+=3;}else{h.d++;a.d++;h.pts++;a.pts++;}});
    const table=[...map.values()].map(t=>({...t,gd:t.gf-t.ga})).sort((a,b)=>b.pts-a.pts||b.gd-a.gd||b.gf-a.gf||a.name.localeCompare(b.name,"it")).map((t,i)=>({...t,rank:i+1}));
    const total=table.length,champions=["champions-league","europa-league"].includes(match.competition||"serie-a");
    const context=team=>{
      const t=table.find(x=>sameTeam(x.name,team));
      if(!t)return{team,available:false,rank:null,points:null,objective:"Classifica non disponibile",pressure:0};
      let objective="Zona centrale",pressure=0.15,pointsToTarget=null,pointsToSafety=null;
      if(champions){
        const direct=table[7],playoff=table[23],elimination=table[24];
        if(t.rank<=8){objective="Zona accesso diretto agli ottavi";pressure=direct&&Math.abs(t.pts-direct.pts)<=3?0.75:0.45;}
        else if(t.rank<=24){objective="Zona spareggi";pressure=playoff&&Math.abs(t.pts-playoff.pts)<=3?0.8:0.35;}
        else{objective="Zona eliminazione";pressure=elimination&&Math.abs(t.pts-elimination.pts)<=3?0.85:0.6;}
        pointsToTarget=direct?Math.max(0,direct.pts-t.pts):null;
        pointsToSafety=elimination?t.pts-elimination.pts:null;
      }else{
        const top=table[Math.min(3,total-1)],sixth=table[Math.min(5,total-1)],safe=table[Math.max(0,total-4)];
        if(t.rank===1){objective="Lotta al vertice";pressure=0.7;}
        else if(t.rank<=4){objective="Zona alta";pressure=0.55;}
        else if(top&&top.pts-t.pts<=6){objective="In corsa per la zona alta";pressure=0.7;}
        else if(t.rank>=Math.max(1,total-2)){objective="Zona bassa";pressure=0.8;}
        else if(safe&&t.pts-safe.pts<=6){objective="Lotta per la salvezza";pressure=0.75;}
        else if(sixth&&sixth.pts-t.pts<=6){objective="In corsa per le posizioni europee";pressure=0.5;}
        pointsToTarget=top?Math.max(0,top.pts-t.pts):null;
        pointsToSafety=safe?t.pts-safe.pts:null;
      }
      return{team,available:true,rank:t.rank,points:t.pts,played:t.played,goalDifference:t.gd,objective,pressure,pointsToTarget,pointsToSafety};
    };
    return{available:table.length>0,asOf:date,played:rows.length,teams:total,home:context(match.home),away:context(match.away),table};
  }
  function forecast(match,history,options){
    options=options||{};
    const competition=match&&match.competition||"serie-a";
    const memoizable=Array.isArray(history)&&Object.keys(options).length===0;
    const memoKey=memoizable?[competition,match?.date,norm(match?.home),norm(match?.away),history.length,history[0]?.date,history.at(-1)?.date,data.updatedAt||""].join("|"):null;
    if(memoKey&&forecastMemo.has(memoKey))return forecastMemo.get(memoKey);
    const hist=(history||[]).filter(x=>hasScore(x)&&x.date<match.date&&(x.competition||"serie-a")===competition);
    const allHome=hist.length?hist.reduce((s,x)=>s+Number(x.hg),0)/hist.length:1.35;
    const allAway=hist.length?hist.reduce((s,x)=>s+Number(x.ag),0)/hist.length:1.1;
    const h=teamStats(match.home,hist),a=teamStats(match.away,hist),hv=teamStats(match.home,hist,"home"),av=teamStats(match.away,hist,"away");
    const blend=(overall,venue,key)=>venue.played>=3?overall[key]*0.4+venue[key]*0.6:overall[key];
    const hAttack=blend(h,hv,"for"),hDefence=blend(h,hv,"against"),aAttack=blend(a,av,"for"),aDefence=blend(a,av,"against");
    const formHome=clamp((h.pointsPerGame-1.25)*0.025,-0.035,0.035),formAway=clamp((a.pointsPerGame-1.25)*0.025,-0.035,0.035);
    const standings=matchStandingsContext(match,hist),pressureHome=standings.home.available?standings.home.pressure:0,pressureAway=standings.away.available?standings.away.pressure:0;
    const motivationHome=clamp(Number(options.motivationHome)||0,-1,1),motivationAway=clamp(Number(options.motivationAway)||0,-1,1);
    const attAbsH=clamp(Number(options.attackingAbsencesHome)||0,0,3),defAbsH=clamp(Number(options.defensiveAbsencesHome)||0,0,3);
    const attAbsA=clamp(Number(options.attackingAbsencesAway)||0,0,3),defAbsA=clamp(Number(options.defensiveAbsencesAway)||0,0,3);
    const contextShiftHome=clamp(Number(options.contextShiftHome)||0,-0.4,0.4);
    const contextShiftAway=clamp(Number(options.contextShiftAway)||0,-0.4,0.4);
    let homeXg=Math.max(0.15,Math.min(4.5,allHome*((hAttack+0.65)/(allHome+0.65))*((aDefence+0.65)/(allHome+0.65))*1.055*(1+formHome)*(1+pressureHome*0.012)*(1+motivationHome*0.02)*(1+contextShiftHome)*(1-0.035*attAbsH)*(1+0.035*defAbsA)));
    let awayXg=Math.max(0.15,Math.min(4.5,allAway*((aAttack+0.65)/(allAway+0.65))*((hDefence+0.65)/(allAway+0.65))*(1+formAway)*(1+pressureAway*0.012)*(1+motivationAway*0.02)*(1+contextShiftAway)*(1-0.035*attAbsA)*(1+0.035*defAbsH)));
    const dates=hist.map(m=>m.date).filter(Boolean).sort(),scoreMatrix=[];let matrixMass=0;
    for(let homeGoals=0;homeGoals<=5;homeGoals++)for(let awayGoals=0;awayGoals<=5;awayGoals++){const probability=poisson(homeXg,homeGoals)*poisson(awayXg,awayGoals);matrixMass+=probability;scoreMatrix.push({homeGoals,awayGoals,probability});}
    const minTeamSample=Math.min(h.played,a.played),confidence=minTeamSample>=10?"alta":minTeamSample>=6?"media":minTeamSample>=3?"limitata":"molto bassa";
    const poissonProbabilities=probs(homeXg,awayXg);
    const netContextShift=(motivationHome-motivationAway)*20 + (contextShiftHome-contextShiftAway)*150 + (defAbsA-attAbsH)*25 - (defAbsH-attAbsA)*25;
    const eloOptions={...options};
    if(netContextShift && !options.eloShift)eloOptions.eloShift=netContextShift;
    const eloProbabilities=options.__forcePoisson?null:(window.MatchMindElo&&window.MatchMindElo.eloProbabilities(match,hist,eloOptions));
    const rawProbabilities=eloProbabilities?{...poissonProbabilities,home:eloProbabilities.home,draw:eloProbabilities.draw,away:eloProbabilities.away}:poissonProbabilities;
    const predictionMethod=eloProbabilities?'elo-1x2-poisson-goals':'poisson';
    const aiModel=options.__skipAI?null:(window.MatchMindAI&&window.MatchMindAI.modelFor(competition));
    const probabilities=aiModel&&aiModel.approved?{...rawProbabilities,...window.MatchMindAI.applyTemperature(rawProbabilities,aiModel.temperature)}:rawProbabilities;
    const result={historyCount:hist.length,historyStart:dates[0]||null,historyEnd:dates[dates.length-1]||null,home:h,away:a,homeVenue:hv,awayVenue:av,homeXg,awayXg,probabilities,rawProbabilities,poissonProbabilities,eloProbabilities,predictionMethod,aiCalibration:{applied:Boolean(aiModel&&aiModel.approved),temperature:aiModel?.temperature??1,status:aiModel?.status||"not_trained"},scoreMatrix,scoreMatrixTail:Math.max(0,1-matrixMass),sampleEnough:minTeamSample>=10,minTeamSample,confidence,standings,modelFactors:{weightedRecentForm:true,homeAwaySplits:true,standingsPressure:true,manualAbsenceAdjustment:{attackingHome:attAbsH,defensiveHome:defAbsH,attackingAway:attAbsA,defensiveAway:defAbsA},manualMotivation:{home:motivationHome,away:motivationAway}},method:predictionMethod==="elo-1x2-poisson-goals"?"Elo per le probabilità 1X2; Poisson per xG, risultato esatto e mercati goal":"Poisson per 1X2 e mercati goal; Elo non disponibile per campione insufficiente",limitations:"La calibrazione adattiva modifica solo 1X2 e viene attivata solo se migliora log loss e Brier in un test cronologico separato. Assenze e motivazione specifica non sono fornite da un feed affidabile."};
    if(memoKey){forecastMemo.set(memoKey,result);if(forecastMemo.size>240)forecastMemo.delete(forecastMemo.keys().next().value);}
    return result;
  }
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
      const f=forecast(target,prior,{__skipAI:true,__forcePoisson:true});
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

  const isFavorite=name=>{try{return (JSON.parse(localStorage.getItem('matchmind-favorites-v1')||'[]')).includes(name);}catch{return false;}};
  function toggleFavorite(name){const list=(()=>{try{return JSON.parse(localStorage.getItem('matchmind-favorites-v1')||'[]');}catch{return [];}})();const next=list.includes(name)?list.filter(x=>x!==name):[...list,name];saveCache('matchmind-favorites-v1',next);return next.includes(name);}
  function nav(active){
    const icons={
      home:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg>',
      matches:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M7 2v4m10-4v4M3 9h18m-13 4h3m-3 4h6"/></svg>',
      live:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h4l2.2-4.2 4.2 8.4 2.2-4.2h4.4"/><circle cx="18.5" cy="5.5" r="2.2" fill="#c4f36a" stroke="currentColor"/></svg>',
      nba:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3.5 12h17M12 3v18M5.6 5.6c4 2.4 8.8 10.4 12.8 12.8M18.4 5.6C14.4 8 9.6 16 5.6 18.4"/></svg>',
      league:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 7.5v9L12 21 4 16.5v-9L12 3Z"/><path d="m4.5 8 7.5 4 7.5-4M12 12v8.5M8.5 5l3.5 4 3.5-4"/></svg>',
      mind:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5m0 14h16M7 15l4-4 3 2 5-7"/><path d="M16 6h3v3"/></svg>',
      bets:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/><path d="M8 8h8M8 12h5m-5 4h8"/></svg>',
      more:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>',
      refresh:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.6 9a7 7 0 0 1 11.7-2L20 12M4 12l2.7 5a7 7 0 0 0 11.7-2"/></svg>',
      install:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 20h16"/></svg>'
    };
    const links=[
      ['matches.html','matches','Calcio'],
      ['live.html','live','Live'],
      ['nba.html','nba','NBA'],
      ['bets.html','bets','Schedina'],
      ['explore.html','more','Altro']
    ];
    const mobile=links.map(([href,key,label])=>'<a class="nav-item '+(active===key?'active':'')+'" href="'+href+'" '+(active===key?'aria-current="page"':'')+'><span class="nav-icon">'+icons[key]+'</span><span>'+label+'</span></a>').join('');
    const desktop=links.map(([href,key,label])=>'<a class="'+(active===key?'active':'')+'" href="'+href+'" '+(active===key?'aria-current="page"':'')+'>'+label+'</a>').join('');
    return '<header class="site-header"><a class="brand-link" href="matches.html" aria-label="MatchMind Partite"><img class="brand-mark" src="./icon.svg" alt="" width="56" height="56"><span class="brand-copy"><b>MatchMind</b><small>SPORTS INTELLIGENCE</small></span></a><nav class="desktop-nav" aria-label="Navigazione principale">'+desktop+'</nav><div class="header-actions"><a class="header-more-link '+(active==='more'?'active':'')+'" href="explore.html" aria-label="Altro e strumenti">Altro</a><button class="refresh-data install-action" id="installApp" type="button" aria-label="Installa MatchMind" title="Installa MatchMind" hidden><span class="action-symbol">'+icons.install+'</span><span>Installa</span></button><button class="refresh-data refresh-action" id="globalRefresh" type="button" aria-label="Aggiorna dati" title="Aggiorna dati"><span class="action-symbol">'+icons.refresh+'</span><span>Aggiorna</span></button></div></header><nav class="mobile-nav" aria-label="Navigazione principale">'+mobile+'</nav>';
  }

  function mountSlipDock(){
    if($('globalSlipDock'))return;
    const dock=document.createElement('section');
    dock.id='globalSlipDock';dock.className='global-slip-dock';dock.hidden=true;
    dock.setAttribute('aria-label','Schedina corrente');
    dock.innerHTML='<div class="global-slip-head"><button type="button" class="global-slip-toggle" data-slip-toggle aria-expanded="false"><span class="global-slip-title-wrap"><b data-slip-title>La tua schedina</b><small data-slip-subtitle>Le selezioni raccolte</small></span><span class="global-slip-hint" data-slip-hint>Apri</span></button><span class="global-slip-count" data-slip-count>0</span></div><div class="global-slip-body" data-slip-body hidden></div>';
    document.body.appendChild(dock);
    const key='matchmind-manual-selections-v1';
    const read=()=>{try{const value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?value:[];}catch{return[];}};
    const marketLabel=value=>{
      const labels={home:'1',draw:'X',away:'2',over15:'Over 1,5',under15:'Under 1,5',over25:'Over 2,5',under25:'Under 2,5',over35:'Over 3,5',under35:'Under 3,5',bttsYes:'Gol',bttsNo:'No Gol','nbaMoneyline:home':'Vincente casa','nbaMoneyline:away':'Vincente trasferta'};
      if(labels[value])return labels[value];
      const match=String(value||'').match(/^combo:(home|draw|away):(over15|under15|over25|under25|over35|under35|bttsYes|bttsNo)$/);
      return match?marketLabel(match[1])+' + '+marketLabel(match[2]):String(value||'Mercato');
    };
    const competitionLabel=value=>{
      if(value==='nba')return 'NBA';
      const labels={'serie-a':'Serie A','champions-league':'Champions League','europa-league':'Europa League','conference-league':'Conference League'};
      return labels[value]||String(value||'Calcio').replace(/-/g,' ');
    };
    const identity=item=>[item.sport||'football',item.competition||'serie-a',item.date||item.start||'',norm(item.home),norm(item.away),item.marketKey||''].join('|');
    const render=()=>{
      const all=read(),rows=all.map((item,index)=>({...item,_index:index}));
      dock.hidden=rows.length===0;
      if(!rows.length)return;
      const football=rows.filter(x=>x.sport!=='nba'),basket=rows.filter(x=>x.sport==='nba');
      const groups=[...new Set(football.map(x=>x.competition||'serie-a'))];
      dock.querySelector('[data-slip-title]').textContent='Schedina · '+rows.length+' '+(rows.length===1?'selezione':'selezioni');
      dock.querySelector('[data-slip-subtitle]').textContent=[
        football.length?football.length+' calcio':'',
        basket.length?basket.length+' NBA':''
      ].filter(Boolean).join(' · ')+' · '+groups.map(competitionLabel).join(', ');
      dock.querySelector('[data-slip-count]').textContent=String(rows.length);
      const body=dock.querySelector('[data-slip-body]'),expanded=!body.hidden;
      const list=rows.map(item=>'<div class="global-slip-row"><span><b>'+esc(item.home)+' – '+esc(item.away)+'</b><small>'+esc(competitionLabel(item.sport==='nba'?'nba':item.competition||'serie-a'))+' · '+esc(marketLabel(item.marketKey))+' · '+esc(item.date||'Data da definire')+'</small></span><button type="button" class="global-slip-remove" data-slip-remove="'+item._index+'" aria-label="Rimuovi '+esc(item.home)+' – '+esc(item.away)+'">×</button></div>').join('');
      const actions=(football.length?'<a class="button-like primary" href="./bets.html#sendSelectionsToSisal">Invia a Sisal · calcio · '+football.length+'</a>':'')+(basket.length?'<a class="button-like secondary" href="./nba.html#nbaSlip">Apri schedina NBA · '+basket.length+'</a>':'');
      body.innerHTML='<div class="global-slip-list">'+list+'</div><div class="global-slip-actions"><button type="button" class="secondary" data-slip-clear>Svuota</button>'+actions+'</div><small class="global-slip-note">La schedina raccoglie le selezioni di tutte le competizioni. Quote e conferma restano da verificare sul bookmaker.</small>';
      body.hidden=!expanded;
      dock.querySelector('[data-slip-toggle]').setAttribute('aria-expanded',String(expanded));
      dock.querySelector('[data-slip-hint]').textContent=expanded?'Chiudi':'Apri';
    };
    dock.addEventListener('click',event=>{
      if(event.target.closest('[data-slip-toggle]')){
        const body=dock.querySelector('[data-slip-body]');body.hidden=!body.hidden;
        dock.querySelector('[data-slip-toggle]').setAttribute('aria-expanded',String(!body.hidden));
        dock.querySelector('[data-slip-hint]').textContent=body.hidden?'Apri':'Chiudi';return;
      }
      const remove=event.target.closest('[data-slip-remove]');
      if(remove){
        const all=read(),index=Number(remove.dataset.slipRemove);
        if(Number.isInteger(index)&&index>=0&&index<all.length)all.splice(index,1);
        try{localStorage.setItem(key,JSON.stringify(all));}catch{}
        render();window.dispatchEvent(new Event('matchmind:picks-updated'));return;
      }
      if(event.target.closest('[data-slip-clear]')){
        try{localStorage.setItem(key,'[]');}catch{}
        render();window.dispatchEvent(new Event('matchmind:picks-updated'));
      }
    });
    window.addEventListener('matchmind:picks-updated',render);
    window.addEventListener('storage',event=>{if(event.key===key)render();});
    render();
  }
  function mountShell(active,title,subtitle){
    const header=$('siteHeader');if(header)header.innerHTML=nav(active);
    const page=document.body.dataset.page||'home';
    if(!['nba','explore','players','data','settings','team'].includes(page)&&!$('competitionTabs')){
      const tabs=document.createElement('nav');tabs.id='competitionTabs';tabs.className='competition-tabs';tabs.setAttribute('aria-label','Seleziona competizione');
      const selected=getSelectedCompetition(),currentPath=location.pathname.split('/').pop()||'matches.html';
      tabs.innerHTML='<span class="competition-tabs-label">CALCIO</span>'+Object.values(COMPETITIONS).map(item=>'<a class="competition-tab '+(item.id===selected?'active':'')+'" href="./'+esc(currentPath)+'?competition='+encodeURIComponent(item.id)+'" '+(item.id===selected?'aria-current="page"':'')+'>'+esc(item.name)+'</a>').join('');
      if(header)header.insertAdjacentElement('afterend',tabs);
    }
    mountSlipDock();
    if(document.body.dataset.page==='match'){const back=document.createElement('button');back.className='detail-back';back.type='button';back.innerHTML='‹ <span>Torna alle partite</span>';back.addEventListener('click',()=>{if(history.length>1)history.back();else location.href='matches.html';});const main=document.querySelector('.page-wrap');if(main)main.prepend(back);}
    const titleEl=$('pageTitle');if(titleEl)titleEl.textContent=title||'MatchMind';
    const subEl=$('pageSubtitle');if(subEl)subEl.textContent=subtitle||'';
    const intro=document.querySelector('.page-intro');
    const homeCopy=page==='home'?document.querySelector('.home-hero-copy'):null;
    const pickerHost=intro||homeCopy;
    if(pickerHost&&!$('competitionSelect')&&!$('competitionTabs')&&page!=='nba'){
      const field=document.createElement('div');field.className='field competition-picker'+(page==='home'?' home-competition-picker':'');
      const label=document.createElement('label');label.htmlFor='competitionSelect';label.textContent='Competizione';
      const select=document.createElement('select');select.id='competitionSelect';select.setAttribute('aria-label','Seleziona competizione');
      Object.values(COMPETITIONS).forEach(item=>{const option=document.createElement('option');option.value=item.id;option.textContent=item.name;select.appendChild(option);});
      select.value=getSelectedCompetition();field.append(label,select);
      const homeStatus=page==='home'&&$('homeStatus');
      if(homeStatus&&homeStatus.parentNode===pickerHost)pickerHost.insertBefore(field,homeStatus);else pickerHost.appendChild(field);
      select.addEventListener('change',()=>{try{localStorage.setItem('matchmind-competition-v1',select.value);}catch{};const currentPage=document.body.dataset.page;if(currentPage==='match'||currentPage==='team'){const target=currentPage==='match'?'matches.html':'explore.html';location.href=target+'?competition='+encodeURIComponent(select.value)+(currentPage==='match'?'#matchesSection':'');}else{const url=new URL(location.href);url.searchParams.delete('import');url.searchParams.set('competition',select.value);location.href=url.toString();}});
    }
    $('globalRefresh')?.addEventListener('click',async()=>{const b=$('globalRefresh');b.disabled=true;b.classList.add('spinning');try{await loadData(true);location.reload();}catch(e){const s=$('globalStatus');if(s)s.textContent=e.message;}finally{b.disabled=false;b.classList.remove('spinning');}});
  }
  document.addEventListener('DOMContentLoaded',()=>{const page=document.body.dataset.page||'home';const active=(page==='home'||page==='matches'||page==='match'||page==='league')?'matches':page==='live'?'live':page==='nba'?'nba':page==='mind'?'mind':page==='bets'?'bets':(['explore','players','data','settings','team'].includes(page)?'more':'home');mountShell(active,document.body.dataset.title||'MatchMind',document.body.dataset.subtitle||'');if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(reg=>reg.update().catch(()=>{})).catch(()=>{});let installPrompt=null;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;const b=$('installApp');if(b)b.hidden=false;});$('installApp')?.addEventListener('click',async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('installApp').hidden=true;});/* Forced periodic reload disabled: it interrupted scrolling and mobile navigation. Use the explicit refresh control. */});
  
  let oddsList = [];
  let oddsPromise = null;
  async function loadOdds() {
    if (oddsPromise) return oddsPromise;
    oddsPromise = (async () => {
      try {
        const resp = await fetch('./fixtures-odds.json', { cache: 'no-cache', signal: AbortSignal.timeout(6000) });
        if (resp.ok) {
          const json = await resp.json();
          oddsList = Array.isArray(json && json.matches) ? json.matches : [];
          return oddsList;
        }
      } catch (_) {}
      oddsList = [];
      return oddsList;
    })().catch(() => []);
    return oddsPromise;
  }
  let injuriesPromise = null, injuriesData = null;
  const INJURIES_CACHE_KEY = 'mm_injuries_data_v1';
  async function loadInjuries(force = false) {
    if (!force && injuriesData) return injuriesData;
    if (!force && injuriesPromise) return injuriesPromise;
    injuriesPromise = (async () => {
      if (!force) {
        try {
          const cached = localStorage.getItem(INJURIES_CACHE_KEY);
          if (cached) {
            injuriesData = JSON.parse(cached);
            return injuriesData;
          }
        } catch (_) {}
      }
      try {
        const resp = await fetch('./injuries-data.json', { cache: 'no-cache', signal: AbortSignal.timeout(6000) });
        if (resp.ok) {
          const json = await resp.json();
          if (json && json.teams) {
            injuriesData = json;
            try { localStorage.setItem(INJURIES_CACHE_KEY, JSON.stringify(json)); } catch (_) {}
            return injuriesData;
          }
        }
      } catch (_) {}
      if (!injuriesData) {
        try {
          const cached = localStorage.getItem(INJURIES_CACHE_KEY);
          if (cached) injuriesData = JSON.parse(cached);
        } catch (_) {}
      }
      return injuriesData;
    })().catch(() => injuriesData);
    return injuriesPromise;
  }
  function findTeamInjuries(teamName) {
    if (!teamName || !injuriesData || !injuriesData.teams) return null;
    const teams = injuriesData.teams;
    if (teams[teamName]) return teams[teamName];
    for (const key of Object.keys(teams)) {
      if (sameTeam(key, teamName)) return teams[key];
    }
    return null;
  }
  function getMatchInjuries(homeName, awayName) {
    const home = findTeamInjuries(homeName);
    const away = findTeamInjuries(awayName);
    const attAbsH = Math.min(3, (home && home.assenze_attacco) || 0);
    const defAbsH = Math.min(3, (home && home.assenze_difesa) || 0);
    const attAbsA = Math.min(3, (away && away.assenze_attacco) || 0);
    const defAbsA = Math.min(3, (away && away.assenze_difesa) || 0);
    return {
      home,
      away,
      hasData: Boolean(home || away),
      autoContext: {
        attackingAbsencesHome: attAbsH,
        defensiveAbsencesHome: defAbsH,
        attackingAbsencesAway: attAbsA,
        defensiveAbsencesAway: defAbsA,
        motivationHome: 0,
        motivationAway: 0
      }
    };
  }

  function matchOdds(m) {
    if (!m || !oddsList || !oddsList.length) return null;
    return oddsList.find(o =>
      sameTeam(o.home, m.home) && sameTeam(o.away, m.away)
    ) ? oddsList.find(o => sameTeam(o.home, m.home) && sameTeam(o.away, m.away)).odds : null;
  }

  window.MM={loadOdds,matchOdds,loadInjuries,getMatchInjuries,findTeamInjuries,$,esc,norm,sameTeam,loadData,backtest,getSelectedCompetition,competitionInfo,filterCompetition,forCompetition,get data(){return data;},hasScore,upcoming,dateLabel,shortDate,matchUrl,teamUrl,teamInitials,badge,getTeams,groupByDate,standings,forecast,eventForecast,matchStandingsContext,teamStats,probs,isFavorite,toggleFavorite,seasonStart,formatNumber:(n,d=0)=>Number(n||0).toLocaleString('it-IT',{maximumFractionDigits:d}),status:m=>hasScore(m)?'Terminata':upcoming(m)?'In programma':'Da aggiornare'};
})();