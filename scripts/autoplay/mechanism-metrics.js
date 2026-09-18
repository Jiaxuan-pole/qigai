import { ACTIONS } from '../../public/game/actions.js';
import { SALVAGE } from '../../public/game/salvage.js';
import { FACILITIES } from '../../public/game/camp.js';
import { createInteractionMetrics, finalizeInteractionMetrics } from './interaction-metrics.js';

const costs = () => ({ replacedWork: 0, lostWorkCash: 0, savedWorkParts: 0, additionalWashes: 0, partsConsumed: 0, woodConsumed: 0, clothConsumed: 0 });
const bucketFor = { bins: 'bins', beg: 'beg', phonestall: 'phonestall', shellgame: 'shellgame', repair_item: 'salvage', facility: 'facility' };

export function createMechanismMetrics(state = { actors: {} }) {
  const interaction = createInteractionMetrics();
  return {
    ...interaction,
    bins: { ...interaction.bins, ...costs(), bottleSales: 0, glovesBought: 0, gloveExpense: 0, dirtyBreadImmediate: 0, soapUsed: 0, netCash: 0, broken_phone: 0, broken_radio: 0, broken_headphones: 0 },
    beg: { ...interaction.beg, ...costs(), netCash: 0, lowCashSlots: 0, blockedLowCashSlots: 0, minSlot1Cash: Infinity },
    phonestall: { actions: 0, cash: 0, netCash: 0, ...costs() },
    shellgame: { actions: 0, cash: 0, expelled: 0, netCash: 0, ...costs() },
    salvage: { repairs: 0, sold: 0, kept: 0, gifted: 0, cash: 0, netCash: 0, radiosKept: 0, unsold: 0, ...costs() },
    favors: { accepted: 0, completed: 0, expired: 0, bonusMeals: 0, cash: 0, netCash: 0, ...costs() },
    facility: { built: 0, ...costs(), netCash: 0 },
    diseases: { gut: 0, skin: 0, wound: 0, chill: 0 },
    upkeep: { washes: 0, radioNights: 0 },
    commands: { failures: 0 },
    _diseaseKeys: new Set(Object.entries(state.actors).flatMap(([id, actor]) => actor.diseases.map((disease) => `${id}:${disease.uid}`))),
    _binHygieneDebt: {},
    _binItemUids: new Set(),
    _repairedUids: new Set(),
  };
}

function recordDiseases(metrics, state) {
  for (const [actorId, actor] of Object.entries(state.actors)) {
    for (const disease of actor.diseases) {
      const key = `${actorId}:${disease.uid}`;
      if (metrics._diseaseKeys.has(key)) continue;
      metrics._diseaseKeys.add(key);
      if (Object.hasOwn(metrics.diseases, disease.kind)) metrics.diseases[disease.kind]++;
    }
  }
}

function displacedPay(state, id, actorId) {
  return (ACTIONS[id]?.cash || 0) + (id === 'repair' && state.flags.trialPassed ? 4 : 0)
    + (id === 'run' && state.flags.chenFixedRun ? 3 : 0)
    + (id === 'carry' && state.items.some((item) => item.itemId === 'cart' && item.container === actorId) ? 6 : 0);
}

function recordCosts(metrics, before, tasks, origins) {
  for (const task of tasks) {
    const bucket = bucketFor[task.id];
    if (!bucket) continue;
    for (const actorId of task.participants) {
      const origin = origins.get(actorId);
      if (!origin || origin.plannedActionId === task.id || !ACTIONS[origin.plannedActionId]?.work) continue;
      metrics[bucket].replacedWork++;
      metrics[bucket].lostWorkCash += displacedPay(before, origin.plannedActionId, actorId);
      metrics[bucket].savedWorkParts += ACTIONS[origin.plannedActionId]?.cost?.parts || 0;
    }
  }
}

function recordFavors(metrics, before, after, tasks) {
  for (const [npcId, current] of Object.entries(after.favors || {})) {
    const previous = before.favors?.[npcId];
    const completed = current.done.length - (previous?.done.length || 0);
    metrics.favors.completed += completed;
    if (previous?.active && !current.active && completed === 0 && current.cooldownUntil > (previous.cooldownUntil || 0)) metrics.favors.expired++;
  }
  if (before.flags.liuBonusMeal) metrics.favors.bonusMeals += tasks.filter((task) => task.id === 'kitchen').length;
  if (before.flags.chenFixedRun) metrics.favors.cash += tasks.filter((task) => task.id === 'run').length * 3;
}

function recordSalvage(metrics, before, after) {
  for (const item of before.items) {
    const definition = SALVAGE[item.itemId];
    if (!definition || after.items.find((candidate) => candidate.uid === item.uid)?.itemId !== definition.repaired) continue;
    metrics.salvage.repairs++;
    metrics.salvage.partsConsumed += definition.parts;
    metrics._repairedUids.add(item.uid);
  }
  for (const kind of after.camp.facilities || []) {
    if (!kind || before.camp.facilities?.includes(kind)) continue;
    metrics.facility.built++;
    const cost = FACILITIES[kind].cost;
    metrics.facility.partsConsumed += cost.parts || 0;
    metrics.facility.woodConsumed += cost.wood || 0;
    metrics.facility.clothConsumed += cost.cloth || 0;
  }
}

