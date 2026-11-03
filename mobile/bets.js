/* MatchMind bet checker page controller. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const engine = () => window.MatchMindBets;
  let data = null;
  let suggestedSelections = [];
  let manualFixtures = [];
  const manualSelections = new Map();
  const MANUAL_SELECTIONS_KEY = "matchmind-manual-selections-v1";

  const pct = value => Number.isFinite(value) ? (value * 100).toLocaleString("it-IT", { maximumFractionDigits: 1 }) + "%" : "—";
  const oddsText = value => Number.isFinite(value) ? value.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 3 }) : "non disponibile";
  const esc = value => window.MM.esc(String(value == null ? "" : value));

  function marketChoices() {
    return engine().marketChoices();
  }

  function matchingQuote(row, context) {
    const key = row.market.key;
    const targetName = ({
      over15: "over 1.5", under15: "under 1.5",
      over25: "over 2.5", under25: "under 2.5",
      over35: "over 3.5", under35: "under 3.5",
      bttsYes: "yes", bttsNo: "no",
      home: "home", draw: "draw", away: "away"
    })[key];
    if (!targetName) return null;
    const bookmakers = Array.isArray(context.bookmakers) ? context.bookmakers : [];
    for (const bookmaker of bookmakers) {
      for (const market of bookmaker.bets || []) {
        const name = String(market.name || "").toLowerCase();
        for (const value of market.values || []) {
          const label = String(value.value || "").toLowerCase().trim();
          let matches = false;
          if (key.startsWith("over") || key.startsWith("under")) {
            const handicap = String(value.handicap || "").replace(",", ".").trim();
            const normalizedLabel = label.replace(",", ".").replace(/\s+/g, " ").trim();
            const totalLabel = /\d/.test(normalizedLabel) ? normalizedLabel : (normalizedLabel + " " + handicap).trim();
            matches = name === "goals over/under" && totalLabel === targetName;
          } else if (key === "bttsYes" || key === "bttsNo") {
            matches = name === "both teams to score" && (
              targetName === "yes" ? ["yes", "gol"].includes(label) : ["no", "no gol"].includes(label)
            );
          } else if (name === "match winner") {
            matches = label === targetName;
          }
          const odd = Number(String(value.odd || "").replace(",", "."));
          if (matches && Number.isFinite(odd) && odd > 1) {
            return { odd, bookmaker: bookmaker.name || "Sisal" };
          }
        }
      }
    }
    return null;
  }

  let sisalSnapshotPromise = null;

  async function sisalSnapshotQuote(row) {
    if (!sisalSnapshotPromise) {
      sisalSnapshotPromise = fetch("./sisal-quotes.json", { cache: "no-store" })
        .then(response => {
          if (!response.ok) throw new Error("Foglio quote Sisal non disponibile.");
          return response.json();
        })
        .catch(error => {
          sisalSnapshotPromise = null;
          throw error;
        });
    }
    const snapshot = await sisalSnapshotPromise;
    const match = (snapshot.matches || []).find(item =>
      item.date === row.match.date &&
      window.MM.norm(item.home) === window.MM.norm(row.match.home) &&
      window.MM.norm(item.away) === window.MM.norm(row.match.away)
    );
    if (!match || !match.odds) return null;
    const marketKey = row.market.key;
    const odd = Number(match.odds[marketKey]);
    if (!Number.isFinite(odd) || odd <= 1) return null;
    const sourceTime = Date.parse(snapshot.sourceLastModified || snapshot.checkedAt || "");
    const checkedTime = Date.parse(snapshot.checkedAt || "");
    return {
      row,
      quote: { odd, bookmaker: "Sisal" },
      source: "Sisal · Foglio quote ufficiale (istantanea)",
      updated: Number.isFinite(sourceTime) ? new Date(sourceTime).toISOString() : null,
      checkedAt: Number.isFinite(checkedTime) ? new Date(checkedTime).toISOString() : null,
      ageMinutes: Number.isFinite(sourceTime) ? Math.max(0, (Date.now() - sourceTime) / 60000) : null,
      kind: "sisal-snapshot"
    };
  }

  async function refreshSisal(rowsToCheck, targetElement, actionButton, forceFresh) {
    const target = targetElement || $("sisalResults");
    const button = actionButton || $("refreshSisal");
    const valid = (rowsToCheck || manualRows()).filter(row => row.ok && row.market && row.match);
    if (!valid.length) {
      target.innerHTML = '<div class="notice warning">Non ci sono selezioni riconosciute da verificare.</div>';
      return;
    }
    const idleText = button.dataset.idleText || "Confronta quote disponibili";
    button.disabled = true;
    button.textContent = "Verifica in corso…";
    target.innerHTML = '<div class="loading-state">Controllo delle quote disponibili e del benchmark gratuito, senza API key…</div>';
    if (forceFresh) sisalSnapshotPromise = null;
    const reports = [];
    for (const row of valid) {
      let report = null;
      // Try the optional Sisal feed first. It remains an add-on, never a requirement.
      try {
        const params = "type=match&date=" + encodeURIComponent(row.match.date) +
          "&home=" + encodeURIComponent(row.match.home) +
          "&away=" + encodeURIComponent(row.match.away);
        const context = await window.MM.playerApi(
          params,
          "match:" + row.match.date + ":" + window.MM.norm(row.match.home) + ":" + window.MM.norm(row.match.away),
          forceFresh ? 0 : 5 * 60 * 1000
        );
        const quote = matchingQuote(row, context);
        if (quote) {
          const updateTime = context.oddsUpdatedAt && Number.isFinite(Date.parse(context.oddsUpdatedAt))
            ? Date.parse(context.oddsUpdatedAt) : null;
          const ageMinutes = updateTime === null ? null : Math.max(0, (Date.now() - updateTime) / 60000);
          report = {
            row, quote, source: context.oddsSource || "Sisal · PulseScore",
            updated: updateTime === null ? null : new Date(updateTime).toISOString(),
            ageMinutes, kind: "bookmaker"
          };
        }
      } catch (_) {
        // Fall through to the public, keyless fair-odds feed.
      }
      if (!report) {
        try {
          report = await sisalSnapshotQuote(row);
        } catch (_) {
          // Keep the existing benchmark fallback when the published snapshot is unavailable.
        }
      }
      if (!report && window.MatchMindTipsAudit && ["home", "draw", "away"].includes(row.market.key)) {
        try {
          const prediction = await window.MatchMindTipsAudit.findMatch(row.match);
          const benchmark = prediction && window.MatchMindTipsAudit.quoteFor(row.market.key, prediction);
          if (benchmark) {
            report = {
              row, quote: {
                odd: benchmark.softOdds || benchmark.fairOdds,
                bookmaker: benchmark.softOdds ? benchmark.bookmaker : "Benchmark fair (senza margine)",
                fairOdds: benchmark.fairOdds,
                fairProbability: benchmark.fairProbability,
                softOdds: benchmark.softOdds,
                priceGap: benchmark.priceGap,
                status: benchmark.status,
                fairSource: benchmark.fairSource
              },
              source: "TipsAudit · quote eque 1X2",
              updated: prediction.generated_at || prediction.fair_read_at || null,
              ageMinutes: Number.isFinite(Date.parse(prediction.generated_at || prediction.fair_read_at || ""))
                ? Math.max(0, (Date.now() - Date.parse(prediction.generated_at || prediction.fair_read_at)) / 60000) : null,
              kind: benchmark.softOdds ? "best-soft" : "fair-only"
            };
          }
        } catch (_) {
          // Keep the explicit unavailable state below; never invent a price.
        }
      }
      if (!report && !["over15", "under15", "over25", "under25", "over35", "under35", "bttsYes", "bttsNo", "home", "draw", "away"].includes(row.market.key)) {
        report = { row, error: "Il foglio ufficiale copre 1X2, Under/Over 1,5, 2,5 e 3,5, Gol e No Gol; il mercato non è presente in questa fotografia." };
      }
      if (!report) report = { row, error: "Nessuna quota disponibile per questa partita e questo mercato nelle fonti collegate." };
      reports.push(report);
    }
    target.innerHTML = reports.map(report => {
      const title = esc(report.row.match.home + " – " + report.row.match.away);
      if (!report.quote) {
        return '<div class="data-row"><span><b>' + title + '</b><small style="display:block;color:#8c9aa8">' + esc(report.error) + '</small></span><b>—</b></div>';
      }
      const probability = report.row.probability;
      const actualSoft = report.kind === "best-soft" || report.kind === "bookmaker";
      const freshnessLimit = report.kind === "bookmaker" ? 120 : 90;
      const ev = actualSoft && report.row.sampleEnough && report.ageMinutes !== null &&
        report.ageMinutes <= freshnessLimit && Number.isFinite(report.quote.odd)
        ? probability * report.quote.odd - 1 : null;
      const quoteLabel = report.kind === "sisal-snapshot" ? "Quota Sisal dal foglio pubblicato · non live" :
        report.kind === "fair-only" ? "Quota equa (margine rimosso)" :
        report.kind === "best-soft" ? "Migliore quota bookmaker segnalata" : "Quota Sisal corrente";
      const updatedLabel = report.kind === "sisal-snapshot" ? "PDF aggiornato " : "Aggiornato ";
      const fairLine = Number.isFinite(report.quote.fairOdds)
        ? '<br>Benchmark equo: ' + oddsText(report.quote.fairOdds) +
          (Number.isFinite(report.quote.fairProbability) ? ' (' + pct(report.quote.fairProbability) + ')' : '') : '';
      const gapLine = Number.isFinite(report.quote.priceGap)
        ? '<br>Differenza rispetto al fair: ' + (report.quote.priceGap >= 0 ? '+' : '') + pct(report.quote.priceGap) +
          ' · stato: ' + esc(report.quote.status || "non specificato") : '';
      return '<div class="data-row"><span><b>' + title + '</b><small style="display:block;color:#8c9aa8">' +
        esc(report.source) + (report.updated ? ' · ' + updatedLabel + esc(new Date(report.updated).toLocaleString("it-IT")) : '') +
        (report.checkedAt ? '<br>Estratto il ' + esc(new Date(report.checkedAt).toLocaleString("it-IT")) : '') +
        '<br>' + quoteLabel + ': ' + oddsText(report.quote.odd) + ' · ' + esc(report.quote.bookmaker || "—") +
        fairLine + gapLine +
        (report.row.odds ? '<br>Quota sulla schedina: ' + oddsText(report.row.odds) : '') +
        (ev === null ? '' : '<br>EV teorico esplorativo vs quota: ' + (ev >= 0 ? '+' : '') + pct(ev)) +
        '</small></span><b class="bet-percent">' + pct(probability) + '</b></div>';
    }).join("") + '<div class="notice warning">Il foglio quote Sisal è una fotografia pubblicata: può non corrispondere a una quota ancora disponibile e non è in tempo reale. PulseScore è preferito quando restituisce quote correnti. TipsAudit fornisce benchmark equi senza margine e, quando presente, prezzi soft che non sono necessariamente Sisal. Le quote eque non sono prezzi bookmaker; il PDF Sisal non viene usato per stimare l’EV.</div><small class="helper-text">Fonte Sisal: <a href="https://www.sisal.it/scommesse-matchpoint/foglio-quote" target="_blank" rel="noopener">Foglio quote ufficiale</a> · aggiornato secondo la pubblicazione del PDF. Benchmark: <a href="https://tipsaudit.com/api" target="_blank" rel="noopener">TipsAudit API</a>.</small>';
    button.disabled = false;
    button.textContent = idleText;
  }

  function buildProposal() {
    suggestedSelections = [];
    const target = $("ticketResults");
    if (!data) {
      target.innerHTML = '<div class="notice warning">Calendario e storico non sono ancora caricati. Riprova tra poco.</div>';
      return;
    }
    const threshold = Number($("targetProbability").value);
    const maxLegs = Number($("maxLegs").value);
    const upcoming = data.matches.filter(window.MM.upcoming)
      .slice().sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
    const first = upcoming[0];
    const ticketFixtures = !first ? [] : (first.round !== null && first.round !== undefined
      ? upcoming.filter(match => String(match.round) === String(first.round))
      : upcoming.filter(match => Math.abs(Date.parse(match.date + "T12:00:00") - Date.parse(first.date + "T12:00:00")) <= 3 * 86400000));
    const result = engine().buildTicket(
      ticketFixtures,
      match => window.MM.forecast(match, data.history),
      threshold,
      { maxLegs }
    );
    if (!result.available) {
      const best = result.bestSelection;
      const bestSummary = best
        ? '<div class="notice info">Migliore selezione singola: <b>' + esc(best.match.home + " – " + best.match.away) +
          '</b> · ' + esc(best.market) + ' · ' + pct(best.probability) +
          '. È sotto la soglia minima di ' + pct(result.threshold || threshold) + '.</div>'
        : "";
      const upcomingCount = Number.isFinite(result.upcomingFixtures) ? result.upcomingFixtures : ticketFixtures.length;
      const eligibleCount = Number.isFinite(result.eligibleFixtures) ? result.eligibleFixtures : 0;
      target.innerHTML = '<div class="notice warning">' + esc(result.reason) + '</div>' + bestSummary +
        '<small>Partite future considerate: ' + upcomingCount + ' · con campione adeguato: ' + eligibleCount + '.</small>';
      return;
    }
    suggestedSelections = result.selections.map(item => ({
      ok: true, match: item.match, market: { key: item.marketKey, label: item.market },
      probability: item.probability, sampleEnough: true, odds: null
    }));
    target.innerHTML = '<div class="metric"><span>PROBABILITÀ STIMATA DELL’INTERA COMBINAZIONE</span><b class="bet-percent bet-percent-total">'+ pct(result.probability) + '</b><small>Obiettivo minimo: ' + pct(result.threshold) + ' · ' + result.selections.length + (result.selections.length === 1 ? ' selezione' : ' selezioni') + '</small></div>' +
      result.selections.map(item => '<div class="data-row"><span><b>' + esc(item.match.home) + " – " + esc(item.match.away) + '</b><small style="display:block;color:#8c9aa8">' + esc(item.match.date) + ' · ' + esc(item.market) + '</small></span><b class="bet-percent">' + pct(item.probability) + '</b></div>').join("") +
      '<div class="settings-actions"><button id="refreshSuggestedSisal" type="button" class="secondary" data-idle-text="Verifica quote della proposta">Verifica quote della proposta</button></div><div id="suggestedOdds" style="margin-top:10px"></div>' +
      '<div class="notice warning">' + esc(result.assumption) + " " + esc(result.warning) + '</div>';
  }

  function getMaxLegs() {
    const input = $("maxLegs");
    const value = Number(input && input.value);
    return Number.isFinite(value) ? Math.max(1, Math.min(15, Math.floor(value))) : 10;
  }

  function manualFixtureId(match) {
    return [window.MM.norm(match.home), window.MM.norm(match.away)].sort().join("|") + "|" + match.date;
  }

  function manualRows() {
    return Array.from(manualSelections.values());
  }

  function clearManualOdds() {
    const target = $("manualOdds");
    if (target) target.innerHTML = '<div class="empty-state">Selezioni aggiornate. Conferma la schedina per ricontrollare le quote disponibili.</div>';
  }

  function manualMarketButton(matchIndex, item, selectedKey) {
    const available = Number.isFinite(item.probability);
    const isSelected = selectedKey === item.key;
    const percent = pct(available ? item.probability : NaN);
    return '<button type="button" class="manual-market-button' + (isSelected ? ' is-selected' : '') + '" data-manual-match="' + matchIndex +
      '" data-manual-market="' + esc(item.key) + '" aria-pressed="' + (isSelected ? 'true' : 'false') + '"' +
      (available ? '' : ' disabled') + ' aria-label="' + esc('Seleziona ' + item.label + ', probabilità ' + percent) + '">' +
      '<span>' + esc(item.label) + '</span><b>' + percent + '</b></button>';
  }

  function renderManualSummary() {
    const target = $("manualSlipSummary");
    if (!target) return;
    const rows = manualRows();
    const maxLegs = getMaxLegs();
    const overLimit = rows.length > maxLegs;
    let summary = '<div class="empty-state">Vai al calendario della Home e scegli gli esiti: le selezioni e la probabilità della schedina compariranno qui.</div>';
    if (rows.length) {
      const hasAllProbabilities = rows.every(row => Number.isFinite(row.probability) && row.probability >= 0 && row.probability <= 1);
      const combined = hasAllProbabilities ? rows.reduce((total, row) => total * row.probability, 1) : null;
      const limitedSample = rows.some(row => !row.sampleEnough);
      summary = '<div class="manual-summary-card">' +
        '<div class="manual-summary-top"><div><span class="eyebrow">SCHEDINA MANUALE</span><b>' + rows.length + ' / ' + maxLegs + ' eventi</b></div>' +
        '<div class="manual-combined-probability"><span>Probabilità stimata</span><b class="bet-percent bet-percent-total">' + pct(combined === null ? NaN : combined) + '</b></div></div>' +
        '<small>Prodotto delle probabilità selezionate; assume indipendenza tra partite.</small>' +
        (limitedSample ? '<div class="notice warning manual-sample-warning">Percentuale calcolata, ma almeno una partita ha uno storico insufficiente.</div>' : '') +
        (overLimit ? '<div class="notice warning">Hai selezionato più eventi del limite. Aumenta il massimo oppure rimuovi qualche selezione.</div>' : '') +
        '<div class="manual-selected-list">' + rows.map((row, index) =>
          '<div class="manual-selected-row"><span><b>' + esc(row.match.home + ' – ' + row.match.away) + '</b><small>' +
          esc(row.match.date + (row.match.time ? ' · ' + row.match.time : '') + ' · ' + row.market.label) +
          '</small></span><span class="manual-selected-right"><b class="bet-percent">' + pct(row.probability) + '</b>' +
          '<button type="button" class="manual-remove-button" data-remove-manual="' + index + '" aria-label="Rimuovi selezione">×</button></span></div>'
        ).join('') + '</div>' +
        '<div class="manual-summary-actions"><button id="confirmManualSlip" type="button" class="primary manual-confirm-button" data-idle-text="Conferma e controlla quote" ' +
        (overLimit || !hasAllProbabilities ? ' disabled' : '') + '>Conferma e controlla quote</button>' +
        '<button id="archiveManualSlip" type="button" class="secondary manual-archive-button"' + (overLimit ? ' disabled' : '') + '>Archivia schedina</button></div>' +
        '</div>';
    }
    target.innerHTML = summary;
  }

  function renderManualBuilder() {
    renderManualSummary();
  }

  function readSavedManualSelections() {
    try {
      const saved = JSON.parse(localStorage.getItem(MANUAL_SELECTIONS_KEY) || "[]");
      return Array.isArray(saved) ? saved.filter(row => row && row.home && row.away && row.date && row.marketKey) : [];
    } catch (_) {
      return [];
    }
  }

  function persistManualSelections() {
    const competition = window.MM.getSelectedCompetition();
    const otherCompetitions = readSavedManualSelections().filter(row => (row.competition || "serie-a") !== competition);
    const current = manualRows().map(row => ({
      competition: row.match.competition || competition,
      date: row.match.date,
      home: row.match.home,
      away: row.match.away,
      marketKey: row.market.key
    }));
    try { localStorage.setItem(MANUAL_SELECTIONS_KEY, JSON.stringify(otherCompetitions.concat(current))); } catch (_) {}
  }

  function restoreManualSelections() {
    manualSelections.clear();
    const competition = window.MM.getSelectedCompetition();
    const saved = readSavedManualSelections().filter(row => (row.competition || "serie-a") === competition);
    for (const item of saved) {
      if (manualSelections.size >= 15) break;
      const match = manualFixtures.find(row => row.date === item.date &&
        window.MM.norm(row.home) === window.MM.norm(item.home) &&
        window.MM.norm(row.away) === window.MM.norm(item.away));
      const market = marketChoices().find(([key]) => key === item.marketKey);
      if (!match || !market) continue;
      const forecast = window.MM.forecast(match, data.history);
      const probability = engine().marketProbability(forecast, market[0]);
      if (!Number.isFinite(probability)) continue;
      manualSelections.set(manualFixtureId(match), {
        ok: true, match, market: { key: market[0], label: market[1] }, probability,
        sampleEnough: Boolean(forecast.sampleEnough), historyCount: Number(forecast.historyCount || 0), odds: null
      });
    }
  }

  function loadManualFixtures() {
    manualFixtures = (data && Array.isArray(data.matches) ? data.matches : [])
      .filter(window.MM.upcoming)
      .slice()
      .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
    restoreManualSelections();
    const maxInput = $("maxLegs");
    if (maxInput && manualSelections.size > getMaxLegs()) maxInput.value = String(manualSelections.size);
    renderManualBuilder();
  }

  window.MatchMindBetBuilder = {
    getRows: () => manualRows(),
    getCompetition: () => window.MM.getSelectedCompetition()
  };

  document.addEventListener("DOMContentLoaded", async () => {
    const buildButton = $("buildTicket");
    const quoteButton = $("refreshSisal");
    $("globalStatus").textContent = "Carico calendario e risultati storici…";

    $("manualSlipSummary").addEventListener("click", async event => {
      const remove = event.target.closest("[data-remove-manual]");
      if (remove) {
        if ($("manualOdds").dataset.busy === "true") return;
        const rows = manualRows();
        const row = rows[Number(remove.dataset.removeManual)];
        if (!row) return;
        manualSelections.delete(manualFixtureId(row.match));
        persistManualSelections();
        $("manualBuilderStatus").textContent = "";
        clearManualOdds();
        renderManualBuilder();
        return;
      }
      const button = event.target.closest("#confirmManualSlip");
      if (!button || button.disabled || $("manualOdds").dataset.busy === "true") return;
      const rows = manualRows();
      if (!rows.length) return;
      $("manualOdds").dataset.busy = "true";
      $("manualBuilder").querySelectorAll("button, input").forEach(control => { control.disabled = true; });
      try {
        await refreshSisal(rows, $("manualOdds"), button, true);
      } finally {
        delete $("manualOdds").dataset.busy;
        $("manualBuilder").querySelectorAll("button, input").forEach(control => { control.disabled = false; });
        renderManualBuilder();
      }
    });

    $("maxLegs").addEventListener("change", () => {
      $("maxLegs").value = String(getMaxLegs());
      clearManualOdds();
      renderManualSummary();
    });
    quoteButton.dataset.idleText = quoteButton.textContent.trim();
    quoteButton.addEventListener("click", () => refreshSisal(manualRows(), $("sisalResults"), quoteButton, true));
    $("ticketResults").addEventListener("click", event => {
      if (event.target.closest("#refreshSuggestedSisal")) {
        refreshSisal(suggestedSelections, $("suggestedOdds"), $("refreshSuggestedSisal"), true);
      }
    });
    buildButton.dataset.idleText = buildButton.textContent.trim();
    buildButton.addEventListener("click", async () => {
      if (buildButton.dataset.busy === "true") return;
      buildButton.dataset.busy = "true";
      buildButton.disabled = true;
      buildButton.textContent = "Calcolo…";
      $("ticketResults").innerHTML = '<div class="loading-state">Carico dati e calcolo la proposta…</div>';
      try {
        if (!data) data = window.MM.forCompetition(await window.MM.loadData());
        loadManualFixtures();
        buildProposal();
      } catch (error) {
        $("ticketResults").innerHTML = '<div class="notice warning">' + esc("Calcolo non riuscito: " + (error.message || "errore sconosciuto")) + '</div>';
      } finally {
        delete buildButton.dataset.busy;
        buildButton.disabled = false;
        buildButton.textContent = buildButton.dataset.idleText || "Genera proposta automatica";
      }
    });

    try {
      data = window.MM.forCompetition(await window.MM.loadData());
      loadManualFixtures();
      $("globalStatus").textContent = (data.source === "cache" ? "Dati caricati dalla cache locale" : "Dati aggiornati") +
        " · " + data.matches.length + " partite nel calendario.";
      if (manualRows().length) clearManualOdds();
    } catch (error) {
      $("globalStatus").textContent = "Dati non disponibili: " + (error.message || "errore sconosciuto");
      $("manualBuilderStatus").textContent = "Non è stato possibile caricare calendario e storico. Riprova tra poco."; 
      $("ticketResults").innerHTML = '<div class="notice warning">Non è stato possibile caricare calendario e storico. Premi “Genera proposta automatica” per riprovare.</div>';
    }
  });
})();


/* On-device archive for selections created in the builder. */
(function(){
"use strict";
const $=id=>document.getElementById(id),KEY="matchmind-slip-archive-v1";
let archive=[];
try{archive=JSON.parse(localStorage.getItem(KEY)||"[]");if(!Array.isArray(archive))archive=[];}catch(_){}
const cash=n=>Number(n)>0?"€ "+Number(n).toLocaleString("it-IT",{minimumFractionDigits:2,maximumFractionDigits:2}):"—";
const esc=s=>window.MM.esc(String(s==null?"":s));
function save(){try{localStorage.setItem(KEY,JSON.stringify(archive));}catch(_){$("archiveStatus").textContent="Archivio pieno: elimina alcune schedine.";}}
function selectedRows(){return window.MatchMindBetBuilder?window.MatchMindBetBuilder.getRows():[];}
function ticketRows(){return selectedRows().map(x=>({home:x.match.home,away:x.match.away,date:x.match.date,market:x.market.label,marketKey:x.market.key,odds:Number.isFinite(x.odds)?x.odds:null,probability:Number.isFinite(x.probability)?x.probability:null,competition:x.match.competition||window.MM.getSelectedCompetition(),status:"Da aggiornare"}));}
function render(){
 const el=$("slipArchive");if(!el)return;
 if(!archive.length){el.innerHTML='<div class="empty-state">Nessuna schedina archiviata. Crea una selezione nel Costruttore e premi “Archivia schedina”.</div>';return;}
 el.innerHTML=archive.map(t=>'<article class="archive-ticket"><div class="archive-ticket-head"><b>Schedina · '+esc(t.competitionName||"Serie A")+' · '+new Date(t.createdAt).toLocaleString("it-IT")+'</b><span>'+t.selections.length+' eventi</span></div><div class="archive-ticket-meta"><span>Giocata: '+cash(t.stake)+'</span><span>Vincita potenziale: '+cash(t.payout)+'</span></div>'+t.selections.map(x=>'<div class="data-row"><span><b>'+esc(x.home)+' – '+esc(x.away)+'</b><small>'+esc(x.market)+' · '+esc(x.date)+'</small></span><b>'+esc(x.result||x.status||"Da aggiornare")+'</b></div>').join("")+'<div class="settings-actions"><button data-share-ticket="'+esc(t.id)+'" type="button" class="secondary">Condividi</button><button data-delete-ticket="'+esc(t.id)+'" type="button" class="secondary">Elimina</button></div></article>').join("");
}
async function saveCurrent(){
 const list=ticketRows();if(!list.length){$("archiveStatus").textContent="Aggiungi prima almeno una selezione al costruttore.";return;}
 const competition=window.MM.getSelectedCompetition(),info=window.MM.competitionInfo(competition);
 archive.unshift({id:"slip-"+Date.now(),createdAt:new Date().toISOString(),competition,competitionName:info.name,stake:null,payout:null,selections:list});
 archive=archive.slice(0,100);save();render();$("archiveStatus").textContent="Schedina archiviata su questo dispositivo.";
}
async function share(t){
 const message=["MatchMind · Schedina"+(t.competitionName?" · "+t.competitionName:""),"Archiviata: "+new Date(t.createdAt).toLocaleString("it-IT"),"Importo: "+cash(t.stake),"Vincita potenziale: "+cash(t.payout),...(t.selections||[]).map(x=>x.home+" – "+x.away+" | "+x.market+" | "+(x.odds||"quota n.d.")+" | "+(x.result||x.status||"Da aggiornare"))].join("\n");
 const copy=async()=>{if(!navigator.clipboard||!navigator.clipboard.writeText)throw new Error("Condivisione e appunti non disponibili in questo browser.");await navigator.clipboard.writeText(message);$("archiveStatus").textContent="Schedina copiata negli appunti.";};
 if(navigator.share){try{await navigator.share({title:"Schedina MatchMind",text:message});return;}catch(e){if(e.name==="AbortError")return;}}
 try{await copy();}catch(e){$("archiveStatus").textContent=e.message||"Condivisione non riuscita.";}
}
async function refresh(){
 const b=$("refreshArchive");b.disabled=true;b.textContent="Aggiornamento…";
 try{
  const fullData=await window.MM.loadData(true);let live=[];
  try{const liveData=await window.MM.playerApi("type=live","archive-live",60*1000);live=Array.isArray(liveData.fixtures)?liveData.fixtures:[];}catch(_){}
  archive=archive.map(t=>({...t,selections:t.selections.map(x=>{
   const liveMatch=(x.competition||"serie-a")==="serie-a"?live.find(y=>window.MM.norm(y.home)===window.MM.norm(x.home)&&window.MM.norm(y.away)===window.MM.norm(x.away)):null;
   const m=fullData.matches.find(y=>(y.competition||"serie-a")===(x.competition||"serie-a")&&y.date===x.date&&window.MM.norm(y.home)===window.MM.norm(x.home)&&window.MM.norm(y.away)===window.MM.norm(x.away));
   return liveMatch?{...x,result:(liveMatch.homeGoals??"—")+"–"+(liveMatch.awayGoals??"—"),status:"LIVE"+(liveMatch.elapsed?" · "+liveMatch.elapsed+"’":"")}:({...x,result:m&&m.hg!=null&&m.ag!=null?m.hg+"–"+m.ag:null,status:m&&m.hg!=null&&m.ag!=null?"Conclusa":m&&window.MM.upcoming(m)?"Da iniziare":"Risultato non disponibile"});
  })}));
  save();render();$("archiveStatus").textContent="Risultati aggiornati con l'ultimo calendario disponibile; il feed live dipende dalla fonte collegata.";
 }catch(e){$("archiveStatus").textContent="Aggiornamento non riuscito: "+e.message;}
 finally{b.disabled=false;b.textContent="Aggiorna risultati";}
}
document.addEventListener("DOMContentLoaded",()=>{
 $("manualSlipSummary").addEventListener("click",async e=>{if(e.target.closest("#archiveManualSlip"))await saveCurrent();});
 $("slipArchive").addEventListener("click",async e=>{
  const d=e.target.closest("[data-delete-ticket]"),s=e.target.closest("[data-share-ticket]");
  if(d){archive=archive.filter(x=>x.id!==d.dataset.deleteTicket);save();render();}
  if(s){const t=archive.find(x=>x.id===s.dataset.shareTicket);if(t)await share(t);}
 });
 $("refreshArchive").addEventListener("click",refresh);
 render();
});
})();