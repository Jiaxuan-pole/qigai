import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setData } from '../public/game/data.js';
import { fresh } from '../public/game/engine.js';
import { makeItem } from '../public/game/items.js';
import { normalizeSave, validateSave } from '../public/game/save.js';
import { createSaveStore } from '../server/save-store.js';

setData(JSON.parse(await readFile(new URL('../03_开发数据_商店物品愿望事件100日.json', import.meta.url), 'utf8')));

function legacy(version, beds) {
  const state = fresh(506);
  state.camp.beds = beds;
  for (const key of ['furnitureVersion', 'floorSheets', 'placements', 'parcels', 'parcelSeq']) delete state.camp[key];
  delete state.daily.tableMeals;
  if (version === 3) {
    state.version = 3;
    for (const id of ['xuan', 'fan', 'ma']) state.plan[id] = [null, null, null, null];
  }
  return state;
}

test('v3 and v4 legacy beds migrate once, including zero beds', () => {
  for (const version of [3, 4]) for (const beds of [0, 1, 2, 3]) {
    const state = legacy(version, beds);
    state.plan.xuan[0] = { id: 'bed', hours: 1 };
    assert.equal(validateSave(state).ok, true, `${version}/${beds} preflight`);
    const normalized = normalizeSave(state);
    assert.equal(normalized.version, 4);
    assert.equal(normalized.camp.beds, beds);
    assert.equal(normalized.camp.furnitureVersion, 1);
    assert.equal(normalized.camp.floorSheets, 2);
    assert.equal(normalized.camp.placements.length, beds);
    assert.equal(normalized.items.filter(item => item.itemId === 'legacy_bed').length, beds);
    assert.equal(normalized.plan.xuan[0].id, 'rest');
    assert.equal(normalized.cash, state.cash);
    assert.deepEqual(normalized.ledger, state.ledger);
    assert.equal(validateSave(normalized).ok, true, `${version}/${beds} normalized`);
    assert.deepEqual(normalizeSave(normalized), normalized);
  }
  const olderUid = legacy(4, 1);
  makeItem(olderUid, 'bread', 'camp').uid = 'it12';
  const priorMax = Math.max(...olderUid.items.map(item => Number(item.uid.slice(2)) || 0));
  const migrated = normalizeSave(olderUid);
  assert.equal(migrated.camp.placements[0].uid, `it${priorMax + 1}`);
  assert.equal(migrated.itemSeq, priorMax + 1);
});

test('fresh zero beds and sealed, opened, placed furniture survive shared save', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'furniture-save-'));
  try {
    const store = createSaveStore(dir);
    const state = fresh(507);
    assert.equal(state.camp.beds, 0);
    assert.equal(state.camp.furnitureVersion, 1);
    const first = await store.create({ name: '空营地', state });
    assert.equal(first.state.camp.beds, 0);
    const bed = makeItem(state, 'bed_basic', 'parcel:p1');
    state.camp.parcelSeq = 1;
    state.camp.parcels.push({ id: 'p1', itemUids: [bed.uid], status: 'sealed', createdDay: 1, createdHour: 6 });
    const sealed = await store.update(first.id, { state, expectedRevision: 1 });
    assert.deepEqual(sealed.state.camp.parcels, state.camp.parcels);
    state.camp.parcels[0].status = 'opened';
    bed.container = 'camp';
    state.camp.placements.push({ uid: bed.uid, slot: 'west_1', rotation: 0 });
    state.camp.beds = 1;
    const placed = await store.update(first.id, { state, expectedRevision: 2 });
    assert.deepEqual(placed.state.camp, state.camp);
    assert.equal(placed.state.items.find(item => item.uid === bed.uid).container, 'camp');
    assert.equal(placed.state.cash, state.cash);
    assert.deepEqual(placed.state.ledger, state.ledger);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('tampered furniture save rejected for UID, slot, beds, parcel and present malformed fields', () => {
  const state = normalizeSave(legacy(4, 1));
  const invalid = mutation => { const copy = structuredClone(state); mutation(copy); assert.equal(validateSave(copy).ok, false); };
  invalid(s => { s.camp.placements[0].uid = 'it999999'; });
  invalid(s => { s.items.push(structuredClone(s.items[0])); });
  invalid(s => { s.camp.placements[0].slot = 'made_up'; });
  invalid(s => { s.camp.beds = 2; });
  invalid(s => { s.daily.tableMeals.xuan = 3; });
  invalid(s => { s.camp.floorSheets = 0; });
  invalid(s => { s.camp.bedPriority = ['xuan', 'xuan', 'ma']; });
  const old = legacy(4, 1);
  old.camp.parcels = [];
  assert.equal(validateSave(old).ok, false);
  const parcel = fresh(509);
  const item = makeItem(parcel, 'chair', 'parcel:p1');
  parcel.camp.parcelSeq = 1;
  parcel.camp.parcels.push({ id: 'p1', itemUids: [item.uid], status: 'sealed', createdDay: 1, createdHour: 6 });
  assert.equal(validateSave(parcel).ok, true);
  parcel.camp.parcels[0].status = 'opened';
  assert.equal(validateSave(parcel).ok, false);
  item.container = 'camp';
  assert.equal(validateSave(parcel).ok, true);
  item.container = 'xuan';
  assert.equal(validateSave(parcel).ok, false);
});

test('shared night keeps historical sleep surfaces and fire across revisions', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'furniture-night-'));
  try {
    const store = createSaveStore(dir);
    const state = fresh(508);
    state.day = 2; state.hour = 6; state.hourTick = 16; state.turn = 4; state.slot = 0;
    const bed = makeItem(state, 'bed_basic', 'camp');
    state.camp.placements.push({ uid: bed.uid, slot: 'west_1', rotation: 0 });
    state.camp.beds = 1;
    const night = { day: 1, spot: 'camp', stage: 'chat', fire: true, sleepSurfaces: {
      xuan: { kind: 'bed', uid: bed.uid, slot: 'west_1', anchor: { x: 213, y: 393 } },
      fan: { kind: 'floor', uid: null, slot: 'floor_1', anchor: { x: 230, y: 402 } },
    } };
    const first = await store.create({ name: '第一晚', state, night });
    state.camp.placements = [];
    state.camp.beds = 0;
    const second = await store.update(first.id, { state, night, expectedRevision: 1 });
    assert.deepEqual(second.night, night);
    assert.deepEqual((await store.get(first.id)).night, night);
    await assert.rejects(store.update(first.id, { state, night, expectedRevision: 1 }), { status: 409 });
    for (const bad of [
      { ...night, fire: 'true' },
      { ...night, sleepSurfaces: { xuan: { ...night.sleepSurfaces.xuan, uid: 'it99999' } } },
      { ...night, sleepSurfaces: { xuan: { ...night.sleepSurfaces.xuan, anchor: { x: 0, y: 0 } } } },
    ]) await assert.rejects(store.update(first.id, { state, night: bad, expectedRevision: 2 }), { status: 400 });
  } finally { await rm(dir, { recursive: true, force: true }); }
});
