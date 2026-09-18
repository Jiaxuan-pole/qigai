import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../public/game/data.js';
import * as engine from '../public/game/engine.js';
import { settle } from '../public/game/settle.js';
import { makeItem } from '../public/game/items.js';
import { finishWorkGame } from '../public/game/work-games.js';

before(loadData);

function ready() {
  const state = engine.fresh(443);
  state.pendingMorning = null;
  state.plan = { xuan: Array(16).fill(null), fan: Array(16).fill(null), ma: Array(16).fill(null) };
  return state;
}

test('连续三小时回收每小时取得收入与消耗体力，不进入一次性 busy', () => {
  const input = ready();
  let result = engine.assign(input, 'xuan', 6, 'scavenge', { duration: 3 });
  assert.equal(result.error, undefined);
  for (let hour = 0; hour < 3; hour++) {
    assert.equal(result.state.plan.xuan[hour]?.id, 'scavenge');
    assert.equal(result.state.plan.xuan[hour]?.hours, 1);
    result = settle(result.state);
    assert.equal(result.error, undefined);
    assert.equal(result.state.cash, 72 + 10 * (hour + 1));
    assert.equal(result.state.actors.xuan.energy, 100 - 20 * (hour + 1));
    assert.equal(result.state.busy.xuan, null);
  }
  assert.equal(input.plan.xuan[0], null);
});

test('长休息遇工作挑战暂停后仍保留下一小时计划', () => {
  let state = ready();
  state.actors.fan.energy = 0;
  state = engine.assign(state, 'fan', 6, 'sleep', { duration: 3 }).state;
  state = engine.assign(state, 'xuan', 6, 'scavenge').state;
  let result = settle(state, { controlledActorId: 'xuan' });
  assert.equal(result.error, undefined);
  assert.equal(result.state.actors.fan.energy, 20);
  assert.equal(result.state.plan.fan[1]?.id, 'sleep');
  const paused = settle(result.state);
  assert.match(paused.error, /工作挑战/);
  assert.equal(paused.state, result.state);
  const game = result.state.pending.workGames[0];
  result = finishWorkGame(result.state, game.id, { forfeit: true });
  assert.equal(result.error, undefined);
  result = settle(result.state);
  assert.equal(result.error, undefined);
  assert.equal(result.state.actors.fan.energy, 40);
});

test('连续安排跨夜、跨开放时段或覆盖未来合作时原子拒绝', () => {
  for (const setup of [
    (s) => ({ s, hour: 21, id: 'sleep', duration: 2, error: /剩余小时/ }),
    (s) => ({ s, hour: 9, id: 'soup', duration: 2, error: /开放/ }),
    (s) => ({ s: engine.assign(s, 'fan', 8, 'coop').state, hour: 6, id: 'sleep', duration: 3, error: /合作|已安排/ }),
  ]) {
    const { s, hour, id, duration, error } = setup(ready());
    const before = JSON.stringify(s);
    const result = engine.assign(s, 'xuan', hour, id, { duration });
    assert.match(result.error || '', error);
    assert.equal(result.state, s);
    assert.equal(JSON.stringify(s), before);
  }
});

test('连续安排拒绝非法时长与超过当日剩余岗位', () => {
  for (const duration of [0, -1, 1.5, '2', NaN]) {
    const state = ready();
    assert.match(engine.assign(state, 'xuan', 6, 'sleep', { duration }).error || '', /时长/);
  }
  const state = ready();
  state.daily.orders.scavenge = 2;
  const result = engine.assign(state, 'xuan', 6, 'scavenge', { duration: 2 });
  assert.match(result.error || '', /岗位|次数/);
  assert.equal(result.state, state);
});

test('单小时兼容且每个行动的时长查询可用于选项', () => {
  const state = ready();
  const result = engine.assign(state, 'xuan', 6, 'sleep');
  assert.equal(result.error, undefined);
  assert.equal(result.state.plan.xuan[1], null);
  assert.equal(typeof engine.actionDuration, 'function');
  assert.ok(engine.actionDuration('sleep').options.includes(3));
  assert.ok(engine.actionDuration('scavenge').options.includes(2));
  assert.equal(engine.actionDuration('sleep').defaultHours, 2);
  assert.equal(engine.actionDuration('scavenge').defaultHours, 2);
  assert.equal(engine.actionDuration('clinic').defaultHours, 1);
  assert.equal(engine.actionDuration('missing'), null);
});

test('战斗进行中和待领取结果时都阻塞排程、移动与物品使用', () => {
  for (const phase of ['fighting', 'resolved']) {
    const state = ready();
    state.pending.combat = { phase };
    const beer = makeItem(state, 'beer', 'camp');
    for (const result of [
      engine.assign(state, 'xuan', 6, 'sleep', { duration: 2 }),
      engine.travelTo(state, 'xuan', 'market'),
      engine.useItem(state, 'xuan', beer.uid),
    ]) {
      assert.match(result.error || '', /战斗/);
      assert.equal(result.state, state);
    }
  }
});

test('行动预估运行真实逐小时结算，保留精神延迟并计算个人床位与工资加成', () => {
  assert.equal(typeof engine.actionEstimate, 'function');
  const state = ready();
  state.actors.xuan.energy = 10;
  const bed = makeItem(state, 'bed_basic', 'camp');
  state.camp.placements.push({ uid: bed.uid, slot: 'f0', rotation: 0 });
  const before = JSON.stringify(state);
  const sleeping = engine.actionEstimate(state, 'xuan', 'sleep', 3);
  assert.equal(sleeping.error, undefined);
  assert.equal(sleeping.energy, 90);
  assert.equal(sleeping.cash, 0);
  assert.equal(sleeping.completedHours, 3);
  assert.equal(JSON.stringify(state), before);
  state.actors.xuan.energy = 100;
  state.flags.trialPassed = true;
  const work = engine.actionEstimate(state, 'xuan', 'repair', 2);
  assert.equal(work.error, undefined);
  assert.equal(work.cash, 60);
  assert.equal(work.energy, -40);
  assert.equal(work.mind, 0);
  assert.equal(work.pendingMind, -2);
});

test('睡眠预估按同小时已安排的其他睡眠者分配唯一床位', () => {
  let state = ready();
  const bed = makeItem(state, 'bed_basic', 'camp');
  state.camp.placements.push({ uid: bed.uid, slot: 'f0', rotation: 0 });
  state.actors.xuan.energy = 0;
  state.actors.fan.energy = 0;
  state = engine.assign(state, 'xuan', 6, 'sleep', { duration: 2 }).state;
  const estimate = engine.actionEstimate(state, 'fan', 'sleep', 2);
  assert.equal(estimate.error, undefined);
  assert.equal(estimate.energy, 40);
});
