import { normalizeName, parseCSV, validateHistory, forecastFixture, buildMarketOffers, priceOffers, buildSuggestions, calculateTicket, backtestHistory } from "./engine.js";

const KEY = "quotalab.store.v1";
const $ = id => document.getElementById(id);
const titles = { overview:"Panoramica", analysis:"Analisi partite", builder:"Costruttore", archive:"Archivio", data:"Dati e metodo" };
const leagues = [{id:"serie-a",label:"Serie A"},{id:"champions-league",label:"Champions League"},{id:"europa-league",label:"Europa League"}];
const categories = [
  ["auto","Tutti i mercati"],["1x2","1X2"],["double","Doppia chance"],["goals","Over / Under"],
  ["btts","Gol / No Gol"],["combo-goals","1X2 + Over / Under"],["combo-btts","1X2 + Gol / No Gol"]
];
const s = { view:"overview", fixtureId:null, history:[], fixtures:[], tickets:[], slip:[], stake:5, editing:null, drawer:false, result:null, backtest:null, backtestCompetition:"serie-a", settings:{category:"auto",minEv:0.03,maxLegs:3} };

function read(value, fallback) { try { const parsed=JSON.parse(value); return parsed && typeof parsed==="object" ? parsed : fallback; } catch { return fallback; } }
function load() {
  const data=read(localStorage.getItem(KEY),{});
  s.history=Array.isArray(data.history)?data.history:[];
  s.fixtures=Array.isArray(data.fixtures)?data.fixtures:[];
  s.tickets=Array.isArray(data.tickets)?data.tickets:[];
  s.slip=Array.isArray(data.slip)?data.slip:[];
  s.stake=Number(data.stake)>0?Number(data.stake):5;
  s.editing=typeof data.editing==="string"&&s.tickets.some(ticket=>ticket.id===data.editing&&ticket.status==="open")?data.editing:null;
  s.settings={...s.settings,...(data.settings||{})};
  s.slip=s.slip.filter(x=>x && x.fixtureId && Number(x.odds)>1);
}
function save() { localStorage.setItem(KEY,JSON.stringify({version:1,history:s.history,fixtures:s.fixtures,tickets:s.tickets,slip:s.slip,stake:s.stake,editing:s.editing,settings:s.settings})); }
function esc(value) { return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function id() { return crypto.randomUUID ? crypto.randomUUID() : "ql-"+Date.now()+"-"+Math.random().toString(36).slice(2); }
function eur(value) { return new Intl.NumberFormat("it-IT",{style:"currency",currency:"EUR"}).format(Number(value||0)); }
function percent(value,digits=1) { return Number.isFinite(Number(value)) ? (Number(value)*100).toLocaleString("it-IT",{minimumFractionDigits:digits,maximumFractionDigits:digits})+"%" : "—"; }
function dateText(value) { return value ? value.split("-").reverse().join("/") : "—"; }
function leagueName(value) { return leagues.find(x=>x.id===value)?.label||value||"Competizione"; }
function notify(message,type="info") {
  const node=$("notice"); node.textContent=message; node.className="notice "+type; node.hidden=false;
  clearTimeout(notify.timer); notify.timer=setTimeout(()=>node.hidden=true,5000);
}
function fixture(idValue) { return s.fixtures.find(x=>x.id===idValue)||null; }
function analysisFor(item) {
  const forecast=forecastFixture(item,s.history);
  return {fixture:item,forecast,offers:forecast.available?priceOffers(buildMarketOffers(forecast),item.odds||{}):[]};
}
function options(list,selected) { return list.map(x=>'<option value="'+esc(x[0])+'" '+(selected===x[0]?"selected":"")+'>'+esc(x[1])+'</option>').join(""); }
function empty(title,description,buttonAction,buttonText) {
  return '<div class="empty-state"><span class="empty-symbol">＋</span><strong>'+esc(title)+'</strong><p>'+esc(description)+'</p>'+
    (buttonAction?'<button class="button button-secondary" data-action="'+buttonAction+'">'+esc(buttonText||"Apri")+'</button>':"")+'</div>';
}
function metric(label,value,note,cls) {
  return '<article class="metric-card"><span>'+esc(label)+'</span><strong class="'+(cls||"")+'">'+esc(value)+'</strong><small>'+esc(note)+'</small></article>';
}
function panelHead(kicker,title,right) {
  return '<div class="panel-head"><div><span class="kicker">'+esc(kicker)+'</span><h3>'+esc(title)+'</h3></div>'+(right||"")+'</div>';
}
function fixtureButton(f) {
  const result=analysisFor(f);
  return '<button class="fixture-row" data-action="open-fixture" data-id="'+esc(f.id)+'"><span class="fixture-date">'+dateText(f.date)+'<small>'+esc(leagueName(f.competition))+'</small></span><span class="fixture-teams"><strong>'+esc(f.home)+' <i>vs</i> '+esc(f.away)+'</strong><small>'+(result.forecast.available?"Campione disponibile · "+result.forecast.historyCount+" risultati":"Campione insufficiente")+'</small></span><span class="row-arrow">↗</span></button>';
}
function overview() {
  const ready=s.fixtures.filter(f=>analysisFor(f).forecast.available).length;
  const settled=s.tickets.filter(t=>t.status==="won"||t.status==="lost");
  const staked=settled.reduce((n,t)=>n+Number(t.stake||0),0);
  const net=settled.reduce((n,t)=>n+Number(t.netResult||0),0);
  const upcoming=s.fixtures.slice().sort((a,b)=>a.date.localeCompare(b.date)).slice(0,5);
  return '<section class="hero-card"><div class="hero-copy"><span class="kicker">IL METODO PRIMA DEL PRONOSTICO</span><h2>Decisioni basate su dati.<br><em>Non su sensazioni.</em></h2><p>Analisi indipendente dalle quote, confronto del prezzo e controllo della schedina. Nessuna statistica viene inventata: importa risultati verificabili e lascia che il modello segnali anche quando non sa rispondere.</p><div class="hero-actions"><button class="button button-primary" data-view="analysis">Apri analisi ↗</button><button class="button button-quiet" data-view="data">Importa dati</button></div></div><div class="hero-mark"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="core-mark">QL</div><div class="orbit-dot"></div></div><div class="hero-foot"><span>● CALCOLO LOCALE</span><span>POISSON BASELINE · NON VALIDATO</span></div></section>'+
  '<div class="section-heading"><div><span class="kicker">STATO DEL WORKSPACE</span><h2>Quadro operativo</h2></div><span class="subtle">Dati salvati su questo dispositivo</span></div>'+
  '<div class="metric-grid">'+metric("Risultati storici",s.history.length.toLocaleString("it-IT"),"partite validate")+
  metric("Partite da analizzare",s.fixtures.length.toLocaleString("it-IT"),ready+" con campione sufficiente")+
  metric("Schedine archiviate",s.tickets.length.toLocaleString("it-IT"),s.tickets.filter(t=>t.status==="open").length+" ancora aperte")+
  metric("Risultato registrato",eur(net),"su "+eur(staked)+" di puntate regolate",net>=0?"positive":"negative")+'</div>'+
  '<div class="two-column"><section class="panel">'+panelHead("PROSSIME ATTIVITÀ","Partite in workspace",'<button class="text-button" data-view="analysis">Apri elenco ↗</button>')+
  (upcoming.length?upcoming.map(fixtureButton).join(""):empty("Nessuna partita inserita","Aggiungi una partita e importa uno storico con copertura sufficiente.","go-analysis","Aggiungi partita"))+'</section>'+
  '<section class="panel">'+panelHead("CONTROLLO QUALITÀ","Stato del motore",'<span class="tag tag-warning">BASELINE</span>')+
  '<div class="quality-row"><span class="quality-icon">01</span><div><strong>Previsioni indipendenti dalle quote</strong><small>Le quote entrano solo nella valutazione economica.</small></div><span class="check">✓</span></div>'+
  '<div class="quality-row"><span class="quality-icon">02</span><div><strong>Controllo anti-leakage</strong><small>Si usano solo risultati precedenti alla data partita.</small></div><span class="check">✓</span></div>'+
  '<div class="quality-row"><span class="quality-icon">03</span><div><strong>Backtest su dati reali</strong><small>Non ancora eseguito sul tuo archivio.</small></div><span class="tag tag-warning">DA FARE</span></div>'+
  '<div class="quality-note">Calcolare probabilità non significa dimostrare un vantaggio. Servono calibrazione, backtest cronologico e misurazione su dati non usati per costruire il modello.</div></section></div>';
}
function analysisView() {
  const list=s.fixtures.slice().sort((a,b)=>a.date.localeCompare(b.date));
  const selected=fixture(s.fixtureId)||list[0]||null;
  if(selected) s.fixtureId=selected.id;
  const form='<section class="panel">'+panelHead("NUOVA ANALISI","Inserisci una partita",'<span class="step-number">01 / 02</span>')+
  '<form id="fixture-form" class="fixture-form"><label>Competizione<select name="competition">'+options(leagues.map(x=>[x.id,x.label]),"serie-a")+'</select></label>'+
  '<label>Data partita<input name="date" type="date" min="'+new Date().toISOString().slice(0,10)+'" required></label>'+
  '<label>Squadra casa<input name="home" maxlength="70" placeholder="Es. Inter" required></label>'+
  '<label>Squadra trasferta<input name="away" maxlength="70" placeholder="Es. Juventus" required></label>'+
  '<button class="button button-primary" type="submit">Aggiungi partita ＋</button></form></section>';
  const buttons=list.length?list.map(f=>{
    const ready=analysisFor(f).forecast.available;
    return '<button class="fixture-select '+(selected&&selected.id===f.id?"selected":"")+'" data-action="select-fixture" data-id="'+esc(f.id)+'"><span><strong>'+esc(f.home)+'</strong><small>'+dateText(f.date)+' · '+esc(leagueName(f.competition))+'</small></span><span class="fixture-away">vs '+esc(f.away)+'</span><span class="fixture-state '+(ready?"ready":"waiting")+'">'+(ready?"Pronta":"Dati")+'</span></button>';
  }).join(""):empty("Ancora nessuna partita","Inserisci una partita per aprire l'analisi.");
  return '<div class="page-intro"><div><span class="kicker">PRE-MATCH RESEARCH</span><h2>Prima i dati, poi il mercato.</h2><p>La stima nasce dallo storico. Inserisci le quote solo quando vuoi valutarne la convenienza.</p></div><span class="tag tag-neutral">NESSUN FEED LIVE</span></div>'+form+
  '<div class="analysis-layout"><section class="panel fixture-list-panel">'+panelHead("ELENCO","Partite salvate",'<span class="count-badge">'+list.length+'</span>')+buttons+'</section>'+
  '<section class="panel analysis-panel">'+(selected?matchAnalysis(selected):'<div class="analysis-placeholder"><div class="empty-symbol">⌁</div><h3>Seleziona una partita</h3><p>L’analisi comparirà qui quando sarà disponibile uno storico sufficiente.</p></div>')+'</section></div>';
}
function coverageCell(label,value) { return '<div><small>'+esc(label)+'</small><strong>'+esc(value??0)+'</strong></div>'; }
function probCard(label,value) { return '<div class="prob-card"><small>'+esc(label)+'</small><strong>'+percent(value)+'</strong><div class="prob-track"><i style="width:'+Math.max(0,Math.min(100,value*100))+'%"></i></div></div>'; }
function matchAnalysis(f) {
  const a=analysisFor(f),p=a.forecast;
  const header='<div class="panel-head match-analysis-head"><div><span class="kicker">ANALISI STATISTICA · '+esc(leagueName(f.competition))+'</span><h3>'+esc(f.home)+' <i>vs</i> '+esc(f.away)+'</h3><p class="muted small">'+dateText(f.date)+'</p></div><button class="icon-button" data-action="delete-fixture" data-id="'+esc(f.id)+'" title="Elimina">×</button></div>';
  if(!p.available) return header+'<div class="coverage-alert"><span class="alert-symbol">!</span><div><strong>Non forziamo una previsione.</strong><p>'+esc(p.reason)+'</p></div></div>'+
    '<div class="coverage-grid">'+coverageCell("Partite competizione",p.coverage?.leagueMatches)+coverageCell("Presenze "+f.home,p.coverage?.homeTeamMatches)+coverageCell("Casa "+f.home,p.coverage?.homeVenueMatches)+coverageCell("Trasferta "+f.away,p.coverage?.awayVenueMatches)+'</div>'+
    '<p class="footnote">Tutti i risultati utilizzati devono precedere il '+dateText(f.date)+'. Le partite disputate nella stessa data sono escluse.</p>';
  const oddsRows=a.offers.map(o=>{
    const ev=o.expectedValue,cls=ev===null?"muted":ev>0?"positive":"negative";
    return '<div class="market-row"><div class="market-name"><strong>'+esc(o.label)+'</strong><small>'+esc(o.category)+'</small></div>'+
      '<div class="market-prob"><strong>'+percent(o.probability)+'</strong><small>equa '+(o.fairOdds?o.fairOdds.toFixed(2):"—")+'</small></div>'+
      '<label class="odds-input"><span>Quota</span><input type="number" min="1.01" max="1000" step="0.01" placeholder="—" value="'+(o.odds||"")+'" data-odds="'+esc(o.key)+'" data-fixture="'+esc(f.id)+'"></label>'+
      '<div class="market-value"><strong class="'+cls+'">'+(ev===null?"—":(ev>=0?"+":"")+percent(ev))+'</strong><small>'+(ev===null?"inserisci quota":o.overround===null?"margine n.d.":"margine "+percent(o.overround))+'</small></div>'+
      '<button class="add-pick" data-action="add-pick" data-id="'+esc(f.id)+'" data-market="'+esc(o.key)+'" '+(o.odds?"":"disabled")+' title="Aggiungi">＋</button></div>';
  }).join("");
  const prob=p.probabilities;
  return header+'<div class="xg-strip"><div><small>xG CASA</small><strong>'+p.homeXg.toFixed(2)+'</strong></div><div class="xg-separator">:</div><div><small>xG TRASFERTA</small><strong>'+p.awayXg.toFixed(2)+'</strong></div><div class="confidence-pill">'+p.confidence.toUpperCase()+' CONFIDENCE</div></div>'+
  '<div class="probability-grid">'+probCard("1",prob.home)+probCard("X",prob.draw)+probCard("2",prob.away)+probCard("OVER 2,5",prob.over25)+probCard("UNDER 2,5",prob.under25)+probCard("GOL",prob.bttsYes)+'</div>'+
  '<div class="model-note"><strong>Metodo:</strong> '+esc(p.method)+'. '+esc(p.caveat)+'<span>Probabilità indipendenti dalle quote.</span></div>'+
  '<div class="market-table-head"><div><span class="kicker">VALUTAZIONE DEL PREZZO</span><h4>Mercati disponibili</h4></div><span class="subtle">Quote manuali</span></div>'+
  '<div class="market-table">'+oddsRows+'</div><p class="footnote">EV = probabilità modello × quota − 1. Il de-vig si applica solo a mercati completi con esiti mutuamente esclusivi; per la doppia chance si mostra il confronto con la probabilità implicita grezza. EV positivo non garantisce redditività.</p>';
}
function builderView() {
  const result=s.result;
  const resultHtml=!result?empty("Costruttore in attesa","Scegli la famiglia di mercato e la soglia EV, poi avvia il calcolo."):
    !result.selections.length?empty("Nessuna selezione idonea","Non ci sono quote e probabilità che rispettano tutti i criteri. Le soglie non vengono abbassate automaticamente."):
    '<div class="builder-summary"><div><small>PROBABILITÀ CONGIUNTA</small><strong>'+percent(result.probability)+'</strong></div><div><small>QUOTA COMBINATA</small><strong>'+result.combinedOdds.toFixed(2)+'</strong></div><div><small>EV TEORICO</small><strong class="positive">'+percent(result.expectedValue)+'</strong></div></div>'+
    result.selections.map(x=>'<div class="suggestion-row"><div><strong>'+esc(x.fixture.home)+' · '+esc(x.fixture.away)+'</strong><small>'+dateText(x.fixture.date)+'</small></div><div><strong>'+esc(x.offer.label)+'</strong><small>'+esc(x.offer.category)+'</small></div><div class="suggestion-metrics"><strong>'+percent(x.offer.probability)+'</strong><small>EV '+percent(x.offer.expectedValue)+' · '+x.offer.odds.toFixed(2)+'</small></div><button class="add-pick" data-action="add-pick" data-id="'+esc(x.fixture.id)+'" data-market="'+esc(x.offer.key)+'">＋</button></div>').join("")+
    '<p class="footnote">'+esc(result.assumption)+'</p><button class="button button-secondary" data-action="add-builder">Aggiungi selezioni alla schedina</button>';
  return '<div class="page-intro"><div><span class="kicker">VALUE-BASED BUILDER</span><h2>Il mercato scelto è un vincolo.</h2><p>Il motore non sostituisce la categoria scelta con un altro mercato.</p></div><span class="tag tag-neutral">NESSUN INVIO AUTOMATICO</span></div>'+
  '<section class="panel">'+panelHead("PARAMETRI","Regole del costruttore",'<span class="step-number">02 / 02</span>')+
  '<div class="builder-form"><label>Famiglia mercato<select id="build-category">'+options(categories,s.settings.category)+'</select></label>'+
  '<label>EV minimo<input id="build-ev" type="number" min="0" max="2" step="0.01" value="'+Number(s.settings.minEv).toFixed(2)+'"></label>'+
  '<label>Numero massimo selezioni<input id="build-count" type="number" min="1" max="10" step="1" value="'+s.settings.maxLegs+'"></label>'+
  '<button class="button button-primary" data-action="build">Calcola proposte ↗</button></div>'+
  '<p class="footnote">Sono incluse solo partite con storico sufficiente, quote valide, EV minimo rispettato e edge positivo sui mercati con copertura quote completa.</p></section>'+
  '<section class="panel">'+panelHead("RISULTATO","Selezioni compatibili",result?'<span class="tag tag-success">'+result.selections.length+' SELEZIONI</span>':'<span class="tag tag-neutral">IN ATTESA</span>')+resultHtml+'</section>';
}
function ticketCard(t) {
  const labels={open:"APERTA",won:"VINTA",lost:"PERSA",void:"ANNULLATA"};
  const actions=t.status==="open"?'<button class="text-button" data-action="edit-ticket" data-id="'+esc(t.id)+'">Modifica</button><button class="text-button positive" data-action="settle" data-id="'+esc(t.id)+'" data-status="won">Vinta</button><button class="text-button negative" data-action="settle" data-id="'+esc(t.id)+'" data-status="lost">Persa</button><button class="text-button" data-action="settle" data-id="'+esc(t.id)+'" data-status="void">Annulla</button>':'<span class="muted small">Esito registrato</span>';
  return '<article class="ticket-card"><div class="ticket-top"><div><span class="ticket-id">'+dateText((t.createdAt||"").slice(0,10))+' · #'+esc(t.id.slice(-6).toUpperCase())+'</span><strong>'+t.legs.length+' selezioni · quota '+Number(t.combinedOdds).toFixed(2)+'</strong></div><span class="tag '+(t.status==="won"?"tag-success":t.status==="lost"?"tag-danger":t.status==="open"?"tag-warning":"tag-neutral")+'">'+labels[t.status]+'</span></div>'+
  '<div class="ticket-legs">'+t.legs.map(l=>'<div><span>'+esc(l.home)+' · '+esc(l.away)+'</span><strong>'+esc(l.marketLabel)+'</strong><small>'+Number(l.odds).toFixed(2)+' · '+percent(l.probability)+'</small></div>').join("")+'</div>'+
  '<div class="ticket-bottom"><span>Puntata <strong>'+eur(t.stake)+'</strong> · '+(t.status==="open"?"Ritorno "+eur(t.grossReturn):"Risultato "+eur(t.netResult))+'</span><div class="ticket-actions">'+actions+'</div></div></article>';
}
function archiveView() {
  const open=s.tickets.filter(t=>t.status==="open"),done=s.tickets.filter(t=>t.status!=="open"),regulated=done.filter(t=>t.status==="won"||t.status==="lost");
  const staked=regulated.reduce((n,t)=>n+Number(t.stake||0),0),net=regulated.reduce((n,t)=>n+Number(t.netResult||0),0);
  return '<div class="page-intro"><div><span class="kicker">TICKET JOURNAL</span><h2>Misura, non ricordare a memoria.</h2><p>Modifica le schedine aperte, registra l&#39;esito e controlla il rendimento storico.</p></div></div>'+
  '<div class="metric-grid">'+metric("Schedine aperte",open.length,"da regolare")+metric("Schedine regolate",done.length,"vittorie e sconfitte")+metric("Risultato netto",eur(net),"su "+eur(staked),net>=0?"positive":"negative")+metric("ROI registrato",staked?percent(net/staked):"—","solo ticket regolati",net>=0?"positive":"negative")+'</div>'+
  '<section class="panel">'+panelHead("APERTE","Schedine da seguire",'<span class="count-badge">'+open.length+'</span>')+(open.length?open.map(ticketCard).join(""):empty("Nessuna schedina aperta","Aggiungi una selezione dall'analisi o dal costruttore.","go-analysis","Apri analisi"))+'</section>'+
  '<section class="panel">'+panelHead("STORICO","Schedine regolate",'<span class="count-badge">'+done.length+'</span>')+(done.length?done.slice().reverse().map(ticketCard).join(""):'<p class="muted">Gli esiti registrati compariranno qui.</p>')+'</section>';
}

function backtestPanel() {
  const result = s.backtest;
  const body = !result ? empty("Nessun backtest eseguito","Il test cronologico ricalcola ogni partita usando solo lo storico disponibile prima di quella data.") :
    !result.evaluatedMatches ? empty("Campione non sufficiente","Nessuna partita supera il controllo minimo di copertura. Importa uno storico più ampio.") :
    '<div class="metric-grid">'+
      metric("Previsioni valutate",result.evaluatedMatches.toLocaleString("it-IT"),"su "+result.availableMatches+" risultati importati")+
      metric("Brier score 1X2",result.model.brier1x2.toFixed(4),"più basso è meglio")+
      metric("Log loss 1X2",result.model.logLoss1x2.toFixed(4),"più basso è meglio")+
      metric("Accuratezza 1X2",percent(result.model.accuracy1x2),"esito più probabile")+
      metric("Brier baseline",result.baseline.brier1x2.toFixed(4),"frequenze storiche smussate")+
      metric("Delta Brier",((result.improvement.brier1x2>=0?"+":"")+result.improvement.brier1x2.toFixed(4)),"positivo = modello migliore",result.improvement.brier1x2>=0?"positive":"negative")+
      metric("Brier Over 2,5",result.model.brierOver25.toFixed(4),"baseline "+result.baseline.brierOver25.toFixed(4))+
      metric("Brier Gol",result.model.brierBtts.toFixed(4),"baseline "+result.baseline.brierBtts.toFixed(4))+
    '</div>'+
    '<div class="quality-note"><strong>Finestra:</strong> '+dateText(result.startDate)+' – '+dateText(result.endDate)+'. '+esc(result.method)+' '+esc(result.warning)+'</div>'+
    (result.evaluatedMatches<100?'<div class="method-warning">Campione limitato (meno di 100 previsioni): risultati esplorativi, non sufficienti a dimostrare un vantaggio statistico.</div>':'<div class="quality-note">Il superamento della baseline su questo archivio non dimostra un vantaggio futuro. Verifica la stabilità per stagione, competizione e fascia di quota.</div>');
  return '<section class="panel">'+panelHead("VALIDAZIONE STORICA","Backtest walk-forward",'<span class="tag '+(result&&result.evaluatedMatches>=100?"tag-success":"tag-warning")+'">'+(result?result.evaluatedMatches+" TEST":"NON ESEGUITO")+'</span>')+
    '<div class="builder-form backtest-controls"><label>Competizione<select id="backtest-competition">'+options(leagues.map(x=>[x.id,x.label]),s.backtestCompetition)+'</select></label><button class="button button-primary" data-action="run-backtest" '+(s.history.length?"":"disabled")+'>Esegui backtest ↗</button></div>'+body+'</section>';
}

function dataView() {
  const comps=new Set(s.history.map(x=>x.competition)).size;
  return '<div class="page-intro"><div><span class="kicker">DATA GOVERNANCE</span><h2>La qualità parte dalla fonte.</h2><p>QuotaLab non presenta dati simulati come reali e non scarica informazioni da fonti non verificate.</p></div><span class="tag tag-warning">IMPORT MANUALE</span></div>'+
  '<div class="data-grid"><section class="panel">'+panelHead("INPUT STORICO","Importa risultati CSV",'<span class="step-number">01</span>')+
  '<div class="drop-zone"><div class="upload-symbol">↑</div><strong>Carica il tuo archivio risultati</strong><p>Colonne: date, home, away, home_goals, away_goals, competition. Compatibili anche gli header football-data.co.uk: Date, Div, HomeTeam, AwayTeam, FTHG, FTAG.</p><button class="button button-primary" data-action="import-csv">Seleziona CSV</button></div><div class="data-foot"><strong>Risultato più recente</strong><span>'+(s.history.length?dateText(s.history[s.history.length-1].date):"—")+'</span></div></section>'+
  '<section class="panel">'+panelHead("PORTABILITÀ","Backup e ripristino",'<span class="step-number">02</span>')+
  '<div class="action-row"><div><strong>Esporta backup completo</strong><small>Storico, partite, schedine e impostazioni.</small></div><button class="button button-secondary" data-action="export">Esporta JSON</button></div>'+
  '<div class="action-row"><div><strong>Ripristina backup</strong><small>Sostituisce i dati locali correnti.</small></div><button class="button button-secondary" data-action="restore">Importa JSON</button></div>'+
  '<div class="action-row"><div><strong>Esporta storico</strong><small>CSV normalizzato dei risultati.</small></div><button class="button button-secondary" data-action="export-csv">Esporta CSV</button></div></section></div>'+
  '<section class="panel">'+panelHead("AUDIT DATASET","Copertura attuale",'<span class="tag tag-neutral">LOCALE</span>')+
  '<div class="coverage-grid data-coverage">'+coverageCell("Risultati caricati",s.history.length)+coverageCell("Partite future",s.fixtures.length)+coverageCell("Competizioni",comps)+coverageCell("Schedine",s.tickets.length)+'</div>'+
  '<div class="quality-note">Controlla competizione, date, nomi e punteggi prima dell&#39;importazione. I dati restano nel browser corrente. Esporta un backup regolarmente e verifica i termini della fonte originaria.</div>'+
  '<div class="danger-zone"><div><strong>Elimina workspace</strong><small>Rimuove risultati, partite, schedine e impostazioni locali.</small></div><button class="button button-danger" data-action="clear">Cancella dati</button></div></section>'+
  backtestPanel()+'<section class="panel">'+panelHead("MODEL CARD · 0.1","Metodo e limiti")+
  '<div class="method-grid"><div><strong>01 · Stima xG</strong><p>Medie offensive e difensive casa/trasferta, smoothing verso la media della competizione e decadimento temporale con emivita di 540 giorni.</p></div><div><strong>02 · Distribuzione</strong><p>Poisson indipendente per le due squadre. Le probabilità, incluse quelle combinate, sono aggregate dalla matrice dei punteggi.</p></div><div><strong>03 · Valore</strong><p>Probabilità implicita, overround, quota equa, edge e valore atteso. Il de-vig è mostrato solo con un mercato completo.</p></div><div><strong>04 · Costruttore</strong><p>La famiglia di mercato selezionata è un filtro vincolante. Una sola selezione per partita nella schedina.</p></div></div>'+
  '<div class="method-warning"><strong>Limiti noti:</strong> modello non addestrato, non calibrato e non validato su dati reali. Mancano feed live, infortuni verificati, formazioni, statistiche giocatori, quote storiche, closing line e calibrazione. Il backtest walk-forward è descrittivo e non prova la redditività. Nessuna previsione garantisce profitto.</div></section>';
}
function renderDock() {
  const odds=s.slip.reduce((n,x)=>n*Number(x.odds||1),1);
  $("slip-dock").innerHTML='<button class="slip-dock-button" data-action="drawer"><span class="slip-count">'+s.slip.length+'</span><span><strong>Schedina in costruzione</strong><small>'+(s.slip.length?s.slip.length+" selezioni · quota "+odds.toFixed(2):"Aggiungi selezioni dall'analisi")+'</small></span><strong class="slip-return">'+(s.slip.length?eur(s.stake*odds):"Apri")+'</strong><span class="dock-arrow">⌃</span></button>';
}
function renderDrawer() {
  if(!s.drawer){$("drawer-root").innerHTML="";return;}
  let calc=null;try{if(s.slip.length)calc=calculateTicket(s.slip,s.stake);}catch{}
  $("drawer-root").innerHTML='<div class="drawer-backdrop" data-action="close-drawer"></div><section class="slip-drawer" role="dialog" aria-modal="true" aria-label="Schedina">'+
  '<div class="drawer-handle"></div><div class="drawer-head"><div><span class="kicker">BET SLIP</span><h3>La tua schedina</h3></div><button class="icon-button" data-action="close-drawer">×</button></div>'+
  (s.slip.length?s.slip.map((l,i)=>'<div class="slip-leg"><div><strong>'+esc(l.home)+' · '+esc(l.away)+'</strong><small>'+dateText(l.date)+' · '+esc(l.marketLabel)+' · '+percent(l.probability)+'</small></div><label>Quota<input type="number" min="1.01" step="0.01" value="'+Number(l.odds).toFixed(2)+'" data-slip-odds="'+i+'"></label><button class="remove-pick" data-action="remove-pick" data-index="'+i+'">×</button></div>').join(""):empty("Schedina vuota","Aggiungi una selezione dall'analisi o dal costruttore."))+
  '<div class="stake-row"><label>Puntata (€)<input type="number" id="stake" min="0.01" step="0.50" value="'+s.stake+'"></label><div><small>QUOTA TOTALE</small><strong>'+(calc?calc.combinedOdds.toFixed(2):"—")+'</strong></div><div><small>RITORNO LORDO</small><strong>'+(calc?eur(calc.grossReturn):"—")+'</strong></div></div>'+
  (calc?'<div class="slip-probability">Probabilità congiunta indicativa <strong>'+percent(calc.jointProbability)+'</strong><small>Prodotto delle probabilità marginali; indipendenza tra partite non verificata.</small></div>':"")+
  '<button class="button button-primary save-ticket-button" data-action="save-ticket" '+(s.slip.length?"":"disabled")+'>'+(s.editing?"Salva modifiche":"Salva schedina nell’archivio")+'</button><button class="text-button clear-slip" data-action="clear-slip" '+(s.slip.length?"":"disabled")+'>Svuota schedina</button></section>';
}
function render() {
  $("page-title").textContent=titles[s.view];
  document.querySelectorAll("[data-view]").forEach(node=>node.classList.toggle("active",node.dataset.view===s.view));
  const renderers={overview,analysis:analysisView,builder:builderView,archive:archiveView,data:dataView};
  $("view").innerHTML=renderers[s.view]();
  renderDock();renderDrawer();
}
function addFixture(form) {
  const data=new FormData(form),f={id:id(),competition:data.get("competition"),date:data.get("date"),home:String(data.get("home")).trim(),away:String(data.get("away")).trim(),odds:{},createdAt:new Date().toISOString()};
  if(!f.date||!f.home||!f.away||normalizeName(f.home)===normalizeName(f.away)){notify("Controlla data e squadre: devono essere valide e diverse.","error");return;}
  if(s.fixtures.some(x=>x.competition===f.competition&&x.date===f.date&&normalizeName(x.home)===normalizeName(f.home)&&normalizeName(x.away)===normalizeName(f.away))){notify("Partita già presente.","error");return;}
  s.fixtures.push(f);s.fixtureId=f.id;save();render();notify("Partita aggiunta. La previsione appare solo se lo storico supera i controlli.","success");
}
function saveOdds(fixtureId,key,value) {
  const f=fixture(fixtureId);if(!f)return;
  if(String(value).trim()==="")delete f.odds[key];
  else {const n=Number(value);if(!Number.isFinite(n)||n<=1||n>1000){notify("La quota deve essere maggiore di 1 e non superiore a 1000.","error");render();return;}f.odds[key]=n;}
  save();render();
}
function addPick(fixtureId,key) {
  const f=fixture(fixtureId);if(!f)return;
  const offer=analysisFor(f).offers.find(x=>x.key===key);
  if(!offer||!offer.odds){notify("Inserisci prima una quota valida.","error");return;}
  if(s.slip.some(x=>x.fixtureId===f.id)){notify("Una sola selezione per partita: evitiamo correlazioni nascoste.","error");return;}
  s.slip.push({fixtureId:f.id,home:f.home,away:f.away,date:f.date,marketKey:offer.key,marketLabel:offer.label,category:offer.category,odds:offer.odds,probability:offer.probability,expectedValue:offer.expectedValue});
  s.drawer=true;save();render();
}
function build() {
  const category=$("build-category").value,ev=Number($("build-ev").value),count=Number($("build-count").value);
  if(!Number.isFinite(ev)||ev<0||ev>2||!Number.isInteger(count)||count<1||count>10){notify("Controlla EV minimo e numero massimo di selezioni.","error");return;}
  s.settings={category,minEv:ev,maxLegs:count};
  s.result=buildSuggestions(s.fixtures.map(analysisFor),{category,minEv:ev,maxLegs:count});
  save();render();if(!s.result.selections.length)notify("Nessuna selezione rispetta i criteri impostati.","info");
}
function addBuilder() {
  let added=0;
  for(const x of s.result?.selections||[]){if(s.slip.some(l=>l.fixtureId===x.fixture.id))continue;const o=x.offer;s.slip.push({fixtureId:x.fixture.id,home:x.fixture.home,away:x.fixture.away,date:x.fixture.date,marketKey:o.key,marketLabel:o.label,category:o.category,odds:o.odds,probability:o.probability,expectedValue:o.expectedValue});added++;}
  if(!added){notify("Nessuna nuova selezione aggiunta alla schedina.","info");return;}s.drawer=true;save();render();
}
function saveTicket() {
  try{
    const calc=calculateTicket(s.slip,s.stake);
    const ticketId=s.editing||id();
    const previous=s.tickets.find(x=>x.id===ticketId);
    const now=new Date().toISOString();
    const t={id:ticketId,createdAt:previous?.createdAt||now,updatedAt:now,status:"open",legs:s.slip.map(x=>({...x})),stake:calc.stake,combinedOdds:calc.combinedOdds,jointProbability:calc.jointProbability,grossReturn:calc.grossReturn,theoreticalExpectedValue:calc.theoreticalExpectedValue};
    const index=s.tickets.findIndex(x=>x.id===t.id);
    if(index>=0){if(s.tickets[index].status!=="open"){notify("Un ticket regolato non è modificabile.","error");return;}s.tickets[index]=t;}else s.tickets.unshift(t);
    s.slip=[];s.editing=null;s.drawer=false;save();render();notify("Schedina salvata. Nessuna puntata è stata inviata al bookmaker.","success");
  }catch(error){notify(error.message,"error");}
}
function editTicket(ticketId) {
  const t=s.tickets.find(x=>x.id===ticketId);if(!t||t.status!=="open")return;
  s.slip=t.legs.map(x=>({...x}));s.stake=t.stake;s.editing=t.id;s.view="archive";s.drawer=true;render();
}
function settle(ticketId,status) {
  const t=s.tickets.find(x=>x.id===ticketId);if(!t||t.status!=="open")return;
  if(!confirm("Registrare il ticket come "+status+"?"))return;
  t.status=status;t.settledAt=new Date().toISOString();t.netResult=status==="won"?Number(t.grossReturn)-Number(t.stake):status==="lost"?-Number(t.stake):0;
  save();render();notify("Esito registrato.","success");
}
function deleteFixture(ticketId) {
  const f=fixture(ticketId);if(!f||!confirm("Eliminare "+f.home+" · "+f.away+"?"))return;
  s.fixtures=s.fixtures.filter(x=>x.id!==ticketId);s.slip=s.slip.filter(x=>x.fixtureId!==ticketId);if(s.fixtureId===ticketId)s.fixtureId=null;save();render();
}
function download(name,text,mime) {
  const url=URL.createObjectURL(new Blob([text],{type:mime})),a=document.createElement("a");
  a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function importCsv(file) {
  if(!file)return;const reader=new FileReader();
  reader.onerror=()=>notify("Lettura CSV non riuscita.","error");
  reader.onload=()=>{
    const result=validateHistory(parseCSV(String(reader.result||"")));
    if(!result.matches.length){notify("Nessun risultato valido. Controlla gli header e il formato dei punteggi.","error");return;}
    const map=new Map(s.history.map(x=>[[x.date,x.competition,normalizeName(x.home),normalizeName(x.away)].join("|"),x]));
    let inserted=0,updated=0;
    for(const m of result.matches){const key=[m.date,m.competition,normalizeName(m.home),normalizeName(m.away)].join("|");if(map.has(key)){const old=map.get(key);if(old.homeGoals!==m.homeGoals||old.awayGoals!==m.awayGoals){s.history=s.history.filter(x=>[x.date,x.competition,normalizeName(x.home),normalizeName(x.away)].join("|")!==key);s.history.push(m);updated++;}}else{s.history.push(m);inserted++;}}
    s.history.sort((a,b)=>a.date.localeCompare(b.date));s.backtest=null;save();render();notify("Import: "+inserted+" nuovi, "+updated+" aggiornati, "+result.rejected.length+" righe scartate.","success");
  };reader.readAsText(file);
}
function importBackup(file) {
  if(!file)return;const reader=new FileReader();
  reader.onload=()=>{
    const data=read(String(reader.result||""),null);
    if(!data||data.app!=="QuotaLab"||data.version!==1||!Array.isArray(data.history)||!Array.isArray(data.fixtures)||!Array.isArray(data.tickets)){notify("Backup non riconosciuto.","error");return;}
    if(!confirm("Il ripristino sostituirà i dati locali correnti. Continuare?"))return;
    s.history=data.history;s.fixtures=data.fixtures;s.tickets=data.tickets;s.backtest=null;s.slip=Array.isArray(data.slip)?data.slip:[];s.stake=Number(data.stake)>0?Number(data.stake):5;s.editing=typeof data.editing==="string"&&s.tickets.some(ticket=>ticket.id===data.editing&&ticket.status==="open")?data.editing:null;s.settings={...s.settings,...(data.settings||{})};save();render();notify("Backup ripristinato.","success");
  };reader.onerror=()=>notify("Lettura backup non riuscita.","error");reader.readAsText(file);
}
function clearData() {
  if(!confirm("Cancellare tutti i risultati, le partite e le schedine locali?"))return;
  s.history=[];s.fixtures=[];s.tickets=[];s.backtest=null;s.slip=[];s.editing=null;s.result=null;s.fixtureId=null;save();render();notify("Workspace azzerato.","success");
}
document.addEventListener("click",event=>{
  const nav=event.target.closest("[data-view]");if(nav){s.view=nav.dataset.view;s.drawer=false;render();return;}
  const button=event.target.closest("[data-action]");if(!button||button.disabled)return;
  const act=button.dataset.action,ref=button.dataset.id;
  if(act==="go-analysis"){s.view="analysis";render();}
  else if(act==="open-fixture"){s.fixtureId=ref;s.view="analysis";render();}
  else if(act==="select-fixture"){s.fixtureId=ref;render();}
  else if(act==="delete-fixture")deleteFixture(ref);
  else if(act==="add-pick")addPick(ref,button.dataset.market);
  else if(act==="build")build();
  else if(act==="run-backtest"){s.backtestCompetition=$("backtest-competition").value;s.backtest=backtestHistory(s.history,{competition:s.backtestCompetition});render();if(!s.backtest.evaluatedMatches)notify("Nessuna partita supera i controlli di copertura per questa competizione.","info");else notify("Backtest completato su "+s.backtest.evaluatedMatches+" previsioni cronologiche.","success");}
  else if(act==="add-builder")addBuilder();
  else if(act==="drawer"){s.drawer=!s.drawer;renderDrawer();}
  else if(act==="close-drawer"){s.drawer=false;renderDrawer();}
  else if(act==="remove-pick"){s.slip.splice(Number(button.dataset.index),1);save();render();}
  else if(act==="clear-slip"){s.slip=[];s.editing=null;save();render();}
  else if(act==="save-ticket")saveTicket();
  else if(act==="edit-ticket")editTicket(ref);
  else if(act==="settle")settle(ref,button.dataset.status);
  else if(act==="import-csv")$("history-file").click();
  else if(act==="restore")$("backup-file").click();
  else if(act==="export"){download("quotalab-backup.json",JSON.stringify({app:"QuotaLab",version:1,exportedAt:new Date().toISOString(),history:s.history,fixtures:s.fixtures,tickets:s.tickets,slip:s.slip,stake:s.stake,editing:s.editing,settings:s.settings},null,2),"application/json");}
  else if(act==="export-csv"){const rows=[["date","competition","home","away","home_goals","away_goals"],...s.history.map(x=>[x.date,x.competition,x.home,x.away,x.homeGoals,x.awayGoals])];download("quotalab-history.csv",rows.map(row=>row.map(x=>'"'+String(x??"").replace(/"/g,'""')+'"').join(",")).join("\r\n"),"text/csv;charset=utf-8");}
  else if(act==="clear")clearData();
});
document.addEventListener("submit",event=>{if(event.target.id==="fixture-form"){event.preventDefault();addFixture(event.target);}});
document.addEventListener("change",event=>{
  const t=event.target;
  if(t.matches("[data-odds]"))saveOdds(t.dataset.fixture,t.dataset.odds,t.value);
  else if(t.id==="history-file"){importCsv(t.files?.[0]);t.value="";}
  else if(t.id==="backup-file"){importBackup(t.files?.[0]);t.value="";}
  else if(t.id==="stake"){const n=Number(t.value);if(n>0&&n<=1000000){s.stake=n;save();renderDrawer();}else notify("Puntata non valida.","error");}
  else if(t.matches("[data-slip-odds]")){const i=Number(t.dataset.slipOdds),n=Number(t.value);if(s.slip[i]&&n>1&&n<=1000){s.slip[i].odds=n;save();render();}else notify("Quota non valida.","error");}
});
load();render();
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
