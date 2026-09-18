import { rng } from './rng.js';
import { makeItem, consumeUse } from './items.js';

export const FISHING_SKILL_DEFAULT = { xuan: 0, fan: 0, ma: 60 };
export const RODS = { fishing_rod_simple: 0, fishing_rod: 5, fishing_rod_pro: 10 };
const WEATHER = { clear: 0, overcast: 4, rain: -8, storm: -20, cold: -6, coldwave: -14 };

export function fishingGear(state, actorId) {
  const owned = state.items.filter(x => x.container === actorId && x.uses > 0 && !x.wet);
  const rod = owned.filter(x => Object.hasOwn(RODS, x.itemId)).sort((a, b) => RODS[b.itemId] - RODS[a.itemId])[0];
  const bait = owned.find(x => x.itemId === 'fish_bait');
  return { rod, bait };
}

function finishAttempt(state, actorId, caught, events) {
  const p = state.actors[actorId];
  p.fishingDryStreak = caught ? 0 : (p.fishingDryStreak || 0) + 1;
  if (actorId === 'ma' && p.fishingDryStreak >= 3 && state.flags?.riverFightDay !== state.day && !state.pending?.riverFight) {
    state.pending ||= {};
    state.flags ||= {};
    state.pending.riverFight = {
      id: `riverFight:${state.seed}:${state.day}:${state.hourTick}:ma`, kind: 'riverFight', actorId: 'ma',
      seed: state.seed, day: state.day, hourTick: state.hourTick, line: '这个鱼就是欠干',
    };
    state.flags.riverFightDay = state.day;
    p.fishingDryStreak = 0;
    p.energy = Math.max(0, p.energy - 5);
    p.clothes.wet = true;
    events.push('马哥跳进河里跟鱼干一架：“这个鱼就是欠干。”体力-5，衣服湿了。');
  }
}

export function fish(state, actorId, events) {
  const p = state.actors[actorId];
  const { rod, bait } = fishingGear(state, actorId);
  const skill = Number.isInteger(p.fishingSkill) ? p.fishingSkill : FISHING_SKILL_DEFAULT[actorId];
  p.fishingDryStreak ||= 0;
  consumeUse(state, bait.uid, 1);
  const chance = Math.min(55, Math.max(5, 12 + Math.floor(skill * 0.24) + RODS[rod.itemId] + (WEATHER[state.weatherKind] ?? 0)));
  const hit = rng(state.seed, `fish:${state.hourTick}:${actorId}`);
  const rare = rng(state.seed, `fish:rare:${state.hourTick}:${actorId}`);
  const itemId = hit < chance / 100 ? (rare < Math.min(0.28, 0.04 + skill / 500) ? 'fish_rare' : 'fish_common') : null;
  p.fishingSkill = Math.min(100, skill + 1);
  if (!itemId) {
    finishAttempt(state, actorId, false, events);
    events.push(`${state.names[actorId]}钓鱼空钩；熟练度${skill}→${p.fishingSkill}。`);
    return null;
  }
  const bite = {
    id: `fishQte:${state.seed}:${state.day}:${state.hourTick}:${actorId}`,
    actorId, day: state.day, hourTick: state.hourTick, skill, fishItemId: itemId,
    zoneStart: Math.floor(rng(state.seed, `fish:qte:zone:${state.hourTick}:${actorId}`) * 360),
    zoneWidth: Math.min(120, Math.max(40, 40 + 0.8 * skill)),
  };
  state.pending ||= {};
  state.pending.fishingQte ||= [];
  state.pending.fishingQte.push(bite);
  events.push(`${state.names[actorId]}钓鱼有鱼咬钩，等你收线；熟练度${skill}→${p.fishingSkill}。`);
  return bite;
}

export function resolveFishingQte(input, biteId, angleOrNull) {
  const bite = input.pending?.fishingQte?.[0];
  if (!bite || bite.id !== biteId) return { state: input, error: '当前没有这次待处理的收线。' };
  if (angleOrNull !== null && (typeof angleOrNull !== 'number' || !Number.isFinite(angleOrNull) || angleOrNull < 0 || angleOrNull > 360)) {
    return { state: input, error: '角度必须在0到360度之间。' };
  }
  const state = JSON.parse(JSON.stringify(input));
  state.pending.fishingQte.shift();
  const active = state.actors[bite.actorId]?.life === 'active';
  const offset = angleOrNull === null ? -1 : ((angleOrNull % 360) - bite.zoneStart + 360) % 360;
  const hit = active && offset >= 0 && offset <= bite.zoneWidth;
  const events = [];
  if (hit) {
    makeItem(state, bite.fishItemId, bite.actorId);
    state.actors[bite.actorId].fishingSkill = Math.min(100, state.actors[bite.actorId].fishingSkill + 1);
  }
  if (active) finishAttempt(state, bite.actorId, hit, events);
  events.push(!active ? `${state.names[bite.actorId]}无法收线，本次咬钩作废。` : hit ? `${state.names[bite.actorId]}收线成功，得到${bite.fishItemId === 'fish_rare' ? '少见鱼' : '常见鱼'}。` : `${state.names[bite.actorId]}收线落空。`);
  state.stateRevision += 1;
  state.log.unshift(...events);
  state.log.length = Math.min(state.log.length, 120);
  return { state, events, result: { hit, biteId, actorId: bite.actorId, fishItemId: hit ? bite.fishItemId : null, forfeited: angleOrNull === null || !active } };
}

export function autoResolveFishingQte(input) {
  const bite = input.pending?.fishingQte?.[0];
  if (!bite) return { state: input, error: '没有待处理的收线。' };
  const angle = rng(input.seed, `fish:qte:auto:${bite.id}`) * 360;
  return resolveFishingQte(input, bite.id, angle);
}
