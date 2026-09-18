import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { neighbors, StreetJourney } from '../public/ui/street.js';
import { drawStreet, STREET_NAMES } from '../public/ui/street-art.js';
import { DISTRICT_POS, initMap, routeFor, setMapState, setNightExploration, updateOverlay } from '../public/ui/map.js';

const data = JSON.parse(await readFile(new URL('../03_开发数据_商店物品愿望事件100日.json', import.meta.url)));

test('cardhall scene has door hotspot and reciprocal routes', async () => {
  assert.equal(data.districts.length, 10);
  assert.equal(STREET_NAMES.cardhall, '棋牌馆');
  assert.deepEqual(neighbors.cardhall, ['station', 'cinema']);
  for (const id of neighbors.cardhall) assert.ok(neighbors[id].includes('cardhall'));
  assert.ok(DISTRICT_POS.cardhall);
  const state = { actors: { xuan: { life: 'active', location: 'station', energy: 10 } } };
  assert.deepEqual(routeFor(state, 'xuan', 'cardhall'), { steps: ['cardhall'], cost: 2 });
  state.actors.xuan.location = 'cinema';
  assert.deepEqual(routeFor(state, 'xuan', 'cardhall'), { steps: ['cardhall'], cost: 2 });
});

test('cardhall rejects nonneighbor direct travel', async () => {
  const state = { actors: { xuan: { life: 'active', location: 'camp', energy: 10 } } };
  let calls = 0;
  const journey = new StreetJourney({ onTravel: () => { calls++; return true; } });
  journey.setState(state, 'xuan');
  assert.equal(await journey.travel('cardhall'), false);
  assert.equal(calls, 0);
  assert.deepEqual(state.actors.xuan, { life: 'active', location: 'camp', energy: 10 });
});

test('cardhall canvas has three material tables, distinct hall guests and a door', () => {
  const pixels = [];
  const noop = () => {};
  const c = { fillRect: (x, y, w, h) => pixels.push([c.fillStyle, x, y, w, h]), setTransform: noop, beginPath: noop, moveTo: noop, lineTo: noop, fill: noop, fillText: noop, save: noop, restore: noop, translate: noop, scale: noop };
  const state = { slot: 2, weatherKind: 'clear', actors: {} };
  assert.deepEqual(drawStreet(c, state, 'cardhall', 'xuan', 480, false, 0, true), {});
  assert.ok(pixels.filter(([color]) => color === '#267056').length >= 3);
  assert.ok(pixels.some(([color]) => color === '#e6dfcc'));
  assert.ok(pixels.some(([color]) => color === '#d9a577'));
  assert.ok(pixels.length > 150);
});

test('map title derives the design-data district total and entrance is keyboard focusable', () => {
  const previous = { document: globalThis.document, requestAnimationFrame: globalThis.requestAnimationFrame };
  const noop = () => {};
  const canvas = { getContext: () => ({ imageSmoothingEnabled: false }), dataset: {} };
  const overlay = { innerHTML: '', querySelectorAll: () => [] };
  const control = { addEventListener: noop, setAttribute: noop, classList: { toggle: noop } };
  const elements = { map: canvas, street: canvas, mapOverlay: overlay, streetOverlay: overlay, mapTitle: {}, mapWrap: control, streetControls: control, streetDistrict: { ...control, value: '' }, overviewMode: control, streetMode: control, streetExits: { replaceChildren: noop } };
  globalThis.document = { getElementById: (id) => elements[id] ?? null };
  globalThis.requestAnimationFrame = noop;
  const actors = { xuan: { life: 'active', location: 'cardhall', energy: 10 }, fan: { life: 'active', location: 'station', energy: 10 }, ma: { life: 'unrecruited', location: 'camp', energy: 10 } };
  const state = { actors, day: 1, items: [], slot: 2 };
  try {
    initMap({ onSpot: noop });
    setMapState(state);
    updateOverlay(state, { actor: 'xuan', zone: 'cardhall' }, [], data.districts, []);
    setNightExploration(null);
    assert.equal(elements.mapTitle.textContent, `雾城 · ${data.districts.length}个街区`);
    assert.match(overlay.innerHTML, /data-spot="cardhall"/);
    assert.match(overlay.innerHTML, /入馆选桌 · 1小时 · 未下注/);
    assert.doesNotMatch(overlay.innerHTML, /tabindex="-1"/);
  } finally {
    globalThis.document = previous.document;
    globalThis.requestAnimationFrame = previous.requestAnimationFrame;
  }
});
