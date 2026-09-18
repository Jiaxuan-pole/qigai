import test from 'node:test';
import assert from 'node:assert/strict';
import { streetSprite } from '../public/ui/street-people.js';
import { sprite, portrait } from '../public/ui/pixel.js';
import { actionFrame, actionPoseFor, walkFrame } from '../public/ui/animation.js';

function draw(id, pose = 'stand', scale = 2, painter = streetSprite) {
  const rects = [];
  const stack = [];
  const c = {
    fillStyle: '', x: 0, y: 0, sx: 1, sy: 1,
    save() { stack.push([this.x, this.y, this.sx, this.sy]); },
    restore() { [this.x, this.y, this.sx, this.sy] = stack.pop(); },
    translate(x, y) { this.x += x * this.sx; this.y += y * this.sy; },
    scale(x, y) { this.sx *= x; this.sy *= y; },
    fillRect(x, y, w, h) { rects.push({ x: this.x + x * this.sx, y: this.y + y * this.sy, w: w * this.sx, h: h * this.sy, color: this.fillStyle }); },
  };
  painter(c, 100, 50, id, scale, pose);
  return rects;
}

const signature = (rects, colors, yLimit = Infinity) => rects.filter(r => colors.includes(r.color) && r.y < yLimit).map(r => [r.x, r.y, r.w, r.h].join(',')).join('|');

test('three leads have distinct face geometry at street scale', () => {
  const skins = ['#d9a577', '#b98358', '#ecc19a'];
  const faces = ['xuan', 'fan', 'ma'].map(id => signature(draw(id), skins, 74));
  assert.equal(new Set(faces).size, 3);
});

test('sprite keeps the old screen footprint and standing foot anchor', () => {
  for (const scale of [1.5, 2, 3]) {
    const rects = draw('xuan', 'stand', scale);
    const shoes = rects.filter(r => r.color === '#1f2226' || r.color === '#7b8081');
    assert.ok(shoes.length);
    assert.ok(shoes.some(r => Math.abs(r.y + r.h - (50 + 38 * scale)) <= scale));
    const body = rects.filter(r => r.color !== 'rgba(10,18,24,0.45)' && r.color !== 'rgba(0,0,0,0.35)');
    assert.ok(Math.max(...body.map(r => r.x + r.w)) - Math.min(...body.map(r => r.x)) <= 29 * scale);
  }
});

test('walking changes the leg geometry on four frames', () => {
  const pants = ['#2c3138', '#20242a'];
  assert.equal(new Set([0, 1, 2, 3].map(f => signature(draw('xuan', `walk${f}`), pants))).size, 4);
});

test('work and fishing change the torso and put tools beside hands', () => {
  const stand = draw('ma');
  const work = draw('ma', 'work1');
  const fish = draw('ma', 'fish0');
  const skin = ['#d9a577', '#b98358', '#ecc19a'];
  assert.notEqual(signature(work, skin), signature(stand, skin));
  assert.ok(fish.some(r => r.color === '#d8e6df' && r.x > 100 + 24 * 2));
  assert.ok(fish.some(r => r.color === '#e05a4f' && r.x > 100 + 24 * 2));
});

test('all active actions have distinct live frames with integer canvas pixels', () => {
  const actions = ['work', 'beg', 'sketch', 'repair', 'wash', 'rest', 'fish', 'carry', 'smoke', 'phone', 'talk', 'stall'];
  for (const id of ['xuan', 'fan', 'ma']) for (const action of actions) {
    const a = draw(id, `${action}0`), b = draw(id, `${action}1`);
    assert.notDeepEqual(a, b, `${id} ${action}`);
    assert.ok(a.every(r => [r.x, r.y, r.w, r.h].every(Number.isInteger)), `${id} ${action} crisp pixels`);
  }
});

