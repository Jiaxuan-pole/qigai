import { ACTIONS, BEG_ZONES, BINS_ZONES, OUT_ZONES, REPAIR_ZONES } from '../game/actions.js';
import { active, assign, available, cancelAt, copy, energyCost, NAMES, planIndex, slotOfHour } from '../game/engine.js';
import { preflight } from '../game/settle.js';
import { rng } from '../game/rng.js';

const BLOCKED = new Set(['shop', 'beg', 'bins', 'repair_item', 'facility', 'danger', 'cards', 'casino', 'shellgame', 'clinic', 'tavern']);
const LAST_HOUR = 21;
const keys = (x, names) => x && typeof x === 'object' && !Array.isArray(x) && Object.keys(x).sort().join('|') === names.slice().sort().join('|');

// 从当前小时到 21 点：一天里还能排的每个小时。
export const remainingHours = (s) => Array.from({ length: Math.max(0, LAST_HOUR - s.hour + 1) }, (_, i) => s.hour + i);
// 行动在给定小时里按营业时段开放的那些小时。
export const openHours = (action, hours) => hours.filter((h) => !action.allowed || action.allowed.includes(slotOfHour(h)));

function optionsFor(action) {
  if (action.zone !== 'pick') return [{ zone: action.zone }];
  const zones = action.begging ? BEG_ZONES : action.bins ? BINS_ZONES : action.repairing ? REPAIR_ZONES : OUT_ZONES;
  return zones.map((zone) => ({ zone }));
}

// 单人、无待处理交互、无风险的候选；当前小时开放的行动还要过一次真实预检，只按时段开放的后续小时在结算时再检。
function candidateActions(s, id, protectedIds, hours) {
  const options = [];
  const index = planIndex(s.hour);
  const before = protectedIds.map((x) => JSON.stringify(s.plan[x][index]));
  for (const actionId of available(s, id)) {
    const a = ACTIONS[actionId];
    if (BLOCKED.has(actionId) || a.eventOnly || a.risky || a.fixed || a.min || a.rescue || a.downedOnly || a.gamble || a.shopping || a.building || a.repairing || a.intox || a.fishing) continue;
    const open = openHours(a, hours);
    if (!open.length) continue;
    for (const { zone } of optionsFor(a)) {
      if (open.includes(s.hour)) {
        const assigned = assign(s, id, s.hour, actionId, { zone });
        if (assigned.error || protectedIds.some((x, i) => JSON.stringify(assigned.state.plan[x][index]) !== before[i]) || preflight(assigned.state).error) continue;
      }
      options.push({ actionId, zone, name: a.name, hours: open });
    }
  }
  return options;
}

const projectEnergy = (energy, a) => Math.min(100, energy + (a.energyGain || 0) - energyCost(null, null, a));

// 本地随机排程：给每人把 hours 里空着的小时排上合法单人行动；随机走 rng 可复现，体力见底时只排休整类。
// 已预约的街头机会和合作格永远保留；force 时其余已有安排也会被重排。
export function planLocally(s, actorIds, hours, { force = false, protect = [], options = null, energyStart = {} } = {}) {
  let draft = copy(s);
  const filled = [];
  for (const id of actorIds) {
    const pool = options?.[id] || candidateActions(s, id, protect, hours);
    let energy = energyStart[id] ?? (s.actors[id].energy + (s.actors[id].coffeeCredit || 0));
    for (const h of hours) {
      const existing = draft.plan[id][planIndex(h)];
      if (existing && (!force || existing.eventUid || existing.group)) { energy = projectEnergy(energy, ACTIONS[existing.id]); continue; }
      const open = pool.filter((o) => o.hours.includes(h) && (energy >= 20 || !energyCost(null, null, ACTIONS[o.actionId])));
      if (!open.length) continue;
      const pick = open[Math.floor(rng(s.seed, `autoplan:${s.day}:${h}:${id}:${s.stateRevision}`) * open.length)];
      const r = assign(draft, id, h, pick.actionId, { zone: pick.zone });
      if (r.error) continue;
      draft = r.state;
      energy = projectEnergy(energy, ACTIONS[pick.actionId]);
      filled.push({ actorId: id, hour: h, actionId: pick.actionId, zone: pick.zone });
    }
  }
  return { state: draft, filled };
}

