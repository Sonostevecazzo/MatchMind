import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../site-core.js", import.meta.url), "utf8");
const eloSource = await readFile(new URL("../elo.js", import.meta.url), "utf8");
const window = {};
const document = { addEventListener() {}, getElementById() { return null; }, body: { dataset: {} } };
vm.runInNewContext(source, { window, document, localStorage: { getItem() { return null; }, setItem() {} }, Date, Math, Number, String, Object, Array, Map, Set, Intl, URLSearchParams, console });
vm.runInNewContext(eloSource, { window, Math, Number, String, Map, Set, Array, Object, Error });

test("walk-forward backtest uses only earlier matches and returns valid 1X2 metrics", () => {
  const rows = [];
  for (let i = 0; i < 45; i++) {
    const score = i % 3 === 0 ? [1, 0] : i % 3 === 1 ? [0, 1] : [1, 1];
    rows.push({
      date: new Date(Date.UTC(2022, 0, 1 + i)).toISOString().slice(0, 10),
      home: "Alpha FC",
      away: "Beta FC",
      hg: score[0],
      ag: score[1]
    });
  }
  const result = window.MM.backtest(rows);
  assert.ok(result.count > 0);
  assert.ok(result.from < result.to);
  for (const metric of ["accuracy", "logLoss", "brier"]) {
    assert.ok(Number.isFinite(result.model[metric]));
    assert.ok(Number.isFinite(result.baseline[metric]));
  }
  assert.ok(result.model.logLoss >= 0);
  assert.ok(result.model.brier >= 0);
  assert.ok(result.model.accuracy > 0.2, "1X2 accuracy must only rank home/draw/away, not goal markets");
  assert.deepEqual(Object.keys(result.byClass).sort(), ["away", "draw", "home"]);
  assert.ok(result.model.accuracyCI[0] <= result.model.accuracy);
  assert.ok(result.model.accuracyCI[1] >= result.model.accuracy);
  assert.ok(Object.keys(result.bySeason).length > 0);
});

test("walk-forward backtest refuses an insufficient historical sample", () => {
  const rows = Array.from({ length: 20 }, (_, i) => ({
    date: new Date(Date.UTC(2023, 0, 1 + i)).toISOString().slice(0, 10),
    home: "Alpha FC",
    away: "Beta FC",
    hg: i % 2,
    ag: (i + 1) % 2
  }));
  assert.equal(window.MM.backtest(rows).count, 0);
});

test("walk-forward excludes every fixture played on the target date", () => {
  const rows = Array.from({ length: 40 }, (_, i) => ({
    date: "2024-01-01",
    home: "Alpha FC",
    away: "Beta FC",
    hg: i % 2,
    ag: (i + 1) % 2
  }));
  assert.equal(window.MM.backtest(rows).count, 0);
});

test("forecast exposes a coherent 0-5 correct-score matrix and explicit tail mass", () => {
  const rows = Array.from({ length: 24 }, (_, i) => ({
    date: new Date(Date.UTC(2023, 0, 1 + i)).toISOString().slice(0, 10),
    home: i % 2 ? "Beta FC" : "Alpha FC",
    away: i % 2 ? "Alpha FC" : "Beta FC",
    hg: i % 4 === 0 ? 2 : 1,
    ag: i % 3 === 0 ? 1 : 0
  }));
  const result = window.MM.forecast({
    date: "2023-02-10",
    home: "Alpha FC",
    away: "Beta FC"
  }, rows);
  assert.equal(result.scoreMatrix.length, 36);
  assert.ok(result.scoreMatrix.every(cell => cell.probability >= 0 && cell.probability <= 1));
  const matrixMass = result.scoreMatrix.reduce((sum, cell) => sum + cell.probability, 0);
  assert.ok(Math.abs(matrixMass + result.scoreMatrixTail - 1) < 1e-10);
  const p = result.probabilities;
  assert.ok(Math.abs(p.home + p.draw + p.away - 1) < 1e-10);
  assert.ok(result.scoreMatrix.some(cell => cell.homeGoals === 0 && cell.awayGoals === 0));
});

test("free Serie A event forecast uses only prior data and enforces minimum samples", () => {
  const rows = [];
  for (let i = 0; i < 8; i++) {
    const date = new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10);
    rows.push({ date, home: "Alpha FC", away: "Beta FC", hg: 1, ag: 0,
      hc: 5, ac: 4, hy: 2, ay: 1, ht: 1, at: 0 });
    rows.push({ date, home: "Beta FC", away: "Alpha FC", hg: 0, ag: 1,
      hc: 3, ac: 6, hy: 1, ay: 2, ht: 0, at: 1 });
  }
  const target = { date: "2025-02-01", home: "Alpha FC", away: "Beta FC" };
  const forecast = window.MM.eventForecast(target, rows);
  assert.equal(forecast.corners.available, true);
  assert.equal(forecast.yellowCards.available, true);
  assert.equal(forecast.halfTime.available, true);
  assert.ok(forecast.corners.total > 0);
  assert.ok(forecast.halfTime.probabilities.home + forecast.halfTime.probabilities.draw + forecast.halfTime.probabilities.away > 0.999);
  const futureOnly = window.MM.eventForecast(target, rows.map(row => ({ ...row, date: "2025-03-01" })));
  assert.equal(futureOnly.corners.available, false);
});

