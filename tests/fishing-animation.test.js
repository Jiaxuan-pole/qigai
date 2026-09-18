import test from 'node:test';
import assert from 'node:assert/strict';
import { actionFrame, actionPoseFor } from '../public/ui/animation.js';
import { sprite } from '../public/ui/pixel.js';

function fakeContext() {
  const calls = { pixels: [], scales: [] };
  const noop = () => {};
  const c = {
    calls,
    fillStyle: '',
    fillRect: (x, y, w, h) => calls.pixels.push([x, y, w, h, c.fillStyle]),
    save: noop, restore: noop, translate: noop, scale: (x, y) => calls.scales.push([x, y]),
  };
  return c;
}

function draw(who, pose) {
  const c = fakeContext();
  sprite(c, 0, 0, who, 1, pose);
  return c.calls.pixels;
}

test('fish action id selects a dedicated three-phase animation', () => {
  assert.equal(actionPoseFor('fish'), 'fish');
  assert.equal(actionFrame('fish', 0), 'fish0');
  assert.equal(actionFrame('fish', 1999), 'fish0');
  assert.equal(actionFrame('fish', 2000), 'fish1');
  assert.equal(actionFrame('fish', 2300), 'fish2');
  assert.equal(actionFrame('fish', 2600), 'fish0');
  assert.equal(actionFrame('fish', 2300, true), 'fish0');
});

test('dialogue feedback maps to an animated but reduced-motion-safe gesture', () => {
  assert.equal(actionPoseFor('dialogue'), 'talk');
  assert.equal(actionFrame('talk', 0), 'talk0');
  assert.equal(actionFrame('talk', 280), 'talk1');
  assert.equal(actionFrame('talk', 280, true), 'talk0');
});

test('all three characters fish with seated bodies, rods, lines, and safe face clearance', () => {
  for (const who of ['xuan', 'fan', 'ma']) {
    const stand = JSON.stringify(draw(who, 'stand'));
    for (const frame of [0, 1, 2]) {
      const pixels = draw(who, `fish${frame}`);
      assert.notEqual(JSON.stringify(pixels), stand, `${who}/fish${frame} cannot be stand`);
      assert.ok(pixels.some(([x, y, w, h, color]) => color === '#7a8a8f' && x >= 19 && y < 30 && w <= 8 && h <= 8), `${who}/fish${frame} needs segmented rod pixels`);
      assert.ok(pixels.some(([, , , , color]) => color === '#d8e6df'), `${who}/fish${frame} needs a visible line or float`);
      assert.ok(pixels.some(([x, y, w, h]) => x === 3 && y === 26 && w === 14 && h === 9), `${who}/fish${frame} needs seated legs at the standard foot seam`);
      assert.equal(pixels.some(([x, y, w, h, color]) => color === '#d8e6df' && x < 19 && x + w > 6 && y < 13 && y + h > 4), false, `${who}/fish${frame} line cannot cross the face`);
    }
  }
});

test('fish phases alter the cast, lift, and wait silhouettes', () => {
  for (const who of ['xuan', 'fan', 'ma']) {
    const frames = [0, 1, 2].map((frame) => JSON.stringify(draw(who, `fish${frame}`)));
    assert.notEqual(frames[0], frames[1], `${who} wait and lift need distinct silhouettes`);
    assert.notEqual(frames[1], frames[2], `${who} lift and cast need distinct silhouettes`);
  }
});

test('fish keeps integer source pixels when street scales it three times', () => {
  for (const who of ['xuan', 'fan', 'ma']) for (const frame of [0, 1, 2]) {
    const c = fakeContext();
    sprite(c, 120, 200, who, 3, `fish${frame}`);
    assert.deepEqual(c.calls.scales, [[3, 3]], `${who}/fish${frame} should use the street integer scale`);
    assert.ok(c.calls.pixels.every(([x, y, w, h]) => [x, y, w, h].every(Number.isInteger)), `${who}/fish${frame} needs only integer source pixels`);
  }
});
