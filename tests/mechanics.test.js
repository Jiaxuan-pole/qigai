import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../public/game/data.js';
import { TYPES, beginSession } from '../public/game/beg.js';
import { generateBoard } from '../public/game/bins.js';
import { makeItem } from '../public/game/items.js';
import { settle } from '../public/game/settle.js';
import { currentTask } from '../public/game/clock.js';
import { ready } from './engine-fixtures.js';
import { observeState } from '../scripts/autoplay/observe.js';
import * as mechanics from '../scripts/autoplay/mechanics.js';
import { fitBudget } from '../scripts/autoplay/planning.js';
import * as policies from '../scripts/autoplay/policies.js';
import * as runner from '../scripts/autoplay/runner.js';
import * as interactionMetrics from '../scripts/autoplay/interaction-metrics.js';

before(async () => {
  await loadData();
});

function pendingBeg(type, actorId = 'xuan') {
  const state = ready(5101);
  state.pending.beg.push({
    actorId, district: 'station', slot: state.slot, style: 'ask', refusals: 0, cash: 0, done: false,
    npcs: [{ id: 'npc-1', name: '路人', job: '', type, patience: TYPES[type].patience, stage: 'open', log: [], result: null, revealed: false }],
  });
  return state;
}

test('观察层只暴露 pending 交互的玩家可见投影', () => {
  const state = pendingBeg('hurried');
  const board = generateBoard(state, 'xuan', 'station:0');
  board.cells[0] = { kind: 'loot', loot: { type: 'cash', id: 'cash', qty: 3 }, warned: false, revealed: false };
  board.cells[1] = { kind: 'dirt', warned: true, revealed: false };
  board.cells[2] = { kind: 'loot', loot: { type: 'resource', id: 'parts', qty: 1 }, warned: false, revealed: true };
  state.pending.bins.push(board);

  const view = observeState(state);
  assert.equal(view.pending.beg[0].npcs[0].hint, TYPES.hurried.hint);
  assert.equal('type' in view.pending.beg[0].npcs[0], false);
  assert.deepEqual(view.pending.bins[0].cells[0], { index: 0, revealed: false, warned: false });
  assert.deepEqual(view.pending.bins[0].cells[1], { index: 1, revealed: false, warned: true });
  assert.deepEqual(view.pending.bins[0].cells[2].loot, { type: 'resource', id: 'parts', qty: 1 });
});

test('读人策略按外观提示选中 like，只在 like 包含当事人时用拿手活', () => {
  let view = observeState(pendingBeg('hurried', 'xuan'));
  assert.deepEqual(mechanics.choosePendingCommand(view, 'balanced'), {
    kind: 'begStep', sessionIndex: 0, npcId: 'npc-1', step: 'open', value: 'direct',
  });
  view = observeState(pendingBeg('story', 'xuan'));
  assert.equal(mechanics.choosePendingCommand(view, 'balanced').value, 'special');
  view = observeState(pendingBeg('story', 'fan'));
  assert.equal(mechanics.choosePendingCommand(view, 'balanced').value, 'story');
});

test('新手对照只由专用ID或选项启用，固定拿手活并要现金', () => {
  const state = pendingBeg('hurried', 'xuan');
  let view = observeState(state);
  assert.equal(mechanics.choosePendingCommand(view, 'balanced_novice').value, 'special');
  assert.equal(mechanics.choosePendingCommand(view, 'not-registered'), null);
  assert.equal(mechanics.choosePendingCommand(view, 'not-registered', { novice: true }).value, 'special');
  state.pending.beg[0].npcs[0].stage = 'ask';
  state.items = state.items.filter((item) => !['meal', 'bread', 'hot_soup'].includes(item.itemId));
  view = observeState(state);
  assert.equal(mechanics.choosePendingCommand(view, 'balanced_novice').value, 'cash');
});

test('怕脏路人在行动者卫生低于40时跳过会话', () => {
  const state = pendingBeg('clean');
  state.actors.xuan.hygiene = 39;
  state.pending.beg[0].npcs.push({
    id: 'npc-2', name: '后来的路人', job: '', type: 'hurried', patience: TYPES.hurried.patience,
    stage: 'open', log: [], result: null, revealed: false,
  });
  assert.deepEqual(mechanics.choosePendingCommand(observeState(state), 'balanced'), {
    kind: 'begStep', sessionIndex: 0, npcId: 'npc-2', step: 'open', value: 'direct',
  });
  state.pending.beg[0].npcs[1].stage = 'done';
  assert.equal(mechanics.choosePendingCommand(observeState(state), 'balanced').step, 'finish');
});

