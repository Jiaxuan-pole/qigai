import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptedVariantsB, createB, initialB, reduceB, scoreB } from '../public/game/work-games-families-b.js';

const ids = ['shoot', 'edit', 'deliverProject', 'run', 'oddjob', 'carry', 'danger', 'coop', 'trio', 'shellgame'];
const open = (id) => { const challenge = createB(41, `game:${id}`, id); return [challenge, initialB(challenge)]; };
const step = (c, p, input) => { const result = reduceB(c, p, input); assert.equal(result.error, undefined); return result.progress; };
const walk = (c, p, target) => {
  while (p.x < target.x) p = step(c, p, { type: 'move', direction: 'right' });
  while (p.x > target.x) p = step(c, p, { type: 'move', direction: 'left' });
  while (p.y < target.y) p = step(c, p, { type: 'move', direction: 'down' });
  while (p.y > target.y) p = step(c, p, { type: 'move', direction: 'up' });
  return p;
};

test('B族成功：十个入口的题目稳定且登记完整', () => {
  for (const id of ids) {
    assert.equal(typeof acceptedVariantsB[id].family, 'string');
    assert.ok(acceptedVariantsB[id].jobId === id || acceptedVariantsB[id].sourceId === id);
    assert.deepEqual(createB(41, `game:${id}`, id), createB(41, `game:${id}`, id));
    assert.ok(initialB(createB(41, `game:${id}`, id)));
  }
  assert.notDeepEqual(createB(41, 'game:shoot', 'shoot'), createB(42, 'game:shoot', 'shoot'));
});

test('B族成功：摄影移动取景后拍摄', () => {
  let [c, p] = open('shoot');
  p = walk(c, p, c.target);
  p = step(c, p, { type: 'shoot' });
  assert.equal(p.done, true);
  assert.equal(scoreB(c, p), 100);
});

test('B族成功：剪辑与交付审片各有内容并可逐步完成', () => {
  for (const id of ['edit', 'deliverProject']) {
    let [c, p] = open(id);
    assert.notDeepEqual(c.cards, createB(41, 'game:edit', id === 'edit' ? 'deliverProject' : 'edit').cards);
    for (const cardId of c.correctOrder) p = step(c, p, { type: 'select', cardId });
    assert.equal(p.done, true);
    assert.equal(scoreB(c, p), 100);
  }
});

test('B族成功：跑腿和临时短工逐格选路抵达', () => {
  for (const id of ['run', 'oddjob']) {
    let [c, p] = open(id);
    for (const direction of c.solution) p = step(c, p, { type: 'move', direction });
    assert.equal(p.done, true);
    assert.equal(scoreB(c, p), 100);
  }
});

test('B族成功：搬运和危棚调整重心后穿过障碍', () => {
  for (const id of ['carry', 'danger']) {
    let [c, p] = open(id);
    for (const stage of c.stages) {
      p = step(c, p, { type: 'shift', direction: stage.balance });
      p = step(c, p, { type: 'advance', lane: stage.safeLane });
    }
    assert.equal(p.done, true);
    assert.equal(scoreB(c, p), 100);
  }
});

test('B族成功：双人与三人接力响应逐站光信号', () => {
  for (const id of ['coop', 'trio']) {
    let [c, p] = open(id);
    for (const station of c.stations) p = step(c, p, { type: 'pass', station: station.id, cue: station.cue });
    assert.equal(p.done, true);
    assert.equal(scoreB(c, p), 100);
  }
});

test('B族成功：三杯逐次置换后选真实球位', () => {
  let [c, p] = open('shellgame');
  let ball = c.startCup;
  c.swaps.forEach(([a, b], index) => {
    ball = ball === a ? b : ball === b ? a : ball;
    p = step(c, p, { type: 'watch', swapIndex: index });
  });
  p = step(c, p, { type: 'choose', cup: ball });
  assert.equal(p.done, true);
  assert.equal(scoreB(c, p), 100);
});

