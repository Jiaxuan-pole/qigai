import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../public/game/data.js';
import { fresh } from '../public/game/engine.js';
import { makeItem, accessibleItems, transferItem } from '../public/game/items.js';
import { createFurnitureParcel, unpackParcel, placeFurniture, moveFurniture, rotateFurniture, storeFurniture, placedBedCount, hasDiningTable, sleepSurfaceFor, validateFurnitureState } from '../public/game/furniture.js';

before(loadData);
function setup() {
  const s = fresh(77);
  s.camp = { ...s.camp, furnitureVersion: 1, floorSheets: 2, beds: 0, placements: [], parcels: [], parcelSeq: 0 };
  return s;
}

test('parcel unpack place move rotate store preserves uid', () => {
  const s = setup();
  const bed = makeItem(s, 'bed_basic', 'camp');
  const table = makeItem(s, 'dining_table', 'camp');
  const parcel = createFurnitureParcel(s, [bed.uid, table.uid]);
  assert.equal(parcel.id, 'p1');
  assert.deepEqual(parcel.itemUids, [bed.uid, table.uid]);
  assert.equal(bed.container, 'parcel:p1');
  assert.equal(placedBedCount(s), 0);
  assert.equal(hasDiningTable(s), false);
  assert.equal(accessibleItems(s, 'xuan').some(x => x.uid === bed.uid), false);
  assert.equal(transferItem(s, bed.uid, 'xuan'), false);
  let revision = s.stateRevision;
  let r = unpackParcel(s, 'xuan', 'p1');
  assert.equal(r.error, undefined);
  assert.equal(r.state.stateRevision, ++revision);
  assert.ok(r.events.length);
  assert.equal(r.state.items.find(x => x.uid === bed.uid).container, 'camp');
  assert.equal(unpackParcel(r.state, 'xuan', 'p1').state, r.state);
  r = placeFurniture(r.state, 'xuan', bed.uid, 'west_1', 0);
  assert.equal(r.state.stateRevision, ++revision);
  assert.equal(placedBedCount(r.state), 1);
  assert.equal(r.state.camp.beds, 1);
  assert.equal(transferItem(r.state, bed.uid, 'fan'), false);
  r = moveFurniture(r.state, 'xuan', bed.uid, 'upper_2');
  assert.equal(r.state.stateRevision, ++revision);
  r = rotateFurniture(r.state, 'xuan', bed.uid, 90);
  assert.equal(r.state.stateRevision, ++revision);
  assert.equal(r.state.camp.placements[0].uid, bed.uid);
  r = storeFurniture(r.state, 'xuan', bed.uid);
  assert.equal(r.state.stateRevision, ++revision);
  assert.equal(placedBedCount(r.state), 0);
  assert.equal(r.state.items.filter(x => x.uid === bed.uid).length, 1);
  assert.equal(validateFurnitureState(r.state).ok, true);
});

test('remote unpack and collision are atomic', () => {
  const s = setup();
  const a = makeItem(s, 'bed_basic', 'camp');
  const b = makeItem(s, 'bed_basic', 'camp');
  createFurnitureParcel(s, [a.uid, b.uid]);
  s.actors.xuan.location = 'market';
  const before = JSON.stringify(s);
  assert.equal(unpackParcel(s, 'xuan', 'p1').error, '需要人在营地拆包');
  assert.equal(JSON.stringify(s), before);
  s.actors.xuan.location = 'camp';
  let r = unpackParcel(s, 'xuan', 'p1');
  r = placeFurniture(r.state, 'xuan', a.uid, 'west_1');
  const placed = JSON.stringify(r.state);
  assert.equal(placeFurniture(r.state, 'xuan', b.uid, 'west_1').error, '这个位置放不下家具');
  assert.equal(JSON.stringify(r.state), placed);
  assert.equal(placeFurniture(r.state, 'xuan', b.uid, 'fire').error, '这个位置放不下家具');
  assert.equal(JSON.stringify(r.state), placed);
});

test('sleep surfaces allocate only present actors and placed beds', () => {
  const s = setup();
  s.actors.ma.life = 'active';
  s.camp.floorSheets = 3;
  const bed = makeItem(s, 'legacy_bed', 'camp');
  const stored = sleepSurfaceFor(s, 'fan', 'camp', { presentIds: ['fan', 'ma'] });
  assert.equal(stored.kind, 'floor');
  const r = placeFurniture(s, 'fan', bed.uid, 'west_1');
  assert.equal(sleepSurfaceFor(r.state, 'fan', 'camp', { presentIds: ['fan', 'ma'] }).kind, 'bed');
  const floor = sleepSurfaceFor(r.state, 'ma', 'camp', { presentIds: ['fan', 'ma'] });
  assert.equal(floor.kind, 'floor');
  assert.deepEqual(floor.anchor, { x: 385, y: 402 });
  assert.equal(sleepSurfaceFor(r.state, 'fan', 'station').kind, 'station');
});