test('sitting and crouching move the head while shoes stay at ground level', () => {
  const top = (rects, id) => Math.min(...rects.filter(r => r.color === (id === 'xuan' ? '#ecc19a' : '#b98358')).map(r => r.y));
  for (const id of ['xuan', 'fan', 'ma']) {
    const standing = draw(id), sitting = draw(id, 'sit'), crouching = draw(id, 'work0');
    assert.ok(top(sitting, id) > top(standing, id), `${id} seated head`);
    assert.ok(top(crouching, id) > top(standing, id), `${id} crouched head`);
    const sole = { xuan: '#7b8081', fan: '#79562c', ma: '#737d83' }[id];
    for (const rects of [standing, sitting, crouching]) assert.ok(rects.some(r => r.color === sole && r.y + r.h === 126), `${id} foot anchor`);
  }
});

test('reduced-motion pose selection is fixed for walk and actions', () => {
  for (const time of [0, 110, 280, 540, 2600]) {
    assert.equal(walkFrame(time, true), 'stand');
    assert.equal(actionFrame('fish', time, true), 'fish0');
    assert.equal(actionFrame('repair', time, true), 'repair0');
  }
});

test('cooking bends into a seated working posture with a turning fish and pot', () => {
  const top = (rects, id) => Math.min(...rects.filter(r => r.color === (id === 'xuan' ? '#ecc19a' : '#b98358')).map(r => r.y));
  for (const id of ['xuan', 'fan', 'ma']) {
    const stand = draw(id), first = draw(id, 'cook0'), second = draw(id, 'cook1');
    assert.ok(top(first, id) > top(stand, id), `${id} head lowers toward fire`);
    assert.ok(first.some(r => r.color === '#b87545' && r.x > 140), `${id} cooked fish`);
    assert.ok(first.some(r => r.color === '#4d5b60' && r.x > 140), `${id} pot`);
    assert.notDeepEqual(first, second, `${id} wrist, skewer and steam animate`);
  }
});

test('cook action maps to both street and overview sprite frames', () => {
  assert.equal(actionPoseFor('cook'), 'cook');
  assert.equal(actionFrame('cook', 0), 'cook0');
  assert.equal(actionFrame('cook', 280), 'cook1');
  assert.equal(actionFrame('cook', 280, true), 'cook0');
  assert.notDeepEqual(draw('fan', 'cook0', 2, sprite), draw('fan', 'stand', 2, sprite));
  assert.notDeepEqual(draw('fan', 'cook0', 2, sprite), draw('fan', 'cook1', 2, sprite));
});

test('all street poses use the current three distinct wardrobes and bare faces', () => {
  const expectations = {
    xuan: ['#252b2e', '#ecc19a', '#1f2226', '#778387'],
    fan: ['#c69a32', '#467aa1', '#b8832d', '#b98358'],
    ma: ['#252b2e', '#626b70', '#d8d6cf', '#b98358'],
  };
  for (const [id, palette] of Object.entries(expectations)) for (const pose of ['stand', 'walk1', 'cook0']) {
    const colors = new Set(draw(id, pose).map(r => r.color));
    for (const color of palette) assert.ok(colors.has(color), `${id}/${pose} missing ${color}`);
    for (const retired of ['#3f5f88', '#a63a38', '#5f7a4e', '#3e4941', '#7ea3b9']) assert.equal(colors.has(retired), false, `${id}/${pose} retired look ${retired}`);
  }
});

test('overview portraits share the new hair and shirt colors without glasses or cap', () => {
  for (const [id, hair, shirt] of [['xuan', '#1e1a1c', '#252b2e'], ['fan', '#d8b35d', '#c69a32'], ['ma', '#1e1a1c', '#252b2e']]) {
    const rects = [], c = { fillStyle: '', imageSmoothingEnabled: true, setTransform() {}, fillRect(x, y, w, h) { rects.push({ x, y, w, h, color: this.fillStyle }); } };
    portrait({ getContext: () => c }, id);
    const colors = new Set(rects.map(r => r.color));
    assert.ok(colors.has(hair), `${id} hair`);
    assert.ok(colors.has(shirt), `${id} shirt`);
    if (id === 'xuan') assert.ok(colors.has('#778387'), 'black shirt collar and buttons');
    assert.equal(colors.has('#7ea3b9'), false, `${id} glasses reflection`);
    assert.equal(colors.has('#3e4941'), false, `${id} old cap`);
    if (id === 'ma') assert.equal(colors.has('#ff7a3a'), false, 'cigarette appears only during smoke action');
  }
});
