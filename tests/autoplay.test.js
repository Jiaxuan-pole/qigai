import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../public/game/data.js';
import { fresh, assign, useItem, placeFurniture } from '../public/game/engine.js';
import { observeState } from '../scripts/autoplay/observe.js';
import { buildSeeds, countNewDiseases, recordFoodOutage, runGame, STRATEGY_IDS } from '../scripts/autoplay/runner.js';
import { quantile, renderReport, summarizeRuns } from '../scripts/autoplay/statistics.js';
import { preflight, settle } from '../public/game/settle.js';
import { makeItem } from '../public/game/items.js';
import { applyCommand, recoverPreflight } from '../scripts/autoplay/runner.js';
import { createBreakdown, recordSettledMetrics, recordImmediateMetrics, recordReplacement, finalizeBreakdown } from '../scripts/autoplay/metrics.js';
import * as policies from '../scripts/autoplay/policies.js';

const { chooseFoodPurchase, planActions } = policies;

function withBeds(state, count) {
  let next = state;
  for (let index = 0; index < count; index++) {
    const bed = makeItem(next, 'legacy_bed', 'camp');
    const placed = placeFurniture(next, 'xuan', bed.uid, ['west_1', 'west_2', 'west_3'][index]);
    assert.equal(placed.error, undefined);
    next = placed.state;
  }
  return next;
}

before(async () => {
  await loadData();
});

test('策略观察层只暴露玩家当前可见信息', () => {
  const state = fresh(1000);
  state.items.push({
    uid: 'secret-ticket', itemId: 'ticket', container: 'ma', uses: 1,
    ticket: { id: 'ticket-1', payout: 100, face: { style: 'street' }, revealed: [] },
  });
  state.events.push({
    uid: 'secret-event', templateId: 'street_cards', title: '雨棚下的牌桌', setup: '可见说明',
    district: 'station', status: 'open', expiresTurn: 2, reserved: null, spawnedTurn: 0,
    internalRoll: 0.01,
  });
  state.actors.xuan.diseases.push({ uid: 'hidden-disease', kind: 'gut', known: false, plan: false, severity: 20 });

  const view = observeState(state);
  const ticket = view.items.find((item) => item.uid === 'secret-ticket').ticket;
  assert.deepEqual(Object.keys(ticket).sort(), ['claimed', 'scratched']);
  assert.equal(JSON.stringify(view).includes('payout'), false);
  assert.equal(JSON.stringify(view).includes('internalRoll'), false);
  assert.equal(JSON.stringify(view).includes('templateId'), false);
  assert.equal(view.actors.xuan.diseases[0].kind, null);
  assert.deepEqual(view.forecast.map((entry) => entry.day), [2, 3, 4]);
});

test('观察层投影已揭示愿望字段与合法夜宿选项', () => {
  const state = fresh(1000);
  state.day = 25;
  state.weatherKind = 'cold';
  state.wishes.push({
    uid: 'w-visible', templateId: 'quiet_smoke', actor: 'xuan', category: 'daily',
    intensity: 47, revealed: true, response: null, status: 'active',
  });

  const view = observeState(state);
  assert.deepEqual(view.wishes[0], {
    uid: 'w-visible', actor: 'xuan', templateId: 'quiet_smoke', category: 'daily',
    intensity: 47, response: null,
  });
  assert.equal(view.nightSpots.find((spot) => spot.id === 'shelter').disabled, false);
});

test('低饱食角色优先即时吃自己背包或可及营地箱食物', () => {
  const state = fresh(1000);
  state.actors.xuan.food = 15;
  const view = observeState(state);
  const meal = view.items.find((item) => item.itemId === 'meal' && item.container === 'camp');

  assert.deepEqual(policies.chooseImmediateCommand?.(view, 'balanced', {}), {
    kind: 'use', actorId: 'xuan', uid: meal.uid,
  });
});

test('补货受库存与现金限制时分批购买并先覆盖下一餐', () => {
  const state = fresh(1000);
  state.metMa = true;
  state.actors.ma.life = 'active';
  state.actors.ma.joinedTurn = 4;
  state.items = state.items.filter((item) => !['meal', 'bread', 'hot_soup'].includes(item.itemId));
  state.effectiveFood = 0;
  state.cash = 40;
  state.actors.xuan.location = 'market';

  const command = chooseFoodPurchase(observeState(state), 'conservative');
  assert.equal(command.cart[0].qty, 5);
  assert.equal(command.cart[0].itemId, 'meal');
});

test('保暖低于40先替换常规工作并保留替换原因', () => {
  const state = fresh(1000);
  state.actors.xuan.warmth = 39;

  const command = planActions(observeState(state), 'balanced', {}).find((item) => item.actorId === 'xuan');
  assert.equal(command.actionId, 'warm');
  assert.equal(command.plannedActionId, 'scavenge');
  assert.equal(command.replacementReason, 'warmth');
});

