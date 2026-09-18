import { OPENINGS, TYPES } from '../../public/game/beg.js';
import { FOOD_VALUE } from '../../public/game/items.js';

const SUPPORTED_STRATEGIES = new Set(['conservative', 'balanced', 'gambler', 'balanced_novice', 'gambler_control']);
const FOOD_IDS = new Set(['meal', 'bread', 'hot_soup']);
const IDS = ['xuan', 'fan', 'ma'];
const REPAIR_PARTS = { broken_phone: 1, broken_radio: 1, broken_headphones: 1, broken_tv: 2 };

function freshFoodCount(view) {
  const total = view.items.filter((item) => FOOD_IDS.has(item.itemId)
    && (item.expiresDay === null || item.expiresDay >= view.day))
    .reduce((sum, item) => sum + FOOD_VALUE[item.itemId], 0);
  return Math.floor(total / 30);
}

function livingCount(view) {
  return Object.values(view.actors).filter((actor) => ['active', 'downed'].includes(actor.life)).length;
}

const usesBalancedMechanics = (strategyId) => ['balanced', 'balanced_novice', 'gambler_control'].includes(strategyId);

function chooseBeg(view, novice) {
  const sessionIndex = view.pending.beg.findIndex((session) => !session.done);
  if (sessionIndex < 0) return null;
  const session = view.pending.beg[sessionIndex];
  const npc = session.npcs.find((candidate) => {
    if (candidate.stage === 'done') return false;
    const type = Object.values(TYPES).find((entry) => entry.hint === candidate.hint);
    return candidate.stage !== 'open' || !type?.hygieneGate
      || view.actors[session.actorId]?.hygiene >= type.hygieneGate;
  });
  if (!npc) return { kind: 'begStep', sessionIndex, npcId: null, step: 'finish' };
  if (npc.stage === 'ask') {
    const value = !novice && freshFoodCount(view) < livingCount(view) ? 'food' : 'cash';
    return { kind: 'begStep', sessionIndex, npcId: npc.id, step: 'ask', value };
  }
  if (npc.stage !== 'open') return null;
  const type = Object.values(TYPES).find((candidate) => candidate.hint === npc.hint);
  if (!type) return null;
  if (novice) return { kind: 'begStep', sessionIndex, npcId: npc.id, step: 'open', value: 'special' };
  const value = type.likes.includes(session.actorId)
    ? 'special' : type.likes.find((candidate) => candidate in OPENINGS);
  return value ? { kind: 'begStep', sessionIndex, npcId: npc.id, step: 'open', value } : null;
}

function chooseBin(view) {
  const boardIndex = view.pending.bins.findIndex((board) => !board.done);
  if (boardIndex < 0) return null;
  const board = view.pending.bins[boardIndex];
  if (view.actors[board.actorId]?.hygiene < 35 || board.dirtHits >= 2) {
    return { kind: 'binForfeit', boardIndex };
  }
  const cell = board.cells.find((candidate) => !candidate.revealed && !candidate.warned);
  return cell
    ? { kind: 'binReveal', boardIndex, cellIndex: cell.index }
    : { kind: 'binForfeit', boardIndex };
}

export function choosePendingCommand(view, strategyId, options = {}) {
  const novice = strategyId === 'balanced_novice' || options.novice === true;
  if (!SUPPORTED_STRATEGIES.has(strategyId) && !novice) return null;
  if (!view.pending) return null;
  return chooseBeg(view, novice) || chooseBin(view);
}

function enabledOption(item, id) {
  return item.salvageOptions?.some((option) => option.id === id && option.enabled);
}

function chooseGloves(view, reserveCash) {
  const actor = view.actors.xuan;
  const shop = view.shops.art_hardware;
  if (actor?.life !== 'active' || actor.location !== 'cinema' || view.gloves?.xuan || view.daily.errands[`xuan:${view.hour}`]) return null;
  if (!shop?.open || (shop.stock.gloves || 0) < 1 || view.cash - reserveCash < (view.prices.gloves || 8)) return null;
  return {
    kind: 'buy', actorId: 'xuan', destination: 'self',
    cart: [{ shopId: 'art_hardware', itemId: 'gloves', qty: 1 }],
  };
}

function chooseFavor(view) {
  for (const [npcId, stepId, actionId] of [['reg_liu', 'liu1', 'kitchen'], ['reg_chen', 'chen1', 'run']]) {
    const status = view.favorStatus?.[npcId];
    if (!status || status.finished || status.active || status.cooldownUntil > view.day) continue;
    if (status.step?.id !== stepId || status.step.kind !== 'count' || !status.step.actions?.includes(actionId)) continue;
    const actorId = status.eligibleActorIds?.find((id) => view.actors[id]?.life === 'active');
    if (actorId) return { kind: 'acceptFavor', npcId, actorId };
  }
  return null;
}

