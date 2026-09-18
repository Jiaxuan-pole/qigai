import test from 'node:test';
import assert from 'node:assert/strict';
import * as movement from '../public/ui/street.js';
import * as animation from '../public/ui/animation.js';
import * as map from '../public/ui/map.js';
import { streetSprite } from '../public/ui/street-people.js';

test('four-direction walking bounds both axes and preserves horizontal facing on vertical steps', () => {
  assert.equal(typeof movement.walkStreetPosition, 'function');
  const original = { district: 'market', x: 400, y: 440, facing: 1 };
  const left = movement.walkStreetPosition(original, { x: -1, y: 0 }, 20);
  assert.deepEqual(left, { ...original, x: 380, facing: -1, edge: null });
  const up = movement.walkStreetPosition(left, { x: 0, y: -1 }, 20);
  assert.equal(up.y, 420);
  assert.equal(up.facing, -1);
  const bottom = movement.walkStreetPosition(original, { x: 0, y: 1 }, 1000);
  assert.ok(bottom.y <= 516 && bottom.y > 440);
  const top = movement.walkStreetPosition(original, { x: 0, y: -1 }, 1000);
  assert.ok(top.y >= 390 && top.y < 440);
  assert.deepEqual(original, { district: 'market', x: 400, y: 440, facing: 1 });
});

test('street positions preserve each actor independently until an actual district change', () => {
  assert.equal(typeof movement.syncStreetPositions, 'function');
  const original = { xuan: { district: 'camp', x: 300, y: 480, facing: -1 }, fan: { district: 'camp', x: 900, y: 410, facing: 1 } };
  const same = movement.syncStreetPositions(original, { xuan: { location: 'camp' }, fan: { location: 'camp' } });
  assert.deepEqual(same, original);
  const changed = movement.syncStreetPositions(original, { xuan: { location: 'market' }, fan: { location: 'camp' } });
  assert.equal(changed.xuan.district, 'market');
  assert.deepEqual(changed.fan, original.fan);
  assert.equal(original.xuan.district, 'camp');
});

test('known consumed items select real poses and equipment does not pretend to be consumed', () => {
  assert.equal(typeof animation.itemPoseFor, 'function');
  for (const id of ['cigarette', 'cigarette_regular', 'cigarette_premium', 'butts']) assert.equal(animation.itemPoseFor(id), 'smoke');
  for (const id of ['beer', 'spirit', 'beer_bottle', 'baijiu', 'vodka']) assert.equal(animation.itemPoseFor(id), 'drink');
  for (const id of ['tea', 'coffee', 'soda', 'latte']) assert.equal(animation.itemPoseFor(id), 'sip');
  for (const id of ['meal', 'bread', 'fish_common_cooked']) assert.equal(animation.itemPoseFor(id), 'eat');
  assert.equal(animation.itemPoseFor('paint'), 'paint');
  assert.equal(animation.itemPoseFor('phone'), 'phone');
  assert.equal(animation.itemPoseFor('fishing_rod'), null);
  assert.equal(animation.actionPoseFor('graffiti'), 'paint');
});

function pixels(pose, facing = 1) {
  const rects = [], stack = [];
  const c = {
    fillStyle: '', x: 0, y: 0, sx: 1, sy: 1,
    save() { stack.push([this.x, this.y, this.sx, this.sy]); },
    restore() { [this.x, this.y, this.sx, this.sy] = stack.pop(); },
    translate(x, y) { this.x += x * this.sx; this.y += y * this.sy; },
    scale(x, y) { this.sx *= x; this.sy *= y; },
    fillRect(x, y, w, h) { rects.push([this.x + x * this.sx, this.y + y * this.sy, w * this.sx, h * this.sy, this.fillStyle]); },
  };
  streetSprite(c, 100, 50, 'xuan', 2, pose, facing);
  return rects;
}

test('street silhouette mirrors around its body center when facing left', () => {
  for (const pose of ['walk1', 'smoke1']) {
    const right = pixels(pose), left = pixels(pose, -1);
    assert.notDeepEqual(right, left);
    for (let i = 0; i < right.length; i++) {
      assert.equal(left[i][0], 248 - right[i][0]);
      assert.equal(left[i][2], -right[i][2]);
      assert.equal(left[i][4], right[i][4]);
    }
  }
});

test('drinking, eating and wall painting animate hands and visible props', () => {
  for (const pose of ['drink', 'eat', 'paint']) {
    assert.notDeepEqual(pixels(`${pose}0`), pixels('stand'), `${pose} needs a visible action`);
    assert.notDeepEqual(pixels(`${pose}0`), pixels(`${pose}1`), `${pose} needs changing frames`);
  }
});

test('walking has a visible side profile and every detailed action has three distinct stages', () => {
  const eyes = pose => pixels(pose).filter(rect => rect[4] === '#1c2026');
  assert.equal(eyes('stand').length, 2);
  assert.equal(eyes('walk1').length, 1, 'side profile shows the eye on the forward side');
  for (const pose of ['smoke', 'drink', 'sip', 'paint', 'fish']) {
    assert.equal(new Set([0, 1, 2].map(frame => JSON.stringify(pixels(`${pose}${frame}`)))).size, 3, `${pose} stages must alter actual pixels`);
  }
  assert.ok(pixels('drink0').some(rect => rect[4] === '#436b45'), 'alcohol uses a visible green bottle');
  assert.ok(pixels('sip0').some(rect => rect[4] === '#d7cbb1'), 'coffee and tea use a cup');
  assert.deepEqual([0, 800, 1700].map(now => animation.actionFrame('smoke', now)), ['smoke0', 'smoke1', 'smoke2']);
});

