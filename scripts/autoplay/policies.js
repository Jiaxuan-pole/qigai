import { fitBudget, supplyTrip } from './planning.js';
import { applyMechanicPlan, chooseMechanicImmediateCommand } from './mechanics.js';
import { ACTIONS } from '../../public/game/actions.js';

const IDS = ['xuan', 'fan', 'ma'];
const FOOD_IDS = new Set(['meal', 'bread', 'hot_soup']);
const WORK_ACTIONS = new Set(['scavenge', 'kitchen', 'run', 'carry', 'repair']);
const CARE_PRICES = { cleaning_care: 10, bandage: 8, care_course: 24 };
const baseStrategyId = (strategyId) => ['balanced_novice', 'gambler_control'].includes(strategyId) ? 'balanced' : strategyId;

const isCold = (view) => ['cold', 'coldwave', 'storm'].includes(view.weather);
const activeIds = (view) => IDS.filter((id) => view.actors[id].life === 'active');
const livingIds = (view) => IDS.filter((id) => ['active', 'downed'].includes(view.actors[id].life));

function neededCareItem(actor) {
  const disease = actor.diseases.find((candidate) => candidate.known && candidate.kind !== 'chill');
  if (!disease) return null;
  if (disease.kind === 'skin') return 'cleaning_care';
  if (disease.kind === 'wound' && disease.severity < 60) return 'bandage';
  return disease.plan ? 'care_course' : null;
}

function rescueReserve(view) {
  const downed = livingIds(view).filter((id) => view.actors[id].life === 'downed').length;
  return Math.max(0, downed - view.vouchers) * 20;
}

function careReserve(view) {
  let total = 0;
  for (const id of activeIds(view)) {
    const itemId = neededCareItem(view.actors[id]);
    if (itemId && !view.items.some((item) => item.itemId === itemId && item.container === id)) total += CARE_PRICES[itemId];
  }
  return total;
}

function foodReserve(view, fullDay = false) {
  const portions = livingIds(view).length * (fullDay ? 2 : 1);
  return Math.max(0, portions - view.effectiveFood) * 8;
}

const ownedBeds = (view) => view.items.filter(item => ['bed_basic', 'bed_comfort', 'legacy_bed'].includes(item.itemId)).length;
const furnitureMoney = view => rescueReserve(view) + careReserve(view) + foodReserve(view, true)
  + activeIds(view).filter(id => view.actors[id].diseases.some(disease => !disease.known)).length * 18;
const bedForSale = view => ['bed_basic', 'bed_comfort'].find(id => (view.shops.furniture_store?.stock[id] || 0) > 0
  && view.cash - furnitureMoney(view) >= view.prices[id]);

export function chooseFurniturePurchase(view) {
  const shop = view.shops.furniture_store;
  if (!shop?.open || view.slot > 2 || ownedBeds(view) >= livingIds(view).length) return null;
  const itemId = bedForSale(view);
  if (!itemId) return null;
  const buyer = activeIds(view).find(id => view.actors[id].location === 'furniture' && !view.daily.errands[`${id}:${view.hour}`]);
  return buyer ? { kind: 'buy', actorId: buyer, destination: 'camp', cart: [{ shopId: 'furniture_store', itemId, qty: 1 }] } : null;
}

export function chooseFurnitureSetup(view) {
  const actorId = activeIds(view).find(id => view.actors[id].location === 'camp');
  if (!actorId) return null;
  const parcel = view.camp.parcels.find(entry => entry.status === 'sealed' && entry.itemUids.some(uid => view.items.some(item => item.uid === uid && ['bed_basic', 'bed_comfort'].includes(item.itemId))));
  if (parcel) return { kind: 'unpackParcel', actorId, parcelId: parcel.id };
  const placed = new Set(view.camp.placements.map(entry => entry.uid));
  const bed = view.items.find(item => ['bed_basic', 'bed_comfort'].includes(item.itemId) && item.container === 'camp' && !placed.has(item.uid));
  const slot = ['west_1', 'west_2', 'west_3'].find(id => !view.camp.placements.some(entry => entry.slot === id));
  return bed && slot && view.camp.beds < livingIds(view).length ? { kind: 'placeFurniture', actorId, uid: bed.uid, slot, rotation: 0 } : null;
}

