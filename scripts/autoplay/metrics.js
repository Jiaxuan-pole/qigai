import { ACTIONS } from '../../public/game/actions.js';
import { NAMES } from '../../public/game/engine.js';
import { FOOD_VALUE } from '../../public/game/items.js';
import { clamp } from '../../public/game/rules.js';
import { weatherOf } from '../../public/game/story.js';
import { sleepSurfaceFor } from '../../public/game/furniture.js';

const IDS = ['xuan', 'fan', 'ma'];
const STAGE_LABELS = ['D1-20', 'D21-40', 'D41-60', 'D61-80', 'D81-100'];
const HOBBIES = new Set(['interview', 'talk', 'joke', 'sketch', 'freecards', 'graffiti', 'social', 'tavern']);
const REPLACEMENTS = ['hobby', 'care', 'shopping', 'warmth', 'preflight', 'mechanics'];

const account = () => ({ positive: 0, negative: 0, net: 0 });

const emptyMetrics = () => ({
  work: { actorSlots: 0, cash: 0, mealGrants: 0 },
  replacements: Object.fromEntries(REPLACEMENTS.map((reason) => [reason, 0])),
  meals: { consumed: 0, extraMeals: 0, immediate: 0, night: 0 },
  mind: {
    inferred: true,
    work: account(), wish: account(), body: account(), hobby: account(), night: account(), other: account(),
    observedDelta: 0,
  },
  mindBand40To70: { actorTurns: 0, totalActorTurns: 0, percentage: null },
});

export function createBreakdown() {
  return {
    breakdown: { ...emptyMetrics(), _replacementKeys: new Set() },
    stages: Object.fromEntries(STAGE_LABELS.map((label) => [label, emptyMetrics()])),
  };
}

const stageFor = (day) => STAGE_LABELS[Math.max(0, Math.min(4, Math.floor((day - 1) / 20)))];

function targets(metrics, stages, day) {
  return [metrics, stages[stageFor(day)]];
}

function addMind(target, category, delta) {
  const entry = target.mind[category];
  if (delta >= 0) entry.positive += delta;
  else entry.negative += delta;
  entry.net += delta;
}

function taskMind(task) {
  const action = ACTIONS[task.id];
  if (!action?.mind) return null;
  if (action.work) return ['work', action.mind];
  if (HOBBIES.has(task.id)) return ['hobby', action.mind];
  return null;
}

function inferredWishLoss(result, actorId) {
  const prefix = `${NAMES[actorId]}愿望压力：`;
  const event = result.events.find((line) => line.startsWith(prefix));
  const match = event?.match(/本格合计-(\d+)/);
  return match ? -Number(match[1]) : 0;
}

function virtualFood(before, tasks) {
  const foods = before.items.filter((item) => FOOD_VALUE[item.itemId] && (item.expiresDay === null || item.expiresDay >= before.day)).map((item) => ({ ...item }));
  let sequence = 0;
  const add = (itemId, container) => foods.push({ uid: `metric:${sequence++}`, itemId, container, expiresDay: null });
  for (const task of tasks) {
    const action = ACTIONS[task.id];
    const bonusMeal = task.id === 'kitchen' && before.flags.liuBonusMeal ? 1 : 0;
    for (let index = 0; index < (action?.foodGain || 0) + bonusMeal; index++) add('meal', 'camp');
    if (action?.freeMeal) add('meal', task.participants[0]);
    for (const line of task.cart || []) {
      if (!FOOD_VALUE[line.itemId]) continue;
      const container = task.destination === 'self' ? task.participants[0] : (task.destination || 'camp');
      for (let index = 0; index < line.qty; index++) add(line.itemId, container);
    }
  }
  return foods;
}

function foodAtMentalTick(before, tasks) {
  const boundary = (before.hour - 5) % 4 === 0;
  const values = Object.fromEntries(IDS.map((id) => [id, clamp(before.actors[id].food - (boundary ? 10 : 0))]));
  if (before.hour !== 9 && before.hour !== 17) return values;
  const foods = virtualFood(before, tasks);
  const startAlive = IDS.filter((id) => ['active', 'downed'].includes(before.actors[id].life));
  for (const actorId of [...startAlive].sort((left, right) => values[left] - values[right])) {
    const candidates = foods.filter((item) => item.container === actorId || item.container === 'camp')
      .sort((a, b) => (a.expiresDay ?? 999) - (b.expiresDay ?? 999) || (a.container === actorId ? -1 : 1));
    const eaten = candidates[0];
    if (!eaten) continue;
    foods.splice(foods.indexOf(eaten), 1);
    values[actorId] = clamp(values[actorId] + FOOD_VALUE[eaten.itemId]);
  }
  return values;
}

function inferredBodyLoss(before, tasks, actorId, foodAtTick) {
  if ((before.hour - 5) % 4 !== 0) return 0;
  const actor = before.actors[actorId];
  const task = tasks.find((candidate) => candidate.participants?.includes(actorId));
  const action = task ? ACTIONS[task.id] : null;
  const zone = task?.zone;
  const sheltered = action?.indoor || (zone === 'camp' && before.camp.rain >= 2);
  const warmth = sheltered ? clamp(actor.warmth + (action?.warm || 0))
    : clamp(actor.warmth + (action?.warm || 0) - weatherOf(before.seed, before.day).out - (actor.clothes.wet ? 6 : 0));
  const wet = action?.laundry ? true : actor.clothes.wet;
  return foodAtTick[actorId] <= 20 || warmth <= 20 || wet || actor.diseases.some((disease) => disease.severity >= 30) ? -1 : 0;
}