test('开口时按可见新鲜食物实例补足存活人数，余量足则要现金', () => {
  const state = pendingBeg('kind');
  const npc = state.pending.beg[0].npcs[0];
  npc.stage = 'ask';
  state.effectiveFood = 99;
  state.items = state.items.filter((item) => !['meal', 'bread', 'hot_soup'].includes(item.itemId));
  assert.equal(mechanics.choosePendingCommand(observeState(state), 'balanced').value, 'food');
  makeItem(state, 'meal', 'camp');
  makeItem(state, 'bread', 'camp');
  assert.equal(mechanics.choosePendingCommand(observeState(state), 'balanced').value, 'food');
  makeItem(state, 'meal', 'camp');
  assert.equal(mechanics.choosePendingCommand(observeState(state), 'balanced').value, 'cash');
});

test('翻桶每步重新避开警告格，低卫生、两次脏物或无安全格立即放弃', () => {
  const state = ready(5102);
  const board = generateBoard(state, 'xuan', 'station:0');
  board.cells = board.cells.map((cell, index) => ({ ...cell, warned: index !== 3, revealed: false }));
  state.pending.bins.push(board);
  assert.deepEqual(mechanics.choosePendingCommand(observeState(state), 'balanced'), {
    kind: 'binReveal', boardIndex: 0, cellIndex: 3,
  });
  state.actors.xuan.hygiene = 34;
  assert.deepEqual(mechanics.choosePendingCommand(observeState(state), 'balanced'), { kind: 'binForfeit', boardIndex: 0 });
  state.actors.xuan.hygiene = 80;
  board.dirtHits = 2;
  assert.equal(mechanics.choosePendingCommand(observeState(state), 'balanced').kind, 'binForfeit');
  board.dirtHits = 0;
  board.cells[3].revealed = true;
  assert.equal(mechanics.choosePendingCommand(observeState(state), 'balanced').kind, 'binForfeit');
});

test('runner 通过逐步命令完成对话并累计真实结果指标', async () => {
  const state = pendingBeg('hurried');
  state.items = state.items.filter((item) => !['meal', 'bread', 'hot_soup'].includes(item.itemId));
  const run = await runner.runGame({ seed: state.seed, strategyId: 'balanced', maxDays: 0, initialState: state });
  assert.equal(run.stopReason, 'day-limit');
  assert.equal(run.mechanics.pending.remaining, 0);
  assert.equal(run.mechanics.pending.fallbacks, 0);
  assert.partialDeepStrictEqual(run.mechanics.beg, {
    sessions: 1, openings: 1, likes: 1, asks: 1, successes: 1,
    cash: 0, food: 1, tips: 0, refusalMindLoss: 0,
  });
  assert.equal(run.mechanics.beg.cash + run.mechanics.beg.food + run.mechanics.beg.tips, run.mechanics.beg.successes);
});

test('runner 在 day-limit 返回前清空多块桶并记录每步收益', async () => {
  const state = ready(5103);
  const first = generateBoard(state, 'xuan', 'station:0');
  first.cells = first.cells.map((cell, index) => index === 0
    ? { kind: 'loot', loot: { type: 'cash', id: 'cash', qty: 2 }, warned: false, revealed: false }
    : { ...cell, warned: true, revealed: false });
  const second = generateBoard(state, 'xuan', 'station:1');
  second.cells = second.cells.map((cell, index) => index === 0
    ? { kind: 'loot', loot: { type: 'resource', id: 'parts', qty: 1 }, warned: false, revealed: false }
    : { ...cell, warned: true, revealed: false });
  state.pending.bins.push(first, second);

  const run = await runner.runGame({ seed: state.seed, strategyId: 'balanced', maxDays: 0, initialState: state });
  assert.equal(run.mechanics.pending.remaining, 0);
  assert.equal(run.mechanics.pending.fallbacks, 0);
  assert.equal(run.mechanics.bins.boards, 2);
  assert.equal(run.mechanics.bins.reveals, 2);
  assert.equal(run.mechanics.bins.cash, 2);
  assert.equal(run.mechanics.bins.parts, 1);
  assert.equal(run.mechanics.bins.actions, 0);
});