export function mechanicReserve(view) {
  return rescueReserve(view) + careReserve(view) + foodReserve(view, true);
}

export function chooseImmediateMechanicCommand(view, strategyId) {
  return chooseMechanicImmediateCommand(view, strategyId, { reserveCash: mechanicReserve(view) });
}

function mealPurchaseQty(view, shortage) {
  const stock = view.shops.convenience.stock.meal || 0;
  const cashAfterRescue = Math.max(0, view.cash - rescueReserve(view));
  const essentialGap = Math.max(0, livingIds(view).length - view.effectiveFood);
  const essential = Math.min(shortage, stock, essentialGap, Math.floor(cashAfterRescue / 8));
  const extraCash = Math.max(0, cashAfterRescue - essential * 8 - careReserve(view));
  const extra = Math.min(shortage - essential, stock - essential, Math.floor(extraCash / 8));
  return essential + extra;
}

function accessible(view, actorId, item) {
  return item.container === actorId || (item.container === 'camp' && view.actors[actorId].location === 'camp');
}

function freshFood(view, item) {
  return FOOD_IDS.has(item.itemId) && (item.expiresDay === null || item.expiresDay >= view.day);
}

function routineAction(view, strategyId, actorId) {
  const actor = view.actors[actorId];
  if (actor.life === 'downed') return { kind: 'assign', actorId, actionId: 'aid' };
  if (actor.life !== 'active') return null;
  if (actor.energy + actor.coffeeCredit < 20) return { kind: 'assign', actorId, actionId: 'sleep', stoppageReason: 'energy' };
  const poor = view.cash < livingIds(view).length * 2 * 8;
  if (strategyId === 'conservative') {
    if (poor && view.slot < 3) {
      if (actorId === 'fan') return { kind: 'assign', actorId, actionId: view.slot === 0 ? 'kitchen' : 'carry' };
      return { kind: 'assign', actorId, actionId: actorId === 'xuan' ? 'scavenge' : 'run' };
    }
    if (view.slot === 3) return { kind: 'assign', actorId, actionId: 'rest' };
    if (actorId === 'fan') return { kind: 'assign', actorId, actionId: view.slot === 0 ? 'kitchen' : 'sketch' };
    if (actorId === 'xuan') return { kind: 'assign', actorId, actionId: view.slot === 1 ? 'rest' : 'scavenge' };
    return { kind: 'assign', actorId, actionId: view.slot === 2 ? 'rest' : 'run' };
  }
  if (strategyId === 'balanced') {
    if (view.day % 2 === 0 && view.slot === 2) return { kind: 'assign', actorId, actionId: 'wash' };
    if (view.slot === 3) return { kind: 'assign', actorId, actionId: actorId === 'ma' ? 'freecards' : 'rest' };
    if (actorId === 'fan') return { kind: 'assign', actorId, actionId: view.slot === 0 ? 'kitchen' : 'carry' };
    if (actorId === 'xuan') return { kind: 'assign', actorId, actionId: view.parts > 0 && view.slot > 0 ? 'repair' : 'scavenge' };
    return { kind: 'assign', actorId, actionId: 'run' };
  }
  if (view.slot === 3) return { kind: 'assign', actorId, actionId: actorId === 'ma' ? 'freecards' : 'rest' };
  if (actorId === 'fan') return { kind: 'assign', actorId, actionId: view.slot === 0 ? 'kitchen' : 'sketch' };
  if (actorId === 'xuan') return { kind: 'assign', actorId, actionId: view.slot === 1 ? 'rest' : 'scavenge' };
  const ticketsToday = view.daily.bets - (view.daily.orders.cards || 0);
  if (view.daily.bets < 2 && ticketsToday === 0 && view.slot >= 1 && view.slot <= 2) {
    return {
      kind: 'assign', actorId, actionId: 'shop',
      opts: { zone: 'station', cart: [{ shopId: 'lottery_kiosk', itemId: 'ticket', qty: 1 }], destination: 'self' },
    };
  }
  return { kind: 'assign', actorId, actionId: view.slot === 2 ? 'rest' : 'run' };
}

