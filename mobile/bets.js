/* MatchMind bet checker page controller. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const engine = () => window.MatchMindBets;
  let data = null;
  let selections = [];
  let suggestedSelections = [];

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
        '<div class="player-item-head"><span><b>' + esc(row.match.home) + " – " + esc(row.match.away) + '</b><br><small>' + esc(row.match.date || "") + (row.match.time ? " · " + esc(row.match.time) : "") + '</small></span><b class="bet-percent">'+ pct(row.ok ? row.probability : NaN) + '</b></div>' +
        '<div class="field"><label for="market-' + index + '">Selezione / correzione mercato</label><select id="market-' + index + '" data-market="' + index + '">' + options + '</select></div>' +
        '<div class="data-row"><span>Quota inserita</span><b>' + oddsText(row.odds) + '</b></div>' +
        '<div class="data-row"><span>Probabilità di pareggio quota</span><b class="bet-percent">'+ pct(row.odds ? 1 / row.odds : NaN) + '</b></div>' +
        '<div class="data-row"><span>Campione storico</span><b>' + (row.ok ? (row.sampleEnough ? "Adeguato" : "Insufficiente") : "Da verificare") + '</b></div>' +
        (row.reason ? '<div class="notice warning">' + esc(row.reason) + '</div>' : "") +
        (suggestion ? '<div style="margin-top:9px">' + suggestion + '</div>' : "") +
        '</article>';
    }).join("");
    const summary = combined.available
      ? '<div class="metric"><span>PROBABILITÀ STIMATA DELL’INTERA SCHEDINA</span><b class="bet-percent bet-percent-total">'+ pct(combined.probability) + '</b><small>' + esc(combined.assumption) + '</small></div>'
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

  async function refreshSisal(rowsToCheck, targetElement, actionButton) {
    const target = targetElement || $("sisalResults");
    const button = actionButton || $("refreshSisal");
    const valid = (rowsToCheck || selections).filter(row => row.ok && row.market && row.match);
    if (!valid.length) {
      target.innerHTML = '<div class="notice warning">Non ci sono selezioni riconosciute da verificare.</div>';
      return;
    }
    const idleText = button.dataset.idleText || "Confronta quote disponibili";
    button.disabled = true;
    button.textContent = "Verifica in corso…";
    target.innerHTML = '<div class="loading-state">Controllo delle quote disponibili e del benchmark gratuito, senza API key…</div>';
    const reports = [];
    for (const row of valid) {
      let report = null;
      // Try the optional Sisal feed first. It remains an add-on, never a requirement.
      try {
        const params = "type=match&date=" + encodeURIComponent(row.match.date) +
          "&home=" + encodeURIComponent(row.match.home) +
          "&away=" + encodeURIComponent(row.match.away);
        const context = await window.MM().playerApi(
          params,
          "match:" + row.match.date + ":" + window.MM().norm(row.match.home) + ":" + window.MM().norm(row.match.away),
          5 *  60 * 1000
        );
        const quote = matchingQuote(row, context);
        if (quote) {
          const updateTime = context.oddsUpdatedAt && Number.isFinite(Date.parse(context.oddsUpdatedAt))
            ? Date.parse(context.oddsUpdatedAt) : null;
          const ageMinutes = updateTime === null ? null : Math.max(0, (Date.now() - updateTime) / 60000);
          report = {
            row, quote, source: context.oddsSource || "Sisal · OddsPapi",
            updated: updateTime === null ? "orario non comunicato" : new Date(updateTime).toLocaleString("it-IT"),
            ageMinutes, kind: "bookmaker"
          };
        }
      } catch (_) {
        // Fall through to the public, keyless fair-odds feed.
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
      if (!report) report = { row, error: "Nessuna quota disponibile per questa partita e questo mercato. Il benchmark gratuito copre solo 1X2." };
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
      const quoteLabel = report.kind === "fair-only" ? "Quota equa (margine rimosso)" :
        report.kind === "best-soft" ? "Migliore quota bookmaker segnalata" : "Quota Sisal corrente";
      const fairLine = Number.isFinite(report.quote.fairOdds)
        ? '<br>Benchmark equo: ' + oddsText(report.quote.fairOdds) +
          (Number.isFinite(report.quote.fairProbability) ? ' (' + pct(report.quote.fairProbability) + ')' : '') : '';
      const gapLine = Number.isFinite(report.quote.priceGap)
        ? '<br>Differenza rispetto al fair: ' + (report.quote.priceGap >= 0 ? '+' : '') + pct(report.quote.priceGap) +
          ' · stato: ' + esc(report.quote.status || "non specificato") : '';
      return '<div class="data-row"><span><b>' + title + '</b><small style="display:block;color:#8c9aa8">' +
        esc(report.source) + (report.updated ? ' · aggiornato ' + esc(new Date(report.updated).toLocaleString("it-IT")) : '') +
        '<br>' + quoteLabel + ': ' + oddsText(report.quote.odd) + ' · ' + esc(report.quote.bookmaker || "—") +
        fairLine + gapLine +
        (report.row.odds ? '<br>Quota sulla schedina: ' + oddsText(report.row.odds) : '') +
        (ev === null ? '' : '<br>EV teorico esplorativo vs quota: ' + (ev >= 0 ? '+' : '') + pct(ev)) +
        '</small></span><b class="bet-percent">' + pct(probability) + '</b></div>';
    }).join("") + '<div class="notice warning">TipsAudit fornisce quote eque 1X2 senza margine e, quando presente, il miglior prezzo soft rilevato: non è necessariamente Sisal né una quota garantita ancora giocabile. Le quote eque non sono prezzi bookmaker. Per Over/Under e Gol/No Gol serve una fonte specifica del mercato. L’EV è solo esplorativo e dipende dall’affidabilità del modello.</div><small class="helper-text">Fonte benchmark: <a href="https://tipsaudit.com/api" target="_blank" rel="noopener">TipsAudit API</a> · dati aggiornati periodicamente · nessuna chiave richiesta.</small>';
    button.disabled = false;
    button.textContent = idleText;
  }

  function buildProposal() {
    suggestedSelections = [];
    const target = $("ticketResults");
    const threshold = Number($("targetProbability").value);
    const maxLegs = Number($("maxLegs").value);
    const upcoming = data.matches.filter(window.MM().upcoming)
      .slice().sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
    const first = upcoming[0];
    const ticketFixtures = !first ? [] : (first.round !== null && first.round !== undefined
      ? upcoming.filter(match => String(match.round) === String(first.round))
      : upcoming.filter(match => Math.abs(Date.parse(match.date + "T12:00:00") - Date.parse(first.date + "T12:00:00")) <= 3 * 86400000));
    const result = engine().buildTicket(
      ticketFixtures,
      match => window.MM().forecast(match, data.history),
      threshold,
      { maxLegs }
    );
    if (!result.available) {
      target.innerHTML = '<div class="notice warning">' + esc(result.reason) + '</div>' +
        (Number.isFinite(result.eligibleFixtures) ? '<small>Partite con campione adeguato: ' + result.eligibleFixtures + '</small>' : "");
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
      $("refreshSisal").dataset.idleText = "Confronta quote disponibili";
      $("refreshSisal").addEventListener("click", () => refreshSisal(selections));
      $("ticketResults").addEventListener("click", event => {
        if (event.target.closest("#refreshSuggestedSisal")) refreshSisal(suggestedSelections, $("suggestedOdds"), $("refreshSuggestedSisal"));
      });
      $("buildTicket").addEventListener("click", buildProposal);
      if ($("slipText").value.trim()) $("checkSlip").click();
    } catch (error) {
      $("globalStatus").textContent = "Dati non disponibili: " + (error.message || "errore sconosciuto");
      $("slipResults").innerHTML = '<div class="notice warning">Non è stato possibile caricare il calendario. Riprova ad aggiornare i dati.</div>';
    }
  });
})();


/* Screenshot import, share intake and local bet archive. */
(function(){
"use strict";
const $=id=>document.getElementById(id),KEY="matchmind-slip-archive-v1";
let data=null,archive=[];try{archive=JSON.parse(localStorage.getItem(KEY)||"[]");if(!Array.isArray(archive))archive=[];}catch(_){}
const cash=n=>Number(n)>0?"€ "+Number(n).toLocaleString("it-IT",{minimumFractionDigits:2,maximumFractionDigits:2}):"—";
const esc=s=>window.MM().esc(String(s==null?"":s));
function save(){try{localStorage.setItem(KEY,JSON.stringify(archive));}catch(_){$("ocrStatus").textContent="Archivio pieno: elimina alcune schedine.";}}
function rows(){return window.MatchMindBets.parseSlip($("slipText").value,data.matches,m=>window.MM().forecast(m,data.history),window.MM().upcoming).filter(x=>x.match).map(x=>({home:x.match.home,away:x.match.away,date:x.match.date,market:x.market&&x.market.label||"Da verificare",marketKey:x.market&&x.market.key||"",odds:x.odds||null,probability:x.probability||null,status:"Da aggiornare"}));}
function render(){const el=$("slipArchive");if(!el)return;if(!archive.length){el.innerHTML='<div class="empty-state">Nessuna schedina archiviata.</div>';return;}el.innerHTML=archive.map(t=>'<article class="archive-ticket"><div class="archive-ticket-head"><b>Schedina · '+new Date(t.createdAt).toLocaleString("it-IT")+'</b><span>'+t.selections.length+' eventi</span></div><div class="archive-ticket-meta"><span>Giocata: '+cash(t.stake)+'</span><span>Vincita potenziale: '+cash(t.payout)+'</span></div>'+t.selections.map(x=>'<div class="data-row"><span><b>'+esc(x.home)+' – '+esc(x.away)+'</b><small>'+esc(x.market)+' · '+esc(x.date)+'</small></span><b>'+esc(x.result||x.status||"Da aggiornare")+'</b></div>').join("")+'<div class="settings-actions"><button data-share-ticket="'+esc(t.id)+'" type="button" class="secondary">Condividi</button><button data-delete-ticket="'+esc(t.id)+'" type="button" class="secondary">Elimina</button></div></article>').join("");}
function saveCurrent(){const list=rows();if(!list.length){$("ocrStatus").textContent="Matching non riuscito: correggi il testo e ripeti l'analisi.";return;}archive.unshift({id:"slip-"+Date.now(),createdAt:new Date().toISOString(),stake:Number($("ticketStake").value)||null,payout:Number($("ticketPayout").value)||null,selections:list});archive=archive.slice(0,100);save();render();$("ocrStatus").textContent="Schedina archiviata su questo dispositivo.";}
function share(t){const message=["MatchMind · Schedina","Archiviata: "+new Date(t.createdAt).toLocaleString("it-IT"),"Importo: "+cash(t.stake),"Vincita potenziale: "+cash(t.payout),...t.selections.map(x=>x.home+" – "+x.away+" | "+x.market+" | "+(x.odds||"quota n.d.")+" | "+(x.result||x.status||"Da aggiornare"))].join("\n");if(navigator.share){navigator.share({title:"Schedina MatchMind",text:message}).catch(e=>{if(e.name!=="AbortError")navigator.clipboard&&navigator.clipboard.writeText(message);});}else if(navigator.clipboard)navigator.clipboard.writeText(message).then(()=>$("ocrStatus").textContent="Schedina copiata negli appunti.");}
function loadOCR(){return new Promise((resolve,reject)=>{if(window.Tesseract)return resolve(window.Tesseract);const sc=document.createElement("script");sc.src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";sc.onload=()=>window.Tesseract?resolve(window.Tesseract):reject(new Error("OCR non disponibile"));sc.onerror=()=>reject(new Error("Impossibile caricare OCR. Controlla la connessione."));document.head.appendChild(sc);});}
async function ocr(file){if(!file||!file.type.startsWith("image/"))return;if(file.size>12*1024*1024){$("ocrStatus").textContent="Immagine troppo grande (massimo 12 MB).";return;}const btn=$("checkSlip");btn.disabled=true;$("ocrStatus").textContent="Lettura screenshot in corso…";try{const T=await loadOCR(),r=await T.recognize(file,"ita+eng",{logger:m=>{if(m.status==="recognizing text")$("ocrStatus").textContent="Riconoscimento: "+Math.round((m.progress||0)*100)+"%";}});$("slipText").value=String(r.data.text||"").trim();$("slipText").dispatchEvent(new Event("input",{bubbles:true}));$("ocrStatus").textContent="Testo estratto. Verifica i dati e correggi eventuali errori.";if($("slipText").value.trim())btn.click();}catch(e){$("ocrStatus").textContent=e.message||"OCR non riuscito.";}finally{btn.disabled=false;}}
async function refresh(){const b=$("refreshArchive");b.disabled=true;b.textContent="Aggiornamento…";try{data=await window.MM().loadData(true);let live=[];try{const liveData=await window.MM().playerApi("type=live","archive-live",60*1000);live=Array.isArray(liveData.fixtures)?liveData.fixtures:[];}catch(_){}archive=archive.map(t=>({...t,selections:t.selections.map(x=>{const liveMatch=live.find(y=>window.MM().norm(y.home)===window.MM().norm(x.home)&&window.MM().norm(y.away)===window.MM().norm(x.away));const m=data.matches.find(y=>y.date===x.date&&window.MM().norm(y.home)===window.MM().norm(x.home)&&window.MM().norm(y.away)===window.MM().norm(x.away));return liveMatch?{...x,result:(liveMatch.homeGoals??"—")+"–"+(liveMatch.awayGoals??"—"),status:"LIVE"+(liveMatch.elapsed?" · "+liveMatch.elapsed+"’":"")}:({...x,result:m&&m.hg!=null&&m.ag!=null?m.hg+"–"+m.ag:null,status:m&&m.hg!=null&&m.ag!=null?"Conclusa":m&&window.MM().upcoming(m)?"Da iniziare":"Risultato non disponibile"});})}));save();render();$("ocrStatus").textContent="Risultati aggiornati con l'ultimo calendario disponibile; non è un feed live minuto per minuto.";}catch(e){$("ocrStatus").textContent="Aggiornamento non riuscito: "+e.message;}finally{b.disabled=false;b.textContent="Aggiorna risultati";}}
async function receive(){if(new URLSearchParams(location.search).get("import")!=="shared")return;try{const db=await new Promise((ok,no)=>{const q=indexedDB.open("matchmind-shared-imports",1);q.onupgradeneeded=()=>q.result.createObjectStore("items",{keyPath:"id",autoIncrement:true});q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error);});const tx=db.transaction("items","readwrite"),st=tx.objectStore("items"),q=st.getAll();q.onsuccess=()=>{const item=q.result.at(-1);if(item&&item.file)ocr(item.file);else if(item&&item.text){$("slipText").value=item.text;$("checkSlip").click();}st.clear();};}catch(e){$("ocrStatus").textContent="Condivisione non riuscita: "+e.message;}history.replaceState({},"",location.pathname);}
document.addEventListener("DOMContentLoaded",async()=>{try{data=await window.MM().loadData();}catch(_){}$("slipImage").addEventListener("change",e=>ocr(e.target.files&&e.target.files[0]));$("slipResults").addEventListener("click",e=>{if(e.target.closest("#archiveCurrentSlip"))saveCurrent();if(e.target.closest("#shareCurrentSlip"))share({createdAt:new Date().toISOString(),stake:Number($("ticketStake").value)||null,payout:Number($("ticketPayout").value)||null,selections:rows()});});const archiveObserver=new MutationObserver(()=>{if($("slipResults").querySelector(".player-item")&&!$("archiveCurrentSlip")){const d=document.createElement("div");d.className="settings-actions";d.style.marginTop="14px";d.innerHTML='<button id="archiveCurrentSlip" class="primary" type="button">Archivia schedina</button><button id="shareCurrentSlip" class="secondary" type="button">Condividi</button>';$("slipResults").appendChild(d);}});archiveObserver.observe($("slipResults"),{childList:true,subtree:true});$("slipArchive").addEventListener("click",e=>{const d=e.target.closest("[data-delete-ticket]"),s=e.target.closest("[data-share-ticket]");if(d){archive=archive.filter(x=>x.id!==d.dataset.deleteTicket);save();render();}if(s){const t=archive.find(x=>x.id===s.dataset.shareTicket);if(t)share(t);}});$("refreshArchive").addEventListener("click",refresh);$("shareSlip").addEventListener("click",()=>$("ocrStatus").textContent="Apri la schedina in Sisal, premi Condividi e seleziona MatchMind. Se non compare, installa prima MatchMind dalla funzione Aggiungi a schermata Home del browser. In alternativa usa Importa screenshot.");render();receive();});
})();