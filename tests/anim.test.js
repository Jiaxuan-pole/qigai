import test from 'node:test';
import assert from 'node:assert/strict';
import * as animation from '../public/ui/animation.js';
import { initMap, setMapState, animateMoves } from '../public/ui/map.js';
const { actionPoseFor, settledActionPoses, actionFrame, walkFrame, easedProgress } = animation;

test('settled action ids select their actual visible pose', () => {
  const cases = {
    bins: 'work', scavenge: 'work', beg: 'beg', phonestall: 'stall', shellgame: 'stall',
    repair: 'repair', repair_item: 'repair', sketch: 'sketch', graffiti: 'paint',
    wash: 'wash', bath: 'wash', laundry: 'wash', rest: 'rest', warm: 'rest',
    kitchen: 'carry', carry: 'carry', run: 'carry', freecards: 'sit',
  };
  for (const [id, pose] of Object.entries(cases)) assert.equal(actionPoseFor(id), pose, id);
  assert.equal(actionPoseFor('unknown'), 'stand');
});

test('arrival poses come from the executed task snapshot, not the advanced slot', () => {
  const state = { slot: 2, plan: { xuan: [{ id: 'rest' }, { id: 'repair' }, { id: 'beg' }] }, actors: { xuan: { life: 'active' }, fan: { life: 'downed' } } };
  assert.deepEqual(settledActionPoses(state, { xuan: { id: 'repair' }, fan: { id: 'work' } }), { xuan: 'repair' });
  assert.deepEqual(settledActionPoses(state, { xuan: { id: 'beg', style: 'perform' } }), { xuan: 'sketch' });
  assert.deepEqual(settledActionPoses(state, {}), {});
});

test('scene time freezes for reduced motion and action snapshots expire at a new turn', () => {
  assert.equal(animation.sceneTick(1667, false), 100);
  assert.equal(animation.sceneTick(99999, true), 0);
  assert.equal(animation.changedTurn({ seed: 1, turn: 2 }, { seed: 1, turn: 2 }), false);
  assert.equal(animation.changedTurn({ seed: 1, turn: 2 }, { seed: 1, turn: 3 }), true);
  assert.equal(animation.changedTurn({ seed: 1, turn: 2 }, { seed: 2, turn: 2 }), true);
});

test('hourly progress expires poses within the same survival tick and sleep lies down', () => {
  assert.equal(animation.changedTurn({ seed: 1, turn: 2, hourTick: 8 }, { seed: 1, turn: 2, hourTick: 9 }), true);
  assert.equal(animation.changedTurn({ seed: 1, turn: 2, hourTick: 8 }, { seed: 1, turn: 2, hourTick: 8 }), false);
  assert.equal(actionPoseFor('sleep'), 'rest');
});

test('walking uses elapsed milliseconds, eases at endpoints, and stops at arrival', () => {
  assert.equal(walkFrame(0), 'walk0');
  assert.equal(walkFrame(110), 'walk1');
  assert.equal(walkFrame(220), 'walk2');
  assert.equal(walkFrame(330), 'walk3');
  assert.equal(walkFrame(440), 'walk0');
  assert.equal(easedProgress(100, 100, 680), 0);
  assert.ok(easedProgress(200, 100, 680) < 100 / 680);
  assert.equal(easedProgress(780, 100, 680), 1);
  assert.equal(easedProgress(900, 100, 680), 1);
  assert.equal(actionFrame('repair', 0), 'repair0');
  assert.equal(actionFrame('repair', 280), 'repair1');
});

test('reduced motion holds one action frame and places walk immediately', () => {
  assert.equal(walkFrame(330, true), 'stand');
  assert.equal(actionFrame('wash', 280, true), 'wash0');
  assert.equal(actionFrame('sit', 280, true), 'sit');
});

