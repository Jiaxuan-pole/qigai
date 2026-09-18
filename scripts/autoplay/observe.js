import { forecast } from '../../public/game/story.js';
import { nightSpotOptions, binsAvailable, salvageOptions, favorStatus } from '../../public/game/engine.js';
import { getData } from '../../public/game/data.js';
import { shopClosedReason, shopDef } from '../../public/game/shop.js';
import { EXTRA_ITEMS } from '../../public/game/items.js';
import { canRepair } from '../../public/game/salvage.js';
import { FAVORS } from '../../public/game/favors.js';
import { REGULARS } from '../../public/game/npcs.js';
import { TYPES } from '../../public/game/beg.js';

const EVENT_OPTIONS = {
  '雨棚下的牌桌': ['observe', 'join_paid', 'leave'],
};

function actorView(actor) {
  return {
    health: actor.health,
    food: actor.food,
    energy: actor.energy,
    coffeeCredit: actor.coffeeCredit || 0,
    warmth: actor.warmth,
    mind: actor.mind,
    hygiene: actor.hygiene,
    life: actor.life,
    location: actor.location,
    deadline: actor.deadline,
    intox: actor.intox,
    smokes: actor.smokes,
    crisis: actor.crisis,
    clothes: { dirty: actor.clothes.dirty, wet: actor.clothes.wet },
    diseases: actor.diseases.map((disease) => ({
      uid: disease.uid,
      known: disease.known,
      plan: disease.plan,
      severity: disease.severity,
      kind: disease.known ? disease.kind : null,
    })),
  };
}

function itemView(item, state) {
  const view = {
    uid: item.uid,
    itemId: item.itemId,
    container: item.container,
    uses: item.uses,
    wet: item.wet,
    dirty: item.dirty,
    expiresDay: item.expiresDay,
    kept: Boolean(item.kept),
  };
  if (item.ticket) {
    view.ticket = {
      scratched: Boolean(item.ticket.scratched),
      claimed: Boolean(item.ticket.claimed),
    };
  }
  if (item.itemId.startsWith('broken_')) {
    const repair = canRepair(state, item.uid, 'xuan');
    view.repairable = repair.ok;
    view.repairReason = repair.reason || null;
  }
  if (['phone', 'radio', 'headphones', 'tv'].includes(item.itemId)) view.salvageOptions = salvageOptions(state, item.uid).options;
  return view;
}

function favorViews(state) {
  // favorStatus 会懒初始化记录；观察不能把一次读取写回存档。
  const detached = { ...state, favors: structuredClone(state.favors || {}) };
  return Object.fromEntries(Object.keys(FAVORS).map((npcId) => {
    const status = favorStatus(detached, npcId);
    const district = REGULARS.find((regular) => regular.id === npcId).district;
    const available = status.step && !status.active && status.rec.cooldownUntil <= state.day
      && (state.relations[npcId]?.trust || 0) >= status.step.trustMin;
    return [npcId, {
      step: status.step ? structuredClone(status.step) : null,
      active: status.active ? structuredClone(status.active) : null,
      deadline: status.active?.deadline ?? null,
      cooldownUntil: status.rec.cooldownUntil,
      finished: status.finished,
      district,
      eligibleActorIds: available ? Object.entries(state.actors).filter(([, actor]) => actor.life === 'active' && actor.location === district).map(([id]) => id) : [],
    }];
  }));
}

function eventView(event) {
  return {
    uid: event.uid,
    title: event.title,
    setup: event.setup,
    district: event.district,
    status: event.status,
    expiresTurn: event.expiresTurn,
    cast: event.cast ? [...event.cast] : null,
    reserved: event.reserved ? structuredClone(event.reserved) : null,
    options: EVENT_OPTIONS[event.title] ? [...EVENT_OPTIONS[event.title]] : [],
  };
}

function pendingNpcView(npc) {
  return {
    id: npc.id,
    name: npc.name,
    job: npc.job,
    hint: TYPES[npc.type]?.hint || '',
    patience: npc.patience,
    stage: npc.stage,
    log: [...(npc.log || [])],
    revealed: npc.revealed,
    result: npc.result ? structuredClone(npc.result) : null,
  };
}

