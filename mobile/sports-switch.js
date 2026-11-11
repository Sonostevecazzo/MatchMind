(function(){
  "use strict";
  const page=document.body?.dataset.page||"";
  if(!["matches","live","bets"].includes(page))return;
  const mount=document.getElementById("sportSwitchMount");
  const viewId=page==="bets"?"nbaIntegratedView":"nbaIntegratedView";
  const football=document.getElementById(page==="bets"?"footballBuilderView":"footballView");
  if(!mount||!football)return;
  const nba=document.getElementById(viewId);
  if(!nba)return;
  mount.innerHTML='<div class="sport-switch" role="group" aria-label="Seleziona sport"><button type="button" class="sport-switch-button is-active" data-sport="football" aria-pressed="true">Calcio</button><button type="button" class="sport-switch-button" data-sport="nba" aria-pressed="false">NBA</button></div>';
  nba.innerHTML=`
    <section class="section panel panel-pad nba-integrated-filter">
      <div class="nba-filter-grid">
        <div class="field"><label for="nbaSearch">Cerca squadra NBA</label><input id="nbaSearch" type="search" placeholder="Lakers, Celtics…" autocomplete="off"></div>
        <div class="field"><label for="nbaDateFilter">Data partita</label><input id="nbaDateFilter" type="date"></div>
      </div>
      <div class="nba-toolbar" id="nbaTabs" role="tablist" aria-label="Calendario NBA">
        <button class="pill active" data-view="upcoming" role="tab" aria-selected="true">In programma / Live</button>
        <button class="pill" data-view="results" role="tab" aria-selected="false">Risultati</button>
        <button class="pill" data-view="ranking" role="tab" aria-selected="false">Forza squadre</button>
      </div>
    </section>
    <section class="section">
      <div class="section-head"><div><h2 id="nbaListTitle">In programma</h2><p id="nbaSummary">Caricamento calendario NBA…</p></div><button id="nbaRefresh" class="secondary" type="button">Aggiorna</button></div>
      <div id="nbaList" class="nba-list"><div class="loading-state">Caricamento calendario NBA…</div></div>
      <div class="nba-more-wrap"><button id="nbaMore" class="ghost" type="button" hidden>Mostra altre partite</button></div>
    </section>
    <section id="nbaSlip" class="section panel panel-pad nba-slip" aria-live="polite"></section>
    <p class="data-disclaimer">NBA usa un modello Elo dedicato. Le probabilità sono stime; le quote non vengono inventate e vanno inserite solo se verificate.</p>
  `;
  if(!document.getElementById("globalStatus")){
    const status=document.createElement("div");status.id="globalStatus";status.className="status-line";status.setAttribute("aria-live","polite");mount.parentNode.insertBefore(status,nba.nextSibling);
  }
  const buttons=[...mount.querySelectorAll("[data-sport]")];
  const fromUrl=new URLSearchParams(location.search).get("sport");
  let initial=fromUrl==="nba"?"nba":"football";
  if(!fromUrl){try{initial=localStorage.getItem("matchmind-sport-v1")==="nba"?"nba":"football";}catch{}}
  function setSport(sport){
    const selected=sport==="nba"?"nba":"football";
    football.hidden=selected==="nba";
    nba.hidden=selected!=="nba";
    buttons.forEach(button=>{
      const active=button.dataset.sport===selected;
      button.classList.toggle("is-active",active);
      button.setAttribute("aria-pressed",String(active));
    });
    document.querySelectorAll(".competition-picker").forEach(field=>{field.hidden=selected==="nba";});
    document.body.dataset.sportView=selected;
    try{localStorage.setItem("matchmind-sport-v1",selected);}catch{}
    const heading=document.getElementById("pageSubtitle");
    if(heading&&page!=="bets")heading.textContent=selected==="nba"?"Calendario, risultati e stime statistiche NBA.":"Consulta le partite, filtra la competizione e costruisci la schedina.";
    const url=new URL(location.href);
    if(selected==="nba")url.searchParams.set("sport","nba");else url.searchParams.delete("sport");
    history.replaceState(null,"",url.pathname+url.search+url.hash);
  }
  mount.addEventListener("click",event=>{
    const button=event.target.closest("[data-sport]");
    if(button)setSport(button.dataset.sport);
  });
  setSport(initial);
})();