import test from 'node:test';
import assert from 'node:assert/strict';
import { drawStreet } from '../public/ui/street-art.js';
import { STREET_OBJECTS } from '../public/ui/street-props.js';
import { STOREFRONTS, drawStorefront } from '../public/ui/storefront-art.js';

const noop = () => {};
function geometry(district, state = {}, now = 0, reduced = true) {
  const rects = [], stack = [];
  const c = {
    x: 0, y: 0, sx: 1, sy: 1,
    fillRect(x, y, w, h) { rects.push([this.fillStyle, this.x + x * this.sx, this.y + y * this.sy, w * this.sx, h * this.sy]); },
    save() { stack.push([this.x, this.y, this.sx, this.sy]); },
    restore() { [this.x, this.y, this.sx, this.sy] = stack.pop(); },
    translate(x, y) { this.x += x * this.sx; this.y += y * this.sy; },
    scale(x, y) { this.sx *= x; this.sy *= y; },
    setTransform(a, _b, _c, d, e, f) { this.x = e; this.y = f; this.sx = a; this.sy = d; },
    beginPath: noop, moveTo: noop, lineTo: noop, fill: noop, fillText: noop,
  };
  drawStreet(c, { slot: 1, weatherKind: 'clear', actors: {}, ...state }, district, 'xuan', 480, false, now, reduced);
  return rects;
}

test('real storefront material and geometry differ across the six built streets', () => {
  const signatures = ['market', 'recycle', 'station', 'cinema', 'service', 'camp'].map((district) => {
    const rects = geometry(district).filter(([, x, y]) => x >= 0 && x < 960 && y >= 190 && y < 395);
    assert.ok(rects.length > 130, district);
    return JSON.stringify(rects);
  });
  assert.equal(new Set(signatures).size, 6);
  for (const id of ['convenience', 'breakfast', 'recycle_shop', 'lottery_kiosk', 'tavern', 'clinic', 'pharmacy', 'bathhouse', 'art_hardware', 'cinema']) assert.ok(STOREFRONTS[id], id);
});

test('open street conflicts draw their own detailed cast and resolved events clear them', () => {
  const scene = templateId => geometry('market', { events: [{ district: 'market', templateId, status: 'open' }] });
  const empty = geometry('market');
  assert.notDeepEqual(scene('street_thugs'), empty, 'active thugs must appear in the street');
  assert.notDeepEqual(scene('chengguan_sweep'), empty, 'active uniformed officers must appear in the street');
  assert.notDeepEqual(scene('street_thugs'), scene('chengguan_sweep'), 'hooded thugs and officers must have different silhouettes');
  assert.deepEqual(geometry('market', { events: [{ district: 'market', templateId: 'street_thugs', status: 'done' }] }), empty);
});

test('store staff and background residents fill the rear sidewalk without crowding activity anchors', () => {
  for (const district of ['market', 'recycle', 'station', 'cinema', 'service', 'river']) {
    const shadows = geometry(district).filter(([color]) => color === 'rgba(10,18,24,0.45)');
    const rear = shadows.filter(([, , y]) => y < 398);
    assert.equal(rear.length, 2, `${district} has two residents behind the walking lane`);
    assert.ok(shadows.length >= 6, `${district} keeps its existing passing crowd`);
    assert.ok(rear.every(([, x, y, w, h]) => x > 150 && x + w < 950 && y + h < 398), `${district} residents stay away from activity anchors`);
  }
});

test('bins, bottles and people have drawn clickable anchors with real spot ids', () => {
  for (const district of ['market', 'station', 'recycle']) assert.ok(STREET_OBJECTS[district].some((o) => o.id === 'bins'), district);
  for (const district of ['market', 'station', 'recycle', 'cinema', 'service', 'river']) {
    assert.ok(STREET_OBJECTS[district].some((o) => o.id === 'bottles'), district);
    assert.ok(STREET_OBJECTS[district].some((o) => o.id === 'passersby'), district);
  }
  assert.ok(geometry('river').some(([color]) => color === '#587c83'));
});

test('诊所药房和服务站不用同一个内部布局换招牌', () => {
  const signatures = ['clinic', 'pharmacy', 'service'].map((id) => {
    const rects = [];
    const c = { fillRect: (...r) => { if (r[1] >= 250 && r[1] < 380) rects.push(r); }, fillText: noop };
    drawStorefront(c, id, 0, 220);
    return JSON.stringify(rects);
  });
  assert.equal(new Set(signatures).size, 3, '门、柜台和陈设要有独立结构');
});