function maintenance(view, actorId, strategyId, memory) {
  const actor = view.actors[actorId];
  if (actor.life !== 'active') return null;
  if (actor.warmth < 40 || (view.slot === 3 && isCold(view))) {
    return { command: { kind: 'assign', actorId, actionId: 'warm' }, reason: 'warmth' };
  }
  if (actor.diseases.some((disease) => !disease.known) && view.cash >= 18 && view.slot <= 2) {
    return { command: { kind: 'assign', actorId, actionId: 'clinic' }, reason: 'care' };
  }
  const known = actor.diseases.find((disease) => disease.known);
  if (known?.kind === 'chill') return { command: { kind: 'assign', actorId, actionId: 'warm' }, reason: 'warmth' };
  if (known) {
    const wanted = neededCareItem(actor);
    const item = wanted ? view.items.find((candidate) => candidate.itemId === wanted && candidate.container === actorId) : null;
    if (item) {
      return {
        command: { kind: 'assign', actorId, actionId: 'rest', care: { diseaseUid: known.uid, itemUid: item.uid } },
        reason: 'care',
      };
    }
    if (known.severity >= 85) return { command: { kind: 'assign', actorId, actionId: 'rest' }, reason: 'care' };
  }
  if (actor.health <= (strategyId === 'conservative' ? 40 : 25)) {
    return { command: { kind: 'assign', actorId, actionId: 'rest' }, reason: 'care' };
  }
  const hygieneFloor = strategyId === 'conservative' ? 42 : strategyId === 'balanced' ? 30 : 18;
  if (actor.hygiene <= hygieneFloor) return { command: { kind: 'assign', actorId, actionId: 'wash' }, reason: 'care' };
  if (actor.energy + actor.coffeeCredit < 20) {
    return { command: { kind: 'assign', actorId, actionId: 'sleep', stoppageReason: 'energy' }, reason: 'care' };
  }
  const recovering = strategyId === 'balanced' ? memory.recovering?.[actorId] : actor.mind < 35;
  if (process.env.SIM_NO_HOBBY !== '1' && recovering && view.slot >= 1) {
    const actionId = actorId === 'xuan' ? 'joke' : actorId === 'fan' ? 'sketch' : 'freecards';
    return { command: { kind: 'assign', actorId, actionId, stoppageReason: 'mind' }, reason: 'hobby' };
  }
  return null;
}

function withReplacement(command, routine, reason) {
  const original = routine?.plannedActionId || routine?.actionId;
  if (!WORK_ACTIONS.has(original)) return { ...command, replacementReason: reason };
  return { ...command, plannedActionId: original, replacementReason: reason };
}

export const STRATEGIES = {
  conservative: { label: '保守', foodPerLiving: 2, foodBuffer: 1 },
  balanced: { label: '均衡', foodPerLiving: 2, foodBuffer: 0 },
  balanced_novice: { label: '均衡新手', foodPerLiving: 2, foodBuffer: 0 },
  gambler_control: { label: '博彩对照', foodPerLiving: 2, foodBuffer: 0 },
  gambler: { label: '赌徒', foodPerLiving: 1, foodBuffer: 0 },
};

export function updateStrategyMemory(view, strategyId, previous = {}) {
  const base = baseStrategyId(strategyId);
  const recovering = { ...(previous.recovering || {}) };
  for (const id of IDS) {
    const actor = view.actors[id];
    if (actor.life !== 'active' || base !== 'balanced') recovering[id] = false;
    else if (actor.mind < 45) recovering[id] = true;
    else if (actor.mind >= 60) recovering[id] = false;
    else recovering[id] = Boolean(recovering[id]);
  }
  return { ...previous, recovering };
}