// 当前小时预检不过时，把肇事者（不在 protect 里）这一格换成随机可行的行动，最后兜底回营休息。
// 玩家预约的街头机会和合作格不替他退订：原样交还，让他自己决定。
export function repairHour(s, protect = []) {
  let draft = s;
  for (let round = 0; round < 4; round++) {
    const check = preflight(draft);
    if (!check.error) return { state: draft };
    const at = check.actorId ? { actorId: check.actorId, hour: draft.hour } : null;
    if (!check.actorId || protect.includes(check.actorId) || draft.actors[check.actorId].life !== 'active') return { error: check.error, at };
    const failing = draft.plan[check.actorId][planIndex(draft.hour)];
    if (failing?.eventUid || failing?.group) return { error: check.error, at };
    const cleared = copy(draft);
    cancelAt(cleared, check.actorId, draft.hour);
    const options = candidateActions(cleared, check.actorId, protect, [draft.hour]).filter((o) => o.actionId !== failing?.id);
    const retry = planLocally(cleared, [check.actorId], [draft.hour], { options: { [check.actorId]: options } });
    draft = retry.filled.length ? retry.state : assign(cleared, check.actorId, draft.hour, round < 3 ? 'rest' : 'sleep').state;
  }
  const check = preflight(draft);
  return check.error ? { error: check.error, at: check.actorId ? { actorId: check.actorId, hour: draft.hour } : null } : { state: draft };
}

// 街道即时行动用：操控者这一格已排好，空闲队友没安排或安排不过预检的就随机做一件事。
export function fillTeammatesNow(s, selectedActorId) {
  const mates = active(s).filter((id) => id !== selectedActorId && !s.busy?.[id]);
  const planned = planLocally(s, mates, [s.hour], { protect: [selectedActorId] });
  const fixed = repairHour(planned.state, [selectedActorId]);
  if (fixed.error) return fixed;
  // 什么都没改就原样返回，别让飞行中的 AI 请求白白过期。
  if (!planned.filled.length && fixed.state === planned.state) return { state: s, filled: [] };
  fixed.state.stateRevision += 1;
  return { state: fixed.state, filled: planned.filled };
}

export function makeAutoPlanContext(s, selectedActorId, requestId) {
  if (s.phase !== 'planning' || !active(s).includes(selectedActorId)) return { error: '当前不能安排队友。' };
  const actorIds = active(s).filter((id) => id !== selectedActorId && !s.busy?.[id]);
  if (!actorIds.length) return { error: '当前没有可安排的空闲队友。' };
  const hours = remainingHours(s);
  const allowedActions = Object.fromEntries(actorIds.map((id) => [id, candidateActions(s, id, [selectedActorId], hours)]));
  if (actorIds.some((id) => !allowedActions[id].length)) return { error: '有队友当前小时没有可行的单人行动，请先检查排程。' };
  const actors = Object.fromEntries(actorIds.map((id) => {
    const p = s.actors[id];
    return [id, { name: NAMES[id], health: p.health, food: p.food, energy: p.energy, coffeeCredit: p.coffeeCredit || 0, usableEnergy: p.energy + (p.coffeeCredit || 0), warmth: p.warmth, mind: p.mind, hygiene: p.hygiene, fishingSkill: Number.isFinite(p.fishingSkill) ? p.fishingSkill : 0, location: p.location,
      items: s.items.filter((x) => x.container === id).map((x) => x.itemId).slice(0, 20) }];
  }));
  return { requestId, day: s.day, hour: s.hour, hourTick: s.hourTick, slot: s.slot, stateRevision: s.stateRevision, weather: s.weatherKind, selectedActorId, actorIds, hours, actors, cash: s.cash, food: s.effectiveFood, allowedActions };
}

