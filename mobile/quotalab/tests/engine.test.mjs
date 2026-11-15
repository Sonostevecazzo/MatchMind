import test from "node:test";
import assert from "node:assert/strict";
import { normalizeDate, currentSeasonCode, parseCSV, validateHistory, forecastFixture, buildMarketOffers, priceOffers, buildSuggestions, calculateTicket, scoreMatrix, backtestHistory } from "../engine.js";

function historyFixture() {
  const rows = [];
  for (let i = 0; i < 12; i += 1) rows.push({
    date: new Date(Date.UTC(2025, 0, i + 1)).toISOString().slice(0, 10),
    competition: "serie-a", home: "Alpha", away: "Beta",
    homeGoals: i % 3 === 0 ? 2 : 1, awayGoals: i % 4 === 0 ? 2 : 0
  });
  for (let i = 0; i < 8; i += 1) rows.push({
    date: new Date(Date.UTC(2025, 0, i + 1)).toISOString().slice(0, 10),
    competition: "serie-a", home: "Gamma", away: "Delta", homeGoals: 1, awayGoals: 1
  });
  return rows;
}

test("normalizza date ISO e italiane senza accettare date impossibili", () => {
  assert.equal(normalizeDate("2025-02-28"), "2025-02-28");
  assert.equal(normalizeDate("28/02/2025"), "2025-02-28");
  assert.equal(normalizeDate("31/02/2025"), null);
});

test("calcola il codice stagione europeo rispettando il cambio a luglio", () => {
  assert.equal(currentSeasonCode("2026-11-14T12:00:00Z"), "2627");
  assert.equal(currentSeasonCode("2026-01-14T12:00:00Z"), "2526");
  assert.equal(currentSeasonCode("2026-06-30T12:00:00Z"), "2526");
  assert.equal(currentSeasonCode("2026-07-01T00:00:00Z"), "2627");
  assert.throws(() => currentSeasonCode("invalid-date"));
});

test("acquisisce statistiche opzionali senza inventare campi mancanti", () => {
  const csv = [
    "Date,Div,HomeTeam,AwayTeam,FTHG,FTAG,HS,AS,HST,AST,HC,AC,HY,AY",
    "2025-08-23,I1,Inter,Milan,2,1,15,8,6,3,7,2,2,1",
    "2025-08-24,I1,Roma,Lazio,1,1,,,,,,,,,,"
  ].join("\n");
  const { matches } = validateHistory(parseCSV(csv));
  assert.equal(matches.length, 2);
  assert.equal(matches[0].stats.homeShots, 15);
  assert.equal(matches[0].stats.homeCorners, 7);
  assert.equal(matches[1].stats.homeShots, null);
});

test("il parser CSV gestisce virgole quotate, separatore ; e virgolette doppie", () => {
  const parsed = parseCSV('Date,HomeTeam,AwayTeam,FTHG,FTAG\n2025-01-01,"Alpha, FC","Beta ""B""",2,1');
  assert.equal(parsed[0].hometeam, "Alpha, FC");
  const semicolon = parseCSV("date;home;away;home_goals;away_goals\n2025-01-01;Alpha;Beta;1;0");
  assert.equal(semicolon[0].home, "Alpha");
});

test("valida gli header football-data e rimuove i duplicati", () => {
  const rows = parseCSV("Date,Div,HomeTeam,AwayTeam,FTHG,FTAG\n01/01/2025,I1,Alpha,Beta,2,1\n01/01/2025,I1,Alpha,Beta,2,1\n31/02/2025,I1,A,B,1,0\n02/01/2025,I1,A,B,21,0");
  const result = validateHistory(rows);
  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0].competition, "serie-a");
  assert.equal(result.rejected.length, 2);
});

test("la previsione usa solo risultati precedenti e applica il gate di copertura", () => {
  const { matches } = validateHistory(historyFixture());
  const result = forecastFixture({ date: "2025-02-01", competition: "serie-a", home: "Alpha", away: "Beta" }, matches);
  assert.equal(result.available, true);
  assert.equal(result.coverage.leagueMatches, 20);
  const early = forecastFixture({ date: "2025-01-05", competition: "serie-a", home: "Alpha", away: "Beta" }, matches);
  assert.equal(early.available, false);
  assert.ok(early.coverage.leagueMatches < 20);
});

test("la matrice Poisson è finita e normalizzata; input fuori intervallo rifiutati", () => {
  const result = scoreMatrix(1.45, 1.1);
  const mass = result.matrix.flat().reduce((sum, value) => sum + value, 0);
  assert.ok(Math.abs(mass - 1) < 1e-12);
  assert.ok(result.omittedTailMass >= 0 && result.omittedTailMass < 1e-6);
  assert.throws(() => scoreMatrix(-1, 1));
  assert.throws(() => scoreMatrix(9, 1));
  const highExpectation = scoreMatrix(5.5, 5.5);
  assert.ok(highExpectation.omittedTailMass < 1e-6);
});

