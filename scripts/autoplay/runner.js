import { fresh, alive, assign, autoResolvePending, begStep, binForfeit, binReveal, buyNow, eventChoice, meet, morningChoice, setCare, useItem, setNightSpot, sellBottles, salvageDispose, acceptFavor, transferItem, unpackParcel, placeFurniture } from '../../public/game/engine.js';
import { settle, preflight } from '../../public/game/settle.js';
import { currentTask } from '../../public/game/clock.js';
import { claimTicket, scratchTicket } from '../../public/game/shop.js';
import { observeState } from './observe.js';
import { STRATEGIES, chooseCardEvent, chooseControlCardEvent, chooseCarePurchase, chooseCigarettePurchase, chooseFoodPurchase, chooseFurniturePurchase, chooseFurnitureSetup, chooseMorning, planActions, chooseImmediateCommand, chooseImmediateMechanicCommand, chooseNightSpot, choosePreparednessPurchase, updateStrategyMemory } from './policies.js';
import { createBreakdown, recordImmediateMetrics, recordReplacement, recordSettledMetrics, finalizeBreakdown } from './metrics.js';
import { choosePendingCommand } from './mechanics.js';
import { recordInteractionMetrics, recordPendingFallback, recordSettledInteractionMetrics } from './interaction-metrics.js';
import { createMechanismMetrics, recordMechanismSettlement, recordMechanismCommand, finalizeMechanismMetrics } from './metrics.js';

export const STRATEGY_IDS = ['conservative', 'balanced', 'gambler', 'gambler_control', 'balanced_novice'];
const IDS = ['xuan', 'fan', 'ma'];
const DELIVERY_ACTIONS = new Set(['coop', 'trio', 'oddjob']);

export function buildSeeds(count) {
  return Array.from({ length: count }, (_, index) => 1000 + index);
}

const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)];
};

export function countNewDiseases(seen, actors) {
  let count = 0;
  for (const [id, actor] of Object.entries(actors)) {
    for (const disease of actor.diseases) {
      const key = `${id}:${disease.uid}`;
      if (seen.has(key)) continue;
      seen.add(key);
      count++;
    }
  }
  return count;
}

export function recordFoodOutage(days, day, food) {
  if (food === 0) days.add(day);
}

function makeTracker(state) {
  return {
    ...createBreakdown(),
    strategyMemory: {},
    plannedOrigins: new Map(),
    diseaseKeys: new Set(Object.entries(state.actors).flatMap(([id, actor]) => actor.diseases.map((disease) => `${id}:${disease.uid}`))),
    diseaseCases: 0,
    wishBreakdowns: 0,
    foodOutageDays: new Set(),
    lotteryBuyDays: new Set(),
    cardGameDays: new Set(),
    cigarettePurchases: 0,
    preflightFailures: 0,
    preflightReasons: {},
    stoppageReasons: { energy: 0, mind: 0, intox: 0, jobLimit: 0 },
    dayKinds: new Map(),
    dayCash: { ordinary: [], delivery: [], care: [] },
    cashAtSlot1: [],
    series: [],
    completedDays: 0,
    mechanics: createMechanismMetrics(state),
  };
}

function addCount(record, key) {
  record[key] = (record[key] || 0) + 1;
}

function preflightReason(error) {
  if (error.includes('体力不足')) return ['体力不足', 'energy'];
  if (error.includes('精神不足')) return ['精神不足', 'mind'];
  if (error.includes('醉意')) return ['醉意', 'intox'];
  if (error.includes('岗位/次数已用完')) return ['岗位满', 'jobLimit'];
  if (error.includes('现金不足')) return ['现金不足', null];
  if (error.includes('饭钱')) return ['饭钱保护', null];
  if (error.includes('库存不足')) return ['库存不足', null];
  return [error.replace(/：.*$/, '').slice(0, 30), null];
}

function plannedTasks(state) {
  const seen = new Set();
  const tasks = [];
  for (const id of alive(state)) {
    const task = currentTask(state, id);
    if (!task) continue;
    const key = task.group || id;
    if (seen.has(key)) continue;
    seen.add(key);
    tasks.push(task);
  }
  return tasks;
}

