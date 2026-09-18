import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../public/game/data.js';
import { assign, useItem } from '../public/game/engine.js';
import { settle } from '../public/game/settle.js';
import { makeItem } from '../public/game/items.js';
import { placeFurniture } from '../public/game/furniture.js';
import { ready } from './engine-fixtures.js';

before(loadData);
function furnish(s, itemId, slot = 'west_1') {
  const item = makeItem(s, itemId, 'camp');
  const result = placeFurniture(s, 'xuan', item.uid, slot);
  assert.equal(result.error, undefined, result.error);
  return { state: result.state, uid: item.uid };
}
function sleepHour(withBed) {
  let s = ready(191, { slot: 1 });
  s.actors.xuan.energy = 40;
  if (withBed) s = furnish(s, 'bed_basic').state;
  const assigned = assign(s, 'xuan', s.hour, 'sleep');
  assert.equal(assigned.error, undefined, assigned.error);
  return settle(assigned.state);
}

test('floor sleep twenty placed bed thirty and night baseline', () => {
  const floor = sleepHour(false), bed = sleepHour(true);
  assert.equal(floor.error, undefined, floor.error);
  assert.equal(bed.error, undefined, bed.error);
  assert.equal(floor.state.actors.xuan.energy, 60);
  assert.equal(bed.state.actors.xuan.energy, 70);

  for (const intox of [0, 2]) {
    let s = ready(192, { slot: 3 });
    s.hour = 21;
    s.actors.xuan.intox = intox;
    s.actors.xuan.energy = 40;
    const result = settle(s);
    assert.equal(result.error, undefined, result.error);
    assert.equal(result.state.actors.xuan.energy, intox ? 80 : 100);
    assert.equal(result.night.sleepSurfaces.xuan.kind, 'floor');
    assert.equal(typeof result.night.fire, 'boolean');
  }
});

test('table meal remote cap duplicate uid', () => {
  let s = ready(193, { slot: 1 });
  s = furnish(s, 'dining_table').state;
  s.actors.xuan.mind = 40;
  s.actors.xuan.location = 'market';
  const remote = makeItem(s, 'meal', 'xuan');
  let result = useItem(s, 'xuan', remote.uid);
  assert.equal(result.error, undefined, result.error);
  assert.equal(result.state.actors.xuan.mind, 40);
  s = result.state;
  s.actors.xuan.location = 'camp';
  for (const expected of [42, 44, 44]) {
    const meal = makeItem(s, 'meal', 'xuan');
    result = useItem(s, 'xuan', meal.uid);
    assert.equal(result.error, undefined, result.error);
    assert.equal(result.state.actors.xuan.mind, expected);
    s = result.state;
  }
  assert.equal(s.daily.tableMeals.xuan, 2);
  const again = useItem(s, 'xuan', remote.uid);
  assert.ok(again.error);
  assert.equal(again.state.actors.xuan.mind, 44);
});

test('only current sleepers claim placed beds and night stores the actual uid', () => {
  let s = ready(194, { slot: 1 });
  const bed = furnish(s, 'bed_basic');
  s = bed.state;
  s.actors.xuan.energy = 40;
  s.actors.fan.energy = 40;
  for (const id of ['xuan', 'fan']) s = assign(s, id, s.hour, 'sleep').state;
  let result = settle(s);
  assert.equal(result.error, undefined, result.error);
  assert.equal(result.state.actors.xuan.energy, 70);
  assert.equal(result.state.actors.fan.energy, 60);

  s = ready(195, { slot: 3 });
  s.hour = 21;
  s = furnish(s, 'bed_basic').state;
  result = settle(s);
  assert.equal(result.error, undefined, result.error);
  assert.deepEqual(result.night.sleepSurfaces.xuan.kind, 'bed');
  assert.equal(result.night.sleepSurfaces.xuan.uid, s.camp.placements[0].uid);
  assert.equal(result.night.sleepSurfaces.fan.kind, 'floor');
  assert.equal(result.night.sleepSurfaces.fan.uid, null);
});

test('automatic camp meals and bedtime meal use table once per food', () => {
  let s = ready(196, { slot: 1 });
  s.hour = 13;
  s = furnish(s, 'dining_table').state;
  s.actors.xuan.mind = 40;
  const before = s.items.filter((it) => it.itemId === 'meal').length;
  const result = settle(s);
  assert.equal(result.error, undefined, result.error);
  assert.ok(result.state.items.filter((it) => it.itemId === 'meal').length < before);
  assert.equal(result.state.daily.tableMeals.xuan, 1);

  s = ready(197, { slot: 3 });
  s.hour = 21;
  s.items = s.items.filter((it) => it.itemId !== 'meal');
  s.actors.xuan.food = 15;
  makeItem(s, 'meal', 'xuan');
  s = furnish(s, 'dining_table').state;
  const night = settle(s);
  assert.equal(night.error, undefined, night.error);
  assert.ok(night.events.some((event) => event.includes('在营地餐桌吃饭')));
});
