const CIGARETTES = new Set(['cigarette', 'cigarette_regular', 'cigarette_premium']);
const ALCOHOL = new Set(['beer', 'beer_bottle', 'spirit', 'baijiu', 'vodka']);

// 烟酒只计次不设上限（limit 为 null）；茶与湿巾仍每天一次。
export function itemUsage(state, actorId, itemId) {
  const actor = state.actors[actorId];
  if (!actor) return null;
  if (CIGARETTES.has(itemId)) return { used: actor.smokes || 0, limit: null, remaining: null, unit: '次' };
  if (ALCOHOL.has(itemId)) return { used: actor.drinks || 0, limit: null, remaining: null, unit: '次' };
  if (itemId === 'tea' || itemId === 'wipes') {
    const used = Number(Boolean(state.daily[itemId + ':' + actorId]));
    return { used, limit: 1, remaining: 1 - used, unit: '次' };
  }
  return null;
}
