import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../public/game/data.js';
import { fresh, assign, useItem } from '../public/game/engine.js';
import { makeItem, effectiveFood } from '../public/game/items.js';
import { settle } from '../public/game/settle.js';
import { fuelCount } from '../public/game/camp.js';

before(loadData);
function scenario() {
  const s = fresh(119);
  s.pendingMorning = null;
  s.plan = Object.fromEntries(['xuan','fan','ma'].map(id => [id, Array(16).fill(null)]));
  s.items = []; s.wood = 0; s.cardboard = 1;
  makeItem(s, 'charcoal_smokeless', 'camp').uses = 1;
  return s;
}
function arrange(s, id, uid) {
  const r = assign(s, id, s.hour, 'cook', { targets: [uid] });
  assert.equal(r.error, undefined);
  return r.state;
}

test('生鱼只能出售或加工，篝火花一小时一份燃料后可以吃', () => {
  let s = scenario(); const fish = makeItem(s, 'fish_common', 'xuan');
  assert.equal(effectiveFood(s), 0);
  const raw = useItem(s, 'xuan', fish.uid);
  assert.ok(raw.error); assert.equal(raw.state, s);
  s = arrange(s, 'xuan', fish.uid);
  const r = settle(s); assert.equal(r.error, undefined);
  assert.equal(r.state.hour, 7); assert.equal(r.state.actors.xuan.energy, 80);
  assert.equal(fuelCount(r.state), 0); assert.equal(r.state.cardboard, 1); assert.equal(r.state.items[0].itemId, 'fish_common_cooked');
  assert.equal(effectiveFood(r.state), 1);
  const eaten = useItem(r.state, 'xuan', fish.uid);
  assert.equal(eaten.error, undefined); assert.equal(eaten.state.actors.xuan.food, s.actors.xuan.food + 32);
  assert.equal(eaten.state.items.length, 0);
});

test('多人不能同小时加工同一原料，也不能超过共享燃料，失败整小时不动', () => {
  let s = scenario(); const a = makeItem(s, 'meal', 'camp'), b = makeItem(s, 'bread', 'camp');
  s = arrange(arrange(s, 'xuan', a.uid), 'fan', a.uid);
  let r = settle(s); assert.match(r.error, /同一|重复/); assert.equal(r.state, s);
  s = arrange(s, 'fan', b.uid);
  const before = JSON.stringify(s); r = settle(s);
  assert.match(r.error, /燃料/); assert.equal(JSON.stringify(r.state), before);
  s.items.find(x=>x.itemId==='charcoal_smokeless').uses = 2;
  r = settle(s); assert.equal(r.error, undefined); assert.equal(fuelCount(r.state), 0);
  assert.deepEqual(r.state.items.map(x => x.itemId).sort(), ['bread_toasted','meal_hot']);
});

test('建造的木料与加工的炭各扣各的，缺炭不能拿木料替代', () => {
  let s = scenario(); s.cardboard = 0; s.wood = 2; s.parts = 1;
  const meal = makeItem(s, 'meal', 'camp'); s = arrange(s, 'xuan', meal.uid);
  const build = assign(s, 'fan', s.hour, 'facility', { facility: { slot: 0, kind: 'repair_table' } });
  assert.equal(build.error, undefined);
  const noCoal = structuredClone(build.state); noCoal.items = noCoal.items.filter(x=>x.itemId!=='charcoal_smokeless');
  const fail = settle(noCoal); assert.match(fail.error, /燃料/); assert.equal(fail.state, noCoal);
  const r = settle(build.state); assert.equal(r.error, undefined);
  assert.equal(r.state.wood,0); assert.equal(fuelCount(r.state),0); assert.equal(r.state.camp.facilities[0],'repair_table');
});
