import test from 'node:test';
import assert from 'node:assert/strict';
import { animateMoves, initMap, routeFor, setMapMode, setMapState, travelFromOverview, updateOverlay, viewStreet } from '../public/ui/map.js';

function classList() {
  const values = new Set();
  return { add: (name) => values.add(name), remove: (name) => values.delete(name), toggle: (name, on) => on ? values.add(name) : values.delete(name), contains: (name) => values.has(name) };
}

function canvas() {
  const noop = () => {};
  const context = { fillRect: noop, clearRect: noop, save: noop, restore: noop, translate: noop, scale: noop, setTransform: noop, beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop, fill: noop, stroke: noop, fillText: noop, setLineDash: noop };
  return { dataset: {}, getContext: () => context };
}

class Overlay {
  set innerHTML(value) {
    this.html = value;
    this.travelButtons = [...value.matchAll(/data-travel-district="([^"]+)"/g)].map(([, district]) => ({ dataset: { travelDistrict: district } }));
  }
  querySelectorAll(selector) {
    return selector === '[data-travel-district]' ? this.travelButtons : [];
  }
}

test('overview travel invokes the shared handler and only shows a black arrival curtain after success', async () => {
  const prior = { document: globalThis.document, requestAnimationFrame: globalThis.requestAnimationFrame, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout, matchMedia: globalThis.matchMedia };
  const timers = [];
  const mapOverlay = new Overlay();
  const streetOverlay = { querySelectorAll: () => [] };
  const transition = { classList: classList(), textContent: '' };
  const control = { addEventListener: () => {}, setAttribute: () => {} };
  const elements = {
    map: canvas(), street: canvas(), mapOverlay, streetOverlay, streetTransition: transition,
    mapWrap: { classList: classList() }, streetControls: control, overviewMode: control, streetMode: control,
    streetDistrict: { ...control, value: 'camp', innerHTML: '' }, streetStatus: {}, streetExits: { replaceChildren: () => {} },
  };
  let success = false;
  const calls = [];
  globalThis.document = { getElementById: (id) => elements[id] || null, hidden: false, querySelector: () => null };
  globalThis.requestAnimationFrame = () => 1;
  globalThis.matchMedia = () => ({ matches: false });
  globalThis.setTimeout = (fn, ms) => { const timer = { fn, ms, cleared: false }; timers.push(timer); return timer; };
  globalThis.clearTimeout = (timer) => { timer.cleared = true; };
  const state = { day: 1, turn: 1, slot: 0, weatherKind: 'clear', items: [], actors: { xuan: { life: 'active', location: 'camp', energy: 4 } } };
  const districts = [{ id: 'camp', name: '旧桥营地' }, { id: 'market', name: '老街早夜市' }, { id: 'service', name: '公共服务站街区' }];
  try {
    initMap({ onTravel: (actorId, district) => { calls.push([actorId, district]); return success; } });
    setMapMode('overview');
    setMapState(state);
    updateOverlay(state, { actor: 'xuan', zone: null }, [], districts, []);

    assert.match(mapOverlay.html, /data-travel-district="market"/, 'adjacent district exposes a real travel control');
    assert.match(mapOverlay.html, /data-travel-district="service"/, 'a reachable non-neighbor exposes a routed travel control');
    const travel = mapOverlay.travelButtons.find((button) => button.dataset.travelDistrict === 'market');
    await travel.onclick();
    assert.deepEqual(calls, [['xuan', 'market']]);
    assert.equal(transition.classList.contains('active'), false, 'failed engine travel never flashes a success curtain');

    success = true;
    const arriving = travel.onclick();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(transition.classList.contains('active'), true, 'successful travel covers the map before arrival reveal');
    assert.equal(timers.at(-1).ms, 860, 'black arrival curtain holds long enough to read the street name');
    setMapMode('overview');
    await arriving;
    assert.equal(transition.classList.contains('active'), false, 'cancelling the view clears an active black curtain');
    assert.equal(timers.at(-1).cleared, true);

    globalThis.matchMedia = () => ({ matches: true });
    await travel.onclick();
    assert.match(transition.innerHTML, /老街早夜市/, 'reduced motion still names the arrived street');
    assert.equal(transition.classList.contains('active'), false, 'reduced motion resolves without leaving a black curtain behind');
  } finally {
    globalThis.document = prior.document;
    globalThis.requestAnimationFrame = prior.requestAnimationFrame;
    globalThis.setTimeout = prior.setTimeout;
    globalThis.clearTimeout = prior.clearTimeout;
    globalThis.matchMedia = prior.matchMedia;
  }
});

