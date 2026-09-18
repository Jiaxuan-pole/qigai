import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../public/game/data.js';
import { autoResolvePending } from '../public/game/engine.js';
import { makeItem } from '../public/game/items.js';
import { settle } from '../public/game/settle.js';
import { ready, plan } from './engine-fixtures.js';

before(loadData);

function anglers(seed) {
  let state = ready(seed, { ma: true, turn: 4, slot: 0 });
  for (const actorId of ['xuan', 'fan']) {
    makeItem(state, 'fishing_rod', actorId);
    makeItem(state, 'fish_bait', actorId);
    state = plan(state, actorId, 'fish');
  }
  return state;
}

function findTwoBites() {
  for (let seed = 1; seed < 1000; seed++) {
    const state = anglers(seed);
    const result = settle(state, { controlledActorId: 'xuan' });
    if (result.state.pending.fishingQte.some((bite) => bite.actorId === 'xuan')) {
      const manual = settle(state, { controlledActorId: 'fan' });
      if (manual.state.pending.fishingQte.some((bite) => bite.actorId === 'fan')) return state;
    }
  }
  throw new Error('No shared fishing seed');
}

test('队友钓鱼自动完成：只保留当前人物的圆环，自动结果按原策略结算', () => {
  const state = findTwoBites();
  const xuan = settle(state, { controlledActorId: 'xuan' });
  const fan = settle(state, { controlledActorId: 'fan' });
  assert.equal(xuan.error, undefined);
  assert.deepEqual(xuan.state.pending.fishingQte.map((bite) => bite.actorId), ['xuan']);
  assert.deepEqual(fan.state.pending.fishingQte.map((bite) => bite.actorId), ['fan']);
  assert.ok(xuan.events.some((event) => event.includes('收线')));
  const baseline = autoResolvePending(fan.state).state;
  assert.deepEqual(xuan.state.items.filter((item) => item.itemId.startsWith('fish_') && item.container === 'fan'),
    baseline.items.filter((item) => item.itemId.startsWith('fish_') && item.container === 'fan'));
});

test('无控制角色：旧互动无待办，第二小时可以直接结算', () => {
  let state = ready(901, { ma: true, turn: 4, slot: 0 });
  state = plan(state, 'xuan', 'beg', { zone: 'station', style: 'ask' });
  state = plan(state, 'fan', 'bins', { zone: 'station' });
  makeItem(state, 'fishing_rod', 'ma');
  makeItem(state, 'fish_bait', 'ma');
  state = plan(state, 'ma', 'fish');
  const first = settle(state);
  assert.equal(first.error, undefined);
  assert.deepEqual(first.state.pending.beg, []);
  assert.deepEqual(first.state.pending.bins, []);
  assert.deepEqual(first.state.pending.fishingQte, []);
  assert.equal(first.state.pending.riverFight, null);
  assert.deepEqual(first.arrivals.filter((arrival) => ['beg', 'bins'].includes(arrival.kind)), []);
  assert.equal(first.state.ledger.start + first.state.ledger.income - first.state.ledger.expense, first.state.cash);
  assert.equal(settle(first.state).error, undefined);
});

test('三人混排：自动乞讨与翻桶当小时落账，只留下控制人物的互动', () => {
  let state = ready(902, { ma: true, turn: 4, slot: 0 });
  state = plan(state, 'xuan', 'beg', { zone: 'station', style: 'ask' });
  state = plan(state, 'fan', 'bins', { zone: 'station' });
  state = plan(state, 'ma', 'bins', { zone: 'market' });
  const result = settle(state, { controlledActorId: 'fan' });
  assert.equal(result.error, undefined);
  assert.equal(result.state.pending.beg.length, 0);
  assert.ok(result.state.pending.bins.length > 0);
  assert.ok(result.state.pending.bins.every((board) => board.actorId === 'fan'));
  assert.deepEqual(result.arrivals.map((arrival) => arrival.actorId), ['fan']);
  assert.equal(result.state.ledger.start + result.state.ledger.income - result.state.ledger.expense, result.state.cash);
  assert.ok(result.events.some((event) => event.includes('开口求助')));
  assert.ok(result.events.some((event) => event.includes('翻了')));
});

test('固定种子自动策略与手动收尾得到相同现金和物品', () => {
  let state = ready(906, { ma: true, turn: 4, slot: 0 });
  state = plan(state, 'xuan', 'beg', { zone: 'station', style: 'ask' });
  state = plan(state, 'fan', 'bins', { zone: 'market' });
  const automatic = settle(state).state;
  const manual = autoResolvePending(settle(state, { controlledActorId: 'xuan' }).state).state;
  assert.equal(automatic.cash, manual.cash);
  assert.deepEqual(automatic.items, manual.items);
  assert.equal(automatic.ledger.income, manual.ledger.income);
  const { report: automaticReport, ...automaticDaily } = automatic.daily;
  const { report: manualReport, ...manualDaily } = manual.daily;
  assert.deepEqual(automaticDaily, manualDaily);
  assert.equal(automaticReport.activities.some((item) => item.actorId === 'xuan' && item.sourceUid.endsWith(':beg') && item.income > 0), true);
  assert.equal(manualReport.activities.some((item) => item.actorId === 'xuan' && item.sourceUid.endsWith(':beg')), false);
  assert.equal(automaticReport.activities.find((item) => item.actorId === 'fan').income,
    manualReport.activities.find((item) => item.actorId === 'fan').income);
});

test('队友河斗不弹窗，但湿衣、体力和日限仍结算', () => {
  let state = ready(1, { ma: true, turn: 4, slot: 0 });
  state.actors.ma.fishingDryStreak = 2;
  makeItem(state, 'fishing_rod', 'ma');
  makeItem(state, 'fish_bait', 'ma');
  state = plan(state, 'ma', 'fish');
  const energy = state.actors.ma.energy;
  const result = settle(state, { controlledActorId: 'xuan' });
  assert.equal(result.error, undefined);
  assert.equal(result.state.pending.riverFight, null);
  assert.equal(result.state.flags.riverFightDay, state.day);
  assert.equal(result.state.actors.ma.clothes.wet, true);
  assert.ok(result.state.actors.ma.energy <= energy - 5);
  assert.ok(result.events.some((event) => event.includes('跳进河里')));
});
