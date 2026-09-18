import test from 'node:test';
import assert from 'node:assert/strict';
import { neighbors, StreetJourney } from '../public/ui/street.js';
import { STREET_NAMES, drawStreet } from '../public/ui/street-art.js';
import { STOREFRONTS } from '../public/ui/storefront-art.js';
import { STREET_OBJECTS } from '../public/ui/street-props.js';
import { drawFurnitureOverview, drawFurnitureStoreScene } from '../public/ui/furniture-store-art.js';

const noop = () => {};

function canvasTrace(draw) {
  const pixels = [];
  const c = {
    fillRect: (x, y, w, h) => pixels.push([c.fillStyle, x, y, w, h]),
    fillText: noop, setTransform: noop, beginPath: noop, moveTo: noop, lineTo: noop, fill: noop,
    save: noop, restore: noop, translate: noop, rotate: noop, scale: noop,
  };
  draw(c);
  return pixels;
}

function reachable(from) {
  const seen = new Set([from]);
  const pending = [from];
  while (pending.length) {
    for (const next of neighbors[pending.shift()]) if (!seen.has(next)) { seen.add(next); pending.push(next); }
  }
  return seen;
}

test('furniture district routes from service and recycle', async () => {
  assert.equal(Object.keys(neighbors).length, 10);
  assert.deepEqual(neighbors.furniture, ['service', 'recycle']);
  for (const adjacent of neighbors.furniture) assert.ok(neighbors[adjacent].includes('furniture'), `${adjacent} -> furniture`);
  for (const district of Object.keys(neighbors)) assert.equal(reachable(district).size, 10, `${district} reaches every district`);

  const calls = [];
  for (const origin of ['service', 'recycle']) {
    const journey = new StreetJourney({ onTravel: (actorId, district) => { calls.push([origin, actorId, district]); return true; } });
    journey.setState({ actors: { xuan: { life: 'active', location: origin } } }, 'xuan');
    assert.equal(await journey.travel('furniture'), true, origin);
  }
  assert.deepEqual(calls, [['service', 'xuan', 'furniture'], ['recycle', 'xuan', 'furniture']]);
});

test('furniture route rejects non-neighbor direct walk', async () => {
  const state = { actors: { xuan: { life: 'active', location: 'camp', energy: 10 } } };
  const before = structuredClone(state);
  const journey = new StreetJourney({ onTravel: () => { throw new Error('non-neighbor must not travel'); } });
  journey.setState(state, 'xuan');
  assert.equal(await journey.travel('furniture'), false);
  assert.deepEqual(state, before);
});

test('furniture has a dedicated interior, shop anchor, samples, counter and weather-aware entrance', () => {
  assert.equal(STREET_NAMES.furniture, '家具城');
  assert.equal(STOREFRONTS.furniture_store.name, '营地家具城');
  assert.ok(STREET_OBJECTS.furniture.some((spot) => spot.id === 'passersby'));

  const day = canvasTrace((c) => drawFurnitureStoreScene(c, { night: false, weatherKind: 'clear', tick: 0 }));
  const night = canvasTrace((c) => drawFurnitureStoreScene(c, { night: true, weatherKind: 'rain', tick: 0 }));
  const overviewDay = canvasTrace((c) => drawFurnitureOverview(c, 570, 122, false));
  const overviewNight = canvasTrace((c) => drawFurnitureOverview(c, 570, 122, true));
  const furnitureStreet = canvasTrace((c) => drawStreet(c, { slot: 1, weatherKind: 'clear', actors: {} }, 'furniture', 'xuan', 480, false, 0, true));
  const campStreet = canvasTrace((c) => drawStreet(c, { slot: 1, weatherKind: 'clear', actors: {} }, 'camp', 'xuan', 480, false, 0, true));

  assert.ok(day.length > 260, 'showroom needs real display detail');
  assert.ok(day.some(([color]) => color === '#876a48'), 'wood bed, table and cabinet samples');
  assert.ok(day.some(([color]) => color === '#566c72'), 'sofa sample');
  assert.ok(day.some(([color]) => color === '#d7cbb1'), 'price placards');
  assert.ok(night.some(([color]) => color === '#e3bb72'), 'closed-night lamp glow');
  assert.notDeepEqual(day, night, 'daylight window and night closed entrance differ');
  assert.ok(overviewDay.some(([color]) => color === '#876a48'), 'overview storefront keeps a bed silhouette');
  assert.notDeepEqual(overviewDay, overviewNight, 'overview has a separate night-lit storefront state');
  assert.deepEqual(furnitureStreet, day, 'street branch uses the dedicated showroom');
  assert.notDeepEqual(furnitureStreet, campStreet, 'furniture cannot fall back to camp');
});
