import { getData } from './data.js';
import { itemDef } from './items.js';
import { rng } from './rng.js';

export const ITEM_WISH_CHOICES = {
  xuan: ['keyboard', 'headphones', 'coffee', 'tea', 'towel'],
  fan: ['paint', 'paper_set', 'camera', 'tea', 'coffee'],
  ma: ['shoes', 'gloves', 'fishing_rod', 'fishing_rod_pro', 'tea', 'coffee'],
};
const CONSUME = new Set(['coffee', 'tea']);
const cooldown = 2;
const exact = (v, keys) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).sort().join('|') === keys.slice().sort().join('|');
const line = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max && !/[<>]/.test(v);

export function itemWishTemplate(w) {
  const def = itemDef(w.targetItem);
  return { id: w.templateId, name: `想要${def.name}`, category: 'personal', targetItemIds: [w.targetItem], indirectLine: w.indirectLine, substitutes: ['一起休整'], owningItemAloneIsEnough: !CONSUME.has(w.targetItem) };
}

export function makeWishContext(state) {
  const actors = [];
  for (const actorId of Object.keys(ITEM_WISH_CHOICES)) {
    const actor = state.actors[actorId];
    if (actor?.life !== 'active' || state.wishAiDay?.[actorId] === state.day) continue;
    const wishes = state.wishes.filter(w => w.actor === actorId);
    if (wishes.some(w => w.status === 'active' && (w.targetItem || !['quiet_smoke','evening_drink'].includes(w.templateId)))) continue;
    if (wishes.filter(w => w.status === 'active').length >= getData().rules.desire.maxActivePerActor) continue;
    const candidates = ITEM_WISH_CHOICES[actorId].filter(itemId => {
      const def = itemDef(itemId);
      return def?.shopIds?.length && !state.items.some(it => it.itemId === itemId && (it.container === actorId || it.container === 'camp')) &&
        !wishes.some(w => w.targetItem === itemId && (w.status === 'active' || state.day - (w.closedDay ?? -999) < cooldown));
    }).map(itemId => ({ itemId, name: itemDef(itemId).name, price: itemDef(itemId).price }));
    if (candidates.length) actors.push({ actorId, location: actor.location, mind: actor.mind, food: actor.food, candidates, recent: wishes.slice(-3).map(w => w.targetItem || w.templateId) });
  }
  return { requestId: `wish:${state.seed}:${state.day}:${state.stateRevision}`, day: state.day, stateRevision: state.stateRevision, cash: state.cash, actors };
}

export function applyWishSuggestions(state, context, payload, source = 'ai') {
  if (!exact(payload, ['requestId','suggestions']) || payload.requestId !== context.requestId || !Array.isArray(payload.suggestions) || payload.suggestions.length !== context.actors.length) return null;
  if (state.day !== context.day || state.stateRevision !== context.stateRevision || !['planning','arrival'].includes(state.phase)) return null;
  const seen = new Set();
  for (const x of payload.suggestions) {
    if (!exact(x, ['actorId','itemId','reason','indirectLine']) || !line(x.reason, 100) || !line(x.indirectLine, 60) || seen.has(x.actorId)) return null;
    const actor = context.actors.find(a => a.actorId === x.actorId);
    if (!actor || state.actors[x.actorId]?.life !== 'active' || !actor.candidates.some(c => c.itemId === x.itemId)) return null;
    seen.add(x.actorId);
  }
  const next = structuredClone(state);
  next.wishAiDay ??= {};
  for (const x of payload.suggestions) {
    next.wishSeq = (next.wishSeq || 0) + 1;
    next.wishes.push({ uid: 'w' + next.wishSeq, templateId: 'item_' + x.itemId, targetItem: x.itemId, reason: x.reason, indirectLine: x.indirectLine, source, actor: x.actorId, category: 'personal', intensity: 22, createdTurn: next.turn, createdDay: next.day, revealed: true, revealTurn: next.turn, promise: null, declined: false, status: 'active', lastLoss: 0 });
    next.wishAiDay[x.actorId] = next.day;
  }
  next.stateRevision += 1;
  return next;
}

export function localWishSuggestions(context, seed) {
  return { requestId: context.requestId, suggestions: context.actors.map(a => {
    const candidate = a.candidates[Math.floor(rng(seed, `item-wish:${context.day}:${a.actorId}`) * a.candidates.length)];
    const voice = { xuan: `修设备时用得上${candidate.name}`, fan: `做片子时想用${candidate.name}`, ma: `干活歇脚时想有${candidate.name}` }[a.actorId];
    return { actorId: a.actorId, itemId: candidate.itemId, reason: voice, indirectLine: `${candidate.name}要是有就好了。` };
  }) };
}

export function fulfillItemWish(state, actorId, itemId, mode, events = []) {
  const w = state.wishes.find(x => x.actor === actorId && x.status === 'active' && x.targetItem === itemId);
  if (!w || (mode === 'obtain' && CONSUME.has(itemId)) || (mode === 'use' && !CONSUME.has(itemId))) return false;
  w.status = 'fulfilled'; w.closedDay = state.day; w.intensity = 0; w.revealed = true; w.promise = null;
  events.push(`${state.names[actorId]}的愿望「想要${itemDef(itemId).name}」得到了回应。`);
  return true;
}

export function itemWishOwned(state, actorId, itemId) {
  return state.items.some(it => it.itemId === itemId && (it.container === actorId || (it.container === 'camp' && state.actors[actorId].location === 'camp')));
}

export function fulfillReachedItemWishes(state, actorId, events = []) {
  for (const w of state.wishes) if (w.actor === actorId && w.status === 'active' && w.targetItem && itemWishOwned(state, actorId, w.targetItem)) fulfillItemWish(state, actorId, w.targetItem, 'obtain', events);
}
