import test from 'node:test';
import assert from 'node:assert/strict';
import { drawRiverFightScene } from '../public/ui/river-fight-art.js';
import { RIVER_FIGHT_DURATION, RIVER_FIGHT_LINE, createRiverFightLifecycle, playRiverFight, riverFightChoreo, riverFightStageFrame } from '../public/ui/river-fight-intro.js';

function fakeContext() {
  const pixels = [];
  const noop = () => {};
  const context = {
    pixels,
    fillStyle: '',
    globalAlpha: 1,
    fillRect: (x, y, w, h) => pixels.push({ x, y, w, h, color: context.fillStyle }),
    save: noop,
    restore: noop,
    translate: noop,
    scale: noop,
  };
  return context;
}

test('河岸过场以空钩、怒话、起跳、水花、追鱼、爬岸收束在 14 到 18 秒', () => {
  assert.ok(RIVER_FIGHT_DURATION >= 14000 && RIVER_FIGHT_DURATION <= 18000);
  assert.equal(RIVER_FIGHT_LINE, '这个鱼就是欠干');
  const empty = riverFightChoreo(1200, 8);
  const run = riverFightChoreo(5700, 8);
  const leap = riverFightChoreo(7400, 8);
  const splash = riverFightChoreo(8700, 8);
  const swim = riverFightChoreo(11200, 8);
  const climb = riverFightChoreo(14200, 8);

  assert.equal(empty.phase, 'empty-hook');
  assert.equal(run.phase, 'run');
  assert.equal(leap.phase, 'leap');
  assert.equal(splash.phase, 'splash');
  assert.equal(swim.phase, 'swim');
  assert.equal(climb.phase, 'climb');
  assert.ok(run.maX > empty.maX, '马哥应从小凳边跑向河面');
  assert.ok(leap.maY < run.maY, '跳跃中人物应沿弧线抬起');
  assert.ok(splash.maX > leap.maX, '入水点应在跳跃落点之后');
  assert.ok(climb.maX < swim.maX, '上岸要朝岸边返回');
  for (const frame of [empty, run, leap, splash, swim, climb]) {
    assert.ok(frame.maX >= 0 && frame.maX <= 456, `${frame.phase} 的人物不能出框`);
    assert.ok(frame.maY >= 0 && frame.maY <= 224, `${frame.phase} 的人物不能出框`);
  }
});

test('减少动态效果冻结每一阶段的姿势，但阶段本身仍按时序切换', () => {
  const leapLive = riverFightChoreo(7400, 0);
  const leapStill = riverFightStageFrame(7400);
  const swimStill = riverFightStageFrame(11200);

  assert.equal(leapStill.phase, 'leap');
  assert.equal(swimStill.phase, 'swim');
  assert.ok(leapStill.maY > leapLive.maY, '静态跳跃帧应停在阶段起点，不继续上抛');
});

test('河岸、水面、鱼、人物和入水水花在相应帧都有可见像素差异', () => {
  const empty = fakeContext();
  const splash = fakeContext();
  const swimA = fakeContext();
  const swimB = fakeContext();
  drawRiverFightScene(empty, { choreo: riverFightChoreo(1200, 8), tick: 8 });
  drawRiverFightScene(splash, { choreo: riverFightChoreo(8700, 8), tick: 8 });
  drawRiverFightScene(swimA, { choreo: riverFightChoreo(10800, 8), tick: 8 });
  drawRiverFightScene(swimB, { choreo: riverFightChoreo(11600, 9), tick: 9 });

  for (const color of ['#397c93', '#c9ad74', '#d7b46b', '#252b2e', '#626b70', '#d8d6cf']) {
    assert.ok(empty.pixels.some((pixel) => pixel.color === color), `河岸首帧缺少 ${color}`);
  }
  assert.ok(splash.pixels.some((pixel) => pixel.color === '#b9e9ed'), '入水帧必须有大水花');
  const fishA = swimA.pixels.find((pixel) => pixel.color === '#d7b46b' && pixel.y > 130);
  const fishB = swimB.pixels.find((pixel) => pixel.color === '#d7b46b' && pixel.y > 130);
  assert.notDeepEqual([fishA?.x, fishA?.y], [fishB?.x, fishB?.y], '鱼躲窜时位置应改变');
});

test('河岸过场结束与跳过共享一次性清理，重复触发不会重放回调', () => {
  let done = 0;
  let cleaned = 0;
  const lifecycle = createRiverFightLifecycle(() => { done += 1; }, () => { cleaned += 1; });

  lifecycle.finish();
  lifecycle.finish();

  assert.equal(done, 1);
  assert.equal(cleaned, 1);
});

test('跳过会取消待执行帧、停止台词并且只确认一次', () => {
  const beforeDocument = globalThis.document;
  const beforeWindow = globalThis.window;
  const beforeRaf = globalThis.requestAnimationFrame;
  const beforeCancel = globalThis.cancelAnimationFrame;
  const frames = [];
  const cancelled = [];
  const calls = [];
  let nextRafId = 0;
  const canvas = { getContext: () => fakeContext(), onclick: null };
  const text = {};
  const speed = { onclick: null, setAttribute() {}, textContent: '' };
  const skip = { onclick: null };
  const root = {
    className: '', innerHTML: '', onkeydown: null, tabIndex: -1, removed: false,
    querySelector: (selector) => ({ '#riverFightCanvas': canvas, '#riverFightText': text, '#riverFightSpeed': speed, '#riverFightSkip': skip })[selector],
    focus() {}, remove() { this.removed = true; },
  };
  let done = 0;

  globalThis.document = { createElement: () => root, body: { appendChild() {} } };
  globalThis.window = { matchMedia: () => ({ matches: false }), jwsnAudio: { stopSpeech: () => calls.push('stop'), speak: (...args) => calls.push(args) } };
  globalThis.requestAnimationFrame = (callback) => { frames.push(callback); nextRafId += 1; return nextRafId; };
  globalThis.cancelAnimationFrame = (id) => cancelled.push(id);

  try {
    playRiverFight({ id: 'river-fight-1', actorId: 'ma', line: RIVER_FIGHT_LINE }, () => { done += 1; });
    frames.shift()(0);
    frames.shift()(3001);
    const skipAgain = skip.onclick;
    skip.onclick();
    skipAgain();

    assert.equal(done, 1);
    assert.deepEqual(cancelled, [3]);
    assert.equal(root.removed, true);
    assert.deepEqual(calls, ['stop', ['马哥', RIVER_FIGHT_LINE], 'stop']);
  } finally {
    globalThis.document = beforeDocument;
    globalThis.window = beforeWindow;
    globalThis.requestAnimationFrame = beforeRaf;
    globalThis.cancelAnimationFrame = beforeCancel;
  }
});
