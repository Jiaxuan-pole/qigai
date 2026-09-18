import test from 'node:test';
import assert from 'node:assert/strict';

test('持续走时只弹出操控人物街区新出现的热点', async () => {
  const { encounteredEvent } = await import('../public/ui/live-clock.js');
  assert.equal(typeof encounteredEvent, 'function');
  const before = { events: [{ uid: 'old' }] };
  const after = { actors: { xuan: { location: 'station' } }, events: [
    { uid: 'old', status: 'open', district: 'station' },
    { uid: 'away', status: 'open', district: 'river' },
    { uid: 'new', status: 'open', district: 'station' },
  ] };
  assert.equal(encounteredEvent(before, after, 'xuan')?.uid, 'new');
  assert.equal(encounteredEvent(after, after, 'xuan'), undefined);
});

test('持续时钟空闲走时，暂停不积累，跨小时只推进一次', async () => {
  const module = await import('../public/ui/live-clock.js').catch(() => ({}));
  assert.equal(typeof module.createLiveClock, 'function', '需要可驱动的持续时钟');
  let hours = 0;
  const clock = module.createLiveClock(() => { hours++; });
  clock.tick(0, true, '1:6');
  clock.tick(30000, true, '1:6');
  assert.equal(clock.minutes, 30);
  clock.tick(50000, false, '1:6');
  clock.tick(70000, true, '1:6');
  assert.equal(clock.minutes, 30);
  clock.tick(100000, true, '1:6');
  assert.equal(hours, 1);
  clock.tick(110000, true, '1:6');
  assert.equal(hours, 1);
  clock.tick(120000, true, '1:7');
  assert.equal(clock.minutes, 0);
});

test('自动推进被拒绝后暂停，救援恢复后再次持续走时', async () => {
  const module = await import('../public/ui/live-clock.js').catch(() => ({}));
  assert.equal(typeof module.createLiveClock, 'function');
  const clock = module.createLiveClock(() => false);
  clock.tick(0, true, '1:6');
  clock.tick(40000, true, '1:6');
  clock.tick(40001, true, '1:7');
  assert.equal(clock.minutes, 0);
  clock.tick(100001, true, '1:7');
  await Promise.resolve();
  assert.equal(clock.paused, true);
  assert.equal(typeof clock.toggle, 'undefined');
  clock.restart();
  assert.equal(clock.paused, false);
});

test('后台120秒没有动画帧，恢复后不补算为游戏时间', async () => {
  const originalDocument = globalThis.document;
  const originalAnimationFrame = globalThis.requestAnimationFrame;
  const frames = [];
  const listeners = new Map();
  const elements = {
    game: { classList: { contains: () => false } },
    plannerOverlay: { hidden: true },
    tSlot: {},
    clockStatus: {},
    modalOverlay: { classList: { contains: () => false } },
  };
  const document = {
    hidden: false,
    getElementById: (id) => elements[id],
    querySelector: () => null,
    addEventListener: (name, handler) => listeners.set(name, handler),
  };
  globalThis.document = document;
  globalThis.requestAnimationFrame = (frame) => { frames.push(frame); };
  try {
    const { startLiveClock } = await import('../public/ui/live-clock.js');
    const { UI } = await import('../public/ui/core.js');
    const originalState = UI.state;
    UI.state = { seed: 1, day: 1, hour: 6, hourTick: 0, phase: 'planning' };
    let advances = 0;
    const clock = startLiveClock(() => { advances++; }, () => false);
    frames.shift()(0);
    document.hidden = true;
    listeners.get('visibilitychange')();
    document.hidden = false;
    listeners.get('visibilitychange')();
    frames.shift()(120000);
    assert.equal(advances, 0);
    assert.equal(clock.minutes, 0);
    UI.state = originalState;
  } finally {
    globalThis.document = originalDocument;
    globalThis.requestAnimationFrame = originalAnimationFrame;
  }
});

test('自动救援警告拒绝推进后，回去安排可从零开始恢复时钟', async () => {
  const originalDocument = globalThis.document;
  const originalAnimationFrame = globalThis.requestAnimationFrame;
  const frames = [];
  const elements = {
    game: { classList: { contains: () => false } },
    plannerOverlay: { hidden: true },
    tSlot: {},
    clockStatus: {},
    modalOverlay: { classList: { contains: () => false } },
  };
  globalThis.document = {
    hidden: false,
    getElementById: (id) => elements[id],
    querySelector: () => null,
    addEventListener() {},
  };
  globalThis.requestAnimationFrame = (frame) => { frames.push(frame); };
  try {
    const { startLiveClock } = await import('../public/ui/live-clock.js');
    const { UI } = await import('../public/ui/core.js');
    const originalState = UI.state;
    UI.state = { seed: 1, day: 1, hour: 6, hourTick: 0, phase: 'planning' };
    let warnings = 0;
    const clock = startLiveClock(() => { warnings++; return false; }, () => false);
    frames.shift()(0);
    frames.shift()(60000);
    await Promise.resolve();
    assert.equal(warnings, 1);
    assert.equal(clock.paused, true);
    clock.restart();
    assert.equal(clock.paused, false);
    assert.equal(clock.minutes, 0);
    frames.shift()(60001);
    assert.equal(clock.minutes, 0);
    UI.state = originalState;
  } finally {
    globalThis.document = originalDocument;
    globalThis.requestAnimationFrame = originalAnimationFrame;
  }
});