export function chooseImmediateCommand(view, strategyId) {
  for (const actorId of activeIds(view).sort((a, b) => view.actors[a].food - view.actors[b].food)) {
    const actor = view.actors[actorId];
    if (actor.food > 25) continue;
    const item = view.items
      .filter((candidate) => accessible(view, actorId, candidate) && freshFood(view, candidate))
      .sort((a, b) => (a.expiresDay ?? 999) - (b.expiresDay ?? 999) || (a.container === actorId ? -1 : 1))[0];
    if (item) return { kind: 'use', actorId, uid: item.uid };
  }
  if (baseStrategyId(strategyId) !== 'balanced') return null;
  for (const wish of view.wishes) {
    if (wish.templateId !== 'quiet_smoke') continue;
    const actor = view.actors[wish.actor];
    if (actor?.life !== 'active') continue;
    const cigarette = view.items.find((item) => item.itemId === 'cigarette' && accessible(view, wish.actor, item));
    const lighter = view.items.some((item) => item.itemId === 'lighter' && accessible(view, wish.actor, item));
    if (cigarette && lighter && actor.smokes < 2) return { kind: 'use', actorId: wish.actor, uid: cigarette.uid };
  }
  return null;
}

export function chooseNightSpot(view) {
  const shelter = view.nightSpots.find((spot) => spot.id === 'shelter' && !spot.disabled);
  const exposedRain = ['rain', 'storm'].includes(view.weather) && view.camp.rain < 2;
  const forecastRisk = view.forecast.some((entry) => ['rain', 'storm', 'cold', 'coldwave'].includes(entry.kind));
  if (shelter && (isCold(view) || exposedRain || forecastRisk || view.camp.rain < 2)) return { kind: 'night', spot: 'shelter' };
  return null;
}

export function chooseMorning(view) {
  const choices = view.pendingMorning?.choices || [];
  if (view.day === 18) return choices.find((choice) => choice.id === 'shelter')?.id || choices[0]?.id;
  if (view.day === 85) return choices.find((choice) => choice.id === 'rent')?.id || choices[0]?.id;
  return choices[0]?.id || null;
}

export function chooseCardEvent(view) {
  if (view.daily.bets >= 2 || view.actors.ma.life !== 'active' || view.actors.ma.intox > 0) return null;
  if ((view.daily.orders.cards || 0) > 0 && view.daily.bets - view.daily.orders.cards === 0) return null;
  const event = view.events.find((candidate) => candidate.status === 'open' && candidate.options.includes('join_paid'));
  return event ? { kind: 'event', uid: event.uid, choiceId: 'join_paid', actorId: 'ma' } : null;
}

export function chooseControlCardEvent(view, memory = {}) {
  const card = chooseCardEvent(view);
  if (!card) return null;
  if (view.cash - mechanicReserve(view) < 10) return null;
  const currentMemory = updateStrategyMemory(view, 'balanced', memory);
  const ma = planActions(view, 'balanced', currentMemory).find((command) => command.actorId === 'ma');
  if (!ma || protectedCommand(ma) || ma.reserved) return null;
  return card;
}

export function chooseFoodPurchase(view, strategyId) {
  const base = baseStrategyId(strategyId);
  const strategy = STRATEGIES[base];
  const target = livingIds(view).length * strategy.foodPerLiving + strategy.foodBuffer;
  const shortage = Math.max(0, target - view.effectiveFood);
  const availableCash = Math.max(0, view.cash - rescueReserve(view));
  const qty = mealPurchaseQty(view, shortage);
  const buyer = IDS.find((id) => view.actors[id].life === 'active' && view.actors[id].location === 'market' && !view.daily.errands[`${id}:${view.hour}`]);
  if (qty > 0 && buyer && !view.shops.convenience.closedSlots.includes(view.slot)) {
    return { kind: 'buy', actorId: buyer, destination: 'camp', cart: [{ shopId: 'convenience', itemId: 'meal', qty }] };
  }
  if (base !== 'conservative' || view.slot !== 3) return null;
  const soupBuyer = IDS.find((id) => view.actors[id].life === 'active' && view.actors[id].location === 'station' && !view.daily.errands[`${id}:${view.hour}`]);
  const soupQty = Math.min(shortage, view.shops.tavern.stock.hot_soup || 0, Math.floor(availableCash / 10));
  return soupBuyer && soupQty > 0 && !view.shops.tavern.closedSlots.includes(view.slot)
    ? { kind: 'buy', actorId: soupBuyer, destination: 'camp', cart: [{ shopId: 'tavern', itemId: 'hot_soup', qty: soupQty }] }
    : null;
}