test('购物排班先保留厨房护理保暖和救援角色', () => {
  const state = fresh(1000);
  state.metMa = true;
  state.actors.ma.life = 'active';
  state.actors.ma.joinedTurn = 4;
  state.items = state.items.filter((item) => !['meal', 'bread', 'hot_soup'].includes(item.itemId));
  state.effectiveFood = 0;

  const commands = planActions(observeState(state), 'balanced', {});
  assert.equal(commands.find((item) => item.actorId === 'fan').actionId, 'kitchen');
  const shopper = commands.find((item) => item.replacementReason === 'shopping');
  assert.ok(['xuan', 'ma'].includes(shopper.actorId));
  assert.ok(['scavenge', 'run'].includes(shopper.plannedActionId));
});

test('均衡策略只为揭示的吸烟愿望买烟且营地有火时不重复买打火机', () => {
  const state = fresh(1000);
  state.day = 7;
  state.slot = 1;
  state.actors.xuan.location = 'market';
  state.wishes.push({
    uid: 'w-smoke', templateId: 'quiet_smoke', actor: 'xuan', category: 'daily',
    intensity: 45, revealed: true, response: null, status: 'active',
  });

  const purchase = policies.chooseCigarettePurchase(observeState(state), 'balanced');
  assert.deepEqual(purchase.cart, [{ shopId: 'convenience', itemId: 'cigarette', qty: 1 }]);
  state.items.push({ uid: 'smokes', itemId: 'cigarette', container: 'xuan', uses: 6, wet: false, dirty: false, expiresDay: null });
  state.actors.xuan.location = 'camp';
  assert.deepEqual(policies.chooseImmediateCommand?.(observeState(state), 'balanced', {}), {
    kind: 'use', actorId: 'xuan', uid: 'smokes',
  });
});

test('均衡精神恢复模式45启动60结束并替换工作格', () => {
  const state = fresh(1000);
  state.slot = 3;
  state.actors.xuan.mind = 44;
  let memory = policies.updateStrategyMemory?.(observeState(state), 'balanced', {});
  assert.equal(memory.recovering.xuan, true);
  let command = planActions(observeState(state), 'balanced', memory).find((item) => item.actorId === 'xuan');
  assert.equal(command.actionId, 'joke');
  assert.equal(command.plannedActionId, undefined);

  state.actors.xuan.mind = 59;
  memory = policies.updateStrategyMemory(observeState(state), 'balanced', memory);
  assert.equal(memory.recovering.xuan, true);
  state.actors.xuan.mind = 60;
  memory = policies.updateStrategyMemory(observeState(state), 'balanced', memory);
  assert.equal(memory.recovering.xuan, false);
});

test('寒潮准备依次覆盖棚床毯并在开放时选择服务站过夜', () => {
  let state = fresh(1000);
  state.metMa = true;
  state.actors.ma.life = 'active';
  state.actors.ma.joinedTurn = 4;
  state.day = 66;
  state.slot = 1;
  state.camp.rain = 1;
  state = withBeds(state, 2);
  state.actors.xuan.location = 'market';
  state.cash = 100;

  let view = observeState(state);
  const roof = planActions(view, 'balanced', {}).find((item) => item.actionId === 'roof');
  assert.equal(roof.opts.participants.length, 2);
  const blanket = policies.choosePreparednessPurchase?.(view, 'balanced');
  assert.equal(blanket.cart[0].itemId, 'blanket');

  state.camp.rain = 3;
  assert.equal(planActions(observeState(state), 'balanced', {}).some((item) => item.actionId === 'bed'), false);
  state.day = 71;
  state.weatherKind = 'cold';
  view = observeState(state);
  assert.deepEqual(policies.chooseNightSpot?.(view), { kind: 'night', spot: 'shelter' });
});

test('保守策略饭钱不足时清晨和晚间排免费餐且不覆盖厨房', () => {
  const state = fresh(1000);
  state.metMa = true;
  state.actors.ma.life = 'active';
  state.actors.ma.joinedTurn = 4;
  state.items = state.items.filter((item) => !['meal', 'bread', 'hot_soup'].includes(item.itemId));
  state.effectiveFood = 0;
  state.camp.rain = 2;
  state.cash = 8;

  let commands = planActions(observeState(state), 'conservative', {});
  assert.equal(commands.find((item) => item.actorId === 'fan').actionId, 'kitchen');
  assert.ok(commands.some((item) => item.actionId === 'soup'));
  state.slot = 3;
  commands = planActions(observeState(state), 'conservative', {});
  assert.ok(commands.some((item) => item.actionId === 'soup'));
});

test('夜宿选择使用天气预报且防雨不足本身会触发开放避难所', () => {
  const state = fresh(1000);
  state.relations.reg_wang = { trust: 2 };
  state.camp.rain = 1;
  const view = observeState(state);
  view.weather = 'clear';
  view.forecast = [{ day: state.day + 1, kind: 'rain', night: 10 }];
  assert.deepEqual(policies.chooseNightSpot(view), { kind: 'night', spot: 'shelter' });
});

test('日常材料满足时修棚到2且家具需从商店购买', () => {
  let state = fresh(1000);
  state.metMa = true;
  state.actors.ma.life = 'active';
  state.actors.ma.joinedTurn = 4;
  state.day = 10;
  state.slot = 3;
  state.camp.rain = 1;
  state = withBeds(state, 2);
  state.cash = 100;

  let commands = planActions(observeState(state), 'balanced', {});
  assert.equal(commands.find((item) => item.actionId === 'roof').opts.participants.length, 2);
  state.camp.rain = 2;
  commands = planActions(observeState(state), 'balanced', {});
  assert.equal(commands.some((item) => item.actionId === 'bed'), false);
});

