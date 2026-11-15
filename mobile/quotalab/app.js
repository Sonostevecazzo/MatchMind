import { normalizeName, normalizeDate, currentSeasonCode, parseCSV, validateHistory, forecastFixture, buildMarketOffers, priceOffers, buildSuggestions, calculateTicket, backtestHistory } from "./engine.js";

const KEY = "quotalab.store.v1";
const DATAHUB_PACKAGE_URL = "https://datahub.io/football/italian-serie-a/_r/-/datapackage.json";
const DATAHUB_BASE_URL = "https://datahub.io/football/italian-serie-a/_r/-/";
const AUTO_FIXTURE_REFRESH_MS = 12 * 60 * 60 * 1000;
const AUTO_HISTORY_REFRESH_MS = 7 * 24 * 60 * 60 * 1000;
const $ = id => document.getElementById(id);
const titles = { overview:"Panoramica", analysis:"Analisi partite", builder:"Costruttore", archive:"Archivio", data:"Dati e metodo" };
const leagues = [
  {id:"serie-a",label:"Serie A",folder:"ITA_1_serie-a"},
  {id:"champions-league",label:"Champions League",folder:"UEFA_1_champions-league"},
  {id:"europa-league",label:"Europa League",folder:"UEFA_1_europa-league"}
];
const OPEN_MATCHDAY_BASES = [
  "https://cdn.jsdelivr.net/gh/oladeeayo/open-matchday@master/data",
  "https://raw.githubusercontent.com/oladeeayo/open-matchday/master/data"
];
const categories = [
  ["auto","Tutti i mercati"],["1x2","1X2"],["double","Doppia chance"],["goals","Over / Under"],
  ["btts","Gol / No Gol"],["combo-goals","1X2 + Over / Under"],["combo-btts","1X2 + Gol / No Gol"]
];
let sisalCaptureRequestId=null,sisalCaptureTimer=null;
const s = { view:"overview", fixtureId:null, history:[], fixtures:[], tickets:[], slip:[], stake:5, editing:null, drawer:false, result:null, backtest:null, backtestCompetition:"serie-a", syncing:false, sourceMeta:{}, settings:{category:"auto",minEv:0.03,maxLegs:5,strategy:"balanced",targetProbability:0.55,period:"next-round",competition:"serie-a"} };

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
  s.sourceMeta=data.sourceMeta&&typeof data.sourceMeta==="object"?data.sourceMeta:{};
  s.slip=s.slip.filter(x=>x && x.fixtureId && Number(x.odds)>1);
}
function save() { localStorage.setItem(KEY,JSON.stringify({version:1,history:s.history,fixtures:s.fixtures,tickets:s.tickets,slip:s.slip,stake:s.stake,editing:s.editing,settings:s.settings,sourceMeta:s.sourceMeta})); }
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
  const list=s.fixtures.slice().filter(item=>item.date>=new Date().toISOString().slice(0,10)).sort((a,b)=>a.date.localeCompare(b.date));
  const selected=fixture(s.fixtureId)||list[0]||null;
  if(selected)s.fixtureId=selected.id;
  const buttons=list.length?list.map(item=>{
    const ready=analysisFor(item).forecast.available;
    return '<button class="fixture-select '+(selected&&selected.id===item.id?"selected":"")+'" data-action="select-fixture" data-id="'+esc(item.id)+'"><span><strong>'+esc(item.home)+'</strong><small>'+dateText(item.date)+' · '+esc(leagueName(item.competition))+'</small></span><span class="fixture-away">vs '+esc(item.away)+'</span><span class="fixture-state '+(ready?"ready":"waiting")+'">'+(ready?"Pronta":"Storico insufficiente")+'</span></button>';
  }).join(""):empty("Calendario in aggiornamento","Le partite vengono scaricate automaticamente. Se il calendario non compare, aggiorna le fonti dalla sezione Dati.");
  return '<div class="page-intro"><div><span class="kicker">PRE-MATCH RESEARCH</span><h2>Prima i dati, poi il mercato.</h2><p>Partite e risultati vengono acquisiti dalle fonti collegate. Le quote arrivano da Sisal tramite il bridge.</p></div><span class="tag tag-neutral">DATI AUTOMATICI</span></div>'+
  '<div class="analysis-layout"><section class="panel fixture-list-panel">'+panelHead("CALENDARIO","Partite future",'<span class="count-badge">'+list.length+'</span>')+buttons+'</section>'+
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
      '<div class="market-odds"><strong>'+(o.odds?o.odds.toFixed(2):"—")+'</strong><small>'+(o.odds?"Sisal":"non acquisita")+'</small></div>'+
      '<div class="market-value"><strong class="'+cls+'">'+(ev===null?"—":(ev>=0?"+":"")+percent(ev))+'</strong><small>'+(ev===null?"quota mancante":o.overround===null?"margine n.d.":"margine "+percent(o.overround))+'</small></div>'+
      '<button class="add-pick" data-action="add-pick" data-id="'+esc(f.id)+'" data-market="'+esc(o.key)+'" '+(o.odds?"":"disabled")+' title="Aggiungi">＋</button></div>';
  }).join("");
  const prob=p.probabilities;
  return header+'<div class="xg-strip"><div><small>GOL ATTESI CASA</small><strong>'+p.homeXg.toFixed(2)+'</strong></div><div class="xg-separator">:</div><div><small>GOL ATTESI OSPITE</small><strong>'+p.awayXg.toFixed(2)+'</strong></div><div class="confidence-pill">'+p.confidence.toUpperCase()+' CONFIDENCE</div></div>'+
  '<div class="probability-grid">'+probCard("1",prob.home)+probCard("X",prob.draw)+probCard("2",prob.away)+probCard("OVER 2,5",prob.over25)+probCard("UNDER 2,5",prob.under25)+probCard("GOL",prob.bttsYes)+'</div>'+
  '<div class="model-note"><strong>Metodo:</strong> '+esc(p.method)+'. '+esc(p.caveat)+'<span>Probabilità indipendenti dalle quote.</span></div>'+
  '<div class="market-table-head"><div><span class="kicker">VALUTAZIONE DEL PREZZO</span><h4>Mercati disponibili</h4></div><span class="subtle">Quote Sisal · '+(f.oddsSource==="Sisal"?"aggiornate":"non ancora sincronizzate")+'</span></div>'+
  '<div class="market-table">'+oddsRows+'</div><p class="footnote">EV = probabilità modello × quota − 1. Il de-vig si applica solo a mercati completi con esiti mutuamente esclusivi; per la doppia chance si mostra il confronto con la probabilità implicita grezza. EV positivo non garantisce redditività.</p>';
}
function builderView() {
  const settings=s.settings;
  const result=s.result;
  const strategies=[
    ["balanced","Bilanciata","Probabilità solide, con vantaggio quota quando esiste"],
    ["accuracy","Più probabili","Ordina per probabilità stimata, senza inseguire quote alte"],
    ["value","Valore (+EV)","Mostra soltanto selezioni con quota reale e valore atteso positivo"],
    ["double","Obiettivo 2,00","Cerca una doppia con quota combinata vicina a 2,00"]
  ];
  const selectedStrategy=strategies.find(item=>item[0]===settings.strategy)||strategies[0];
  const canAdd=Boolean(result?.selections?.length&&result.selections.every(item=>Number(item.offer.odds)>1));
  const resultHtml=!result?empty("Costruttore pronto","Scegli strategia, competizione e mercato. QuotaLab analizzerà tutte le partite disponibili nel periodo.") :
    !result.selections.length?empty(result.strategy==="value"?"Nessun valore verificabile":"Nessuna selezione idonea",result.message||"Non ci sono selezioni che rispettano i criteri. Le soglie non vengono abbassate automaticamente.") :
    '<div class="builder-summary"><div><small>PROBABILITÀ COMBINATA</small><strong>'+percent(result.probability)+'</strong></div><div><small>QUOTA COMBINATA</small><strong>'+(result.combinedOdds?result.combinedOdds.toFixed(2):"NON DISPONIBILE")+'</strong></div><div><small>VALORE ATTESO</small><strong class="'+(result.expectedValue!==null&&result.expectedValue>0?"positive":"")+'">'+(result.expectedValue===null?"NON CALCOLABILE":percent(result.expectedValue))+'</strong></div></div>'+
    '<div class="target-status '+(result.targetReached?"target-ok":"target-missed")+'">Obiettivo probabilità '+percent(settings.targetProbability)+' · '+(result.targetReached?"raggiunto":"non raggiunto")+' · '+esc(result.periodLabel)+'</div>'+
    result.selections.map((item,index)=>'<div class="suggestion-row"><div><strong>'+esc(item.fixture.home)+' · '+esc(item.fixture.away)+'</strong><small>'+dateText(item.fixture.date)+' · '+esc(leagueName(item.fixture.competition))+'</small></div><div><strong>'+esc(item.offer.label)+'</strong><small>'+esc(item.offer.category)+'</small></div><div class="suggestion-metrics"><strong>'+percent(item.offer.probability)+'</strong><small>'+(item.offer.odds?("Quota "+item.offer.odds.toFixed(2)+" · EV "+percent(item.offer.expectedValue)):"Quota non acquisita")+'</small></div>'+(item.offer.odds?'<button class="add-pick" data-action="add-pick" data-id="'+esc(item.fixture.id)+'" data-market="'+esc(item.offer.key)+'">＋</button>':'<span class="quote-missing">—</span>')+'</div>').join("")+
    '<p class="footnote">'+esc(result.assumption)+'</p>'+
    (canAdd?'<button class="button button-secondary" data-action="add-builder">Aggiungi selezioni alla schedina</button>':'<div class="method-warning">Le probabilità sono disponibili, ma non sono state acquisite quote correnti verificabili. Non posso calcolare EV né aggiungere queste proposte a una schedina con quote inventate.</div>');
  return '<div class="page-intro"><div><span class="kicker">BET BUILDER</span><h2>Costruisci una proposta leggibile.</h2><p>Prima scegli l’obiettivo, poi controlla ogni partita e la motivazione statistica. Una sola selezione per evento.</p></div><span class="tag tag-neutral">'+s.fixtures.length+' PARTITE A CALENDARIO</span></div>'+
  '<section class="panel">'+panelHead("01 · STRATEGIA","Che tipo di schedina vuoi costruire?")+
  '<div class="strategy-grid">'+strategies.map(item=>'<button type="button" class="strategy-card '+(settings.strategy===item[0]?"active":"")+'" data-strategy="'+item[0]+'"><strong>'+item[1]+'</strong><small>'+item[2]+'</small></button>').join("")+'</div>'+
  '<div class="builder-form builder-form-wide"><label>Competizione<select id="build-competition">'+options(leagues.map(x=>[x.id,x.label]),settings.competition)+'</select></label>'+
  '<label>Tipo di mercato<select id="build-category">'+options(categories,settings.category)+'</select></label>'+
  '<label>Periodo<select id="build-period">'+options([["next-round","Prossima giornata / turno"],["7","Prossimi 7 giorni"],["14","Prossimi 14 giorni"],["30","Prossimi 30 giorni"],["all","Tutte le partite future"]],settings.period)+'</select></label>'+
  '<label>Numero massimo selezioni<select id="build-count">'+options(Array.from({length:10},(_,i)=>[String(i+1),String(i+1)]),String(settings.maxLegs))+'</select></label></div>'+
  '<div class="target-control"><label for="build-target">Probabilità obiettivo della combinazione <strong id="target-label">'+percent(settings.targetProbability)+'</strong></label><input id="build-target" type="range" min="10" max="95" step="1" value="'+Math.round(settings.targetProbability*100)+'"><div class="range-scale"><span>10% · più rischiosa</span><span>95% · più prudente</span></div></div>'+
  '<div class="builder-form builder-form-wide"><label>EV minimo (solo strategia valore)<input id="build-ev" type="number" min="0" max="2" step="0.01" value="'+Number(settings.minEv).toFixed(2)+'"></label><button class="button button-primary" data-action="build">Genera proposta</button></div>'+
  '<div class="source-actions"><button class="button button-secondary" data-action="sync-sisal">Acquisisci quote Sisal</button><span class="small">Apri Sisal in una finestra collegata: le quote vengono lette dallo userscript, non inserite a mano.</span></div><p class="footnote">La strategia “Più probabili” non richiede quote per ordinare le stime. “Valore (+EV)” e “Obiettivo 2,00” richiedono quote bookmaker correnti e verificabili.</p></section>'+
  '<section class="panel">'+panelHead("02 · PROPOSTA","Selezioni suggerite",result?'<span class="tag tag-success">'+result.selections.length+' SELEZIONI</span>':'<span class="tag tag-neutral">IN ATTESA</span>')+resultHtml+'</section>';
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


async function fetchOpenMatchdayCsv(relativePath) {
  const failures=[];
  for(const base of OPEN_MATCHDAY_BASES) {
    try {
      const response=await fetch(base+"/"+relativePath,{mode:"cors",credentials:"omit",cache:"no-store"});
      if(!response.ok) { failures.push("HTTP "+response.status); continue; }
      const content=await response.text();
      if(content.trim()) return content;
      failures.push("file CSV vuoto");
    } catch(error) {
      failures.push(error?.message||"errore di rete/CORS");
    }
  }
  throw new Error("Fonte CSV non raggiungibile ("+failures.join(" / ")+"). Puoi importare lo stesso dataset manualmente.");
}
function currentSeasonLabel() {
  const code=currentSeasonCode();
  return "20"+code.slice(0,2)+"/20"+code.slice(2);
}

async function fetchTextWithFallback(urls) {
  const failures=[];
  for(const url of urls) {
    let timeout=null;
    try {
      const controller=new AbortController();
      timeout=setTimeout(()=>controller.abort(),18000);
      const response=await fetch(url,{mode:"cors",credentials:"omit",cache:"no-store",signal:controller.signal});
      if(!response.ok){failures.push("HTTP "+response.status);continue;}
      const body=await response.text();
      if(body.trim())return body;
      failures.push("risposta vuota");
    } catch(error) { failures.push(error?.name==="AbortError"?"timeout":(error?.message||"errore rete/CORS")); }
    finally { if(timeout)clearTimeout(timeout); }
  }
  throw new Error(failures.join(" / ")||"fonte non raggiungibile");
}
function mergeHistoryRows(matches,source) {
  const map=new Map(s.history.map(match=>[matchKey(match),match]));
  let added=0,updated=0;
  for(const incoming of matches) {
    const key=matchKey(incoming),prior=map.get(key);
    if(!prior){map.set(key,{...incoming,source});added++;continue;}
    const oldStats=prior.stats||{},mergedStats={...oldStats};
    for(const [name,value] of Object.entries(incoming.stats||{}))if(value!==null&&value!==undefined)mergedStats[name]=value;
    const changed=prior.homeGoals!==incoming.homeGoals||prior.awayGoals!==incoming.awayGoals||
      Object.keys(mergedStats).some(name=>mergedStats[name]!==oldStats[name]);
    if(changed)updated++;
    map.set(key,{...prior,...incoming,stats:mergedStats,source:source==="open-matchday"?source:(prior.source||source)});
  }
  s.history=Array.from(map.values()).sort((a,b)=>a.date.localeCompare(b.date));
  return {added,updated};
}
async function syncHistoricalSerieA() {
  const metadata=JSON.parse(await fetchTextWithFallback([DATAHUB_PACKAGE_URL]));
  const resources=(metadata.resources||[]).filter(resource=>/^season-\d{4}\.csv$/i.test(String(resource.path||"")));
  resources.sort((a,b)=>String(b.name).localeCompare(String(a.name)));
  const selected=resources.slice(0,10);
  if(!selected.length)throw new Error("Il catalogo DataHub non contiene stagioni CSV riconoscibili.");
  const outcomes=await Promise.allSettled(selected.map(async resource=>{
    const csv=await fetchTextWithFallback([DATAHUB_BASE_URL+encodeURIComponent(resource.path)]);
    const parsed=validateHistory(parseCSV(csv),"serie-a");
    if(!parsed.matches.length)throw new Error(resource.name+": nessun risultato valido");
    return parsed.matches;
  }));
  const valid=outcomes.filter(item=>item.status==="fulfilled").flatMap(item=>item.value);
  const failures=outcomes.filter(item=>item.status==="rejected").length;
  if(!valid.length)throw new Error("Nessuna stagione storica scaricabile.");
  const merged=mergeHistoryRows(valid,"datahub-football-data");
  s.sourceMeta.history={name:"DataHub / football-data.co.uk",updatedAt:new Date().toISOString(),matches:valid.length,seasons:outcomes.filter(item=>item.status==="fulfilled").length,failures,license:"ODC-PDDL-1.0"};
  s.backtest=null;
  return {...merged,seasons:s.sourceMeta.history.seasons,failures};
}
function matchKey(match) {
  return [match.competition,match.date,normalizeName(match.home),normalizeName(match.away)].join("|");
}
async function syncCompetitionFromOpenMatchday(competition) {
  const league=leagues.find(item=>item.id===competition);
  if(!league) throw new Error("Competizione non supportata.");
  const season=currentSeasonCode();
  const base=league.folder+"/";
  const [resultsText,fixturesText]=await Promise.all([
    fetchOpenMatchdayCsv(base+"results_"+season+".csv"),
    fetchOpenMatchdayCsv(base+"fixtures_"+season+".csv")
  ]);
  const resultRows=parseCSV(resultsText);
  const fixtureRows=parseCSV(fixturesText);
  const resultHeaders=Object.keys(resultRows[0]||{});
  const fixtureHeaders=Object.keys(fixtureRows[0]||{});
  if(!["date","home","away","ft_home","ft_away"].every(key=>resultHeaders.includes(key))||
     !["date","home","away"].every(key=>fixtureHeaders.includes(key))) {
    throw new Error("Formato CSV upstream non riconosciuto: nessun dato è stato modificato.");
  }
  const validated=validateHistory(resultRows,competition);
  const historyMap=new Map(s.history.map(match=>[matchKey(match),match]));
  let addedResults=0,updatedResults=0;
  for(const match of validated.matches) {
    const key=matchKey(match),prior=historyMap.get(key);
    if(!prior) addedResults+=1;
    else if(prior.homeGoals!==match.homeGoals||prior.awayGoals!==match.awayGoals) updatedResults+=1;
    historyMap.set(key,match);
  }
  s.history=Array.from(historyMap.values()).sort((a,b)=>a.date.localeCompare(b.date));

  const fixtureMap=new Map(s.fixtures.filter(item=>item.competition===competition).map(item=>[matchKey(item),item]));
  const refreshed=[];
  for(const row of fixtureRows) {
    const date=normalizeDate(row.date),home=String(row.home||"").trim(),away=String(row.away||"").trim();
    if(!date||!home||!away||normalizeName(home)===normalizeName(away)) continue;
    const key=matchKey({competition,date,home,away});
    const prior=fixtureMap.get(key);
    refreshed.push({
      ...(prior||{}),id:prior?.id||id(),competition,date,home,away,
      odds:prior?.odds||{},source:"open-matchday",
      gameweek:String(row.gw||""),kickoffTime:String(row.time||"")
    });
  }
  if(refreshed.length) {
    const refreshedKeys=new Set(refreshed.map(matchKey));
    s.fixtures=s.fixtures.filter(item=>item.competition!==competition||
      (item.source!=="open-matchday"&&!refreshedKeys.has(matchKey(item)))).concat(refreshed);
    s.fixtures.sort((a,b)=>a.date.localeCompare(b.date));
  }
  return {
    competition:league.label,addedResults,updatedResults,rejectedResults:validated.rejected.length,
    fixtures:refreshed.length,season
  };
}
async function syncOpenMatchday({silent=false,managed=false}={}) {
  if(s.syncing&&!managed)return;
  if(!managed){s.syncing=true;render();}
  const outcomes=[];
  for(const league of leagues) {
    try { outcomes.push({ok:true,...await syncCompetitionFromOpenMatchday(league.id)}); }
    catch(error) { outcomes.push({ok:false,competition:league.label,error:error?.message||"Errore di rete"}); }
  }
  if(!managed)s.syncing=false;
  const successful=outcomes.filter(item=>item.ok);
  if(successful.length)s.sourceMeta.fixtures={name:"Open Matchday",updatedAt:new Date().toISOString(),competitions:successful.map(item=>item.competition),fixtures:successful.reduce((sum,item)=>sum+item.fixtures,0)};
  save();render();
  const success=outcomes.filter(item=>item.ok);
  const failures=outcomes.filter(item=>!item.ok);
  const details=success.map(item=>item.competition+": +"+item.addedResults+" risultati, "+item.updatedResults+" corretti, "+item.fixtures+" partite a calendario").join(" · ");
  if(failures.length&&successful.length)s.sourceMeta.fixtures.failures=failures.map(item=>({competition:item.competition,error:item.error}));
  if(!successful.length)throw new Error(failures.map(item=>item.competition+": "+item.error).join("; ")||"Nessuna competizione aggiornata.");
  if(!silent){if(success.length&&!failures.length) notify("Calendari aggiornati. "+details,"success");
  else if(success.length) notify("Aggiornamento parziale. "+details+". Non raggiunte: "+failures.map(item=>item.competition+" ("+item.error+")").join("; "),"info");
  else notify("Calendari non aggiornati: "+failures.map(item=>item.competition+" ("+item.error+")").join("; "),"error");}
  return outcomes;
}




async function syncAllSources({silent=false,force=false}={}) {
  if(s.syncing)return;
  const now=Date.now(),historyAt=Date.parse(s.sourceMeta.history?.updatedAt||"")||0,fixturesAt=Date.parse(s.sourceMeta.fixtures?.updatedAt||"")||0;
  const needHistory=force||!s.history.length||now-historyAt>AUTO_HISTORY_REFRESH_MS;
  const needFixtures=force||!s.fixtures.length||now-fixturesAt>AUTO_FIXTURE_REFRESH_MS;
  if(!needHistory&&!needFixtures)return;
  s.syncing=true;render();
  const tasks=[];
  if(needHistory)tasks.push(syncHistoricalSerieA().then(value=>({source:"history",ok:true,value})).catch(error=>({source:"history",ok:false,error:error.message})));
  if(needFixtures)tasks.push(syncOpenMatchday({silent:true,managed:true}).then(value=>({source:"fixtures",ok:true,value})).catch(error=>({source:"fixtures",ok:false,error:error.message})));
  const results=await Promise.all(tasks);
  s.syncing=false;
  s.sourceMeta.lastAttemptAt=new Date().toISOString();
  s.sourceMeta.lastErrors=results.filter(item=>!item.ok).map(item=>({source:item.source,error:item.error,at:s.sourceMeta.lastAttemptAt}));
  save();render();
  const ok=results.filter(item=>item.ok);
  if(!silent) {
    if(ok.length===results.length)notify("Fonti aggiornate automaticamente. "+ok.map(item=>item.source==="history"?(item.value.added+" nuovi risultati storici, "+item.value.seasons+" stagioni"):"calendari e risultati correnti").join(" · "),"success");
    else notify("Aggiornamento parziale. I dati già acquisiti sono stati conservati. "+results.filter(item=>!item.ok).map(item=>item.source+": "+item.error).join(" · "),"info");
  }
}
function maybeAutoSync() {
  const now=Date.now(),historyAt=Date.parse(s.sourceMeta.history?.updatedAt||"")||0,fixturesAt=Date.parse(s.sourceMeta.fixtures?.updatedAt||"")||0,attemptAt=Date.parse(s.sourceMeta.lastAttemptAt||"")||0;
  if(now-attemptAt<15*60*1000)return;
  if(!s.history.length||!s.fixtures.length||now-historyAt>AUTO_HISTORY_REFRESH_MS||now-fixturesAt>AUTO_FIXTURE_REFRESH_MS)syncAllSources({silent:true});
}
function sourceCard(title,description,meta,link) {
  const status=meta?.updatedAt?("Scaricato "+new Date(meta.updatedAt).toLocaleString("it-IT")):"In attesa del primo aggiornamento";
  return '<div class="source-card"><div class="source-card-top"><strong>'+esc(title)+'</strong><span class="tag '+(meta?.updatedAt?"tag-success":"tag-warning")+'">'+(meta?.updatedAt?"COLLEGATA":"IN ATTESA")+'</span></div><p>'+esc(description)+'</p><div class="source-card-foot"><small>'+esc(status)+'</small><a href="'+esc(link)+'" target="_blank" rel="noopener">Fonte ↗</a></div></div>';
}
function dataView() {
  const statsMatches=s.history.filter(match=>Object.values(match.stats||{}).some(value=>value!==null&&value!==undefined)).length;
  const historyMeta=s.sourceMeta.history,fixtureMeta=s.sourceMeta.fixtures;
  const errors=(s.sourceMeta.lastErrors||[]).map(item=>'<li>'+esc(item.source)+': '+esc(item.error)+'</li>').join("")+(fixtureMeta?.failures||[]).map(item=>'<li>Open Matchday · '+esc(item.competition)+': '+esc(item.error)+'</li>').join("");
  return '<div class="page-intro"><div><span class="kicker">DATA PIPELINE</span><h2>I dati arrivano automaticamente.</h2><p>QuotaLab aggiorna lo storico e il calendario all’apertura, poi ripete il controllo quando le fonti diventano obsolete. Non devi caricare archivi.</p></div><span class="tag '+(s.syncing?"tag-warning":"tag-success")+'">'+(s.syncing?"AGGIORNAMENTO":"AUTO-SYNC")+'</span></div>'+
  '<section class="panel">'+panelHead("AGGIORNAMENTO","Fonti collegate",'<span class="step-number">AUTO</span>')+
  '<div class="source-grid">'+
  sourceCard("Storico Serie A","Fino a 10 stagioni di risultati e statistiche disponibili: tiri, tiri in porta, corner e cartellini.",historyMeta,"https://datahub.io/football/italian-serie-a")+
  sourceCard("Calendari e risultati correnti","Serie A, Champions League ed Europa League. Aggiornamento upstream giornaliero, non live.",fixtureMeta,"https://github.com/oladeeayo/open-matchday")+
  sourceCard("Quote pre-partita Sisal","Quote acquisite dalla pagina Sisal tramite userscript installato. Non è un feed live e non piazza scommesse.",s.sourceMeta.sisal,"https://www.sisal.it/scommesse-matchpoint/sport/calcio")+
  '</div><p class="small">Per collegare Sisal, installa <a href="https://raw.githubusercontent.com/Sonostevecazzo/MatchMind/main/mobile/scripts/sisal-matchmind.user.js" target="_blank" rel="noopener">QuotaLab / MatchMind · Sisal Bridge 3.1.0</a> in Tampermonkey o Violentmonkey.</p><div class="source-actions"><button class="button button-primary" data-action="sync-all" '+(s.syncing?"disabled":"")+'>'+(s.syncing?"Aggiornamento in corso…":"Aggiorna tutte le fonti")+'</button><span class="small">Storico: '+(historyMeta?historyMeta.seasons+" stagioni valide":"non ancora acquisito")+' · Partite future: '+s.fixtures.length+'</span></div>'+
  (errors?'<div class="method-warning"><strong>Ultimi errori di collegamento</strong><ul>'+errors+'</ul>I dati precedentemente acquisiti non vengono cancellati.</div>':"")+
  '<div class="quality-note">Fonti: <a href="https://datahub.io/football/italian-serie-a" target="_blank" rel="noopener">DataHub / football-data.co.uk</a> (ODC-PDDL) e <a href="https://github.com/oladeeayo/open-matchday" target="_blank" rel="noopener">Open Matchday</a> (uso personale non commerciale con attribuzione). I dati dettagliati hanno copertura disomogenea. Nessuna fonte gratuita verificata fornisce qui quote Sisal live, formazioni e infortuni in modo completo.</div></section>'+
  '<section class="panel">'+panelHead("PORTABILITÀ","Backup locale",'<span class="step-number">02</span>')+
  '<div class="action-row"><div><strong>Esporta backup completo</strong><small>Storico scaricato, partite, schedine e impostazioni.</small></div><button class="button button-secondary" data-action="export">Esporta JSON</button></div>'+
  '<div class="action-row"><div><strong>Ripristina backup</strong><small>Sostituisce i dati locali correnti.</small></div><button class="button button-secondary" data-action="restore">Importa JSON</button></div>'+
  '<div class="action-row"><div><strong>Esporta storico</strong><small>CSV normalizzato dei risultati acquisiti.</small></div><button class="button button-secondary" data-action="export-csv">Esporta CSV</button></div></section>'+
  '<section class="panel">'+panelHead("AUDIT DATASET","Copertura attuale",'<span class="tag tag-neutral">LOCALE</span>')+
  '<div class="coverage-grid data-coverage">'+coverageCell("Risultati caricati",s.history.length)+coverageCell("Partite future",s.fixtures.length)+coverageCell("Partite con statistiche",statsMatches)+coverageCell("Schedine",s.tickets.length)+'</div>'+
  '<div class="quality-note">I risultati e le statistiche sono conservati localmente. Le quote Sisal sono acquisite separatamente e hanno un proprio orario di rilevazione. Il modello non attribuisce valori ai campi mancanti.</div>'+
  '<div class="danger-zone"><div><strong>Elimina workspace</strong><small>Rimuove risultati, partite, schedine e impostazioni locali.</small></div><button class="button button-danger" data-action="clear">Cancella dati</button></div></section>'+
  backtestPanel()+'<section class="panel">'+panelHead("MODEL CARD · 0.2","Metodo e limiti")+
  '<div class="method-grid"><div><strong>01 · Storico</strong><p>Risultati multi-stagione Serie A, con pesi temporali e separazione casa/trasferta.</p></div><div><strong>02 · Statistiche</strong><p>Tiri, tiri in porta, corner e cartellini sono acquisiti quando la fonte li pubblica; non vengono imputati quando assenti.</p></div><div><strong>03 · Probabilità</strong><p>Poisson indipendente sui gol. Le statistiche aggiuntive sono contesto, non feature calibrate.</p></div><div><strong>04 · Quote</strong><p>Le quote correnti sono acquisite da Sisal tramite userscript e sono associate alla partita prima di calcolare EV.</p></div></div>'+
  '<div class="method-warning"><strong>Limiti:</strong> non sono ancora disponibili un feed Sisal live verificato, infortuni, formazioni e xG ufficiali. Non vengono simulati. Il backtest è descrittivo e non dimostra redditività.</div></section>';
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
function openSisalOddsCapture() {
  const competition=$("build-competition")?.value||s.settings.competition||"serie-a";
  const period=$("build-period")?.value||s.settings.period||"next-round";
  let fixtures=s.fixtures.filter(item=>item.competition===competition&&item.date>=new Date().toISOString().slice(0,10)).sort((a,b)=>a.date.localeCompare(b.date));
  if(period==="next-round"&&fixtures.length) {
    const first=fixtures[0];
    fixtures=first.gameweek?fixtures.filter(item=>String(item.gameweek)===String(first.gameweek)):fixtures.filter(item=>Math.abs(Date.parse(item.date+"T12:00:00")-Date.parse(first.date+"T12:00:00"))<=3*86400000);
  } else if(period!=="all") {
    const end=Date.now()+Number(period||7)*86400000;
    fixtures=fixtures.filter(item=>Date.parse(item.date+"T12:00:00")<=end);
  }
  if(!fixtures.length){notify("Non ci sono partite future da confrontare con Sisal.","info");return;}
  const payload={version:1,requestId:id(),fixtures:fixtures.map(item=>({id:item.id,competition:item.competition,date:item.date,home:item.home,away:item.away}))};
  sisalCaptureRequestId=payload.requestId;
  if(sisalCaptureTimer)clearTimeout(sisalCaptureTimer);
  sisalCaptureTimer=setTimeout(()=>{if(sisalCaptureRequestId===payload.requestId){sisalCaptureRequestId=null;notify("Nessuna quota ricevuta da Sisal. Controlla lo userscript e attendi che i mercati siano caricati.","error");}},18000);
  const url="https://www.sisal.it/scommesse-matchpoint/sport/calcio#qlsync="+encodeURIComponent(JSON.stringify(payload));
  const popup=window.open(url,"quotalab-sisal-odds");
  if(!popup){if(sisalCaptureTimer)clearTimeout(sisalCaptureTimer);sisalCaptureRequestId=null;notify("Il browser ha bloccato la finestra Sisal. Consenti i popup per questo sito e riprova.","error");}
  else notify("Sisal aperto. Lo script installato raccoglierà le quote disponibili e le riporterà qui.","info");
}
function build() {
  const category=$("build-category").value;
  const strategy=document.querySelector("[data-strategy].active")?.dataset.strategy||s.settings.strategy||"balanced";
  const competition=$("build-competition").value;
  const period=$("build-period").value;
  const count=Number($("build-count").value);
  const minEv=Number($("build-ev").value);
  const targetProbability=Number($("build-target").value)/100;
  if(!Number.isInteger(count)||count<1||count>10||!Number.isFinite(minEv)||minEv<0||minEv>2){notify("Controlla numero di selezioni ed EV minimo.","error");return;}
  const upcoming=s.fixtures.filter(item=>item.competition===competition&&item.date>=new Date().toISOString().slice(0,10)).sort((a,b)=>(a.date+(a.time||"")).localeCompare(b.date+(b.time||"")));
  let candidates=upcoming;
  let periodLabel="tutte le partite future";
  if(period==="next-round") {
    const first=upcoming[0];
    candidates=!first?[]:(first.gameweek?upcoming.filter(item=>String(item.gameweek)===String(first.gameweek)):upcoming.filter(item=>Math.abs(Date.parse(item.date+"T12:00:00")-Date.parse(first.date+"T12:00:00"))<=3*86400000));
    periodLabel="prossima giornata / turno";
  } else if(period!=="all") {
    const days=Number(period),end=Date.now()+days*86400000;
    candidates=upcoming.filter(item=>{const time=Date.parse(item.date+"T12:00:00");return Number.isFinite(time)&&time<=end;});
    periodLabel="prossimi "+days+" giorni";
  }
  const permitted=category==="auto"?null:categories.find(item=>item[0]===category)?.[0];
  const ranked=[];
  for(const item of candidates) {
    const analysis=analysisFor(item);
    if(!analysis.forecast.available)continue;
    let offers=analysis.offers.filter(offer=>!permitted||offer.category===permitted);
    if(strategy==="value")offers=offers.filter(offer=>Number(offer.odds)>1&&Number.isFinite(offer.expectedValue)&&offer.expectedValue>=minEv&&(offer.fairMarketProbability===null||offer.edge>0));
    if(strategy==="double")offers=offers.filter(offer=>Number(offer.odds)>1&&Number.isFinite(offer.expectedValue));
    offers.sort((a,b)=>{
      if(strategy==="accuracy")return b.probability-a.probability;
      if(strategy==="value")return b.expectedValue-a.expectedValue;
      if(strategy==="double")return b.probability-a.probability;
      const score=offer=>offer.probability+(Number.isFinite(offer.expectedValue)?Math.max(-.5,Math.min(.5,offer.expectedValue))*.18:0);
      return score(b)-score(a);
    });
    if(offers.length)ranked.push({fixture:item,offer:offers[0]});
  }
  ranked.sort((a,b)=>{
    if(strategy==="value")return b.offer.expectedValue-a.offer.expectedValue;
    const score=item=>item.offer.probability+(strategy==="balanced"&&Number.isFinite(item.offer.expectedValue)?Math.max(-.5,Math.min(.5,item.offer.expectedValue))*.18:0);
    return score(b)-score(a);
  });
  let selections=[];
  if(strategy==="double") {
    let best=null;
    for(let i=0;i<ranked.length;i++)for(let j=i+1;j<ranked.length;j++){
      const odds=ranked[i].offer.odds*ranked[j].offer.odds;
      const probability=ranked[i].offer.probability*ranked[j].offer.probability;
      const score=Math.abs(odds-2)+Math.max(0,minEv-(ranked[i].offer.expectedValue+ranked[j].offer.expectedValue)/2);
      if(!best||score<best.score)best={score,items:[ranked[i],ranked[j]],odds,probability};
    }
    if(best)selections=best.items;
  } else {
    let joint=1;
    for(const item of ranked) {
      if(selections.length>=count)break;
      if(selections.some(existing=>existing.fixture.id===item.fixture.id))continue;
      if(selections.length&&joint*item.offer.probability<targetProbability)continue;
      selections.push(item);joint*=item.offer.probability;
    }
  }
  const probability=selections.length?selections.reduce((value,item)=>value*item.offer.probability,1):null;
  const hasOdds=selections.length&&selections.every(item=>Number(item.offer.odds)>1);
  const combinedOdds=hasOdds?selections.reduce((value,item)=>value*item.offer.odds,1):null;
  const expectedValue=hasOdds&&probability!==null?probability*combinedOdds-1:null;
  const targetReached=probability!==null&&probability+1e-12>=targetProbability;
  let message="";
  if(!candidates.length)message="Nessuna partita futura nel periodo selezionato.";
  else if(strategy==="value"&&!selections.length)message="Non sono disponibili quote correnti verificabili per questa competizione. Le quote storiche non vengono riutilizzate come se fossero attuali.";
  else if(strategy==="double"&&!selections.length)message="Per costruire una doppia intorno a quota 2,00 servono almeno due selezioni con quote reali.";
  else if(!ranked.length)message="Nessuna partita supera i requisiti minimi di storico e copertura.";
  s.settings={...s.settings,category,strategy,competition,period,maxLegs:count,minEv,targetProbability};
  s.result={selections,probability,combinedOdds,expectedValue,targetReached,strategy,periodLabel,message,assumption:hasOdds?"Probabilità congiunta stimata come prodotto delle probabilità delle singole partite; indipendenza non verificata.": "Le percentuali sono stime del modello. Senza quote correnti non è possibile calcolare valore atteso o rendimento."};
  save();render();
}
function addBuilder() {
  if(!s.result?.selections?.length||!s.result.selections.every(item=>Number(item.offer.odds)>1)){notify("Servono quote correnti verificate prima di salvare una schedina.","error");return;}
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
    s.history=data.history;s.fixtures=data.fixtures;s.tickets=data.tickets;s.backtest=null;s.slip=Array.isArray(data.slip)?data.slip:[];s.stake=Number(data.stake)>0?Number(data.stake):5;s.editing=typeof data.editing==="string"&&s.tickets.some(ticket=>ticket.id===data.editing&&ticket.status==="open")?data.editing:null;s.settings={...s.settings,...(data.settings||{})};s.sourceMeta=data.sourceMeta||{};save();render();notify("Backup ripristinato.","success");
  };reader.onerror=()=>notify("Lettura backup non riuscita.","error");reader.readAsText(file);
}
function clearData() {
  if(!confirm("Cancellare tutti i risultati, le partite e le schedine locali?"))return;
  s.history=[];s.fixtures=[];s.tickets=[];s.backtest=null;s.slip=[];s.editing=null;s.result=null;s.fixtureId=null;save();render();notify("Workspace azzerato.","success");
}
document.addEventListener("click",event=>{
  const strategyButton=event.target.closest("[data-strategy]");
  if(strategyButton){s.settings.strategy=strategyButton.dataset.strategy;save();render();return;}
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
  else if(act==="sync-open-matchday")syncOpenMatchday();
  else if(act==="sync-all")syncAllSources({force:true});
  else if(act==="sync-sisal")openSisalOddsCapture();
  else if(act==="import-csv")$("history-file").click();
  else if(act==="restore")$("backup-file").click();
  else if(act==="export"){download("quotalab-backup.json",JSON.stringify({app:"QuotaLab",version:1,exportedAt:new Date().toISOString(),history:s.history,fixtures:s.fixtures,tickets:s.tickets,slip:s.slip,stake:s.stake,editing:s.editing,settings:s.settings,sourceMeta:s.sourceMeta},null,2),"application/json");}
  else if(act==="export-csv"){const rows=[["date","competition","home","away","home_goals","away_goals"],...s.history.map(x=>[x.date,x.competition,x.home,x.away,x.homeGoals,x.awayGoals])];download("quotalab-history.csv",rows.map(row=>row.map(x=>'"'+String(x??"").replace(/"/g,'""')+'"').join(",")).join("\r\n"),"text/csv;charset=utf-8");}
  else if(act==="clear")clearData();
});
document.addEventListener("submit",event=>{if(event.target.id==="fixture-form"){event.preventDefault();addFixture(event.target);}});
document.addEventListener("input",event=>{if(event.target.id==="build-target"){const label=$("target-label");if(label)label.textContent=percent(Number(event.target.value)/100);}});
document.addEventListener("change",event=>{
  const t=event.target;
  if(t.matches("[data-odds]"))saveOdds(t.dataset.fixture,t.dataset.odds,t.value);
  else if(t.id==="history-file"){importCsv(t.files?.[0]);t.value="";}
  else if(t.id==="backup-file"){importBackup(t.files?.[0]);t.value="";}
  else if(t.id==="stake"){const n=Number(t.value);if(n>0&&n<=1000000){s.stake=n;save();renderDrawer();}else notify("Puntata non valida.","error");}
  else if(t.matches("[data-slip-odds]")){const i=Number(t.dataset.slipOdds),n=Number(t.value);if(s.slip[i]&&n>1&&n<=1000){s.slip[i].odds=n;save();render();}else notify("Quota non valida.","error");}
});

window.addEventListener("message",event=>{
  if(!["https://www.sisal.it","https://scommesse.sisal.it"].includes(event.origin))return;
  const data=event.data;
  if(!data||data.type!=="QUOTALAB_SISAL_ODDS"||!Array.isArray(data.items))return;
  if(sisalCaptureRequestId&&data.requestId!==sisalCaptureRequestId)return;
  if(sisalCaptureTimer)clearTimeout(sisalCaptureTimer);
  sisalCaptureTimer=null;sisalCaptureRequestId=null;
  const map={home:"1x2_home",draw:"1x2_draw",away:"1x2_away",dc1X:"dc_1x",dcX2:"dc_x2",dc12:"dc_12",over15:"ou_over15",under15:"ou_under15",over25:"ou_over25",under25:"ou_under25",over35:"ou_over35",under35:"ou_under35",bttsYes:"btts_yes",bttsNo:"btts_no"};
  let updatedMatches=0,updatedMarkets=0;
  for(const row of data.items){
    const target=s.fixtures.find(item=>item.competition===row.competition&&normalizeName(item.home)===normalizeName(row.home)&&normalizeName(item.away)===normalizeName(row.away)&&item.date===row.date);
    if(!target)continue;
    target.odds=target.odds||{};target.oddsSource="Sisal";
    for(const [rawKey,rawOdds] of Object.entries(row.markets||{})){
      let key=map[rawKey];
      if(!key&&rawKey.startsWith("combo:")){
        const parts=rawKey.split(":");
        if(parts.length===3)key="combo_"+parts[1]+"_"+parts[2];
      }
      const odds=Number(rawOdds);
      if(key&&Number.isFinite(odds)&&odds>1&&odds<1000){target.odds[key]=odds;updatedMarkets++;}
    }
    if(Object.keys(row.markets||{}).length)updatedMatches++;
  }
  if(updatedMatches){
    s.sourceMeta.sisal={name:"Sisal (userscript)",updatedAt:new Date().toISOString(),matches:updatedMatches,markets:updatedMarkets};
    save();if(s.view==="builder")build();else render();notify("Quote Sisal acquisite: "+updatedMarkets+" mercati su "+updatedMatches+" partite.","success");
  } else notify("Lo script Sisal non ha trovato quote associabili alle partite. Verifica che sia installato e che i mercati siano caricati.","info");
});

load();render();maybeAutoSync();
window.addEventListener("focus",maybeAutoSync);
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