export function chooseCigarettePurchase(view, strategyId) {
  if (baseStrategyId(strategyId) !== 'balanced') return null;
  const wish = view.wishes.find((candidate) => candidate.templateId === 'quiet_smoke' && view.actors[candidate.actor].life === 'active');
  if (!wish || view.items.some((item) => item.itemId === 'cigarette' && item.container === wish.actor)) return null;
  const buyer = wish.actor;
  if (view.actors[buyer].location !== 'market' || view.daily.errands[`${buyer}:${view.hour}`]) return null;
  const hasLighter = view.items.some((item) => item.itemId === 'lighter' && ['camp', buyer].includes(item.container));
  const cost = 12 + (hasLighter ? 0 : 3);
  const reserve = rescueReserve(view) + careReserve(view) + foodReserve(view, true);
  if (view.cash - reserve < cost || (view.shops.convenience.stock.cigarette || 0) < 1) return null;
  const cart = [{ shopId: 'convenience', itemId: 'cigarette', qty: 1 }];
  if (!hasLighter) cart.push({ shopId: 'convenience', itemId: 'lighter', qty: 1 });
  return { kind: 'buy', actorId: buyer, destination: 'self', cart };
}

export function chooseCarePurchase(view, strategyId) {
  if (baseStrategyId(strategyId) === 'gambler') return null;
  for (const actorId of IDS) {
    const actor = view.actors[actorId];
    if (actor.life !== 'active' || actor.location !== 'service' || view.daily.errands[`${actorId}:${view.hour}`]) continue;
    const itemId = neededCareItem(actor);
    if (!itemId || view.items.some((item) => item.itemId === itemId && item.container === actorId)) continue;
    const price = CARE_PRICES[itemId];
    const reserve = rescueReserve(view) + foodReserve(view);
    if (view.cash - reserve < price || (view.shops.pharmacy.stock[itemId] || 0) < 1 || view.shops.pharmacy.closedSlots.includes(view.slot) || view.slot > 2) continue;
    return { kind: 'buy', actorId, destination: 'self', cart: [{ shopId: 'pharmacy', itemId, qty: 1 }] };
  }
  return null;
}

export function choosePreparednessPurchase(view) {
  const missing = activeIds(view).filter((id) => !view.items.some((item) => item.itemId === 'blanket' && item.container === id));
  if (!missing.length || (view.shops.convenience.stock.blanket || 0) < 1) return null;
  const buyer = missing.find((id) => view.actors[id].location === 'market' && !view.daily.errands[`${id}:${view.hour}`]);
  const reserve = rescueReserve(view) + careReserve(view) + foodReserve(view, true);
  if (!buyer || view.cash - reserve < 24 || view.shops.convenience.closedSlots.includes(view.slot)) return null;
  return { kind: 'buy', actorId: buyer, destination: 'self', cart: [{ shopId: 'convenience', itemId: 'blanket', qty: 1 }] };
}

function protectedCommand(command) {
  return ['kitchen', 'clinic', 'warm', 'aid', 'rescue', 'roof', 'soup', 'shop'].includes(command.actionId)
    || command.reserved || command.care || ['care', 'warmth', 'hobby'].includes(command.replacementReason);
}

function replaceForConstruction(commands, view) {
  if (commands.some((command) => command.actionId === 'roof')) return commands;
  const candidates = commands.filter((command) => !protectedCommand(command) && view.actors[command.actorId].energy >= 14)
    .sort((a, b) => Number(WORK_ACTIONS.has(a.actionId)) - Number(WORK_ACTIONS.has(b.actionId)));
  const reserves = rescueReserve(view) + careReserve(view) + foodReserve(view);
  if (view.camp.rain < 2 && view.cash >= 12 + reserves && view.wood >= 2 && view.cloth >= 2 && candidates.length >= 2) {
    const selected = candidates.slice(0, 2);
    const participants = selected.map((command) => command.actorId);
    const plannedActionIds = Object.fromEntries(selected.map((command) => [command.actorId, command.actionId]));
    const excluded = new Set(participants);
    return [
      ...commands.filter((command) => !excluded.has(command.actorId)),
      { kind: 'assign', actorId: participants[0], actionId: 'roof', opts: { participants }, plannedActionIds, replacementReason: 'shopping' },
    ];
  }
  return commands;
}