test('毯子按角色持有补齐且不等到寒潮周才采购', () => {
  const state = fresh(1000);
  state.metMa = true;
  state.actors.ma.life = 'active';
  state.actors.ma.joinedTurn = 4;
  state.day = 20;
  state.slot = 1;
  state.cash = 100;
  state.actors.xuan.location = 'market';
  state.items.push({ uid: 'fan-blanket', itemId: 'blanket', container: 'fan', uses: 1, wet: false, dirty: false, expiresDay: null });

  const command = policies.choosePreparednessPurchase(observeState(state), 'balanced');
  assert.equal(command.actorId, 'xuan');
  assert.equal(command.destination, 'self');
});

test('多人诊所维护服从同格团队现金预算', () => {
  const state = fresh(1000);
  state.cash = 30;
  state.items = state.items.filter((item) => !['meal', 'bread', 'hot_soup'].includes(item.itemId));
  state.effectiveFood = 0;
  state.actors.xuan.diseases.push({ uid: 'dx', known: false, plan: false, severity: 20, kind: 'gut' });
  state.actors.fan.diseases.push({ uid: 'df', known: false, plan: false, severity: 20, kind: 'skin' });

  const commands = planActions(observeState(state), 'balanced', {});
  assert.ok(commands.filter((item) => item.actionId === 'clinic').length <= 1);
});

test('下一餐缺口优先于尚未购买的护理储备', () => {
  const state = fresh(1000);
  state.metMa = true;
  state.actors.ma.life = 'active';
  state.actors.ma.joinedTurn = 4;
  state.cash = 24;
  state.items = state.items.filter((item) => !['meal', 'bread', 'hot_soup'].includes(item.itemId));
  state.effectiveFood = 0;
  state.actors.xuan.location = 'market';
  state.actors.fan.diseases.push({ uid: 'df', known: true, plan: false, severity: 20, kind: 'skin' });

  const command = chooseFoodPurchase(observeState(state), 'balanced');
  assert.equal(command.cart[0].qty, 3);
});

test('策略不为未招募者或死者排班', () => {
  const state = fresh(1000);
  state.actors.fan.life = 'dead';
  const commands = planActions(observeState(state), 'balanced', {});
  assert.deepEqual(commands.map((command) => command.actorId), ['xuan']);
});

test('疾病和断供统计按唯一实例与自然日去重', () => {
  const seen = new Set();
  const actors = { xuan: { diseases: [{ uid: 'd1' }] }, fan: { diseases: [] } };
  assert.equal(countNewDiseases(seen, actors), 1);
  assert.equal(countNewDiseases(seen, actors), 0);
  actors.xuan.diseases.push({ uid: 'd2' });
  assert.equal(countNewDiseases(seen, actors), 1);
  const days = new Set();
  recordFoodOutage(days, 8, 0);
  recordFoodOutage(days, 8, 0);
  recordFoodOutage(days, 9, 1);
  assert.deepEqual([...days], [8]);
});

test('五种策略严格共用 seed=1000+i', () => {
  assert.deepEqual(STRATEGY_IDS, ['conservative', 'balanced', 'gambler', 'gambler_control', 'balanced_novice']);
  const seeds = buildSeeds(4);
  assert.deepEqual(seeds, [1000, 1001, 1002, 1003]);
  for (const strategy of STRATEGY_IDS) assert.deepEqual(buildSeeds(4, strategy), seeds);
});

test('赌徒先参加牌局后仍会把第二次额度留给当日彩票', () => {
  const state = fresh(1000);
  state.actors.ma.life = 'active';
  state.metMa = true;
  state.slot = 2;
  state.daily.bets = 1;
  state.daily.orders.cards = 1;
  const ma = planActions(observeState(state), 'gambler').find((command) => command.actorId === 'ma');
  assert.equal(ma.actionId, 'shop');
  assert.equal(ma.opts.cart[0].itemId, 'ticket');
});

test('单局通过真实结算前进且按天数边界停止', async () => {
  const result = await runGame({ seed: 1000, strategyId: 'conservative', maxDays: 2 });
  assert.equal(result.seed, 1000);
  assert.equal(result.strategyId, 'conservative');
  assert.ok(result.turns > 0 && result.turns <= 8);
  assert.equal(result.stopReason, 'day-limit');
  assert.equal(result.preflightFailures >= 0, true);
  assert.equal(result.completedDays, 2);
  assert.equal(result.series.length, 0);
});

test('预检恢复后直接重试当前格，不被策略重新覆盖成同一非法行动', async () => {
  let initialState = fresh(1000);
  initialState.pendingMorning = null;
  initialState = assign(initialState, 'fan', 6, 'oddjob', { eventUid: 'expired-opportunity', zone: 'market' }).state;
  const result = await runGame({ seed: 1000, strategyId: 'conservative', maxDays: 60, initialState });
  assert.ok(['day-limit', 'gameover', 'ending'].includes(result.stopReason));
  // 只验证恢复机制让对局继续前进；具体能活多少天随平衡参数变化，不在这里钉死。
  assert.ok(result.completedDays >= 10 && result.completedDays <= 60);
  assert.ok(result.preflightFailures > 0);
});

