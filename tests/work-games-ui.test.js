import test from 'node:test';
import assert from 'node:assert/strict';
import { createA, initialA, reduceA } from '../public/game/work-games-families-a.js';
import { createB, initialB, reduceB } from '../public/game/work-games-families-b.js';
import { mountWorkGame, renderWorkGameMarkup, workInputForAction } from '../public/ui/work-games.js';

function session(variant) {
  const a = ['scavenge', 'bottles', 'sellBottles', 'kitchen', 'repair', 'phonestall', 'table', 'sellFish', 'salvageSell'].includes(variant);
  const challenge = a ? createA(1924, `ui-${variant}`, variant) : createB(1924, `ui-${variant}`, variant);
  return { actorId: 'xuan', challenge, progress: a ? initialA(challenge) : initialB(challenge) };
}

function fakeRoot() {
  const handlers = new Map();
  return {
    innerHTML: '', scrollTop: 0,
    addEventListener(type, handler) { handlers.set(type, handler); },
    removeEventListener(type) { handlers.delete(type); },
    contains() { return true; }, querySelectorAll() { return []; },
    emit(action, data = {}) {
      const node = { dataset: { workAction: action, ...data } };
      handlers.get('click')({ target: { closest: () => node } });
    },
    key(key) {
      let stopped = false;
      handlers.get('keydown')({ key, preventDefault() {}, stopPropagation() { stopped = true; } });
      return stopped;
    },
    get listenerCount() { return handlers.size; },
  };
}

test('十族输入适配逐个提交合法离散操作', () => {
  const cases = [
    ['scavenge', [['piece', { id: 'piece-0' }], ['bin', { id: 'parts' }]], { type: 'place', pieceId: 'piece-0', binId: 'parts' }],
    ['kitchen', [['ready', {}]], { type: 'ready' }],
    ['repair', [['rotate', { index: '4' }]], { type: 'rotate', index: 4 }],
    ['table', [['flag', { id: 'row-0' }]], { type: 'flag', rowId: 'row-0' }],
    ['shoot', [['move', { direction: 'right' }]], { type: 'move', direction: 'right' }],
    ['edit', [['select', { id: 'arrival' }]], { type: 'select', cardId: 'arrival' }],
    ['run', [['move', { direction: 'right' }]], { type: 'move', direction: 'right' }],
    ['carry', [['shift', { direction: 'left' }]], { type: 'shift', direction: 'left' }],
    ['coop', [['pass', { cue: 'red' }]], { type: 'pass', station: 'station-0', cue: 'red' }],
    ['shellgame', [['watch', {}]], { type: 'watch', swapIndex: 0 }],
  ];
  const originalDocument = globalThis.document;
  globalThis.document = { activeElement: null };
  try {
    for (const [variant, actions, expected] of cases) {
      const root = fakeRoot(); const inputs = [];
      const mounted = mountWorkGame(root, session(variant), { onInput(input) { inputs.push(input); }, onFinish() {}, onForfeit() {} });
      for (const [action, data] of actions) root.emit(action, data);
      assert.deepEqual(inputs, [expected], variant);
      assert.equal(Object.hasOwn(inputs[0], 'cash'), false);
      assert.equal(Object.hasOwn(inputs[0], 'score'), false);
      mounted.destroy(); assert.equal(root.listenerCount, 0);
    }
  } finally { globalThis.document = originalDocument; }
});

test('记忆回想和追杯不会泄露隐藏答案', () => {
  const memory = session('kitchen');
  memory.progress = reduceA(memory.challenge, memory.progress, { type: 'ready' }).progress;
  const html = renderWorkGameMarkup(memory);
  assert.ok(!html.includes('wg-order') || html.includes('wg-order-hidden'));
  for (const label of memory.challenge.dishes.map(d => d.label)) assert.ok(html.includes(label));
  assert.ok(!html.includes(memory.challenge.order.join(',')));
  const cups = session('shellgame');
  cups.progress = reduceB(cups.challenge, cups.progress, { type: 'watch', swapIndex: 0 }).progress;
  const cupHtml = renderWorkGameMarkup(cups);
  assert.ok(!cupHtml.includes('trackedCup'));
  assert.ok(!cupHtml.includes('startCup'));
  assert.ok(!cupHtml.includes('swapIndex'));
  assert.ok(!renderWorkGameMarkup(session('shellgame'), { showBall: false }).includes('wg-ball'));
});