// 模型必须为每个队友的每个剩余小时各给一条，且只能选该候选开放的小时。
export function validatePlans(payload, context) {
  if (!keys(payload, ['requestId', 'plans']) || payload.requestId !== context.requestId || !Array.isArray(payload.plans) || payload.plans.length !== context.actorIds.length * context.hours.length) return { ok: false, reason: 'AI 返回的排程条数或请求标识无效。' };
  const seen = new Set();
  for (const plan of payload.plans) {
    if (!keys(plan, ['actorId', 'actionId', 'zone', 'hour']) || !context.actorIds.includes(plan.actorId) || !context.hours.includes(plan.hour) || seen.has(plan.actorId + ':' + plan.hour)) return { ok: false, reason: 'AI 返回了重复、越权或不在今天的排程。' };
    const options = context.allowedActions[plan.actorId];
    if (!options?.some((a) => a.actionId === plan.actionId && a.zone === plan.zone && a.hours.includes(plan.hour))) return { ok: false, reason: 'AI 返回了当前不可用的行动。' };
    seen.add(plan.actorId + ':' + plan.hour);
  }
  return { ok: true };
}

function summarize(filled) {
  const byActor = {};
  for (const p of filled) (byActor[p.actorId] = byActor[p.actorId] || []).push(ACTIONS[p.actionId].name);
  return Object.entries(byActor).map(([id, names]) => `${NAMES[id]}：${[...new Set(names)].join('/')}`).join('；');
}

// 按小时顺序套用模型排程；已预约的机会与合作格保留，某格排不上或按体力推演已经干不动，就本地随机补一个。操控者的计划全天不得改动。
function applyPlans(s, selectedActorId, plans, context) {
  let draft = copy(s);
  const protectedPlan = JSON.stringify(s.plan[selectedActorId]);
  const filled = [];
  const energy = Object.fromEntries(context.actorIds.map((id) => [id, s.actors[id].energy + (s.actors[id].coffeeCredit || 0)]));
  for (let p of plans.slice().sort((a, b) => a.hour - b.hour)) {
    const index = planIndex(p.hour);
    const existing = draft.plan[p.actorId][index];
    if (existing?.eventUid || existing?.group) { energy[p.actorId] = projectEnergy(energy[p.actorId], ACTIONS[existing.id]); continue; }
    const exhausted = energy[p.actorId] < 20 && energyCost(null, null, ACTIONS[p.actionId]) > 0;
    let r = exhausted ? { error: '体力不足' } : assign(draft, p.actorId, p.hour, p.actionId, { zone: p.zone });
    if (r.error) {
      const local = planLocally(draft, [p.actorId], [p.hour], { force: true, protect: [selectedActorId], options: { [p.actorId]: context.allowedActions[p.actorId] }, energyStart: { [p.actorId]: energy[p.actorId] } });
      if (!local.filled.length) continue;
      r = local; p = local.filled[0];
    }
    draft = r.state;
    energy[p.actorId] = projectEnergy(energy[p.actorId], ACTIONS[p.actionId]);
    filled.push({ actorId: p.actorId, hour: p.hour, actionId: p.actionId });
  }
  if (JSON.stringify(draft.plan[selectedActorId]) !== protectedPlan) return { error: 'AI 不能改动当前操控人物的计划。' };
  const check = preflight(draft);
  if (check.error) return { error: check.error };
  draft.stateRevision += 1;
  return { state: draft, summary: summarize(filled) };
}

function localPlans(s, context) {
  const planned = planLocally(s, context.actorIds, context.hours, { force: true, protect: [context.selectedActorId], options: context.allowedActions });
  if (!planned.filled.length) return { error: '本地建议无法为队友找到可行行动，请手动安排。' };
  // 两个队友随机撞上同一笔花销时，把肇事者当前小时换掉，而不是整单放弃。
  const fixed = repairHour(planned.state, [context.selectedActorId]);
  if (fixed.error) return { error: fixed.error };
  fixed.state.stateRevision += 1;
  return { state: fixed.state, summary: summarize(planned.filled) };
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
  const timer = setTimeout(abort, 40000);
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
  const result = applyPlans(s, selectedActorId, payload.plans, context);
  return result.error ? result : { ...result, source: 'ai' };
}
