import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../public/game/data.js';
import { fresh } from '../public/game/engine.js';
import { observeState } from '../scripts/autoplay/observe.js';
import { applyCommand, runGame } from '../scripts/autoplay/runner.js';
import { chooseFoodPurchase, planActions } from '../scripts/autoplay/policies.js';

before(loadData);

test('自动对局观察与指令使用真实小时', () => {
  const state = fresh(1000);
  const view = observeState(state);
  assert.equal(view.hour, 6);
  assert.equal(view.plan.xuan.length, 16);
  const result = applyCommand(state, { kind: 'assign', actorId: 'xuan', actionId: 'sleep' });
  assert.equal(result.error, undefined);
  assert.equal(result.state.plan.xuan[0].id, 'sleep');
});

test('同一营业时段的第二小时不重复安排已用完岗位，睡眠阈值按20恢复', () => {
  const state = fresh(1000);
  state.hour = 7;
  state.daily.orders.kitchen = 1;
  state.actors.xuan.energy = 14;
  const view = observeState(state);
  const commands = planActions(view, 'balanced');
  assert.notEqual(commands.find((command) => command.actorId === 'fan').actionId, 'kitchen');
  assert.equal(commands.find((command) => command.actorId === 'xuan').actionId, 'sleep');
});

test('上一小时采买不占本小时额度，事件预留按小时下标读取', () => {
  const state = fresh(1000);
  state.hour = 7;
  state.actors.xuan.location = 'market';
  state.daily.errands['xuan:6'] = true;
  state.effectiveFood = 0;
  state.plan.fan[1] = { id: 'oddjob', zone: 'market', eventUid: 'event-now' };
  const view = observeState(state);
  assert.equal(chooseFoodPurchase(view, 'balanced')?.actorId, 'xuan');
  assert.equal(planActions(view, 'balanced').find((command) => command.actorId === 'fan').reserved, true);
});

test('单局按每天16小时推进且单独统计行动小时', async () => {
  const result = await runGame({ seed: 1000, strategyId: 'conservative', maxDays: 2 });
  assert.equal(result.completedDays, 2);
  assert.equal(result.hourTick, 32);
  assert.equal(result.turns, 8);
  assert.ok(result.actionCount >= 32);
});
