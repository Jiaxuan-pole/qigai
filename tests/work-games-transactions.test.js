import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../public/game/data.js';
import { fresh, sellBottles, sellFish, salvageDispose, deliverProject, autoResolvePending, buyNow, useItem, travelTo } from '../public/game/engine.js';
import { makeItem } from '../public/game/items.js';
import { finishWorkGame } from '../public/game/work-games.js';
import { validateSave } from '../public/game/save.js';

before(loadData);
const state = () => { const s = fresh(37); s.pendingMorning = null; s.hour = 10; s.hourTick = 4; s.slot = 1; s.turn = 1; return s; };
const ledger = (s) => assert.equal(s.ledger.start + s.ledger.income - s.ledger.expense, s.cash);
const bottled = () => { const s = state(); s.bottles = 5; s.actors.xuan.location = 'recycle'; return s; };
const fished = () => { const s = state(); s.actors.xuan.location = 'market'; const item = makeItem(s, 'fish_rare', 'xuan'); return [s, item.uid]; };
const salvaged = () => { const s = state(); s.actors.xuan.location = 'recycle'; const item = makeItem(s, 'phone', 'xuan'); return [s, item.uid]; };
const projected = () => { const s = state(); s.actors.xuan.location = 'market'; s.flags.project = { stage: 3 }; makeItem(s, 'promo_video', 'xuan'); return s; };

test('四种主动交易原收入只入账一次，各建一局待办', () => {
  const cases = [
    [bottled(), (s) => sellBottles(s, 'xuan', { controlledActorId: 'xuan' }), 5, 'sellBottles'],
    ...[[fished, sellFish, 14, 'sellFish'], [salvaged, salvageDispose, 24, 'salvageSell']].map(([setup, fn, pay, variant]) => {
      const [s, uid] = setup();
      return [s, (v) => fn === sellFish ? fn(v, 'xuan', uid, { controlledActorId: 'xuan' }) : fn(v, uid, 'sell', { actorId: 'xuan', controlledActorId: 'xuan' }), pay, variant];
    }),
    [projected(), (s) => deliverProject(s, 'xuan', { controlledActorId: 'xuan' }), 45, 'deliverProject'],
  ];
  for (const [beforeState, act, pay, variant] of cases) {
    const out = act(beforeState);
    assert.equal(out.error, undefined, variant);
    assert.equal(out.state.cash, beforeState.cash + pay, variant);
    assert.equal(out.state.ledger.income, beforeState.ledger.income + pay, variant);
    assert.equal(out.state.pending.workGames.length, 1, variant);
    assert.equal(out.state.pending.workGames[0].basePay, pay, variant);
    assert.equal(out.state.pending.workGames[0].variant, variant);
    assert.equal(out.state.pending.workGames[0].actorId, 'xuan');
    ledger(out.state);
    assert.equal(validateSave(out.state).ok, true, variant);
    const done = finishWorkGame(out.state, out.gameId, { forfeit: true });
    assert.equal(done.bonus, 0);
    assert.equal(done.state.cash, beforeState.cash + pay);
    assert.equal(finishWorkGame(done.state, out.gameId).error, '不是当前挑战');
    ledger(done.state);
  }
});

