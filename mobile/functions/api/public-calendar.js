const ROOT="https://raw.githubusercontent.com/openfootball/football.json/master/";
const LEAGUES=[{id:"serie-a",file:"it.1.json"}];
const CACHE_SECONDS=900;
function seasonFolder(year){return String(year)+"-"+String(year+1).slice(-2);}
function normalize(match,competition){
  const score=match.score||{};
  const ft=Array.isArray(score)?score:(score.ft||null);
  const ht=score.ht||null;
  const valid=Array.isArray(ft)&&ft.length>=2&&ft[0]!=null&&ft[1]!=null;
  const round=String(match.round||"").match(/(\d+)/);
  return {id:null,date:String(match.date||""),time:String(match.time||""),round:round?Number(round[1]):null,stage:match.round||"",home:match.team1||"",away:match.team2||"",hg:valid?Number(ft[0]):null,ag:valid?Number(ft[1]):null,ht:Array.isArray(ht)?Number(ht[0]):null,at:Array.isArray(ht)?Number(ht[1]):null,hs:null,as:null,hst:null,ast:null,hf:null,af:null,hc:null,ac:null,hy:null,ay:null,hr:null,ar:null,status:valid?"FT":"NS",statusLong:valid?"Terminata":"In programma",competition,source:"openfootball · dataset pubblico"};
}
async function fetchJson(url){
 const response=await fetch(url,{headers:{Accept:"application/json"},signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error("openfootball_http_"+response.status);
 return response.json();
}
async function getPublicCalendar(context,season){
 const jobs=[];
 for(const league of LEAGUES)for(let offset=0;offset<5;offset++)jobs.push({league,year:season-offset});
 const results=await Promise.allSettled(jobs.map(async job=>{
  const url=ROOT+seasonFolder(job.year)+"/"+job.league.file;
  const payload=await fetchJson(url);
  return {job,matches:(Array.isArray(payload.matches)?payload.matches:[]).map(x=>normalize(x,job.league.id)).filter(x=>x.date&&x.home&&x.away)};
 }));
 const matches=[],history=[],errors=[];
 results.forEach((result,index)=>{
  const job=jobs[index];
  if(result.status!=="fulfilled"){errors.push(seasonFolder(job.year)+": dataset non pubblicato o non raggiungibile");return;}
  if(job.year===season)matches.push(...result.value.matches);
  history.push(...result.value.matches.filter(x=>x.hg!==null&&x.ag!==null));
 });
 if(!matches.length)return new Response(JSON.stringify({configured:true,type:"calendar",error:"Il dataset pubblico openfootball non contiene ancora il calendario della stagione "+seasonFolder(season)+". Nessuna partita è stata inventata.",source:"openfootball",matches:[],history:[],errors}),{status:503,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
 const body={configured:true,type:"calendar",source:"openfootball · JSON pubblico CC0",season,matches,history,errors,updatedAt:new Date().toISOString(),note:"Calendario e risultati pubblici. Aggiornamento dipendente dai contributori del dataset; non è un feed live e non contiene statistiche evento o quote."};
 return new Response(JSON.stringify(body),{headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"public, max-age="+CACHE_SECONDS}});
}
export async function onRequestGet(context){
 const season=(()=>{const d=new Date();return d.getUTCMonth()>=6?d.getUTCFullYear():d.getUTCFullYear()-1;})();
 return getPublicCalendar(context,season);
}
