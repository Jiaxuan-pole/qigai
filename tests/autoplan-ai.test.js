import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh, task, ACTIONS, energyCost } from '../public/game/engine.js';
import { autoArrangeTeammates, makeAutoPlanContext, validatePlans, planLocally, fillTeammatesNow, repairHour, remainingHours } from '../public/ui/autoplan.js';
import { checkAutoPlanContext, validateAutoPlanPayload } from '../server/autoplan.js';
import { preflight } from '../public/game/settle.js';
import { loadData } from '../public/game/data.js';

await loadData();
const makeContext = (s) => makeAutoPlanContext(s, 'xuan', `plan_${s.seed}_${s.day}_${s.hour}_${s.hourTick}_${s.stateRevision}_xuan`);

function state() {
  const s = fresh(1234);
  s.pendingMorning = null;
  return s;
}

// 模拟模型：每个队友的每个剩余小时各给一条，优先选 prefer 里指定的行动。
function fullPlans(c, prefer = {}) {
  const plans = [];
  for (const actorId of c.actorIds) for (const hour of c.hours) {
    const options = c.allowedActions[actorId].filter((o) => o.hours.includes(hour));
    const pick = options.find((o) => o.actionId === prefer[actorId]) || options[0];
    plans.push({ actorId, actionId: pick.actionId, zone: pick.zone, hour });
  }
  return plans;
}
const fakeAi = (prefer = {}) => async (_url, opts) => { const c = JSON.parse(opts.body); return { ok: true, json: async () => ({ ok: true, payload: { requestId: c.requestId, plans: fullPlans(c, prefer) } }) }; };

test('AI队友不会自行进棋牌馆，馆内人物仍可获得普通安排', () => {
  const s=state(); s.hour=14; s.slot=2; s.hourTick=8; s.turn=2;
  s.plan=Object.fromEntries(['xuan','fan','ma'].map(id=>[id,Array(16).fill(null)]));
  s.actors.fan.location='cardhall';
  const c=makeContext(s);
  assert.ok(!c.allowedActions.fan.some(a=>a.actionId==='casino'));
  assert.equal(checkAutoPlanContext(c),null);
  const forged=structuredClone(c);
  forged.allowedActions.fan.push({actionId:'casino',zone:'cardhall',name:ACTIONS.casino.name,hours:c.hours});
  assert.equal(checkAutoPlanContext(forged),'非法候选行动');
});

test('候选按营业时段标出开放小时，早餐帮厨只在清晨小时可选', () => {
  const s = state();
  const c = makeContext(s);
  assert.deepEqual(c.hours, remainingHours(s));
  assert.equal(c.hours.length, 16);
  const kitchen = c.allowedActions.fan.find((a) => a.actionId === 'kitchen');
  assert.deepEqual(kitchen.hours, [6, 7, 8, 9]);
  const sketch = c.allowedActions.fan.find((a) => a.actionId === 'sketch');
  assert.deepEqual(sketch.hours, c.hours);
  assert.equal(checkAutoPlanContext(c), null);
  assert.equal(checkAutoPlanContext({ ...c, hours: c.hours.slice(1) }), '小时列表无效');
  const wrongHours = structuredClone(c);
  wrongHours.allowedActions.fan.find((a) => a.actionId === 'kitchen').hours = c.hours;
  assert.equal(checkAutoPlanContext(wrongHours), '非法候选行动');
});

test('模型必须为每个队友的每个剩余小时恰好排一条，且只能用候选开放的小时', () => {
  const c = { requestId: 'one', hours: [20, 21], selectedActorId: 'xuan', actorIds: ['fan'], allowedActions: { fan: [{ actionId: 'sketch', zone: 'camp', hours: [20, 21] }, { actionId: 'kitchen', zone: 'market', hours: [20] }] } };
  const ok = [{ actorId: 'fan', actionId: 'sketch', zone: 'camp', hour: 20 }, { actorId: 'fan', actionId: 'kitchen', zone: 'market', hour: 20 }];
  assert.equal(validatePlans({ requestId: 'one', plans: [ok[0], { ...ok[0], hour: 21 }] }, c).ok, true);
  assert.equal(validateAutoPlanPayload({ requestId: 'one', plans: [ok[0], { ...ok[0], hour: 21 }] }, c), true);
  for (const plans of [
    [],
    [ok[0]],
    [ok[0], ok[1]],
    [ok[0], { ...ok[0], hour: 22 }],
    [{ actorId: 'xuan', actionId: 'sketch', zone: 'camp', hour: 20 }, { ...ok[0], hour: 21 }],
    [ok[0], { actorId: 'fan', actionId: 'kitchen', zone: 'market', hour: 21 }],
    [ok[0], { actorId: 'fan', actionId: 'unknown', zone: 'camp', hour: 21 }],
    [ok[0], { actorId: 'fan', actionId: 'sketch', zone: 'camp' }],
  ]) {
    assert.equal(validatePlans({ requestId: 'one', plans }, c).ok, false);
    assert.equal(validateAutoPlanPayload({ requestId: 'one', plans }, c), false);
  }
  assert.equal(validatePlans({ requestId: 'other', plans: [ok[0], { ...ok[0], hour: 21 }] }, c).ok, false);
});

