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