function replaceForSoup(commands, view, strategyId) {
  const poor = view.cash < livingIds(view).length * 2 * 8;
  const shortage = Math.max(0, livingIds(view).length - view.effectiveFood);
  if (strategyId !== 'conservative' || !poor || ![0, 3].includes(view.slot) || shortage <= 0) return commands;
  const candidates = commands.filter((command) => !protectedCommand(command) || (command.replacementReason === 'hobby' && !command.reserved))
    .sort((a, b) => Number(WORK_ACTIONS.has(a.actionId)) - Number(WORK_ACTIONS.has(b.actionId)))
    .slice(0, Math.max(0, Math.min(2 - (view.daily.orders.soup || 0), shortage)));
  const chosen = new Set(candidates.map((command) => command.actorId));
  return commands.map((command) => {
    if (!chosen.has(command.actorId)) return command;
    const soup = { kind: 'assign', actorId: command.actorId, actionId: 'soup' };
    return withReplacement(soup, command, 'shopping');
  });
}

export function planActions(view, strategyId, memory = {}) {
  const base = baseStrategyId(strategyId);
  let commands = [];
  let maintenanceCash = Math.max(0, view.cash - rescueReserve(view) - foodReserve(view));
  for (const actorId of IDS) {
    const routine = routineAction(view, base, actorId);
    if (!routine) continue;
    if (view.actors[actorId].life === 'downed') {
      commands.push(routine);
      continue;
    }
    const upkeep = maintenance(view, actorId, base, memory);
    if (upkeep?.command.actionId === 'clinic') {
      if (maintenanceCash >= 18) maintenanceCash -= 18;
      else {
        commands.push(routine);
        continue;
      }
    }
    commands.push({ ...(upkeep ? withReplacement(upkeep.command, routine, upkeep.reason) : routine), reserved: Boolean(view.plan[actorId][view.phase === 'tail' ? view.hour - 22 : view.hour - 6]?.eventUid) });
  }
  commands = replaceForSoup(commands, view, base);
  if (view.effectiveFood >= livingIds(view).length) commands = replaceForConstruction(commands, view);
  const strategy = STRATEGIES[base];
  const shortage = Math.max(0, livingIds(view).length * strategy.foodPerLiving + strategy.foodBuffer - view.effectiveFood);
  const qty = mealPurchaseQty(view, shortage);
  if (qty <= 0 || !view.shops.convenience.open) return finishPlan(commands, view, strategyId);
  const shopper = ['xuan', 'ma', 'fan'].map((id) => commands.find((command) => command.actorId === id))
    .find((command) => command && !protectedCommand(command) && view.actors[command.actorId].energy >= 6);
  if (!shopper) return finishPlan(commands, view, strategyId);
  const shopping = {
    kind: 'assign', actorId: shopper.actorId, actionId: 'shop',
    opts: { zone: 'market', cart: [{ shopId: 'convenience', itemId: 'meal', qty }], destination: 'camp' },
  };
  if (WORK_ACTIONS.has(shopper.actionId)) {
    shopping.plannedActionId = shopper.actionId;
    shopping.replacementReason = 'shopping';
  }
  return finishPlan(commands.map((command) => command.actorId === shopper.actorId ? shopping : command), view, strategyId);
}

