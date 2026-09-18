// 旧物的价值由去处决定；效果本身由接线层在对应时机执行。
import { clamp } from './rules.js';
import { findItem, removeItem } from './items.js';

export const SALVAGE = {
  broken_phone: { repaired: 'phone', parts: 1, sell: 24, keepEffectKey: 'phone_remote_chat', gift: 2 },
  broken_radio: { repaired: 'radio', parts: 1, sell: 20, keepEffectKey: 'camp_radio_broadcast', gift: 2 },
  broken_headphones: { repaired: 'headphones', parts: 1, sell: 26, keepEffectKey: 'xuan_headphones_wish', gift: 2 },
  broken_tv: { repaired: 'tv', parts: 2, sell: 60, keepEffectKey: 'camp_tv_screening', gift: 3, tv: true },
};

const REGULARS = [
  { id: 'reg_chen', district: 'station' },
  { id: 'reg_liu', district: 'market' },
  { id: 'reg_zhao', district: 'cinema' },
  { id: 'reg_wang', district: 'service' },
  { id: 'reg_lu', district: 'recycle' },
  { id: 'reg_xu', district: 'cinema' },
];

const brokenDef = (itemId) => SALVAGE[itemId] || null;
const repairedDef = (itemId) => Object.values(SALVAGE).find((def) => def.repaired === itemId) || null;
const actorOfContainer = (state, container) => state.actors?.[container] ? container : null;
function holder(state, item) {
  return actorOfContainer(state, item.container);
}

function accessibleItem(state, item, actorId) {
  return item.container === actorId || (item.container === 'camp' && state.actors?.[actorId]?.location === 'camp');
}

function disposalCheck(state, uid, actorId) {
  const item = findItem(state, uid);
  if (!item) return { error: '没有这件旧物' };
  const def = repairedDef(item.itemId);
  if (!def) return { error: '旧物还没有修好' };
  if (item.kept) return { error: '这件旧物已经留作自用，不能再处置' };
  const resolvedActorId = actorId || holder(state, item);
  if (!state.actors?.[resolvedActorId]) return { error: '请指定处置旧物的角色' };
  if (!accessibleItem(state, item, resolvedActorId)) return { error: '旧物不在处置者自己的包里，也不在可及的营地箱' };
  return { item, def, actorId: resolvedActorId };
}

export function canRepair(state, uid, actorId) {
  const item = findItem(state, uid);
  const def = item && brokenDef(item.itemId);
  if (!def) return { ok: false, reason: '这不是可修复的旧物' };
  const actor = state.actors?.[actorId];
  if (!actor) return { ok: false, reason: '没有这个维修角色' };
  if (!accessibleItem(state, item, actorId)) return { ok: false, reason: '旧物不在维修者包里，也不在可及的营地箱' };
  if ((state.parts || 0) < def.parts) return { ok: false, reason: '电子零件不够' };
  if (def.tv && !state.camp?.facilities?.includes('repair_table')) return { ok: false, reason: '修电视需要营地修理桌' };
  return { ok: true };
}

export function repair(state, uid, actorId) {
  const allowed = canRepair(state, uid, actorId);
  if (!allowed.ok) return { error: allowed.reason };
  const item = findItem(state, uid);
  const def = brokenDef(item.itemId);
  state.parts -= def.parts;
  item.itemId = def.repaired;
  return { item, text: '这件旧物修好了。' };
}

export function giftTargets(state) {
  return REGULARS.filter((regular) => (state.relations?.[regular.id]?.trust || 0) < 5).map((regular) => regular.id);
}

export function disposeOptions(state, uid) {
  const item = findItem(state, uid);
  const def = item && repairedDef(item.itemId);
  const baseReason = !item ? '没有这件旧物' : !def ? '旧物还没有修好' : item.kept ? '已经留作自用' : null;
  const actorId = item && holder(state, item);
  const actor = actorId && state.actors[actorId];
  const ownReason = actor ? null : '旧物不在角色包里';
  const sellReason = baseReason || ownReason || actor.location !== 'recycle' ? (baseReason || ownReason || '要到回收巷才能卖') : null;
  const targets = actor ? REGULARS.filter((regular) => giftTargets(state).includes(regular.id) && regular.district === actor.location && (!def?.tv || regular.id === 'reg_xu')) : [];
  const giftReason = baseReason || ownReason || !targets.length ? (baseReason || ownReason || '这里没有可回赠的熟人') : null;
  return [
    { id: 'sell', label: '卖掉', detail: def ? '在回收巷卖' + def.sell + '块' : '修好后可卖', enabled: !sellReason, ...(sellReason ? { reason: sellReason } : {}) },
    { id: 'keep', label: '留下', detail: def ? '留下后触发' + def.keepEffectKey : '修好后可留作自用', enabled: !(baseReason || ownReason), ...((baseReason || ownReason) ? { reason: baseReason || ownReason } : {}) },
    { id: 'gift', label: '回赠', detail: def?.tv ? '回赠许姐并解锁放映场地' : '回赠熟人，信任提升', enabled: !giftReason, ...(giftReason ? { reason: giftReason } : {}) },
  ];
}

export function dispose(state, uid, choice, opts = {}) {
  const checked = disposalCheck(state, uid, opts.actorId);
  if (checked.error) return checked;
  const { item, def, actorId } = checked;
  const actor = state.actors[actorId];
  if (choice === 'sell') {
    if (item.container !== actorId) return { error: '售出旧物必须由持有者带到回收巷' };
    if (actor.location !== 'recycle') return { error: '要到回收巷才能卖旧物' };
    state.cash = (state.cash || 0) + def.sell;
    state.ledger = state.ledger || {};
    state.ledger.income = (state.ledger.income || 0) + def.sell;
    removeItem(state, uid);
    return { cash: def.sell, text: '旧物卖出了' + def.sell + '块。' };
  }
  if (choice === 'keep') {
    item.kept = true;
    return { effectKey: def.keepEffectKey, text: '这件旧物留下自用。' };
  }
  if (choice === 'gift') {
    const target = REGULARS.find((regular) => regular.id === opts.npcId);
    if (!target) return { error: '这不是可回赠的熟人' };
    if (def.tv && target.id !== 'reg_xu') return { error: '电视只能回赠给许姐' };
    const current = state.relations?.[target.id];
    if ((current?.trust || 0) >= 5) return { error: '这位熟人的信任已经满了' };
    if (actor.location !== target.district) return { error: '要在熟人所在街区才能回赠' };
    state.relations = state.relations || {};
    const relation = state.relations[target.id] || {};
    relation.trust = clamp((relation.trust || 0) + def.gift, 0, 5);
    state.relations[target.id] = relation;
    removeItem(state, uid);
    if (def.tv) {
      state.flags = state.flags || {};
      state.flags.screeningVenueUnlocked = true;
    }
    return { trust: relation.trust, ...(def.tv ? { effectKey: 'screening_venue_unlocked' } : {}), text: '旧物交到了熟人手里。' };
  }
  return { error: '未知旧物去处' };
}