function trackPlannedDay(tracker, state, tasks) {
  const kind = tracker.dayKinds.get(state.day) || { delivery: false, care: false };
  for (const task of tasks) {
    if (DELIVERY_ACTIONS.has(task.id)) kind.delivery = true;
    if (['clinic', 'aid', 'rescue'].includes(task.id) || task.care) kind.care = true;
    if (task.id === 'cards') tracker.cardGameDays.add(state.day);
    if (task.cart?.some((line) => line.itemId === 'ticket')) tracker.lotteryBuyDays.add(state.day);
    if (task.cart?.some((line) => line.itemId === 'cigarette')) tracker.cigarettePurchases++;
  }
  tracker.dayKinds.set(state.day, kind);
}

function trackTransition(tracker, before, result) {
  const after = result.state;
  const tasks = plannedTasks(before);
  recordSettledMetrics(tracker.breakdown, tracker.stages, before, result, tasks);
  recordSettledInteractionMetrics(tracker.mechanics, before, result, tasks);
  recordMechanismSettlement(tracker.mechanics, before, result, tasks, tracker.plannedOrigins);
  for (const [actorId, origin] of tracker.plannedOrigins) {
    recordReplacement(tracker.breakdown, tracker.stages, { actorId, turn: before.hourTick, day: before.day, ...origin });
  }
  for (const id of IDS) {
    if (!before.actors[id].crisis && after.actors[id].crisis) tracker.wishBreakdowns++;
  }
  tracker.diseaseCases += countNewDiseases(tracker.diseaseKeys, after.actors);
  if (!result.night) return;
  const day = result.night.day;
  tracker.completedDays++;
  recordFoodOutage(tracker.foodOutageDays, day, result.night.food);
  const kind = tracker.dayKinds.get(day) || { delivery: false, care: false };
  const bucket = kind.care ? 'care' : kind.delivery ? 'delivery' : 'ordinary';
  tracker.dayCash[bucket].push(result.night.end - result.night.start);
  if (day % 10 === 0) {
    const living = IDS.filter((id) => ['active', 'downed'].includes(after.actors[id].life)).map((id) => after.actors[id]);
    tracker.series.push({
      day,
      cash: after.cash,
      health: median(living.map((actor) => actor.health)),
      mind: median(living.map((actor) => actor.mind)),
      hygiene: median(living.map((actor) => actor.hygiene)),
    });
  }
}

export function applyCommand(state, command) {
  if (!command) return { state };
  if (command.kind === 'sellBottles') return sellBottles(state, command.actorId);
  if (command.kind === 'salvageDispose') return salvageDispose(state, command.uid, command.choice, command.opts);
  if (command.kind === 'acceptFavor') return acceptFavor(state, command.npcId, command.actorId);
  if (command.kind === 'transferItem') return transferItem(state, command.actorId, command.uid, command.to);
  if (command.kind === 'unpackParcel') return unpackParcel(state, command.actorId, command.parcelId);
  if (command.kind === 'placeFurniture') return placeFurniture(state, command.actorId, command.uid, command.slot, command.rotation);
  if (command.kind === 'assign') return assign(state, command.actorId, state.hour, command.actionId, command.opts || {});
  if (command.kind === 'buy') return buyNow(state, command.actorId, command.cart, command.destination);
  if (command.kind === 'use') return useItem(state, command.actorId, command.uid);
  if (command.kind === 'night') return setNightSpot(state, command.spot);
  if (command.kind === 'event') return eventChoice(state, command.uid, command.choiceId, command.actorId);
  if (command.kind === 'begStep') return begStep(state, command.sessionIndex, command.npcId, command.step, command.value);
  if (command.kind === 'binReveal') return binReveal(state, command.boardIndex, command.cellIndex);
  if (command.kind === 'binForfeit') return binForfeit(state, command.boardIndex);
  return { state, error: `未知策略命令 ${command.kind}` };
}