test('AI 排满队友全天，保留操控者整天任务；过期结果不应用', async () => {
  const s = state();
  const selected = JSON.stringify(s.plan.xuan);
  const result = await autoArrangeTeammates(s, 'xuan', { fetchImpl: fakeAi({ fan: 'sketch' }), stillCurrent: () => true });
  assert.equal(result.source, 'ai');
  // 速写每小时耗 20 体力，满体力连排 5 小时后按推演换成休整，之后再接着速写。
  for (let i = 0; i < 5; i++) assert.equal(result.state.plan.fan[i]?.id, 'sketch', `小时${6 + i}`);
  for (let i = 0; i < 16; i++) assert.ok(result.state.plan.fan[i], `小时${6 + i}不能空着`);
  assert.ok(result.state.plan.fan.filter((t) => t.id === 'sketch').length >= 8);
  assert.equal(JSON.stringify(result.state.plan.xuan), selected);
  assert.equal(s.plan.fan[0].id, 'kitchen');
  assert.match(result.summary, /凡哥：纸板速写/);
  const stale = await autoArrangeTeammates(s, 'xuan', { fetchImpl: fakeAi(), stillCurrent: () => false });
  assert.equal(stale.error, '排程已变化，请重试。');
});

test('AI 排程不覆盖队友已预约的街头机会或合作格', async () => {
  const s = state();
  s.plan.fan[5] = { ...task('talk', ['fan', 'xuan'], { group: 'g1' }) };
  s.plan.xuan[5] = { ...task('talk', ['fan', 'xuan'], { group: 'g1' }) };
  s.plan.fan[9] = { ...task('rest', ['fan'], { eventUid: 'ev-9' }) };
  const result = await autoArrangeTeammates(s, 'xuan', { fetchImpl: fakeAi({ fan: 'sketch' }) });
  assert.equal(result.source, 'ai');
  assert.equal(result.state.plan.fan[5].group, 'g1');
  assert.equal(result.state.plan.fan[9].eventUid, 'ev-9');
  assert.equal(result.state.plan.fan[4].id, 'sketch');
  assert.equal(result.state.plan.fan[10].id, 'sketch');
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
  const plans = fullPlans(c);
  assert.equal(validateAutoPlanPayload({ requestId: c.requestId, plans }, c), true);
  assert.equal(validateAutoPlanPayload({ requestId: c.requestId, plans: [{ ...plans[0], cash: 100 }, ...plans.slice(1)] }, c), false);
});

test('队友共享费用冲突时原子拒绝，操控者空格保持空白', async () => {
  const s = state();
  s.actors.ma.life = 'active';
  s.plan.ma[0] = task('sleep', ['ma']);
  s.cash = 10;
  const original = JSON.stringify(s);
  const conflict = await autoArrangeTeammates(s, 'ma', { fetchImpl: fakeAi({ xuan: 'bath', fan: 'bath' }) });
  assert.match(conflict.error, /现金不足/);
  assert.equal(JSON.stringify(s), original);
  s.plan.xuan[0] = null;
  const local = await autoArrangeTeammates(s, 'xuan', { fetchImpl: async () => ({ status: 503 }), stillCurrent: () => true });
  assert.equal(local.source, 'local');
  assert.equal(local.state.plan.xuan[0], null);
  for (let i = 0; i < 16; i++) assert.ok(local.state.plan.fan[i], `本地建议排满凡哥小时${6 + i}`);
  assert.equal(preflight(local.state).error, undefined);
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
    respond = () => resolve({ ok: true, json: async () => ({ ok: true, payload: { requestId: c.requestId, plans: fullPlans(c) } }) });
  }) });
  s.hour = 7;
  s.hourTick = 1;
  respond();
  assert.equal((await pending).error, '排程已变化，请重试。');
  assert.equal(JSON.stringify(s.plan), original);
});

test('只安排空闲队友；咖啡额度足够时保留合法工作候选', async () => {
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
  const result = await autoArrangeTeammates(s, 'xuan', { fetchImpl: fakeAi({ ma: 'run' }) });
  assert.equal(result.state.plan.ma[0].id, 'run');
  assert.equal(JSON.stringify(result.state.plan.fan[0]), before);
  assert.equal(result.state.actors.ma.coffeeCredit, 20);
});

test('第7小时只改索引1起，保留第6小时旧任务和操控者任务', async () => {
  const s = state();
  s.hour = 7;
  s.hourTick = 1;
  s.plan.xuan[1] = task('sleep', ['xuan']);
  const before = JSON.stringify(s.plan);
  const result = await autoArrangeTeammates(s, 'xuan', { fetchImpl: fakeAi({ fan: 'sleep' }) });
  assert.equal(result.source, 'ai');
  assert.equal(result.state.plan.fan[1].id, 'sleep');
  assert.equal(result.state.plan.fan[15].id, 'sleep');
  assert.equal(JSON.stringify(result.state.plan.xuan), JSON.stringify(s.plan.xuan));
  assert.equal(JSON.stringify(result.state.plan.fan[0]), JSON.stringify(s.plan.fan[0]));
  assert.equal(JSON.stringify(s.plan), before);
});