test('B族错误：非法或过时输入不改进度，且错误答案低于正确答案', () => {
  const invalid = {
    shoot: { type: 'move', direction: 'diagonal' },
    edit: { type: 'select', cardId: 'unknown' },
    deliverProject: { type: 'select', cardId: 'unknown' },
    run: { type: 'move', direction: 'up' },
    oddjob: { type: 'move', direction: 'up' },
    carry: { type: 'advance', lane: 2 },
    danger: { type: 'advance', lane: 2 },
    coop: { type: 'pass', station: 'wrong', cue: 'green' },
    trio: { type: 'pass', station: 'wrong', cue: 'green' },
    shellgame: { type: 'watch', swapIndex: 1 },
  };
  for (const id of ids) {
    const [c, p] = open(id);
    const result = reduceB(c, p, invalid[id]);
    assert.equal(typeof result.error, 'string', id);
    assert.deepEqual(result.progress, p, id);
    assert.equal(scoreB(c, p), 0, id);
    assert.deepEqual(reduceB(c, p, { type: 'score', score: 100, cash: 999 }).progress, p);
  }
  for (const id of ['edit', 'deliverProject']) {
    let [c, p] = open(id);
    p = step(c, p, { type: 'select', cardId: c.correctOrder.at(-1) });
    assert.ok(scoreB(c, p) < 100);
  }
});

test('B族错误：多种种子路线可走通且无效操作不会消耗回合', () => {
  for (const id of ['run', 'oddjob']) for (let seed = 0; seed < 30; seed++) {
    const c = createB(seed, `route:${seed}`, id);
    let p = initialB(c);
    for (const direction of c.solution) {
      const before = p;
      const rejected = reduceB(c, p, { type: 'move', direction: 'up', cash: 999 });
      assert.ok(rejected.error);
      assert.strictEqual(rejected.progress, before);
      p = step(c, p, { type: 'move', direction });
    }
    assert.equal(scoreB(c, p), 100);
  }
});

test('B族错误：原型链属性不能作为摄影或路线方向', () => {
  for (const id of ['shoot', 'run']) for (const direction of ['toString', '__proto__', 'constructor']) {
    const [challenge, progress] = open(id);
    const result = reduceB(challenge, progress, { type: 'move', direction });
    assert.equal(typeof result.error, 'string');
    assert.strictEqual(result.progress, progress);
  }
});

test('B族错误：错误拍摄、错序、失衡、错灯号与错杯只得较低分', () => {
  {
    let [c, p] = open('shoot');
    p = step(c, p, { type: 'shoot' });
    assert.equal(scoreB(c, p), 0);
  }
  for (const id of ['edit', 'deliverProject']) {
    let [c, p] = open(id);
    for (const cardId of [...c.correctOrder].reverse()) p = step(c, p, { type: 'select', cardId });
    assert.ok(scoreB(c, p) < 100);
    assert.ok(reduceB(c, p, { type: 'select', cardId: c.correctOrder[0] }).error);
  }
  for (const id of ['carry', 'danger']) {
    let [c, p] = open(id);
    const first = c.stages[0];
    p = step(c, p, { type: 'shift', direction: first.balance === 'left' ? 'right' : 'left' });
    p = step(c, p, { type: 'advance', lane: first.safeLane });
    assert.equal(p.strikes, 1);
    for (const stage of c.stages.slice(1)) {
      p = step(c, p, { type: 'shift', direction: stage.balance });
      p = step(c, p, { type: 'advance', lane: stage.safeLane });
    }
    assert.equal(p.done, true);
    assert.ok(scoreB(c, p) < 100);
  }
  for (const id of ['coop', 'trio']) {
    let [c, p] = open(id);
    const first = c.stations[0];
    p = step(c, p, { type: 'pass', station: first.id, cue: first.cue === 'red' ? 'blue' : 'red' });
    assert.equal(p.mistakes, 1);
    for (const station of c.stations.slice(1)) p = step(c, p, { type: 'pass', station: station.id, cue: station.cue });
    assert.equal(p.done, true);
    assert.ok(scoreB(c, p) < 100);
  }
  {
    let [c, p] = open('shellgame');
    for (let i = 0; i < c.swaps.length; i++) p = step(c, p, { type: 'watch', swapIndex: i });
    const stale = reduceB(c, p, { type: 'watch', swapIndex: 0 });
    assert.ok(stale.error);
    assert.strictEqual(stale.progress, p);
    p = step(c, p, { type: 'choose', cup: (p.trackedCup + 1) % 3 });
    assert.equal(scoreB(c, p), 0);
  }
});