function inferredNightMind(before, result, actorId) {
  if (!result.night || result.state.actors[actorId].life !== 'active') return 0;
  const spot = result.night.spot;
  const dryBed = (result.night.sleepSurfaces?.[actorId]?.kind || sleepSurfaceFor(before, actorId, spot, {
    sleepingIds: IDS.filter(id => ['active', 'downed'].includes(before.actors[id].life)),
  })?.kind) === 'bed' || spot === 'shelter';
  let delta = (dryBed ? 3 : 1) - (spot === 'shelter' ? 1 : 0) - (spot === 'station' ? 2 : 0);
  if (spot === 'station' && result.events.some((event) => event.includes('半夜被保安赶出候车室') && event.startsWith(NAMES[actorId]))) delta -= 3;
  return delta;
}

function mealCounts(before, result) {
  const startAlive = IDS.filter((id) => ['active', 'downed'].includes(before.actors[id].life));
  let regular = 0;
  if (before.hour === 9 || before.hour === 17) {
    const missed = result.events.filter((event) => event.endsWith('缺一份饭。')).length;
    regular = Math.max(0, startAlive.length - missed);
  }
  const night = result.night ? result.events.filter((event) => event.endsWith('睡前又吃了一份。')).length : 0;
  return { regular, night };
}

export function recordSettledMetrics(metrics, stages, before, result, tasks) {
  if (result.error) return;
  const dayTargets = targets(metrics, stages, before.day);
  const participants = new Set(tasks.flatMap((task) => task.participants || []).filter((id) => ['active', 'downed'].includes(before.actors[id]?.life)));
  const { regular, night } = mealCounts(before, result);
  const foodAtTick = foodAtMentalTick(before, tasks);

  for (const target of dayTargets) {
    target.meals.consumed += regular + night;
    target.meals.extraMeals += night;
    target.meals.night += night;
  }

  for (const task of tasks) {
    const action = ACTIONS[task.id];
    if (!action) continue;
    const activeParticipants = (task.participants || []).filter((id) => before.actors[id]?.life === 'active');
    if (action.work) {
      const cash = task.pay ?? action.cash ?? 0;
      const repairBonus = task.id === 'repair' && before.flags.trialPassed ? 4 : 0;
      for (const target of dayTargets) {
        target.work.actorSlots += activeParticipants.length;
        target.work.cash += cash + repairBonus;
        target.work.mealGrants += (action.foodGain || 0) + (task.id === 'kitchen' && before.flags.liuBonusMeal ? 1 : 0);
      }
    }
  }

  for (const actorId of participants) {
    const actual = result.state.actors[actorId].mind - before.actors[actorId].mind;
    const task = tasks.find((candidate) => candidate.participants?.includes(actorId));
    const actionMind = task ? taskMind(task) : null;
    const inferred = {
      work: actionMind?.[0] === 'work' ? actionMind[1] : 0,
      wish: before.actors[actorId].life === 'active' ? inferredWishLoss(result, actorId) : 0,
      body: before.actors[actorId].life === 'active' ? inferredBodyLoss(before, tasks, actorId, foodAtTick) : 0,
      hobby: actionMind?.[0] === 'hobby' ? actionMind[1] : 0,
      night: inferredNightMind(before, result, actorId),
    };
    const subtotal = Object.values(inferred).reduce((sum, value) => sum + value, 0);
    for (const target of dayTargets) {
      for (const [category, delta] of Object.entries(inferred)) addMind(target, category, delta);
      addMind(target, 'other', actual - subtotal);
      target.mind.observedDelta += actual;
      target.mindBand40To70.totalActorTurns++;
      if (result.state.actors[actorId].mind >= 40 && result.state.actors[actorId].mind <= 70) target.mindBand40To70.actorTurns++;
    }
  }
}

export function recordImmediateMetrics(metrics, stages, before, after, meta = {}) {
  const item = meta.item || (meta.uid ? before.items.find((candidate) => candidate.uid === meta.uid) : null);
  const dayTargets = targets(metrics, stages, before.day);
  if (item && ['meal', 'bread', 'hot_soup'].includes(item.itemId) && !after.items.some((candidate) => candidate.uid === item.uid)) {
    for (const target of dayTargets) {
      target.meals.consumed++;
      target.meals.extraMeals++;
      target.meals.immediate++;
    }
  }
  for (const actorId of IDS) {
    const delta = after.actors[actorId].mind - before.actors[actorId].mind;
    if (!delta) continue;
    for (const target of dayTargets) {
      addMind(target, 'other', delta);
      target.mind.observedDelta += delta;
    }
  }
}

export function recordReplacement(metrics, stages, { actorId, turn, day, plannedActionId, replacementReason }) {
  if (!ACTIONS[plannedActionId]?.work || !REPLACEMENTS.includes(replacementReason)) return;
  const key = `${actorId}:${turn}`;
  if (metrics._replacementKeys.has(key)) return;
  metrics._replacementKeys.add(key);
  for (const target of targets(metrics, stages, day)) target.replacements[replacementReason]++;
}

function finalizeMetrics(metrics) {
  for (const entry of Object.values(metrics.mind)) {
    if (entry && typeof entry === 'object' && 'positive' in entry) entry.net = entry.positive + entry.negative;
  }
  metrics.mindBand40To70.percentage = metrics.mindBand40To70.totalActorTurns
    ? metrics.mindBand40To70.actorTurns * 100 / metrics.mindBand40To70.totalActorTurns : null;
  return metrics;
}

export function finalizeBreakdown(metrics, stages) {
  delete metrics._replacementKeys;
  finalizeMetrics(metrics);
  for (const stage of Object.values(stages)) finalizeMetrics(stage);
  return { breakdown: metrics, stages };
}

export { STAGE_LABELS };
export { createMechanismMetrics, recordMechanismSettlement, recordMechanismCommand, finalizeMechanismMetrics } from './mechanism-metrics.js';
