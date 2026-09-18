import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadData } from '../public/game/data.js';
import { fresh, assign, buyNow, meet, useItem, unpackParcel, placeFurniture, moveFurniture, storeFurniture } from '../public/game/engine.js';
import { settle } from '../public/game/settle.js';
import { normalizeSave, validateSave } from '../public/game/save.js';
import { createSaveStore } from '../server/save-store.js';
import { drawFloorBubble } from '../public/ui/sleep-scene.js';

await loadData();

function next(result) {
  assert.equal(result.error, undefined, result.error);
  return result.state;
}

test('fresh shopping parcel camp meal sleep day end save reload move store', async () => {
  let state = fresh(611);
  assert.equal(state.camp.beds, 0);
  assert.equal(state.camp.floorSheets, 2);
  state.pendingMorning = null;
  state.cash = 200;
  state.ledger.start = 200;
  for (const id of ['xuan', 'fan']) state.plan[id].fill(null);
  while (state.hour < 10) state = next(settle(state));
  state.actors.xuan.location = 'furniture';
  const purchaseCash = state.cash;
  const bought = buyNow(state, 'xuan', [
    { shopId: 'furniture_store', itemId: 'bed_basic', qty: 1 },
    { shopId: 'furniture_store', itemId: 'dining_table', qty: 1 },
  ], 'camp');
  state = next(bought);
  const [bedUid, tableUid] = bought.made.map(item => item.uid);
  assert.equal(new Set([bedUid, tableUid]).size, 2);
  assert.equal(state.cash, purchaseCash - bought.total);
  assert.equal(state.ledger.start + state.ledger.income - state.ledger.expense, state.cash);
  assert.deepEqual(state.camp.parcels[0].itemUids, [bedUid, tableUid]);
  assert.deepEqual(bought.made.map(item => item.container), ['parcel:p1', 'parcel:p1']);
  assert.equal(state.camp.beds, 0);

  state.actors.xuan.location = 'camp';
  state = next(unpackParcel(state, 'xuan', bought.parcelId));
  assert.equal(state.camp.parcels[0].status, 'opened');
  state = next(placeFurniture(state, 'xuan', bedUid, 'west_1'));
  state = next(placeFurniture(state, 'xuan', tableUid, 'upper_5'));
  assert.equal(state.camp.beds, 1);
  assert.deepEqual(state.camp.placements.map(item => item.uid), [bedUid, tableUid]);
  state.actors.xuan.mind = 40;
  for (const expected of [42, 44, 44]) {
    const meal = state.items.find(item => item.itemId === 'meal' && item.container === 'camp');
    assert.ok(meal);
    state = next(useItem(state, 'xuan', meal.uid));
    assert.equal(state.actors.xuan.mind, expected);
  }
  assert.equal(state.daily.tableMeals.xuan, 2);

  state.actors.xuan.energy = 40;
  const scheduled = next(assign(state, 'xuan', state.hour, 'sleep'));
  const bedHour = settle(scheduled);
  assert.equal(bedHour.error, undefined, bedHour.error);
  assert.equal(bedHour.state.actors.xuan.energy, 70);
  const floorState = next(storeFurniture(state, 'xuan', bedUid));
  const floorHour = settle(next(assign(floorState, 'xuan', floorState.hour, 'sleep')));
  assert.equal(floorHour.error, undefined, floorHour.error);
  assert.equal(floorHour.state.actors.xuan.energy, 60);
  state = bedHour.state;

  let night;
  while (state.day === 1) {
    if (state.phase === 'meeting') state = next(meet(state, 0));
    const result = settle(state);
    state = next(result);
    if (result.night) night = result.night;
  }
  assert.ok(night);
  assert.equal(night.beds, 1);
  assert.equal(night.sleepSurfaces.xuan.kind, 'bed');
  assert.equal(night.sleepSurfaces.xuan.uid, bedUid);
  assert.equal(night.sleepSurfaces.fan.kind, 'floor');
  assert.equal(typeof night.fire, 'boolean');
  assert.equal(drawFloorBubble({ fillRect() {}, fillText() {}, save() {}, restore() {} }, night.sleepSurfaces, 'xuan'), null);
  assert.equal(state.lastDayReport.day, 1);
  assert.equal(state.lastDayReport.endCash, night.end);
  assert.equal(state.lastDayReport.cashDelta, state.lastDayReport.endCash - state.lastDayReport.startCash);
  assert.equal(validateSave(state).ok, true);

  const dir = await mkdtemp(join(tmpdir(), 'furniture-flow-'));
  try {
    const store = createSaveStore(dir);
    const saved = await store.create({ name: '家具整链', state, night });
    const loaded = await store.get(saved.id);
    assert.deepEqual(loaded.night.sleepSurfaces, night.sleepSurfaces);
    assert.equal(loaded.night.fire, night.fire);
    assert.deepEqual(loaded.state.lastDayReport, state.lastDayReport);
    assert.equal(loaded.state.cash, state.cash);
    assert.deepEqual(loaded.state.camp.placements.map(item => item.uid), [bedUid, tableUid]);
    state = next(moveFurniture(loaded.state, 'xuan', bedUid, 'west_2'));
    assert.equal(state.camp.placements.find(item => item.uid === bedUid).slot, 'west_2');
    state = next(storeFurniture(state, 'xuan', bedUid));
    assert.equal(state.camp.beds, 0);
    assert.equal(state.items.find(item => item.uid === bedUid).container, 'camp');
    assert.equal(validateSave(state).ok, true);
    const updated = await store.update(saved.id, { state, night, expectedRevision: 1 });
    assert.equal(updated.revision, 2);
    assert.equal(updated.state.camp.beds, 0);
    assert.equal(updated.night.sleepSurfaces.xuan.uid, bedUid);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('legacy bed kept but crafting action retired', () => {
  const legacy = fresh(612);
  legacy.camp.beds = 2;
  for (const key of ['furnitureVersion', 'floorSheets', 'placements', 'parcels', 'parcelSeq']) delete legacy.camp[key];
  delete legacy.daily.tableMeals;
  assert.equal(validateSave(legacy).ok, true);
  const migrated = normalizeSave(legacy);
  assert.equal(validateSave(migrated).ok, true);
  assert.equal(migrated.camp.beds, 2);
  assert.equal(migrated.camp.placements.length, 2);
  const uidBefore = migrated.camp.placements.map(item => item.uid);
  const before = structuredClone(migrated);
  const denied = assign(migrated, 'xuan', migrated.hour, 'bed');
  assert.equal(denied.error, '无效角色、行动或已完成小时。');
  assert.deepEqual(denied.state, before);
  assert.deepEqual(migrated.camp.placements.map(item => item.uid), uidBefore);
  assert.equal(migrated.cash, before.cash);
  assert.equal(migrated.wood, before.wood);
  assert.equal(migrated.cloth, before.cloth);
});