test('团队费用预检失败时按可用救助资金重排整格', async () => {
  const result = await runGame({ seed: 1000, strategyId: 'conservative', maxDays: 30 });
  assert.ok(['day-limit', 'gameover', 'ending'].includes(result.stopReason));
  assert.ok(result.completedDays > 20 && result.completedDays <= 30);
});

test('统计和报告覆盖交办单全部指标', () => {
  assert.equal(quantile([1, 9, 5], 0.5), 5);
  const sample = {
    seed: 1000, strategyId: 'conservative', survivors: 3, cash: 120,
    firstDeathDay: null, deaths: [], preflightFailures: 1,
    preflightReasons: { '体力不足': 1 }, stoppageReasons: { energy: 1 },
    foodOutageDays: 2, wishBreakdowns: 1, diseaseCases: 3,
    lotteryBuyDays: 0, cardGameDays: 0,
    dayCash: { ordinary: [12], delivery: [60], care: [-24] },
    series: [{ day: 10, cash: 100, health: 80, mind: 60, hygiene: 40 }],
  };
  const runs = [
    sample,
    { ...sample, seed: 1001, survivors: 2, cash: 20, firstDeathDay: 8, deaths: [{ cause: '饥饿' }], diseaseCases: 1 },
    { ...sample, seed: 1002, survivors: 1, cash: 50, firstDeathDay: 12, deaths: [{ cause: '失温' }], diseaseCases: 0 },
    { ...sample, seed: 1003, survivors: 0, cash: 80, firstDeathDay: 10, deaths: [{ cause: '饥饿' }], diseaseCases: 2 },
  ];
  const summary = summarizeRuns(runs);
  assert.deepEqual(summary.survivalRates, { 3: 25, 2: 25, 1: 25, 0: 25 });
  assert.equal(Object.values(summary.survivalRates).reduce((sum, value) => sum + value, 0), 100);
  assert.deepEqual(summary.cashQuantiles, { p10: 20, p50: 50, p90: 120 });
  assert.deepEqual(summary.firstDeathDay, { count: 3, p10: 8, p50: 10, p90: 12 });
  const nullSafe = summarizeRuns([
    { ...sample, series: [{ day: 10, cash: 1, health: null, mind: null, hygiene: null }] },
    { ...sample, seed: 1001, series: [{ day: 10, cash: 2, health: 77, mind: 66, hygiene: 55 }] },
  ]);
  assert.deepEqual(nullSafe.checkpoints[10], { count: 2, cash: 1, health: 77, mind: 66, hygiene: 55 });
  const report = renderReport([{ id: 'conservative', label: '保守', summary }], { runs: 1, days: 100, elapsedMs: 1 });
  for (const heading of ['存活率', '现金分位数', '每 10 日', '死亡原因', '首次死亡日', '预检失败', '停工原因', '物资断供', '愿望崩溃', '疾病发生', '普通日', '交付日', '护理日', '与目标区间的差距', '建议调整参数']) {
    assert.match(report, new RegExp(heading));
  }
});

test('runner use命令实际吃自己包食物',()=>{
 const s=fresh(1000); s.actors.xuan.food=10;
 const item=s.items.find(x=>x.itemId==='meal'); item.container='xuan';
 const r=applyCommand(s,{kind:'use',actorId:'xuan',uid:item.uid});
 assert.equal(r.error,undefined); assert.equal(r.state.actors.xuan.food,40);
 assert.equal(s.actors.xuan.food,10);
});
test('runner night命令实际设置开放服务站',()=>{
 const s=fresh(1000); s.flags.shelterDay=s.day;
 const r=applyCommand(s,{kind:'night',spot:'shelter'});
 assert.equal(r.error,undefined); assert.equal(r.state.flags.nightSpot,'shelter');
});
test('无at预检恢复只修非法格保留合法帮厨',()=>{
 let s=fresh(1000); s.pendingMorning=null; s.actors.xuan.energy=0;
 s=assign(s,'xuan',0,'scavenge').state; s=assign(s,'fan',0,'kitchen').state;
 assert.match(preflight(s).error,/体力不足/);
 const r=recoverPreflight(s,null);
 assert.equal(r.plan.xuan[0].id,'rest');
 assert.equal(r.plan.fan[0].id,'kitchen');
 assert.equal(preflight(r).error,undefined);
});
test('已合法休息的定位不再取消其他劳动',()=>{
 let s=fresh(1000); s.pendingMorning=null; s=assign(s,'xuan',0,'rest').state; s=assign(s,'fan',0,'kitchen').state;
 const r=recoverPreflight(s,{actorId:'xuan',hour:6});
 assert.equal(r.plan.fan[0].id,'kitchen');
});

const statisticsTasks = (state) => {
  const seen = new Set();
  return ['xuan', 'fan', 'ma'].flatMap((id) => {
    const task = state.plan[id][state.hour - 6];
    if (!task || seen.has(task.group || id)) return [];
    seen.add(task.group || id);
    return [task];
  });
};