test('night sleeping ids include downed survivors but never dead actors', () => {
  const s = setup();
  s.actors.xuan.life = 'downed';
  const bed = makeItem(s, 'legacy_bed', 'camp');
  const placed = placeFurniture(s, 'fan', bed.uid, 'west_1').state;
  const sleepingIds = ['xuan', 'fan', 'xuan', 'ghost'];
  assert.deepEqual(sleepSurfaceFor(placed, 'xuan', 'camp', { sleepingIds }).kind, 'bed');
  assert.deepEqual(sleepSurfaceFor(placed, 'fan', 'camp', { sleepingIds }).kind, 'floor');
  assert.equal(sleepSurfaceFor(placed, 'xuan', 'camp'), null);
  placed.actors.xuan.life = 'dead';
  assert.equal(sleepSurfaceFor(placed, 'xuan', 'camp', { sleepingIds }), null);
  assert.equal(sleepSurfaceFor(placed, 'fan', 'camp', { sleepingIds }).kind, 'bed');
});

test('three bed cap, table effect and strict state validation', () => {
  let s = setup();
  const beds = Array.from({ length: 4 }, () => makeItem(s, 'bed_basic', 'camp'));
  for (const [i, slot] of ['west_1', 'west_2', 'east_1'].entries()) {
    const result = placeFurniture(s, 'xuan', beds[i].uid, slot);
    assert.equal(result.error, undefined);
    s = result.state;
  }
  assert.equal(placedBedCount(s), 3);
  assert.equal(placeFurniture(s, 'xuan', beds[3].uid, 'upper_1').error, '营地最多摆三张床');
  const table = makeItem(s, 'dining_table', 'camp');
  assert.equal(hasDiningTable(s), false);
  s = placeFurniture(s, 'xuan', table.uid, 'upper_5').state;
  assert.equal(hasDiningTable(s), true);
  assert.equal(validateFurnitureState(s).ok, true);
  for (const corrupt of [
    x => { x.camp.placements[0].rotation = NaN; },
    x => { x.camp.placements[0].slot = 'fire'; },
    x => { x.camp.placements[0].extra = true; },
    x => { x.camp.beds = 2; },
    x => { x.items.push({ ...x.items[0] }); },
    x => { x.camp.bedPriority = ['xuan', 'xuan', 'fan']; },
    x => { x.itemSeq = 0; },
  ]) {
    const invalid = structuredClone(s);
    corrupt(invalid);
    assert.equal(validateFurnitureState(invalid).ok, false);
  }
});

test('parcel history and item sequence reject forged containers', () => {
  const s = setup();
  const bed = makeItem(s, 'bed_basic', 'camp');
  createFurnitureParcel(s, [bed.uid]);
  const sealedElsewhere = structuredClone(s);
  sealedElsewhere.items.find(x => x.uid === bed.uid).container = 'parcel:p2';
  assert.equal(validateFurnitureState(sealedElsewhere).ok, false);
  const unpacked = unpackParcel(s, 'xuan', 'p1').state;
  assert.equal(validateFurnitureState(unpacked).ok, true);
  unpacked.items.find(x => x.uid === bed.uid).container = 'xuan';
  assert.equal(validateFurnitureState(unpacked).ok, false);
});

test('ordinary goods still transfer while placed furniture does not', () => {
  const s = setup();
  const food = makeItem(s, 'bread', 'camp');
  const bed = makeItem(s, 'bed_basic', 'camp');
  assert.equal(transferItem(s, food.uid, 'fan'), true);
  assert.equal(s.items.find(x => x.uid === food.uid).container, 'fan');
  assert.equal(transferItem(s, bed.uid, 'parcel:p1'), false);
  assert.equal(transferItem(s, bed.uid, 'fan'), false);
  const placed = placeFurniture(s, 'xuan', bed.uid, 'west_1').state;
  assert.equal(accessibleItems(placed, 'xuan').some(x => x.uid === bed.uid), false);
  assert.equal(transferItem(placed, bed.uid, 'fan'), false);
});