test('桶行动数只在主行动成功开板的结算时累计', () => {
  let state = ready(5106);
  state = runner.applyCommand(state, { kind: 'assign', actorId: 'xuan', actionId: 'bins', opts: { zone: 'station' } }).state;
  const result = settle(state, { controlledActorId: 'xuan' });
  assert.equal(result.error, undefined);
  assert.equal(result.state.pending.bins.length, 2);
  const metrics = interactionMetrics.createInteractionMetrics();
  const tasks = [currentTask(state, 'xuan')];
  interactionMetrics.recordSettledInteractionMetrics(metrics, state, result, tasks);
  assert.equal(metrics.bins.actions, 1);
  assert.equal(metrics.bins.boards, 0);
});

test('runner 在 ending 前仍清空 pending，无决定时记录 fallback', async () => {
  const state = ready(5104);
  state.phase = 'ending';
  const board = generateBoard(state, 'xuan', 'station:0');
  board.done = true;
  state.pending.bins.push(board);
  const run = await runner.runGame({ seed: state.seed, strategyId: 'balanced', initialState: state });
  assert.equal(run.stopReason, 'ending');
  assert.equal(run.mechanics.pending.remaining, 0);
  assert.equal(run.mechanics.pending.fallbacks, 1);
});

test('逐步互动指标从真实结果统计拒绝精神损失与脏物', async () => {
  const begState = pendingBeg('kind');
  begState.phase = 'ending';
  begState.pending.beg[0].npcs[0].stage = 'done';
  begState.pending.beg[0].npcs[0].result = { kind: 'refusal' };
  begState.pending.beg[0].refusals = 1;
  const begRun = await runner.runGame({ seed: begState.seed, strategyId: 'balanced', initialState: begState });
  assert.equal(begRun.mechanics.beg.refusalMindLoss, 1);
  assert.equal(begRun.breakdown.mind.observedDelta, -1);

  const binState = ready(5105);
  binState.phase = 'ending';
  binState.actors.xuan.hygiene = 80;
  const board = generateBoard(binState, 'xuan', 'station:0');
  board.cells = board.cells.map((cell, index) => index < 2
    ? { kind: 'dirt', warned: false, revealed: false }
    : { ...cell, warned: true, revealed: false });
  binState.pending.bins.push(board);
  const binRun = await runner.runGame({ seed: binState.seed, strategyId: 'balanced', initialState: binState });
  assert.equal(binRun.mechanics.bins.dirtHits, 2);
  assert.equal(binRun.mechanics.bins.reveals, 2);
  assert.equal(binRun.mechanics.bins.actions, 0);
});

test('策略不给 pending 决定时才调用 fallback，且接口错误不被吞掉', () => {
  const state = pendingBeg('hurried');
  assert.equal(mechanics.choosePendingCommand(observeState(state), 'unsupported'), null);
  const result = runner.applyCommand(state, { kind: 'begStep', sessionIndex: 0, npcId: 'npc-1', step: 'open', value: 'missing' });
  assert.match(result.error, /没有这句开场白/);
});

function mechanicView(overrides = {}) {
  const slot = overrides.slot ?? 0;
  const actors = {
    xuan: { life: 'active', location: 'recycle', hygiene: 60, energy: 80 },
    fan: { life: 'active', location: 'market', hygiene: 60, energy: 80 },
    ma: { life: 'active', location: 'station', hygiene: 60, energy: 80 },
  };
  return {
    day: 8, hour: 9 + slot * 4, slot, cash: 100, vouchers: 1, parts: 3, wood: 3, cloth: 3,
    effectiveFood: 6, actors, items: [], bottles: 0,
    camp: { facilities: [null, null] },
    flags: { cooldown: {}, binSkill: {} },
    daily: { bins: {}, orders: {}, errands: {} },
    gloves: { xuan: false, fan: false, ma: false },
    binsAvailable: {
      market: [{ id: 'market:0', name: '市场桶', used: false }],
      station: [],
      recycle: [{ id: 'recycle:0', name: '回收桶', used: false }],
    },
    shops: {
      art_hardware: { open: true, district: 'cinema', stock: { gloves: 1 } },
      recycle_shop: { open: true, district: 'recycle', stock: {} },
    },
    prices: { gloves: 8 },
    favorStatus: {},
    ...overrides,
    actors: { ...actors, ...(overrides.actors || {}) },
  };
}

