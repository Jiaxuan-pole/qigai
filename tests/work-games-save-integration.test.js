import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadData } from '../public/game/data.js';
import { fresh } from '../public/game/engine.js';
import { finishWorkGame, startWorkGame, stepWorkGame } from '../public/game/work-games.js';
import { beginDayReport, finishDayReport, recordAutomaticWork } from '../public/game/day-report.js';
import { normalizeSave, validateSave } from '../public/game/save.js';
import { createSaveStore } from '../server/save-store.js';
import { settle } from '../public/game/settle.js';
import { plan, ready } from './engine-fixtures.js';

before(async () => { await loadData(); });

const copied = (value) => JSON.parse(JSON.stringify(value));
const workRequest = { actorId: 'xuan', controllerId: 'xuan', source: 'job', sourceUid: 'save-job', basePay: 100, variant: 'kitchen' };

function oldV3() {
  const state = fresh(811);
  state.version = 3;
  state.day = 7; state.slot = 2; state.turn = 26;
  for (const id of ['xuan', 'fan', 'ma']) state.plan[id] = [null, null, null, null];
  delete state.pending.workGames;
  delete state.workGameCompleted;
  delete state.daily.report;
  delete state.lastDayReport;
  return state;
}

function pendingWorkWithReport() {
  let state = fresh(812);
  beginDayReport(state);
  recordAutomaticWork(state, { actorId: 'fan', controlledActorId: 'xuan', source: 'job', sourceUid: 'daily-job', label: '整理货物', hour: 8, income: 0 });
  const started = startWorkGame(state, workRequest);
  state = stepWorkGame(started.state, started.gameId, { type: 'ready' }).state;
  return { state, gameId: started.gameId };
}

test('v3/v4 本地读档补旧字段，重放中的挑战和已完成日报均原样保留', () => {
  const legacy = oldV3();
  assert.equal(validateSave(legacy).ok, true);
  const migrated = normalizeSave(legacy);
  assert.equal(migrated.version, 4);
  assert.deepEqual(migrated.pending.workGames, []);
  assert.deepEqual(migrated.workGameCompleted, []);
  assert.equal(migrated.daily.report.partial, true);
  assert.equal(migrated.lastDayReport, undefined);
  assert.deepEqual(legacy, oldV3());

  const earlyV4 = fresh(813);
  const freshReport = copied(earlyV4.daily.report);
  delete earlyV4.pending.workGames;
  delete earlyV4.workGameCompleted;
  assert.equal(validateSave(earlyV4).ok, true);
  const hydratedV4 = normalizeSave(earlyV4);
  assert.deepEqual(hydratedV4.pending.workGames, []);
  assert.deepEqual(hydratedV4.workGameCompleted, []);
  assert.deepEqual(hydratedV4.daily.report, freshReport);

  const { state, gameId } = pendingWorkWithReport();
  assert.equal(validateSave(state).ok, true);
  const local = normalizeSave(copied(state));
  assert.deepEqual(local.pending.workGames[0].challenge, state.pending.workGames[0].challenge);
  assert.deepEqual(local.pending.workGames[0].progress, state.pending.workGames[0].progress);
  assert.equal(stepWorkGame(local, gameId, { type: 'pick', dishId: local.pending.workGames[0].challenge.order[0] }).error, undefined);

  finishDayReport(state);
  assert.equal(validateSave(state).ok, true);
  assert.deepEqual(normalizeSave(copied(state)).lastDayReport, state.lastDayReport);
});

test('共享存档复原进行中工作，且已存在坏工作进度或日报会在归一化前拒绝', async () => {
  const { state } = pendingWorkWithReport();
  const badWork = copied(state);
  badWork.pending.workGames[0].progress.done = true;
  assert.equal(validateSave(badWork).ok, false);

  finishDayReport(state);
  for (const change of [
    report => { report.cashDelta += 1; },
    report => { report.activities[0].label = '<img src=x onerror=1>'; },
    report => { report.activities[0].label = '过'.repeat(101); },
  ]) {
    const badReport = copied(state);
    change(badReport.lastDayReport);
    assert.equal(validateSave(badReport).ok, false);
  }
  assert.equal(validateSave({ ...state, lastDayReport: null }).ok, false);

  const dir = await mkdtemp(join(tmpdir(), 'jwsn-work-save-'));
  try {
    const store = createSaveStore(dir);
    const record = await store.create({ name: '工作中', state: pendingWorkWithReport().state });
    const restored = await createSaveStore(dir).get(record.id);
    assert.deepEqual(restored.state.pending.workGames, record.state.pending.workGames);
    assert.deepEqual(restored.state.daily.report, record.state.daily.report);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('完成挑战 ID 必须是已过去的合法工作，且不能与待办互斥失败', () => {
  const freshState = fresh(814);
  freshState.pendingMorning = null;
  const started = startWorkGame(freshState, workRequest);
  const forged = copied(freshState);
  forged.workGameCompleted = [started.gameId];
  assert.equal(validateSave(forged).ok, false);

  const future = copied(freshState);
  future.workGameCompleted = ['work:814:2:16:0:0:job:6-future:xuan:xuan:kitchen'];
  assert.equal(validateSave(future).ok, false);

  const overlapping = copied(started.state);
  overlapping.workGameCompleted = [started.gameId];
  assert.equal(validateSave(overlapping).ok, false);

  const completed = finishWorkGame(started.state, started.gameId, { forfeit: true }).state;
  assert.equal(validateSave(completed).ok, true);

  const colonSource = startWorkGame(fresh(815), { ...workRequest, sourceUid: 'reload:job' });
  const colonCompleted = finishWorkGame(colonSource.state, colonSource.gameId, { forfeit: true }).state;
  assert.equal(validateSave(colonCompleted).ok, true);
});

test('真实21点工作跨日完成保留 h15 来源，而 h16 伪造完成 ID 被拒绝', () => {
  const scheduled = plan(ready(816, { turn: 3, slot: 3 }), 'xuan', 'scavenge');
  const settled = settle(scheduled, { controlledActorId: 'xuan' });
  const session = settled.state.pending.workGames[0];
  assert.deepEqual({ day: session.day, hourTick: session.hourTick, sourceUid: session.sourceUid },
    { day: 1, hourTick: 16, sourceUid: 'h15:xuan:scavenge' });
  const completed = finishWorkGame(settled.state, session.id, { forfeit: true }).state;
  assert.equal(validateSave(completed).ok, true);
  const forged = copied(completed);
  forged.workGameCompleted = [session.id.replace('h15:xuan:scavenge', 'h16:xuan:scavenge')];
  assert.equal(validateSave(forged).ok, false);
});