test('非受控交易与送礼不建待办，非法交易保持原错误和状态', () => {
  const [fish, fishUid] = fished();
  const [old, oldUid] = salvaged();
  const cases = [
    [bottled(), (s) => sellBottles(s, 'xuan', { controlledActorId: 'fan' }), 5],
    [fish, (s) => sellFish(s, 'xuan', fishUid, { controlledActorId: 'fan' }), 14],
    [old, (s) => salvageDispose(s, oldUid, 'sell', { actorId: 'xuan', controlledActorId: 'fan' }), 24],
    [projected(), (s) => deliverProject(s, 'xuan', { controlledActorId: 'fan' }), 45],
  ];
  for (const [beforeState, act, pay] of cases) {
    const out = act(beforeState);
    assert.equal(out.error, undefined);
    assert.equal(out.state.cash, beforeState.cash + pay);
    assert.equal(out.state.pending.workGames.length, 0);
    assert.equal(out.state.daily.report.activities.length, 1);
    assert.equal(out.state.daily.report.activities[0].income, pay);
    assert.equal(out.state.daily.report.activities[0].controlledActorId, null);
    ledger(out.state);
  }
  const keep = salvaged();
  assert.equal(salvageDispose(keep[0], keep[1], 'keep', { actorId: 'xuan', controlledActorId: 'xuan' }).state.pending.workGames.length, 0);
  const gift = salvaged(); gift[0].actors.xuan.location = 'cinema';
  assert.equal(salvageDispose(gift[0], gift[1], 'gift', { actorId: 'xuan', npcId: 'reg_xu', controlledActorId: 'xuan' }).state.pending.workGames.length, 0);
  const wrong = bottled(); wrong.actors.xuan.location = 'camp';
  const rejected = sellBottles(wrong, 'xuan', { controlledActorId: 'xuan' });
  assert.match(rejected.error, /电子回收巷/);
  assert.strictEqual(rejected.state, wrong);
  assert.strictEqual(sellFish(fish, 'fan', fishUid, { controlledActorId: 'fan' }).state, fish);
});

test('待办阻止即时消费及移动，自动放弃不付额外奖金', () => {
  const [s, uid] = fished();
  const sold = sellFish(s, 'xuan', uid, { controlledActorId: 'xuan' });
  const pending = sold.state;
  for (const result of [buyNow(pending, 'xuan', []), useItem(pending, 'xuan', s.items[0].uid), travelTo(pending, 'xuan', 'camp'), sellBottles(pending, 'xuan')]) {
    assert.match(result.error, /先完成手头小游戏/);
    assert.strictEqual(result.state, pending);
  }
  const resolved = autoResolvePending(pending);
  assert.equal(resolved.error, undefined);
  assert.equal(resolved.state.pending.workGames.length, 0);
  assert.equal(resolved.state.workGameCompleted.length, 1);
  assert.equal(resolved.state.cash, s.cash + 14);
  assert.equal(resolved.state.ledger.income, s.ledger.income + 14);
  ledger(resolved.state);
});

test('重复来源和非法金额不改变原交易', () => {
  const [duplicateState, originalUid] = fished();
  const first = sellFish(duplicateState, 'xuan', originalUid, { controlledActorId: 'xuan' });
  const afterFirst = finishWorkGame(first.state, first.gameId, { forfeit: true }).state;
  const repeatedItem = makeItem(afterFirst, 'fish_common', 'xuan');
  repeatedItem.uid = originalUid;
  const duplicate = sellFish(afterFirst, 'xuan', originalUid, { controlledActorId: 'xuan' });
  assert.equal(duplicate.error, '挑战已创建');
  assert.strictEqual(duplicate.state, afterFirst);
  const [s, uid] = fished();
  s.items.find((item) => item.uid === uid).uid = 'x'.repeat(100);
  const rejected = sellFish(s, 'xuan', 'x'.repeat(100), { controlledActorId: 'xuan' });
  assert.match(rejected.error, /挑战参数无效/);
  assert.strictEqual(rejected.state, s);
  const bottle = bottled(); bottle.bottles = 10001;
  const large = sellBottles(bottle, 'xuan', { controlledActorId: 'xuan' });
  assert.match(large.error, /挑战参数无效/);
  assert.strictEqual(large.state, bottle);
});

test('新档初始化报告和挑战队列', () => {
  const s = fresh(41);
  assert.deepEqual(s.pending.workGames, []);
  assert.deepEqual(s.workGameCompleted, []);
  assert.equal(s.daily.report.day, 1);
  assert.equal(s.daily.report.startCash, 72);
  assert.equal(s.daily.report.activities.length, 0);
  assert.equal(validateSave(s).ok, true);
});