function finishPlan(commands, view, strategyId) {
  const base = baseStrategyId(strategyId);
  const protectedPlan = replaceForConstruction(commands, view);
  const suppliedPlan = supplyTrip(view, protectedPlan, base, protectedCommand);
  const mechanicPlan = applyMechanicPlan(view, strategyId, suppliedPlan, protectedCommand);
  const furniture = view.shops.furniture_store;
  const buyer = mechanicPlan.find(command => !protectedCommand(command) && view.actors[command.actorId].energy >= 6);
  const needsBed = ownedBeds(view) < livingIds(view).length;
  const itemId = bedForSale(view);
  const shopPlan = buyer && needsBed && itemId && furniture?.open
    ? mechanicPlan.map(command => command === buyer ? withReplacement({ kind: 'assign', actorId: buyer.actorId, actionId: 'shop', reservedCash: furnitureMoney(view), opts: { zone: 'furniture', cart: [{ shopId: 'furniture_store', itemId, qty: 1 }], destination: 'camp' } }, buyer, 'shopping') : command)
    : mechanicPlan;
  const candidate = replaceForControlTicket(shopPlan, view, strategyId);
  const available = candidate.map((command) => {
    const action = ACTIONS[command.actionId];
    const actor = view.actors[command.actorId];
    if (!action || actor.life !== 'active') return command;
    const used = view.daily.orders[command.actionId] || 0;
    const exhausted = action.limit && used >= action.limit;
    const tired = action.energy > actor.energy + actor.coffeeCredit;
    const closed = action.allowed && !action.allowed.includes(view.slot);
    if (!exhausted && !tired && !closed) return command;
    if (exhausted && action.work) {
      const alternatives = command.actorId === 'fan' ? ['carry', 'scavenge']
        : command.actorId === 'ma' ? ['run', 'carry', 'scavenge'] : ['repair', 'scavenge', 'carry'];
      const next = alternatives.find((id) => id !== command.actionId && (view.daily.orders[id] || 0) < (ACTIONS[id].limit || Infinity)
        && ACTIONS[id].energy <= actor.energy + actor.coffeeCredit
        && (!ACTIONS[id].who || ACTIONS[id].who === 'any' || ACTIONS[id].who === command.actorId)
        && (!ACTIONS[id].cost?.parts || view.parts >= ACTIONS[id].cost.parts));
      if (next) return { kind: 'assign', actorId: command.actorId, actionId: next, plannedActionId: command.actionId, replacementReason: 'care' };
    }
    return { kind: 'assign', actorId: command.actorId, actionId: 'sleep', plannedActionId: command.plannedActionId || command.actionId, replacementReason: 'care', stoppageReason: exhausted ? 'jobLimit' : 'energy' };
  });
  const counts = { ...view.daily.orders };
  const limited = available.map((command) => {
    const action = ACTIONS[command.actionId];
    if (!action?.limit) return command;
    if ((counts[command.actionId] || 0) >= action.limit) {
      return { kind: 'assign', actorId: command.actorId, actionId: 'sleep', plannedActionId: command.plannedActionId || command.actionId, replacementReason: 'care', stoppageReason: 'jobLimit' };
    }
    counts[command.actionId] = (counts[command.actionId] || 0) + 1;
    return command;
  });
  return fitBudget(view, limited);
}

function replaceForControlTicket(commands, view, strategyId) {
  if (strategyId !== 'gambler_control' || view.slot < 1 || view.slot > 2) return commands;
  const ticketsToday = view.daily.bets - (view.daily.orders.cards || 0);
  const kiosk = view.shops.lottery_kiosk;
  if (view.daily.bets >= 2 || ticketsToday > 0 || view.actors.ma.life !== 'active' || view.actors.ma.intox > 0) return commands;
  if (!kiosk?.open || (kiosk.stock.ticket || 0) < 1) return commands;
  if (view.cash - mechanicReserve(view) < (view.prices.ticket || 10)) return commands;
  const current = commands.find((command) => command.actorId === 'ma');
  if (!current || protectedCommand(current) || current.reserved) return commands;
  const ticket = {
    kind: 'assign', actorId: 'ma', actionId: 'shop',
    opts: { zone: 'station', cart: [{ shopId: 'lottery_kiosk', itemId: 'ticket', qty: 1 }], destination: 'self' },
    plannedActionId: current.plannedActionId || current.actionId,
    replacementReason: 'gambling',
    mechanism: 'ticket',
  };
  return commands.map((command) => command === current ? ticket : command);
}
