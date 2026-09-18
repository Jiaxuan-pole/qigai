import test, { before } from 'node:test';
import { loadData } from '../public/game/data.js';
import assert from 'node:assert/strict';
import { fresh } from '../public/game/engine.js';
import { beginDayReport, recordAutomaticWork, finishDayReport, normalizeDayReport, validateDayReport } from '../public/game/day-report.js';
import { renderDayReport } from '../public/ui/day-report.js';
import { ready, plan } from './engine-fixtures.js';
import { settle } from '../public/game/settle.js';
import { stepWorkGame, finishWorkGame, startWorkGame } from '../public/game/work-games.js';
import { validateSave } from '../public/game/save.js';

before(async () => { await loadData(); });

const make = () => { const s = fresh(37); s.pendingMorning = null; return s; };

test('三人混排只记录未受控的人，合作收入只计一次', () => {
  const s = make(); s.actors.ma.life = 'active'; beginDayReport(s);
  assert.equal(recordAutomaticWork(s, { actorId: 'xuan', controlledActorId: 'xuan', source: 'task', sourceUid: 'a', label: '拍摄', hour: 8, income: 4 }), false);
  assert.equal(recordAutomaticWork(s, { actorId: 'fan', controlledActorId: 'xuan', source: 'task', sourceUid: 'b', label: '拍摄', hour: 8, income: 11 }), true);
  assert.equal(recordAutomaticWork(s, { actorId: 'ma', controlledActorId: 'xuan', participants: ['xuan','ma'], source: 'task', sourceUid: 'c', label: '摆摊', hour: 9, income: 66 }), true);
  assert.equal(recordAutomaticWork(s, { actorId: 'xuan', controlledActorId: 'xuan', participants: ['xuan','ma'], source: 'task', sourceUid: 'c', label: '摆摊', hour: 9, income: 66 }), false);
  const report = finishDayReport(s);
  assert.equal(report.activities.length, 2);
  assert.equal(report.totalAutoIncome, 77);
  assert.equal(report.actors.fan.autoSoloIncome, 11);
  assert.equal(report.actors.ma.autoSoloIncome, 0);
  assert.match(renderDayReport(report), /团队收入66/);
  assert.match(renderDayReport(report), /轩哥参与合作摆摊/);
});

test('日始日终状态和愿望快照，不泄隐藏愿望', () => {
  const s = make(); s.actors.ma.life = 'unrecruited';
  s.wishes = [{uid:'w1',actor:'fan',templateId:'quiet_smoke',status:'active',revealed:false},{uid:'w2',actor:'xuan',templateId:'evening_drink',status:'active',revealed:true}];
  beginDayReport(s); s.actors.fan.health -= 7; s.actors.fan.life = 'dead'; s.cash += 9;
  s.wishes[1].status = 'fulfilled'; s.wishes[1].closedDay = s.day;
  const report = finishDayReport(s);
  assert.equal(report.actors.fan.stats.health.delta, -7);
  assert.equal(report.actors.fan.life.end, 'dead');
  assert.equal(report.actors.ma.life.start, 'unrecruited');
  assert.equal(report.wishes.hiddenCount, 1);
  assert.equal(report.wishes.items.length, 1);
  assert.equal(report.wishes.items[0].status, 'fulfilled');
  assert.doesNotMatch(renderDayReport(report), /w1|quiet_smoke/);
});

test('旧档从恢复点部分记录，存读归一化并拒绝坏元数据', () => {
  const s = make(); delete s.daily.report; beginDayReport(s, { partial: true });
  recordAutomaticWork(s, { actorId:'fan', controlledActorId:'xuan', source:'task', sourceUid:'q', label:'睡觉', hour:7, income:0 });
  finishDayReport(s);
  const loaded = JSON.parse(JSON.stringify(s));
  assert.equal(validateDayReport(loaded), true);
  assert.equal(normalizeDayReport(loaded).lastDayReport.partial, true);
  assert.match(renderDayReport(loaded.lastDayReport), /从恢复进度后开始记录/);
  loaded.lastDayReport.activities[0].label = '<img src=x onerror=1>';
  assert.equal(validateDayReport(loaded), false);
  loaded.lastDayReport.activities[0].label = '睡觉';
  loaded.lastDayReport.activities.push(structuredClone(loaded.lastDayReport.activities[0]));
  assert.equal(validateDayReport(loaded), false);
  loaded.lastDayReport.activities.pop();
  loaded.lastDayReport.activities[0].income = Infinity;
  assert.equal(validateDayReport(loaded), false);
  assert.equal(normalizeDayReport(loaded).lastDayReport, undefined);
});

