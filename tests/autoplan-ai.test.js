import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh, task, ACTIONS } from '../public/game/engine.js';
import { autoArrangeTeammates, makeAutoPlanContext, validatePlans } from '../public/ui/autoplan.js';
import { checkAutoPlanContext, validateAutoPlanPayload } from '../server/autoplan.js';
import { loadData } from '../public/game/data.js';

await loadData();
const makeContext = (s) => makeAutoPlanContext(s, 'xuan', `plan_${s.seed}_${s.day}_${s.hour}_${s.hourTick}_${s.stateRevision}_xuan`);

function state() {
  const s = fresh(1234);
  s.pendingMorning = null;
  return s;
}

test('AI队友不会自行进棋牌馆，馆内人物仍可获得普通安排', () => {
  const s=state(); s.hour=14; s.slot=2; s.hourTick=8; s.turn=2;
  s.plan=Object.fromEntries(['xuan','fan','ma'].map(id=>[id,Array(16).fill(null)]));
  s.actors.fan.location='cardhall';
  const c=makeContext(s);
  assert.ok(!c.allowedActions.fan.some(a=>a.actionId==='casino'));
  assert.equal(checkAutoPlanContext(c),null);
  const forged=structuredClone(c);
  forged.allowedActions.fan.push({actionId:'casino',zone:'cardhall',name:ACTIONS.casino.name});
  assert.equal(checkAutoPlanContext(forged),'非法候选行动');
});

test('模型必须只为其他 active 人物恰好安排当前一格', () => {
  const s = state();
  const c = { requestId: 'one', slot: 0, selectedActorId: 'xuan', actorIds: ['fan'], allowedActions: { fan: [{ actionId: 'sketch', zone: 'camp' }] } };
  assert.equal(validatePlans({ requestId: 'one', plans: [{ actorId: 'fan', actionId: 'sketch', zone: 'camp' }] }, c).ok, true);
  for (const plans of [[], [{ actorId: 'xuan', actionId: 'sketch' }], [{ actorId: 'fan', actionId: 'sketch' }, { actorId: 'fan', actionId: 'sketch' }], [{ actorId: 'fan', actionId: 'unknown' }]]) {
    assert.equal(validatePlans({ requestId: 'one', plans }, c).ok, false);
  }
  assert.equal(validatePlans({ requestId: 'other', plans: [{ actorId: 'fan', actionId: 'sketch' }] }, c).ok, false);
  assert.equal(s.actors.fan.life, 'active');
});

test('AI 只改队友本格，保留操控者任务；过期结果不应用', async () => {
  const s = state();
  const selected = JSON.stringify(s.plan.xuan[0]);
  const fake = async (_url, opts) => {
    const c = JSON.parse(opts.body);
    return { ok: true, json: async () => ({ ok: true, payload: { requestId: c.requestId, plans: [{ actorId: 'fan', actionId: 'sketch', zone: 'camp' }] } }) };
  };
  const result = await autoArrangeTeammates(s, 'xuan', { fetchImpl: fake, stillCurrent: () => true });
  assert.equal(result.source, 'ai');
  assert.equal(result.state.plan.fan[0].id, 'sketch');
  assert.equal(JSON.stringify(result.state.plan.xuan[0]), selected);
  assert.equal(JSON.stringify(s.plan.fan[0].id), JSON.stringify('kitchen'));
  const stale = await autoArrangeTeammates(s, 'xuan', { fetchImpl: fake, stillCurrent: () => false });
  assert.equal(stale.error, '排程已变化，请重试。');
});

test('请求只含白名单，服务端拒绝越权和改写资源', () => {
  const s = state();
  const c = makeContext(s);
  assert.equal(c.hour, 6);
  assert.equal(c.hourTick, 0);
  assert.equal(c.stateRevision, s.stateRevision);
  assert.equal(checkAutoPlanContext(c), null);
  assert.equal(checkAutoPlanContext({ ...c, hour: 7 }), '请求标识无效');
  assert.equal(checkAutoPlanContext({ ...c, hourTick: 1 }), '请求标识无效');
  assert.equal(checkAutoPlanContext({ ...c, stateRevision: c.stateRevision + 1 }), '请求标识无效');
  assert.equal(checkAutoPlanContext({ ...c, actors: { fan: { ...c.actors.fan, location: 'cafe' } } }), null);
  assert.equal(checkAutoPlanContext({ ...c, seed: s.seed }), '请求字段无效');
  assert.equal(checkAutoPlanContext({ ...c, actorIds: ['xuan'] }), '角色名单无效');
  assert.equal(validateAutoPlanPayload({ requestId: c.requestId, plans: [{ actorId: 'fan', actionId: 'sketch', zone: 'camp', cash: 100 }] }, c), false);
});

