/* MatchMind bet checker page controller. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const engine = () => window.MatchMindBets;
  let data = null;
  let selections = [];

  const pct = value => Number.isFinite(value) ? (value * 100).toLocaleString("it-IT", { maximumFractionDigits: 1 }) + "%" : "—";
  const oddsText = value => Number.isFinite(value) ? value.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 3 }) : "non disponibile";
  const esc = value => window.MM().esc(String(value == null ? "" : value));

  function marketChoices() {
    return [
      ["over15", "Over 1,5"], ["under15", "Under 1,5"],
      ["over25", "Over 2,5"], ["under25", "Under 2,5"],
      ["over35", "Over 3,5"], ["under35", "Under 3,5"],
      ["bttsYes", "Gol"], ["bttsNo", "No Gol"],
      ["home", "1"], ["draw", "X"], ["away", "2"]
    ];
  }

  function bestMarket(match) {
    const forecast = window.MM().forecast(match, data.history);
    return marketChoices().map(([key, label]) => ({
      key, label, probability: engine().marketProbability(forecast, key)
    })).filter(item => Number.isFinite(item.probability))
      .sort((a, b) => b.probability - a.probability)[0] || null;
  }

  function updateSelection(row, key) {
    const forecast = window.MM().forecast(row.match, data.history);
    const selected = marketChoices().find(item => item[0] === key);
    const probability = engine().marketProbability(forecast, key);
    if (!selected || probability === null) return;
    row.ok = true;
    row.market = { key, label: selected[1] };
    row.probability = probability;
    row.sampleEnough = Boolean(forecast.sampleEnough);
    row.reason = row.sampleEnough ? null : "Campione storico insufficiente.";
    row.quote = null;
    row.odds = null;
    row.breakEvenProbability = null;
    row.theoreticalEv = null;
  }

  function renderSlip() {
    const target = $("slipResults");
    if (!selections.length) {
      target.innerHTML = '<div class="empty-state">Nessuna partita riconosciuta. Verifica che il testo contenga i nomi delle squadre.</div>';
      return;
    }
    const combined = engine().combineSelections(selections);
    const cards = selections.map((row, index) => {
      if (!row.match) {
        return '<article class="player-item"><b>Selezione non riconosciuta</b><div class="notice warning">' + esc(row.reason) + '</div></article>';
      }
      const options = '<option value="">Seleziona il mercato</option>' + marketChoices().map(([key, label]) =>
        '<option value="' + key + '"' + (row.market && key === row.market.key ? " selected" : "") + '>' + esc(label) + '</option>'
      ).join("");
      const strongest = bestMarket(row.match);
      const suggestion = row.sampleEnough && strongest && (!row.market || strongest.key !== row.market.key)
        ? '<button type="button" class="secondary" data-fix="' + index + '">Proponi ' + esc(strongest.label) + " (" + pct(strongest.probability) + ')</button>'
        : "";
      return '<article class="player-item">' +
        '<div class="player-item-head"><span><b>' + esc(row.match.home) + " – " + esc(row.match.away) + '</b><br><small>' + esc(row.match.date || "") + (row.match.time ? " · " + esc(row.match.time) : "") + '</small></span><b>' + pct(row.ok ? row.probability : NaN) + '</b></div>' +
        '<div class="field"><label for="market-' + index + '">Selezione / correzione mercato</label><select id="market-' + index + '" data-market="' + index + '">' + options + '</select></div>' +
        '<div class="data-row"><span>Quota inserita</span><b>' + oddsText(row.odds) + '</b></div>' +
        '<div class="data-row"><span>Probabilità di pareggio quota</span><b>' + pct(row.odds ? 1 / row.odds : NaN) + '</b></div>' +
        '<div class="data-row"><span>Campione storico</span><b>' + (row.ok ? (row.sampleEnough ? "Adeguato" : "Insufficiente") : "Da verificare") + '</b></div>' +
        (row.reason ? '<div class="notice warning">' + esc(row.reason) + '</div>' : "") +
        (suggestion ? '<div style="margin-top:9px">' + suggestion + '</div>' : "") +
        '</article>';
    }).join("");
    const summary = combined.available
      ? '<div class="metric"><span>PROBABILITÀ STIMATA DELL’INTERA SCHEDINA</span><b>' + pct(combined.probability) + '</b><small>' + esc(combined.assumption) + '</small></div>'
      : '<div class="notice warning">' + esc(combined.reason) + '</div>';
    target.innerHTML = summary + cards;
  }

  function matchingQuote(row, context) {
    const key = row.market.key;
    const targetName = ({
      over25: "over 2.5", under25: "under 2.5",
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
          if (key === "over25" || key === "under25") {
            matches = name === "goals over/under" && label === targetName;
          } else if (key === "bttsYes" || key === "bttsNo") {
            matches = name === "both teams to score" && (
              targetName === "yes" ? ["yes", "gol"].includes(label) : ["no", "no gol"].includes(label)
            );
          } else if (name === "match winner") {
            matches = label === targetName;
          }
          const odd = Number(value.odd);
          if (matches && Number.isFinite(odd) && odd > 1) {
            return { odd, bookmaker: bookmaker.name || "Sisal" };
          }
        }
      }
    }
    return null;
  }

  async function refreshSisal() {
    const target = $("sisalResults");
    const button = $("refreshSisal");
    const valid = selections.filter(row => row.ok);
    if (!valid.length) {
      target.innerHTML = '<div class="notice warning">Analizza prima una schedina con almeno una partita riconosciuta.</div>';
      return;
    }
    button.disabled = true;
    button.textContent = "Verifica in corso…";
    target.innerHTML = '<div class="loading-state">Richiesta delle quote prematch Sisal tramite OddsPapi…</div>';
    const reports = [];
    for (const row of valid) {
      try {
        const params = "type=match&date=" + encodeURIComponent(row.match.date) +
          "&home=" + encodeURIComponent(row.match.home) +
          "&away=" + encodeURIComponent(row.match.away);
        const context = await window.MM().playerApi(
          params,
          "match:" + row.match.date + ":" + window.MM().norm(row.match.home) + ":" + window.MM().norm(row.match.away),
          5 * 60 * 1000
        );
        const quote = matchingQuote(row, context);
        row.quote = quote;
        const updated = context.oddsUpdatedAt && Number.isFinite(Date.parse(context.oddsUpdatedAt))
          ? new Date(context.oddsUpdatedAt).toLocaleString("it-IT")
          : "orario non comunicato";
        reports.push({
          row, quote, source: context.oddsSource || "OddsPapi",
          updated, error: context.oddsError || null
        });
      } catch (error) {
        reports.push({ row, error: error.message || "Errore provider" });
      }
    }
    target.innerHTML = reports.map(report => {
      const title = esc(report.row.match.home + " – " + report.row.match.away);
      if (!report.quote) {
        return '<div class="data-row"><span><b>' + title + '</b><small style="display:block;color:#8c9aa8">' + esc(report.error || "Quota non disponibile per questo mercato") + '</small></span><b>—</b></div>';
      }
      const probability = report.row.probability;
      const ev = report.row.sampleEnough ? probability * report.quote.odd - 1 : null;
      return '<div class="data-row"><span><b>' + title + '</b><small style="display:block;color:#8c9aa8">' + esc(report.source || "Sisal · OddsPapi") + ' · ' + esc(report.updated) + '<br>Quota selezione Sisal: ' + oddsText(report.quote.odd) + ' · ' + esc(report.quote.bookmaker || "Sisal") + (ev === null ? "" : '<br>EV teorico esplorativo: ' + (ev >= 0 ? "+" : "") + pct(ev)) + '</small></span><b>' + pct(probability) + '</b></div>';
    }).join("") + '<div class="notice warning">Le quote sono mostrate solo quando il provider le restituisce per la partita e il mercato richiesti. L’EV è un confronto teorico basato sul modello, non una prova di vantaggio reale.</div>';
    button.disabled = false;
    button.textContent = "Verifica quote Sisal";
  }

  function buildProposal() {
    const target = $("ticketResults");
    const threshold = Number($("targetProbability").value);
    const maxLegs = Number($("maxLegs").value);
    const upcoming = data.matches.filter(window.MM().upcoming);
    const result = engine().buildTicket(
      upcoming,
      match => window.MM().forecast(match, data.history),
      threshold,
      { maxLegs }
    );
    if (!result.available) {
      target.innerHTML = '<div class="notice warning">' + esc(result.reason) + '</div>' +
        (Number.isFinite(result.eligibleFixtures) ? '<small>Partite con campione adeguato: ' + result.eligibleFixtures + '</small>' : "");
      return;
    }
    target.innerHTML = '<div class="metric"><span>PROBABILITÀ STIMATA DELL’INTERA COMBINAZIONE</span><b>' + pct(result.probability) + '</b><small>Obiettivo minimo: ' + pct(result.threshold) + ' · ' + result.selections.length + ' selezioni</small></div>' +
      result.selections.map(item => '<div class="data-row"><span><b>' + esc(item.match.home) + " – " + esc(item.match.away) + '</b><small style="display:block;color:#8c9aa8">' + esc(item.match.date) + ' · ' + esc(item.market) + '</small></span><b>' + pct(item.probability) + '</b></div>').join("") +
      '<div class="notice warning">' + esc(result.assumption) + " " + esc(result.warning) + '</div>';
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      data = await window.MM().loadData();
      $("globalStatus").textContent = (data.source === "cache" ? "Dati caricati dalla cache locale" : "Dati aggiornati") +
        " · " + data.matches.length + " partite nel calendario.";
      try { $("slipText").value = localStorage.getItem("matchmind-slip-draft-v1") || ""; } catch (_) {}
      $("slipText").addEventListener("input", () => {
        try { localStorage.setItem("matchmind-slip-draft-v1", $("slipText").value); } catch (_) {}
      });
      $("checkSlip").addEventListener("click", () => {
        selections = engine().parseSlip(
          $("slipText").value,
          data.matches,
          match => window.MM().forecast(match, data.history),
          window.MM().upcoming
        );
        renderSlip();
      });
      $("clearSlip").addEventListener("click", () => {
        $("slipText").value = "";
        selections = [];
        try { localStorage.removeItem("matchmind-slip-draft-v1"); } catch (_) {}
        renderSlip();
      });
      $("slipResults").addEventListener("change", event => {
        const index = Number(event.target.dataset.market);
        if (!Number.isInteger(index) || !selections[index] || !selections[index].match) return;
        updateSelection(selections[index], event.target.value);
        renderSlip();
      });
      $("slipResults").addEventListener("click", event => {
        const button = event.target.closest("[data-fix]");
        if (!button) return;
        const index = Number(button.dataset.fix);
        if (!selections[index] || !selections[index].match) return;
        const best = bestMarket(selections[index].match);
        if (best) updateSelection(selections[index], best.key);
        renderSlip();
      });
      $("refreshSisal").addEventListener("click", refreshSisal);
      $("buildTicket").addEventListener("click", buildProposal);
      if ($("slipText").value.trim()) $("checkSlip").click();
    } catch (error) {
      $("globalStatus").textContent = "Dati non disponibili: " + (error.message || "errore sconosciuto");
      $("slipResults").innerHTML = '<div class="notice warning">Non è stato possibile caricare il calendario. Riprova ad aggiornare i dati.</div>';
    }
  });
})();