const measureStatisticsSettlement = (state) => {
  state.pendingMorning = null;
  const meter = createBreakdown();
  const result = settle(state);
  assert.equal(result.error, undefined);
  recordSettledMetrics(meter.breakdown, meter.stages, state, result, statisticsTasks(state));
  return { result, ...finalizeBreakdown(meter.breakdown, meter.stages) };
};

test('真实结算统计劳动、实际吃餐和20日阶段', () => {
  let state = fresh(2001);
  state = assign(state, 'xuan', 6, 'kitchen').state;
  state = assign(state, 'fan', 6, 'rest').state;
  let measured = measureStatisticsSettlement(state);
  assert.deepEqual(measured.breakdown.work, { actorSlots: 1, cash: 12, mealGrants: 2 });
  assert.deepEqual(measured.stages['D1-20'].work, measured.breakdown.work);

  state = fresh(2003);
  const immediateMeter = createBreakdown();
  const item = state.items.find((candidate) => candidate.itemId === 'meal');
  const used = useItem(state, 'xuan', item.uid);
  assert.equal(used.error, undefined);
  recordImmediateMetrics(immediateMeter.breakdown, immediateMeter.stages, state, used.state, { uid: item.uid });
  assert.deepEqual(immediateMeter.breakdown.meals, { consumed: 1, extraMeals: 1, immediate: 1, night: 0 });

  state = fresh(2004);
  state.slot = 3;
  state.hour = 21;
  state.items = [];
  for (const id of ['xuan', 'fan']) {
    state.actors[id].food = 0;
    const bread = makeItem(state, 'bread', id);
    bread.expiresDay = state.day;
    makeItem(state, 'meal', id);
    state = assign(state, id, 21, 'rest').state;
  }
  measured = measureStatisticsSettlement(state);
  assert.deepEqual(measured.breakdown.meals, { consumed: 2, extraMeals: 2, immediate: 0, night: 2 });

  state = fresh(2002);
  state.day = 21;
  state = assign(state, 'xuan', 6, 'scavenge').state;
  state = assign(state, 'fan', 6, 'rest').state;
  measured = measureStatisticsSettlement(state);
  assert.equal(measured.stages['D1-20'].work.actorSlots, 0);
  assert.equal(measured.stages['D21-40'].work.actorSlots, 1);
});

test('精神分项在clamp、跨日愿望与救援下严格对账', () => {
  let state = fresh(2005);
  state.hour = 13;
  state.slot = 1;
  state.actors.xuan.mind = 0;
  state.actors.xuan.food = 0;
  state.wishes.push({ uid: 'metric-wish', actor: 'xuan', templateId: 'xuan_keyboard', category: 'personal', intensity: 90, revealed: true, revealTurn: 0, status: 'active', promise: null, lastLoss: 0 });
  state = assign(state, 'xuan', 13, 'scavenge').state;
  state.actors.fan.mind = 100;
  state = assign(state, 'fan', 13, 'sketch').state;
  let measured = measureStatisticsSettlement(state);
  assert.equal(measured.breakdown.mind.work.negative, -1);
  assert.equal(measured.breakdown.mind.wish.negative, -2);
  assert.equal(measured.breakdown.mind.body.negative, -1);
  assert.equal(measured.breakdown.mind.hobby.positive, 8);
  let net = ['work', 'wish', 'body', 'hobby', 'night', 'other'].reduce((sum, key) => sum + measured.breakdown.mind[key].net, 0);
  assert.equal(net, measured.breakdown.mind.observedDelta);

  state = fresh(2007);
  state.day = 20;
  state.slot = 3;
  state.hour = 21;
  state.wishes.push({ uid: 'boundary-wish', actor: 'xuan', templateId: 'xuan_keyboard', category: 'personal', intensity: 90, revealed: true, revealTurn: 0, status: 'active', promise: null, lastLoss: 0 });
  state = assign(state, 'xuan', 21, 'rest').state;
  state = assign(state, 'fan', 21, 'rest').state;
  measured = measureStatisticsSettlement(state);
  assert.equal(measured.result.state.day, 21);
  assert.equal(measured.stages['D1-20'].mind.wish.negative, -2);
  assert.equal(measured.stages['D21-40'].mind.observedDelta, 0);

  state = fresh(2006);
  state.actors.xuan.life = 'downed';
  state.actors.xuan.mind = 0;
  state.vouchers = 1;
  state = assign(state, 'xuan', 6, 'aid').state;
  state = assign(state, 'fan', 6, 'rest').state;
  measured = measureStatisticsSettlement(state);
  assert.equal(measured.breakdown.mindBand40To70.totalActorTurns, 2);
  assert.equal(Number.isFinite(measured.breakdown.mindBand40To70.percentage), true);
  net = ['work', 'wish', 'body', 'hobby', 'night', 'other'].reduce((sum, key) => sum + measured.breakdown.mind[key].net, 0);
  assert.equal(net, measured.breakdown.mind.observedDelta);
});

