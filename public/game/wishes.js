// 愿望系统：由清晨与特定事件生成，每个行动回合增长，超阈值扣精神，满足/替代/延期/拒绝四种回应。
import { getData } from './data.js';
import { makeWishContext, applyWishSuggestions, fulfillItemWish, itemWishTemplate } from './item-wishes.js';
export { makeWishContext, applyWishSuggestions, fulfillItemWish };
import { clamp, wishMindLoss, wishPressure } from './rules.js';

export const GROWTH = { daily: 2, comfort: 1, personal: 1, relational: 1, aspiration: 0.5 };
const BASIC = ['quiet_smoke', 'evening_drink'];
const BASIC_COOLDOWN = 2;

export function activeWishes(state, actorId) {
  return state.wishes.filter((w) => w.actor === actorId && w.status === 'active');
}

export function templateOf(w) {
  if (w.targetItem) return itemWishTemplate(w);
  return getData().wishTemplates.find((t) => t.id === w.templateId);
}

function newWish(state, actorId, tpl) {
  state.wishSeq = (state.wishSeq || 0) + 1;
  const grace = getData().rules.desire.latentRevealGraceTurns;
  const w = {
    uid: 'w' + state.wishSeq,
    templateId: tpl.id,
    actor: actorId,
    category: tpl.category,
    intensity: tpl.startIntensity,
    createdTurn: state.turn,
    createdDay: state.day,
    revealed: false,
    revealTurn: state.turn + grace,
    promise: null,
    declined: false,
    status: 'active',
    lastLoss: 0,
  };
  state.wishes.push(w);
  return w;
}

// 清晨补齐基础愿望，第三格留给日常物品或事件触发的剧情目标。
export function generateMorningWishes(state, events = []) {
  const rules = getData().rules.desire;
  for (const id of Object.keys(state.actors)) {
    const p = state.actors[id];
    if (p.life !== 'active') continue;
    for (const templateId of BASIC) {
      if (activeWishes(state, id).length >= rules.maxActivePerActor) break;
      if (activeWishes(state, id).some(w => w.templateId === templateId)) continue;
      if (state.wishes.some(w => w.actor === id && w.templateId === templateId && w.status !== 'active' && state.day - (w.closedDay ?? state.day) < BASIC_COOLDOWN)) continue;
      const tpl = getData().wishTemplates.find(t => t.id === templateId);
      newWish(state, id, tpl);
      events.push(`${state.names[id]}有了新念头（尚未说出口）。`);
    }
  }
}

export const ensureBasicWishes = generateMorningWishes;

// 事件触发的愿望（如站口牌桌让马哥想坐一次）。已有同类则只加强度。
export function nudgeWish(state, actorId, templateId, amount = 10) {
  const existing = activeWishes(state, actorId).find((w) => w.templateId === templateId);
  if (existing) {
    existing.intensity = clamp(existing.intensity + amount);
    return existing;
  }
  const tpl = getData().wishTemplates.find((t) => t.id === templateId);
  if (!tpl) return null;
  if (activeWishes(state, actorId).some((w) => w.category === tpl.category && !BASIC.includes(w.templateId))) return null;
  if (activeWishes(state, actorId).length >= getData().rules.desire.maxActivePerActor) return null;
  const w = newWish(state, actorId, tpl);
  w.intensity = clamp(w.intensity + amount);
  return w;
}

// 一个行动回合：增长、揭示、算压力。返回 {pressure, breakdown}
export function tickWishes(state, actorId) {
  const rules = getData().rules;
  const list = activeWishes(state, actorId);
  const pressed = [];
  for (const w of list) {
    if (!w.revealed && state.turn >= w.revealTurn) w.revealed = true;
    const promised = w.promise && state.turn < w.promise.until;
    if (promised) { w.lastLoss = 0; continue; }
    w.intensity = clamp(w.intensity + (BASIC.includes(w.templateId) ? templateOf(w).growthPerTurn : GROWTH[w.category]));
    if (w.promise && state.turn >= w.promise.until && !w.promise.expiredNoted) {
      w.promise.expiredNoted = true;
      w.intensity = clamp(w.intensity + 8);
    }
    if (!w.revealed) { w.lastLoss = 0; continue; }
    w.lastLoss = wishMindLoss(w.intensity, rules);
    if (w.lastLoss > 0) pressed.push(w);
  }
  const pressure = wishPressure(pressed.map((w) => w.intensity), rules);
  return { pressure, breakdown: pressed.map((w) => ({ uid: w.uid, templateId: w.templateId, loss: w.lastLoss })) };
}

// 满足：exact 减 70，partial 减 30；归零即关闭。
export function fulfillWish(state, actorId, templateId, mode, events) {
  const w = activeWishes(state, actorId).find((x) => x.templateId === templateId);
  if (!w) return null;
  const d = getData().rules.desire;
  const cut = mode === 'exact' ? d.exactFulfillmentIntensityReduction : d.partialFulfillmentIntensityReduction;
  w.intensity = clamp(w.intensity - cut);
  w.revealed = true;
  w.promise = null;
  const tpl = templateOf(w);
  if (mode === 'exact' || w.intensity <= 0) {
    w.status = 'fulfilled';
    w.closedDay = state.day;
    if (events) events.push(`${state.names[actorId]}的愿望「${tpl.name}」得到了回应。`);
  } else if (events) {
    events.push(`${state.names[actorId]}的「${tpl.name}」得到部分缓解（强度-${cut}）。`);
  }
  return w;
}

// 玩家回应：promise（4 回合缓冲，最多一次）、decline（一次轻微失落，愿望仍在）。
export function respondWish(state, uid, response) {
  const w = state.wishes.find((x) => x.uid === uid && x.status === 'active');
  if (!w) return { error: '没有这条愿望' };
  const d = getData().rules.desire;
  if (response === 'promise') {
    if (w.promise && w.promise.extensions >= d.promiseExtensionsMax) return { error: '同一愿望只能延期一次，不能靠一直说“明天”冻结它' };
    w.promise = { until: state.turn + d.promisedGraceTurns, extensions: (w.promise?.extensions || 0) + 1, madeTurn: state.turn };
    w.revealed = true;
    return { ok: true, message: '已约定：' + d.promisedGraceTurns + '回合内不再积压，到期未兑现会更失望。' };
  }
  if (response === 'decline') {
    if (w.declined) return { error: '已经明确拒绝过了，不重复扣精神；长期不给替代仍会积压。' };
    w.declined = true;
    w.revealed = true;
    const p = state.actors[w.actor];
    p.mind = clamp(p.mind - 2);
    return { ok: true, message: '说清楚了。' + state.names[w.actor] + '有点失落（精神-2），但知道了答案。' };
  }
  return { error: '未知回应' };
}

export function wishSummary(state, actorId) {
  return activeWishes(state, actorId)
    .filter((w) => w.revealed)
    .sort((a, b) => b.intensity - a.intensity)
    .map((w) => ({ ...w, tpl: templateOf(w) }));
}
