import { burnFuel, fuelCount } from './camp.js';
import { findItem, itemDef } from './items.js';

// 以下成品与饱食值是虚构游戏参数；每份原料只加工一次，保质期不延长。
export const COOKING_RECIPES = Object.freeze({
  fish_common: 'fish_common_cooked',
  fish_rare: 'fish_rare_cooked',
  meal: 'meal_hot',
  bread: 'bread_toasted',
  hot_soup: 'hot_soup_heated',
});

export function validateCooking(state, actorId, itemUid) {
  const item = findItem(state, itemUid);
  if (!item) return '原料已不存在。';
  if (!Object.hasOwn(COOKING_RECIPES, item.itemId)) return '这件物品不能再次加工。';
  if (item.container !== actorId && item.container !== 'camp') return '原料须在自己包或营地箱。';
  if (item.uses < 1) return '原料已用完。';
  if (item.expiresDay !== null && item.expiresDay !== undefined && item.expiresDay < state.day) return '原料已过期。';
  if (fuelCount(state) < 1) return '篝火燃料不足。';
  return null;
}

export function cookingOptions(state, actorId) {
  return state.items
    .filter((item) => validateCooking(state, actorId, item.uid) === null)
    .map((item) => ({ uid: item.uid, itemId: item.itemId, resultItemId: COOKING_RECIPES[item.itemId], fuel: 1, container: item.container }));
}

export function cookFood(state, actorId, itemUid, events) {
  const reason = validateCooking(state, actorId, itemUid);
  if (reason) return null;
  const item = findItem(state, itemUid);
  burnFuel(state, 1);
  const sourceName = itemDef(item.itemId).name;
  item.itemId = COOKING_RECIPES[item.itemId];
  item.container = actorId;
  item.uses = 1;
  events.push(`${state.names[actorId]}用篝火把${sourceName}加工成${itemDef(item.itemId).name}，消耗1份燃料。`);
  return item;
}
