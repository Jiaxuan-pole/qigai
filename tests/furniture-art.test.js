import test from 'node:test';
import assert from 'node:assert/strict';
import { drawFurnitureSprite, drawParcel, drawFloorSheet } from '../public/ui/furniture-art.js';
import { renderCampStreet, campSpotsFor } from '../public/ui/camp-art.js';
import { loadData } from '../public/game/data.js';

await loadData();

function canvas() {
  const calls = [];
  return { calls, fillStyle: '', save() {}, restore() {}, translate(...args) { calls.push(['translate', ...args]); }, rotate(angle) { calls.push(['rotate', angle]); }, fillRect(...args) { calls.push(['rect', ...args, this.fillStyle]); } };
}

test('each owned furniture SKU has distinct pixel geometry, with legacy bed distinct', () => {
  const ids = ['bed_basic', 'bed_comfort', 'dining_table', 'chair', 'sofa', 'cabinet', 'lamp', 'rug', 'legacy_bed'];
  const signatures = ids.map((id) => { const c = canvas(); drawFurnitureSprite(c, id, 100, 250, 0, { night: false }); return JSON.stringify(c.calls); });
  assert.equal(new Set(signatures).size, ids.length);
  assert.ok(signatures.every((signature) => signature.includes('rect')));
});

test('rotation changes the painted geometry and night lamp emits light', () => {
  const normal = canvas(), rotated = canvas(), night = canvas();
  drawFurnitureSprite(normal, 'dining_table', 100, 250, 0);
  drawFurnitureSprite(rotated, 'dining_table', 100, 250, 90);
  drawFurnitureSprite(night, 'lamp', 100, 250, 0, { night: true });
  assert.notDeepEqual(normal.calls, rotated.calls);
  assert.ok(rotated.calls.some((call) => call[0] === 'rotate' && call[1] === Math.PI / 2));
  assert.ok(night.calls.some((call) => call.includes('rgba(236,184,91,0.18)')));
});

test('paper parcel and floor sheet are readable without furniture silhouettes', () => {
  const parcel = canvas(), sheet = canvas();
  drawParcel(parcel, 100, 250, 3);
  drawFloorSheet(sheet, 100, 250, 'xuan');
  assert.ok(parcel.calls.length >= 7);
  assert.ok(sheet.calls.length >= 7);
  assert.notDeepEqual(parcel.calls, sheet.calls);
});

const camp = () => ({ camp: { furnitureVersion: 1, floorSheets: 2, placements: [], parcels: [], facilities: [] },
  actors: { xuan: { life: 'active', location: 'camp' }, fan: { life: 'active', location: 'camp' } }, items: [] });

test('empty floor sheets show two cloth beds and no owned bed or dining table', () => {
  const c = canvas();
  renderCampStreet(c, { state: camp() });
  assert.equal(c.calls.filter((call) => call.includes('#84959a')).length, 1);
  assert.equal(c.calls.filter((call) => call.includes('#97816a')).length, 1);
  assert.equal(c.calls.some((call) => call.includes('#a09b83')), false);
  assert.equal(c.calls.some((call) => call.includes('#eee2c6')), false);
  assert.match(campSpotsFor(camp())[0].name, /地铺/);
});

test('recruited third sleeper uses a sheet, placed beds roll away unused sheets', () => {
  const s = camp();
  s.actors.ma = { life: 'active', location: 'camp' };
  s.camp.floorSheets = 3;
  const empty = canvas();
  renderCampStreet(empty, { state: s });
  assert.equal(empty.calls.filter((call) => call.includes('#788b81')).length, 1);
  s.items = [{ uid: 'bed-1', itemId: 'bed_basic', container: 'camp' }, { uid: 'bed-2', itemId: 'bed_comfort', container: 'camp' }];
  s.camp.placements = [{ uid: 'bed-1', slot: 'upper_1', rotation: 0 }, { uid: 'bed-2', slot: 'upper_2', rotation: 0 }];
  const placed = canvas();
  renderCampStreet(placed, { state: s });
  assert.equal(placed.calls.filter((call) => call.includes('#788b81')).length, 1);
  assert.equal(placed.calls.some((call) => call.includes('#84959a')), false);
  assert.equal(placed.calls.some((call) => call.includes('#97816a')), false);
});

test('all furniture sku rendered from one valid placed UID each', () => {
  const ids = ['bed_basic', 'bed_comfort', 'dining_table', 'chair', 'sofa', 'cabinet', 'lamp', 'rug', 'legacy_bed'];
  for (const itemId of ids) {
    const s = camp();
    s.items = [{ uid: 'owned', itemId, container: 'camp' }];
    s.camp.placements = [{ uid: 'owned', slot: 'upper_1', rotation: 0 }];
    const c = canvas();
    renderCampStreet(c, { state: s });
    const sprite = canvas();
    drawFurnitureSprite(sprite, itemId, 185, 255);
    const own = c.calls.filter((call) => call[0] === 'rotate');
    assert.equal(own.length, 1, itemId);
    assert.ok(c.calls.length >= sprite.calls.length, itemId);
  }
});

test('sealed parcel is not rendered as furniture and repeated UID paints once', () => {
  const s = camp();
  s.items = [{ uid: 'bed-1', itemId: 'bed_basic', container: 'parcel:p1' }];
  s.camp.parcels = [{ id: 'p1', status: 'sealed', itemUids: ['bed-1'] }];
  s.camp.placements = [{ uid: 'bed-1', slot: 'upper_1', rotation: 0 }];
  const c = canvas();
  renderCampStreet(c, { state: s });
  assert.equal(c.calls.filter((call) => call[0] === 'rotate').length, 0);
  assert.ok(c.calls.some((call) => call.includes('#a78253')));
  s.items[0].container = 'camp';
  s.camp.parcels = [];
  s.camp.placements.push({ uid: 'bed-1', slot: 'upper_2', rotation: 0 });
  const opened = canvas();
  renderCampStreet(opened, { state: s });
  assert.equal(opened.calls.filter((call) => call[0] === 'rotate').length, 1);
});