test("forecast exposes venue form, standings and manual availability adjustments", () => {
  const rows=[];
  for(let i=0;i<24;i++){
    const date=new Date(Date.UTC(2025,0,1+i)).toISOString().slice(0,10);
    rows.push({date,home:i%2?"Beta FC":"Alpha FC",away:i%2?"Alpha FC":"Beta FC",hg:i%3?2:0,ag:i%3?0:1,competition:"serie-a"});
  }
  const match={date:"2025-02-01",home:"Alpha FC",away:"Beta FC",competition:"serie-a"};
  const base=window.MM.forecast(match,rows);
  const adjusted=window.MM.forecast(match,rows,{attackingAbsencesHome:2,defensiveAbsencesAway:1,motivationHome:1});
  assert.ok(base.home.played>=10);
  assert.ok(Array.isArray(base.home.form));
  assert.equal(base.standings.available,true);
  assert.ok(["alta","media","limitata","molto bassa"].includes(base.confidence));
  assert.ok(adjusted.homeXg<base.homeXg);
  assert.ok(adjusted.homeVenue.played>0);

  const heavyAbsHome = window.MM.forecast(match, rows, { attackingAbsencesHome: 2, defensiveAbsencesHome: 1 });
  assert.ok(heavyAbsHome.homeXg < base.homeXg, "heavy absences must reduce home xG");
  assert.ok(heavyAbsHome.probabilities.home < base.probabilities.home, "heavy absences must reduce home 1X2 probability");

  const motHome = window.MM.forecast(match, rows, { motivationHome: 1 });
  assert.ok(motHome.homeXg > base.homeXg, "positive motivation must increase home xG");
  assert.ok(motHome.probabilities.home > base.probabilities.home, "positive motivation must increase home 1X2 probability");

  const neutral = window.MM.forecast(match, rows, { attackingAbsencesHome: 0, defensiveAbsencesHome: 0, motivationHome: 0 });
  assert.equal(neutral.homeXg, base.homeXg, "neutral options must keep home xG identical");
  assert.equal(neutral.probabilities.home, base.probabilities.home, "neutral options must keep 1X2 identical");
});


test("historical baseline backtest ignores a previously activated local AI calibration", () => {
  const rows = [];
  for (let i = 0; i < 90; i++) {
    const score = i % 3 === 0 ? [2, 0] : i % 3 === 1 ? [0, 1] : [1, 1];
    rows.push({
      date: new Date(Date.UTC(2021, 0, 1 + i)).toISOString().slice(0, 10),
      home: i % 2 ? "Beta FC" : "Alpha FC",
      away: i % 2 ? "Alpha FC" : "Beta FC",
      hg: score[0],
      ag: score[1],
      competition: "serie-a"
    });
  }
  const withoutAI = window.MM.backtest(rows);
  window.MatchMindAI = {
    modelFor: () => ({ approved: true, temperature: 2.5 }),
    applyTemperature: () => ({ home: 0.98, draw: 0.01, away: 0.01 })
  };
  const withAIStored = window.MM.backtest(rows);
  assert.equal(withAIStored.count, withoutAI.count);
  assert.equal(withAIStored.model.logLoss, withoutAI.model.logLoss);
  assert.equal(withAIStored.model.brier, withoutAI.model.brier);
});

test("production forecast uses Elo for 1X2 and Poisson for goal markets when history is adequate",()=>{
 const rows=[];
 for(let i=0;i<45;i++){
  rows.push({date:new Date(Date.UTC(2024,0,1+i)).toISOString().slice(0,10),home:i%2?'Beta FC':'Alpha FC',away:i%2?'Alpha FC':'Beta FC',hg:i%3?2:0,ag:i%3?0:1,competition:'serie-a'});
 }
 const f=window.MM.forecast({date:'2024-03-01',home:'Alpha FC',away:'Beta FC',competition:'serie-a'},rows);
 assert.equal(f.predictionMethod,'elo-1x2-poisson-goals');
 assert.ok(f.eloProbabilities);
 assert.ok(Math.abs(f.probabilities.home+f.probabilities.draw+f.probabilities.away-1)<1e-10);
 assert.equal(f.probabilities.btts,f.poissonProbabilities.btts);
 assert.equal(f.probabilities.o25,f.poissonProbabilities.o25);
 const baseline=window.MM.forecast({date:'2024-03-01',home:'Alpha FC',away:'Beta FC',competition:'serie-a'},rows,{__forcePoisson:true});
 assert.equal(baseline.predictionMethod,'poisson');
 assert.equal(baseline.eloProbabilities,null);
});
