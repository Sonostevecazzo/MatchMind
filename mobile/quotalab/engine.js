const DAY_MS = 86400000;
const HALF_LIFE_DAYS = 540;
const PRIOR_MATCHES = 5;
const MAX_GOALS = 12;

export function normalizeName(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function normalizeDate(value) {
  const raw = String(value ?? "").trim();
  let match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const candidate = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    if (candidate.getUTCFullYear() === Number(match[1]) && candidate.getUTCMonth() === Number(match[2]) - 1 && candidate.getUTCDate() === Number(match[3])) return raw.slice(0, 10);
    return null;
  }
  match = raw.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
  if (match) {
    const day = Number(match[1]), month = Number(match[2]), year = Number(match[3]);
    const candidate = new Date(Date.UTC(year, month - 1, day));
    if (candidate.getUTCFullYear() === year && candidate.getUTCMonth() === month - 1 && candidate.getUTCDate() === day) {
      return String(year).padStart(4, "0") + "-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0");
    }
  }
  return null;
}

export function parseCSV(text) {
  if (typeof text !== "string" || !text.trim()) return [];
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field.length === 0) quoted = true;
    else if (char === "," || char === ";") { row.push(field.trim()); field = ""; }
    else if (char === "\n") {
      row.push(field.replace(/\r$/, "").trim());
      if (row.some(cell => cell !== "")) rows.push(row);
      row = []; field = "";
    } else field += char;
  }
  if (field.length || row.length) {
    row.push(field.replace(/\r$/, "").trim());
    if (row.some(cell => cell !== "")) rows.push(row);
  }
  if (rows.length < 2) return [];
  const headers = rows.shift().map(value => value.replace(/^\uFEFF/, "").trim().toLowerCase());
  return rows.map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

const ALIASES = {
  date: ["date", "data", "match_date", "kickoff"],
  home: ["home", "hometeam", "home_team", "squadra_casa", "team_home"],
  away: ["away", "awayteam", "away_team", "squadra_trasferta", "team_away"],
  homeGoals: ["home_goals", "fthg", "hg", "ft_home", "gol_casa", "goals_home"],
  awayGoals: ["away_goals", "ftag", "ag", "ft_away", "gol_trasferta", "goals_away"],
  competition: ["competition", "league", "division", "campionato", "competizione"]
};
function valueFor(row, aliases) { for (const key of aliases) if (row[key] !== undefined && String(row[key]).trim() !== "") return row[key]; return ""; }
function numericScore(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const number = Number(String(value).replace(",", "."));
  return Number.isInteger(number) && number >= 0 && number <= 20 ? number : null;
}

function normalizeCompetition(value, fallback) {
  const raw = String(value || fallback || "serie-a").trim().toLowerCase();
  const compact = raw.replace(/[^a-z0-9]/g, "");
  const known = { i1:"serie-a", seriea:"serie-a", italyseriea:"serie-a", uefachampionsleague:"champions-league", uefaeuropaleague:"europa-league", i2:"serie-b", serieb:"serie-b", e0:"premier-league", premierleague:"premier-league", d1:"bundesliga", bundesliga:"bundesliga", sp1:"la-liga", laliga:"la-liga", f1:"ligue-1", ligue1:"ligue-1", championsleague:"champions-league", europaleague:"europa-league" };
  return known[compact] || raw.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function validateHistory(rows, defaultCompetition = "serie-a") {
  const accepted = [], rejected = [], seen = new Map();
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index] || {};
    const date = normalizeDate(valueFor(row, ALIASES.date));
    const home = String(valueFor(row, ALIASES.home)).trim();
    const away = String(valueFor(row, ALIASES.away)).trim();
    const homeGoals = numericScore(valueFor(row, ALIASES.homeGoals));
    const awayGoals = numericScore(valueFor(row, ALIASES.awayGoals));
    const competition = normalizeCompetition(valueFor(row, ALIASES.competition), defaultCompetition);
    const reason = !date ? "data non valida" : (!home || !away) ? "nome squadra mancante" :
      (normalizeName(home) === normalizeName(away)) ? "squadre identiche" :
      (homeGoals === null || awayGoals === null) ? "risultato finale non valido" : (!competition) ? "competizione mancante" : null;
    if (reason) { rejected.push({ row: index + 2, reason }); continue; }
    const match = { date, competition, home, away, homeGoals, awayGoals };
    const key = [date, competition, normalizeName(home), normalizeName(away)].join("|");
    if (seen.has(key)) {
      const prior = seen.get(key);
      if (prior.homeGoals !== homeGoals || prior.awayGoals !== awayGoals) rejected.push({ row: index + 2, reason: "duplicato con risultato discordante" });
      continue;
    }
    seen.set(key, match); accepted.push(match);
  }
  accepted.sort((a, b) => a.date.localeCompare(b.date));
  return { matches: accepted, rejected };
}