function plannedState(state, strategyId = 'balanced', memory = {}) {
  state.pendingMorning = null;
  for (const command of planActions(observeState(state), strategyId, memory)) {
    const result = applyCommand(state, command);
    assert.equal(result.error, undefined);
    state = result.state;
  }
  return state;
}

test('诊疗与采购以及多人救助共享同格现金和救助券', () => {
  let state = fresh(1000);
  state.actors.ma.life = 'active';
  state.metMa = true;
  state.camp.rain = 2;
  state = withBeds(state, 3);
  state.cash = 50;
  state.items = state.items.filter((item) => item.itemId !== 'meal');
  state.effectiveFood = 0;
  state.actors.xuan.diseases.push({ uid: 'undiagnosed', known: false, severity: 20 });
  assert.equal(preflight(plannedState(state)).error, undefined);

  state = fresh(1000);
  state.actors.xuan.life = 'downed';
  state.actors.fan.life = 'downed';
  state.vouchers = 1;
  state.cash = 8;
  assert.equal(preflight(plannedState(state)).error, undefined);
});

test('免费餐尊重每日岗位上限，下一餐采购不覆盖已有供餐', () => {
  const state = fresh(1000);
  state.slot = 3;
  state.cash = 8;
  state.daily.orders.soup = 2;
  state.items = [];
  state.effectiveFood = 0;
  const commands = planActions(observeState(state), 'conservative');
  assert.equal(commands.some((command) => command.actionId === 'soup'), false);
});

test('寒潮前即使角色不在商店也安排缺毯者采购到自己包', () => {
  let state = fresh(1000);
  state.day = 66;
  state.slot = 3;
  state.camp.rain = 2;
  state = withBeds(state, 3);
  state.cash = 200;
  const command = planActions(observeState(state), 'balanced').find((candidate) => candidate.opts?.cart?.some((line) => line.itemId === 'blanket'));
  assert.ok(command);
  assert.equal(command.opts.destination, 'self');
  assert.equal(preflight(plannedState(state)).error, undefined);
});

test('个人补餐在非正餐格的饥饿伤害前使用且优先最饿的人', () => {
  const state = fresh(1000);
  state.actors.xuan.food = 24;
  state.actors.fan.food = 10;
  const command = policies.chooseImmediateCommand(observeState(state), 'balanced');
  assert.equal(command.actorId, 'fan');
  state.actors.fan.food = 60;
  assert.equal(policies.chooseImmediateCommand(observeState(state), 'balanced').actorId, 'xuan');
});

test('均衡排程到店买烟成功计数与即时采购共用报告口径', async () => {
  let state = fresh(1000);
  state.day = 2;
  state.slot = 1;
  state.hour = 10;
  state.turn = 5;
  state.pendingMorning = null;
  state.metMa = true;
  state.cash = 300;
  state.camp.rain = 2;
  state = withBeds(state, 3);
  for (const id of ['xuan', 'fan', 'ma']) {
    Object.assign(state.actors[id], { life: 'active', joinedTurn: 0, health: 100, mind: 60, energy: 100, hygiene: 80, warmth: 80, food: 80 });
    makeItem(state, 'blanket', id);
  }
  makeItem(state, 'meal', 'camp');
  makeItem(state, 'meal', 'camp');
  state.effectiveFood = 6;
  state.wishes = [{ uid: 'trip-smoke', actor: 'xuan', templateId: 'quiet_smoke', category: 'daily', intensity: 60, revealed: true, revealTurn: 0, status: 'active', promise: null, lastLoss: 0 }];
  const planned = planActions(observeState(state), 'balanced');
  assert.ok(planned.some((command) => command.opts?.cart?.some((line) => line.itemId === 'cigarette')));
  const run = await runGame({ seed: 1000, strategyId: 'balanced', maxDays: 2, initialState: state });
  assert.equal(run.cigarettePurchases, 1);
});

test('当晚已摆第三床增加的精神计入夜间而非残差', () => {
  let state = fresh(1000);
  state.slot = 3;
  state.hour = 21;
  state.turn = 7;
  state.day = 2;
  state.metMa = true;
  state.camp.rain = 2;
  for (const id of ['xuan', 'fan', 'ma']) {
    Object.assign(state.actors[id], { life: 'active', health: 100, mind: 40, food: 80, warmth: 80, energy: 80, hygiene: 80 });
  }
  state = withBeds(state, 3);
  for (const id of ['xuan', 'fan', 'ma']) state = assign(state, id, 21, 'sleep').state;
  const measured = measureStatisticsSettlement(state);
  assert.equal(measured.result.night.beds, 3);
  assert.equal(measured.breakdown.mind.night.positive, 9);
  assert.equal(measured.breakdown.mind.other.positive, 0);
});

async function mechanicMetrics() {
  return import('../scripts/autoplay/metrics.js');
}

