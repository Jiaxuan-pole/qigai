import { hasDiningTable } from './furniture.js';

export function awardTableMeal(state, actorId, zone, events = []) {
  if (zone !== 'camp' || !hasDiningTable(state)) return false;
  const meals = state.daily.tableMeals || (state.daily.tableMeals = { xuan: 0, fan: 0, ma: 0 });
  if ((meals[actorId] || 0) >= 2) return false;
  meals[actorId] = (meals[actorId] || 0) + 1;
  state.actors[actorId].mind = Math.min(100, state.actors[actorId].mind + 2);
  events.push(actorId + '在营地餐桌吃饭，精神+2。');
  return true;
}