export function recoverPreflight(state, at) {
  const check = preflight(state);
  const actorId = at?.actorId || check.actorId || alive(state).find((id) => {
    const task = currentTask(state, id);
    if (!task) return true;
    if (state.phase === 'tail') return !['aid', 'rescue', 'wait', 'rest'].includes(task.id);
    return check.error?.includes('防雨等级上限') && ['roof', 'helper'].includes(task.id);
  });
  if (!actorId) return state;
  const actor = state.actors[actorId];
  const current = currentTask(state, actorId);
  const actionId = actor.life === 'downed'
    ? (current?.id !== 'aid' && (state.vouchers > 0 || state.cash >= 20) ? 'aid' : 'wait') : 'rest';
  if (current?.id === actionId) return state;
  const recovered = assign(state, actorId, state.hour, actionId);
  if (recovered.error) return state;
  let next = recovered.state;
  // 取消合作会清空同组格子，只补这组被解绑的参与者，保留其他合法排程。
  for (const id of current?.participants || []) {
    if (id === actorId || currentTask(next, id)) continue;
    const fallback = assign(next, id, next.hour, next.actors[id].life === 'downed' ? 'wait' : 'rest');
    if (!fallback.error) next = fallback.state;
  }
  return next;
}

function scratchAndClaimVisibleTickets(state) {
  const view = observeState(state);
  for (const item of view.items.filter((candidate) => candidate.ticket && !candidate.ticket.claimed)) {
    const owner = item.container;
    if (!IDS.includes(owner)) continue;
    if (!item.ticket.scratched) scratchTicket(state, item.uid);
    claimTicket(state, owner, item.uid);
  }
  return state;
}

function applyImmediateCommands(state, strategyId, tracker) {
  let next = state;
  for (let attempt = 0; attempt < 12; attempt++) {
    const command = chooseImmediateCommand(observeState(next), strategyId);
    if (!command) break;
    const result = applyCommand(next, command);
    if (result.error) break;
    recordImmediateMetrics(tracker.breakdown, tracker.stages, next, result.state, command);
    recordMechanismCommand(tracker.mechanics, next, result, command);
    next = result.state;
  }
  return next;
}

function applyMechanicCommands(state, strategyId, tracker) {
  let next = state;
  for (let attempt = 0; attempt < 100; attempt++) {
    const command = chooseImmediateMechanicCommand(observeState(next), strategyId);
    if (!command) return next;
    const result = applyCommand(next, command);
    recordMechanismCommand(tracker.mechanics, next, result, command);
    if (result.error) throw new Error(`机制命令失败：${result.error}`);
    recordImmediateMetrics(tracker.breakdown, tracker.stages, next, result.state, command);
    next = result.state;
  }
  throw new Error('机制即时命令超过安全上限');
}

