import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptedVariantsA, createA, initialA, reduceA, scoreA } from '../public/game/work-games-families-a.js';

function step(challenge, progress, input) {
  const result = reduceA(challenge, progress, input);
  assert.equal(result.error, undefined);
  return result.progress;
}

test('A族成功：分拣按材质逐件归箱', () => {
  const c = createA(42, 'sort-1', 'scavenge');
  let p = initialA(c);
  for (const piece of c.pieces) p = step(c, p, { type: 'place', pieceId: piece.id, binId: piece.material });
  assert.equal(p.done, true);
  assert.equal(scoreA(c, p), 100);
  assert.deepEqual(c, createA(42, 'sort-1', 'scavenge'));
  assert.equal(c.family, 'sorting');
  assert.equal(acceptedVariantsA.sellBottles.family, 'sorting');
});

test('A族成功：订单先展示后依序配菜', () => {
  const c = createA(42, 'order-1', 'kitchen');
  let p = step(c, initialA(c), { type: 'ready' });
  assert.equal(p.phase, 'recall');
  for (const dishId of c.order) p = step(c, p, { type: 'pick', dishId });
  assert.equal(p.done, true);
  assert.equal(scoreA(c, p), 100);
  assert.deepEqual(c, createA(42, 'order-1', 'kitchen'));
});

test('A族成功：旋转线路后实际连通', () => {
  const c = createA(42, 'wire-1', 'repair');
  let p = initialA(c);
  for (const index of c.path) {
    const turns = (4 - c.tiles[index].rotation) % 4;
    for (let i = 0; i < turns; i++) p = step(c, p, { type: 'rotate', index });
  }
  p = step(c, p, { type: 'submit' });
  assert.equal(p.done, true);
  assert.equal(scoreA(c, p), 100);
  assert.deepEqual(c, createA(42, 'wire-1', 'repair'));
  assert.equal(acceptedVariantsA.phonestall.family, 'circuit');
});

test('A族成功：对账逐行计算实收', () => {
  const c = createA(42, 'audit-1', 'table');
  const wrong = c.rows.find(row => row.quantity * row.unitPrice !== row.total);
  const p = step(c, initialA(c), { type: 'flag', rowId: wrong.id });
  assert.equal(scoreA(c, p), 100);
  assert.deepEqual(c, createA(42, 'audit-1', 'table'));
  assert.equal(acceptedVariantsA.sellFish.family, 'audit');
  assert.equal(acceptedVariantsA.salvageSell.family, 'audit');
});

test('A族错误：错分拣消耗机会，重复与伪造不加分', () => {
  const c = createA(6, 'sort-error', 'sellBottles');
  const initial = initialA(c);
  const piece = c.pieces[0];
  const wrong = c.bins.find(bin => bin.id !== piece.material);
  const p = step(c, initial, { type: 'place', pieceId: piece.id, binId: wrong.id });
  const repeated = reduceA(c, p, { type: 'place', pieceId: piece.id, binId: piece.material });
  assert.ok(repeated.error);
  assert.strictEqual(repeated.progress, p);
  const forged = reduceA(c, p, { type: 'place', pieceId: 'missing', binId: piece.material, score: 100 });
  assert.ok(forged.error);
  assert.strictEqual(forged.progress, p);
  assert.equal(scoreA(c, p), 0);
  assert.deepEqual(initial.placed, []);
});

test('A族错误：订单错选推进且不能重看', () => {
  const c = createA(8, 'memory-error', 'kitchen');
  const initial = initialA(c);
  assert.ok(reduceA(c, initial, { type: 'pick', dishId: c.order[0] }).error);
  let p = step(c, initial, { type: 'ready' });
  const again = reduceA(c, p, { type: 'ready' });
  assert.ok(again.error);
  assert.strictEqual(again.progress, p);
  p = step(c, p, { type: 'pick', dishId: c.dishes.find(d => d.id !== c.order[0]).id });
  assert.equal(scoreA(c, p), 0);
  for (const dishId of c.order.slice(1)) p = step(c, p, { type: 'pick', dishId });
  assert.equal(p.done, true);
  assert.ok(scoreA(c, p) < 100);
});

test('A族错误：线路超界旋转被拒，错误提交结束', () => {
  const c = createA(9, 'wire-error', 'phonestall');
  const initial = initialA(c);
  assert.ok(reduceA(c, initial, { type: 'rotate', index: 9 }).error);
  assert.strictEqual(reduceA(c, initial, { type: 'rotate', index: 9 }).progress, initial);
  let p = initial;
  for (let i = 0; i < c.maxMoves; i++) p = step(c, p, { type: 'rotate', index: 0 });
  assert.ok(reduceA(c, p, { type: 'rotate', index: 0 }).error);
  p = step(c, p, { type: 'submit' });
  assert.equal(p.done, true);
  assert.equal(scoreA(c, p), 0);
});

test('未知变体不能从原型链生成挑战', () => {
  for (const variant of ['__proto__', 'constructor', 'toString']) assert.throws(() => createA(10, 'unknown', variant), TypeError);
});

test('A族错误：估价与对账错误选择不得重复', () => {
  for (const variant of ['sellFish', 'salvageSell', 'table']) {
    const c = createA(10, `audit-${variant}`, variant);
    const first = c.rows.find(row => row.id !== c.answerId);
    const p = step(c, initialA(c), { type: 'flag', rowId: first.id });
    assert.equal(scoreA(c, p), 0);
    const replay = reduceA(c, p, { type: 'flag', rowId: c.answerId });
    assert.ok(replay.error);
    assert.strictEqual(replay.progress, p);
    assert.ok(reduceA(c, initialA(c), { type: 'flag', rowId: c.answerId, cash: 999 }).error);
  }
});
