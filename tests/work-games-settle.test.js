import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../public/game/data.js';
import { settle } from '../public/game/settle.js';
import { finishWorkGame } from '../public/game/work-games.js';
import { makeItem } from '../public/game/items.js';
import { plan, ready } from './engine-fixtures.js';

before(loadData);

function setup(seed = 801, options = {}) {
  const s = ready(seed, { turn: 16, ma: true, ...options });
  s.cash = 100; s.ledger = { start: 100, income: 0, expense: 0 };
  s.parts = 10; s.battery = 10;
  for (const actor of Object.values(s.actors)) { actor.energy = 100; actor.health = 100; actor.food = 100; actor.warmth = 100; actor.mind = 100; }
  return s;
}

function schedule(s, id, action, options = {}) {
  return plan(s, id, action, options);
}

test('固定工资十一种行动只给受控者一局且基础工资照发', () => {
  const cases = [
    ['scavenge', 'xuan', 5], ['kitchen', 'fan', 6], ['repair', 'xuan', 13],
    ['table', 'xuan', 14], ['shoot', 'fan', 15], ['edit', 'fan', 13],
    ['run', 'ma', 9], ['carry', 'ma', 11], ['coop', 'xuan', 33],
    ['trio', 'xuan', 44], ['danger', 'ma', 12],
  ];
  for (const [action, actor, pay] of cases) {
    let s = setup(802);
    s = schedule(s, actor, action, action === 'trio' ? { participants: ['xuan', 'fan', 'ma'] } : {});
    const before = s.cash;
    const r = settle(s, { controlledActorId: actor });
    assert.equal(r.error, undefined, `${action}: ${r.error}`);
    assert.equal(r.state.cash, before + pay - (action === 'trio' ? 4 : 0), action);
    assert.equal(r.state.pending.workGames?.length, 1, action);
    assert.equal(r.state.pending.workGames[0].basePay, pay, action);
    assert.equal(r.state.pending.workGames[0].variant, action);
    assert.match(settle(r.state, { controlledActorId: actor }).error, /工作挑战/);
    const finished = finishWorkGame(r.state, r.state.pending.workGames[0].id, { forfeit: true });
    assert.equal(finished.bonus, 0, action);
  }
});

test('团队只弹一局并保留原工资', () => {
  for (const [action, pay] of [['coop', 33], ['trio', 44]]) {
    let s = setup(803);
    s = schedule(s, 'xuan', action, action === 'trio' ? { participants: ['xuan', 'fan', 'ma'] } : {});
    const r = settle(s, { controlledActorId: 'fan' });
    assert.equal(r.error, undefined);
    assert.equal(r.state.cash, 100 + pay - (action === 'trio' ? 4 : 0));
    assert.equal(r.state.ledger.income, pay);
    assert.equal(r.state.pending.workGames.length, 1);
    assert.equal(r.state.pending.workGames[0].jobActorId, 'xuan');
    assert.equal(r.state.pending.workGames[0].controllerId, 'fan');
  }
});

test('非受控劳动不阻塞且可推进', () => {
  let s = setup(804);
  s = schedule(s, 'xuan', 'scavenge');
  const automatic = settle(s);
  const teammate = settle(s, { controlledActorId: 'fan' });
  assert.equal(automatic.error, undefined);
  assert.equal(teammate.error, undefined);
  assert.equal(teammate.state.cash, automatic.state.cash);
  assert.equal(teammate.state.pending.workGames?.length ?? 0, 0);
  assert.equal(settle(teammate.state).error, undefined);
});

test('实际合同加成进入基础工资，瓶罐收集只锁零基价', () => {
  for (const [action, actor, flag, base] of [
    ['repair', 'xuan', 'trialPassed', 15], ['shoot', 'fan', 'xuContract', 19],
    ['run', 'ma', 'chenFixedRun', 11],
  ]) {
    let s = setup(805); s.flags[flag] = true; s = schedule(s, actor, action);
    const r = settle(s, { controlledActorId: actor });
    assert.equal(r.state.pending.workGames[0].basePay, base, action);
  }
  let cart = setup(809);
  makeItem(cart, 'cart', 'ma');
  cart = schedule(cart, 'ma', 'carry');
  assert.equal(settle(cart, { controlledActorId: 'ma' }).state.pending.workGames[0].basePay, 14);
  let s = setup(806);
  s = schedule(s, 'xuan', 'bottles', { zone: 'market' });
  const r = settle(s, { controlledActorId: 'xuan' });
  assert.equal(r.error, undefined);
  assert.equal(r.state.pending.workGames[0].basePay, 0);
  assert.ok(r.state.bottles > (s.bottles || 0));
  assert.equal(r.state.cash, s.cash);
});

test('自动单人收入与零收入行动逐项进入日报', () => {
  let s = setup(807);
  s = schedule(s, 'xuan', 'rest');
  s = schedule(s, 'fan', 'scavenge');
  const r = settle(s, { controlledActorId: 'xuan' });
  assert.equal(r.error, undefined);
  const items = r.state.daily.report.activities;
  assert.equal(items.length, 2);
  assert.equal(items.find(item => item.actorId === 'fan').income, 5);
  assert.equal(items.find(item => item.actorId === 'fan').label, '分类回收');
  assert.equal(items.find(item => item.actorId === 'xuan'), undefined);
  assert.equal(items.find(item => item.actorId === 'ma').income, 0);
  assert.equal(r.state.daily.report.partial, true);
});

test('夜间日报只结算一次并在新日建立新快照', () => {
  let s = setup(808, { turn: 19, slot: 3 });
  s = schedule(s, 'xuan', 'coop');
  const r = settle(s, { controlledActorId: 'xuan' });
  assert.equal(r.error, undefined);
  assert.equal(r.state.lastDayReport.day, 5);
  assert.equal(r.state.lastDayReport.activities.length, 2);
  const shared = r.state.lastDayReport.activities.find(item => item.sourceUid.endsWith(':coop'));
  assert.deepEqual(shared.participants, ['xuan', 'fan']);
  assert.equal(shared.income, 33);
  assert.equal(r.state.lastDayReport.totalAutoIncome, 33);
  assert.equal(r.state.day, 6);
  assert.equal(r.state.daily.report.day, 6);
  assert.equal(r.state.daily.report.partial, false);
  assert.equal(r.state.daily.report.activities.length, 0);
  assert.equal(r.state.pending.workGames.length, 1);
  // 新一天清晨会先弹今日事；这里只验工作挑战本身会挡住推进，所以先把晨间节点清掉。
  assert.match(settle({ ...r.state, pendingMorning: null }, { controlledActorId: 'xuan' }).error, /工作挑战/);
});
