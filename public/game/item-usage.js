const CIGARETTES = new Set(['cigarette', 'cigarette_regular', 'cigarette_premium']);
const ALCOHOL = new Set(['beer', 'beer_bottle', 'spirit', 'baijiu', 'vodka']);

export function itemUsage(state, actorId, itemId) {
  const actor = state.actors[actorId];
  if (!actor) return null;
  let used, limit, unit;
  if (CIGARETTES.has(itemId)) { used = actor.smokes || 0; limit = 2; unit = '次'; }
  else if (ALCOHOL.has(itemId)) { used = actor.intox || 0; limit = 2; unit = '醉意'; }
  else if (itemId === 'tea' || itemId === 'wipes') { used = Number(Boolean(state.daily[itemId + ':' + actorId])); limit = 1; unit = '次'; }
  else return null;
  return { used, limit, remaining: Math.max(0, limit - used), unit };
}
