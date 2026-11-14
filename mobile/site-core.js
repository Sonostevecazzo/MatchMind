/* MatchMind shared data and navigation layer. No forecast output is fabricated. */
(function(){
  const CACHE_KEY='matchmind-multipage-cache-v9-fixture-fallback';
  const COMPETITIONS = {
    "premier-league": { id: "premier-league", name: "Premier League", country: "Inghilterra", kind: "club", logo: null, fallback: "PL", feed: "ENG_1_premier-league", calendarYear: false },
    "la-liga": { id: "la-liga", name: "La Liga", country: "Spagna", kind: "club", logo: null, fallback: "LL", feed: "ESP_1_la-liga", calendarYear: false },
    "bundesliga": { id: "bundesliga", name: "Bundesliga", country: "Germania", kind: "club", logo: null, fallback: "B", feed: "GER_1_bundesliga", calendarYear: false },
    "serie-a": { id: "serie-a", name: "Serie A", country: "Italia", kind: "club", logo: null, fallback: "SA", feed: "ITA_1_serie-a", calendarYear: false },
    "ligue-1": { id: "ligue-1", name: "Ligue 1", country: "Francia", kind: "club", logo: null, fallback: "L1", feed: "FRA_1_ligue-1", calendarYear: false },
    "champions-league": { id: "champions-league", name: "UEFA Champions League", country: "UEFA", kind: "club", logo: null, fallback: "UCL", feed: "UEFA_1_champions-league", calendarYear: false },
    "europa-league": { id: "europa-league", name: "UEFA Europa League", country: "UEFA", kind: "club", logo: null, fallback: "UEL", feed: "UEFA_1_europa-league", calendarYear: false },
    "conference-league": { id: "conference-league", name: "UEFA Conference League", country: "UEFA", kind: "club", logo: null, fallback: "UCL", feed: "UEFA_1_conference-league", calendarYear: false },
    "eng-cup-efl-cup": { id: "eng-cup-efl-cup", name: "EFL Cup (Carabao Cup)", country: "Inghilterra", kind: "club", logo: null, fallback: "ECC", feed: "ENG_CUP_efl-cup", calendarYear: false },
    "eng-cup-fa-cup": { id: "eng-cup-fa-cup", name: "FA Cup", country: "Inghilterra", kind: "club", logo: null, fallback: "FC", feed: "ENG_CUP_fa-cup", calendarYear: false },
    "esp-cup-copa-del-rey": { id: "esp-cup-copa-del-rey", name: "Copa del Rey", country: "Spagna", kind: "club", logo: null, fallback: "CDR", feed: "ESP_CUP_copa-del-rey", calendarYear: false },
    "coppa-italia": { id: "coppa-italia", name: "Coppa Italia", country: "Italia", kind: "club", logo: null, fallback: "CI", feed: "ITA_CUP_coppa-italia", calendarYear: false },
    "ger-cup-dfb-pokal": { id: "ger-cup-dfb-pokal", name: "DFB-Pokal", country: "Germania", kind: "club", logo: null, fallback: "D", feed: "GER_CUP_dfb-pokal", calendarYear: false },
    "ned-cup-knvb-beker": { id: "ned-cup-knvb-beker", name: "KNVB Beker", country: "Paesi Bassi", kind: "club", logo: null, fallback: "KB", feed: "NED_CUP_knvb-beker", calendarYear: false },
    "por-cup-taca-de-portugal": { id: "por-cup-taca-de-portugal", name: "Taça de Portugal", country: "Portogallo", kind: "club", logo: null, fallback: "TDP", feed: "POR_CUP_taca-de-portugal", calendarYear: false },
    "sco-cup-scottish-cup": { id: "sco-cup-scottish-cup", name: "Scottish Cup", country: "Scozia", kind: "club", logo: null, fallback: "SC", feed: "SCO_CUP_scottish-cup", calendarYear: false },
    "sco-cup-league-cup": { id: "sco-cup-league-cup", name: "Scottish League Cup", country: "Scozia", kind: "club", logo: null, fallback: "SLC", feed: "SCO_CUP_league-cup", calendarYear: false },
    "aut-cup-ofb-cup": { id: "aut-cup-ofb-cup", name: "OFB Cup", country: "Austria", kind: "club", logo: null, fallback: "OC", feed: "AUT_CUP_ofb-cup", calendarYear: false },
    "sui-cup-swiss-cup": { id: "sui-cup-swiss-cup", name: "Swiss Cup", country: "Svizzera", kind: "club", logo: null, fallback: "SC", feed: "SUI_CUP_swiss-cup", calendarYear: false },
    "eng-2-championship": { id: "eng-2-championship", name: "EFL Championship", country: "Inghilterra", kind: "club", logo: null, fallback: "EC", feed: "ENG_2_championship", calendarYear: false },
    "eng-3-league-one": { id: "eng-3-league-one", name: "EFL League One", country: "Inghilterra", kind: "club", logo: null, fallback: "ELO", feed: "ENG_3_league-one", calendarYear: false },
    "eng-4-league-two": { id: "eng-4-league-two", name: "EFL League Two", country: "Inghilterra", kind: "club", logo: null, fallback: "ELT", feed: "ENG_4_league-two", calendarYear: false },
    "eng-5-national-league": { id: "eng-5-national-league", name: "National League", country: "Inghilterra", kind: "club", logo: null, fallback: "NL", feed: "ENG_5_national-league", calendarYear: false },
    "eng-6-national-league-north": { id: "eng-6-national-league-north", name: "National League North", country: "Inghilterra", kind: "club", logo: null, fallback: "NLN", feed: "ENG_6_national-league-north", calendarYear: false },
    "eng-6-national-league-south": { id: "eng-6-national-league-south", name: "National League South", country: "Inghilterra", kind: "club", logo: null, fallback: "NLS", feed: "ENG_6_national-league-south", calendarYear: false },
    "eng-7-northern-premier-league": { id: "eng-7-northern-premier-league", name: "Northern Premier League", country: "Inghilterra", kind: "club", logo: null, fallback: "NPL", feed: "ENG_7_northern-premier-league", calendarYear: false },
    "sco-1-premiership": { id: "sco-1-premiership", name: "Scottish Premiership", country: "Scozia", kind: "club", logo: null, fallback: "SP", feed: "SCO_1_premiership", calendarYear: false },
    "sco-2-championship": { id: "sco-2-championship", name: "Scottish Championship", country: "Scozia", kind: "club", logo: null, fallback: "SC", feed: "SCO_2_championship", calendarYear: false },
    "sco-3-league-one": { id: "sco-3-league-one", name: "Scottish League One", country: "Scozia", kind: "club", logo: null, fallback: "SLO", feed: "SCO_3_league-one", calendarYear: false },
    "sco-4-league-two": { id: "sco-4-league-two", name: "Scottish League Two", country: "Scozia", kind: "club", logo: null, fallback: "SLT", feed: "SCO_4_league-two", calendarYear: false },
    "ger-2-2-bundesliga": { id: "ger-2-2-bundesliga", name: "2. Bundesliga", country: "Germania", kind: "club", logo: null, fallback: "2B", feed: "GER_2_2-bundesliga", calendarYear: false },
    "ger-3-3-liga": { id: "ger-3-3-liga", name: "3. Liga", country: "Germania", kind: "club", logo: null, fallback: "3L", feed: "GER_3_3-liga", calendarYear: false },
    "por-1-primeira-liga": { id: "por-1-primeira-liga", name: "Primeira Liga", country: "Portogallo", kind: "club", logo: null, fallback: "PL", feed: "POR_1_primeira-liga", calendarYear: false },
    "ned-1-eredivisie": { id: "ned-1-eredivisie", name: "Eredivisie", country: "Paesi Bassi", kind: "club", logo: null, fallback: "E", feed: "NED_1_eredivisie", calendarYear: false },
    "bel-1-pro-league": { id: "bel-1-pro-league", name: "Belgian Pro League", country: "Belgio", kind: "club", logo: null, fallback: "BPL", feed: "BEL_1_pro-league", calendarYear: false },
    "tur-1-super-lig": { id: "tur-1-super-lig", name: "Süper Lig", country: "Turchia", kind: "club", logo: null, fallback: "SL", feed: "TUR_1_super-lig", calendarYear: false },
    "gre-1-super-league": { id: "gre-1-super-league", name: "Super League Greece", country: "Grecia", kind: "club", logo: null, fallback: "SLG", feed: "GRE_1_super-league", calendarYear: false },
    "sui-1-super-league": { id: "sui-1-super-league", name: "Swiss Super League", country: "Svizzera", kind: "club", logo: null, fallback: "SSL", feed: "SUI_1_super-league", calendarYear: false },
    "aut-1-bundesliga": { id: "aut-1-bundesliga", name: "Austrian Bundesliga", country: "Austria", kind: "club", logo: null, fallback: "AB", feed: "AUT_1_bundesliga", calendarYear: false },
    "den-1-superliga": { id: "den-1-superliga", name: "Danish Superliga", country: "Danimarca", kind: "club", logo: null, fallback: "DS", feed: "DEN_1_superliga", calendarYear: false },
    "swe-1-allsvenskan": { id: "swe-1-allsvenskan", name: "Allsvenskan", country: "Svezia", kind: "club", logo: null, fallback: "A", feed: "SWE_1_allsvenskan", calendarYear: false },
    "nor-1-eliteserien": { id: "nor-1-eliteserien", name: "Eliteserien", country: "Norvegia", kind: "club", logo: null, fallback: "E", feed: "NOR_1_eliteserien", calendarYear: false },
    "rou-1-liga-1": { id: "rou-1-liga-1", name: "Liga I", country: "Romania", kind: "club", logo: null, fallback: "LI", feed: "ROU_1_liga-1", calendarYear: false },
    "rus-1-premier-liga": { id: "rus-1-premier-liga", name: "Russian Premier Liga", country: "Russia", kind: "club", logo: null, fallback: "RPL", feed: "RUS_1_premier-liga", calendarYear: false },
    "ire-2-first-division": { id: "ire-2-first-division", name: "League of Ireland First Division", country: "Irlanda", kind: "club", logo: null, fallback: "LOI", feed: "IRE_2_first-division", calendarYear: false },
    "ire-3-national-league": { id: "ire-3-national-league", name: "League of Ireland National League", country: "Irlanda", kind: "club", logo: null, fallback: "LOI", feed: "IRE_3_national-league", calendarYear: false },
    "pol-1-ekstraklasa": { id: "pol-1-ekstraklasa", name: "Ekstraklasa", country: "Polonia", kind: "club", logo: null, fallback: "E", feed: "POL_1_ekstraklasa", calendarYear: false },
    "pol-2-division-1": { id: "pol-2-division-1", name: "I Liga", country: "Polonia", kind: "club", logo: null, fallback: "IL", feed: "POL_2_division-1", calendarYear: false },
    "pol-3-division-2": { id: "pol-3-division-2", name: "II Liga", country: "Polonia", kind: "club", logo: null, fallback: "IL", feed: "POL_3_division-2", calendarYear: false },
    "bel-u21-pro-league": { id: "bel-u21-pro-league", name: "Pro League U21", country: "Belgio", kind: "club", logo: null, fallback: "PLU", feed: "BEL_U21_pro-league", calendarYear: false },
    "wal-1-cymru-premier": { id: "wal-1-cymru-premier", name: "Cymru Premier", country: "Galles", kind: "club", logo: null, fallback: "CP", feed: "WAL_1_cymru-premier", calendarYear: false },
    "wal-2-cymru-north": { id: "wal-2-cymru-north", name: "Cymru North", country: "Galles", kind: "club", logo: null, fallback: "CN", feed: "WAL_2_cymru-north", calendarYear: false },
    "wal-3-cymru-south": { id: "wal-3-cymru-south", name: "Cymru South", country: "Galles", kind: "club", logo: null, fallback: "CS", feed: "WAL_3_cymru-south", calendarYear: false },
    "cro-1-hnl": { id: "cro-1-hnl", name: "HNL", country: "Croazia", kind: "club", logo: null, fallback: "H", feed: "CRO_1_hnl", calendarYear: false },
    "cze-1-chance-liga": { id: "cze-1-chance-liga", name: "Chance Liga", country: "Repubblica Ceca", kind: "club", logo: null, fallback: "CL", feed: "CZE_1_chance-liga", calendarYear: false },
    "ukr-1-premier-league": { id: "ukr-1-premier-league", name: "Ukrainian Premier League", country: "Ucraina", kind: "club", logo: null, fallback: "UPL", feed: "UKR_1_premier-league", calendarYear: false },
    "cyp-1-first-division": { id: "cyp-1-first-division", name: "Cyprus League", country: "Cipro", kind: "club", logo: null, fallback: "CL", feed: "CYP_1_first-division", calendarYear: false },
    "svk-1-nike-liga": { id: "svk-1-nike-liga", name: "Nike Liga", country: "Slovacchia", kind: "club", logo: null, fallback: "NL", feed: "SVK_1_nike-liga", calendarYear: false },
    "svn-1-prva-liga": { id: "svn-1-prva-liga", name: "Prva Liga", country: "Slovenia", kind: "club", logo: null, fallback: "PL", feed: "SVN_1_prva-liga", calendarYear: false },
    "fin-1-veikkausliiga": { id: "fin-1-veikkausliiga", name: "Veikkausliiga", country: "Finlandia", kind: "club", logo: null, fallback: "V", feed: "FIN_1_veikkausliiga", calendarYear: false },
    "kaz-1-premier-league": { id: "kaz-1-premier-league", name: "Kazakhstan Premier League", country: "Kazakistan", kind: "club", logo: null, fallback: "KPL", feed: "KAZ_1_premier-league", calendarYear: false },
    "esp-2-segunda-division": { id: "esp-2-segunda-division", name: "Segunda División", country: "Spagna", kind: "club", logo: null, fallback: "SD", feed: "ESP_2_segunda-division", calendarYear: false },
    "serie-b": { id: "serie-b", name: "Serie B", country: "Italia", kind: "club", logo: null, fallback: "SB", feed: "ITA_2_serie-b", calendarYear: false },
    "fra-2-ligue-2": { id: "fra-2-ligue-2", name: "Ligue 2", country: "Francia", kind: "club", logo: null, fallback: "L2", feed: "FRA_2_ligue-2", calendarYear: false },
    "ned-2-eerste-divisie": { id: "ned-2-eerste-divisie", name: "Eerste Divisie", country: "Paesi Bassi", kind: "club", logo: null, fallback: "ED", feed: "NED_2_eerste-divisie", calendarYear: false },
    "bra-1-serie-a": { id: "bra-1-serie-a", name: "Brasileirão Série A", country: "Brasile", kind: "club", logo: null, fallback: "BSA", feed: "BRA_1_serie-a", calendarYear: true },
    "bra-2-serie-b": { id: "bra-2-serie-b", name: "Série B", country: "Brasile", kind: "club", logo: null, fallback: "SB", feed: "BRA_2_serie-b", calendarYear: true },
    "arg-1-liga-profesional": { id: "arg-1-liga-profesional", name: "Liga Profesional", country: "Argentina", kind: "club", logo: null, fallback: "LP", feed: "ARG_1_liga-profesional", calendarYear: true },
    "arg-2-primera-nacional": { id: "arg-2-primera-nacional", name: "Primera Nacional", country: "Argentina", kind: "club", logo: null, fallback: "PN", feed: "ARG_2_primera-nacional", calendarYear: true },
    "mex-1-liga-mx": { id: "mex-1-liga-mx", name: "Liga MX", country: "Messico", kind: "club", logo: null, fallback: "LM", feed: "MEX_1_liga-mx", calendarYear: true },
    "mex-2-liga-expansion": { id: "mex-2-liga-expansion", name: "Liga de Expansión MX", country: "Messico", kind: "club", logo: null, fallback: "LDE", feed: "MEX_2_liga-expansion", calendarYear: true },
    "usa-1-mls": { id: "usa-1-mls", name: "Major League Soccer", country: "Stati Uniti", kind: "club", logo: null, fallback: "MLS", feed: "USA_1_mls", calendarYear: true },
    "jpn-1-j1-league": { id: "jpn-1-j1-league", name: "J1 League", country: "Giappone", kind: "club", logo: null, fallback: "JL", feed: "JPN_1_j1-league", calendarYear: true },
    "aus-1-a-league": { id: "aus-1-a-league", name: "A-Leagues", country: "Australia", kind: "club", logo: null, fallback: "A", feed: "AUS_1_a-league", calendarYear: false },
    "chn-1-super-league": { id: "chn-1-super-league", name: "Chinese Super League", country: "Cina", kind: "club", logo: null, fallback: "CSL", feed: "CHN_1_super-league", calendarYear: true },
    "nations-league": { id: "nations-league", name: "UEFA Nations League", country: "Nazionali UEFA", kind: "national", logo: null, fallback: "NL" }
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
  const forecastMemo=new Map();
  function trainAvailableModels(history,competition=getSelectedCompetition()){
    if(!window.MatchMindAI||typeof window.MatchMindAI.trainAsync!=="function")return Promise.resolve(null);
    const key=COMPETITIONS[competition]?competition:"serie-a";
    return window.MatchMindAI.trainAsync(history,(match,prior)=>forecast(match,prior,{__skipAI:true}),key).then(model=>{
      forecastMemo.clear();
      return model;
    });
  }
  const DATA_ROOT='https://raw.githubusercontent.com/oladeeayo/open-matchday/master/data/';
  const HISTORY_ROOT='https://raw.githubusercontent.com/openfootball/football.json/master/';
  const LEAGUE_SOURCES=Object.values(COMPETITIONS)
    .filter(competition=>competition&&competition.feed)
    .map(competition=>({
      id:competition.id,
      folder:competition.feed,
      calendarYear:Boolean(competition.calendarYear),
      history:competition.id==="serie-a"
    }));

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

  function romeDateTime(value){
    const date=new Date(value);if(!Number.isFinite(date.getTime()))return null;
    const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
    return {date:parts.year+'-'+parts.month+'-'+parts.day,time:parts.hour+':'+parts.minute};
  }
  async function fetchDirectNationsLeague(year){
    const start=new Date(),end=new Date(start);end.setDate(end.getDate()+92);
    const windows=[];
    for(let cursor=new Date(start);cursor<=end;){
      const from=new Date(cursor),to=new Date(cursor);to.setDate(to.getDate()+6);if(to>end)to.setTime(end.getTime());
      const fmt=d=>String(d.getFullYear())+String(d.getMonth()+1).padStart(2,"0")+String(d.getDate()).padStart(2,"0");
      windows.push([fmt(from),fmt(to)]);cursor=new Date(to);cursor.setDate(cursor.getDate()+1);
    }
    const batches=await Promise.all(windows.map(async([from,to])=>{
      const response=await fetch("https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.nations/scoreboard?dates="+from+"-"+to+"&limit=500",{signal:AbortSignal.timeout(18000)});
      if(!response.ok)throw new Error("ESPN Nations League HTTP "+response.status);
      const payload=await response.json();return Array.isArray(payload.events)?payload.events:[];
    }));
    const events=[...new Map(batches.flat().map(event=>[String(event.id),event])).values()];
    return events.map(event=>{
      const comp=event?.competitions?.[0]||{},teams=Array.isArray(comp.competitors)?comp.competitors:[];
      const home=teams.find(x=>x?.homeAway==="home")||teams[0]||{},away=teams.find(x=>x?.homeAway==="away")||teams[1]||{};
      const homeName=home?.team?.displayName||home?.team?.name||home?.displayName||home?.name;
      const awayName=away?.team?.displayName||away?.team?.name||away?.displayName||away?.name;
      const rawDate=String(event?.date||comp?.date||""),localDateTime=romeDateTime(rawDate),date=localDateTime?.date||"",status=comp?.status?.type||event?.status?.type||{};
      const done=Boolean(status.completed)||String(status.state||"").toLowerCase()==="post";
      if(!date||!homeName||!awayName)return null;
      const score=value=>value===null||value===undefined||value===""?null:num(value);
      return {id:String(event?.id||""),date,time:localDateTime?.time||"",round:null,stage:"UEFA Nations League",home:homeName,away:awayName,hg:done?score(home?.score):null,ag:done?score(away?.score):null,ht:null,at:null,hs:null,as:null,hst:null,ast:null,hf:null,af:null,hc:null,ac:null,hy:null,ay:null,hr:null,ar:null,goalMinutes:"",status:done?"FT":String(status.state||"").toLowerCase()==="in"?"LIVE":"NS",statusLong:status.shortDetail||status.detail||(done?"Terminata":"In programma"),competition:"nations-league",source:"ESPN"};
    }).filter(Boolean);
  }

  async function fetchDirectCalendar(){
    const y=seasonStart();
    const matches=[],history=[];
    const jobs=LEAGUE_SOURCES.map(async league=>{
      const seasonYear=league.calendarYear?new Date().getFullYear():y;
      const code=league.calendarYear?String(seasonYear):seasonCode(seasonYear);
      const base=DATA_ROOT+league.folder+'/';
      const [resultsCsv,fixturesCsv]=await Promise.all([
        fetch(base+'results_'+code+'.csv',{headers:{Accept:'text/plain'},signal:AbortSignal.timeout(18000)}).then(r=>r.ok?r.text():'').catch(()=>''),
        fetch(base+'fixtures_'+code+'.csv',{headers:{Accept:'text/plain'},signal:AbortSignal.timeout(18000)}).then(r=>r.ok?r.text():'').catch(()=>'')
      ]);
      const results=resultsCsv?parseCsvRows(resultsCsv).map(r=>normalizeMatchRow(r,league.id,true)).filter(m=>m.date&&m.home&&m.away):[];
      const fixtures=fixturesCsv?parseCsvRows(fixturesCsv).map(r=>normalizeMatchRow(r,league.id,false)).filter(m=>m.date&&m.home&&m.away):[];
      return {league,results,fixtures};
    });
    const settled=await Promise.allSettled(jobs);
    const feedErrors=[];
    for(let i=0;i<settled.length;i++){
      const result=settled[i];
      if(result.status!=='fulfilled'){feedErrors.push(String(result.reason&&result.reason.message||result.reason));continue;}
      const {league,results,fixtures}=result.value;
      matches.push(...results,...fixtures);
      if(league.history)history.push(...results);
    }
    const histJobs=[y-1,y-2,y-3,y-4,y-5].map(async year=>{
      const folder=year+'-'+String(year+1).slice(-2);
      const res=await fetch(HISTORY_ROOT+folder+'/it.1.json',{headers:{Accept:'application/json'},signal:AbortSignal.timeout(15000)}).catch(()=>null);
      if(!res||!res.ok)return [];
      const payload=await res.json().catch(()=>({}));
      return (payload.matches||[]).map(row=>{
        const ft=row.score?.ft||null,ht=row.score?.ht||null,done=Array.isArray(ft)&&ft.length>=2&&ft[0]!==null&&ft[1]!==null;
        return {
          id:null,date:String(row.date||''),time:String(row.time||''),round:num(String(row.round||'').match(/\\d+/)?.[0]),
          stage:String(row.round||''),home:String(row.team1||''),away:String(row.team2||''),
          hg:done?num(ft[0]):null,ag:done?num(ft[1]):null,ht:Array.isArray(ht)?num(ht[0]):null,at:Array.isArray(ht)?num(ht[1]):null,
          hs:null,as:null,hst:null,ast:null,hf:null,af:null,hc:null,ac:null,hy:null,ay:null,hr:null,ar:null,
          status:done?'FT':'NS',statusLong:done?'Terminata':'In programma',competition:'serie-a',source:'openfootball · archivio storico'
        };
      }).filter(m=>m.date&&m.home&&m.away&&m.hg!==null&&m.ag!==null);
    });
    const histSettled=await Promise.allSettled(histJobs);
    histSettled.forEach(result=>{if(result.status==='fulfilled')history.push(...result.value);});
    try{
      const nations=await fetchDirectNationsLeague(y);
      matches.push(...nations);
      history.push(...nations.filter(m=>m.status==="FT"&&m.hg!==null&&m.ag!==null));
    }catch(error){feedErrors.push("Nations League: "+String(error&&error.message||error));}
    matches.sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||'')));
    history.sort((a,b)=>a.date.localeCompare(b.date));
    if(!matches.length)throw new Error('I dataset pubblici non contengono partite accessibili per questa stagione.');
    const counts=Object.fromEntries(LEAGUE_SOURCES.map(league=>[league.id,matches.filter(match=>match.competition===league.id).length]));
    return {
      matches,history,season:y,counts,errors:feedErrors,
      source:'open-matchday (catalogo completo) + openfootball + ESPN Nations League',
      updatedAt:Date.now(),sourceMode:'public-dataset-direct'
    };
  }

  async function loadData(force=false){
    if(dataPromise&&!force){
      const selected=getSelectedCompetition();
      return dataPromise.then(async loaded=>{
        if(Array.isArray(loaded&&loaded.matches)&&loaded.matches.some(match=>match&&match.competition===selected))return loaded;
        dataPromise=null;
        return loadData(true);
      });
    }
    dataPromise=(async()=>{
      const y=seasonStart(),cached=readCache();
      const selected=getSelectedCompetition();
      const cacheCoversSelected=Boolean(cached&&Array.isArray(cached.matches)&&cached.matches.some(match=>match&&match.competition===selected));
      if(!force&&cached&&cached.season===y&&Array.isArray(cached.matches)&&cached.matches.length&&cacheCoversSelected&&Date.now()-Number(cached.updatedAt||0)<15*60*1000){data=cached;return data;}
      let payload=null;
      try{
        const requestedCompetition=getSelectedCompetition();
        const response=await fetch('./api/competition-calendar?competition='+encodeURIComponent(requestedCompetition),{headers:{Accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(90000)});
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

      const selectedCompetition=getSelectedCompetition();
      if(!Array.isArray(payload.matches))payload.matches=[];
      if(!payload.matches.some(match=>match&&match.competition===selectedCompetition)){
        if(selectedCompetition==="nations-league"){
          try{
            const nations=await fetchDirectNationsLeague(y);
            payload.matches=payload.matches.filter(match=>match&&match.competition!=="nations-league").concat(nations);
            payload.history=(Array.isArray(payload.history)?payload.history:[]).filter(match=>match&&match.competition!=="nations-league").concat(nations.filter(match=>match.status==="FT"&&match.hg!==null&&match.ag!==null));
            payload.source=(payload.source||"public-calendar")+" + ESPN Nations League fallback";
          }catch(error){payload.nationsLeagueError=String(error&&error.message||error);}
        }
      }

      // Recover upcoming fixtures from the established public CSV feed if ESPN
      // returned only completed events for the selected competition.
      const hasUpcomingForSelected=payload.matches.some(match=>match&&match.competition===selectedCompetition&&upcoming(match));
      if(!hasUpcomingForSelected&&["serie-a","champions-league","europa-league"].includes(selectedCompetition)){
        try{
          const fallback=await fetchDirectCalendar();
          const fallbackMatches=(fallback.matches||[]).filter(match=>match&&match.competition===selectedCompetition);
          if(fallbackMatches.some(upcoming)){
            payload.matches=payload.matches.filter(match=>!match||match.competition!==selectedCompetition).concat(fallbackMatches);
            const fallbackHistory=(fallback.history||[]).filter(match=>match&&match.competition===selectedCompetition);
            payload.history=(payload.history||[]).filter(match=>!match||match.competition!==selectedCompetition).concat(fallbackHistory);
            payload.source=(payload.source||"ESPN")+" + open-matchday fallback";
          }
        }catch(_){/* Keep the primary response if the backup source is unavailable. */}
      }

      data={
        matches:payload.matches,
        history:Array.isArray(payload.history)?payload.history:[],
        season:payload.season||y,
        source:payload.source||'openfootball',
        updatedAt:Date.now(),
        sourceMode:payload.sourceMode||'public-dataset',
        coverage:payload.coverage&&typeof payload.coverage==='object'?payload.coverage:null,
        historyScope:payload.historyScope||null,
        counts:payload.counts&&typeof payload.counts==='object'?payload.counts:{},
        errors:Array.isArray(payload.errors)?payload.errors:[],
        nationsLeagueError:payload.nationsLeagueError||null
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
  // Etichette italiane per le denominazioni inglesi restituite dai feed.
  // I valori originali restano invariati nei dati e nelle chiavi di ricerca.
  const TEAM_DISPLAY_NAMES = Object.freeze({
    internazionale:'Inter',internazionalefc:'Inter',intermilan:'Inter',fcinter:'Inter',fcinternazionale:'Inter',
    acmilan:'Milan',milanac:'Milan',associazionecalciomilan:'Milan',
    hellasverona:'Verona',hellasveronafc:'Verona',asroma:'Roma',associazioneromacalcio:'Roma',
    ssclazio:'Lazio',sscnapoli:'Napoli',atalantabc:'Atalanta',acffiorentina:'Fiorentina',
    bolognafc:'Bologna',torinofc:'Torino',acmonza:'Monza',udinesecalcio:'Udinese',
    uslecce:'Lecce',empolifc:'Empoli',cagliaricalcio:'Cagliari',genoacfc:'Genoa',
    parmacalcio:'Parma',como1907:'Como',veneziafc:'Venezia',juventusfc:'Juventus',
    ussassuolo:'Sassuolo',pisasc:'Pisa',ussalernitana:'Salernitana',ucsampdoria:'Sampdoria',
    realmadridcf:'Real Madrid',barcelona:'Barcellona',fcbarcelona:'Barcellona',barca:'Barcellona',
    atletidemadrid:'Atletico Madrid',atleticodemadrid:'Atletico Madrid',atleticomadrid:'Atletico Madrid',
    athleticclub:'Athletic Bilbao',athleticclubbilbao:'Athletic Bilbao',athleticbilbao:'Athletic Bilbao',
    realbetisbalompie:'Real Betis',realbetis:'Betis',brightonandhovealbion:'Brighton',
    brightonhovealbion:'Brighton',wolverhamptonwanderers:'Wolverhampton',westhamunited:'West Ham',
    tottenhamhotspur:'Tottenham',nottinghamforest:'Nottingham Forest',newcastleunited:'Newcastle',
    leedsunited:'Leeds',manchesterunited:'Manchester United',manchesterutd:'Manchester United',
    manchestercity:'Manchester City',bayernmunich:'Bayern Monaco',bayernmunchen:'Bayern Monaco',
    bayernmonaco:'Bayern Monaco',borussiadortmund:'Borussia Dortmund',bayerleverkusen:'Bayer Leverkusen',
    borussiamonchengladbach:"Borussia M'gladbach",monchengladbach:"Borussia M'gladbach",
    eintrachtfrankfurt:'Eintracht Francoforte',scfreiburg:'Friburgo',fcstpauli:'St. Pauli',
    unionberlin:'Union Berlino',werderbremen:'Werder Brema',rbleipzig:'RB Lipsia',
    redbullsalzburg:'Salisburgo',olympiquedemarseille:'Marsiglia',olympiquelyonnais:'Lione',
    asmonaco:'Monaco',rcstrasbourgalsace:'Strasburgo',sportingcp:'Sporting Lisbona',
    sportingclubedeportugal:'Sporting Lisbona',fcporto:'Porto',slbenfica:'Benfica',
    feyenoordrotterdam:'Feyenoord',afcajax:'Ajax',psveindhoven:'PSV Eindhoven',
    fcutrecht:'Utrecht',krcgenk:'Genk',clubbrugge:'Club Brugge',
    unionstgilloise:'Union Saint-Gilloise',
    italy:'Italia',italynationalteam:'Italia',italia:'Italia',
    germany:'Germania',germannationalteam:'Germania',deutschland:'Germania',
    france:'Francia',francenationalteam:'Francia',spain:'Spagna',spainnationalteam:'Spagna',espana:'Spagna',
    england:'Inghilterra',englandnationalteam:'Inghilterra',
    netherlands:'Olanda',dutchnationalteam:'Olanda',holland:'Olanda',paesibassi:'Olanda',
    belgium:'Belgio',belgiumnationalteam:'Belgio',portugal:'Portogallo',
    croatia:'Croazia',croatiannationalteam:'Croazia',denmark:'Danimarca',
    sweden:'Svezia',norway:'Norvegia',poland:'Polonia',czechrepublic:'Repubblica Ceca',
    romania:'Romania',sudtirol:'Südtirol',fcsudtirol:'Südtirol',
    republicofireland:'Irlanda',ireland:'Irlanda',scotland:'Scozia',wales:'Galles',
    ukraine:'Ucraina',serbia:'Serbia',albania:'Albania',turkey:'Turchia',
    greece:'Grecia',northmacedonia:'Macedonia del Nord',macedoniadelnord:'Macedonia del Nord',
    moldova:'Moldavia',kazakhstan:'Kazakistan',faroeislands:'Isole Faroe',
    bosniaandherzegovina:'Bosnia-Erzegovina',montenegro:'Montenegro',
    luxembourg:'Lussemburgo',iceland:'Islanda',slovenia:'Slovenia',
    switzerland:'Svizzera',slovakia:'Slovacchia',andorra:'Andorra',gibraltar:'Gibilterra',
    finland:'Finlandia',israel:'Israele',estonia:'Estonia',latvia:'Lettonia',lithuania:'Lituania'
  });
  const displayTeamName = name => {
    const raw = String(name || '').trim();
    return TEAM_DISPLAY_NAMES[norm(raw)] || raw;
  };
  const TEAM_LOGOS={
    internazionale:'italy/Inter.svg',inter:'italy/Inter.svg',intermilan:'italy/Inter.svg',
    monza:'italy/AC_Monza.svg',udinese:'italy/Udinese.svg',como:'italy/Como_1907.svg',como1907:'italy/Como_1907.svg',
    genoa:'italy/Genoa.svg',napoli:'italy/Napoli.svg',parma:'italy/Parma.svg',cagliari:'italy/Cagliari.svg',
    frosinone:'italy/Frosinone_Calcio.svg',juventus:'italy/Juventus.svg',juventusturin:'italy/Juventus.svg',juve:'italy/Juventus.svg',venezia:'italy/Venezia.svg',
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
    jagielloniabialystok:'poland/Jagiellonia_Białystok.svg',
    lillestrmsk:'norway/Lillestrøm.svg',oficretefc:'greece/OFI.svg',
    olympiacosfc:'greece/Olympiacos.svg',olympiquedemarseille:'france/Marseille.svg',
    olympiquelyonnais:'france/Olympique_Lyonnais.svg',redbullsalzburg:'austria/Salzburg.svg',
    rscanderlecht:'belgium/RSC_Anderlecht.svg',acspartapraha:'czech-republic/AC_Sparta_Praha.svg',
    stadederennais:'france/Rennes.svg',tsghoffenheim:'germany/Hoffenheim.svg',
  };
  // Loghi aggiuntivi verificati nel catalogo football-logos.
  Object.assign(TEAM_LOGOS, {
    verona:'italy/Hellas_Verona.svg',hellas:'italy/Hellas_Verona.svg',hellasveronafc:'italy/Hellas_Verona.svg',
    cremonese:'italy/Cremonese.svg',uscremonese:'italy/Cremonese.svg',
    pisa:'italy/Pisa.svg',pisasc:'italy/Pisa.svg',empoli:'italy/Empoli.svg',empolifc:'italy/Empoli.svg',
    salernitana:'italy/Salernitana.svg',ussalernitana:'italy/Salernitana.svg',
    sampdoria:'italy/Sampdoria.svg',ucsampdoria:'italy/Sampdoria.svg',
    palermo:'italy/Palermo.svg',palermofc:'italy/Palermo.svg',
    spezia:'italy/Spezia.svg',speziacalcio:'italy/Spezia.svg',
    brentford:'england/Brentford.svg',brighton:'england/Brighton.svg',brightonandhovealbion:'england/Brighton.svg',
    burnley:'england/Burnley.svg',everton:'england/Everton.svg',fulham:'england/Fulham.svg',
    leeds:'england/Leeds_United.svg',leedsunited:'england/Leeds_United.svg',
    nottinghamforest:'england/Nottingham_Forest.svg',sunderland:'england/Sunderland.svg',
    tottenham:'england/Tottenham.svg',tottenhamhotspur:'england/Tottenham.svg',
    westham:'england/West_Ham.svg',westhamunited:'england/West_Ham.svg',
    wolverhampton:'england/Wolverhampton_Wanderers.svg',wolverhamptonwanderers:'england/Wolverhampton_Wanderers.svg',
    athleticclub:'spain/Athletic_Club_Bilbao.svg',athleticclubbilbao:'spain/Athletic_Club_Bilbao.svg',
    athleticbilbao:'spain/Athletic_Club_Bilbao.svg',elche:'spain/Elche.svg',espanyol:'spain/Espanyol.svg',
    getafe:'spain/Getafe.svg',girona:'spain/Girona.svg',osasuna:'spain/Osasuna.svg',
    mallorca:'spain/Mallorca.svg',rayovallecano:'spain/Rayo_Vallecano.svg',rayo:'spain/Rayo_Vallecano.svg',
    alaves:'spain/Deportivo_Alavés.svg',deportivoalaves:'spain/Deportivo_Alavés.svg',
    oviedo:'spain/Oviedo.svg',realoviedo:'spain/Oviedo.svg',levante:'spain/Levante.svg',
    augsburg:'germany/Augsburg.svg',eintrachtfrankfurt:'germany/Eintracht_Frankfurt.svg',
    frankfurt:'germany/Eintracht_Frankfurt.svg',freiburg:'germany/Freiburg.svg',
    heidenheim:'germany/FC_Heidenheim.svg',fcheidenheim:'germany/FC_Heidenheim.svg',
    mainz:'germany/Mainz_05.svg',mainz05:'germany/Mainz_05.svg',
    stpauli:'germany/St_Pauli.svg',fcstpauli:'germany/St_Pauli.svg',
    unionberlin:'germany/Union_Berlin.svg',werderbremen:'germany/Werder_Bremen.svg',
    wolfsburg:'germany/Wolfsburg.svg',gladbach:'germany/Borussia_Mönchengladbach.svg',
    borussiamonchengladbach:'germany/Borussia_Mönchengladbach.svg',
    hamburg:'germany/Hamburger_SV.svg',hamburgersv:'germany/Hamburger_SV.svg',
    schalke:'germany/Schalke_04.svg',schalke04:'germany/Schalke_04.svg',
    angers:'france/Angers.svg',auxerre:'france/Auxerre.svg',brest:'france/Brest.svg',
    lorient:'france/Lorient_FC.svg',lorientfc:'france/Lorient_FC.svg',
    nantes:'france/Nantes.svg',nice:'france/Nice.svg',parisfc:'france/Paris_FC.svg',
    strasbourg:'france/RC_Strasbourg_Alsace.svg',rcstrasbourgalsace:'france/RC_Strasbourg_Alsace.svg',
    toulouse:'france/Toulouse.svg',twente:'netherlands/Twente.svg',
    fcutrecht:'netherlands/FC_Utrecht.svg',utrecht:'netherlands/FC_Utrecht.svg',
    genk:'belgium/KRC_Genk.svg',krcgenk:'belgium/KRC_Genk.svg',
    crvenazvezda:'serbia/Crvena_Zvezda.svg',redstarbelgrade:'serbia/Crvena_Zvezda.svg',
    spartakmoscow:'russia/Spartak_Moscow.svg',zenit:'russia/Zenit.svg',
    dutchnationalteam:'netherlands/Dutch_National_Team.svg'
  });


  // Serie B, club europei e nazionali usate nelle competizioni già presenti nell'app.
  Object.assign(TEAM_LOGOS, {
    bari:'italy/Bari.svg',sscbari:'italy/Bari.svg',
    cesena:'italy/Cesena_FC.svg',cesenafc:'italy/Cesena_FC.svg',
    catanzaro:'italy/Catanzaro.svg',uscatanzaro:'italy/Catanzaro.svg',
    reggiana:'italy/Reggiana.svg',acreggiana:'italy/Reggiana.svg',
    modena:'italy/Modena.svg',modenafc:'italy/Modena.svg',
    chelsea:'england/Chelsea.svg',chelseafc:'england/Chelsea.svg',
    atletico:'spain/Atletico_Madrid.svg',atleticodemadrid:'spain/Atletico_Madrid.svg',atleticomadrid:'spain/Atletico_Madrid.svg',
    atletidemadrid:'spain/Atletico_Madrid.svg',sevilla:'spain/Sevilla.svg',sevillafc:'spain/Sevilla.svg',
    valencia:'spain/Valencia.svg',valenciacf:'spain/Valencia.svg',
    monaco:'france/AS_Monaco.svg',asmonaco:'france/AS_Monaco.svg',
    ajax:'netherlands/Ajax.svg',afcajax:'netherlands/Ajax.svg',
    rangers:'scotland/Rangers.svg',glasgowrangers:'scotland/Rangers.svg',
    italy:'italy/Italy_National_Team.svg',italianationalteam:'italy/Italy_National_Team.svg',italia:'italy/Italy_National_Team.svg',
    france:'france/France_National_Team.svg',francenationalteam:'france/France_National_Team.svg',francia:'france/France_National_Team.svg',
    germany:'germany/Germany_National_Team.svg',germannationalteam:'germany/Germany_National_Team.svg',germania:'germany/Germany_National_Team.svg',
    spain:'spain/Spain_National_Team.svg',spainnationalteam:'spain/Spain_National_Team.svg',spagna:'spain/Spain_National_Team.svg',
    england:'england/England_National_Team.svg',englandnationalteam:'england/England_National_Team.svg',inghilterra:'england/England_National_Team.svg',
    netherlands:'netherlands/Dutch_National_Team.svg',dutchnationalteam:'netherlands/Dutch_National_Team.svg',paesibassi:'netherlands/Dutch_National_Team.svg',
    belgium:'belgium/Belgium_National_Team.svg',belgiumnationalteam:'belgium/Belgium_National_Team.svg',belgio:'belgium/Belgium_National_Team.svg',
    croatia:'croatia/Croatia_National_Team.svg',croatiannationalteam:'croatia/Croatia_National_Team.svg',croazia:'croatia/Croatia_National_Team.svg',
    denmark:'denmark/Denmark_National_Team.svg',denmarknationalteam:'denmark/Denmark_National_Team.svg',danimarca:'denmark/Denmark_National_Team.svg',
    sweden:'sweden/Sweden_National_Team.svg',swedennationalteam:'sweden/Sweden_National_Team.svg',svezia:'sweden/Sweden_National_Team.svg',
    norway:'norway/Norway_National_Team.svg',norwaynationalteam:'norway/Norway_National_Team.svg',norvegia:'norway/Norway_National_Team.svg',
    poland:'poland/Poland_National_Team.svg',polandnationalteam:'poland/Poland_National_Team.svg',polonia:'poland/Poland_National_Team.svg',
    czechrepublic:'czech-republic/Czech_Republic_National_Team.svg',czechrepublicnationalteam:'czech-republic/Czech_Republic_National_Team.svg',repubblicaceca:'czech-republic/Czech_Republic_National_Team.svg',
    romania:'romania/Romania_National_Team.svg',romanianationalteam:'romania/Romania_National_Team.svg',
    republicofireland:'republic-of-ireland/Republic_of_Ireland_National_Team.svg',republicofirelandnationalteam:'republic-of-ireland/Republic_of_Ireland_National_Team.svg',irlanda:'republic-of-ireland/Republic_of_Ireland_National_Team.svg',
    scotland:'scotland/Scotland_National_Team.svg',scotlandnationalteam:'scotland/Scotland_National_Team.svg',scozia:'scotland/Scotland_National_Team.svg',
    wales:'wales/Wales_National_Team.svg',walesnationalteam:'wales/Wales_National_Team.svg',galles:'wales/Wales_National_Team.svg',
    ukraine:'ukraine/Ukraine_National_Team.svg',ukrainenationalteam:'ukraine/Ukraine_National_Team.svg',ucraina:'ukraine/Ukraine_National_Team.svg',
    serbia:'serbia/Serbia_National_Team.svg',serbianationalteam:'serbia/Serbia_National_Team.svg',
    albania:'albania/Albania_National_Team.svg',albanianationalteam:'albania/Albania_National_Team.svg',
    turkey:'turkey/Turkey_National_Team.svg',turkeynationalteam:'turkey/Turkey_National_Team.svg',turchia:'turkey/Turkey_National_Team.svg',
    bayernmonaco:'germany/Bayern_München.svg',fcbayernmunich:'germany/Bayern_Munich.svg',fcbayernmunchen:'germany/Bayern_München.svg',
    sudtirol:'italy/Suditrol.svg',fcsudtirol:'italy/Suditrol.svg'
  });
  // Per le nazionali usa le bandiere, come nella presentazione Sisal; i club mantengono gli stemmi.
  const NATIONAL_TEAM_FLAGS = Object.freeze({
    italy:'it',italia:'it',italynationalteam:'it',
    france:'fr',francia:'fr',francenationalteam:'fr',
    germany:'de',germania:'de',germannationalteam:'de',deutschland:'de',
    spain:'es',spagna:'es',spainnationalteam:'es',espana:'es',
    england:'gb-eng',inghilterra:'gb-eng',englandnationalteam:'gb-eng',
    netherlands:'nl',holland:'nl',olanda:'nl',paesibassi:'nl',dutchnationalteam:'nl',
    greece:'gr',grecia:'gr',hellas:'gr',
    belgium:'be',belgio:'be',belgiumnationalteam:'be',
    portugal:'pt',portogallo:'pt',portuguesefootballfederation:'pt',
    croatia:'hr',croazia:'hr',croatiannationalteam:'hr',
    denmark:'dk',danimarca:'dk',sweden:'se',svezia:'se',norway:'no',norvegia:'no',
    poland:'pl',polonia:'pl',czechrepublic:'cz',repubblicaceca:'cz',romania:'ro',
    republicofireland:'ie',ireland:'ie',irlanda:'ie',
    scotland:'gb-sct',scozia:'gb-sct',wales:'gb-wls',galles:'gb-wls',
    ukraine:'ua',ucraina:'ua',serbia:'rs',albania:'al',turkey:'tr',turchia:'tr',
    slovenia:'si',svizzera:'ch',switzerland:'ch',slovacchia:'sk',slovakia:'sk',
    northmacedonia:'mk',macedoniadelnord:'mk',moldova:'md',moldavia:'md',
    kazakhstan:'kz',kazakistan:'kz',faroeislands:'fo',isolefaroe:'fo',
    andorra:'ad',gibraltar:'gi',montenegro:'me',bosniaandherzegovina:'ba',
    bosniaerzegovina:'ba',bosnia:'ba',luxembourg:'lu',lussemburgo:'lu',
    iceland:'is',islanda:'is',finland:'fi',finlandia:'fi',israel:'il',israele:'il',
    estonia:'ee',latvia:'lv',lituania:'lt',lithuania:'lt'
  });
  function nationalFlagCode(name){
    const key=norm(name),displayKey=norm(displayTeamName(name));
    return NATIONAL_TEAM_FLAGS[key]||NATIONAL_TEAM_FLAGS[displayKey]||'';
  }
  function teamLogoUrl(name){
    const flag=nationalFlagCode(name);
    if(flag)return 'https://flagcdn.com/w80/'+flag+'.png';
    const key = norm(name), displayKey = norm(displayTeamName(name));
    const path = TEAM_LOGOS[key] || TEAM_LOGOS[displayKey] || '';
    if(!path)return '';
    return /^https:\/\//i.test(path)?path:LOGO_ROOT+path.split('/').map(encodeURIComponent).join('/');
  }
  function badge(name){const fallback=esc(teamInitials(name)),flag=Boolean(nationalFlagCode(name)),src=teamLogoUrl(name);return '<span class="team-crest" aria-label="'+esc(displayTeamName(name))+'">'+(src?'<img class="team-logo'+(flag?' national-flag':'')+'" src="'+src+'" alt="" loading="lazy" decoding="async" onerror="this.remove();if(this.nextElementSibling)this.nextElementSibling.style.display=\'inline-flex\'">':'')+'<span class="team-crest-fallback"'+(src?' style="display:none"':'')+'>'+fallback+'</span></span>';}
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
      const winner=['home','draw','away'].sort((a,b)=>p[b]-p[a])[0],baseWinner=['home','draw','away'].sort((a,b)=>baseline[b]-baseline[a])[0];
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
      matches:'<svg viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="mmBall" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#d9ff83"/><stop offset="1" stop-color="#8fcb35"/></linearGradient></defs><circle cx="12" cy="12" r="10" fill="url(#mmBall)" stroke="none"/><path d="m12 6 3.4 2.5-1.3 4h-4.2l-1.3-4L12 6Zm-3.4 6.5-3.1 2.2m9.9-2.2 3.1 2.2M9.9 20l1-7.5m3.2 7.5-1-7.5" stroke="#15211b" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      live:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="5" fill="#182d32" stroke="#4dd6b0" stroke-width="1.5"/><path d="M7 12h2l1.5-4 3 8 1.5-4H17" fill="none" stroke="#69edc6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="18" cy="7" r="2" fill="#ff6b72"/></svg>',
      nba:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3.5 12h17M12 3v18M5.6 5.6c4 2.4 8.8 10.4 12.8 12.8M18.4 5.6C14.4 8 9.6 16 5.6 18.4"/></svg>',
      bets:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z" fill="#25311c" stroke="#c4f36a" stroke-width="1.6"/><path d="m8 12 2.5 2.5L16.5 8.5" fill="none" stroke="#d8ff91" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      league:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 7.5v9L12 21 4 16.5v-9L12 3Z"/><path d="m4.5 8 7.5 4 7.5-4M12 12v8.5M8.5 5l3.5 4 3.5-4"/></svg>',
      more:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>',
      teams:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 20v-1.8A5.5 5.5 0 0 1 9 12.7a5.5 5.5 0 0 1 5.5 5.5V20M16 5.2a3.1 3.1 0 0 1 0 5.9M17 13a4.7 4.7 0 0 1 3.5 4.5V20"/></svg>',
      players:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="3.5"/><path d="M4.5 21v-2.2a7.5 7.5 0 0 1 15 0V21M8.5 14.5l3.5 2 3.5-2"/></svg>',
      mind:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5m0 14h16M7 15l4-4 3 2 5-7"/><path d="M16 6h3v3"/></svg>',
      data:'<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/></svg>',
      settings:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.5.9l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.5-.9l-1.7.6-1.4-2.4 1.4-1.1a7 7 0 0 1 0-1.8l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.5-.9l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.5.9l1.7-.6 1.4 2.4-1.4 1.1a7 7 0 0 1 0 1.8Z"/></svg>',
      refresh:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.6 9a7 7 0 0 1 11.7-2L20 12M4 12l2.7 5a7 7 0 0 0 11.7-2"/></svg>',
      install:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 20h16"/></svg>'
    };
    const primary=[
      ['matches.html','matches','Home'],
      ['live.html','live','Live'],
      ['analysis-lab.html','mind','Analisi'],
      ['bets.html','bets','Schedina']
    ];
    const secondary=[
      ['league.html','league','Classifiche','league'],
      ['explore.html','teams','Squadre','explore'],
      ['players.html','players','Giocatori','players'],
      ['data.html','data','Dati','data'],
      ['settings.html','settings','Impostazioni','settings']
    ];
    const page=document.body.dataset.page||'';
    const activeSecondary=page==='league'?'league':page==='explore'||page==='team'?'explore':page==='mind'||page==='analysis-lab'?'analysis-lab':page;
    const item=([href,key,label])=>'<a class="nav-item '+(active===key?'active':'')+'" href="'+href+'" '+(active===key?'aria-current="page"':'')+'><span class="nav-icon">'+icons[key]+'</span><span>'+label+'</span></a>';
    const drawer=secondary.map(([href,key,label,group])=>'<a class="nav-item '+(activeSecondary===group?'active':'')+'" href="'+href+'" '+(activeSecondary===group?'aria-current="page"':'')+'><span class="nav-icon">'+icons[key]+'</span><span>'+label+'</span></a>').join('');
    const desktop=primary.map(([href,key,label])=>'<a class="'+(active===key?'active':'')+'" href="'+href+'" '+(active===key?'aria-current="page"':'')+'>'+label+'</a>').join('');
    return '<header class="site-header"><button class="mobile-menu-trigger" id="mobileMenuToggle" type="button" aria-label="Apri Altro" aria-controls="mobileNav" aria-expanded="false"><span></span><span></span><span></span></button><a class="brand-link" href="matches.html" aria-label="MatchMind Partite"><img class="brand-mark" src="./icon.svg" alt="" width="56" height="56"><span class="brand-copy"><b>MatchMind</b><small>SPORTS INTELLIGENCE</small></span></a><nav class="desktop-nav" aria-label="Navigazione principale">'+desktop+'</nav><div class="header-actions"><a class="header-more-link '+(active==='more'?'active':'')+'" href="explore.html">Altro</a><button class="refresh-data install-action" id="installApp" type="button" aria-label="Installa MatchMind" title="Installa MatchMind" hidden><span class="action-symbol">'+icons.install+'</span><span>Installa</span></button><button class="refresh-data refresh-action" id="globalRefresh" type="button" aria-label="Aggiorna dati" title="Aggiorna dati"><span class="action-symbol">'+icons.refresh+'</span><span>Aggiorna</span></button></div></header><nav class="mobile-primary-nav" aria-label="Navigazione principale mobile">'+primary.map(item).join('')+'</nav><div class="mobile-nav-backdrop" id="mobileNavBackdrop" hidden></div><nav class="mobile-nav" id="mobileNav" aria-label="Altro"><div class="mobile-drawer-title"><b>ESPLORA</b><small>Classifiche, squadre, analisi e dati</small></div>'+drawer+'</nav>';
  }

  function mountSlipDock(){
    if($('globalSlipDock'))return;
    const dock=document.createElement('section');
    dock.id='globalSlipDock';dock.className='global-slip-dock';dock.hidden=true;
    dock.setAttribute('aria-label','Schedina corrente');
    dock.innerHTML='<div class="global-slip-head"><button type="button" class="global-slip-toggle" data-slip-toggle aria-expanded="false"><span><b data-slip-title>Schedina</b><small data-slip-subtitle>Selezioni salvate</small></span><span class="global-slip-hint" data-slip-hint>Apri</span></button><a class="global-slip-open" data-slip-confirm href="./bets.html#saveManualSlip">Conferma</a></div><div class="global-slip-body" data-slip-body hidden></div>';
    document.body.appendChild(dock);
    const key='matchmind-manual-selections-v1';
    const read=()=>{try{const value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?value:[];}catch{return[];}};
    const marketLabel=value=>{
      const labels={home:'1',draw:'X',away:'2',dc1X:'1X',dcX2:'X2',dc12:'12',over15:'Over 1,5',under15:'Under 1,5',over25:'Over 2,5',under25:'Under 2,5',over35:'Over 3,5',under35:'Under 3,5',bttsYes:'Gol',bttsNo:'No Gol','nbaMoneyline:home':'NBA · Vince casa','nbaMoneyline:away':'NBA · Vince trasferta'};
      return labels[value]||String(value||'Mercato');
    };
    const render=()=>{
      const all=read(),rows=all.map((item,index)=>({...item,_globalIndex:index}));
      dock.hidden=!rows.length;
      if(!rows.length){dock.classList.remove('is-expanded');return;}
      const nba=rows.filter(x=>x.sport==='nba').length,football=rows.length-nba;
      dock.querySelector('[data-slip-title]').textContent='Schedina · '+rows.length+' '+(rows.length===1?'selezione':'selezioni');
      dock.querySelector('[data-slip-subtitle]').textContent=nba&&football?'Calcio e NBA · '+nba+' NBA':nba?'NBA · '+nba+' eventi':(new Set(rows.map(x=>x.competition||'serie-a')).size>1?'Più competizioni':'Calcio');
      const body=dock.querySelector('[data-slip-body]'),expanded=!body.hidden;
      body.innerHTML='<div class="global-slip-list">'+rows.map(item=>'<div class="global-slip-row"><span><b>'+esc(item.home)+' – '+esc(item.away)+'</b><small>'+esc(item.sport==='nba'?'NBA':(competitionInfo(item.competition).name||'Calcio'))+' · '+esc(marketLabel(item.marketKey))+' · '+esc(item.date||'Data da definire')+'</small></span><button type="button" class="global-slip-remove" data-slip-remove="'+item._globalIndex+'" aria-label="Rimuovi '+esc(item.home)+' – '+esc(item.away)+'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-.8 13H6.8L6 7m4 3v6m4-6v6"/></svg></button></div>').join('')+'</div><div class="global-slip-actions"><button type="button" class="secondary" data-slip-clear>Svuota</button><a class="button-like primary" data-slip-confirm-body href="./bets.html#saveManualSlip">Apri schedina</a></div><small class="global-slip-note">Il trasferimento apre Sisal: controlla sempre evento, mercato e quota prima di confermare la giocata.</small>';
      body.hidden=!expanded;
      const toggle=dock.querySelector('[data-slip-toggle]');
      toggle.setAttribute('aria-expanded',String(expanded));
      dock.classList.toggle('is-expanded',expanded);
      dock.querySelector('[data-slip-hint]').textContent=expanded?'Chiudi':'Apri';
      const onlyNba=nba===rows.length;
      const href=onlyNba?'./bets.html?sport=nba#manualBuilder':'./bets.html?sport=football#manualBuilder';
      dock.querySelectorAll('[data-slip-confirm]').forEach(link=>{link.href=href;link.textContent=onlyNba?'Apri schedina NBA':nba&&football?'Apri schedina mista':'Conferma';});
      const bodyLink=dock.querySelector('[data-slip-confirm-body]');
      bodyLink.href=href;
      bodyLink.textContent=onlyNba?'Apri schedina NBA':nba&&football?'Apri schedina mista':'Apri schedina calcio';
      if(nba&&football)dock.querySelector('[data-slip-subtitle]').textContent='Schedina mista · calcio e NBA nello stesso riepilogo';
    };
    dock.addEventListener('click',event=>{
      if(event.target.closest('[data-slip-toggle]')){
        const body=dock.querySelector('[data-slip-body]');body.hidden=!body.hidden;
        dock.querySelector('[data-slip-toggle]').setAttribute('aria-expanded',String(!body.hidden));
        dock.querySelector('[data-slip-hint]').textContent=body.hidden?'Apri':'Chiudi';
        dock.classList.toggle('is-expanded',!body.hidden);return;
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
    const header=$('siteHeader');if(header)header.innerHTML=nav(active);['mobile-primary-nav','mobileNavBackdrop','mobileNav'].forEach(id=>{const node=$(id);if(node&&node.parentElement!==document.body)document.body.appendChild(node);});const mobileNav=$('mobileNav'),menuToggle=$('mobileMenuToggle'),menuBackdrop=$('mobileNavBackdrop');const setMobileMenu=open=>{if(!mobileNav||!menuToggle||!menuBackdrop)return;mobileNav.classList.toggle('is-open',Boolean(open));menuBackdrop.hidden=!open;menuToggle.setAttribute('aria-expanded',String(Boolean(open)));menuToggle.setAttribute('aria-label',open?'Chiudi menu':'Apri menu');document.body.classList.toggle('mobile-menu-open',Boolean(open));};menuToggle?.addEventListener('click',()=>setMobileMenu(!mobileNav?.classList.contains('is-open')));menuBackdrop?.addEventListener('click',()=>setMobileMenu(false));mobileNav?.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>setMobileMenu(false)));document.addEventListener('keydown',event=>{if(event.key==='Escape')setMobileMenu(false);});
    const page=document.body.dataset.page||'home';
    mountSlipDock();
    if(document.body.dataset.page==='match'){const back=document.createElement('button');back.className='detail-back';back.type='button';back.innerHTML='‹ <span>Torna alle partite</span>';back.addEventListener('click',()=>{if(history.length>1)history.back();else location.href='matches.html';});const main=document.querySelector('.page-wrap');if(main)main.prepend(back);}
    const titleEl=$('pageTitle');if(titleEl)titleEl.textContent=title||'MatchMind';
    const subEl=$('pageSubtitle');if(subEl)subEl.textContent=subtitle||'';
    const intro=document.querySelector('.page-intro');
    const homeCopy=page==='home'?document.querySelector('.home-hero-copy'):null;
    const pickerHost=intro||homeCopy;
    if(pickerHost&&!$('competitionSelect')&&['matches','live','league','match','mind','home','bets'].includes(page)) {
      const field=document.createElement('div');field.className='field competition-picker'+(page==='home'?' home-competition-picker':'');
      const label=document.createElement('label');label.htmlFor='competitionPickerButton';label.textContent='Competizione';
      const select=document.createElement('select');select.id='competitionSelect';select.hidden=true;select.tabIndex=-1;select.setAttribute('aria-hidden','true');
      const clubGroup=document.createElement('optgroup');clubGroup.label='Competizioni per club';
      const nationalGroup=document.createElement('optgroup');nationalGroup.label='Nazionali';
      Object.values(COMPETITIONS).forEach(item=>{const option=document.createElement('option');option.value=item.id;option.textContent=item.name;(item.kind==='national'?nationalGroup:clubGroup).appendChild(option);});
      select.append(clubGroup,nationalGroup);select.value=getSelectedCompetition();
      const trigger=document.createElement('button');trigger.type='button';trigger.id='competitionPickerButton';trigger.className='competition-select-trigger';
      trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls','competitionOptions');
      trigger.innerHTML='<span data-competition-label></span><span class="competition-select-chevron" aria-hidden="true">⌄</span>';
      const menu=document.createElement('div');menu.id='competitionOptions';menu.className='competition-picker-menu';menu.setAttribute('role','listbox');menu.setAttribute('aria-label','Seleziona competizione');menu.hidden=true;
      const clubMenu=document.createElement('div');clubMenu.className='competition-picker-group';clubMenu.setAttribute('role','group');clubMenu.setAttribute('aria-label','Competizioni per club');
      const nationalMenu=document.createElement('div');nationalMenu.className='competition-picker-group';nationalMenu.setAttribute('role','group');nationalMenu.setAttribute('aria-label','Nazionali');
      const addGroupLabel=(host,value)=>{const heading=document.createElement('div');heading.className='competition-picker-group-label';heading.textContent=value;host.appendChild(heading);};
      addGroupLabel(clubMenu,'Competizioni per club');addGroupLabel(nationalMenu,'Nazionali');
      Object.values(COMPETITIONS).forEach(item=>{
        const option=document.createElement('div');option.className='competition-option';option.dataset.competitionChoice=item.id;
        option.setAttribute('role','option');option.tabIndex=0;option.textContent=item.name;
        (item.kind==='national'?nationalMenu:clubMenu).appendChild(option);
      });
      menu.append(clubMenu,nationalMenu);
      const choices=()=>Array.from(menu.querySelectorAll('[data-competition-choice]'));
      const closePicker=(restoreFocus=false)=>{menu.hidden=true;field.classList.remove('is-open');trigger.setAttribute('aria-expanded','false');if(restoreFocus)trigger.focus();};
      const syncPicker=()=>{
        const selected=select.options[select.selectedIndex];
        trigger.querySelector('[data-competition-label]').textContent=selected?.textContent||'Seleziona competizione';
        choices().forEach(option=>option.setAttribute('aria-selected',String(option.dataset.competitionChoice===select.value)));
      };
      trigger.addEventListener('click',()=>{
        const opening=menu.hidden;menu.hidden=!opening;field.classList.toggle('is-open',opening);trigger.setAttribute('aria-expanded',String(opening));
        if(opening){const selected=choices().find(option=>option.dataset.competitionChoice===select.value);(selected||choices()[0])?.focus();}
      });
      menu.addEventListener('click',event=>{
        const option=event.target.closest('[data-competition-choice]');if(!option)return;
        select.value=option.dataset.competitionChoice;select.dispatchEvent(new Event('change',{bubbles:true}));
      });
      menu.addEventListener('keydown',event=>{
        const list=choices(),index=list.indexOf(document.activeElement);
        if(event.key==='Escape'){event.preventDefault();closePicker(true);return;}
        if(event.key==='ArrowDown'||event.key==='ArrowUp'||event.key==='Home'||event.key==='End'){
          event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?list.length-1:(index+(event.key==='ArrowDown'?1:-1)+list.length)%list.length;list[next]?.focus();return;
        }
        if(event.key==='Enter'||event.key===' '){const option=document.activeElement.closest('[data-competition-choice]');if(option){event.preventDefault();select.value=option.dataset.competitionChoice;select.dispatchEvent(new Event('change',{bubbles:true}));}}
      });
      document.addEventListener('click',event=>{if(!field.contains(event.target))closePicker(false);});
      select.addEventListener('change',()=>{
        syncPicker();closePicker(false);
        try{localStorage.setItem('matchmind-competition-v1',select.value);}catch{}
        const currentPage=document.body.dataset.page;
        if(currentPage==='match'||currentPage==='team'){const target=currentPage==='match'?'matches.html':'explore.html';location.href=target+'?competition='+encodeURIComponent(select.value)+(currentPage==='match'?'#matchesSection':'');}
        else{const url=new URL(location.href);url.searchParams.delete('import');url.searchParams.set('competition',select.value);location.href=url.toString();}
      });
      syncPicker();field.append(label,select,trigger,menu);
      const homeStatus=page==='home'&&$('homeStatus');
      if(homeStatus&&homeStatus.parentNode===pickerHost)pickerHost.insertBefore(field,homeStatus);else pickerHost.appendChild(field);
    }
    $('globalRefresh')?.addEventListener('click',async()=>{const b=$('globalRefresh');b.disabled=true;b.classList.add('spinning');try{await loadData(true);location.reload();}catch(e){const s=$('globalStatus');if(s)s.textContent=e.message;}finally{b.disabled=false;b.classList.remove('spinning');}});
  }
  document.addEventListener('DOMContentLoaded',()=>{const page=document.body.dataset.page||'home';const active=(page==='home'||page==='matches'||page==='match'||page==='league')?'matches':page==='live'?'live':page==='nba'?'nba':(page==='mind'||page==='analysis-lab')?'mind':page==='bets'?'bets':(['explore','players','data','settings','team'].includes(page)?'more':'home');mountShell(active,document.body.dataset.title||'MatchMind',document.body.dataset.subtitle||'');if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(reg=>reg.update().catch(()=>{})).catch(()=>{});let installPrompt=null;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;const b=$('installApp');if(b)b.hidden=false;});$('installApp')?.addEventListener('click',async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('installApp').hidden=true;});/* Forced periodic reload disabled: it interrupted scrolling and mobile navigation. Use the explicit refresh control. */});
  
  const ODDS_MAX_AGE_MS=24*60*60*1000;
  let oddsList = [],oddsMeta={source:null,updatedAt:null,fresh:false,count:0,ageHours:null};
  let oddsPromise = null;
  async function loadOdds(force=false) {
    if (oddsPromise&&!force) return oddsPromise;
    oddsPromise = (async () => {
      try {
        const resp = await fetch('./fixtures-odds.json', { cache: 'no-cache', signal: AbortSignal.timeout(6000) });
        if (resp.ok) {
          const json = await resp.json();
          const timestamp=Date.parse(json&&json.updatedAt||"");
          const ageMs=Date.now()-timestamp;
          const fresh=Number.isFinite(timestamp)&&ageMs>=-5*60*1000&&ageMs<=ODDS_MAX_AGE_MS;
          const rows=Array.isArray(json&&json.matches)?json.matches:[];
          oddsMeta={source:json.source||null,updatedAt:Number.isFinite(timestamp)?new Date(timestamp).toISOString():null,fresh,count:rows.length,ageHours:Number.isFinite(ageMs)?Math.round(ageMs/360000)/10:null,reason:fresh?null:!Number.isFinite(timestamp)?"timestamp_missing":ageMs<0?"timestamp_in_future":"feed_expired"};
          oddsList=fresh?rows:[];
          return oddsList;
        }
      } catch (_) {}
      oddsList=[];
      oddsMeta={source:null,updatedAt:null,fresh:false,count:0,ageHours:null,reason:"feed_unavailable"};
      return oddsList;
    })().catch(() => []);
    return oddsPromise;
  }
  let injuriesPromise = null, injuriesData = null;
  const INJURIES_CACHE_KEY = 'mm_injuries_data_v1';
  const INJURIES_MAX_AGE_MS=36*60*60*1000;
  function injuryDataFreshness(payload=injuriesData){
    const timestamp=Date.parse(payload&&payload.last_updated||"");
    const ageMs=Date.now()-timestamp;
    const fresh=Boolean(payload&&payload.teams&&Number.isFinite(timestamp)&&ageMs>=-5*60*1000&&ageMs<=INJURIES_MAX_AGE_MS);
    return {fresh,updatedAt:Number.isFinite(timestamp)?new Date(timestamp).toISOString():null,ageHours:Number.isFinite(ageMs)?Math.round(ageMs/360000)/10:null,reason:fresh?null:!Number.isFinite(timestamp)?"timestamp_missing":ageMs<0?"timestamp_in_future":"feed_expired"};
  }
  async function loadInjuries(force = false) {
    if (!force && injuriesData && injuryDataFreshness().fresh) return injuriesData;
    if (!force && injuriesPromise) return injuriesPromise;
    if(force)injuriesData=null;
    injuriesPromise = (async () => {
      let cached=null;
      if (!force) {
        try {
          const raw=localStorage.getItem(INJURIES_CACHE_KEY);
          if(raw){const parsed=JSON.parse(raw);if(injuryDataFreshness(parsed).fresh)cached=parsed;else localStorage.removeItem(INJURIES_CACHE_KEY);}
        } catch (_) {}
      }
      if(cached)injuriesData=cached;
      try {
        const resp = await fetch('./injuries-data.json', { cache: 'no-cache', signal: AbortSignal.timeout(6000) });
        if (resp.ok) {
          const json = await resp.json();
          if (json && json.teams && injuryDataFreshness(json).fresh) {
            injuriesData = json;
            try { localStorage.setItem(INJURIES_CACHE_KEY, JSON.stringify(json)); } catch (_) {}
            return injuriesData;
          }
        }
      } catch (_) {}
      return injuriesData&&injuryDataFreshness(injuriesData).fresh?injuriesData:null;
    })().catch(() => injuriesData&&injuryDataFreshness(injuriesData).fresh?injuriesData:null);
    return injuriesPromise;
  }
  function findTeamInjuries(teamName) {
    if (!teamName || !injuriesData || !injuryDataFreshness().fresh || !injuriesData.teams) return null;
    const teams = injuriesData.teams;
    if (teams[teamName]) return teams[teamName];
    for (const key of Object.keys(teams)) {
      if (sameTeam(key, teamName)) return teams[key];
    }
    return null;
  }
  function getMatchInjuries(homeName, awayName) {
    const freshness=injuryDataFreshness();
    if(!freshness.fresh)return {home:null,away:null,hasData:false,stale:true,freshness,autoContext:null};
    const home = findTeamInjuries(homeName);
    const away = findTeamInjuries(awayName);
    const attAbsH = Math.min(3, (home && home.assenze_attacco) || 0);
    const defAbsH = Math.min(3, (home && home.assenze_difesa) || 0);
    const attAbsA = Math.min(3, (away && away.assenze_attacco) || 0);
    const defAbsA = Math.min(3, (away && away.assenze_difesa) || 0);
    return {
      home,away,hasData:Boolean(home||away),stale:false,freshness,
      autoContext:{
        attackingAbsencesHome:attAbsH,defensiveAbsencesHome:defAbsH,
        attackingAbsencesAway:attAbsA,defensiveAbsencesAway:defAbsA,
        motivationHome:0,motivationAway:0
      }
    };
  }

  function matchOdds(m) {
    if(!m||!Array.isArray(oddsList)||!oddsList.length||!oddsMeta.fresh||!m.date||!m.home||!m.away)return null;
    const competition=m.competition||"serie-a";
    const matches=oddsList.filter(o=>{
      const rowCompetition=o.competition||(o.division==="I1"?"serie-a":o.division==="I2"?"serie-b":null);
      return rowCompetition===competition&&o.date===m.date&&sameTeam(o.home,m.home)&&sameTeam(o.away,m.away);
    });
    if(matches.length!==1)return null;
    return matches[0].odds&&typeof matches[0].odds==="object"?{...matches[0].odds,source:oddsMeta.source,sourceUpdatedAt:oddsMeta.updatedAt,sourceAgeHours:oddsMeta.ageHours,fixtureDate:matches[0].date}:null;
  }

  window.MM={loadOdds,matchOdds,getOddsMeta:()=>({...oddsMeta}),trainAvailableModels,loadInjuries,getInjuryFeedStatus:()=>({...injuryDataFreshness()}),getMatchInjuries,findTeamInjuries,$,esc,norm,sameTeam,loadData,backtest,getSelectedCompetition,getCompetitions:()=>Object.values(COMPETITIONS).map(item=>({...item})),competitionInfo,filterCompetition,forCompetition,get data(){return data;},hasScore,upcoming,dateLabel,shortDate,matchUrl,teamUrl,teamInitials,displayTeamName,badge,getTeams,groupByDate,standings,forecast,eventForecast,matchStandingsContext,teamStats,probs,isFavorite,toggleFavorite,seasonStart,formatNumber:(n,d=0)=>Number(n||0).toLocaleString('it-IT',{maximumFractionDigits:d}),status:m=>hasScore(m)?'Terminata':upcoming(m)?'In programma':'Da aggiornare'};
})();