const baseCommands = () => [
  { kind: 'assign', actorId: 'xuan', actionId: 'repair' },
  { kind: 'assign', actorId: 'fan', actionId: 'kitchen' },
  { kind: 'assign', actorId: 'ma', actionId: 'run' },
];

const protectedMechanicCommand = (command) => ['warm', 'clinic', 'shop', 'roof', 'bed'].includes(command.actionId);

test('第二批机制由均衡及两个均衡对照共享且保留原行动来源', () => {
  const view = mechanicView();
  for (const strategyId of ['conservative', 'gambler']) {
    assert.deepEqual(mechanics.applyMechanicPlan(view, strategyId, baseCommands(), protectedMechanicCommand), baseCommands());
  }
  const planned = mechanics.applyMechanicPlan(view, 'balanced', baseCommands(), protectedMechanicCommand);
  assert.deepEqual(mechanics.applyMechanicPlan(view, 'balanced_novice', baseCommands(), protectedMechanicCommand), planned);
  assert.deepEqual(mechanics.applyMechanicPlan(view, 'gambler_control', baseCommands(), protectedMechanicCommand), planned);
  const xuan = planned.find((command) => command.actorId === 'xuan');
  assert.equal(xuan.actionId, 'bins');
  assert.equal(xuan.opts.zone, 'recycle');
  assert.equal(xuan.plannedActionId, 'repair');
  assert.equal(xuan.replacementReason, 'mechanics');
});

test('翻桶要求轩哥前两格卫生达标、当天未翻且投影有可用桶', () => {
  let view = mechanicView({ slot: 1 });
  assert.equal(mechanics.applyMechanicPlan(view, 'balanced', baseCommands(), protectedMechanicCommand)[0].actionId, 'bins');
  view = mechanicView({ slot: 2 });
  assert.notEqual(mechanics.applyMechanicPlan(view, 'balanced', baseCommands(), protectedMechanicCommand)[0].actionId, 'bins');
  view = mechanicView({ actors: { xuan: { ...mechanicView().actors.xuan, hygiene: 49 } } });
  assert.notEqual(mechanics.applyMechanicPlan(view, 'balanced', baseCommands(), protectedMechanicCommand)[0].actionId, 'bins');
  view = mechanicView({ daily: { bins: {}, orders: { bins: 1 }, errands: {} } });
  assert.notEqual(mechanics.applyMechanicPlan(view, 'balanced', baseCommands(), protectedMechanicCommand)[0].actionId, 'bins');
});

test('低现金时马哥第二格乞讨且不会覆盖保护命令', () => {
  let view = mechanicView({ slot: 1, cash: 47 });
  let planned = mechanics.applyMechanicPlan(view, 'balanced', baseCommands(), protectedMechanicCommand);
  assert.deepEqual(planned.find((command) => command.actorId === 'ma').opts, { zone: 'station', style: 'ask' });
  view = mechanicView({ slot: 1, cash: 48 });
  planned = mechanics.applyMechanicPlan(view, 'balanced', baseCommands(), protectedMechanicCommand);
  assert.notEqual(planned.find((command) => command.actorId === 'ma').actionId, 'beg');
  const protectedCommands = baseCommands().map((command) => command.actorId === 'ma' ? { ...command, actionId: 'warm' } : command);
  view = mechanicView({ slot: 1, cash: 0 });
  assert.equal(mechanics.applyMechanicPlan(view, 'balanced', protectedCommands, protectedMechanicCommand).find((command) => command.actorId === 'ma').actionId, 'warm');
});

