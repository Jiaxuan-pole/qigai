import { ACTIONS, BEG_ZONES, BINS_ZONES, OUT_ZONES, REPAIR_ZONES } from '../game/actions.js';
import { active, assign, available, copy, NAMES, planIndex } from '../game/engine.js';
import { nextPlan, preflight } from '../game/settle.js';

const BLOCKED = new Set(['shop', 'beg', 'bins', 'repair_item', 'facility', 'danger', 'cards', 'casino', 'shellgame', 'clinic', 'tavern']);
const keys = (x, names) => x && typeof x === 'object' && !Array.isArray(x) && Object.keys(x).sort().join('|') === names.slice().sort().join('|');

function optionsFor(action) {
  if (action.zone !== 'pick') return [{ zone: action.zone }];
  const zones = action.begging ? BEG_ZONES : action.bins ? BINS_ZONES : action.repairing ? REPAIR_ZONES : OUT_ZONES;
  return zones.map((zone) => ({ zone }));
}

function candidateActions(s, id, selectedActorId) {
  const options = [];
  const index = planIndex(s.hour);
  for (const actionId of available(s, id)) {
    const a = ACTIONS[actionId];
    if (BLOCKED.has(actionId) || a.eventOnly || a.risky || a.fixed || a.min || a.rescue || a.downedOnly || a.gamble || a.shopping || a.building || a.repairing || a.intox) continue;
    if (a.allowed && !a.allowed.includes(s.slot)) continue;
    for (const { zone } of optionsFor(a)) {
      const assigned = assign(s, id, s.hour, actionId, { zone });
      if (assigned.error || JSON.stringify(assigned.state.plan[selectedActorId][index]) !== JSON.stringify(s.plan[selectedActorId][index]) || preflight(assigned.state).error) continue;
      options.push({ actionId, zone, name: a.name });
    }
  }
  return options;
}

export function makeAutoPlanContext(s, selectedActorId, requestId) {
  if (s.phase !== 'planning' || !active(s).includes(selectedActorId)) return { error: '当前不能安排队友。' };
  const actorIds = active(s).filter((id) => id !== selectedActorId && !s.busy?.[id]);
  if (!actorIds.length) return { error: '当前没有可安排的空闲队友。' };
  const allowedActions = Object.fromEntries(actorIds.map((id) => [id, candidateActions(s, id, selectedActorId)]));
  if (actorIds.some((id) => !allowedActions[id].length)) return { error: '有队友当前小时没有可行的单人行动，请先检查排程。' };
  const actors = Object.fromEntries(actorIds.map((id) => {
    const p = s.actors[id];
    return [id, { name: NAMES[id], health: p.health, food: p.food, energy: p.energy, coffeeCredit: p.coffeeCredit || 0, usableEnergy: p.energy + (p.coffeeCredit || 0), warmth: p.warmth, mind: p.mind, hygiene: p.hygiene, fishingSkill: Number.isFinite(p.fishingSkill) ? p.fishingSkill : 0, location: p.location,
      items: s.items.filter((x) => x.container === id).map((x) => x.itemId).slice(0, 20) }];
  }));
  return { requestId, day: s.day, hour: s.hour, hourTick: s.hourTick, slot: s.slot, stateRevision: s.stateRevision, weather: s.weatherKind, selectedActorId, actorIds, actors, cash: s.cash, food: s.effectiveFood, allowedActions };
}

export function validatePlans(payload, context) {
  if (!keys(payload, ['requestId', 'plans']) || payload.requestId !== context.requestId || !Array.isArray(payload.plans) || payload.plans.length !== context.actorIds.length) return { ok: false, reason: 'AI 返回的排程人数或请求标识无效。' };
  const seen = new Set();
  for (const plan of payload.plans) {
    if (!keys(plan, ['actorId', 'actionId', 'zone']) || !context.actorIds.includes(plan.actorId) || seen.has(plan.actorId)) return { ok: false, reason: 'AI 返回了重复或越权的队友。' };
    const options = context.allowedActions[plan.actorId];
    if (!options?.some((a) => a.actionId === plan.actionId && a.zone === plan.zone)) return { ok: false, reason: 'AI 返回了当前不可用的行动。' };
    seen.add(plan.actorId);
  }
  return { ok: true };
}

function applyPlans(s, selectedActorId, plans) {
  let draft = copy(s);
  const index = planIndex(s.hour);
  const selectedBefore = JSON.stringify(s.plan[selectedActorId][index]);
  for (const p of plans) {
    const r = assign(draft, p.actorId, s.hour, p.actionId, { zone: p.zone });
    if (r.error) return { error: r.error };
    draft = r.state;
  }
  if (JSON.stringify(draft.plan[selectedActorId][index]) !== selectedBefore) return { error: 'AI 不能改动当前操控人物的计划。' };
  const check = preflight(draft);
  if (check.error) return { error: check.error };
  draft.stateRevision += 1;
  return { state: draft, summary: plans.map((p) => `${NAMES[p.actorId]}：${ACTIONS[p.actionId].name}`).join('；') };
}

function localPlans(s, context) {
  const defaults = nextPlan(s);
  let draft = copy(s);
  const plans = [];
  for (const id of context.actorIds) {
    const preferred = defaults[id][planIndex(s.hour)]?.id;
    const options = [...context.allowedActions[id]].sort((a, b) => Number(b.actionId === preferred) - Number(a.actionId === preferred));
    let found = null;
    for (const option of options) {
      const trial = applyPlans(draft, context.selectedActorId, [{ actorId: id, actionId: option.actionId, zone: option.zone }]);
      if (trial.state) { found = option; draft = trial.state; break; }
    }
    if (!found) return { error: `本地建议无法为${NAMES[id]}找到可行行动，请手动安排。` };
    plans.push({ actorId: id, actionId: found.actionId, zone: found.zone });
  }
  return applyPlans(s, context.selectedActorId, plans);
}

export async function autoArrangeTeammates(s, selectedActorId, { fetchImpl = fetch, signal, stillCurrent = () => true } = {}) {
  const requestId = `plan_${s.seed}_${s.day}_${s.hour}_${s.hourTick}_${s.stateRevision}_${selectedActorId}`;
  const context = makeAutoPlanContext(s, selectedActorId, requestId);
  if (context.error) return context;
  const snapshot = JSON.stringify(s);
  if (!stillCurrent() || signal?.aborted || JSON.stringify(s) !== snapshot) return { error: '排程已变化，请重试。' };
  let payload = null;
  let unavailable = false;
  const ctrl = new AbortController();
  const abort = () => ctrl.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 25000);
  try {
    const response = await fetchImpl('/api/autoplan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(context), signal: ctrl.signal });
    if (response.status === 503) unavailable = true;
    else if (!response.ok) return { error: 'AI 排程请求失败，请重试。' };
    else {
      const result = await response.json();
      if (!result.ok) return { error: result.reason || 'AI 排程无效，请重试。' };
      payload = result.payload;
    }
  } catch (e) {
    if (signal?.aborted) return { error: '排程已变化，请重试。' };
    unavailable = true;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
  if (!stillCurrent() || signal?.aborted || JSON.stringify(s) !== snapshot) return { error: '排程已变化，请重试。' };
  if (unavailable) {
    const local = localPlans(s, context);
    return local.error ? local : { ...local, source: 'local' };
  }
  const valid = validatePlans(payload, context);
  if (!valid.ok) return { error: valid.reason };
  const result = applyPlans(s, selectedActorId, payload.plans);
  return result.error ? result : { ...result, source: 'ai' };
}