test('已说出口愿望区分延期、拒绝与仍想要，结束快照不跟随次日变化', () => {
  const s = make(); beginDayReport(s);
  s.wishes = [
    {uid:'w1',actor:'xuan',templateId:'quiet_smoke',status:'active',revealed:true,promise:{until:4},declined:false},
    {uid:'w2',actor:'fan',templateId:'evening_drink',status:'active',revealed:true,declined:true},
    {uid:'w3',actor:'fan',templateId:'quiet_smoke',status:'active',revealed:true},
  ];
  const report = finishDayReport(s);
  assert.deepEqual(report.wishes.items.map((w) => w.status), ['deferred','declined','active']);
  s.wishes[0].status = 'fulfilled'; s.wishes.push({uid:'w4',actor:'fan',templateId:'evening_drink',status:'active',revealed:true});
  assert.equal(report.wishes.items.length, 3);
  assert.equal(report.wishes.items[0].status, 'deferred');
});

test('无受控者都属于自动行动，非法演员、金额和重复来源被拒', () => {
  const s = make(); beginDayReport(s);
  const base = { actorId:'xuan', source:'task', sourceUid:'a', label:'洗漱', hour:7, income:0 };
  assert.equal(recordAutomaticWork(s, base), true);
  assert.equal(recordAutomaticWork(s, base), false);
  assert.equal(recordAutomaticWork(s, {...base, sourceUid:'b', income:-1}), false);
  assert.equal(recordAutomaticWork(s, {...base, sourceUid:'c', actorId:'ma'}), false);
  assert.equal(finishDayReport(s).activities.length, 1);
});

test('21点合作奖金归原日，次日现金基线与账本同步且不计自动队友收入', () => {
  const scheduled = plan(ready(808, { turn: 19, slot: 3 }), 'xuan', 'coop');
  const settled = settle(scheduled, { controlledActorId: 'xuan' });
  const game = settled.state.pending.workGames[0];
  let state = settled.state;
  for (const station of game.challenge.stations) state = stepWorkGame(state, game.id, { type: 'pass', station: station.id, cue: station.cue }).state;
  const done = finishWorkGame(state, game.id);
  assert.equal(done.bonus, 16);
  assert.equal(done.state.cash, 154);
  assert.equal(done.state.lastDayReport.endCash, 154);
  assert.equal(done.state.lastDayReport.cashDelta, 82);
  assert.equal(done.state.lastDayReport.controlledBonusIncome, 16);
  assert.match(renderDayReport(done.state.lastDayReport), /主控小游戏奖金 \+16元/);
  assert.equal(done.state.lastDayReport.totalAutoIncome, 66);
  assert.equal(done.state.daily.report.startCash, 154);
  assert.deepEqual(done.state.ledger, { start: 154, income: 0, expense: 0 });
  assert.equal(validateDayReport(done.state), true);
  assert.equal(state.lastDayReport.endCash, 138);
  assert.equal(state.daily.report.startCash, 138);
  assert.deepEqual(validateSave(done.state), { ok: true });
  assert.equal(finishWorkGame(done.state, game.id).error, '不是当前挑战');
});

test('同日挑战奖金留给未来日报结算', () => {
  const state = make();
  const opened = startWorkGame(state, { actorId:'xuan', controllerId:'xuan', source:'job', sourceUid:'same-day', basePay:100, variant:'table' });
  const game = opened.state.pending.workGames[0];
  const answer = game.challenge.rows.find((row) => row.quantity * row.unitPrice !== row.total);
  const stepped = stepWorkGame(opened.state, game.id, { type:'flag', rowId:answer.id });
  const done = finishWorkGame(stepped.state, game.id);
  assert.equal(done.bonus, 25);
  assert.equal(done.state.daily.report.startCash, state.daily.report.startCash);
  assert.equal(done.state.daily.report.controlledBonusIncome, 25);
  assert.equal(done.state.lastDayReport, undefined);
});

test('同日已冻结的日报在挑战结算后更新，当前日账本仍记奖金', () => {
  const opened = startWorkGame(make(), { actorId:'xuan', controllerId:'xuan', source:'job', sourceUid:'same-night', basePay:100, variant:'table' });
  finishDayReport(opened.state);
  const game = opened.state.pending.workGames[0];
  const answer = game.challenge.rows.find((row) => row.quantity * row.unitPrice !== row.total);
  const stepped = stepWorkGame(opened.state, game.id, { type:'flag', rowId:answer.id });
  const done = finishWorkGame(stepped.state, game.id);
  assert.equal(done.bonus, 25);
  assert.equal(done.state.lastDayReport.endCash, 97);
  assert.equal(done.state.lastDayReport.cashDelta, 25);
  assert.equal(done.state.lastDayReport.controlledBonusIncome, 25);
  assert.equal(done.state.daily.report.startCash, 72);
  assert.deepEqual(done.state.ledger, { start:72, income:25, expense:0 });
});