function finiteNumber(value, label, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw new RangeError(label + " fuori intervallo");
  return number;
}
function poisson(lambda, goals) {
  if (lambda === 0) return goals === 0 ? 1 : 0;
  let logFactorial = 0;
  for (let n = 2; n <= goals; n += 1) logFactorial += Math.log(n);
  return Math.exp(-lambda + goals * Math.log(lambda) - logFactorial);
}
export function scoreMatrix(homeXg, awayXg, maxGoals = MAX_GOALS) {
  const h = finiteNumber(homeXg, "xG casa", 0, 8);
  const a = finiteNumber(awayXg, "xG trasferta", 0, 8);
  if (!Number.isInteger(maxGoals) || maxGoals < 8 || maxGoals > 20) throw new RangeError("maxGoals non valido");
  const matrix = []; let total = 0;
  for (let hg = 0; hg <= maxGoals; hg += 1) {
    const row = [];
    for (let ag = 0; ag <= maxGoals; ag += 1) { const value = poisson(h, hg) * poisson(a, ag); row.push(value); total += value; }
    matrix.push(row);
  }
  return { matrix: matrix.map(row => row.map(value => value / total)), omittedTailMass: Math.max(0, 1 - total) };
}
function timeWeight(matchDate, targetDate) {
  const age = Math.max(0, (Date.parse(targetDate + "T00:00:00Z") - Date.parse(matchDate + "T00:00:00Z")) / DAY_MS);
  return Math.pow(0.5, age / HALF_LIFE_DAYS);
}
function weightedMean(matches, getter, priorMean, targetDate) {
  let weightedSum = 0, weightSum = 0;
  for (const match of matches) { const weight = timeWeight(match.date, targetDate); weightedSum += getter(match) * weight; weightSum += weight; }
  return { value: (weightedSum + priorMean * PRIOR_MATCHES) / (weightSum + PRIOR_MATCHES), weight: weightSum };
}
function teamMatches(history, team) {
  const key = normalizeName(team);
  return history.filter(match => normalizeName(match.home) === key || normalizeName(match.away) === key);
}

export function forecastFixture(fixture, allHistory) {
  const date = normalizeDate(fixture?.date), home = String(fixture?.home ?? "").trim(), away = String(fixture?.away ?? "").trim();
  const competition = String(fixture?.competition || "serie-a").toLowerCase();
  if (!date || !home || !away || normalizeName(home) === normalizeName(away)) return { available: false, reason: "Completa data e squadre diverse per avviare l'analisi.", coverage: null };
  const history = (allHistory || []).filter(match => match.competition === competition && match.date < date && Number.isInteger(match.homeGoals) && Number.isInteger(match.awayGoals));
  const homeAll = teamMatches(history, home), awayAll = teamMatches(history, away);
  const homeVenue = history.filter(match => normalizeName(match.home) === normalizeName(home));
  const awayVenue = history.filter(match => normalizeName(match.away) === normalizeName(away));
  const coverage = { leagueMatches: history.length, homeTeamMatches: homeAll.length, awayTeamMatches: awayAll.length, homeVenueMatches: homeVenue.length, awayVenueMatches: awayVenue.length, cutoff: date };
  if (history.length < 20 || homeAll.length < 5 || awayAll.length < 5 || homeVenue.length < 3 || awayVenue.length < 3) {
    return { available: false, reason: "Campione insufficiente: servono almeno 20 partite della competizione, 5 presenze per squadra e 3 partite nel rispettivo contesto casa/trasferta.", coverage };
  }
  const weights = history.map(match => timeWeight(match.date, date));
  const weightSum = weights.reduce((sum, value) => sum + value, 0);
  const safeHomeMean = Math.max(0.25, history.reduce((sum, match, index) => sum + match.homeGoals * weights[index], 0) / weightSum);
  const safeAwayMean = Math.max(0.25, history.reduce((sum, match, index) => sum + match.awayGoals * weights[index], 0) / weightSum);
  const homeScored = weightedMean(homeVenue, match => match.homeGoals, safeHomeMean, date);
  const homeConceded = weightedMean(homeVenue, match => match.awayGoals, safeAwayMean, date);
  const awayScored = weightedMean(awayVenue, match => match.awayGoals, safeAwayMean, date);
  const awayConceded = weightedMean(awayVenue, match => match.homeGoals, safeHomeMean, date);
  const homeXg = Math.min(5.5, Math.max(0.15, safeHomeMean * (homeScored.value / safeHomeMean) * (awayConceded.value / safeHomeMean)));
  const awayXg = Math.min(5.5, Math.max(0.15, safeAwayMean * (awayScored.value / safeAwayMean) * (homeConceded.value / safeAwayMean)));
  const { matrix, omittedTailMass } = scoreMatrix(homeXg, awayXg);
  const probabilities = deriveProbabilities(matrix);
  const minTeamSample = Math.min(homeAll.length, awayAll.length);
  return { available: true, method: "Poisson indipendente con medie casa/trasferta, smoothing e decadimento temporale", homeXg, awayXg, probabilities, matrix, omittedTailMass, confidence: minTeamSample >= 15 && history.length >= 80 ? "media" : "bassa", minTeamSample, historyCount: history.length, coverage, caveat: "Stima di base non calibrata: non equivale a un modello validato e non dimostra redditività." };
}
function deriveProbabilities(matrix) {
  const p = { home: 0, draw: 0, away: 0, bttsYes: 0, over15: 0, over25: 0, over35: 0 };
  for (let hg = 0; hg < matrix.length; hg += 1) for (let ag = 0; ag < matrix[hg].length; ag += 1) {
    const value = matrix[hg][ag];
    if (hg > ag) p.home += value; else if (hg === ag) p.draw += value; else p.away += value;
    if (hg > 0 && ag > 0) p.bttsYes += value;
    if (hg + ag >= 2) p.over15 += value;
    if (hg + ag >= 3) p.over25 += value;
    if (hg + ag >= 4) p.over35 += value;
  }
  return { ...p, bttsNo: 1-p.bttsYes, under15: 1-p.over15, under25: 1-p.over25, under35: 1-p.over35 };
}
function probabilityWhere(matrix, predicate) {
  let probability = 0;
  for (let home = 0; home < matrix.length; home += 1) for (let away = 0; away < matrix[home].length; away += 1) if (predicate(home, away)) probability += matrix[home][away];
  return probability;
}
function market(key, label, category, group, probability) { return { key, label, category, group, probability, fairOdds: probability > 0 ? 1 / probability : null }; }