test('可及旧物优先维修且营地坏电视才触发修理桌施工', () => {
  let view = mechanicView({ items: [{ uid: 'broken-phone', itemId: 'broken_phone', container: 'xuan', repairable: true }] });
  let xuan = mechanics.applyMechanicPlan(view, 'balanced', baseCommands(), protectedMechanicCommand)[0];
  assert.equal(xuan.actionId, 'repair_item');
  assert.equal(xuan.opts.zone, 'recycle');
  assert.deepEqual(xuan.resourceCost, { parts: 1 });

  view = mechanicView({ parts: 1, items: [{ uid: 'tv', itemId: 'broken_tv', container: 'camp', repairable: false }] });
  xuan = mechanics.applyMechanicPlan(view, 'balanced', baseCommands(), protectedMechanicCommand)[0];
  assert.equal(xuan.actionId, 'facility');
  assert.deepEqual(xuan.opts.facility, { kind: 'repair_table', slot: 0 });
  assert.deepEqual(xuan.resourceCost, { parts: 1, wood: 2 });

  view = mechanicView({ items: [{ uid: 'tv', itemId: 'broken_tv', container: 'xuan', repairable: false }] });
  assert.notEqual(mechanics.applyMechanicPlan(view, 'balanced', baseCommands(), protectedMechanicCommand)[0].actionId, 'facility');
});

test('冷却手艺替换普通工作但不覆盖保护命令', () => {
  const view = mechanicView({ slot: 2, daily: { bins: {}, orders: { bins: 1 }, errands: {} } });
  let planned = mechanics.applyMechanicPlan(view, 'balanced', baseCommands(), protectedMechanicCommand);
  assert.equal(planned.find((command) => command.actorId === 'xuan').actionId, 'phonestall');
  assert.equal(planned.find((command) => command.actorId === 'ma').actionId, 'shellgame');
  const cooldown = mechanicView({ slot: 2, flags: { cooldown: { phonestall: 9, shellgame: 9 }, binSkill: {} }, daily: { bins: {}, orders: { bins: 1 }, errands: {} } });
  planned = mechanics.applyMechanicPlan(cooldown, 'balanced', baseCommands(), protectedMechanicCommand);
  assert.equal(planned.find((command) => command.actorId === 'xuan').actionId, 'repair');
  assert.equal(planned.find((command) => command.actorId === 'ma').actionId, 'run');
});

test('即时机制购买手套时服从必要储备且只买一次', () => {
  let view = mechanicView({ actors: { xuan: { ...mechanicView().actors.xuan, location: 'cinema' } } });
  assert.deepEqual(mechanics.chooseMechanicImmediateCommand(view, 'balanced', { reserveCash: 92 }), {
    kind: 'buy', actorId: 'xuan', destination: 'self', cart: [{ shopId: 'art_hardware', itemId: 'gloves', qty: 1 }],
  });
  assert.equal(mechanics.chooseMechanicImmediateCommand(view, 'balanced', { reserveCash: 93 }), null);
  view = mechanicView({ gloves: { xuan: true, fan: false, ma: false }, actors: { xuan: { ...mechanicView().actors.xuan, location: 'cinema' } } });
  assert.equal(mechanics.chooseMechanicImmediateCommand(view, 'balanced', { reserveCash: 0 }), null);
  view = mechanicView({
    actors: { xuan: { ...mechanicView().actors.xuan, location: 'cinema' } },
    daily: { bins: {}, orders: {}, errands: { 'xuan:9': true } },
  });
  assert.equal(mechanics.chooseMechanicImmediateCommand(view, 'balanced', { reserveCash: 0 }), null);
});

test('即时机制只留首台收音机并出售可卖旧物与瓶罐', () => {
  let view = mechanicView({ items: [{ uid: 'radio-1', itemId: 'radio', container: 'xuan', kept: false, salvageOptions: [{ id: 'keep', enabled: true }, { id: 'sell', enabled: true }] }] });
  assert.deepEqual(mechanics.chooseMechanicImmediateCommand(view, 'balanced'), { kind: 'salvageDispose', uid: 'radio-1', choice: 'keep', opts: { actorId: 'xuan' } });
  view = mechanicView({ items: [
    { uid: 'radio-kept', itemId: 'radio', container: 'xuan', kept: true, salvageOptions: [] },
    { uid: 'phone-1', itemId: 'phone', container: 'xuan', kept: false, salvageOptions: [{ id: 'sell', enabled: true }] },
  ] });
  assert.deepEqual(mechanics.chooseMechanicImmediateCommand(view, 'balanced'), { kind: 'salvageDispose', uid: 'phone-1', choice: 'sell', opts: { actorId: 'xuan' } });
  view = mechanicView({ bottles: 4 });
  assert.deepEqual(mechanics.chooseMechanicImmediateCommand(view, 'balanced'), { kind: 'sellBottles', actorId: 'xuan' });
  view = mechanicView({
    actors: { xuan: { ...mechanicView().actors.xuan, location: 'camp' } },
    items: [{ uid: 'tv-camp', itemId: 'tv', container: 'camp', kept: false, salvageOptions: [{ id: 'sell', enabled: false }] }],
  });
  assert.deepEqual(mechanics.chooseMechanicImmediateCommand(view, 'balanced'), {
    kind: 'transferItem', actorId: 'xuan', uid: 'tv-camp', to: 'xuan',
  });
});

