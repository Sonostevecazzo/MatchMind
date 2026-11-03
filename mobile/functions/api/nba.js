const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba";
const CACHE_PREFIX = "/__matchmind_nba_cache/";
function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});}
async function getJson(context,url,key,ttl){
  let cache=null,cacheKey=null;
  try{cache=ttl>0?caches.default:null;cacheKey=cache?new Request(new URL(CACHE_PREFIX+encodeURIComponent(key),new URL(context.request.url).origin)):null;const hit=cache&&await cache.match(cacheKey);if(hit)return await hit.json();}catch{cache=null;cacheKey=null;}
  const response=await fetch(url,{headers:{Accept:"application/json","User-Agent":"MatchMind/1.0 (NBA data dashboard)"},signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw new Error("ESPN ha risposto HTTP "+response.status);
  const data=await response.json();
  try{if(cache&&cacheKey)await cache.put(cacheKey,new Response(JSON.stringify(data),{headers:{"Cache-Control":"public, max-age="+ttl,"Content-Type":"application/json"}}));}catch{}
  return data;
}
function dateRange(value){
  if(value&&/^\d{8}-\d{8}$/.test(value)){const [from,to]=value.split("-");return value;}
  const now=new Date(),from=new Date(now);from.setUTCDate(from.getUTCDate()-1);const to=new Date(now);to.setUTCDate(to.getUTCDate()+5);
  const fmt=d=>d.toISOString().slice(0,10).replace(/-/g,"");return fmt(from)+"-"+fmt(to);
}
function flattenStandings(node,out=[]){
  if(!node||typeof node!=="object")return out;
  if(Array.isArray(node.entries)){for(const entry of node.entries){const team=entry.team||{};const stats=Object.fromEntries((entry.stats||[]).map(s=>[s.name||s.abbreviation,s.displayValue||s.value]));out.push({id:team.id,name:team.displayName||team.name,abbreviation:team.abbreviation,logo:team.logos&&team.logos[0]&&team.logos[0].href,conference:node.name||node.abbreviation||"",wins:stats.wins||stats.W,losses:stats.losses||stats.L,winPct:stats.winPercent||stats.winPct,streak:stats.streak,home:stats.Home,away:stats.Road,pointsFor:stats.pointsFor,pointsAgainst:stats.pointsAgainst});}}
  for(const child of node.children||[])flattenStandings(child,out);
  return out;
}
function parseLeaders(data){
  const groups=data&&data.leaders||[];
  return groups.map(group=>({name:group.displayName||group.name||group.abbreviation,leaders:(group.leaders||[]).slice(0,10).map(item=>({name:item.athlete&&item.athlete.displayName||item.athlete&&item.athlete.fullName||"—",team:item.team&&item.team.abbreviation||item.athlete&&item.athlete.team&&item.athlete.team.abbreviation||"",logo:item.athlete&&item.athlete.headshot&&item.athlete.headshot.href||"",value:item.displayValue||item.value||"",rank:item.rank||null,href:item.athlete&&item.athlete.links&&item.athlete.links[0]&&item.athlete.links[0].href||""}))}));
}
function parseGames(data){
 return (data&&data.events||[]).map(event=>{
  const comp=event.competitions&&event.competitions[0]||{},teams=comp.competitors||[];
  const home=teams.find(t=>t.homeAway==="home")||{},away=teams.find(t=>t.homeAway==="away")||{};
  const status=comp.status&&comp.status.type||event.status&&event.status.type||{};
  return {id:event.id,name:event.name,date:event.date,status:status.description||status.detail||"Programmata",state:status.state||"pre",completed:Boolean(status.completed),home:{name:home.team&&home.team.displayName||"Casa",abbr:home.team&&home.team.abbreviation||"",logo:home.team&&home.team.logo||"",score:home.score||""},away:{name:away.team&&away.team.displayName||"Trasferta",abbr:away.team&&away.team.abbreviation||"",logo:away.team&&away.team.logo||"",score:away.score||""},venue:comp.venue&&comp.venue.fullName||"",broadcast:comp.broadcasts&&comp.broadcasts[0]&&comp.broadcasts[0].names&&comp.broadcasts[0].names.join(", ")||""};
 });
}
export async function onRequestGet(context){
 const url=new URL(context.request.url),type=url.searchParams.get("type")||"dashboard";
 try{
  if(type==="boxscore"){
   const id=url.searchParams.get("event");
   if(!/^\d{5,15}$/.test(id||""))return json({error:"ID partita non valido."},400);
   const data=await getJson(context,ESPN_BASE+"/summary?event="+encodeURIComponent(id),"boxscore-"+id,45);
   const groups=data&&data.boxscore&&data.boxscore.players||[];
   const teams=groups.map(group=>({team:group.team&&group.team.displayName||"Squadra",abbreviation:group.team&&group.team.abbreviation||"",statistics:(group.statistics||[]).map(stat=>({name:stat.name||stat.label,labels:stat.labels||[],athletes:(stat.athletes||[]).map(row=>({name:row.athlete&&row.athlete.displayName||"—",starter:row.starter,stats:row.stats||[],didNotPlay:row.didNotPlay||false})).filter(row=>!row.didNotPlay)}))}));
   return json({configured:true,type,source:"ESPN",updatedAt:new Date().toISOString(),name:data.header&&data.header.name||"",teams});
  }
  const dates=dateRange(url.searchParams.get("dates"));
  const season="2026";
  const [scoreboard,standings,leaders]=await Promise.allSettled([
   getJson(context,ESPN_BASE+"/scoreboard?dates="+dates+"&limit=100","scoreboard-"+dates,45),
   getJson(context,ESPN_BASE+"/standings?season="+season,"standings-"+season,900),
   getJson(context,ESPN_BASE+"/leaders?season="+season,"leaders-"+season,900)
  ]);
  const errors=[];
  if(scoreboard.status==="rejected")errors.push("Calendario: "+String(scoreboard.reason&&scoreboard.reason.message||"non disponibile"));
  if(standings.status==="rejected")errors.push("Classifiche: "+String(standings.reason&&standings.reason.message||"non disponibili"));
  if(leaders.status==="rejected")errors.push("Statistiche: "+String(leaders.reason&&leaders.reason.message||"non disponibili"));
  if(scoreboard.status==="rejected"&&standings.status==="rejected"&&leaders.status==="rejected")return json({configured:true,error:errors.join(" · "),source:"ESPN"},502);
  const tree=standings.status==="fulfilled"?(standings.value.children||[]).flatMap(c=>flattenStandings(c,[])):standings.status==="fulfilled"?flattenStandings(standings.value):[];
  return json({configured:true,type,source:"ESPN",season:"2026-27",updatedAt:new Date().toISOString(),dateRange:dates,games:scoreboard.status==="fulfilled"?parseGames(scoreboard.value):[],standings:tree,leaders:leaders.status==="fulfilled"?parseLeaders(leaders.value):[],errors});
 }catch(error){return json({configured:true,source:"ESPN",error:error.message||"Errore nel servizio NBA."},502);}
}
