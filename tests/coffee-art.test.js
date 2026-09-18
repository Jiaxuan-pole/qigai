import test from 'node:test';
import assert from 'node:assert/strict';
import { drawStreet, STREET_NAMES } from '../public/ui/street-art.js';
import { neighbors } from '../public/ui/street.js';
import { DISTRICT_POS, SHOP_POS, drawDistrict } from '../public/ui/map.js';
import { drawItemArt, missingItemArtIds } from '../public/ui/item-art.js';

const noop = () => {};
function streetTrace(district, now = 0, reduced = true) {
  const calls = [];
  const c = { fillRect: (...args) => calls.push([c.fillStyle, ...args]), fillText: noop,
    save: noop, restore: noop, translate: noop, scale: noop, setTransform: noop,
    beginPath: noop, moveTo: noop, lineTo: noop, fill: noop };
  drawStreet(c, { slot: 1, weatherKind: 'clear', actors: {} }, district, 'xuan', 480, false, now, reduced);
  return calls;
}

function itemTrace(id) {
  const calls = [];
  const canvas = { width: 32, height: 32, getContext: () => ({ fillStyle: '',
    fillRect(x, y, w, h) { calls.push([this.fillStyle, x, y, w, h]); }, clearRect: noop }) };
  assert.equal(drawItemArt(canvas, id), true);
  return calls;
}

test('cafe is a distinct enterable interior with a stable reduced-motion frame', () => {
  const cafe = streetTrace('cafe');
  assert.ok(cafe.length > 100);
  assert.notDeepEqual(cafe, streetTrace('market'));
  assert.notDeepEqual(cafe, streetTrace('cinema'));
  assert.deepEqual(cafe, streetTrace('cafe', 10000, true));
  assert.ok(cafe.some(([color, x, y, w]) => color === '#68472f' && x > 200 && y > 210 && w > 100), 'wood counter');
});

test('cafe route and coffee shop have matching anchors', () => {
  assert.equal(STREET_NAMES.cafe, '街角咖啡店');
  assert.deepEqual(neighbors.cafe, ['market', 'cinema']);
  assert.ok(neighbors.market.includes('cafe'));
  assert.ok(neighbors.cinema.includes('cafe'));
  assert.ok(DISTRICT_POS.cafe.every((n, i) => n > 0 && n < [960, 540][i]));
  assert.ok(SHOP_POS.coffee_shop.every((n, i) => n > 0 && n < [960, 540][i]));
});

test('six cafe drinks have individual cup silhouettes and contents; instant coffee stays a canister', () => {
  const ids = ['espresso', 'americano', 'latte', 'cappuccino', 'mocha', 'cold_brew'];
  assert.deepEqual(missingItemArtIds(ids), []);
  const traces = ids.map(itemTrace);
  traces.forEach((trace, i) => assert.ok(trace.length > 5, ids[i]));
  assert.equal(new Set(traces.map(JSON.stringify)).size, ids.length);
  assert.notDeepEqual(itemTrace('coffee'), traces[0]);
});

test('overview cafe draws its own shopfront and illuminated night windows', () => {
  function overviewTrace(slot) {
    const calls = [];
    const c = { fillStyle: '', fillRect(x, y, w, h) { calls.push([this.fillStyle, x, y, w, h]); },
      beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop, fill: noop,
      stroke: noop, setLineDash: noop };
    drawDistrict(c, 'cafe', { slot, weatherKind: 'clear' });
    return calls;
  }
  const day = overviewTrace(1);
  const night = overviewTrace(3);
  const [x, y] = DISTRICT_POS.cafe;
  assert.ok(day.some(([color, left, top, width]) => color === '#8a5c3b' && left >= x - 95 && top < y - 10 && width >= 140), 'distinct warm facade');
  assert.ok(day.some(([color]) => color === '#e3bb72'), 'cup sign and doorway lighting');
  assert.ok(night.some(([color, left, top]) => color === '#f2cf87' && left > x - 80 && top > y - 45), 'lit cafe window at night');
  assert.notDeepEqual(day, night);
});
