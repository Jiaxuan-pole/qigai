import test from 'node:test';
import assert from 'node:assert/strict';
import { createIntroClock, nextIntroSpeed, normalizeIntroSpeed } from '../public/ui/intro-clock.js';
import { shouldAdvanceIntroForKey } from '../public/ui/intro.js';

test('开场时钟默认 1× 与真实经过时间等价', () => {
  const clock = createIntroClock();
  clock.advance(1000);
  assert.equal(clock.advance(1600), 600);
});

test('开场时钟切到 2× 后同段演出用一半真实时间完成', () => {
  const clock = createIntroClock();
  clock.advance(0);
  clock.setSpeed(2);
  assert.equal(clock.advance(500), 1000);
});

test('开场时钟切速度时先累积旧速度，不会闪回', () => {
  const clock = createIntroClock();
  clock.advance(0);
  clock.setSpeed(2);
  clock.advance(400);
  clock.setSpeed(3);
  assert.equal(clock.advance(500), 1100);
});

test('开场倍速限制在四档并循环', () => {
  assert.equal(normalizeIntroSpeed(0.5), 1);
  assert.equal(normalizeIntroSpeed(4), 3);
  assert.equal(normalizeIntroSpeed('2'), 1);
  assert.deepEqual([1, 1.5, 2, 3].map(nextIntroSpeed), [1.5, 2, 3, 1]);
  assert.equal(nextIntroSpeed(3), 1);
});

test('速度按钮的键盘操作不会推进下一拍', () => {
  assert.equal(shouldAdvanceIntroForKey('introSpeed', ' '), false);
  assert.equal(shouldAdvanceIntroForKey('introSpeed', 'Enter'), false);
  assert.equal(shouldAdvanceIntroForKey('introNext', 'Enter'), true);
});