test('fighting and unresolved combat results block new street routes', () => {
  for (const phase of ['fighting', 'resolved']) {
    const state = { phase: 'planning', actors: { xuan: { life: 'active', location: 'camp', energy: 80 } }, pending: { combat: { phase } } };
    assert.match(map.routeFor(state, 'xuan', 'market').error, /当前待办/);
  }
});

function scene(t) {
  const before = Object.fromEntries(['document', 'window', 'requestAnimationFrame', 'matchMedia', 'performance'].map(key => [key, globalThis[key]]));
  const noop = () => {}, keys = {}, touches = {};
  const c = { fillRect: noop, clearRect: noop, save: noop, restore: noop, translate: noop, scale: noop, setTransform: noop, beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop, fill: noop, stroke: noop, fillText: noop, setLineDash: noop };
  const canvas = () => ({ dataset: {}, clientWidth: 960, getContext: () => c });
  const control = { addEventListener: noop, setAttribute: noop };
  const overlay = () => ({ innerHTML: '', querySelectorAll: () => [] });
  const elements = { map: canvas(), street: canvas(), streetControls: control, overviewMode: control, streetMode: control, streetDistrict: { ...control, value: 'camp' }, mapWrap: { classList: { toggle: noop } }, streetStatus: {}, streetExits: { replaceChildren: noop }, streetOverlay: overlay(), mapOverlay: overlay() };
  for (const id of ['walkLeft', 'walkRight', 'walkUp', 'walkDown']) elements[id] = { addEventListener: (name, fn) => { touches[`${id}:${name}`] = fn; } };
  let frame, time = 100;
  globalThis.document = { getElementById: id => elements[id] || null, querySelector: () => null };
  globalThis.window = { addEventListener: (name, fn) => { keys[name] = fn; } };
  globalThis.requestAnimationFrame = fn => { frame = fn; return 1; };
  globalThis.performance = { now: () => time };
  globalThis.matchMedia = () => ({ matches: false });
  t.after(() => { for (const [key, value] of Object.entries(before)) globalThis[key] = value; });
  const state = { seed: 789, day: 3, turn: 1, hour: 8, slot: 0, phase: 'planning', weatherKind: 'clear', camp: { rain: 1, beds: 0 }, items: [], actors: Object.fromEntries(['xuan', 'fan', 'ma'].map(id => [id, { life: 'active', location: 'camp', energy: 80 }])) };
  map.initMap({});
  map.setMapState(state);
  map.setMapMode('street');
  const select = id => map.updateOverlay(state, { actor: id }, [], [], []);
  select('xuan');
  const step = (ms = 50) => { time += ms; frame(); };
  const key = (name, key) => keys[name]({ key, preventDefault: noop, target: { closest: () => null } });
  step();
  return { state, elements, touches, select, step, key, positions: () => JSON.parse(elements.street.dataset.positions || '{}') };
}

test('real map input moves on both axes without teleporting any character on selection', t => {
  const s = scene(t), original = s.positions();
  assert.ok(original.xuan && original.fan, 'canvas exposes positions rendered for all characters');
  s.key('keydown', 'ArrowLeft'); s.step(); s.key('keyup', 'ArrowLeft');
  s.key('keydown', 'w'); s.step(); s.key('keyup', 'w'); s.step();
  const moved = s.positions();
  assert.ok(moved.xuan.x < original.xuan.x);
  assert.ok(moved.xuan.y < original.xuan.y);
  assert.equal(moved.xuan.facing, -1);
  assert.deepEqual(moved.fan, original.fan);
  s.select('fan'); s.step(); s.select('xuan'); s.step();
  assert.deepEqual(s.positions(), moved);
  assert.equal(typeof s.touches['walkDown:pointerdown'], 'function');
  s.touches['walkDown:pointerdown']({ preventDefault() {} }); s.step();
  s.touches['walkDown:pointerup'](); s.step();
  assert.ok(s.positions().xuan.y > moved.xuan.y);
  s.key('keydown', 'ArrowRight'); s.step(); s.key('keyup', 'ArrowRight'); s.step();
  assert.ok(s.positions().xuan.x > moved.xuan.x);
  assert.equal(s.positions().xuan.facing, 1);
  assert.deepEqual(s.positions().fan, original.fan);
});

test('successful item animation starts immediately, survives render, expires and resumes activity', t => {
  const s = scene(t);
  assert.equal(typeof map.playItemAnimation, 'function');
  map.setMapState(s.state, { xuan: { id: 'fish' }, fan: { id: 'sketch' } });
  assert.equal(map.playItemAnimation('xuan', 'beer'), true);
  map.setMapState(s.state);
  s.step();
  assert.match(JSON.parse(s.elements.street.dataset.poses).xuan, /^drink[01]$/);
  s.step(1000);
  assert.match(JSON.parse(s.elements.street.dataset.poses).xuan, /^drink[01]$/);
  s.step(2100);
  assert.match(JSON.parse(s.elements.street.dataset.poses).xuan, /^fish[012]$/);
  assert.match(JSON.parse(s.elements.street.dataset.poses).fan, /^sketch[01]$/);
});

test('multi-hour actions keep animating after a turn advances with no new execution payload', t => {
  const s = scene(t);
  map.setMapState({ ...s.state, turn: 2, hour: 9, busy: { xuan: { task: { id: 'fish' }, remainingHours: 1 }, fan: { task: { id: 'sketch' }, remainingHours: 1 } } });
  s.step();
  const poses = JSON.parse(s.elements.street.dataset.poses);
  assert.match(poses.xuan, /^fish[012]$/);
  assert.match(poses.fan, /^sketch[01]$/);
});
