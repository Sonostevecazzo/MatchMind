/* Live scoreboard and honest, stats-led tactical illustration. */
(() => {
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const fixtureId = params.get("fixture");
  const competition = window.MM?.getSelectedCompetition?.() || "serie-a";
  const number = value => Number.isFinite(Number(value)) ? Number(value) : null;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
  let busy = false;
  let lastDetail = null;
  let pollHandle = null;
  let listMatchCount = 0;
  let requestFailed = false;
  let nextScheduledKickoff = null;
  let simulationMode = "live";
  let animationTimer = null;
  let animationTick = 0;

  const ESPN_BASE = "https://site.web.api.espn.com/apis/site/v2/sports/soccer/";
  const ESPN_LEAGUES = { "serie-a": "ita.1", "champions-league": "uefa.champions", "europa-league": "uefa.europa" };

  async function requestLiveDirect(query = "") {
    const qParams = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
    const targetComp = qParams.get("competition") || competition || "serie-a";
    const leagueCode = ESPN_LEAGUES[targetComp] || "ita.1";
    const leagueName = targetComp === "champions-league" ? "Champions League" : targetComp === "europa-league" ? "Europa League" : "Serie A";
    const fid = qParams.get("fixture");

    if (fid) {
      const summaryUrl = ESPN_BASE + leagueCode + "/summary?event=" + encodeURIComponent(fid);
      const res = await fetch(summaryUrl, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error("Partita live non trovata su ESPN (" + res.status + ")");
      const sum = await res.json();
      const comp = sum?.header?.competitions?.[0] || {};
      const competitors = Array.isArray(comp.competitors) ? comp.competitors : [];
      const home = competitors.find(item => item?.homeAway === "home") || competitors[0] || {};
      const away = competitors.find(item => item?.homeAway === "away") || competitors[1] || {};
      const rawStatus = comp.status || {};
      const statusType = rawStatus.type || rawStatus;
      const state = String(statusType.state || "").toLowerCase();
      const statusName = String(statusType.name || statusType.description || "").toUpperCase();
      const displayClock = String(rawStatus.displayClock || statusType.displayClock || "");
      const clockMatch = displayClock.match(/(\d{1,3})/);
      const elapsed = clockMatch ? Number(clockMatch[1]) : null;
      let short = "NS";
      if (statusType.completed || state === "post") short = "FT";
      else if (statusName.includes("HALF")) short = "HT";
      else if (state === "in") short = (elapsed !== null && elapsed > 45) ? "2H" : "1H";

      const fixture = {
        id: String(fid),
        date: comp.date || null,
        timestamp: comp.date ? Date.parse(comp.date) : null,
        elapsed, extra: null, status: short,
        statusLong: statusType.detail || statusType.description || short,
        league: leagueName,
        home: { id: home?.team?.id || null, name: home?.team?.displayName || home?.team?.name || "Casa", logo: home?.team?.logo || null },
        away: { id: away?.team?.id || null, name: away?.team?.displayName || away?.team?.name || "Trasferta", logo: away?.team?.logo || null },
        goals: { home: home?.score != null ? Number(home.score) : null, away: away?.score != null ? Number(away.score) : null },
        halftime: { home: null, away: null }
      };

      const eventRows = sum?.keyEvents || sum?.plays?.items || sum?.plays || [];
      const events = eventRows.map(item => {
        const clock = item?.clock?.displayValue || item?.time?.displayValue || "";
        const m = String(clock).match(/(\d{1,3})/);
        const p = item?.participants?.[0]?.athlete || {};
        return {
          minute: m ? Number(m[1]) : 0, extra: null,
          team: item?.team?.displayName || item?.team?.name || null,
          player: p.displayName || p.name || null,
          type: String(item?.type?.text || item?.type || "Evento"),
          detail: item?.text || item?.description || ""
        };
      }).sort((a, b) => a.minute - b.minute);

      const statsRows = sum?.boxscore?.teams || sum?.boxscore?.statistics || [];
      const statistics = normalizeEspnStats(statsRows);
      const lineups = normalizeEspnLineups(sum?.rosters);

      return {
        configured: false, fallback: true, source: "ESPN", sourceLabel: "ESPN · fonte pubblica",
        updatedAt: new Date().toISOString(), fixture, events, statistics, lineups
      };
    }

    const scoreboardUrl = ESPN_BASE + leagueCode + "/scoreboard?limit=100";
    const res = await fetch(scoreboardUrl, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error("ESPN HTTP " + res.status);
    const data = await res.json();
    const matches = (data.events || []).map(event => {
      const comp = event?.competitions?.[0] || {};
      const competitors = Array.isArray(comp.competitors) ? comp.competitors : [];
      const home = competitors.find(item => item?.homeAway === "home") || competitors[0] || {};
      const away = competitors.find(item => item?.homeAway === "away") || competitors[1] || {};
      const statusType = comp.status?.type || comp.status || {};
      const state = String(statusType.state || "").toLowerCase();
      const statusName = String(statusType.name || statusType.description || "").toUpperCase();
      const displayClock = String(comp.status?.displayClock || statusType.displayClock || "");
      const clockMatch = displayClock.match(/(\d{1,3})/);
      const elapsed = clockMatch ? Number(clockMatch[1]) : null;
      let short = "NS";
      if (statusType.completed || state === "post") short = "FT";
      else if (statusName.includes("HALF")) short = "HT";
      else if (state === "in") short = (elapsed !== null && elapsed > 45) ? "2H" : "1H";
      return {
        id: String(event?.id || comp.id || ""),
        date: event?.date || comp.date || null,
        timestamp: event?.date ? Date.parse(event.date) : null,
        elapsed, extra: null, status: short,
        statusLong: statusType.detail || statusType.description || short,
        league: leagueName,
        home: { id: home?.team?.id || null, name: home?.team?.displayName || home?.team?.name || "Casa", logo: home?.team?.logo || null },
        away: { id: away?.team?.id || null, name: away?.team?.displayName || away?.team?.name || "Trasferta", logo: away?.team?.logo || null },
        goals: { home: home?.score != null ? Number(home.score) : null, away: away?.score != null ? Number(away.score) : null }
      };
    }).filter(m => ["1H", "HT", "2H", "ET", "LIVE"].includes(m.status) && m.id)
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    return {
      configured: false, fallback: true, source: "ESPN", sourceLabel: "ESPN · fonte pubblica",
      competition: targetComp, updatedAt: new Date().toISOString(), matches,
      note: "Risultati live pubblici ESPN. Aggiornamento automatico."
    };
  }

  async function requestLive(query = "") {
    try {
      const response = await fetch("./api/live-match" + query, { headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(10000) });
      let payload = {};
      try { payload = await response.json(); } catch {}
      if (response.ok && !payload.error) return payload;
    } catch (_) {}
    return await requestLiveDirect(query);
  }
  function logo(team) {
    if (!team?.logo) return '<span class="live-team-monogram">' + esc((team?.name || "?").slice(0, 2).toUpperCase()) + "</span>";
    return '<img class="live-team-logo" src="' + esc(team.logo) + '" alt="" loading="lazy" onerror="this.outerHTML=\'<span class=&quot;live-team-monogram&quot;>?</span>\'">';
  }

  function minute(match) {
    if (match.elapsed != null) return match.elapsed + (match.extra ? "+" + match.extra : "") + "′";
    return match.statusLong || match.status;
  }

  function teamKey(match){const clean=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");return [String(match.date||"").slice(0,10),clean(match.home?.name||match.home),clean(match.away?.name||match.away)].join("|");}
  function localDate(value){if(!value)return "Data da definire";const d=new Date(String(value).length===10?value+"T12:00:00":value);return Number.isNaN(d.getTime())?String(value):d.toLocaleDateString("it-IT",{weekday:"short",day:"2-digit",month:"short"});}
  function kickoffTimestamp(match){const time=String(match.time||"").trim();return Date.parse(String(match.date||"")+(time?"T"+time+(time.length===5?":00":""):"T20:00:00"));}
  function localTime(value){if(!value||String(value).length===10)return "";const d=new Date(value);return Number.isNaN(d.getTime())?"":d.toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit"});}
  function notifySnapshot(payload){const api=window.MMNotifications;if(!api)return;let prev={};try{prev=JSON.parse(localStorage.getItem("matchmind-live-snapshots-v1")||"{}")||{};}catch{}const next={...prev};(payload.matches||[]).forEach(m=>{const k=teamKey(m),old=prev[k],s=String(m.status||"").toUpperCase();const score=(m.goals.home??"")+"-"+(m.goals.away??"");if(old&&["NS","TBD"].includes(old.status)&&["1H","2H","ET","LIVE"].includes(s))api.notifyOnce("kickoff:"+k,"kickoff","Calcio d'inizio",m.home.name+" – "+m.away.name+" è iniziata.","live-"+k);if(old&&old.score&&old.score!==score)api.notifyOnce("score:"+k+":"+score,"goals","Punteggio aggiornato · "+m.home.name+" – "+m.away.name,m.home.name+" "+(m.goals.home??"—")+" – "+(m.goals.away??"—")+" "+m.away.name,"score-"+k);if(old&&old.status!=="HT"&&s==="HT")api.notifyOnce("half:"+k,"halftime","Intervallo",m.home.name+" "+(m.goals.home??"—")+" – "+(m.goals.away??"—")+" "+m.away.name,"live-"+k);if(old&&!["FT","AET","PEN"].includes(old.status)&&["FT","AET","PEN"].includes(s))api.notifyOnce("end:"+k,"fulltime","Fine partita",m.home.name+" "+(m.goals.home??"—")+" – "+(m.goals.away??"—")+" "+m.away.name,"live-"+k);next[k]={status:s,score,updatedAt:Date.now()};});try{localStorage.setItem("matchmind-live-snapshots-v1",JSON.stringify(Object.fromEntries(Object.entries(next).slice(-160))));}catch{}}
  function renderList(payload,calendar){
    const liveMatches=Array.isArray(payload?.matches)?payload.matches:[];
    notifySnapshot(payload||{});
    $("liveStatus").textContent=(payload?.sourceLabel||payload?.source||"Fonte live")+(payload?.fallbackReason?" · fallback: "+payload.fallbackReason:"")+" · "+liveMatches.length+" partite in diretta";
    listMatchCount=liveMatches.length;
    $("liveListUpdated").textContent="Ultimo controllo "+new Date(payload?.updatedAt||Date.now()).toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit"})+" · aggiornamento automatico";
    $("liveMatches").innerHTML=liveMatches.length?liveMatches.map(m=>'<a class="live-match-card" href="./live.html?fixture='+encodeURIComponent(m.id)+'&competition='+encodeURIComponent(competition)+'&source='+encodeURIComponent(payload.source==="ESPN"?"espn":"api-football")+'&date='+encodeURIComponent(String(m.date||"").slice(0,10))+'&home='+encodeURIComponent(m.home.name)+'&away='+encodeURIComponent(m.away.name)+'"><div class="live-match-meta"><span class="live-indicator"><i></i> LIVE</span><span>'+esc(m.league||"Calcio")+'</span><b>'+esc(minute(m))+'</b></div><div class="live-match-teams"><div>'+logo(m.home)+'<b>'+esc(m.home.name)+'</b></div><strong>'+esc(m.goals.home??"—")+' – '+esc(m.goals.away??"—")+'</strong><div>'+logo(m.away)+'<b>'+esc(m.away.name)+'</b></div></div><div class="live-match-footer">Apri centro partita <span>→</span></div></a>').join(""):'<div class="live-empty"><b>Nessuna partita in diretta</b><p>Le prossime partite sono riportate qui sotto. Punteggio e minutaggio appariranno al calcio d’inizio.</p></div>';
    const now=Date.now(),end=now+7*86400000;
    const upcoming=(calendar?.matches||[]).filter(m=>((m.competition||"serie-a")===competition)&&m.status==="NS"&&m.date).filter(m=>{const d=kickoffTimestamp(m);return Number.isFinite(d)&&d>=now-3600000&&d<=end;}).sort((x,y)=>(x.date+(x.time||"")).localeCompare(y.date+(y.time||""))).slice(0,12);
    (calendar?.matches||[]).filter(m=>m.status==="FT"&&m.date).forEach(m=>{const key=teamKey(m);let old=null;try{old=JSON.parse(localStorage.getItem("matchmind-live-snapshots-v1")||"{}")?.[key];}catch{}if(old&&["1H","2H","HT","ET","LIVE"].includes(old.status))window.MMNotifications?.notifyOnce("calendar-ft:"+key,"fulltime","Fine partita",m.home+" "+(m.hg??"—")+" – "+(m.ag??"—")+" "+m.away,"ft-"+key);});
    nextScheduledKickoff=upcoming.length?kickoffTimestamp(upcoming[0]):null;
    let prev={};try{prev=JSON.parse(localStorage.getItem("matchmind-live-snapshots-v1")||"{}")||{};}catch{}upcoming.forEach(m=>{const k=teamKey(m);if(!prev[k])prev[k]={status:"NS",updatedAt:Date.now()};});try{localStorage.setItem("matchmind-live-snapshots-v1",JSON.stringify(Object.fromEntries(Object.entries(prev).slice(-160))));}catch{}
    $("upcomingMatches").innerHTML=upcoming.length?upcoming.map(m=>{const league=m.competition==="europa-league"?"Europa League":m.competition==="champions-league"?"Champions League":"Serie A";return '<article class="live-match-card scheduled-match"><div class="live-match-meta"><span class="scheduled-indicator">IN PROGRAMMA</span><span>'+league+'</span><b>'+esc(localDate(m.date))+'</b></div><div class="live-match-teams"><div><b>'+esc(m.home)+'</b></div><strong class="scheduled-time">'+esc(m.time||localTime(m.date)||"Orario da definire")+'</strong><div><b>'+esc(m.away)+'</b></div></div><div class="live-match-footer"><span>Calcio d’inizio</span><span>◷</span></div></article>';}).join(""):'<div class="live-empty"><b>Nessuna partita in programma nei prossimi 7 giorni</b><p>Non risultano altri incontri imminenti nel calendario della competizione selezionata.</p><a href="./matches.html">Apri calendario completo →</a></div>';
  }
  function statValue(team, label) {
    const list = lastDetail?.statistics || [];
    const row = list.find(item => item.teamId === team.id || item.team === team.name);
    return row?.values?.find(value => value.type === label)?.value ?? null;
  }

  function asNumber(value) {
    if (value == null || value === "—") return null;
    const n = Number(String(value).replace("%", "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }

  function normalizeEspnStats(rows) {
    return (Array.isArray(rows) ? rows : []).map(entry => {
      const team = entry?.team || entry?.competitor || {};
      const values = [];
      (Array.isArray(entry?.statistics) ? entry.statistics : []).forEach(item => {
        const label = String(item?.label || item?.displayName || "");
        const name = String(item?.name || "").toLowerCase();
        const value = item?.displayValue ?? item?.value ?? null;
        if (label) values.push({ type: label, value });
        if (name) values.push({ type: name, value });
        const lower = label.toLowerCase();
        if (name === "possessionpct" || lower.includes("possession")) values.push({ type: "Ball Possession", value });
        if (name === "totalshots" || lower === "shots") values.push({ type: "Total Shots", value });
        if (name === "shotsontarget" || lower === "on goal") values.push({ type: "Shots on Goal", value });
        if (name === "woncorners" || lower.includes("corner")) values.push({ type: "Corner Kicks", value });
        if (name === "foulscommitted" || lower.includes("foul")) values.push({ type: "Fouls", value });
        if (name === "yellowcards" || lower.includes("yellow")) values.push({ type: "Yellow Cards", value });
      });
      return { team: team.displayName || team.name || null, teamId: team.id || null, values };
    }).filter(row => row.team || row.teamId);
  }

  function normalizeEspnLineups(rosters) {
    return (Array.isArray(rosters) ? rosters : []).map(entry => {
      const team = entry?.team || {};
      const roster = Array.isArray(entry?.roster) ? entry.roster : [];
      const starters = roster.filter(player => player?.starter);
      const substitutes = roster.filter(player => !player?.starter);
      const parts = String(entry?.formation || "4-4-2").split("-").map(Number);
      const lines = [1, ...(parts.reduce((a, b) => a + b, 0) === 10 ? parts : [4, 4, 2])];
      let index = 0;
      const startXI = [];
      lines.forEach((count, rowIndex) => {
        for (let column = 1; column <= count && index < starters.length; column++, index++) {
          const player = starters[index];
          startXI.push({
            name: player?.athlete?.displayName || player?.athlete?.name || "Giocatore",
            number: player?.jersey || "—",
            position: player?.position?.displayName || "",
            grid: { row: rowIndex + 1, column }
          });
        }
      });
      const mapPlayer = player => ({
        name: player?.athlete?.displayName || player?.athlete?.name || "Giocatore",
        number: player?.jersey || "—",
        position: player?.position?.displayName || ""
      });
      return {
        team: team.displayName || team.name || "Squadra",
        teamId: team.id || null,
        formation: entry?.formation || null,
        startXI,
        substitutes: substitutes.map(mapPlayer)
      };
    }).filter(lineup => lineup.startXI.length);
  }

  function buildPlayers(home, away, pressureHome = 50, elapsed = 0, lineups = []) {
    const homeLineup = lineups.find(item => item.teamId === home.id || item.team === home.name);
    const awayLineup = lineups.find(item => item.teamId === away.id || item.team === away.name);
    const drift = index => Math.sin(animationTick / 8 + index * 0.73) * 5.5;
    const positionsFromLineup = (lineup, side) => {
      const starters = Array.isArray(lineup?.startXI) ? lineup.startXI.filter(player => player.grid && player.grid.row > 0 && player.grid.column > 0) : [];
      if (starters.length < 7) return null;
      return starters.map((player, index) => {
        const row = Number(player.grid.row);
        const rowPlayers = starters.filter(item => Number(item.grid.row) === row).sort((a,b) => Number(a.grid.column) - Number(b.grid.column));
        const rowIndex = rowPlayers.indexOf(player);
        const y = rowPlayers.length < 2 ? 280 : 78 + rowIndex * (404 / (rowPlayers.length - 1));
        const baseX = side === "home" ? 78 + (row - 1) * 184 : 822 - (row - 1) * 184;
        const attackShift = (pressureHome - 50) * 0.42 * (side === "home" ? 1 : -1) * (row > 1 ? 1 : 0.25);
        return {
          x: Math.max(45, Math.min(855, baseX + attackShift + drift(index) * 0.35)),
          y: Math.max(45, Math.min(515, y + drift(index))),
          number: player.number || index + 1,
          name: player.name || "Giocatore"
        };
      });
    };
    const homeBase = [[82,280],[228,110],[228,225],[228,335],[228,450],[420,155],[420,280],[420,405],[650,155],[650,280],[650,405]];
    const schematicPositions = side => homeBase.map(([x,y], index) => ({
      x: side === "home" ? x + (x > 350 ? 1 : 0.28) * (pressureHome - 50) * 0.42 : 900 - x + (x < 550 ? 1 : 0.28) * (pressureHome - 50) * 0.42,
      y: y + drift(index + (side === "home" ? 0 : 11)),
      number: index + 1,
      name: "Posizione schematica"
    }));
    const homeGridPositions = positionsFromLineup(homeLineup, "home");
    const awayGridPositions = positionsFromLineup(awayLineup, "away");
    const homePositions = homeGridPositions || schematicPositions("home");
    const awayPositions = awayGridPositions || schematicPositions("away");
    const circles = (players, color) => players.map(player =>
      '<g><title>' + esc(String(player.number) + " · " + player.name) + '</title><circle cx="' + player.x.toFixed(1) + '" cy="' + player.y.toFixed(1) + '" r="17" fill="' + color + '" stroke="#f7fbf8" stroke-width="2"/><text x="' + player.x.toFixed(1) + '" y="' + (player.y + 5).toFixed(1) + '" text-anchor="middle" font-size="13" font-weight="900" fill="#07110d">' + esc(player.number) + '</text></g>'
    ).join("");
    $("pitchPlayers").innerHTML = circles(homePositions, "#d3f18b") + circles(awayPositions, "#f59b9b");
    return {
      homeFormation: homeLineup?.formation || null,
      awayFormation: awayLineup?.formation || null,
      homeGrid: Boolean(homeGridPositions),
      awayGrid: Boolean(awayGridPositions)
    };
  }
  function renderSimulation(match) {
    const home = match.home, away = match.away;
    const rawHomePossession = asNumber(statValue(home, "Ball Possession"));
    const rawAwayPossession = asNumber(statValue(away, "Ball Possession"));
    const possessionHome = rawHomePossession ?? (rawAwayPossession == null ? null : 100 - rawAwayPossession);
    const shotsHome = asNumber(statValue(home, "Total Shots"));
    const shotsAway = asNumber(statValue(away, "Total Shots"));
    const pressureAvailable = possessionHome !== null || shotsHome !== null || shotsAway !== null;
    let pressureHome = (possessionHome == null ? 50 : possessionHome) * .55 + (shotsHome == null || shotsAway == null || shotsHome + shotsAway === 0 ? 50 : shotsHome / (shotsHome + shotsAway) * 100) * .45;
    if (simulationMode === "home") pressureHome = 78;
    else if (simulationMode === "away") pressureHome = 22;
    else if (simulationMode === "neutral") pressureHome = 50;
    else if (simulationMode === "action") pressureHome = 50 + Math.sin(animationTick / 12) * 35;
    const elapsed = number(match.elapsed) || 0;
    const formationInfo = buildPlayers(home, away, pressureHome, elapsed, lastDetail?.lineups || []);
    const homeAttacking = pressureHome >= 50;
    const pressure = Math.round(homeAttacking ? pressureHome : 100 - pressureHome);
    const ballX = !pressureAvailable && simulationMode === "live" ? 450 : (homeAttacking ? 520 + pressure * 2.4 : 380 - pressure * 2.4) + Math.sin(animationTick / 10) * 16;
    const ballY = !pressureAvailable && simulationMode === "live" ? 280 : 280 + Math.sin(animationTick / 8) * 62 + (pressure - 50) * 0.28;
    $("liveBall").setAttribute("cx", String(Math.max(70, Math.min(830, ballX))));
    $("liveBall").setAttribute("cy", String(Math.max(75, Math.min(485, ballY))));
    const team = homeAttacking ? home.name : away.name;
    const demoMode = simulationMode !== "live";
    const shownPossessionHome = demoMode ? (simulationMode === "home" ? 72 : simulationMode === "away" ? 28 : 50) : possessionHome;
    const possessionAway = shownPossessionHome === null ? null : 100 - shownPossessionHome;
    const shownShotsHome = demoMode ? (simulationMode === "home" ? 14 : simulationMode === "away" ? 4 : 8) : shotsHome;
    const shownShotsAway = demoMode ? (simulationMode === "home" ? 3 : simulationMode === "away" ? 12 : 8) : shotsAway;
    const shotsTotal = (shownShotsHome || 0) + (shownShotsAway || 0);
    $("livePressure").innerHTML='<div class="live-sim-metrics"><div class="live-sim-metric"><span>'+(demoMode?"Possesso · scenario simulato":"Possesso")+'</span><div class="live-sim-split"><b>'+esc(home.name)+' '+(shownPossessionHome===null?"—":Math.round(shownPossessionHome)+"%")+'</b><b>'+esc(away.name)+' '+(possessionAway===null?"—":Math.round(possessionAway)+"%")+'</b></div><div class="live-sim-track"><i style="width:'+(shownPossessionHome===null?50:shownPossessionHome)+'%"></i></div></div><div class="live-sim-metric"><span>'+(demoMode?"Tiri · scenario simulato":"Tiri totali")+'</span><div class="live-sim-split"><b>'+esc(home.name)+' '+(shownShotsHome===null?"—":shownShotsHome)+'</b><b>'+esc(away.name)+' '+(shownShotsAway===null?"—":shownShotsAway)+'</b></div><div class="live-sim-track shots"><i style="width:'+(shotsTotal?shownShotsHome/shotsTotal*100:50)+'%"></i></div></div><div class="live-sim-pressure"><span>'+(demoMode?"Pressione simulata":"Pressione statistica stimata")+'</span><b>'+(pressureAvailable||demoMode?esc(team)+" · "+pressure+"/100":"Dati non disponibili")+'</b></div></div>';
    const formationLabel = formationInfo.homeFormation && formationInfo.awayFormation ? "Moduli dal provider: " + formationInfo.homeFormation + " vs " + formationInfo.awayFormation + ". " : "";
    const gridLabel = formationInfo.homeGrid && formationInfo.awayGrid ? "Schieramenti iniziali basati sulla griglia delle formazioni. " : "Almeno una formazione non è disponibile: uso una disposizione schematica. ";
    const modeLabel = simulationMode === "live" ? "Dati live del provider" : "Scenario simulato: " + ({ home: "pressione casa", away: "pressione ospite", neutral: "equilibrio", action: "azione animata" }[simulationMode] || simulationMode);
    $("simulationCaption").textContent = formationLabel + gridLabel + modeLabel + ". Il campo è illustrativo: non mostra tracking reale dei calciatori né dati di gioco generati.";
  }

  function renderLineups(lineups) {
    const target = $("liveLineups");
    if (!target) return;
    const rows = Array.isArray(lineups) ? lineups : [];
    const available = rows.filter(team => Array.isArray(team.startXI) && team.startXI.length);
    if (!available.length) {
      target.innerHTML = '<div class="live-empty compact">Le formazioni non sono ancora disponibili dal provider.</div>';
      return;
    }
    target.innerHTML = available.map(team => {
      const starters = team.startXI.map(player =>
        '<li><b>' + esc(player.number ?? "—") + '</b><span>' + esc(player.name) + '</span><small>' + esc(player.position || "") + '</small></li>'
      ).join("");
      const substitutes = (team.substitutes || []).map(player =>
        '<li><b>' + esc(player.number ?? "—") + '</b><span>' + esc(player.name) + '</span><small>' + esc(player.position || "") + '</small></li>'
      ).join("");
      const reserveBlock = substitutes
        ? '<details><summary>Riserve (' + team.substitutes.length + ')</summary><ol>' + substitutes + '</ol></details>'
        : '';
      return '<article class="live-lineup-team"><div class="live-lineup-heading"><b>' + esc(team.team || "Squadra") + '</b><span>' + esc(team.formation || "Modulo non indicato") + '</span></div><h3>Titolari</h3><ol>' + starters + '</ol>' + reserveBlock + '</article>';
    }).join("");
  }

  function renderStats(match) {
    const specs = [
      ["Possesso", "Ball Possession", true],
      ["Tiri", "Total Shots"],
      ["In porta", "Shots on Goal"],
      ["Corner", "Corner Kicks"],
      ["Falli", "Fouls"],
      ["Ammonizioni", "Yellow Cards"]
    ];
    $("liveStats").innerHTML = specs.map(([label, key, percent]) => {
      const home = statValue(match.home, key), away = statValue(match.away, key);
      return '<div class="live-stat"><span>' + label + '</span><b>' + esc(home ?? "—") + (percent && home != null ? "" : "") + '</b><i>—</i><b>' + esc(away ?? "—") + '</b></div>';
    }).join("");
    $("liveStatsUpdated").textContent = "Statistiche aggiornate dal provider";
  }

  function renderEvents(events, match) {
    const rows = Array.isArray(events) ? events.slice().reverse() : [];
    $("liveEvents").innerHTML = rows.length ? rows.map(event => {
      const minuteLabel = event.minute + (event.extra ? "+" + event.extra : "") + "′";
      const player = event.player ? '<b>' + esc(event.player) + '</b>' : "";
      const assist = event.assist ? '<small>Assist: ' + esc(event.assist) + '</small>' : "";
      const home = event.teamId === match.home.id;
      return '<div class="live-event"><time>' + esc(minuteLabel) + '</time><span class="live-event-mark ' + (home ? "home" : "away") + '">' + (event.type === "Goal" ? "●" : event.type === "Card" ? "▰" : event.type === "subst" || event.type === "subst." ? "↔" : "•") + '</span><div><b>' + esc(event.detail || event.type) + '</b><small>' + esc(event.team || "Squadra") + (player ? " · " : "") + '</small>' + player + assist + '</div></div>';
    }).join("") : '<div class="live-empty compact">Il provider non ha ancora restituito eventi per questa partita.</div>';
  }

  function startSimulationAnimation() {
    if (animationTimer || !lastDetail?.fixture) return;
    animationTimer = window.setInterval(() => {
      if (document.hidden || !lastDetail?.fixture || $("liveDetailSection")?.hidden) return;
      animationTick++;
      renderSimulation(lastDetail.fixture);
    }, 350);
  }

  function renderDetail(payload) {
    const match = payload.fixture;
    if (!match) throw new Error("Partita non trovata.");
    lastDetail = payload;
    const sourceLabel = payload.sourceLabel || payload.source || "Fonte live";
    const fallbackInfo = payload.fallbackReason ? " · fallback: " + payload.fallbackReason : "";
    $("liveStatus").textContent = sourceLabel + fallbackInfo + " · aggiornamento " + new Date(payload.updatedAt || Date.now()).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
    const statusCode=String(match.status||"").toUpperCase();
    const statusLabel=["FT","AET","PEN"].includes(statusCode)?"PARTITA TERMINATA":statusCode==="HT"?"INTERVALLO":["1H","2H","ET","BT","P","LIVE"].includes(statusCode)?"IN DIRETTA":(match.statusLong||"STATO PARTITA").toUpperCase();
    $("liveScoreboard").innerHTML = '<div class="live-match-meta"><span class="live-state-pill '+(["1H","2H","ET","BT","P","LIVE"].includes(statusCode)?"is-live":"")+'">' + (["1H","2H","ET","BT","P","LIVE"].includes(statusCode)?'<i></i> ':"") + esc(statusLabel) + '</span><span>' + esc(match.league || "Calcio") + '</span><b class="live-clock">' + esc(minute(match)) + '</b></div><div class="live-score-teams"><div>' + logo(match.home) + '<b>' + esc(match.home.name) + '</b></div><strong>' + esc(match.goals.home ?? "—") + ' – ' + esc(match.goals.away ?? "—") + '</strong><div>' + logo(match.away) + '<b>' + esc(match.away.name) + '</b></div></div><small>' + esc(match.venue || "Stadio non comunicato") + '</small>';
    renderSimulation(match);
    renderLineups(payload.lineups || []);
    renderStats(match);
    renderEvents(payload.events, match);
    notifyDetailChanges(payload,match);
    startSimulationAnimation();
  }
  function notifyDetailChanges(payload,match){
    const api=window.MMNotifications;if(!api)return;const key=teamKey(match),events=Array.isArray(payload.events)?payload.events:[];
    let seen={};try{seen=JSON.parse(localStorage.getItem("matchmind-live-events-v1")||"{}")||{};}catch{}
    const ids=events.map(e=>[e.minute,e.extra,e.type,e.teamId,e.player,e.detail].join("|")),old=seen[key];
    if(old)events.forEach((e,i)=>{const id=ids[i];if(old.includes(id))return;const type=String(e.type||"").toLowerCase(),detail=String(e.detail||"").toLowerCase();if(type.includes("goal")||detail.includes("goal"))api.notifyOnce("goal:"+key+":"+id,"goals","Gol · "+match.home.name+" – "+match.away.name,(e.minute||"")+"′ · "+(e.player||e.detail||"Rete")+". Risultato "+(match.goals.home??"—")+"–"+(match.goals.away??"—"),"goal-"+key);else if(type.includes("card")||detail.includes("card"))api.notifyOnce("card:"+key+":"+id,"cards","Cartellino · "+match.home.name+" – "+match.away.name,(e.minute||"")+"′ · "+(e.player||e.detail||"Evento"),"card-"+key);});
    seen[key]=ids;try{localStorage.setItem("matchmind-live-events-v1",JSON.stringify(Object.fromEntries(Object.entries(seen).slice(-60))));}catch{}
    let states={};try{states=JSON.parse(localStorage.getItem("matchmind-live-status-v1")||"{}")||{};}catch{}const state=String(match.status||"").toUpperCase(),oldState=states[key];
    if(oldState&&oldState!=="HT"&&state==="HT")api.notifyOnce("half:"+key,"halftime","Intervallo",match.home.name+" "+(match.goals.home??"—")+" – "+(match.goals.away??"—")+" "+match.away.name,"half-"+key);
    if(oldState&&!["FT","AET","PEN"].includes(oldState)&&["FT","AET","PEN"].includes(state))api.notifyOnce("end:"+key,"fulltime","Fine partita",match.home.name+" "+(match.goals.home??"—")+" – "+(match.goals.away??"—")+" "+match.away.name,"end-"+key);
    states[key]=state;try{localStorage.setItem("matchmind-live-status-v1",JSON.stringify(states));}catch{}
  }

  function scheduleNextPoll() {
    if (pollHandle) clearTimeout(pollHandle);
    pollHandle = null;
    if (document.hidden) return;
    let delay = 1800000;
    if (requestFailed) delay = fixtureId ? 1800000 : 900000;
    else if (fixtureId) {
      const status = String(lastDetail?.fixture?.status || "").toUpperCase();
      const inPlay = ["1H", "HT", "2H", "ET", "BT", "P", "LIVE"].includes(status);
      const finished = ["FT", "AET", "PEN", "CANC", "ABD", "AWD", "WO"].includes(status);
      if (finished) return;
      delay = inPlay ? 300000 : 900000;
    } else {
      delay = listMatchCount > 0 ? 300000 : (nextScheduledKickoff && nextScheduledKickoff-Date.now()<2*3600000 ? 180000 : 900000);
    }
    pollHandle = window.setTimeout(() => {
      pollHandle = null;
      refresh();
    }, delay);
  }

  async function refresh() {
    if (busy || document.hidden) return;
    busy = true;
    [$("refreshLive"), $("refreshLiveDetail")].filter(Boolean).forEach(button => { button.disabled = true; button.textContent = "Aggiorno…"; });
    try {
      if (fixtureId) {
        $("liveDetailSection").hidden = false;
        $("liveListSection").hidden = true;
        $("liveStatus").textContent = "Aggiornamento dati partita…";
        const detailParams = new URLSearchParams({ fixture: fixtureId, competition, source: params.get("source") || "api-football" });
        ["date", "home", "away"].forEach(key => { if (params.get(key)) detailParams.set(key, params.get(key)); });
        const payload = await requestLive("?" + detailParams.toString());
        renderDetail(payload);
        requestFailed = false;
      } else {
        const results=await Promise.allSettled([requestLive("?competition="+encodeURIComponent(competition)),window.MM.loadData()]);
        const lr=results[0],cr=results[1];if(lr.status==="rejected"&&cr.status==="rejected")throw lr.reason;
        const payload=lr.status==="fulfilled"?lr.value:{matches:[],sourceLabel:"Provider live non disponibile"};
        const calendar=cr.status==="fulfilled"?cr.value:{matches:[]};renderList(payload,calendar);
        if(lr.status==="rejected")$("liveStatus").textContent="Live non disponibile: "+lr.reason.message+" · calendario disponibile";
        requestFailed=lr.status==="rejected";
      }
    } catch (error) {
      requestFailed = true;
      $("liveStatus").textContent = error.message;
      $("liveMatches").innerHTML = '<div class="live-empty"><b>Live non disponibile</b><p>' + esc(error.message) + '</p><a href="./data.html">Controlla configurazione e copertura dati →</a></div>';
      if (fixtureId) {
        $("liveDetailSection").hidden = false;
        $("liveListSection").hidden = true;
        $("liveScoreboard").innerHTML = '<div class="live-empty"><b>Partita non caricabile</b><p>' + esc(error.message) + '</p></div>';
      }
    } finally {
      busy = false;
      [$("refreshLive"), $("refreshLiveDetail")].filter(Boolean).forEach(button => { button.disabled = false; button.textContent = button.id === "refreshLiveDetail" ? "Aggiorna ora" : "Aggiorna"; });
      scheduleNextPoll();
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (fixtureId) {
      $("liveListSection").hidden = true;
      $("liveDetailSection").hidden = false;
    } else {
      $("liveListSection").hidden = false;
      $("liveDetailSection").hidden = true;
    }
    document.querySelectorAll("[data-simulation-mode]").forEach(button => {
      button.addEventListener("click", () => {
        simulationMode = button.dataset.simulationMode || "live";
        document.querySelectorAll("[data-simulation-mode]").forEach(item => item.classList.toggle("is-active", item === button));
        if (lastDetail?.fixture) renderSimulation(lastDetail.fixture);
      });
    });
    $("refreshLive")?.addEventListener("click", refresh);
    $("refreshLiveDetail")?.addEventListener("click", refresh);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        if (pollHandle) clearTimeout(pollHandle);
        pollHandle = null;
        if (animationTimer) clearInterval(animationTimer);
        animationTimer = null;
      } else {
        refresh();
        if (lastDetail?.fixture) startSimulationAnimation();
      }
    });
    refresh();
  });
  window.addEventListener("pagehide", () => { if (pollHandle) clearTimeout(pollHandle); if (animationTimer) clearInterval(animationTimer); });
})();