function handlePlanning(state, strategyId, tracker) {
  tracker.plannedOrigins.clear();
  const beforeCash = state.cash;
  let next = applyImmediateCommands(state, strategyId, tracker);
  for (let attempt = 0; attempt < 2; attempt++) {
    const command = chooseFurnitureSetup(observeState(next));
    if (!command) break;
    const result = applyCommand(next, command);
    if (result.error) throw new Error(`家具整理失败：${result.error}`);
    next = result.state;
  }
  let view = observeState(next);
  for (const choose of [chooseFoodPurchase, chooseCarePurchase, choosePreparednessPurchase, chooseCigarettePurchase, chooseFurniturePurchase]) {
    const command = choose(view, strategyId);
    if (!command) continue;
    const result = applyCommand(next, command);
    if (result.error && command.cart?.some(line => line.shopId === 'furniture_store')) throw new Error(`家具购买失败：${result.error}`);
    if (!result.error) {
      next = result.state;
      if (command.cart?.some((line) => line.itemId === 'cigarette')) tracker.cigarettePurchases++;
    }
    view = observeState(next);
  }
  next = applyImmediateCommands(next, strategyId, tracker);
  next = applyMechanicCommands(next, strategyId, tracker);
  next = scratchAndClaimVisibleTickets(next);
  view = observeState(next);
  if (strategyId === 'gambler' || strategyId === 'gambler_control') {
    const cards = strategyId === 'gambler' ? chooseCardEvent(view) : chooseControlCardEvent(view, tracker.strategyMemory);
    if (cards) {
      const result = applyCommand(next, cards);
      if (!result.error) next = result.state;
    }
  }
  view = observeState(next);
  const night = applyCommand(next, chooseNightSpot(view));
  if (!night.error) next = night.state;
  tracker.strategyMemory = updateStrategyMemory(view, strategyId, tracker.strategyMemory);
  const planned = planActions(view, strategyId, tracker.strategyMemory);
  if (view.hour === 10 && view.actors.ma.life === 'active') {
    const living = alive(next).length;
    tracker.cashAtSlot1.push({
      day: view.day, beforeCash, cash: view.cash, living, reserve: living * 16,
      ledgerStart: next.ledger.start, ledgerIncome: next.ledger.income, ledgerExpense: next.ledger.expense,
    });
    tracker.mechanics.beg.minSlot1Cash = Math.min(tracker.mechanics.beg.minSlot1Cash, view.cash);
    if (view.cash < alive(next).length * 16) {
      tracker.mechanics.beg.lowCashSlots++;
      if (!planned.some((command) => command.actorId === 'ma' && command.actionId === 'beg')) tracker.mechanics.beg.blockedLowCashSlots++;
    }
  }
  for (const command of planned) {
    if (command.stoppageReason) tracker.stoppageReasons[command.stoppageReason]++;
    if (currentTask(next, command.actorId)?.eventUid) continue;
    const result = applyCommand(next, command);
    for (const actorId of command.opts?.participants || [command.actorId]) {
      tracker.plannedOrigins.set(actorId, {
        plannedActionId: command.plannedActionIds?.[actorId] || command.plannedActionId || command.actionId,
        replacementReason: result.error ? 'preflight' : command.replacementReason,
      });
    }
    if (result.error) {
      const fallback = assign(next, command.actorId, next.hour, next.actors[command.actorId].life === 'downed' ? 'aid' : 'sleep');
      if (!fallback.error) next = fallback.state;
    } else {
      next = result.state;
      if (command.care) {
        const cared = setCare(next, command.actorId, next.hour, command.care);
        if (!cared.error) next = cared.state;
      }
    }
  }
  return next;
}