function chooseSalvage(view) {
  const hasKeptRadio = view.items.some((item) => item.itemId === 'radio' && item.kept);
  if (!hasKeptRadio) {
    const radio = view.items.find((item) => item.itemId === 'radio' && !item.kept && enabledOption(item, 'keep'));
    if (radio && view.actors[radio.container]) {
      return { kind: 'salvageDispose', uid: radio.uid, choice: 'keep', opts: { actorId: radio.container } };
    }
  }
  const sale = view.items.find((item) => !item.kept && enabledOption(item, 'sell') && view.actors[item.container]);
  return sale
    ? { kind: 'salvageDispose', uid: sale.uid, choice: 'sell', opts: { actorId: sale.container } }
    : null;
}

function chooseBottleSale(view) {
  if (!(view.bottles > 0) || !view.shops.recycle_shop?.open) return null;
  const actorId = IDS.find((id) => view.actors[id]?.life === 'active' && view.actors[id].location === 'recycle');
  return actorId ? { kind: 'sellBottles', actorId } : null;
}

function chooseCampTransfer(view) {
  if (view.actors.xuan?.life !== 'active' || view.actors.xuan.location !== 'camp') return null;
  const item = view.items.find((candidate) => candidate.container === 'camp'
    && ['phone', 'radio', 'headphones', 'tv'].includes(candidate.itemId) && !candidate.kept);
  return item ? { kind: 'transferItem', actorId: 'xuan', uid: item.uid, to: 'xuan' } : null;
}

export function chooseMechanicImmediateCommand(view, strategyId, options = {}) {
  if (!usesBalancedMechanics(strategyId)) return null;
  const reserveCash = options.reserveCash ?? view.mechanicReserve ?? view.cash;
  return chooseGloves(view, reserveCash)
    || chooseFavor(view)
    || chooseSalvage(view)
    || chooseCampTransfer(view)
    || chooseBottleSale(view);
}

function replacement(command, actionId, opts, mechanism, resourceCost) {
  return {
    kind: 'assign', actorId: command.actorId, actionId,
    ...(opts ? { opts } : {}),
    plannedActionId: command.plannedActionId || command.actionId,
    replacementReason: 'mechanics',
    mechanism,
    ...(resourceCost ? { resourceCost } : {}),
  };
}

function canReplace(command, protectedCommand) {
  return command && !protectedCommand(command) && !command.reserved;
}

function availableBinZone(view) {
  return ['recycle', 'station', 'market'].find((zone) => view.binsAvailable?.[zone]?.some((bin) => !bin.used)) || null;
}

function planXuan(view, command, protectedCommand) {
  if (!canReplace(command, protectedCommand) || view.actors.xuan?.life !== 'active') return command;
  const repairable = view.items
    .filter((item) => item.repairable && REPAIR_PARTS[item.itemId])
    .sort((a, b) => Number(b.itemId === 'broken_tv') - Number(a.itemId === 'broken_tv'))[0];
  if (repairable) {
    const zone = repairable.container === 'camp' || repairable.itemId === 'broken_tv' ? 'camp' : 'recycle';
    return replacement(command, 'repair_item', { zone }, 'salvage', { parts: REPAIR_PARTS[repairable.itemId] });
  }
  const campTv = view.items.some((item) => item.itemId === 'broken_tv' && item.container === 'camp');
  const facilities = view.camp?.facilities || [];
  const facilitySlot = facilities.findIndex((facility) => facility == null);
  if (campTv && !facilities.includes('repair_table') && facilitySlot >= 0 && view.parts >= 1 && view.wood >= 2) {
    return replacement(command, 'facility', { facility: { kind: 'repair_table', slot: facilitySlot } }, 'facility', { parts: 1, wood: 2 });
  }
  const binZone = availableBinZone(view);
  if (view.slot <= 1 && view.actors.xuan.hygiene >= 50 && !(view.daily.orders.bins > 0) && binZone) {
    return replacement(command, 'bins', { zone: binZone }, 'bins');
  }
  const cooldown = view.flags?.cooldown?.phonestall || 0;
  if (cooldown <= view.day && !(view.daily.orders.phonestall > 0)) {
    return replacement(command, 'phonestall', null, 'phonestall');
  }
  return command;
}

function planMa(view, command, protectedCommand) {
  if (!canReplace(command, protectedCommand) || view.actors.ma?.life !== 'active') return command;
  if (view.slot === 1 && view.cash < livingCount(view) * 16 && !(view.daily.orders.beg > 0)) {
    return replacement(command, 'beg', { zone: 'station', style: 'ask' }, 'beg');
  }
  const cooldown = view.flags?.cooldown?.shellgame || 0;
  if (cooldown <= view.day && !(view.daily.orders.shellgame > 0)) {
    return replacement(command, 'shellgame', null, 'shellgame');
  }
  return command;
}

export function applyMechanicPlan(view, strategyId, commands, protectedCommand) {
  if (!usesBalancedMechanics(strategyId)) return commands;
  return commands.map((command) => {
    if (command.actorId === 'xuan') return planXuan(view, command, protectedCommand);
    if (command.actorId === 'ma') return planMa(view, command, protectedCommand);
    return command;
  });
}
