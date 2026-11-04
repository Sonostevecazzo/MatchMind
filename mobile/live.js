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

  async function requestLive(query = "") {
    const response = await fetch("./api/live-match" + query, { headers: { Accept: "application/json" }, cache: "no-store" });
    let payload = {};
    try { payload = await response.json(); } catch {}
    if (!response.ok || payload.error) throw new Error(payload.error || "Il provider live non ha restituito dati.");
    return payload;
  }

  function logo(team) {
    if (!team?.logo) return '<span class="live-team-monogram">' + esc((team?.name || "?").slice(0, 2).toUpperCase()) + "</span>";
    return '<img class="live-team-logo" src="' + esc(team.logo) + '" alt="" loading="lazy" onerror="this.outerHTML=\'<span class=&quot;live-team-monogram&quot;>?</span>\'">';
  }

  function minute(match) {
    if (match.elapsed != null) return match.elapsed + (match.extra ? "+" + match.extra : "") + "′";
    return match.statusLong || match.status;
  }

  function renderList(payload) {
    $("liveStatus").textContent = payload.matches.length ? "Provider collegato · " + payload.matches.length + " partite in corso" : "Provider collegato · nessuna partita in corso in questa competizione.";
    $("liveListUpdated").textContent = "Ultimo controllo " + new Date(payload.updatedAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) + " · refresh automatico ogni 2 minuti.";
    $("liveMatches").innerHTML = payload.matches.length ? payload.matches.map(match => (
      '<a class="live-match-card" href="./live.html?fixture=' + encodeURIComponent(match.id) + '&competition=' + encodeURIComponent(competition) + '">' +
        '<div class="live-match-meta"><span class="live-indicator"><i></i> LIVE</span><span>' + esc(match.league || "Calcio") + '</span><b>' + esc(minute(match)) + '</b></div>' +
        '<div class="live-match-teams"><div>' + logo(match.home) + '<b>' + esc(match.home.name) + '</b></div><strong>' + esc(match.goals.home ?? "—") + ' – ' + esc(match.goals.away ?? "—") + '</strong><div>' + logo(match.away) + '<b>' + esc(match.away.name) + '</b></div></div>' +
        '<div class="live-match-footer">Apri Match Simulation <span>→</span></div>' +
      '</a>'
    )).join("") : '<div class="live-empty"><b>Nessuna partita live al momento</b><p>La schermata si aggiorna automaticamente. Le partite future e i risultati conclusi restano nel Calendario.</p><a href="./matches.html">Apri calendario partite →</a></div>';
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

  function buildPlayers(home, away, pressureHome = 50, elapsed = 0, lineups = []) {
    const homeLineup = lineups.find(item => item.teamId === home.id || item.team === home.name);
    const awayLineup = lineups.find(item => item.teamId === away.id || item.team === away.name);
    const drift = index => Math.sin(elapsed / 3.8 + index * 0.73) * 5.5;
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
    const schematicPositions = (side) => homeBase.map(([x,y], index) => ({
      x: side === "home" ? x + (x > 350 ? 1 : 0.28) * (pressureHome - 50) * 0.42 : 900 - x + (x < 550 ? 1 : 0.28) * (pressureHome - 50) * 0.42,
      y: y + drift(index + (side === "home" ? 0 : 11)),
      number: index + 1,
      name: "Posizione schematica"
    }));
    const homePositions = positionsFromLineup(homeLineup, "home") || schematicPositions("home");
    const awayPositions = positionsFromLineup(awayLineup, "away") || schematicPositions("away");
    const circles = (players, color) => players.map(player =>
      '<g><title>' + esc(String(player.number) + " · " + player.name) + '</title><circle cx="' + player.x.toFixed(1) + '" cy="' + player.y.toFixed(1) + '" r="17" fill="' + color + '" stroke="#f7fbf8" stroke-width="2"/><text x="' + player.x.toFixed(1) + '" y="' + (player.y + 5).toFixed(1) + '" text-anchor="middle" font-size="13" font-weight="900" fill="#07110d">' + esc(player.number) + '</text></g>'
    ).join("");
    $("pitchPlayers").innerHTML = circles(homePositions, "#d3f18b") + circles(awayPositions, "#f59b9b");
    return {
      homeFormation: homeLineup?.formation || null,
      awayFormation: awayLineup?.formation || null,
      homeGrid: homePositions.length >= 7 && Boolean(homeLineup),
      awayGrid: awayPositions.length >= 7 && Boolean(awayLineup)
    };
  }
  function renderSimulation(match) {
    const home = match.home, away = match.away;
    const possessionHome = asNumber(statValue(home, "Ball Possession"));
    const possessionAway = asNumber(statValue(away, "Ball Possession"));
    const shotsHome = asNumber(statValue(home, "Total Shots"));
    const shotsAway = asNumber(statValue(away, "Total Shots"));
    const pressureHome = (possessionHome == null ? 50 : possessionHome) * .55 + (shotsHome == null || shotsAway == null || shotsHome + shotsAway === 0 ? 50 : shotsHome / (shotsHome + shotsAway) * 100) * .45;
    const elapsed = number(match.elapsed) || 0;
    const formationInfo = buildPlayers(home, away, pressureHome, elapsed, lastDetail?.lineups || []);
    const homeAttacking = pressureHome >= 50;
    const pressure = Math.round(homeAttacking ? pressureHome : 100 - pressureHome);
    const ballX = homeAttacking ? 520 + pressure * 2.4 : 380 - pressure * 2.4;
    const ballY = 280 + Math.sin(elapsed / 3.4) * 78 + (pressure - 50) * 0.28;
    $("liveBall").setAttribute("cx", String(Math.max(70, Math.min(830, ballX))));
    $("liveBall").setAttribute("cy", String(Math.max(75, Math.min(485, ballY))));
    const team = homeAttacking ? home.name : away.name;
    $("livePressure").innerHTML = '<div><span>Pressione stimata</span><b>' + esc(team) + ' · ' + pressure + '/100</b></div><div class="pressure-track"><i style="width:' + pressure + '%"></i></div>';
    const formationLabel = formationInfo.homeFormation && formationInfo.awayFormation ? "Moduli dal provider: " + formationInfo.homeFormation + " vs " + formationInfo.awayFormation + ". " : "";
    const gridLabel = formationInfo.homeGrid && formationInfo.awayGrid ? "Schieramenti iniziali basati sulla griglia delle formazioni. " : "Almeno una formazione non è disponibile: uso una disposizione schematica. ";
    $("simulationCaption").textContent = formationLabel + gridLabel + (possessionHome == null && shotsHome == null
      ? "Statistiche di pressione non disponibili: il pallone resta in posizione neutra. I giocatori mostrati sono sagome illustrative."
      : "Possesso e tiri aggregati suggeriscono una pressione maggiore di " + team + ". Le posizioni dei 22 giocatori sono schematiche, non coordinate reali.");
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

  function renderDetail(payload) {
    const match = payload.fixture;
    if (!match) throw new Error("Partita non trovata.");
    lastDetail = payload;
    $("liveStatus").textContent = "Live Match Centre · aggiornamento " + new Date(payload.updatedAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
    $("liveScoreboard").innerHTML = '<div class="live-match-meta"><span class="live-indicator"><i></i> ' + esc(match.statusLong || "LIVE") + '</span><span>' + esc(match.league || "Calcio") + '</span><b>' + esc(minute(match)) + '</b></div><div class="live-score-teams"><div>' + logo(match.home) + '<b>' + esc(match.home.name) + '</b></div><strong>' + esc(match.goals.home ?? "—") + ' – ' + esc(match.goals.away ?? "—") + '</strong><div>' + logo(match.away) + '<b>' + esc(match.away.name) + '</b></div></div><small>' + esc(match.venue || "Stadio non comunicato") + '</small>';
    renderSimulation(match);
    renderStats(match);
    renderEvents(payload.events, match);
  }

  async function refresh() {
    if (busy || document.hidden) return;
    busy = true;
    $("refreshLive").disabled = true;
    try {
      if (fixtureId) {
        $("liveDetailSection").hidden = false;
        $("liveListSection").hidden = true;
        $("liveStatus").textContent = "Aggiornamento dati partita…";
        const payload = await requestLive("?fixture=" + encodeURIComponent(fixtureId) + "&competition=" + encodeURIComponent(competition));
        renderDetail(payload);
      } else {
        const payload = await requestLive("?competition=" + encodeURIComponent(competition));
        renderList(payload);
      }
    } catch (error) {
      $("liveStatus").textContent = error.message;
      $("liveMatches").innerHTML = '<div class="live-empty"><b>Live non disponibile</b><p>' + esc(error.message) + '</p><a href="./data.html">Controlla configurazione e copertura dati →</a></div>';
      if (fixtureId) {
        $("liveDetailSection").hidden = false;
        $("liveListSection").hidden = true;
        $("liveScoreboard").innerHTML = '<div class="live-empty"><b>Partita non caricabile</b><p>' + esc(error.message) + '</p></div>';
      }
    } finally {
      busy = false;
      $("refreshLive").disabled = false;
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
    $("refreshLive")?.addEventListener("click", refresh);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) refresh();
    });
    refresh();
    pollHandle = window.setInterval(refresh, 120000);
  });
  window.addEventListener("pagehide", () => { if (pollHandle) clearInterval(pollHandle); });
})();
