import test from 'node:test';
import assert from 'node:assert/strict';
import { neighbors, walkStep, StreetJourney } from '../public/ui/street.js';
import { drawStreet, STREET_NAMES } from '../public/ui/street-art.js';
import { initMap, setMapState, setActorPose, setMapMode, viewStreet } from '../public/ui/map.js';

test('ten districts have reciprocal exits including the river bank, cafe and furniture city', () => {
  assert.equal(Object.keys(neighbors).length, 10);
  assert.deepEqual(neighbors.river, ['camp', 'market']);
  assert.deepEqual(neighbors.cafe, ['market', 'cinema']);
  for (const [from, exits] of Object.entries(neighbors)) {
    for (const to of exits) assert.ok(neighbors[to].includes(from), `${from} -> ${to}`);
  }
});

test('direct walking stays within the street and only exposes exits at an edge', () => {
  assert.deepEqual(walkStep(480, -1, 16), { x: 464, edge: null });
  assert.deepEqual(walkStep(80, -1, 16), { x: 80, edge: 'left' });
  assert.deepEqual(walkStep(880, 1, 16), { x: 880, edge: 'right' });
  assert.deepEqual(walkStep(1490, 1, 30, 1600, 116), { x: 1484, edge: 'right' });
});

test('travel rejects non-neighbors and never changes the supplied state', async () => {
  const state = Object.freeze({ actors: Object.freeze({ xuan: Object.freeze({ life: 'active', location: 'camp' }) }) });
  const calls = [];
  const journey = new StreetJourney({ onTravel: (...args) => { calls.push(args); return true; } });
  journey.setState(state, 'xuan');
  assert.equal(await journey.travel('cinema'), false);
  assert.equal(await journey.travel('river'), true);
  assert.deepEqual(calls, [['xuan', 'river']]);
  assert.equal(state.actors.xuan.location, 'camp');
});

test('transition settles and stale transition cannot clear a newer one', async () => {
  const timers = [];
  const journey = new StreetJourney({}, { setTimer: (fn) => { timers.push(fn); return timers.length; }, clearTimer: () => {} });
  const first = journey.transition('market');
  const second = journey.transition('river');
  assert.equal(await first, false);
  timers[0]();
  assert.equal(journey.transitionName, 'river');
  timers[1]();
  assert.equal(await second, true);
  assert.equal(journey.transitionName, null);
});

test('leaving the street cancels pending transition work', async () => {
  let cancelled = false;
  const journey = new StreetJourney({}, { setTimer: () => 1, clearTimer: () => { cancelled = true; } });
  const pending = journey.transition('market');
  journey.cancel();
  assert.equal(await pending, false);
  assert.equal(cancelled, true);
  assert.equal(journey.transitionName, null);
});

test('each district draws a distinct live street scene including river water', () => {
  const signatures = new Set();
  for (const district of Object.keys(neighbors)) {
    const pixels = [];
    const noop = () => {};
    const c = { fillRect: (...args) => pixels.push([c.fillStyle, ...args]), save: noop, restore: noop, translate: noop, scale: noop, setTransform: noop, beginPath: noop, moveTo: noop, lineTo: noop, fill: noop, fillText: noop };
    const state = { slot: 1, weatherKind: 'rain', actors: { xuan: { life: 'active', location: district } } };
    drawStreet(c, state, district, 'xuan', 480, true, 250, false);
    assert.ok(pixels.length > 90, district);
    assert.ok(STREET_NAMES[district]);
    signatures.add(JSON.stringify(pixels));
    if (district === 'river') assert.ok(pixels.some(([color]) => color === '#587c83'));
  }
  assert.equal(signatures.size, Object.keys(neighbors).length);
});

test('street canvas draws settled poses and each real companion in this district', () => {
  const noop = () => {};
  const c = { fillRect: noop, save: noop, restore: noop, translate: noop, scale: noop, setTransform: noop, beginPath: noop, moveTo: noop, lineTo: noop, fill: noop, fillText: noop };
  const state = { slot: 1, weatherKind: 'clear', actors: { xuan: { life: 'active', location: 'river' }, fan: { life: 'active', location: 'river' }, ma: { life: 'active', location: 'camp' } } };
  assert.deepEqual(drawStreet(c, state, 'river', 'xuan', 480, false, 2500, false, { xuan: 'fish', fan: 'work' }), { xuan: 'fish2', fan: 'work0' });
  assert.deepEqual(drawStreet(c, state, 'river', 'xuan', 480, true, 2500, false, { xuan: 'fish', fan: 'work' }), { xuan: 'walk2', fan: 'work0' });
});