test('队友共享费用冲突时原子拒绝，操控者空格保持空白', async () => {
  const s = state();
  s.actors.ma.life = 'active';
  s.plan.ma[0] = task('sleep', ['ma']);
  s.cash = 10;
  const original = JSON.stringify(s);
  const fake = async (_url, opts) => {
    const c = JSON.parse(opts.body);
    return { ok: true, json: async () => ({ ok: true, payload: { requestId: c.requestId, plans: c.actorIds.map((actorId) => ({ actorId, actionId: 'bath', zone: 'service' })) } }) };
  };
  const conflict = await autoArrangeTeammates(s, 'ma', { fetchImpl: fake });
  assert.match(conflict.error, /现金不足/);
  assert.equal(JSON.stringify(s), original);
  s.plan.xuan[0] = null;
  const local = await autoArrangeTeammates(s, 'xuan', { fetchImpl: async () => ({ status: 503 }), stillCurrent: () => true });
  assert.equal(local.source, 'local');
  assert.equal(local.state.plan.xuan[0], null);
});

test('没有其他 active 队友时拒绝，外部取消不会退回本地建议', async () => {
  const s = state();
  s.actors.fan.life = 'unrecruited';
  assert.equal(makeContext(s).error, '当前没有可安排的空闲队友。');
  s.actors.fan.life = 'active';
  const ctrl = new AbortController();
  const pending = autoArrangeTeammates(s, 'xuan', { signal: ctrl.signal, fetchImpl: (_url, opts) => new Promise((_, reject) => opts.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })) });
  ctrl.abort();
  assert.equal((await pending).error, '排程已变化，请重试。');
});

test('同营业桶换到下一小时且修订号未变时，过时响应不改排程', async () => {
  const s = state();
  let respond;
  const original = JSON.stringify(s.plan);
  const pending = autoArrangeTeammates(s, 'xuan', { fetchImpl: (_url, opts) => new Promise((resolve) => {
    const c = JSON.parse(opts.body);
    respond = () => resolve({ ok: true, json: async () => ({ ok: true, payload: { requestId: c.requestId, plans: [{ actorId: 'fan', actionId: 'sleep', zone: 'camp' }] } }) });
  }) });
  s.hour = 7;
  s.hourTick = 1;
  respond();
  assert.equal((await pending).error, '排程已变化，请重试。');
  assert.equal(JSON.stringify(s.plan), original);
});

test('只安排空闲队友当前小时；咖啡额度足够时保留合法工作候选', async () => {
  const s = state();
  s.actors.ma.life = 'active';
  s.busy.fan = { jobId: 'existing', startedHour: 5, remainingHours: 1, task: s.plan.fan[0] };
  s.actors.ma.energy = 0;
  s.actors.ma.coffeeCredit = 20;
  const c = makeContext(s);
  assert.deepEqual(c.actorIds, ['ma']);
  assert.equal(c.actors.ma.usableEnergy, 20);
  assert.ok(c.allowedActions.ma.some((a) => a.actionId === 'run'));
  assert.ok(c.allowedActions.ma.some((a) => a.actionId === 'sleep'));
  const before = JSON.stringify(s.plan.fan[0]);
  const result = await autoArrangeTeammates(s, 'xuan', { fetchImpl: async (_url, opts) => {
    const body = JSON.parse(opts.body);
    return { ok: true, json: async () => ({ ok: true, payload: { requestId: body.requestId, plans: [{ actorId: 'ma', actionId: 'run', zone: 'station' }] } }) };
  } });
  assert.equal(result.state.plan.ma[0].id, 'run');
  assert.equal(JSON.stringify(result.state.plan.fan[0]), before);
  assert.equal(result.state.actors.ma.coffeeCredit, 20);
});

test('第7小时只改索引1，保留第6小时旧任务和操控者本小时任务', async () => {
  const s = state();
  s.hour = 7;
  s.hourTick = 1;
  s.plan.xuan[1] = task('sleep', ['xuan']);
  const before = JSON.stringify(s.plan);
  const result = await autoArrangeTeammates(s, 'xuan', { fetchImpl: async (_url, opts) => {
    const c = JSON.parse(opts.body);
    return { ok: true, json: async () => ({ ok: true, payload: { requestId: c.requestId, plans: [{ actorId: 'fan', actionId: 'sleep', zone: 'camp' }] } }) };
  } });
  assert.equal(result.source, 'ai');
  assert.equal(result.state.plan.fan[1].id, 'sleep');
  assert.equal(JSON.stringify(result.state.plan.xuan[1]), JSON.stringify(s.plan.xuan[1]));
  assert.equal(JSON.stringify(result.state.plan.fan[0]), JSON.stringify(s.plan.fan[0]));
  assert.equal(JSON.stringify(s.plan), before);
});
