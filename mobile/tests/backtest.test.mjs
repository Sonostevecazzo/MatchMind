import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../site-core.js", import.meta.url), "utf8");
const window = {};
const document = { addEventListener() {}, getElementById() { return null; }, body: { dataset: {} } };
vm.runInNewContext(source, { window, document, localStorage: { getItem() { return null; }, setItem() {} }, Date, Math, Number, String, Object, Array, Map, Set, Intl, URLSearchParams, console });

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
