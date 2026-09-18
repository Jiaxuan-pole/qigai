import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../public/game/data.js';
import { fresh } from '../public/game/engine.js';
import { FACILITIES, canInstall, install, uninstall, hasFacility, fuelCount, burnFuel, nightWarmthBonus, campReport } from '../public/game/camp.js';

before(async () => { await loadData(); });

test('camp installs a repair table into either slot and spends exact materials', () => {
  const s = fresh(401);
  delete s.camp.facilities;
  assert.equal(canInstall(s, 1, 'repair_table').ok, true);
  const result = install(s, 1, 'repair_table');
  assert.equal(result.error, undefined);
  assert.deepEqual(s.camp.facilities, [null, 'repair_table']);
  assert.equal(s.wood, 0);
  assert.equal(s.parts, 1);
  assert.equal(hasFacility(s, 'repair_table'), true);
  assert.equal(FACILITIES.repair_table.effectKey, 'repair_table');
});

test('camp validates slot, materials, duplicate and occupied slots without spending', () => {
  const s = fresh(402);
  for (const [slot, kind] of [[-1, 'repair_table'], [2, 'repair_table'], [0.5, 'repair_table'], [0, 'unknown'], [0, 'toString']]) {
    const snapshot = structuredClone(s);
    assert.equal(canInstall(s, slot, kind).ok, false);
    assert.ok(install(s, slot, kind).error);
    assert.deepEqual(s, snapshot);
  }
  s.wood = 0;
  assert.equal(canInstall(s, 0, 'display_rack').ok, false);
  s.wood = 10;
  install(s, 0, 'display_rack');
  const snapshot = structuredClone(s);
  assert.equal(canInstall(s, 1, 'display_rack').ok, false);
  assert.equal(canInstall(s, 0, 'drying_rack').ok, false);
  assert.ok(install(s, 0, 'drying_rack').error);
  assert.deepEqual(s, snapshot);
});

test('camp uninstall refunds half of each material rounded down and cannot repeat', () => {
  for (const [kind, expected] of [
    ['repair_table', { wood: 9, parts: 9, cloth: 10 }],
    ['display_rack', { wood: 9, parts: 10, cloth: 9 }],
    ['drying_rack', { wood: 9, parts: 10, cloth: 9 }],
  ]) {
    const s = fresh(403);
    s.wood = s.parts = s.cloth = 10;
    install(s, 0, kind);
    assert.equal(uninstall(s, 0).error, undefined);
    assert.deepEqual({ wood: s.wood, parts: s.parts, cloth: s.cloth }, expected);
    assert.deepEqual(s.camp.facilities, [null, null]);
    const snapshot = structuredClone(s);
    assert.ok(uninstall(s, 0).error);
    assert.ok(uninstall(s, 2).error);
    assert.deepEqual(s, snapshot);
  }
});

test('camp burns charcoal before building materials and returns actual consumption', () => {
  const s = fresh(404);
  s.wood = 4;
  s.cardboard = 3;
  s.items.push({ uid: 'coal1', itemId: 'charcoal_smokeless', container: 'camp', uses: 6 });
  assert.equal(fuelCount(s), 6);
  assert.equal(burnFuel(s), 2);
  assert.deepEqual([s.cardboard, s.wood], [3, 4]);
  assert.equal(burnFuel(s, 3), 3);
  assert.deepEqual([s.cardboard, s.wood], [3, 4]);
  assert.equal(burnFuel(s, 9), 1);
  assert.equal(fuelCount(s), 0);
  assert.equal(burnFuel(s, -1), 0);
  assert.equal(fuelCount(s), 0);
});

test('camp warmth consumes two fuel normally and three in each cold weather kind', () => {
  for (const weather of ['clear', 'rain', 'cold', 'coldwave', 'storm']) {
    const need = ['cold', 'coldwave', 'storm'].includes(weather) ? 3 : 2;
    const enough = fresh(405);
    enough.items.push({ uid: 'coal-enough', itemId: 'charcoal_smokeless', container: 'camp', uses: need });
    assert.equal(nightWarmthBonus(enough, weather), 10);
    assert.equal(fuelCount(enough), 0);
    const short = fresh(406);
    short.items.push({ uid: 'coal-short', itemId: 'charcoal_smokeless', container: 'camp', uses: need - 1 });
    assert.equal(nightWarmthBonus(short, weather), 4);
    assert.equal(fuelCount(short), 0);
  }
});

test('a cold night without charcoal gives no fire warmth', () => {
  const state = fresh(408);
  state.wood = 8;
  state.cardboard = 8;
  assert.equal(nightWarmthBonus(state, 'coldwave'), 0);
  assert.deepEqual([state.wood, state.cardboard], [8, 8]);
});

test('camp handles absent optional fields and report distinguishes ordinary and cold nights', () => {
  const s = fresh(407);
  delete s.camp.facilities;
  delete s.cardboard;
  s.wood = 6;
  s.items.push({ uid: 'coal-report', itemId: 'charcoal_smokeless', container: 'camp', uses: 6 });
  assert.equal(hasFacility(s, 'drying_rack'), false);
  assert.equal(fuelCount(s), 6);
  assert.match(campReport(s), /空位/);
  assert.match(campReport(s), /3晚/);
  assert.match(campReport(s), /2晚/);
  install(s, 0, 'drying_rack');
  assert.match(campReport(s), /晾晒架/);
  delete s.wood;
  s.items = s.items.filter((item) => item.uid !== 'coal-report');
  assert.equal(burnFuel(s), 0);
  assert.equal(nightWarmthBonus(s, 'coldwave'), 0);
});