test('map exposes actual arrival poses and clears them on a new turn', () => {
  const oldDocument = globalThis.document, oldRaf = globalThis.requestAnimationFrame, oldMatch = globalThis.matchMedia;
  const pixels = [];
  const noop = () => {};
  const c = { fillRect: (x, y, w, h) => pixels.push([x, y, w, h]), save: noop, restore: noop, translate: noop, scale: noop, setTransform: noop, beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop, fill: noop, stroke: noop, fillText: noop, setLineDash: noop };
  const canvas = { dataset: {}, getContext: () => c };
  let frame;
  globalThis.document = { getElementById: () => canvas };
  globalThis.requestAnimationFrame = (cb) => { frame = cb; return 1; };
  globalThis.matchMedia = () => ({ matches: true });
  const state = { seed: 1, turn: 2, slot: 1, weatherKind: 'rain', camp: { rain: 1, beds: 2 }, art: 0, actors: { xuan: { life: 'active', location: 'station' }, fan: { life: 'unrecruited', location: 'camp' }, ma: { life: 'unrecruited', location: 'camp' } } };
  try {
    initMap({});
    setMapState(state, { xuan: { id: 'run' } });
    frame();
    assert.equal(JSON.parse(canvas.dataset.poses).xuan, 'carry0');
    const first = JSON.stringify(pixels);
    pixels.length = 0;
    frame();
    assert.equal(JSON.stringify(pixels), first, 'rain must stay fixed in reduced motion');
    setMapState({ ...state, turn: 3 });
    frame();
    assert.equal(JSON.parse(canvas.dataset.poses).xuan, 'stand');
  } finally {
    globalThis.document = oldDocument;
    globalThis.requestAnimationFrame = oldRaf;
    globalThis.matchMedia = oldMatch;
  }
});

test('replacing a one-segment move cannot let its timeout settle a later two-segment move', async () => {
  const oldSet = globalThis.setTimeout, oldClear = globalThis.clearTimeout, oldMatch = globalThis.matchMedia;
  const timers = new Map();
  let nextTimer = 0;
  globalThis.setTimeout = (fn, delay) => { const id = ++nextTimer; timers.set(id, { fn, delay, cleared: false }); return id; };
  globalThis.clearTimeout = (id) => { timers.get(id).cleared = true; };
  globalThis.matchMedia = () => ({ matches: false });
  const state = { seed: 70, turn: 1, actors: { xuan: { life: 'active', location: 'service' } } };
  try {
    let firstDone = false, secondDone = false;
    const first = animateMoves(state, [{ actorId: 'xuan', from: 'camp', to: 'market' }]);
    first.then(() => { firstDone = true; });
    const second = animateMoves(state, [{ actorId: 'xuan', from: 'camp', to: 'service' }]);
    second.then(() => { secondDone = true; });
    await Promise.resolve();
    assert.equal(firstDone, true, 'cancelled visual move must settle its caller');
    assert.equal(timers.get(1).cleared, true);
    assert.equal(timers.get(1).delay, 1650);
    assert.equal(timers.get(2).delay, 2500);
    timers.get(1).fn();
    await Promise.resolve();
    assert.equal(secondDone, false, 'stale timer must not settle the new animation');
    timers.get(2).fn();
    await second;
    assert.equal(secondDone, true);
    await first;
  } finally {
    globalThis.setTimeout = oldSet;
    globalThis.clearTimeout = oldClear;
    globalThis.matchMedia = oldMatch;
  }
});

test('changing session during a move settles and cancels the old animation', async () => {
  const oldSet = globalThis.setTimeout, oldClear = globalThis.clearTimeout, oldMatch = globalThis.matchMedia;
  const timers = new Map();
  let nextTimer = 0;
  globalThis.setTimeout = (fn) => { const id = ++nextTimer; timers.set(id, { fn, cleared: false }); return id; };
  globalThis.clearTimeout = (id) => { timers.get(id).cleared = true; };
  globalThis.matchMedia = () => ({ matches: false });
  const state = { seed: 71, turn: 2, actors: { xuan: { life: 'active', location: 'service' } } };
  try {
    let done = false;
    const moving = animateMoves(state, [{ actorId: 'xuan', from: 'camp', to: 'service' }]);
    moving.then(() => { done = true; });
    const nextState = { ...state, seed: 72, turn: 0, actors: { xuan: { life: 'active', location: 'camp' } } };
    setMapState(nextState);
    await Promise.resolve();
    assert.equal(done, true);
    assert.equal(timers.get(1).cleared, true);
    await moving;
    let nextDone = false;
    const nextMove = animateMoves(nextState, [{ actorId: 'xuan', from: 'camp', to: 'market' }]);
    nextMove.then(() => { nextDone = true; });
    timers.get(1).fn();
    await Promise.resolve();
    assert.equal(nextDone, false, 'previous session timer cannot settle the new session');
    timers.get(2).fn();
    await nextMove;
    assert.equal(nextDone, true);
  } finally {
    globalThis.setTimeout = oldSet;
    globalThis.clearTimeout = oldClear;
    globalThis.matchMedia = oldMatch;
  }
});