test('即时机制只接刘姐和老陈第一段count委托', () => {
  const eligible = { active: null, cooldownUntil: 0, district: 'market', eligibleActorIds: ['fan'], finished: false };
  let view = mechanicView({ favorStatus: { reg_liu: { ...eligible, step: { id: 'liu1', kind: 'count', actions: ['kitchen'] } } } });
  assert.deepEqual(mechanics.chooseMechanicImmediateCommand(view, 'balanced'), { kind: 'acceptFavor', npcId: 'reg_liu', actorId: 'fan' });
  view = mechanicView({ favorStatus: { reg_liu: { ...eligible, step: { id: 'liu2', kind: 'count', actions: ['carry'] } } } });
  assert.equal(mechanics.chooseMechanicImmediateCommand(view, 'balanced'), null);
  view = mechanicView({ favorStatus: { reg_chen: { ...eligible, district: 'station', eligibleActorIds: ['ma'], step: { id: 'chen1', kind: 'count', actions: ['run'] } } } });
  assert.equal(mechanics.chooseMechanicImmediateCommand(view, 'balanced').npcId, 'reg_chen');
});

test('共享预算会为旧物维修和修理桌预留真实资源', () => {
  const view = mechanicView({ parts: 1, wood: 1 });
  const commands = baseCommands().map((command) => command.actorId === 'xuan' ? {
    ...command,
    actionId: 'facility',
    opts: { facility: { kind: 'repair_table', slot: 0 } },
    resourceCost: { parts: 1, wood: 2 },
    plannedActionId: 'repair',
  } : command);
  const fitted = fitBudget(view, commands);
  assert.equal(fitted.find((command) => command.actorId === 'xuan').actionId, 'repair');

  view.wood = 2;
  const affordable = fitBudget(view, commands);
  assert.equal(affordable.find((command) => command.actorId === 'xuan').actionId, 'facility');
});

function controlState() {
  const state = ready(5201);
  state.day = 9;
  state.hour = 13;
  state.hourTick = (state.day - 1) * 16 + state.hour - 6;
  state.slot = 1;
  state.turn = (state.day - 1) * 4 + state.slot;
  state.cash = 120;
  state.metMa = true;
  state.actors.ma.life = 'active';
  state.actors.ma.joinedTurn = 0;
  state.camp.rain = 3;
  state.camp.beds = 3;
  state.effectiveFood = 6;
  for (const [id, actor] of Object.entries(state.actors)) {
    Object.assign(actor, { mind: 80, health: 90, hygiene: 80, energy: 90, warmth: 80 });
    makeItem(state, 'blanket', id);
  }
  return state;
}

test('均衡新手和博彩对照的非博彩配置与行为统一复用balanced', () => {
  const state = controlState();
  state.daily.bets = 2;
  const view = observeState(state);
  for (const strategyId of ['balanced_novice', 'gambler_control']) {
    assert.deepEqual(
      { foodPerLiving: policies.STRATEGIES[strategyId].foodPerLiving, foodBuffer: policies.STRATEGIES[strategyId].foodBuffer },
      { foodPerLiving: policies.STRATEGIES.balanced.foodPerLiving, foodBuffer: policies.STRATEGIES.balanced.foodBuffer },
    );
    assert.deepEqual(policies.planActions(view, strategyId, {}), policies.planActions(view, 'balanced', {}));
    assert.deepEqual(policies.updateStrategyMemory(view, strategyId, {}), policies.updateStrategyMemory(view, 'balanced', {}));
    assert.deepEqual(policies.chooseImmediateCommand(view, strategyId), policies.chooseImmediateCommand(view, 'balanced'));
    assert.deepEqual(policies.chooseFoodPurchase(view, strategyId), policies.chooseFoodPurchase(view, 'balanced'));
    assert.deepEqual(policies.chooseCarePurchase(view, strategyId), policies.chooseCarePurchase(view, 'balanced'));
    assert.deepEqual(policies.chooseCigarettePurchase(view, strategyId), policies.chooseCigarettePurchase(view, 'balanced'));
    assert.deepEqual(policies.chooseImmediateMechanicCommand(view, strategyId), policies.chooseImmediateMechanicCommand(view, 'balanced'));
  }
});