test("mercati coerenti e combinazioni calcolate con probabilità congiunte", () => {
  const { matches } = validateHistory(historyFixture());
  const forecast = forecastFixture({ date: "2025-02-01", competition: "serie-a", home: "Alpha", away: "Beta" }, matches);
  const offers = buildMarketOffers(forecast);
  const oneXtwo = offers.filter(item => ["1x2_home", "1x2_draw", "1x2_away"].includes(item.key));
  assert.ok(Math.abs(oneXtwo.reduce((sum, item) => sum + item.probability, 0) - 1) < 1e-10);
  const combo = offers.find(item => item.key === "combo_home_over25");
  const home = offers.find(item => item.key === "1x2_home");
  const over = offers.find(item => item.key === "ou_over25");
  assert.ok(combo.probability <= Math.min(home.probability, over.probability) + 1e-10);
});

test("il margine è normalizzato solo per mercati completi", () => {
  const offers = [
    { key: "1x2_home", category: "1x2", group: "1x2", probability: .5, label: "1" },
    { key: "1x2_draw", category: "1x2", group: "1x2", probability: .25, label: "X" },
    { key: "1x2_away", category: "1x2", group: "1x2", probability: .25, label: "2" }
  ];
  const priced = priceOffers(offers, { "1x2_home": 2.2, "1x2_draw": 3.4, "1x2_away": 3.5 });
  assert.ok(priced.every(item => item.hasCompleteMarket));
  assert.ok(priced[0].overround > 0);
  assert.ok(Number.isFinite(priced[0].fairMarketProbability));
  assert.ok(priced[0].expectedValue > 0);
  const incomplete = priceOffers(offers, { "1x2_home": 2.2 });
  assert.equal(incomplete[0].fairMarketProbability, null);
  assert.equal(incomplete[1].odds, null);
  const doubleChance = priceOffers([
    { key: "dc_1x", category: "double", group: "double", probability: .7, label: "1X" },
    { key: "dc_12", category: "double", group: "double", probability: .8, label: "12" },
    { key: "dc_x2", category: "double", group: "double", probability: .6, label: "X2" }
  ], { "dc_1x": 1.4, "dc_12": 1.3, "dc_x2": 1.6 });
  assert.ok(doubleChance.every(item => item.fairMarketProbability === null && item.overround === null));
});

test("il costruttore rispetta il mercato selezionato senza riempire candidati mancanti", () => {
  const fixture = { id: "match-1", home: "Alpha", away: "Beta" };
  const offers = [
    { key: "1x2_home", category: "1x2", odds: 2.5, probability: .5, expectedValue: .25, fairMarketProbability: .4, edge: .1 },
    { key: "ou_over25", category: "goals", odds: 1.8, probability: .6, expectedValue: .08, fairMarketProbability: .55, edge: .05 },
    { key: "btts_yes", category: "btts", odds: 1.9, probability: .55, expectedValue: .045, fairMarketProbability: .53, edge: .02 }
  ];
  const result = buildSuggestions([{ fixture, forecast: { available: true }, offers }], { category: "goals", minEv: .03, maxLegs: 2 });
  assert.equal(result.selections.length, 1);
  assert.equal(result.selections[0].offer.category, "goals");
  assert.equal(buildSuggestions([{ fixture, forecast: { available: true }, offers: [] }], { category: "auto" }).selections.length, 0);
});

test("rifiuta categorie di mercato sconosciute", () => assert.throws(() => buildSuggestions([], { category: "unknown" })));

test("il backtest walk-forward usa solo storico precedente e confronta una baseline", () => {
  const rows = [];
  for (let day = 1; day <= 40; day += 1) {
    const date = new Date(Date.UTC(2025, 0, day)).toISOString().slice(0, 10);
    rows.push({ date, competition: "serie-a", home: "Alpha", away: "Beta", homeGoals: day % 3 === 0 ? 2 : 1, awayGoals: day % 4 === 0 ? 1 : 0 });
    rows.push({ date, competition: "serie-a", home: "Gamma", away: "Delta", homeGoals: day % 5 === 0 ? 0 : 1, awayGoals: day % 2 === 0 ? 1 : 0 });
  }
  const { matches } = validateHistory(rows);
  const report = backtestHistory(matches, { competition: "serie-a" });
  assert.equal(report.availableMatches, 80);
  assert.equal(report.evaluatedMatches, 60);
  assert.equal(report.startDate, "2025-01-11");
  assert.equal(report.endDate, "2025-02-09");
  assert.ok(Number.isFinite(report.model.brier1x2));
  assert.ok(Number.isFinite(report.baseline.brier1x2));
  assert.ok(report.model.brier1x2 >= 0 && report.model.brier1x2 <= 2 / 3);
  assert.ok(Number.isFinite(report.improvement.brier1x2));
});

test("calcola quota composta, ritorno e probabilità congiunta", () => {
  const result = calculateTicket([{ odds: 2.1, probability: .6 }, { odds: 1.8, probability: .7 }], 10);
  assert.ok(Math.abs(result.combinedOdds - 3.78) < 1e-12);
  assert.ok(Math.abs(result.grossReturn - 37.8) < 1e-12);
  assert.ok(Math.abs(result.jointProbability - .42) < 1e-12);
  assert.throws(() => calculateTicket([{ odds: 1, probability: .5 }], 10));
});