function pendingCellView(cell, index) {
  const visible = { index, revealed: cell.revealed, warned: cell.warned };
  if (!cell.revealed) return visible;
  visible.kind = cell.kind;
  if (cell.loot) visible.loot = structuredClone(cell.loot);
  return visible;
}

function pendingView(state) {
  return {
    beg: state.pending.beg.map((session) => ({
      actorId: session.actorId,
      district: session.district,
      slot: session.slot,
      style: session.style,
      done: session.done,
      npcs: session.npcs.map(pendingNpcView),
    })),
    bins: state.pending.bins.map((board) => ({
      binId: board.binId,
      actorId: board.actorId,
      name: board.name,
      size: board.size,
      digsLeft: board.digsLeft,
      dirtHits: board.dirtHits,
      done: board.done,
      cells: board.cells.map(pendingCellView),
    })),
  };
}

export function observeState(state) {
  return {
    day: state.day,
    hour: state.hour,
    hourTick: state.hourTick,
    actionCount: state.actionCount,
    slot: state.slot,
    turn: state.turn,
    phase: state.phase,
    cash: state.cash,
    prices: Object.fromEntries([...getData().items, ...Object.values(EXTRA_ITEMS)].map((item) => [item.id, item.price])),
    parts: state.parts,
    battery: state.battery,
    wood: state.wood,
    cloth: state.cloth,
    bottles: state.bottles || 0,
    cardboard: state.cardboard || 0,
    vouchers: state.vouchers,
    effectiveFood: state.effectiveFood,
    weather: state.weatherKind,
    forecast: forecast(state.seed, state.day),
    camp: structuredClone(state.camp),
    actors: Object.fromEntries(Object.entries(state.actors).map(([id, actor]) => [id, actorView(actor)])),
    items: state.items.filter((item) => !item.container.startsWith('relic:')).map((item) => itemView(item, state)),
    flags: { cooldown: { ...state.flags.cooldown }, binSkill: { ...state.flags.binSkill } },
    gloves: Object.fromEntries(Object.keys(state.actors).map((id) => [id, state.items.some((item) => item.itemId === 'gloves' && item.container === id)])),
    binsAvailable: Object.fromEntries(['market', 'station', 'recycle'].map((zone) => [zone, binsAvailable(state, zone)])),
    favorStatus: favorViews(state),
    relations: Object.fromEntries(Object.keys(FAVORS).map((id) => [id, { trust: state.relations[id]?.trust || 0 }])),
    events: state.events.filter((event) => ['open', 'reserved'].includes(event.status)).map(eventView),
    wishes: state.wishes.filter((wish) => wish.status === 'active' && wish.revealed).map((wish) => ({
      uid: wish.uid,
      actor: wish.actor,
      templateId: wish.templateId,
      category: wish.category,
      intensity: wish.intensity,
      response: wish.response,
    })),
    nightSpots: nightSpotOptions(state).map((spot) => ({ ...spot })),
    daily: {
      bets: state.daily.bets,
      orders: structuredClone(state.daily.orders),
      errands: structuredClone(state.daily.errands),
      bins: { ...state.daily.bins },
    },
    shops: Object.fromEntries(Object.entries(state.shops).map(([id, shop]) => [id, {
      district: shopDef(id).district,
      open: !shopClosedReason(state, id, state.slot),
      stock: structuredClone(shop.stock),
      soldOut: structuredClone(shop.soldOut),
      closedSlots: [...shop.closedSlots],
    }])),
    plan: Object.fromEntries(Object.entries(state.plan).map(([id, slots]) => [id, slots.map((task) => task ? { id: task.id, zone: task.zone, eventUid: task.eventUid } : null)])),
    pendingMorning: state.pendingMorning ? {
      title: state.pendingMorning.title,
      text: state.pendingMorning.text,
      choices: state.pendingMorning.choices.map((choice) => ({ id: choice.id, label: choice.label })),
    } : null,
    pending: pendingView(state),
  };
}
