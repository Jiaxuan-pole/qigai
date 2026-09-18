import test from 'node:test';
import assert from 'node:assert/strict';
import { startWorkGame, stepWorkGame, finishWorkGame } from '../public/game/work-games.js';
import { normalizeWorkGames, validateWorkGames } from '../public/game/work-games-save.js';

const base = () => ({ seed: 42, day: 1, hourTick: 0, actionCount: 1, stateRevision: 5,
  cash: 172, ledger: { start: 72, income: 100, expense: 0 },
  actors: { xuan: { life: 'active' }, fan: { life: 'active' } }, pending: {} });
const open = () => startWorkGame(base(), { actorId: 'xuan', controllerId: 'xuan', source: 'job', sourceUid: 'job1', basePay: 100, variant: 'kitchen' });
const copied = state => JSON.parse(JSON.stringify(state));

test('旧档补缺与存档回读保留同题、进度和未派奖', () => {
  const old = base();
  const normalized = normalizeWorkGames(old);
  assert.deepEqual(normalized.pending.workGames, []);
  assert.deepEqual(normalized.workGameCompleted, []);
  assert.equal(validateWorkGames(normalized).ok, true);
  assert.equal(old.pending.workGames, undefined);
  const started = open();
  const ready = stepWorkGame(started.state, started.gameId, { type: 'ready' });
  const restored = copied(ready.state);
  assert.equal(validateWorkGames(restored).ok, true);
  assert.deepEqual(restored.pending.workGames[0].challenge, ready.state.pending.workGames[0].challenge);
  assert.deepEqual(restored.pending.workGames[0].progress, ready.state.pending.workGames[0].progress);
  assert.equal(restored.cash, 172);
  let state = restored;
  for (const dishId of restored.pending.workGames[0].challenge.order) state = stepWorkGame(state, started.gameId, { type: 'pick', dishId }).state;
  assert.equal(finishWorkGame(state, started.gameId).bonus, 25);
});

test('拒绝伪造题目、进度、轨迹、ID及超长输入', () => {
  const started = open();
  for (const change of [
    session => { session.progress.done = true; },
    session => { session.challenge.order[0] = 'forged'; },
    session => { session.inputs = [{ type: 'ready', cash: 999 }]; },
    session => { session.inputs = Array(33).fill({ type: 'ready' }); },
    session => { session.basePay = NaN; },
    session => { session.id = 'work:forged'; },
  ]) {
    const state = copied(started.state);
    change(state.pending.workGames[0]);
    assert.equal(validateWorkGames(state).ok, false);
  }
  const duplicate = copied(started.state);
  duplicate.pending.workGames.push(copied(duplicate.pending.workGames[0]));
  assert.equal(validateWorkGames(duplicate).ok, false);
  const completed = copied(started.state);
  completed.workGameCompleted.push(started.gameId);
  assert.equal(validateWorkGames(completed).ok, false);
});

test('完成 ID 解析长度分隔，拒绝未结算、未来与待办冲突记录', () => {
  const started = open();
  const sameRevision = base();
  sameRevision.workGameCompleted = [started.gameId];
  assert.equal(validateWorkGames(sameRevision).ok, false);

  const future = { ...base(), stateRevision: 9, workGameCompleted: ['work:42:2:16:1:5:job:6-future:xuan:xuan:kitchen'] };
  assert.equal(validateWorkGames(future).ok, false);

  const forgedBoundary = { ...base(), pending: { workGames: [] }, day: 2, hourTick: 16, actionCount: 2, stateRevision: 7,
    workGameCompleted: ['work:42:1:16:1:5:job:17-h16:xuan:scavenge:xuan:xuan:scavenge'] };
  assert.equal(validateWorkGames(forgedBoundary).ok, false);

  const overlapping = copied(started.state);
  overlapping.workGameCompleted = [started.gameId];
  assert.equal(validateWorkGames(overlapping).ok, false);

  const colonSource = startWorkGame(base(), { actorId: 'xuan', controllerId: 'xuan', source: 'job', sourceUid: 'saved:job', basePay: 100, variant: 'kitchen' });
  const completed = finishWorkGame(colonSource.state, colonSource.gameId, { forfeit: true }).state;
  assert.equal(validateWorkGames(completed).ok, true);
});