export function buildMarketOffers(forecast) {
  if (!forecast?.available) return [];
  const m = forecast.matrix;
  const offers = [
    market("1x2_home","1 · Vittoria casa","1x2","1x2",forecast.probabilities.home),
    market("1x2_draw","X · Pareggio","1x2","1x2",forecast.probabilities.draw),
    market("1x2_away","2 · Vittoria trasferta","1x2","1x2",forecast.probabilities.away),
    market("dc_1x","1X · Casa o pareggio","double","double",forecast.probabilities.home+forecast.probabilities.draw),
    market("dc_12","12 · Esito diverso","double","double",forecast.probabilities.home+forecast.probabilities.away),
    market("dc_x2","X2 · Pareggio o trasferta","double","double",forecast.probabilities.draw+forecast.probabilities.away),
    market("btts_yes","Gol · Entrambe segnano","btts","btts",forecast.probabilities.bttsYes),
    market("btts_no","No Gol · Almeno una a zero","btts","btts",forecast.probabilities.bttsNo)
  ];
  for (const line of [1.5,2.5,3.5]) {
    const id = String(line).replace(".","");
    const over = forecast.probabilities["over"+id];
    offers.push(market("ou_over"+id,"Over "+line.toFixed(1).replace(".",","),"goals","ou"+id,over));
    offers.push(market("ou_under"+id,"Under "+line.toFixed(1).replace(".",","),"goals","ou"+id,1-over));
  }
  const results = [
    {key:"home",label:"1",test:(hg,ag)=>hg>ag},
    {key:"draw",label:"X",test:(hg,ag)=>hg===ag},
    {key:"away",label:"2",test:(hg,ag)=>hg<ag}
  ];
  const totals = [
    {key:"over25",label:"Over 2,5",test:(hg,ag)=>hg+ag>=3},
    {key:"under25",label:"Under 2,5",test:(hg,ag)=>hg+ag<=2}
  ];
  for (const result of results) for (const total of totals) {
    const key = "combo_"+result.key+"_"+total.key;
    offers.push(market(key,result.label+" + "+total.label,"combo-goals","combo-"+key,probabilityWhere(m,(hg,ag)=>result.test(hg,ag)&&total.test(hg,ag))));
  }
  const btts = [
    {key:"yes",label:"Gol",test:(hg,ag)=>hg>0&&ag>0},
    {key:"no",label:"No Gol",test:(hg,ag)=>hg===0||ag===0}
  ];
  for (const result of results) for (const outcome of btts) {
    const key = "combo_"+result.key+"_btts_"+outcome.key;
    offers.push(market(key,result.label+" + "+outcome.label,"combo-btts","combo-"+key,probabilityWhere(m,(hg,ag)=>result.test(hg,ag)&&outcome.test(hg,ag))));
  }
  return offers.filter(item=>Number.isFinite(item.probability)&&item.probability>=0&&item.probability<=1);
}
const GROUPS = {
  "1x2":["1x2_home","1x2_draw","1x2_away"], double:["dc_1x","dc_12","dc_x2"],
  btts:["btts_yes","btts_no"], ou15:["ou_over15","ou_under15"], ou25:["ou_over25","ou_under25"], ou35:["ou_over35","ou_under35"]
};
export function priceOffers(offers, odds = {}) {
  return offers.map(offer => {
    const quote = Number(odds[offer.key]), validQuote = Number.isFinite(quote)&&quote>1&&quote<=1000;
    const implied = validQuote ? 1/quote : null;
    const siblingKeys = GROUPS[offer.group] || [];
    const siblingPrices = siblingKeys.map(key=>Number(odds[key]));
    const completeGroup = siblingKeys.length>1&&siblingPrices.every(value=>Number.isFinite(value)&&value>1&&value<=1000);
    const raw = completeGroup?siblingPrices.map(value=>1/value):[];
    const total = raw.reduce((sum,value)=>sum+value,0);
    const fairMarketProbability = completeGroup?raw[siblingKeys.indexOf(offer.key)]/total:null;
    const overround = completeGroup?total-1:null;
    const ev = validQuote?offer.probability*quote-1:null;
    const edge = fairMarketProbability===null?(implied===null?null:offer.probability-implied):offer.probability-fairMarketProbability;
    return {...offer,odds:validQuote?quote:null,impliedProbability:implied,fairMarketProbability,overround,edge,expectedValue:ev,hasCompleteMarket:completeGroup};
  });
}
export function buildSuggestions(analyses, options = {}) {
  const category = options.category || "auto";
  const minEv = finiteNumber(options.minEv ?? 0.03,"EV minimo",-1,10);
  const maxLegs = Math.round(finiteNumber(options.maxLegs ?? 3,"Numero selezioni",1,10));
  const categoryMap = {"1x2":["1x2"],double:["double"],goals:["goals"],btts:["btts"],"combo-goals":["combo-goals"],"combo-btts":["combo-btts"]};
  const permitted = category==="auto"?null:categoryMap[category];
  if (category!=="auto"&&!permitted) throw new RangeError("Categoria mercato sconosciuta");
  const candidates=[];
  for (const analysis of analyses||[]) {
    if (!analysis?.fixture||!analysis?.forecast?.available) continue;
    const ranked=(analysis.offers||[]).filter(item=>item.odds!==null&&item.expectedValue!==null&&item.expectedValue>=minEv&&(!permitted||permitted.includes(item.category))&&(item.fairMarketProbability===null||item.edge>0)).sort((a,b)=>b.expectedValue-a.expectedValue);
    if (ranked.length) candidates.push({fixture:analysis.fixture,offer:ranked[0],forecast:analysis.forecast});
  }
  candidates.sort((a,b)=>b.offer.expectedValue-a.offer.expectedValue);
  const selections=candidates.slice(0,maxLegs);
  const probability=selections.reduce((product,item)=>product*item.offer.probability,1);
  const odds=selections.reduce((product,item)=>product*item.offer.odds,1);
  return {selections,probability:selections.length?probability:null,combinedOdds:selections.length?odds:null,expectedValue:selections.length?probability*odds-1:null,assumption:"Probabilità congiunta stimata come prodotto delle singole probabilità: presuppone indipendenza tra eventi e non è verificata."};
}
export function calculateTicket(legs, stake) {
  const amount=finiteNumber(stake,"Puntata",0.01,1000000);
  if (!(legs||[]).length||!(legs||[]).every(leg=>Number.isFinite(Number(leg.odds))&&Number(leg.odds)>1&&Number.isFinite(Number(leg.probability))&&Number(leg.probability)>=0&&Number(leg.probability)<=1)) throw new RangeError("Schedina vuota o quote/probabilità non valide");
  const combinedOdds=legs.reduce((product,leg)=>product*Number(leg.odds),1);
  const jointProbability=legs.reduce((product,leg)=>product*Number(leg.probability),1);
  return {stake:amount,combinedOdds,jointProbability,grossReturn:amount*combinedOdds,netIfWon:amount*combinedOdds-amount,theoreticalExpectedValue:amount*(jointProbability*combinedOdds-1)};
}