test('camp street renders settled action, companion and temporary night sitting', () => {
  const prior = { document: globalThis.document, requestAnimationFrame: globalThis.requestAnimationFrame, matchMedia: globalThis.matchMedia };
  const noop = () => {};
  const c = { fillRect: noop, clearRect: noop, save: noop, restore: noop, translate: noop, scale: noop, setTransform: noop, beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop, fill: noop, stroke: noop, fillText: noop, setLineDash: noop };
  const canvas = { dataset: {}, getContext: () => c };
  const control = { addEventListener: noop, setAttribute: noop };
  const elements = { map: canvas, street: { ...canvas, dataset: {} }, streetControls: control, overviewMode: control, streetMode: control, streetDistrict: { ...control, value: 'camp' }, mapWrap: { classList: { toggle: noop } }, streetStatus: {}, streetExits: { replaceChildren: noop }, streetOverlay: { querySelectorAll: () => [] } };
  let frame;
  globalThis.document = { getElementById: (id) => elements[id] || null };
  globalThis.requestAnimationFrame = (callback) => { frame = callback; return 1; };
  globalThis.matchMedia = () => ({ matches: true });
  const state = { seed: 31, turn: 4, slot: 2, weatherKind: 'clear', camp: { rain: 1, beds: 2 }, art: 0, actors: { xuan: { life: 'active', location: 'camp' }, fan: { life: 'active', location: 'camp' }, ma: { life: 'unrecruited', location: 'camp' } } };
  try {
    initMap({});
    viewStreet('camp');
    setMapState(state, { xuan: { id: 'fish' }, fan: { id: 'scavenge' } });
    frame();
    assert.deepEqual(JSON.parse(elements.street.dataset.poses), { xuan: 'fish0', fan: 'work0' });
    setActorPose('xuan', 'sit');
    frame();
    assert.deepEqual(JSON.parse(elements.street.dataset.poses), { xuan: 'sit', fan: 'work0' });
  } finally {
    globalThis.document = prior.document;
    globalThis.requestAnimationFrame = prior.requestAnimationFrame;
    globalThis.matchMedia = prior.matchMedia;
  }
});

for (const blocker of ['.fishing-qte-overlay', '#plannerOverlay:not([hidden])']) test(`${blocker} blocks map keyboard mode toggle`, () => {
  const previous = { document: globalThis.document, window: globalThis.window, requestAnimationFrame: globalThis.requestAnimationFrame };
  let keydown;
  let overlay = true;
  const noop = () => {};
  const context = { setTransform: noop, clearRect: noop, save: noop, restore: noop, translate: noop, fillRect: noop, beginPath: noop, moveTo: noop, lineTo: noop, fill: noop, fillText: noop };
  const canvas = { getContext: () => context, dataset: {} };
  const wrap = { classList: { toggle: (_, active) => { wrap.streetView = active; } } };
  const control = { addEventListener: noop, setAttribute: noop };
  const elements = { map: canvas, street: canvas, mapWrap: wrap, streetControls: control, overviewMode: control, streetMode: control, streetDistrict: control, streetExits: { replaceChildren: noop } };
  globalThis.document = { getElementById: (id) => elements[id] ?? null, querySelector: (selector) => overlay && selector.includes(blocker) ? {} : null };
  globalThis.window = { addEventListener: (name, callback) => { if (name === 'keydown') keydown = callback; } };
  globalThis.requestAnimationFrame = noop;
  try {
    initMap({});
    setMapState({ actors: { xuan: { life: 'active', location: 'camp', energy: 10 } } });
    setMapMode('street');
    let prevented = false;
    keydown({ key: 'm', target: { closest: () => null }, preventDefault: () => { prevented = true; } });
    assert.equal(prevented, false);
    assert.equal(wrap.streetView, true);
    overlay = false;
    keydown({ key: 'm', target: { closest: () => null }, preventDefault: () => { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(wrap.streetView, false);
  } finally {
    globalThis.document = previous.document;
    globalThis.window = previous.window;
    globalThis.requestAnimationFrame = previous.requestAnimationFrame;
  }
});