test('scheduled street travel walks out, holds the black name curtain, then walks into the settled action', async () => {
  const prior = { document: globalThis.document, requestAnimationFrame: globalThis.requestAnimationFrame, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout, matchMedia: globalThis.matchMedia };
  const timers = [];
  let frame;
  const transition = { classList: classList(), innerHTML: '' };
  const control = { addEventListener: () => {}, setAttribute: () => {} };
  const elements = {
    map: canvas(), street: canvas(), streetTransition: transition, mapWrap: { classList: classList() },
    streetControls: control, overviewMode: control, streetMode: control, streetDistrict: { ...control, value: 'camp' },
    streetStatus: {}, streetExits: { replaceChildren: () => {} }, streetOverlay: { querySelectorAll: () => [] },
  };
  globalThis.document = { getElementById: (id) => elements[id] || null, hidden: false, querySelector: () => null };
  globalThis.requestAnimationFrame = (callback) => { frame = callback; return 1; };
  globalThis.matchMedia = () => ({ matches: false });
  globalThis.setTimeout = (fn, ms) => { const timer = { fn, ms, cleared: false }; timers.push(timer); return timer; };
  globalThis.clearTimeout = (timer) => { timer.cleared = true; };
  const state = { seed: 77, turn: 2, day: 1, slot: 1, weatherKind: 'clear', camp: { rain: 1, beds: 2 }, art: 0, items: [], actors: { xuan: { life: 'active', location: 'market', energy: 4 } } };
  try {
    initMap({});
    viewStreet('camp');
    setMapState(state);
    const moving = animateMoves(state, [{ actorId: 'xuan', from: 'camp', to: 'market' }], { xuan: { id: 'scavenge' } });
    frame();
    assert.match(JSON.parse(elements.street.dataset.poses).xuan, /^walk/, 'departure is visibly a walk, not an immediate black cut');
    timers[0].fn();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(transition.classList.contains('active'), true, 'the street name curtain starts after the departure walk');
    timers[1].fn();
    await Promise.resolve();
    await Promise.resolve();
    frame();
    assert.match(JSON.parse(elements.street.dataset.poses).xuan, /^walk/, 'arrival walks from the street edge toward the work point');
    timers[2].fn();
    await moving;
    frame();
    assert.match(JSON.parse(elements.street.dataset.poses).xuan, /^work/, 'the existing action pose resumes only after arriving at the work point');
  } finally {
    globalThis.document = prior.document;
    globalThis.requestAnimationFrame = prior.requestAnimationFrame;
    globalThis.setTimeout = prior.setTimeout;
    globalThis.clearTimeout = prior.clearTimeout;
    globalThis.matchMedia = prior.matchMedia;
  }
});

test('route planning uses river-aware BFS and rejects insufficient energy before mutating state', () => {
  const state = Object.freeze({ actors: Object.freeze({ xuan: Object.freeze({ life: 'active', location: 'camp', energy: 4 }) }) });
  assert.deepEqual(routeFor(state, 'xuan', 'service'), { steps: ['recycle', 'service'], cost: 4 });
  const tired = Object.freeze({ actors: Object.freeze({ xuan: Object.freeze({ life: 'active', location: 'camp', energy: 3 }) }) });
  assert.match(routeFor(tired, 'xuan', 'service').error, /需要4点体力/);
  assert.equal(tired.actors.xuan.location, 'camp');
});

