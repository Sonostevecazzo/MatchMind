// MatchMind NBA model: ESPN scoreboard + chronological Elo and points baseline.
export const ESPN_NBA = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard";
const n = v => v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null;

export function normalizeNbaEvent(event) {
  const comp = event?.competitions?.[0] || {};
  const list = Array.isArray(comp.competitors) ? comp.competitors : [];
  const home = list.find(c => c.homeAway === "home");
  const away = list.find(c => c.homeAway === "away");
  if (!home || !away || !event?.date) return null;
  const type = comp.status?.type || {}, done = Boolean(type.completed);
  const hp = n(home.score), ap = n(away.score);
  return {
    id: String(event.id || ""), start: event.date,
    home: home.team?.displayName || "", homeAbbr: home.team?.abbreviation || "", homeLogo: home.team?.logo || null,
    away: away.team?.displayName || "", awayAbbr: away.team?.abbreviation || "", awayLogo: away.team?.logo || null,
    hp: done ? hp : null, ap: done ? ap : null,
    status: done ? "FT" : type.state === "in" ? "LIVE" : "NS",
    statusLabel: type.shortDetail || type.description || "",
    seasonType: event.season?.type ?? null
  };
}

export function seasonMonths(startYear) {
  return [10,11,12].map(m => `${startYear}${String(m).padStart(2,"0")}`)
    .concat([1,2,3,4,5,6].map(m => `${startYear+1}${String(m).padStart(2,"0")}`));
}
export function currentSeasonStart(now = new Date()) {
  return now.getUTCMonth() >= 8 ? now.getUTCFullYear() : now.getUTCFullYear()-1;
}

export function buildNbaModel(games, { k=20, homeAdv=70, carryOver=.75 } = {}) {
  const elo = new Map(), pts = new Map();
  const getElo = t => elo.has(t) ? elo.get(t) : 1500;
  const getPts = t => { if(!pts.has(t)) pts.set(t,{for:0,against:0,games:0,w:0,l:0}); return pts.get(t); };
  let lastSeasonKey=null, leagueTotal=0, leagueGames=0;
  const finished=(games||[]).filter(g=>g.status==="FT"&&Number.isFinite(g.hp)&&Number.isFinite(g.ap)).slice().sort((a,b)=>a.start.localeCompare(b.start));
  for(const g of finished){
    const d=new Date(g.start), seasonKey=d.getUTCMonth()>=8?d.getUTCFullYear():d.getUTCFullYear()-1;
    if(lastSeasonKey!==null&&seasonKey!==lastSeasonKey){for(const [t,r] of elo) elo.set(t,1500+(r-1500)*carryOver);pts.clear();leagueTotal=0;leagueGames=0;}
    lastSeasonKey=seasonKey;
    const rh=getElo(g.home),ra=getElo(g.away),expHome=1/(1+10**((ra-(rh+homeAdv))/400));
    const margin=Math.abs(g.hp-g.ap),winnerDiff=g.hp>g.ap?rh+homeAdv-ra:ra-rh-homeAdv;
    const mult=((margin+3)**.8)/(7.5+.006*winnerDiff),delta=k*mult*((g.hp>g.ap?1:0)-expHome);
    elo.set(g.home,rh+delta);elo.set(g.away,ra-delta);
    const h=getPts(g.home),a=getPts(g.away);
    h.for+=g.hp;h.against+=g.ap;h.games++;a.for+=g.ap;a.against+=g.hp;a.games++;
    if(g.hp>g.ap){h.w++;a.l++;}else{a.w++;h.l++;}
    leagueTotal+=g.hp+g.ap;leagueGames++;
  }
  return {elo,pts,leagueAvg:leagueGames?leagueTotal/leagueGames/2:114,homeAdv,sample:finished.length};
}

export function predictNba(model, home, away) {
  const rh=model.elo.get(home)??1500,ra=model.elo.get(away)??1500;
  const pHome=1/(1+10**((ra-(rh+model.homeAdv))/400)),avg=model.leagueAvg;
  const h=model.pts.get(home),a=model.pts.get(away);
  const shrink=(s,games)=>(s*games+avg*5)/(games+5);
  const hOff=shrink(h?h.for/h.games:avg,h?.games||0),hDef=shrink(h?h.against/h.games:avg,h?.games||0);
  const aOff=shrink(a?a.for/a.games:avg,a?.games||0),aDef=shrink(a?a.against/a.games:avg,a?.games||0);
  const homePoints=(hOff+aDef)/2+1.5,awayPoints=(aOff+hDef)/2-1.5;
  return {homeWin:pHome,awayWin:1-pHome,homePoints:Math.round(homePoints),awayPoints:Math.round(awayPoints),
    spread:Math.round((homePoints-awayPoints)*2)/2,total:Math.round((homePoints+awayPoints)*2)/2,
    eloHome:Math.round(rh),eloAway:Math.round(ra),reliable:(h?.games||0)>=5&&(a?.games||0)>=5};
}

export async function getNbaSchedule({now=new Date(),fetchImpl=fetch}={}) {
  const season=currentSeasonStart(now),months=[...seasonMonths(season-1),...seasonMonths(season)];
  const settled=await Promise.allSettled(months.map(async month=>{
    const response=await fetchImpl(`${ESPN_NBA}?dates=${month}&limit=1000`,{headers:{Accept:"application/json"},signal:AbortSignal.timeout(12000)});
    if(!response.ok) throw new Error(`ESPN NBA ${month}: HTTP ${response.status}`);
    const body=await response.json();return Array.isArray(body.events)?body.events:[];
  }));
  const seen=new Set(),games=[],errors=[];
  for(const result of settled){
    if(result.status!=="fulfilled"){errors.push(String(result.reason?.message||result.reason));continue;}
    for(const event of result.value){const game=normalizeNbaEvent(event);if(game&&game.home&&game.away&&!seen.has(game.id)){seen.add(game.id);games.push(game);}}
  }
  if(!games.length) throw new Error(errors[0]||"ESPN non ha restituito partite NBA.");
  games.sort((a,b)=>a.start.localeCompare(b.start));
  const model=buildNbaModel(games),seasonStartIso=`${season}-09-01`;
  const current=games.filter(g=>g.start>=seasonStartIso).map(g=>({...g,prediction:g.status==="FT"?null:predictNba(model,g.home,g.away)}));
  const standings=[...model.pts.entries()].map(([team,p])=>({team,games:p.games,wins:p.w,losses:p.l,elo:Math.round(model.elo.get(team)??1500),
    pointsFor:p.games?Math.round(p.for/p.games*10)/10:null,pointsAgainst:p.games?Math.round(p.against/p.games*10)/10:null}))
    .sort((a,b)=>b.elo-a.elo);
  return {source:"ESPN · NBA",season:`${season}-${String(season+1).slice(-2)}`,games:current,standings,sample:model.sample,errors,updatedAt:new Date().toISOString()};
}
