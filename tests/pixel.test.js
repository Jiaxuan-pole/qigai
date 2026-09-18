// 像素层契约：所有姿势、所有表情都能画，且真的画了东西。用假的 2D 上下文记录调用。
import test from 'node:test';
import assert from 'node:assert/strict';
import { sprite, portrait, bigPortrait, skyline, bridgeScene, screeningScene, moodOf, MOODS } from '../public/ui/pixel.js';

function fakeContext() {
  const calls = { fillRect: 0, pixels: [] };
  const noop = () => {};
  const c = {
    calls,
    fillStyle: '', globalAlpha: 1, imageSmoothingEnabled: true, font: '', textAlign: '',
    fillRect: (x, y, w, h) => { calls.fillRect += 1; calls.pixels.push([x, y, w, h, c.fillStyle]); },
    save: noop, restore: noop, translate: noop, scale: noop, setTransform: noop, beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop, fill: noop, stroke: noop, fillText: noop, setLineDash: noop,
    createRadialGradient: () => ({ addColorStop: noop }),
  };
  return c;
}
const fakeCanvas = () => { const c = fakeContext(); return { getContext: () => c, ctx: c }; };

test('sprite draws every character in every pose', () => {
  for (const who of ['xuan', 'fan', 'ma']) for (const pose of ['stand', 'walk0', 'walk1', 'walk2', 'walk3', 'crouch', 'sit']) {
    const c = fakeContext();
    sprite(c, 10, 10, who, 1.5, pose);
    assert.ok(c.calls.fillRect > 40, `${who}/${pose} 画得太少：${c.calls.fillRect}`);
  }
});

test('action poses change the body and alternate frames at the original sprite seam', () => {
  for (const who of ['xuan', 'fan', 'ma']) {
    const draw = (pose) => { const c = fakeContext(); sprite(c, 0, 0, who, 1, pose); return JSON.stringify(c.calls.pixels); };
    const stand = draw('stand');
    for (const action of ['work', 'beg', 'smoke', 'phone', 'sketch', 'repair', 'stall', 'wash', 'rest', 'carry']) {
      const first = draw(`${action}0`);
      assert.notEqual(first, stand, `${who}/${action}0 cannot be stand`);
      assert.notEqual(draw(`${action}1`), first, `${who}/${action} must have two frames`);
    }
  }
});

test('action props use their own pixel materials', () => {
  const materials = { beg: '#c9b389', smoke: '#ff9c52', phone: '#9fd6ff', sketch: '#d7cbb1', repair: '#8a969b', stall: '#8e6049', wash: '#8fc3e6', carry: '#c9b389' };
  for (const [action, color] of Object.entries(materials)) {
    const c = fakeContext(); sprite(c, 0, 0, 'fan', 1, `${action}1`);
    assert.ok(c.calls.pixels.some((p) => p[4] === color), `${action} should carry its prop`);
  }
});

test('ground-level tasks bend the whole body and resting sits on the ground', () => {
  for (const action of ['work', 'repair', 'wash']) for (const frame of [0, 1]) {
    const c = fakeContext(); sprite(c, 0, 0, 'ma', 1, `${action}${frame}`);
    assert.ok(c.calls.pixels.some(([x, y, w, h]) => x === 1 && y === 29 && w === 22 && h === 7), `${action}${frame} needs crouched legs`);
    assert.ok(c.calls.pixels.some(([x, y, w, h]) => x === 3 && y === 21 && w === 18 && h === 15), `${action}${frame} needs lowered torso`);
    assert.ok(!c.calls.pixels.some(([x, y, w, h]) => x === 5 && y === 26 && w === 8 && h === 10), `${action}${frame} cannot keep standing legs`);
  }
  for (const frame of [0, 1]) {
    const c = fakeContext(); sprite(c, 0, 0, 'fan', 1, `rest${frame}`);
    assert.ok(c.calls.pixels.some(([x, y, w, h]) => x === 3 && y === 26 && w === 14 && h === 9), `rest${frame} needs seated legs`);
    assert.ok(c.calls.pixels.some(([x, y, w, h]) => x === 3 && y === 17 && w === 18 && h === 15), `rest${frame} needs seated torso`);
  }
});