test('本地随机排程可复现、只填空格、体力见底时只排休整', () => {
  const s = state();
  s.actors.fan.energy = 20;
  s.actors.fan.coffeeCredit = 0;
  const hours = remainingHours(s);
  const a = planLocally(s, ['fan'], hours, { protect: ['xuan'] });
  const b = planLocally(s, ['fan'], hours, { protect: ['xuan'] });
  assert.deepEqual(a.filled, b.filled);
  assert.equal(a.state.plan.fan[0].id, 'kitchen', '已有安排不动');
  assert.ok(a.filled.every((f) => f.hour >= 7));
  assert.equal(JSON.stringify(a.state.plan.xuan), JSON.stringify(s.plan.xuan));
  let energy = 20;
  for (let i = 0; i < 16; i++) {
    const action = ACTIONS[a.state.plan.fan[i].id];
    if (energy < 20 && a.filled.some((f) => f.hour === 6 + i)) assert.equal(energyCost(s, 'fan', action), 0, `${6 + i}点体力${energy}只能休整`);
    energy = Math.min(100, energy + (action.energyGain || 0) - energyCost(s, 'fan', action));
  }
  assert.equal(JSON.stringify(s.plan.fan), JSON.stringify(state().plan.fan), '输入不被改动');
});

test('街道即时行动：空闲队友空格随机补一件事，已有可行安排保留，操控者不动', () => {
  const s = state();
  s.actors.ma.life = 'active';
  s.plan.ma[0] = null;
  const before = JSON.stringify(s.plan.fan[0]);
  const r = fillTeammatesNow(s, 'xuan');
  assert.equal(r.error, undefined);
  assert.ok(r.state.plan.ma[0], '马哥空格被补上');
  assert.deepEqual(r.filled.map((f) => f.actorId), ['ma']);
  assert.equal(JSON.stringify(r.state.plan.fan[0]), before);
  assert.equal(JSON.stringify(r.state.plan.xuan[0]), JSON.stringify(s.plan.xuan[0]));
  assert.equal(preflight(r.state).error, undefined);
});

test('AI 连排劳动时按体力推演替换成休整，不会把队友排到体力见底', async () => {
  const s = state();
  s.actors.fan.energy = 40;
  s.actors.fan.coffeeCredit = 0;
  const result = await autoArrangeTeammates(s, 'xuan', { fetchImpl: fakeAi({ fan: 'bottles' }) });
  assert.equal(result.source, 'ai');
  let energy = 40, labor = 0;
  for (let i = 0; i < 16; i++) {
    const a = ACTIONS[result.state.plan.fan[i].id];
    const cost = energyCost(s, 'fan', a);
    if (cost) { labor++; assert.ok(energy >= 20, `${6 + i}点体力${energy}不该再劳动`); }
    energy = Math.min(100, energy + (a.energyGain || 0) - cost);
  }
  assert.ok(labor >= 3 && labor < 16, `应当劳动与休整穿插，实际劳动${labor}小时`);
});

test('预约了街头机会或合作的格预检不过时交还玩家，不替他退订', () => {
  const s = state();
  s.actors.fan.energy = 0;
  s.actors.fan.coffeeCredit = 0;
  s.plan.fan[0] = { ...task('kitchen', ['fan']), eventUid: 'ev-1' };
  const r = repairHour(s, ['xuan']);
  assert.match(r.error, /体力不足/);
  assert.deepEqual(r.at, { actorId: 'fan', hour: 6 });
  assert.equal(s.plan.fan[0].eventUid, 'ev-1');
  const grouped = state();
  grouped.actors.fan.energy = 0;
  grouped.actors.fan.coffeeCredit = 0;
  grouped.plan.fan[0] = { ...task('kitchen', ['fan']), group: 'g1' };
  assert.match(repairHour(grouped, ['xuan']).error, /体力不足/);
});

test('预检不过时换掉肇事者这一格；肇事者受保护则报错', () => {
  const s = state();
  s.actors.fan.energy = 0;
  s.actors.fan.coffeeCredit = 0;
  assert.match(preflight(s).error, /凡哥体力不足/);
  const fixed = repairHour(s, ['xuan']);
  assert.equal(fixed.error, undefined);
  assert.equal(preflight(fixed.state).error, undefined);
  assert.equal(energyCost(s, 'fan', ACTIONS[fixed.state.plan.fan[0].id]), 0);
  const blocked = repairHour(s, ['xuan', 'fan']);
  assert.match(blocked.error, /体力不足/);
  assert.deepEqual(blocked.at, { actorId: 'fan', hour: 6 });
});