export function recordMechanismSettlement(metrics, before, result, tasks, origins = new Map()) {
  if (result.error) return;
  const after = result.state;
  recordDiseases(metrics, after);
  recordCosts(metrics, before, tasks, origins);
  recordFavors(metrics, before, after, tasks);
  recordSalvage(metrics, before, after);
  for (const task of tasks) {
    if (task.id === 'phonestall' || task.id === 'shellgame') metrics[task.id].actions++;
    for (const actorId of task.participants) {
      if (task.id === 'bins') metrics._binHygieneDebt[actorId] = (metrics._binHygieneDebt[actorId] || 0) + 10;
      if (task.id !== 'wash') continue;
      metrics.upkeep.washes++;
      const debt = metrics._binHygieneDebt[actorId] || 0;
      // 这是翻桶之后、固定洗漱以外的维护次数，不冒充独立反事实实验。
      if (debt > 0 && origins.get(actorId)?.replacementReason === 'care') metrics.bins.additionalWashes++;
      metrics._binHygieneDebt[actorId] = Math.max(0, debt - Math.max(0, after.actors[actorId].hygiene - before.actors[actorId].hygiene));
      for (const item of before.items.filter((item) => item.container === actorId && item.itemId === 'soap' && metrics._binItemUids.has(item.uid))) {
        metrics.bins.soapUsed += Math.max(0, item.uses - (after.items.find((candidate) => candidate.uid === item.uid)?.uses || 0));
      }
    }
  }
  for (const event of result.events) {
    const phone = event.match(/修手机小摊.*收入(\d+)/);
    const shell = event.match(/猜球小摊收了(\d+)/);
    if (phone) metrics.phonestall.cash += Number(phone[1]);
    if (shell) metrics.shellgame.cash += Number(shell[1]);
    if (event.includes('杯子刚摆好就被城管赶了')) metrics.shellgame.expelled++;
  }
  if (result.night && after.items.some((item) => item.itemId === 'radio' && (item.container === 'camp' || after.actors[item.container]))) metrics.upkeep.radioNights++;
}

export function recordMechanismCommand(metrics, before, result, command) {
  if (result.error) { metrics.commands.failures++; return; }
  const after = result.state;
  if (command.kind === 'binReveal') {
    if (result.result?.cell.kind === 'dirt') {
      const actorId = before.pending.bins[command.boardIndex].actorId;
      metrics._binHygieneDebt[actorId] = (metrics._binHygieneDebt[actorId] || 0) + 6;
    }
    const previousUids = new Set(before.items.map((item) => item.uid));
    for (const item of after.items) if (!previousUids.has(item.uid)) metrics._binItemUids.add(item.uid);
  }
  if (command.kind === 'sellBottles') metrics.bins.bottleSales += after.cash - before.cash;
  if (command.kind === 'acceptFavor' && !before.favors?.[command.npcId]?.active && after.favors?.[command.npcId]?.active) metrics.favors.accepted++;
  if (command.kind === 'salvageDispose') {
    const key = { keep: 'kept', sell: 'sold', gift: 'gifted' }[command.choice];
    if (key) metrics.salvage[key]++;
    metrics.salvage.cash += after.cash - before.cash;
    if (command.choice === 'keep' && before.items.find((item) => item.uid === command.uid)?.itemId === 'radio') metrics.salvage.radiosKept++;
  }
  if (command.kind === 'buy') {
    const quantity = command.cart.filter((line) => line.itemId === 'gloves').reduce((sum, line) => sum + line.qty, 0);
    metrics.bins.glovesBought += quantity;
    if (quantity) metrics.bins.gloveExpense += before.cash - after.cash;
  }
  if (command.kind === 'use') {
    const item = before.items.find((candidate) => candidate.uid === command.uid);
    if (item?.itemId === 'bread' && item.dirty && metrics._binItemUids.has(item.uid)) metrics.bins.dirtyBreadImmediate++;
  }
}

export function finalizeMechanismMetrics(metrics, state) {
  if (!Number.isFinite(metrics.beg.minSlot1Cash)) metrics.beg.minSlot1Cash = 0;
  metrics.bins.netCash = metrics.bins.cash + metrics.bins.bottles - metrics.bins.gloveExpense;
  for (const key of ['beg', 'phonestall', 'shellgame', 'salvage', 'favors']) metrics[key].netCash = metrics[key].cash;
  metrics.salvage.unsold = state.items.filter((item) => metrics._repairedUids.has(item.uid) && !item.kept).length;
  for (const key of ['_diseaseKeys', '_binHygieneDebt', '_binItemUids', '_repairedUids']) delete metrics[key];
  return finalizeInteractionMetrics(metrics, state);
}