test('portrait and bigPortrait draw every mood for every character', () => {
  for (const who of ['xuan', 'fan', 'ma']) for (const mood of MOODS) {
    const cv = fakeCanvas();
    portrait(cv, who, mood);
    assert.ok(cv.ctx.calls.fillRect > 30, `${who}/${mood} 头像太空`);
    const big = fakeCanvas();
    bigPortrait(big, who, mood);
    assert.equal(big.ctx.calls.fillRect, cv.ctx.calls.fillRect, '大头像与小头像画同一张脸');
  }
});

test('moodOf ranks danger first', () => {
  const base = { life: 'active', health: 80, food: 60, energy: 60, warmth: 60, mind: 50, diseases: [] };
  assert.equal(moodOf(base), 'normal');
  assert.equal(moodOf({ ...base, mind: 80 }), 'happy');
  assert.equal(moodOf({ ...base, mind: 20 }), 'sad');
  assert.equal(moodOf({ ...base, energy: 10, mind: 20 }), 'tired');
  assert.equal(moodOf({ ...base, food: 10, energy: 10 }), 'hungry');
  assert.equal(moodOf({ ...base, warmth: 10, food: 10 }), 'cold');
  assert.equal(moodOf({ ...base, diseases: [{ kind: 'skin' }], warmth: 10 }), 'sick');
  assert.equal(moodOf({ ...base, health: 20, diseases: [{ kind: 'skin' }] }), 'hurt');
  assert.equal(moodOf({ ...base, life: 'downed' }), 'hurt');
  assert.equal(moodOf(null), 'normal');
});

test('scenes render with typical options', () => {
  for (const dawn of [0.2, 0.6, 1]) { const c = fakeContext(); skyline(c, 960, 130, dawn); assert.ok(c.calls.fillRect > 100); }
  for (const opts of [{}, { night: true, rain: true, camp: 2, beds: 3, art: 3, tick: 47 }, { fire: true, cat: false, snow: true, car: 120, dust: [{ x: 1, y: 2 }] }]) {
    const c = fakeContext(); bridgeScene(c, opts); assert.ok(c.calls.fillRect > 200);
  }
  for (const opts of [{}, { who: ['xuan'], guest: true, tick: 47, rain: true }]) { const c = fakeContext(); screeningScene(c, opts); assert.ok(c.calls.fillRect > 250); }
});

test('night camp draws only explicitly supplied fire-side companions', () => {
  const bare = fakeContext(); bridgeScene(bare, { night: true, fire: true, tick: 10 });
  const together = fakeContext(); bridgeScene(together, { night: true, fire: true, tick: 10, who: ['xuan', 'fan', 'ma'] });
  assert.ok(together.calls.fillRect > bare.calls.fillRect + 100);
  const empty = fakeContext(); bridgeScene(empty, { night: true, who: [] });
  assert.equal(empty.calls.fillRect, bare.calls.fillRect);
});

test('rain makes spreading ground splashes as well as falling streaks', () => {
  const first = fakeContext(); bridgeScene(first, { rain: true, tick: 0 });
  const later = fakeContext(); bridgeScene(later, { rain: true, tick: 6 });
  const splashes = (c) => c.calls.pixels.filter(([x, y, w, h, color]) => y >= 240 && w > 1 && h <= 2 && color === '#9ab1ad');
  assert.ok(splashes(first).length > 0, 'rain needs visible ground splashes');
  assert.notDeepEqual(splashes(first), splashes(later), 'splashes spread over time');
});

test('an unlit camp night does not invent flames without fuel', () => {
  const c = fakeContext(); bridgeScene(c, { night: true, fire: false, tick: 0 });
  assert.equal(c.calls.pixels.some((p) => p[4] === '#e2833a'), false);
});

test('talking sprites use a visible gesture and speech ticks instead of standing still', () => {
  for (const who of ['xuan', 'fan', 'ma']) {
    const draw = (pose) => { const c = fakeContext(); sprite(c, 0, 0, who, 1, pose); return c.calls.pixels; };
    const stand = JSON.stringify(draw('stand'));
    for (const frame of [0, 1]) {
      const pixels = draw(`talk${frame}`);
      assert.notEqual(JSON.stringify(pixels), stand, `${who}/talk${frame} cannot be stand`);
      assert.ok(pixels.some((p) => p[4] === '#e3bb72'), `${who}/talk${frame} needs a dialogue feedback tick`);
    }
  }
});