test('a route stops at the last accepted edge when a later onTravel call rejects', async () => {
  const prior = { document: globalThis.document, requestAnimationFrame: globalThis.requestAnimationFrame, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout, matchMedia: globalThis.matchMedia };
  const timers = [];
  const transition = { classList: classList(), innerHTML: '' };
  const control = { addEventListener: () => {}, setAttribute: () => {} };
  const elements = { map: canvas(), street: canvas(), streetTransition: transition, mapWrap: { classList: classList() }, streetControls: control, overviewMode: control, streetMode: control, streetDistrict: { ...control, value: 'camp' }, streetStatus: {}, streetExits: { replaceChildren: () => {} }, streetOverlay: { querySelectorAll: () => [] } };
  let current = { day: 1, turn: 1, slot: 0, weatherKind: 'clear', items: [], actors: { xuan: { life: 'active', location: 'camp', energy: 8 } } };
  const calls = [];
  globalThis.document = { getElementById: (id) => elements[id] || null, hidden: false, querySelector: () => null };
  globalThis.requestAnimationFrame = () => 1;
  globalThis.matchMedia = () => ({ matches: false });
  globalThis.setTimeout = (fn, ms) => { const timer = { fn, ms, cleared: false }; timers.push(timer); return timer; };
  globalThis.clearTimeout = (timer) => { timer.cleared = true; };
  try {
    initMap({ onTravel: (actorId, district) => {
      calls.push([actorId, district]);
      if (district === 'service') return false;
      current = { ...current, actors: { ...current.actors, [actorId]: { ...current.actors[actorId], location: district, energy: current.actors[actorId].energy - 2 } } };
      setMapState(current);
      return true;
    } });
    setMapMode('overview');
    setMapState(current);
    const route = travelFromOverview('service');
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(transition.classList.contains('active'), true);
    timers[0].fn();
    await route;
    assert.deepEqual(calls, [['xuan', 'recycle'], ['xuan', 'service']]);
    assert.equal(current.actors.xuan.location, 'recycle');
    assert.equal(current.actors.xuan.energy, 6);
  } finally {
    globalThis.document = prior.document;
    globalThis.requestAnimationFrame = prior.requestAnimationFrame;
    globalThis.setTimeout = prior.setTimeout;
    globalThis.clearTimeout = prior.clearTimeout;
    globalThis.matchMedia = prior.matchMedia;
  }
});

test('M toggles map views but is ignored from editable, modal, tutorial, and intro surfaces', () => {
  const prior = { document: globalThis.document, window: globalThis.window, requestAnimationFrame: globalThis.requestAnimationFrame, matchMedia: globalThis.matchMedia };
  let keydown;
  const control = { addEventListener: () => {}, setAttribute: () => {} };
  const wrap = { classList: classList() };
  const elements = { map: canvas(), street: canvas(), mapWrap: wrap, streetControls: control, overviewMode: control, streetMode: control, streetDistrict: control, streetStatus: {}, streetExits: { replaceChildren: () => {} } };
  globalThis.document = { getElementById: (id) => elements[id] || null, querySelector: () => null };
  globalThis.window = { addEventListener: (type, listener) => { if (type === 'keydown') keydown = listener; } };
  globalThis.requestAnimationFrame = () => 1;
  globalThis.matchMedia = () => ({ matches: false });
  try {
    initMap({});
    setMapState({ actors: { xuan: { life: 'active', location: 'camp', energy: 4 } } });
    const blocked = { preventDefault: () => assert.fail('blocked M must not handle the event'), key: 'm', target: { closest: () => ({}) } };
    keydown(blocked);
    assert.equal(wrap.classList.contains('street-view'), true);
    let prevented = false;
    keydown({ preventDefault: () => { prevented = true; }, key: 'M', target: { closest: () => null } });
    assert.equal(prevented, true);
    assert.equal(wrap.classList.contains('street-view'), false);
  } finally {
    globalThis.document = prior.document;
    globalThis.window = prior.window;
    globalThis.requestAnimationFrame = prior.requestAnimationFrame;
    globalThis.matchMedia = prior.matchMedia;
  }
});