test('第二批观察包含公开库存可及性、街区桶与委托，读取不改变引擎状态', () => {
  const state = fresh(1000);
  state.actors.xuan.location = 'camp';
  state.flags.cooldown = { phonestall: 4 };
  state.flags.binSkill = { xuan: 6 };
  const broken = makeItem(state, 'broken_radio', 'camp');
  const radio = makeItem(state, 'radio', 'xuan');
  state.actors.fan.location = 'market';
  const before = structuredClone(state);
  const view = observeState(state);
  assert.equal(view.flags?.binSkill.xuan, 6);
  assert.equal(view.flags?.cooldown.phonestall, 4);
  assert.equal(view.prices.gloves, 8);
  assert.equal(view.shops.art_hardware.district, 'cinema');
  assert.equal(view.items.find(item => item.uid === broken.uid).repairable, true);
  assert.equal(view.items.find(item => item.uid === radio.uid).salvageOptions.find(option => option.id === 'sell').enabled, false);
  assert.equal(view.binsAvailable?.recycle.length, 2);
  assert.deepEqual(view.favorStatus?.reg_liu.eligibleActorIds, ['fan']);
  assert.equal(view.relations?.reg_liu.trust, 0);
  assert.deepEqual(state, before);
});

test('机制统计按成功结算计摆摊实际收入、修复材料和失约，并按病种去重', async () => {
  const metricsApi = await mechanicMetrics();
  const before = fresh(1000);
  before.day = 4;
  before.favors = { reg_liu: { step: 0, active: { id: 'liu1', deadline: 3 }, done: [], cooldownUntil: 0 } };
  const broken = makeItem(before, 'broken_radio', 'xuan');
  const after = structuredClone(before);
  after.items.find(item => item.uid === broken.uid).itemId = 'radio';
  after.parts--;
  after.favors.reg_liu.active = null;
  after.favors.reg_liu.cooldownUntil = 7;
  after.actors.xuan.diseases.push({uid:'gut-case',kind:'gut'});
  after.actors.fan.diseases.push({uid:'skin-case',kind:'skin'});
  const metrics = metricsApi.createMechanismMetrics?.(before) || {};
  const result = { state: after, events: ['轩哥的修手机小摊今天来了3个人，收入11。', '马哥的杯子刚摆好就被城管赶了，白忙一场，精神-3。'] };
  const tasks = [{id:'phonestall',participants:['xuan']},{id:'shellgame',participants:['ma']},{id:'repair_item',participants:['xuan']}];
  const origins = new Map([['xuan',{plannedActionId:'repair'}],['ma',{plannedActionId:'run'}]]);
  metricsApi.recordMechanismSettlement?.(metrics,before,result,tasks,origins);
  assert.equal(metrics.phonestall?.cash, 11);
  assert.equal(metrics.shellgame?.expelled, 1);
  assert.equal(metrics.salvage?.repairs, 1);
  assert.equal(metrics.salvage?.partsConsumed, 1);
  assert.equal(metrics.favors?.expired, 1);
  assert.deepEqual(metrics.diseases, {gut:1,skin:1,wound:0,chill:0});
  metricsApi.recordMechanismSettlement?.(metrics,after,{state:structuredClone(after),events:[]},[],new Map());
  assert.equal(metrics.diseases.gut, 1);
});

test('机制即时账本区分售瓶、旧物处置与接委托，报告保留零触发样本', async () => {
  const metricsApi = await mechanicMetrics();
  const state = fresh(1000);
  const radio = makeItem(state, 'radio', 'xuan');
  const metrics = metricsApi.createMechanismMetrics?.(state) || {};
  const kept = structuredClone(state);
  kept.items.find(item=>item.uid===radio.uid).kept = true;
  metricsApi.recordMechanismCommand?.(metrics,state,{state:kept},{kind:'salvageDispose',uid:radio.uid,choice:'keep'});
  const sold = structuredClone(kept);
  sold.cash += 7;
  metricsApi.recordMechanismCommand?.(metrics,kept,{state:sold},{kind:'sellBottles',actorId:'xuan'});
  assert.equal(metrics.salvage?.kept, 1);
  assert.equal(metrics.bins?.bottleSales, 7);
  const run = {survivors:3,completedDay100:false,series:[],firstDeathDay:null,deaths:[],preflightFailures:0,foodOutageDays:0,wishBreakdowns:0,diseaseCases:0,lotteryBuyDays:0,cardGameDays:0,dayCash:{ordinary:[],delivery:[],care:[]},cash:0,mechanics:metrics};
  const summary = summarizeRuns([run,{...run,mechanics:{}}]);
  assert.equal(summary.mechanics?.salvage.kept.mean, 0.5);
  assert.equal(summary.mechanics?.salvage.kept.samples, 1);
  assert.equal(summary.mechanics?.salvage.kept.min, 0);
});

test('乞讨观察保留已经发生的对话日志且不会共享可变数组', () => {
  const state = fresh(1000);
  state.pending.beg = [{actorId:'xuan',district:'market',slot:0,style:'ask',done:false,npcs:[{id:'visible',type:'kind',patience:3,stage:'ask',log:['已经说过的话'],result:null}]}];
  const npc = observeState(state).pending.beg[0].npcs[0];
  assert.deepEqual(npc.log, ['已经说过的话']);
  npc.log.push('外部改动');
  assert.deepEqual(state.pending.beg[0].npcs[0].log, ['已经说过的话']);
});