test('博彩对照在富余时参加牌桌并每天至多安排一张彩票', () => {
  const state = controlState();
  state.events.push({ uid: 'cards-open', title: '雨棚下的牌桌', status: 'open', options: ['join_paid'] });
  let view = observeState(state);
  assert.deepEqual(policies.chooseControlCardEvent(view, {}), {
    kind: 'event', uid: 'cards-open', choiceId: 'join_paid', actorId: 'ma',
  });

  state.daily.bets = 1;
  state.daily.orders.cards = 1;
  view = observeState(state);
  const ma = policies.planActions(view, 'gambler_control', {}).find((command) => command.actorId === 'ma');
  assert.equal(ma.actionId, 'shop');
  assert.equal(ma.opts.cart[0].itemId, 'ticket');
  assert.equal(ma.plannedActionId, 'run');
  assert.equal(policies.chooseControlCardEvent(view, {}), null);
  state.daily.bets = 2;
  assert.notEqual(policies.planActions(observeState(state), 'gambler_control', {}).find((command) => command.actorId === 'ma').actionId, 'shop');
});

test('博彩对照在饥饿护理与预约格保护时不买票也不抢牌桌', () => {
  const state = controlState();
  state.events.push({ uid: 'cards-open', title: '雨棚下的牌桌', status: 'open', options: ['join_paid'] });
  state.items = state.items.filter((item) => !['meal', 'bread', 'hot_soup'].includes(item.itemId));
  state.effectiveFood = 0;
  state.cash = 20;
  let view = observeState(state);
  assert.equal(policies.chooseControlCardEvent(view, {}), null);
  assert.notEqual(policies.planActions(view, 'gambler_control', {}).find((command) => command.actorId === 'ma').opts?.cart?.[0]?.itemId, 'ticket');

  state.cash = 120;
  state.effectiveFood = 6;
  state.actors.ma.warmth = 39;
  view = observeState(state);
  assert.equal(policies.chooseControlCardEvent(view, {}), null);
  assert.equal(policies.planActions(view, 'gambler_control', {}).find((command) => command.actorId === 'ma').actionId, 'warm');

  state.actors.ma.warmth = 80;
  state.plan.ma[state.hour - 6] = { id: 'cards', eventUid: 'already-reserved' };
  assert.equal(policies.chooseControlCardEvent(observeState(state), {}), null);
});

test('原gambler配置与已知购票分支保持不变', () => {
  const state = controlState();
  state.hour = 17;
  state.slot = 2;
  state.hourTick = (state.day - 1) * 16 + state.hour - 6;
  state.turn = (state.day - 1) * 4 + state.slot;
  state.daily.bets = 1;
  state.daily.orders.cards = 1;
  const ma = policies.planActions(observeState(state), 'gambler', {}).find((command) => command.actorId === 'ma');
  assert.deepEqual(policies.STRATEGIES.gambler, { label: '赌徒', foodPerLiving: 1, foodBuffer: 0 });
  assert.equal(ma.actionId, 'shop');
  assert.equal(ma.opts.cart[0].itemId, 'ticket');
});

test('gambler_control pending 使用正常读人而 balanced_novice 固定special和cash', () => {
  const state = pendingBeg('hurried', 'xuan');
  let view = observeState(state);
  assert.equal(mechanics.choosePendingCommand(view, 'gambler_control').value, 'direct');
  assert.equal(mechanics.choosePendingCommand(view, 'balanced_novice').value, 'special');
  state.pending.beg[0].npcs[0].stage = 'ask';
  view = observeState(state);
  assert.equal(mechanics.choosePendingCommand(view, 'balanced_novice').value, 'cash');
});
