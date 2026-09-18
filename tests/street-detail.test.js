import test from 'node:test';
import assert from 'node:assert/strict';
import { drawStreet } from '../public/ui/street-art.js';
import { STREET_OBJECTS } from '../public/ui/street-props.js';
import { STOREFRONTS, drawStorefront } from '../public/ui/storefront-art.js';

const noop = () => {};
function geometry(district) {
  const rects = [];
  const c = { fillRect: (...r) => rects.push([c.fillStyle, ...r]), save: noop, restore: noop, translate: noop, scale: noop, setTransform: noop, beginPath: noop, moveTo: noop, lineTo: noop, fill: noop, fillText: noop };
  drawStreet(c, { slot: 1, weatherKind: 'clear', actors: {} }, district, 'xuan', 480, false, 0, true);
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