test('runner 将售瓶与委托命令交给真实引擎，并能拒绝不合法交易', () => {
  const state = fresh(1000);
  state.slot = 1;
  state.bottles = 4;
  state.actors.xuan.location = 'recycle';
  const sold = applyCommand(state, {kind:'sellBottles',actorId:'xuan'});
  assert.equal(sold.error, undefined);
  assert.equal(sold.state.cash, state.cash + 4);
  assert.equal(sold.state.bottles, 0);
  assert.equal(state.bottles, 4);
  state.actors.fan.location = 'market';
  const accepted = applyCommand(state, {kind:'acceptFavor',npcId:'reg_liu',actorId:'fan'});
  assert.equal(accepted.error, undefined);
  assert.equal(accepted.state.favors.reg_liu.active.id, 'liu1');
  const wrongPlace = applyCommand(state, {kind:'sellBottles',actorId:'fan'});
  assert.match(wrongPlace.error, /回收巷/);
});

test('受控财富下零乞讨由真实现金门槛解释，时段采购与账本对账', async () => {
  const initialState = fresh(1000);
  initialState.cash = 300;
  initialState.ledger.start = 300;
  const run = await runGame({seed:1000,strategyId:'balanced',maxDays:6,initialState});
  assert.equal(run.mechanics.beg.sessions, 0);
  assert.equal(run.mechanics.beg.lowCashSlots, 0);
  assert.ok(run.cashAtSlot1.length >= 5);
  assert.equal(run.mechanics.beg.minSlot1Cash, Math.min(...run.cashAtSlot1.map((entry) => entry.cash)));
  for (const entry of run.cashAtSlot1) {
    assert.equal(entry.reserve, entry.living * 16);
    assert.ok(entry.beforeCash >= entry.reserve);
    assert.ok(entry.cash >= entry.reserve);
    assert.equal(entry.cash, entry.ledgerStart + entry.ledgerIncome - entry.ledgerExpense);
  }
  const ordinary = await runGame({seed:1000,strategyId:'balanced',maxDays:6});
  assert.ok(ordinary.cashAtSlot1.length >= 5);
  assert.ok(ordinary.cashAtSlot1.every((entry) => entry.cash === entry.ledgerStart + entry.ledgerIncome - entry.ledgerExpense));
});

test('runner 接受两个只改变指定决策的新对照策略', async () => {
  await assert.doesNotReject(async () => {
    const control = await runGame({seed:1000,strategyId:'gambler_control',maxDays:1});
    const novice = await runGame({seed:1000,strategyId:'balanced_novice',maxDays:1});
    assert.equal(control.mechanics.pending.remaining,0);
    assert.equal(novice.mechanics.pending.remaining,0);
  });
});

test('委托奖励餐进入原工作餐账本，新增精神损失记录实际clamp变化', async () => {
  const state = fresh(1000);
  state.flags.liuBonusMeal = true;
  state.pendingMorning = null;
  let planned = assign(state, 'fan', 6, 'kitchen').state;
  planned = assign(planned, 'xuan', 6, 'rest').state;
  const result = settle(planned);
  assert.equal(result.error, undefined);
  const breakdown = createBreakdown();
  recordSettledMetrics(breakdown.breakdown,breakdown.stages,planned,result,[planned.plan.fan[0],planned.plan.xuan[0]]);
  assert.equal(breakdown.breakdown.work.mealGrants, 3);
  const interaction = await import('../scripts/autoplay/interaction-metrics.js');
  const pending = fresh(1000);
  pending.actors.xuan.mind = 1;
  pending.pending.beg=[{actorId:'xuan',district:'station',slot:0,style:'ask',npcs:[],refusals:2,cash:0,done:false}];
  const command={kind:'begStep',sessionIndex:0,npcId:null,step:'finish'};
  const finished=applyCommand(pending,command);
  const metrics=interaction.createInteractionMetrics();
  interaction.recordInteractionMetrics(metrics,pending,finished,command);
  assert.equal(metrics.beg.refusalMindLoss, 1);
});

test('博彩对照的牌局决策应用当前精神恢复阈值', async () => {
  const {ready}=await import('./engine-fixtures.js');
  let state=ready(1000,{ma:true,slot:1});
  state.cash=400;
  state.camp.rain=2;
  state = withBeds(state, 3);
  for(const [id,actor] of Object.entries(state.actors)) {
    Object.assign(actor,{mind:80,hygiene:80,warmth:80,health:90,energy:90,food:80});
    makeItem(state,'blanket',id);
  }
  state.actors.ma.mind=44;
  state.events=[{uid:'cards-now',title:'雨棚下的牌桌',setup:'机会',district:'station',status:'open',expiresTurn:state.turn+2}];
  for(let n=0;n<6;n++)makeItem(state,'meal','camp');
  state.effectiveFood=10;
  assert.equal(policies.chooseControlCardEvent(observeState(state),{recovering:{ma:false}}),null);
});

test('机制净亏损也算非零收益样本，不从触发统计消失', async () => {
  const {summarizeMechanisms}=await import('../scripts/autoplay/mechanism-report.js');
  const summary=summarizeMechanisms([{mechanics:{bins:{netCash:-8}}},{mechanics:{}}]);
  assert.equal(summary.bins.netCash.mean,-4);
  assert.equal(summary.bins.netCash.samples,1);
});
