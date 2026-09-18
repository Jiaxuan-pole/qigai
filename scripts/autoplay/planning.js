const WORK = new Set(['scavenge', 'kitchen', 'run', 'carry', 'repair']);
const CASH = { clinic: 18, roof: 12, rescue: 12 };
const living = (view) => Object.values(view.actors).filter((actor) => ['active', 'downed'].includes(actor.life)).length;
const cartCost = (view, command) => (command.opts?.cart || []).reduce((sum, line) => sum + view.prices[line.itemId] * line.qty, 0);

function fallback(command, view) {
  return (command.opts?.participants || [command.actorId]).map((actorId) => {
    const original = command.plannedActionIds?.[actorId] || command.plannedActionId;
    return { kind: 'assign', actorId, actionId: view.actors[actorId].life === 'downed' ? 'wait' : WORK.has(original) ? original : 'rest' };
  });
}

export function fitBudget(view, commands) {
  let cash = view.cash;
  let vouchers = view.vouchers;
  let parts = view.parts;
  let wood = view.wood;
  let cloth = view.cloth;
  const foodMoney = Math.max(0, living(view) * 2 - view.effectiveFood) * 8;
  const priority = (command) => command.actionId === 'aid' ? 0
    : command.opts?.cart?.some((line) => line.itemId === 'meal') ? 1
      : command.actionId === 'clinic' ? 2
        : command.opts?.cart?.some((line) => line.itemId === 'ticket') ? 5 : 3;
  const results = new Map();
  for (const command of [...commands].sort((a, b) => priority(a) - priority(b))) {
    let adjusted = command;
    let cost = (CASH[command.actionId] || 0) + cartCost(view, command);
    if (command.actionId === 'aid') cost = vouchers > 0 ? 0 : 20;
    const timber = (command.actionId === 'roof' ? 2 : 0) + (command.resourceCost?.wood || 0);
    const fabric = (command.actionId === 'roof' ? 2 : 0) + (command.resourceCost?.cloth || 0);
    const part = (command.actionId === 'repair' ? 1 : 0) + (command.resourceCost?.parts || 0);
    const ticket = command.opts?.cart?.some((line) => line.itemId === 'ticket');
    const available = Math.max(0, cash - Math.max(ticket ? foodMoney : 0, command.reservedCash || 0));
    const cart = command.opts?.cart;
    if (cost > available && cart?.length === 1 && cart[0].itemId === 'meal') {
      const qty = Math.floor(available / view.prices.meal);
      if (qty > 0) {
        adjusted = { ...command, opts: { ...command.opts, cart: [{ ...cart[0], qty }] } };
        cost = qty * view.prices.meal;
      }
    }
    if (cost > available || parts < part || wood < timber || cloth < fabric) {
      results.set(command, fallback(command, view));
      continue;
    }
    cash -= cost;
    parts -= part;
    wood -= timber;
    cloth -= fabric;
    if (command.actionId === 'aid' && vouchers > 0) vouchers--;
    results.set(command, [adjusted]);
  }
  return commands.flatMap((command) => results.get(command));
}

export function supplyTrip(view, commands, strategyId, protectedCommand) {
  if (!view.shops.convenience.open) return commands;
  const missing = (actorId, itemId) => !view.items.some((item) => item.itemId === itemId && item.container === actorId);
  const candidates = commands.filter((command) => !protectedCommand(command) && view.actors[command.actorId].energy >= 8)
    .sort((a, b) => Number(WORK.has(a.actionId)) - Number(WORK.has(b.actionId)));
  const reservedCash = commands.reduce((sum, command) => sum + (CASH[command.actionId] || 0) + cartCost(view, command), 0)
    + Math.max(0, Object.values(view.actors).filter((actor) => actor.life === 'downed').length - view.vouchers) * 20;
  const foodMoney = Math.max(0, living(view) * 2 - view.effectiveFood) * 8;
  let cart;
  let buyer;
  if ((view.shops.convenience.stock.blanket || 0) > 0 && view.cash - reservedCash - foodMoney >= 24) {
    buyer = candidates.find((command) => missing(command.actorId, 'blanket'));
    if (buyer) cart = [{ shopId: 'convenience', itemId: 'blanket', qty: 1 }];
  }
  if (!buyer && strategyId === 'balanced') {
    buyer = candidates.find((command) => missing(command.actorId, 'cigarette') && view.wishes.some((wish) => wish.actor === command.actorId && wish.templateId === 'quiet_smoke'));
    if (buyer && (view.shops.convenience.stock.cigarette || 0) > 0) {
      cart = [{ shopId: 'convenience', itemId: 'cigarette', qty: 1 }];
      if (!view.items.some((item) => item.itemId === 'lighter' && ['camp', buyer.actorId].includes(item.container))) cart.push({ shopId: 'convenience', itemId: 'lighter', qty: 1 });
      if (view.cash - reservedCash - foodMoney < cartCost(view, { opts: { cart } })) cart = null;
    }
  }
  if (!buyer || !cart) return commands;
  const replacement = { kind: 'assign', actorId: buyer.actorId, actionId: 'shop', opts: { zone: 'market', cart, destination: 'self' }, replacementReason: 'shopping' };
  if (WORK.has(buyer.actionId)) replacement.plannedActionId = buyer.actionId;
  return commands.map((command) => command === buyer ? replacement : command);
}