test('键盘方向、放弃、结束与清理', () => {
  const originalDocument = globalThis.document;
  globalThis.document = { activeElement: null };
  try {
    const root = fakeRoot(), inputs = []; let forfeits = 0, finishes = 0;
    const mounted = mountWorkGame(root, session('shoot'), { onInput(input) { inputs.push(input); }, onFinish() { finishes++; }, onForfeit() { forfeits++; } });
    assert.equal(root.key('ArrowRight'), true);
    assert.deepEqual(inputs, [{ type: 'move', direction: 'right' }]);
    assert.equal(root.key(' '), true);
    root.emit('forfeit'); root.emit('finish');
    assert.equal(forfeits, 1); assert.equal(finishes, 1);
    mounted.destroy(); assert.equal(root.listenerCount, 0);
  } finally { globalThis.document = originalDocument; }
});

test('引擎拒绝错误步骤后显示反馈，仍可放弃退出', () => {
  const originalDocument = globalThis.document;
  globalThis.document = { activeElement: null };
  try {
    const root = fakeRoot(), s = session('run'); let forfeits = 0;
    const mounted = mountWorkGame(root, s, {
      onInput(input) {
        const reduced = reduceB(s.challenge, s.progress, input);
        return reduced.error ? { error: reduced.error } : { session: { ...s, progress: reduced.progress } };
      },
      onFinish() {}, onForfeit() { forfeits++; },
    });
    root.emit('move', { direction: 'left' });
    assert.match(root.innerHTML, /blocked road/);
    assert.equal(s.progress.moves, 0);
    root.emit('forfeit'); assert.equal(forfeits, 1);
    mounted.destroy();
  } finally { globalThis.document = originalDocument; }
});

test('放弃的零奖金来自结算回调并阻止重复结算', () => {
  const originalDocument = globalThis.document;
  globalThis.document = { activeElement: null };
  try {
    const root = fakeRoot(); let count = 0;
    const mounted = mountWorkGame(root, session('carry'), { onInput() {}, onFinish() {}, onForfeit() { count++; return { score: 0, bonus: 0 }; } });
    root.emit('forfeit'); root.emit('forfeit');
    assert.equal(count, 1);
    assert.match(root.innerHTML, /奖金 0 元/);
    mounted.destroy();
  } finally { globalThis.document = originalDocument; }
});

test('所有变体有独立题材，结果字段只由调用者提供', () => {
  const variants = ['scavenge', 'bottles', 'sellBottles', 'kitchen', 'repair', 'phonestall', 'table', 'sellFish', 'salvageSell', 'shoot', 'edit', 'deliverProject', 'run', 'oddjob', 'carry', 'danger', 'coop', 'trio', 'shellgame'];
  for (const variant of variants) {
    const s = session(variant), html = renderWorkGameMarkup(s);
    assert.ok(html.includes(s.challenge.title), variant);
    assert.ok(html.includes(s.challenge.instructions), variant);
    assert.ok(!html.includes('data-score='), variant);
    assert.ok(!html.includes('data-cash='), variant);
    for (const secret of ['answerId', 'correctOrder', 'solution', 'trackedCup', 'safeLane']) assert.ok(!html.includes(secret), `${variant}: ${secret}`);
  }
  const s = session('table'); s.progress.done = true;
  assert.ok(!renderWorkGameMarkup(s).includes('得分 100'));
});

test('搬运和合作交接完成最后一步后仍可结算退出', () => {
  for (const variant of ['carry', 'danger', 'coop', 'trio']) {
    const s = session(variant);
    if (s.challenge.family === 'balance') {
      for (const stage of s.challenge.stages) {
        s.progress = reduceB(s.challenge, s.progress, { type: 'shift', direction: stage.balance }).progress;
        s.progress = reduceB(s.challenge, s.progress, { type: 'advance', lane: stage.safeLane }).progress;
      }
    } else {
      for (const station of s.challenge.stations) s.progress = reduceB(s.challenge, s.progress, { type: 'pass', station: station.id, cue: station.cue }).progress;
    }
    assert.equal(s.progress.done, true);
    assert.match(renderWorkGameMarkup(s), /data-work-action="finish"/);
    assert.match(renderWorkGameMarkup(s, { result: { score: 100, bonus: 7 } }), /奖金 7 元/);
  }
});
