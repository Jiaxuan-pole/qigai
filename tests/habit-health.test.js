import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../public/game/data.js';
import { fresh, assign } from '../public/game/engine.js';
import { settle, HABIT_RISK } from '../public/game/settle.js';
import { rng } from '../public/game/rng.js';

before(loadData);

// 夜结算前的最后一小时：两人在营地休息，直接触发过夜结算。
function nightState(seed) {
  let s = fresh(seed);
  s.pendingMorning = null;
  s.slot = 3; s.hour = 21;
  for (const id of ['xuan', 'fan']) s = assign(s, id, 21, 'rest').state;
  return s;
}

const has = (state, id, pred) => state.actors[id].diseases.some(pred);
const cough = (d) => d.kind === 'cough';
const hangover = (d) => d.cause === '醉酒';
const seedsWhere = (key, chance, hit) => Array.from({ length: 80 }, (_, i) => i + 1).filter((seed) => (rng(seed, key) < chance) === hit);

test('一天抽烟超过15次，夜里按概率得呼吸道不适；15次以内不会', () => {
  const [sick] = seedsWhere('smoke:1:xuan', HABIT_RISK.smokeSickChance, true);
  const [healthy] = seedsWhere('smoke:1:xuan', HABIT_RISK.smokeSickChance, false);
  assert.ok(sick && healthy);
  let s = nightState(sick); s.actors.xuan.smokes = 16;
  let r = settle(s);
  assert.equal(r.error, undefined);
  assert.ok(r.state.actors.xuan.diseases.some((d) => d.kind === 'cough' && d.known), '过量者应出现呼吸道不适');
  assert.ok(r.events.some((e) => /抽了16次烟/.test(e)));
  assert.equal(r.state.actors.xuan.smokes, 0, '次数隔夜清零');
  s = nightState(healthy); s.actors.xuan.smokes = 16;
  assert.equal(has(settle(s).state, 'xuan', cough), false);
  s = nightState(sick); s.actors.xuan.smokes = 15;
  assert.equal(has(settle(s).state, 'xuan', cough), false, '15次是安全线');
});

test('醉酒过夜第二天有概率肠胃不适，饮酒次数隔夜清零', () => {
  const [sick] = seedsWhere('hangover:1:xuan', HABIT_RISK.hangoverSickChance, true);
  const [fine] = seedsWhere('hangover:1:xuan', HABIT_RISK.hangoverSickChance, false);
  assert.ok(sick && fine);
  let s = nightState(sick); s.actors.xuan.intox = 2; s.actors.xuan.drinks = 3;
  let r = settle(s);
  assert.equal(r.state.actors.xuan.hangoverDay, 2);
  assert.ok(r.state.actors.xuan.diseases.some((d) => d.kind === 'gut' && d.cause === '醉酒'));
  assert.equal(r.state.actors.xuan.drinks, 0);
  assert.equal(r.state.actors.xuan.intox, 0);
  s = nightState(fine); s.actors.xuan.intox = 2;
  r = settle(s);
  assert.equal(r.state.actors.xuan.hangoverDay, 2);
  assert.equal(has(r.state, 'xuan', hangover), false);
  s = nightState(sick); s.actors.xuan.intox = 1;
  assert.equal(has(settle(s).state, 'xuan', hangover), false, '没醉就没有宿醉风险');
});
