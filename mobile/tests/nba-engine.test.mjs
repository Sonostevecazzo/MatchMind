import test from "node:test";
import assert from "node:assert/strict";
import { buildNbaModel, currentSeasonStart, normalizeNbaEvent, predictNba, seasonMonths } from "../nba-engine.mjs";

test("NBA season helper uses October-to-June season boundaries",()=>{
  assert.equal(currentSeasonStart(new Date("2026-11-10T12:00:00Z")),2026);
  assert.equal(currentSeasonStart(new Date("2026-04-10T12:00:00Z")),2025);
  assert.deepEqual(seasonMonths(2026),["202610","202611","202612","202701","202702","202703","202704","202705","202706"]);
});

test("normalizes ESPN event without inventing score for an unplayed game",()=>{
  const event={id:"123",date:"2026-11-11T00:00:00Z",season:{type:2},competitions:[{status:{type:{state:"pre",completed:false}},competitors:[
    {homeAway:"home",team:{displayName:"Boston Celtics",abbreviation:"BOS"},score:"0"},
    {homeAway:"away",team:{displayName:"New York Knicks",abbreviation:"NYK"},score:"0"}
  ]}]};
  const game=normalizeNbaEvent(event);
  assert.equal(game.status,"NS");
  assert.equal(game.hp,null);
  assert.equal(game.ap,null);
  assert.equal(game.home,"Boston Celtics");
  assert.equal(game.away,"New York Knicks");
});

test("Elo probabilities are complementary and scores remain finite",()=>{
  const games=[];
  for(let i=0;i<8;i++)games.push({start:`2026-10-${String(i+1).padStart(2,"0")}T00:00:00Z`,status:"FT",home:i%2?"Boston Celtics":"New York Knicks",away:i%2?"New York Knicks":"Boston Celtics",hp:i%2?105:118,ap:i%2?112:104});
  const model=buildNbaModel(games);
  const prediction=predictNba(model,"Boston Celtics","New York Knicks");
  assert.ok(prediction.homeWin>0&&prediction.homeWin<1);
  assert.ok(Math.abs(prediction.homeWin+prediction.awayWin-1)<1e-12);
  assert.ok(Number.isFinite(prediction.total));
  assert.equal(prediction.reliable,true);
});
