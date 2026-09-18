import test from 'node:test';
import assert from 'node:assert/strict';
import * as art from '../public/ui/npc-art.js';

function recording() {
  const pixels = [], stack = [];
  let transform = [1, 1, 0, 0];
  return { pixels, fillStyle: '',
    save() { stack.push([...transform]); }, restore() { transform = stack.pop(); },
    translate(x, y) { transform[2] += x * transform[0]; transform[3] += y * transform[1]; },
    scale(x, y) { transform[0] *= x; transform[1] *= y; },
    fillRect(x, y, w, h) {
      const [sx, sy, tx, ty] = transform;
      pixels.push([this.fillStyle, Math.min(x * sx + tx, (x + w) * sx + tx), y * sy + ty, Math.abs(w * sx), h * sy]);
    },
  };
}

function street(job, options = {}, tick = 0) {
  const c = recording();
  art.drawStreetNpc(c, { id: 'same-id', job }, 0, 0, tick, options);
  return c.pixels;
}

test('NPC jobs have distinct silhouettes, clothes and occupational objects', () => {
  const jobs = ['城管', '小混混', '连帽混混', '咖啡师', '外卖骑手', '保洁阿姨', '退休大爷', '上班族', '早市摊主', '学生', '小店店员', '站口装卸工'];
  const traces = jobs.map(job => street(job, { scale: 1 }));
  assert.equal(new Set(traces.map(JSON.stringify)).size, jobs.length);
  const silhouettes = traces.map(trace => JSON.stringify(trace.map(([, ...rect]) => rect)));
  assert.ok(new Set(silhouettes).size >= 10, 'occupation changes geometry, not just shirt color');
  const cleaner = traces[5], elder = traces[6], rider = traces[4];
  assert.ok(cleaner.some(([, , , w, h]) => h >= 18 && w <= 2), 'long broom handle');
  assert.ok(elder.some(([, , , w, h]) => h >= 18 && w <= 2), 'walking cane');
  assert.ok(rider.some(([, x, , w, h]) => x < 0 && w >= 8 && h >= 10), 'delivery backpack');
});

test('conflict NPCs share the street identity and have articulated attack, guard, hit and retreat poses', () => {
  assert.equal(typeof art.drawConflictNpc, 'function');
  const traces = ['stand', 'attack', 'defend', 'hit', 'flee'].map(pose => {
    const c = recording();
    art.drawConflictNpc(c, 0, 0, 'chengguan', pose, 1, 1, 1);
    return c.pixels;
  });
  assert.equal(new Set(traces.map(JSON.stringify)).size, traces.length);
  const rightmost = trace => Math.max(...trace.map(([, x, , w]) => x + w));
  assert.ok(rightmost(traces[1]) > rightmost(traces[0]) + 8, 'punch extends beyond standing hand');
  const c = recording();
  art.drawConflictNpc(c, 0, 0, 'chengguan', 'stand', 0, 1, 1);
  assert.deepEqual(c.pixels, street('城管', { scale: 1, pose: 'stand' }));
});

test('walk frames articulate legs, facing mirrors pixels, and drawing leaves NPC data unchanged', () => {
  const steps = [0, 1, 2, 3].map(frame => street('上班族', { pose: 'walk', scale: 1 }, frame));
  const legs = trace => trace.filter(([, , y]) => y >= 37);
  assert.equal(new Set(steps.map(trace => JSON.stringify(legs(trace)))).size, 4);
  const right = street('城管', { facing: 1, scale: 1 });
  const left = street('城管', { facing: -1, scale: 1 });
  assert.deepEqual(left, right.map(([color, x, y, w, h]) => [color, 32 - x - w, y, w, h]));
  const npc = Object.freeze({ id: 'stable', job: '咖啡师', name: '店员' });
  art.drawStreetNpc(recording(), npc, 10, 20, 0);
  for (const trace of [...steps, left, right]) for (const [, x, y, w, h] of trace) {
    assert.ok([x, y, w, h].every(Number.isFinite));
    assert.ok(w > 0 && h > 0);
  }
});
