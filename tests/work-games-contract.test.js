import test from 'node:test';
import assert from 'node:assert/strict';
import { startWorkGame, stepWorkGame, finishWorkGame, workGameRegistry } from '../public/game/work-games.js';

const base = () => ({ seed: 42, day: 1, hourTick: 0, actionCount: 1, stateRevision: 5,
  cash: 172, ledger: { start: 72, income: 100, expense: 0 },
  actors: { xuan: { life: 'active' }, fan: { life: 'active' }, ma: { life: 'active' } }, pending: {} });
const request = (variant = 'table', extra = {}) => ({ actorId: 'xuan', controllerId: 'xuan', source: 'job',
  sourceUid: 'day1-job1', basePay: 100, variant, ...extra });
const open = (variant = 'table', extra = {}) => startWorkGame(base(), request(variant, extra));

test('奖金只结算一次，真实A族对账输入后基础工资不重发', () => {
  const opened = open();
  const original = opened.state.pending.workGames[0];
  const answer = original.challenge.rows.find(row => row.quantity * row.unitPrice !== row.total);
  const stepped = stepWorkGame(opened.state, opened.gameId, { type: 'flag', rowId: answer.id });
  assert.equal(stepped.session.progress.done, true);
  const finished = finishWorkGame(stepped.state, opened.gameId);
  assert.equal(finished.bonus, 25);
  assert.equal(finished.state.cash, 197);
  assert.equal(finished.state.ledger.income, 125);
  assert.equal(finished.state.pending.workGames.length, 0);
  const repeat = finishWorkGame(finished.state, opened.gameId);
  assert.ok(repeat.error);
  assert.strictEqual(repeat.state, finished.state);
  assert.equal(startWorkGame(finished.state, request()).error, '挑战已创建');
  assert.deepEqual(base().pending, {});
});

test('真实B族路线逐步走通，团队仅建一局并锁定控制者', () => {
  const started = open('oddjob', { actorId: 'xuan', controllerId: 'fan', participants: ['xuan', 'fan'] });
  assert.equal(started.state.pending.workGames.length, 1);
  assert.equal(started.state.pending.workGames[0].actorId, 'fan');
  assert.equal(started.state.pending.workGames[0].controllerId, 'fan');
  assert.equal(startWorkGame(started.state, request('oddjob', { controllerId: 'fan', participants: ['xuan', 'fan'] })).error, '挑战已创建');
  let state = started.state;
  for (const direction of state.pending.workGames[0].challenge.solution) {
    const result = stepWorkGame(state, started.gameId, { type: 'move', direction });
    assert.equal(result.error, undefined);
    state = result.state;
  }
  assert.equal(finishWorkGame(state, started.gameId).bonus, 25);
});

test('无控制者和失能者不会生成待办，放弃和死亡奖金为零', () => {
  const unattended = base();
  const skipped = startWorkGame(unattended, request('table', { controllerId: null }));
  assert.strictEqual(skipped.state, unattended);
  assert.equal(skipped.gameId, null);
  assert.equal(skipped.error, undefined);
  assert.equal(startWorkGame(unattended, request('unknown', { controllerId: null })).error, '挑战参数无效');
  assert.equal(open('table', { controllerId: 'fan' }).gameId, null);
  assert.equal(open('table', { controllerId: 'ma', participants: ['xuan', 'fan'] }).gameId, null);
  const opened = open();
  assert.equal(finishWorkGame(opened.state, opened.gameId, { forfeit: true }).bonus, 0);
  const dead = { ...opened.state, actors: { ...opened.state.actors, xuan: { life: 'dead' } } };
  assert.equal(finishWorkGame(dead, opened.gameId).bonus, 0);
});

test('过长来源ID与现金上界原子拒绝，放弃仍可结束', () => {
  const input = base();
  const longRequest = request('table', { sourceUid: 'x'.repeat(120) });
  let rejected;
  assert.doesNotThrow(() => { rejected = startWorkGame(input, longRequest); });
  assert.ok(rejected.error);
  assert.strictEqual(rejected.state, input);
  assert.equal(input.stateRevision, 5);
  assert.equal(input.cash, 172);
  const nearLimit = { ...base(), cash: 9_999_990, ledger: { start: 72, income: 9_999_918, expense: 0 } };
  const started = startWorkGame(nearLimit, request());
  const session = started.state.pending.workGames[0];
  const answer = session.challenge.rows.find(row => row.quantity * row.unitPrice !== row.total);
  const completed = stepWorkGame(started.state, started.gameId, { type: 'flag', rowId: answer.id }).state;
  const overflow = finishWorkGame(completed, started.gameId);
  assert.ok(overflow.error);
  assert.strictEqual(overflow.state, completed);
  assert.equal(completed.cash, 9_999_990);
  assert.equal(completed.pending.workGames.length, 1);
  const forfeited = finishWorkGame(completed, started.gameId, { forfeit: true });
  assert.equal(forfeited.bonus, 0);
  assert.equal(forfeited.state.cash, 9_999_990);
});

test('拒绝伪造分数现金、未知入口和非法金额', () => {
  assert.equal(open('constructor').error, '挑战参数无效');
  assert.equal(open('table', { basePay: NaN }).error, '挑战参数无效');
  assert.equal(open('table', { score: 100 }).error, '挑战参数无效');
  assert.equal(open('table', { basePay: 10001 }).error, '挑战参数无效');
  assert.equal(open('table', { sourceUid: 'x'.repeat(121) }).error, '挑战参数无效');
  const started = open();
  assert.equal(finishWorkGame(started.state, started.gameId, { score: 100 }).error, '结束参数无效');
  for (const input of [{ type: 'flag', rowId: 'row-0', score: 100 }, { type: 'flag', rowId: 'row-0', cash: 999 }, { type: 'flag', rowId: 'unknown' }]) {
    const result = stepWorkGame(started.state, started.gameId, input);
    assert.ok(result.error);
    assert.strictEqual(result.state, started.state);
  }
  assert.ok(workGameRegistry('bottles', 'job'));
  assert.ok(workGameRegistry('sellFish', 'sale'));
  assert.equal(workGameRegistry('sellFish', 'job'), null);
  const jobs = ['scavenge', 'bottles', 'kitchen', 'repair', 'table', 'shoot', 'edit', 'run', 'oddjob', 'carry', 'danger', 'coop', 'trio', 'shellgame', 'phonestall'];
  const sales = ['sellBottles', 'sellFish', 'salvageSell', 'deliverProject'];
  for (const variant of jobs) assert.ok(workGameRegistry(variant, 'job'), variant);
  for (const variant of sales) assert.ok(workGameRegistry(variant, 'sale'), variant);
  assert.equal(jobs.length + sales.length, 19);
});
