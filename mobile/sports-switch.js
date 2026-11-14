/* MatchMind football-only interface. NBA switch removed. */
(function(){
  "use strict";
  const page=document.body?.dataset.page||"";
  if(!["matches","live","bets"].includes(page))return;
  const mount=document.getElementById("sportSwitchMount");
  const football=document.getElementById(page==="bets"?"footballBuilderView":"footballView");
  const nba=document.getElementById("nbaIntegratedView");
  if(mount)mount.remove();
  if(football)football.hidden=false;
  if(nba){nba.hidden=true;nba.replaceChildren();}
  document.body.dataset.sportView="football";
  try{localStorage.setItem("matchmind-sport-v1","football");}catch{}
  const url=new URL(location.href);
  if(url.searchParams.has("sport")){url.searchParams.delete("sport");history.replaceState(null,"",url.pathname+url.search+url.hash);}
})();