export async function runGame({ seed, strategyId, maxDays = 100, initialState = null }) {
  if (!STRATEGY_IDS.includes(strategyId)) throw new Error(`未知策略 ${strategyId}`);
  let state = initialState ? structuredClone(initialState) : fresh(seed);
  if (state.seed !== seed) throw new Error('初始状态与指定种子不一致');
  const tracker = makeTracker(state);
  let guard = 0;
  let stopReason = null;
  let retryCurrentSlot = false;
  // 每日16小时，加上即时机制、晨间节点和预检恢复。
  while (guard++ < 12000) {
    if (state.pending && (state.pending.beg.length || state.pending.bins.length)) {
      const command = choosePendingCommand(observeState(state), strategyId);
      if (!command) {
        const result = autoResolvePending(state);
        if (result.error) throw new Error(result.error);
        recordPendingFallback(tracker.mechanics);
        recordImmediateMetrics(tracker.breakdown, tracker.stages, state, result.state, { kind: 'pendingFallback' });
        state = result.state;
        continue;
      }
      const result = applyCommand(state, command);
      if (result.error) throw new Error(result.error);
      recordInteractionMetrics(tracker.mechanics, state, result, command);
      recordMechanismCommand(tracker.mechanics, state, result, command);
      recordImmediateMetrics(tracker.breakdown, tracker.stages, state, result.state, command);
      state = result.state;
      continue;
    }
    if (['ending', 'gameover'].includes(state.phase)) {
      stopReason = state.phase;
      break;
    }
    if (state.day > maxDays) {
      stopReason = 'day-limit';
      break;
    }
    if (state.phase === 'meeting') {
      const result = meet(state, 0);
      if (result.error) throw new Error(result.error);
      state = result.state;
      continue;
    }
    if (state.pendingMorning) {
      // 首选项可能要现金（占地费、修相机等），付不起就按顺序换下一个能选的。
      const preferred = chooseMorning(observeState(state));
      const ids = [preferred, ...state.pendingMorning.choices.map((choice) => choice.id).filter((id) => id !== preferred)];
      let result = null;
      for (const id of ids) { result = morningChoice(state, id); if (!result.error) break; }
      if (result.error) throw new Error(result.error);
      state = result.state;
      continue;
    }
    if (state.phase === 'planning' && !retryCurrentSlot) state = handlePlanning(state, strategyId, tracker);
    const tasks = plannedTasks(state);
    const before = state;
    const result = settle(state);
    if (process.env.SIM_DEBUG && guard > 11960) console.log('[sim]', guard, 'D' + state.day, 'hour', state.hour, 'turn', state.turn, state.phase, result.error || 'ok', JSON.stringify(result.at || null), tasks.map((t) => t.participants[0] + ':' + t.id).join(','));
    if (result.error) {
      tracker.preflightFailures++;
      const [reason, stoppage] = preflightReason(result.error);
      addCount(tracker.preflightReasons, reason);
      if (stoppage) tracker.stoppageReasons[stoppage]++;
      const recovered = recoverPreflight(state, result.at);
      if (recovered === state) throw new Error(`预检无法恢复：${result.error}`);
      for (const actorId of alive(state)) {
        const current = currentTask(state, actorId);
        if (current?.id === currentTask(recovered, actorId)?.id) continue;
        const origin = tracker.plannedOrigins.get(actorId);
        tracker.plannedOrigins.set(actorId, { plannedActionId: origin?.plannedActionId || current?.id, replacementReason: 'preflight' });
      }
      state = recovered;
      retryCurrentSlot = true;
      continue;
    }
    retryCurrentSlot = false;
    if (process.env.SIM_TRACE && result.night) { const n = result.state; console.log('[day]', n.day - 1, 'cash', n.cash, 'food', n.effectiveFood, IDS.map((id) => { const p = n.actors[id]; return `${id}:${p.life[0]} H${p.health} F${p.food} E${p.energy} M${p.mind} W${p.warmth} C${p.hygiene}${p.diseases.length ? ' 病' + p.diseases.map((d) => d.kind + d.severity + (d.plan ? 'p' : '')).join('/') : ''}`; }).join(' | '), 'tasks', tasks.map((t) => t.participants[0][0] + ':' + t.id).join(',')); }
    trackPlannedDay(tracker, state, tasks);
    trackTransition(tracker, before, result);
    state = result.state;
  }
  if (!stopReason) throw new Error(`自动对局超过安全回合上限：${strategyId} seed=${seed}`);
  const joined = IDS.filter((id) => state.actors[id].joinedTurn !== null);
  return {
    seed,
    strategyId,
    stopReason,
    turns: state.turn,
    hourTick: state.hourTick,
    actionCount: state.actionCount,
    completedDay100: tracker.completedDays >= 100,
    survivors: joined.filter((id) => state.actors[id].life === 'active').length,
    cash: state.cash,
    deaths: state.deaths.map((death) => ({ ...death })),
    firstDeathDay: state.deaths.length ? Math.min(...state.deaths.map((death) => death.day)) : null,
    preflightFailures: tracker.preflightFailures,
    preflightReasons: tracker.preflightReasons,
    stoppageReasons: tracker.stoppageReasons,
    foodOutageDays: tracker.foodOutageDays.size,
    wishBreakdowns: tracker.wishBreakdowns,
    diseaseCases: tracker.diseaseCases,
    lotteryBuyDays: tracker.lotteryBuyDays.size,
    cardGameDays: tracker.cardGameDays.size,
    cigarettePurchases: tracker.cigarettePurchases,
    dayCash: tracker.dayCash,
    cashAtSlot1: tracker.cashAtSlot1,
    series: tracker.series,
    completedDays: tracker.completedDays,
    mechanics: finalizeMechanismMetrics(tracker.mechanics, state),
    ...finalizeBreakdown(tracker.breakdown, tracker.stages),
  };
}

export async function runStrategy(strategyId, seeds, maxDays = 100) {
  const runs = [];
  for (const seed of seeds) runs.push(await runGame({ seed, strategyId, maxDays }));
  return { id: strategyId, label: STRATEGIES[strategyId].label, runs };
}
