import test from "node:test";
import assert from "node:assert/strict";
import { normalizeDate, parseCSV, validateHistory, forecastFixture, buildMarketOffers, priceOffers, buildSuggestions, calculateTicket, scoreMatrix } from "../engine.js";

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
});

test("il costruttore rispetta il mercato selezionato senza riempire candidati mancanti", () => {
  const fixture = { id: "match-1", home: "Alpha", away: "Beta" };
  const offers = [
    { key: "1x2_home", category: "1x2", odds: 2.5, probability: .5, expectedValue: .25, fairMarketProbability: .4 },
    { key: "ou_over25", category: "goals", odds: 1.8, probability: .6, expectedValue: .08, fairMarketProbability: .55 },
    { key: "btts_yes", category: "btts", odds: 1.9, probability: .55, expectedValue: .045, fairMarketProbability: .53 }
  ];
  const result = buildSuggestions([{ fixture, forecast: { available: true }, offers }], { category: "goals", minEv: .03, maxLegs: 2 });
  assert.equal(result.selections.length, 1);
  assert.equal(result.selections[0].offer.category, "goals");
  assert.equal(buildSuggestions([{ fixture, forecast: { available: true }, offers: [] }], { category: "auto" }).selections.length, 0);
});

test("rifiuta categorie di mercato sconosciute", () => assert.throws(() => buildSuggestions([], { category: "unknown" })));

test("calcola quota composta, ritorno e probabilità congiunta", () => {
  const result = calculateTicket([{ odds: 2.1, probability: .6 }, { odds: 1.8, probability: .7 }], 10);
  assert.ok(Math.abs(result.combinedOdds - 3.78) < 1e-12);
  assert.ok(Math.abs(result.grossReturn - 37.8) < 1e-12);
  assert.ok(Math.abs(result.jointProbability - .42) < 1e-12);
  assert.throws(() => calculateTicket([{ odds: 1, probability: .5 }], 10));
});
