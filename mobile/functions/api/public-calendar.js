const DATA_ROOT="https://raw.githubusercontent.com/oladeeayo/open-matchday/master/data/";
const HISTORY_ROOT="https://raw.githubusercontent.com/openfootball/football.json/master/";
const LEAGUES=[
 {id:"serie-a",folder:"ITA_1_serie-a",file:"it.1.json",history:true},
 {id:"champions-league",folder:"UEFA_1_champions-league",file:null,history:false}
];
const CACHE_SECONDS=900;
function csvRows(input){
 const rows=[];let row=[],field="",quoted=false;
 for(let i=0;i<input.length;i++){
  const ch=input[i];
  if(quoted){if(ch==='"'&&input[i+1]==='"'){field+='"';i++;}else if(ch==='"')quoted=false;else field+=ch;}
  else if(ch==='"')quoted=true;
  else if(ch===","){row.push(field);field="";}
  else if(ch==="\n"){row.push(field.replace(/\r$/,""));if(row.some(x=>x!==""))rows.push(row);row=[];field="";}
  else field+=ch;
 }
 if(field!==""||row.length){row.push(field.replace(/\r$/,""));rows.push(row);}
 if(!rows.length)return[];
 const headers=rows.shift();
 return rows.map(values=>Object.fromEntries(headers.map((key,index)=>[key,values[index]??""])));
}
function number(value){if(value===undefined||value===null||String(value).trim()==="")return null;const n=Number(value);return Number.isFinite(n)?n:null;}
function normalize(row,competition,finished){
 const hg=number(row.ft_home),ag=number(row.ft_away),done=finished&&hg!==null&&ag!==null;
 return {id:null,date:String(row.date||""),time:String(row.time||""),round:number(row.gw),stage:row.gw?"Giornata "+row.gw:"",home:String(row.home||""),away:String(row.away||""),hg:done?hg:null,ag:done?ag:null,ht:number(row.ht_home),at:number(row.ht_away),hs:number(row.home_shots),as:number(row.away_shots),hst:number(row.home_target),ast:number(row.away_target),hf:number(row.home_fouls),af:number(row.away_fouls),hc:number(row.home_corners),ac:number(row.away_corners),hc1:number(row.home_corners_1h),ac1:number(row.away_corners_1h),hc2:number(row.home_corners_2h),ac2:number(row.away_corners_2h),hy:number(row.home_yellow),ay:number(row.away_yellow),hr:number(row.home_red),ar:number(row.away_red),goalMinutes:String(row.goal_minutes||""),status:done?"FT":"NS",statusLong:done?"Terminata":"In programma",competition,source:"open-matchday"};
}
function normalizeFixture(row,competition){return normalize(row,competition,false);}
async function fetchText(url){
 const response=await fetch(url,{headers:{Accept:"text/plain"},signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error("dataset_http_"+response.status+" "+url);
 return response.text();
}
async function fetchJson(url){return JSON.parse(await fetchText(url));}
function seasonCode(year){return String(year).slice(-2)+String(year+1).slice(-2);}
function seasonFolder(year){return String(year)+"-"+String(year+1).slice(-2);}
async function getPublicCalendar(){
 const now=new Date(),season=now.getUTCMonth()>=6?now.getUTCFullYear():now.getUTCFullYear()-1,code=seasonCode(season);
 const jobs=LEAGUES.map(async league=>{
  const base=DATA_ROOT+league.folder+"/";
  const [resultsCsv,fixturesCsv]=await Promise.all([fetchText(base+"results_"+code+".csv"),fetchText(base+"fixtures_"+code+".csv")]);
  const results=csvRows(resultsCsv).map(row=>normalize(row,league.id,true)).filter(m=>m.date&&m.home&&m.away);
  const fixtures=csvRows(fixturesCsv).map(row=>normalizeFixture(row,league.id)).filter(m=>m.date&&m.home&&m.away);
  return {league,results,fixtures};
 });
 const settled=await Promise.allSettled(jobs),matches=[],history=[],errors=[];
 for(let i=0;i<settled.length;i++){
  const item=settled[i],league=LEAGUES[i];
  if(item.status!=="fulfilled"){errors.push(league.id+": "+String(item.reason?.message||item.reason));continue;}
  matches.push(...item.value.results,...item.value.fixtures);
  history.push(...item.value.results);
 }
 // Add five seasons of lightweight Serie A score history. The current season's
 // richer CSV records take precedence and carry event statistics.
 const historicalYears=await Promise.allSettled(Array.from({length:5},(_,i)=>season-1-i).map(async year=>{
  const url=HISTORY_ROOT+seasonFolder(year)+"/it.1.json";
  const payload=await fetchJson(url);
  return (payload.matches||[]).map(row=>{
   const ft=row.score?.ft||null,ht=row.score?.ht||null,done=Array.isArray(ft)&&ft.length>=2&&ft[0]!==null&&ft[1]!==null;
   return {id:null,date:String(row.date||""),time:String(row.time||""),round:number(String(row.round||"").match(/\d+/)?.[0]),stage:String(row.round||""),home:String(row.team1||""),away:String(row.team2||""),hg:done?number(ft[0]):null,ag:done?number(ft[1]):null,ht:Array.isArray(ht)?number(ht[0]):null,at:Array.isArray(ht)?number(ht[1]):null,hs:null,as:null,hst:null,ast:null,hf:null,af:null,hc:null,ac:null,hy:null,ay:null,hr:null,ar:null,status:done?"FT":"NS",statusLong:done?"Terminata":"In programma",competition:"serie-a",source:"openfootball · archivio storico"};
  }).filter(m=>m.date&&m.home&&m.away&&m.hg!==null&&m.ag!==null);
 }));
 historicalYears.forEach((result,index)=>{if(result.status==="fulfilled")history.push(...result.value);else errors.push("Archivio Serie A "+seasonFolder(season-1-index)+" non disponibile");});
 if(!matches.length) return new Response(JSON.stringify({configured:true,type:"calendar",error:"I dataset pubblici non sono raggiungibili o non contengono dati per la stagione "+code+".",matches:[],history:[],errors}),{status:503,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
 matches.sort((a,b)=>(a.date+(a.time||"")).localeCompare(b.date+(b.time||"")));
 history.sort((a,b)=>a.date.localeCompare(b.date));
 const body={configured:true,type:"calendar",source:"open-matchday + openfootball storico",season,matches,history,errors,updatedAt:new Date().toISOString(),note:"Calendari e risultati aggiornati quotidianamente dal dataset open-matchday; statistiche evento solo quando presenti. Archivio Serie A precedente da openfootball. Nessun dato live, quote, xG, formazioni o infortuni."};
 return new Response(JSON.stringify(body),{headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"public, max-age="+CACHE_SECONDS}});
}
export async function onRequestGet(){return getPublicCalendar();}
