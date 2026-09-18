// 引擎入口：状态构造、排程、预检、即时操作。回合结算在 settle.js。
// state.turn 是已完成回合数；正在结算的回合 T = turn + 1；slot 是当前规划时段 0..3。
import { getData, indexById } from './data.js';
import { rng } from './rng.js';
import { clamp, foodReserve } from './rules.js';
import { ACTIONS, BEG_ZONES, BINS_ZONES, OUT_ZONES, REPAIR_ZONES } from './actions.js';
import { makeItem, accessibleItems, consumeUse, effectiveFood, findItem, FOOD_VALUE, isFood, foodFresh, itemDef } from './items.js';
import { freshStock, validateCart, executeCart, shopClosedReason, shopDef, shopsInDistrict } from './shop.js';
import { fulfillWish, activeWishes, respondWish } from './wishes.js';
import { fulfillItemWish, fulfillReachedItemWishes } from './item-wishes.js';
import { careMatches } from './health.js';
import { passersby, binsAvailable, chatWith } from './npcs.js';
import { directorTick, chooseEvent, releaseEvent } from './events.js';
import { weatherOf, morningNode, applyMorningChoice, computeEnding } from './story.js';
import { chooseOpening as begOpening, ask as begAsk, finishSession as begFinish, autoResolve as begAuto } from './beg.js';
import { acceptFavor as favAccept, deliverFavor as favDeliver, favorStatus, activeFavors } from './favors.js';
import { revealCell, forfeit, boardSummary } from './bins.js';
import { disposeOptions, dispose, giftTargets } from './salvage.js';
import { canBorrow, borrow, returnLoan, extendLoan, LOANS } from './loans.js';
import { uninstall as campUninstall, campReport, FACILITIES, fuelCount, canInstall } from './camp.js';
import { generateFace } from './tickets.js';
import { newSession as cardSession, startHand as cardStartHand, act as cardAct, runAI as cardRunAI, BUY_IN as CARD_BUY_IN } from './cards.js';
import { FISHING_SKILL_DEFAULT, autoResolveFishingQte } from './fishing.js';
import { killActor } from './death.js';
import { COFFEE_IDS, coffeeQuote } from './coffee-rules.js';
import { openCasino, casinoAct, nextCasinoRound, closeCasino } from './casino.js';
import { casinoAmounts } from './casino-replay.js';
import { blackjackLegalActions, blackjackAct, blackjackLocalDecision, newBlackjackSession, startBlackjackHand } from './blackjack.js';
import { startWorkGame, finishWorkGame } from './work-games.js';
import { beginDayReport, recordAutomaticWork } from './day-report.js';
import { awardTableMeal } from './furniture-effects.js';
import { isFurniture } from './furniture.js';
export { unpackParcel, placeFurniture, moveFurniture, rotateFurniture, storeFurniture } from './furniture.js';
export { killActor };
import { DAY_START_HOUR, DAY_END_HOUR, slotOfHour, planIndex, currentTask } from './clock.js';
export { DAY_START_HOUR, DAY_END_HOUR, slotOfHour, planIndex, currentTask };

export const IDS = ['xuan', 'fan', 'ma'];
export const NAMES = { xuan: '轩哥', fan: '凡哥', ma: '马哥' };
export const SLOTS = ['清晨', '日间', '午后', '晚间'];
export const copy = (s) => JSON.parse(JSON.stringify(s));
const pendingWorkError = (s) => s.pending?.workGames?.length ? { state: s, error: '先完成手头小游戏' } : null;

function finishImmediateIncome(input, state, actorId, controlledActorId, variant, sourceUid, label) {
  const basePay = state.cash - input.cash;
  if (controlledActorId !== actorId) {
    recordAutomaticWork(state, { actorId, controlledActorId: null, source: 'sale', sourceUid, label, hour: state.hour, income: basePay });
    return { state };
  }
  const opened = startWorkGame(state, { actorId, controllerId: controlledActorId, source: 'sale', sourceUid, basePay, variant });
  return opened.error ? { state: input, error: opened.error } : { state: opened.state, gameId: opened.gameId };
}

function actorFrom(init, life, id) {
  return {
    health: init.health, food: init.food, energy: 100, warmth: init.warmth, mind: init.mind, hygiene: init.hygiene, fishingSkill: FISHING_SKILL_DEFAULT[id],
    life, location: 'camp', joinedTurn: life === 'unrecruited' ? null : 0,
    downedAt: null, deadline: null, deathTurn: null, deathCause: null, gritUsed: false, careProtect: false,
    intox: 0, smokes: 0, jokeUsed: false, grief: 0, coffeeCredit: 0, hangoverDay: null,
    zeroTurns: 0, crisis: false, dirtyStreak: 0,
    clothes: { dirty: false, wet: false, dirtyDays: 0 },
    diseases: [], exposure: { dirtyFood: false, wound: false, woundCovered: false, cared: false },
    immune: {},
  };
}

export function freshDaily() {
  return { bets: 0, orders: {}, misfortune: [], begged: {}, refusalLoss: {}, chatted: {}, bins: {}, majorEvents: 0, errands: {}, talked: false, tableMeals: { xuan: 0, fan: 0, ma: 0 }, coffeeCups: { xuan: 0, fan: 0, ma: 0 }, coffeeUnits: { xuan: 0, fan: 0, ma: 0 } };
}

export function fresh(seed = 260916) {
  const data = getData();
  const actors = indexById(data.actors);
  const s = {
    version: 4, seed: seed >>> 0, day: 1, hour: 6, hourTick: 0, actionCount: 0, slot: 0, turn: 0, phase: 'planning', metMa: false,
    names: NAMES,
    cash: 72, parts: 2, battery: 3, wood: 2, cloth: 4, art: 0, footage: 0, vouchers: 1,
    camp: { rain: 1, beds: 0, floorSheets: 2, furnitureVersion: 1, placements: [], parcels: [], parcelSeq: 0, dirt: 10, bedPriority: ['xuan', 'fan', 'ma'], facilities: [null, null] },
    cardboard: 0, loans: [], pending: { bins: [], beg: [], cards: null, fishingQte: [], riverFight: null, workGames: [] }, workGameCompleted: [], films: [],
    actors: { xuan: actorFrom(actors.xuan.initial, 'active', 'xuan'), fan: actorFrom(actors.fan.initial, 'active', 'fan'), ma: actorFrom(actors.ma.initial, 'unrecruited', 'ma') },
    items: [], itemSeq: 0, ticketSeq: 0, wishes: [], wishSeq: 0, diseaseSeq: 0,
    shops: freshStock(), relations: {}, events: [], eventSeq: 0, eventCooldown: {}, recentTemplates: [], seenTemplates: {},
    pendingJobTips: [], favors: {}, plan: { xuan: Array(16).fill(null), fan: Array(16).fill(null), ma: Array(16).fill(null) }, busy: { xuan: null, fan: null, ma: null },
    daily: freshDaily(), flags: { binSkill: {} }, ledger: { start: 72, income: 0, expense: 0 }, log: [], deaths: [],
    pendingMorning: null, stateRevision: 1, lastTx: null, tailTurns: 0, weatherKind: 'overcast', effectiveFood: 0,
  };
  for (let i = 0; i < 4; i++) makeItem(s, 'meal', 'camp');
  makeItem(s, 'lighter', 'camp');
  makeItem(s, 'old_camera', 'fan');
  makeItem(s, 'old_computer', 'camp');
  s.weatherKind = weatherOf(s.seed, 1).kind;
  s.effectiveFood = foodEquivalent(s);
  s.plan.xuan[0] = task('scavenge', ['xuan']); s.plan.xuan[4] = task('joke', ['xuan']); s.plan.xuan[8] = task('shop', ['xuan'], { zone: 'market' }); s.plan.xuan[12] = task('rest', ['xuan']);
  s.plan.fan[0] = task('kitchen', ['fan']); s.plan.fan[4] = task('sketch', ['fan']); s.plan.fan[8] = task('warm', ['fan']); s.plan.fan[12] = task('rest', ['fan']);
  s.pendingMorning = morningNode(s);
  const ev = [];
  directorTick(s, ev);
  s.log.push('第1天：现金72、四份饭、两张地铺床单。先认清附近街区与店铺。');
  for (const m of ev) s.log.push(m);
  beginDayReport(s);
  return s;
}

export function task(id, participants, extra = {}) {
  return { id, hours: ACTIONS[id].hours ?? 1, participants: [...participants], target: extra.target || null, group: extra.group || null, zone: extra.zone || ACTIONS[id].zone, cart: extra.cart || null, destination: extra.destination || 'self', targets: extra.targets || null, care: null, eventUid: extra.eventUid || null, pay: extra.pay ?? null, extraCost: extra.extraCost || null, style: extra.style || 'ask', facility: extra.facility || null };
}

export const alive = (s) => IDS.filter((id) => ['active', 'downed'].includes(s.actors[id].life));
export const active = (s) => IDS.filter((id) => s.actors[id].life === 'active');

// 有效食物份数：按饱食当量折算，面包 18 不等于一份正餐 30。
export function foodEquivalent(s) {
  const total = s.items.filter((x) => foodFresh(s, x)).reduce((a, x) => a + (FOOD_VALUE[x.itemId] || 0), 0);
  return Math.floor(total / 30);
}

export function reserve(s) {
  return foodReserve(alive(s).length, foodEquivalent(s), getData().rules);
}

export function weather(s, day = s.day) {
  return weatherOf(s.seed, day);
}

export function energyCost(s, id, a) {
  return ['rest', 'sleep', 'warm', 'wait', 'aid'].includes(a.id) ? 0 : 20;
}

export function available(s, id) {
  const p = s.actors[id];
  if (p.life === 'downed') return ['aid', 'wait'];
  if (p.life !== 'active') return [];
  return Object.keys(ACTIONS).filter((k) => {
    const a = ACTIONS[k];
    if (a.downedOnly || a.eventOnly) return false;
    if (a.who !== 'any' && a.who !== id) return false;
    if (a.fixed && !a.fixed.includes(id)) return false;
    return true;
  });
}

export function cancelAt(s, id, hour) {
  const index = s.phase === 'tail' ? hour - 22 : planIndex(hour);
  const old = s.plan[id][index];
  if (old?.eventUid) releaseEvent(s, old.eventUid);
  if (old?.group) { for (const x of IDS) if (s.plan[x][index]?.group === old.group) s.plan[x][index] = null; }
  else s.plan[id][index] = null;
}

// 排程一格。opts: participants, target, zone, cart, destination, targets, eventUid, pay, extraCost, costOverride
export function assign(input, id, hour, actionId, opts = {}) {
  if (input.phase === 'tail') { if (!['aid', 'rescue', 'wait', 'rest'].includes(actionId)) return { error: '尾声回合只处理救援：可选联系救助、陪同送援、等待或休息。', state: input }; }
  else if (input.phase !== 'planning') return { error: '当前需先处理剧情、相遇或结算画面。', state: input };
  if (!IDS.includes(id) || !Number.isInteger(hour) || hour < input.hour || (input.phase === 'tail' ? hour < 22 || hour > 23 : hour < 6 || hour > 21) || !Object.hasOwn(ACTIONS, actionId)) return { error: '无效角色、行动或已完成小时。', state: input };
  if (input.busy?.[id] && hour < input.hour + input.busy[id].remainingHours) return { error: '角色正在执行任务，不能覆盖。', state: input };
  const slot = input.phase === 'tail' ? 3 : slotOfHour(hour), index = input.phase === 'tail' ? hour - 22 : planIndex(hour);
  const a = ACTIONS[actionId];
  if (input.phase !== 'tail' && (a.hours ?? 1) > 22 - hour) return { error: '任务时长超过今天剩余小时。', state: input };
  if (!available(input, id).includes(actionId) && !(a.eventOnly && opts.eventUid)) return { error: '当前生命状态或职业不能安排这项行动。', state: input };
  let members = a.fixed ? [...a.fixed] : a.min ? opts.participants : [id];
  if (!Array.isArray(members) || !members.includes(id) || new Set(members).size !== members.length || members.some((x) => !IDS.includes(x))) return { error: '请选择明确且不重复的合作参与者。', state: input };
  if (members.some((m) => input.busy?.[m] && hour < input.hour + input.busy[m].remainingHours)) return { error: '参与者正在执行任务，不能覆盖。', state: input };
  if (a.min && members.length !== a.min) return { error: '这项合作需要' + a.min + '名参与者。', state: input };
  if (a.rescue) { if (!opts.target || opts.target === id || !members.includes(opts.target) || input.actors[opts.target].life !== 'downed' || input.actors[id].life !== 'active') return { error: '救援需一名可行动者与一名濒死目标。', state: input }; }
  for (const m of members) if (!a.rescue && input.actors[m].life !== (a.downedOnly ? 'downed' : 'active')) return { error: NAMES[m] + '当前不能参与。', state: input };
  if (a.allowed && !a.allowed.includes(slot)) return { error: a.name + '只在' + a.allowed.map((x) => SLOTS[x]).join('/') + '开放。', state: input };
  if (a.risky && input.turn < 3) return { error: '前三回合教学保护阶段不开放危险任务。', state: input };
  let zone = a.zone;
  if (zone === 'pick') {
    zone = opts.zone;
    const okZones = a.begging ? BEG_ZONES : a.bins ? BINS_ZONES : a.repairing ? REPAIR_ZONES : OUT_ZONES;
    if (!okZones.includes(zone)) return { error: '请选择一个可去的街区。', state: input };
  }
  if (a.shop) { const closed = shopClosedReason(input, a.shop, slot); if (closed) return { error: shopDef(a.shop).name + '：' + closed, state: input }; }
  if (a.shopping && opts.cart && opts.cart.length) { const v = validateCart(input, id, zone, slot, opts.cart); if (v.error) return { error: v.error, state: input }; }
  if (a.shopping && !shopsInDistrict(zone).length) return { error: '这个街区没有店。', state: input };
  const s = copy(input);
  for (const m of members) cancelAt(s, m, hour);
  const group = members.length > 1 ? `${s.day}:${hour}:${actionId}:${members.slice().sort().join('-')}` : null;
  const t = task(actionId, members, { target: opts.target, group, zone, cart: opts.cart, destination: opts.destination, targets: opts.targets, eventUid: opts.eventUid, pay: opts.pay, extraCost: opts.extraCost, costOverride: opts.costOverride, style: opts.style, facility: opts.facility });
  for (const m of members) s.plan[m][index] = copy(t);
  return { state: s };
}

// 给某人的某格挂一次护理：用品必须在病人自己包里、营地箱（病人本格在营地）或同格同街区同伴的包里。
export function careOptions(s, patientId, hour) {
  const index = planIndex(hour);
  const p = s.actors[patientId];
  const t = s.plan[patientId][index];
  const zone = t ? t.zone : null;
  const containers = [patientId];
  if (zone === 'camp') containers.push('camp');
  for (const m of active(s)) if (m !== patientId && s.plan[m][index]?.zone === zone) containers.push(m);
  const out = [];
  for (const d of p.diseases) {
    for (const it of s.items) {
      if (!containers.includes(it.container)) continue;
      if (careMatches(d, it.itemId)) out.push({ diseaseUid: d.uid, itemUid: it.uid, itemId: it.itemId, container: it.container });
      else if (it.itemId === 'rehydration' && d.kind === 'gut') out.push({ diseaseUid: d.uid, itemUid: it.uid, itemId: it.itemId, container: it.container, support: true });
      else if (it.itemId === 'symptom_relief') out.push({ diseaseUid: d.uid, itemUid: it.uid, itemId: it.itemId, container: it.container, relief: true });
    }
  }
  return out;
}

export function setCare(input, patientId, hour, choice) {
  const index = planIndex(hour);
  if (input.phase !== 'planning' || hour < input.hour) return { error: '当前不能安排护理', state: input };
  const t = input.plan[patientId][index];
  if (!t) return { error: '先给这一格安排行动，护理附在行动上', state: input };
  const s = copy(input);
  if (!choice) { s.plan[patientId][index].care = null; return { state: s }; }
  const opts = careOptions(s, patientId, hour);
  const found = opts.find((o) => o.diseaseUid === choice.diseaseUid && o.itemUid === choice.itemUid);
  if (!found) return { error: '这份用品此刻够不着病人：要在他自己包里、营地箱（他本格在营地）或同格同街区同伴包里', state: input };
  s.plan[patientId][index].care = found;
  for (const m of s.plan[patientId][index].participants) if (m !== patientId) s.plan[m][index].care = s.plan[m][index].care;
  return { state: s };
}

// 即时购买：人此刻就在店所在街区且店开门，每人每格一次附带采买。
export function buyNow(input, actorId, cart, destination = 'self', slotOverride = null) {
  if (pendingWorkError(input)) return pendingWorkError(input);
  if (!['planning', 'arrival'].includes(input.phase)) return { error: '现在不能购物', state: input };
  const p = input.actors[actorId];
  if (!p || p.life !== 'active') return { error: '这个人现在不能购物', state: input };
  const slot = slotOverride ?? input.slot;
  const key = actorId + ':' + input.hour;
  if (input.daily.errands[key]) return { error: NAMES[actorId] + '本时段的附带采买已用过，下一时段再来' , state: input };
  const v = validateCart(input, actorId, p.location, slot, cart);
  if (v.error) return { error: v.error, state: input };
  const rules = getData().rules;
  const gambleLines = cart.filter((l) => itemDef(l.itemId)?.category === 'lottery').reduce((a, l) => a + l.qty, 0);
  if (gambleLines > 0 && input.daily.bets + 1 > rules.gambling.paidActionsTeamDailyCap) return { error: '全队今日付费博彩已达' + rules.gambling.paidActionsTeamDailyCap + '次（购票与牌局共用）', state: input };
  if (input.cash < v.total) return { error: '现金不足：需' + v.total + '，现有' + input.cash, state: input };
  const foodInCart = cart.some((l) => isFood(l.itemId));
  if (gambleLines > 0 && input.cash - v.total < reserve(input)) return { error: '这会动用预留的饭钱' + reserve(input) + '。先补食物或安排劳动。', state: input };
  const s = copy(input);
  s.cash -= v.total;
  s.ledger.expense += v.total;
  const made = executeCart(s, actorId, cart, destination);
  const parcelId = made.some((it) => itemDef(it.itemId)?.category === 'furniture') ? s.camp.parcels.at(-1).id : null;
  if (gambleLines > 0) {
    s.daily.bets -= gambleLines - 1; // executeCart 每张票加一次，购票整笔只占一次额度
    for (const it of made) if (it.ticket) { it.ticket.face = generateFace(s.seed, it.ticket); it.ticket.revealed = []; }
    fulfillWish(s, actorId, 'ma_lottery', 'exact', []);
    s.flags.gambles = (s.flags.gambles || 0) + 1;
  }
  for (const it of made) {
    if (['keyboard', 'headphones'].includes(it.itemId) && actorId === 'xuan') fulfillWish(s, 'xuan', 'xuan_' + (it.itemId === 'keyboard' ? 'keyboard' : 'headphones'), 'exact', []);
    if (it.itemId === 'shoes' && actorId === 'ma') fulfillWish(s, 'ma', 'ma_shoes', 'exact', []);
    if (it.container === actorId || (it.container === 'camp' && s.actors[actorId].location === 'camp')) fulfillItemWish(s, actorId, it.itemId, 'obtain');
  }
  s.daily.errands[key] = true;
  s.stateRevision += 1;
  const names = cart.map((l) => indexById(getData().items)[l.itemId].name + '×' + l.qty).join('、');
  s.log.unshift(`${NAMES[actorId]}在${indexById(getData().districts)[p.location]?.name || p.location}买了${names}，支出${v.total}${parcelId ? '，家具送到营地包裹' + parcelId : ''}。`);
  if (foodInCart) s.effectiveFood = foodEquivalent(s);
  return { state: s, made, total: v.total, parcelId };
}

// 即时使用消耗品（烟、酒、茶、汽水、咖啡、湿巾、症状缓解等）。
export function useItem(input, actorId, uid, options = {}) {
  if (pendingWorkError(input)) return pendingWorkError(input);
  if (input.phase !== 'planning') return { error: '现在不能使用物品', state: input };
  const p = input.actors[actorId];
  if (p.life !== 'active') return { error: '这个人现在不能使用物品', state: input };
  const inst = findItem(input, uid);
  if (!inst) return { error: '没有这件物品', state: input };
  const ok = accessibleItems(input, actorId).some((x) => x.uid === uid);
  if (!ok) return { error: '够不着：物品在别处（自己的包随时可用，营地箱要人在营地）', state: input };
  const id = inst.itemId;
  const coffee = id === 'coffee' || COFFEE_IDS.includes(id);
  const coffeeRules = getData().rules.coffee;
  const coffeeResult = coffee ? coffeeQuote({ count: input.daily.coffeeCups[actorId], units: input.daily.coffeeUnits[actorId], strengthUnits: id === 'coffee' ? coffeeRules.instantUnits : coffeeRules.freshUnits, seed: input.seed, day: input.day, actorId, confirmRisk: options.confirmRisk === true, coffeeRules }) : null;
  if (coffeeResult?.error) return { error: coffeeResult.error, state: input };
  if (coffeeResult?.requiresConfirmation) return { error: '第六杯起需确认咖啡风险。', requiresConfirmation: true, coffeeRisk: { risk: coffeeResult.risk, nextCups: coffeeResult.nextCups }, state: input };
  const s = copy(input);
  const q = s.actors[actorId];
  const ev = [];
  const need = (n) => consumeUse(s, uid, n);
  switch (id) {
    case 'cigarette': case 'cigarette_regular': case 'cigarette_premium': {
      if (!accessibleItems(s, actorId, 'lighter').length && !s.items.some((x) => x.itemId === 'lighter' && x.container === 'camp' && q.location === 'camp')) return { error: '没有火：打火机不在手边', state: input };
      if (q.smokes >= 2) return { error: '今天已经抽了两次，再抽不加精神', state: input };
      const gain = q.smokes === 0 ? (id === 'cigarette_premium' ? 6 : id === 'cigarette_regular' ? 5 : 4) : 1;
      need(1); q.mind = clamp(q.mind + gain); q.energy = clamp(q.energy - 2); q.smokes += 1;
      fulfillWish(s, actorId, 'quiet_smoke', 'exact', ev); ev.push(`${NAMES[actorId]}用了${itemDef(id).name}一格：精神+${gain}、体力-2。`); break;
    }
    case 'butts': {
      if (!accessibleItems(s, actorId, 'lighter').length && !s.items.some((x) => x.itemId === 'lighter' && x.container === 'camp' && q.location === 'camp')) return { error: '没有火：打火机不在手边', state: input };
      s.items = s.items.filter((x) => x.uid !== uid); q.mind = clamp(q.mind + 2); q.hygiene = clamp(q.hygiene - 3);
      fulfillWish(s, actorId, 'quiet_smoke', 'partial', ev); ev.push(`${NAMES[actorId]}抽了半截捡来的烟：精神+2、卫生-3。`); break;
    }
    case 'beer': case 'beer_bottle': case 'spirit': case 'baijiu': case 'vodka': {
      if (q.intox >= 2) return { error: '本日饮酒上限已到', state: input };
      const beer = id === 'beer' || id === 'beer_bottle';
      const gain = beer ? 5 : 6;
      need(1); q.mind = clamp(q.mind + gain); q.intox = Math.min(2, q.intox + (beer ? 1 : 2));
      fulfillWish(s, actorId, 'evening_drink', 'exact', ev); ev.push(`${NAMES[actorId]}用了${itemDef(id).name}一格：精神+${gain}、醉意${q.intox}。`); break;
    }
    case 'tea': {
      if (!['camp', 'service'].includes(q.location)) return { error: '茶包要配公共热水：人在营地或服务站才能泡', state: input };
      if (s.daily['tea:' + actorId]) return { error: '今天已经泡过一次', state: input };
      need(1); s.daily['tea:' + actorId] = true; q.mind = clamp(q.mind + 2); ev.push(`${NAMES[actorId]}泡了杯茶，精神+2。`); break;
    }
    case 'coffee': case 'espresso': case 'americano': case 'latte': case 'cappuccino': case 'mocha': case 'cold_brew': {
      need(1);
      q.mind = clamp(q.mind + 2);
      s.daily.coffeeCups[actorId] = coffeeResult.nextCups;
      s.daily.coffeeUnits[actorId] = coffeeResult.nextUnits;
      q.coffeeCredit = Math.min(coffeeRules.creditMax, q.coffeeCredit + coffeeResult.creditGain);
      ev.push(`${NAMES[actorId]}喝了${itemDef(id).name}：精神+2。`);
      if (coffeeResult.fatal) {
        ev.push(`${NAMES[actorId]}确认后触发了咖啡风险。`);
        killActor(s, actorId, s.turn, ev, '咖啡风险');
        if (s.phase === 'gameover') s.ending = computeEnding(s);
      } else if (coffeeResult.risk > 0) {
        ev.push(`${NAMES[actorId]}确认了咖啡风险，本次没有触发。`);
      }
      break;
    }
    case 'soda': { need(1); q.mind = clamp(q.mind + 2); fulfillWish(s, actorId, 'good_meal', 'partial', ev); ev.push(`${NAMES[actorId]}喝了汽水，精神+2。`); break; }
    case 'wipes': { if (s.daily['wipes:' + actorId]) return { error: '湿巾每天只算一次', state: input }; need(1); s.daily['wipes:' + actorId] = true; q.hygiene = clamp(q.hygiene + 12); ev.push(`${NAMES[actorId]}擦了擦，卫生+12。`); break; }
    case 'symptom_relief': { const d = q.diseases[0]; if (!d) return { error: '没有需要缓解的症状', state: input }; need(1); d.reliefUntil = s.turn + 2; ev.push(`${NAMES[actorId]}用了症状缓解包：接下来两回合病情伤害-3，不降低严重度。`); break; }
    case 'rehydration': { const d = q.diseases.find((x) => x.kind === 'gut'); if (!d) return { error: '补液用品只对肠胃不适有用', state: input }; need(1); d.supportUntil = s.turn + 2; ev.push(`${NAMES[actorId]}补了液：两回合内肠胃伤害-3。`); break; }
    case 'clean_clothes': case 'underwear': case 'socks': { if (inst.wet) return { error: '衣服还是湿的，晾干再换', state: input }; s.items = s.items.filter((x) => x.uid !== uid); q.clothes = { dirty: false, wet: false, dirtyDays: 0 }; q.hygiene = clamp(q.hygiene + (id === 'clean_clothes' ? 10 : 4)); if (id === 'clean_clothes') fulfillWish(s, actorId, 'clean_clothes_wish', 'exact', ev); ev.push(`${NAMES[actorId]}换上了干净的${id === 'clean_clothes' ? '衣服' : id === 'socks' ? '袜子' : '内衣'}。`); break; }
    case 'fish_common': case 'fish_rare': return { error: '生鱼要先在营地篝火加工，或带到市场出售。', state: input };
    case 'bread': case 'meal': case 'hot_soup': case 'fish_common_cooked': case 'fish_rare_cooked': case 'meal_hot': case 'bread_toasted': case 'hot_soup_heated': { s.items = s.items.filter((x) => x.uid !== uid); q.food = clamp(q.food + FOOD_VALUE[id]); if (inst.dirty) q.exposure.dirtyFood = true; if (['hot_soup', 'hot_soup_heated'].includes(id)) fulfillWish(s, actorId, 'good_meal', 'exact', ev); awardTableMeal(s, actorId, q.location, ev); ev.push(`${NAMES[actorId]}吃了${itemDef(id).name}，饱食+${FOOD_VALUE[id]}${inst.dirty ? '（来路不明，今晚检定风险上升）' : ''}。`); break; }
    default: return { error: '这件东西不是这样用的：设备与护理用品在对应行动里生效', state: input };
  }
  fulfillItemWish(s, actorId, id, 'use', ev);
  s.stateRevision += 1;
  for (const m of ev) s.log.unshift(m);
  s.effectiveFood = foodEquivalent(s);
  return { state: s, events: ev };
}

export function transferItem(input, actorId, uid, to) {
  if (pendingWorkError(input)) return pendingWorkError(input);
  const inst = findItem(input, uid);
  if (!inst) return { error: '没有这件物品', state: input };
  const p = input.actors[actorId];
  if (!accessibleItems(input, actorId).some((x) => x.uid === uid) && !(inst.container.startsWith('relic:') && p.location === 'camp')) return { error: '够不着这件物品', state: input };
  if (isFurniture(inst.itemId) && to !== 'camp') return { error: '家具留在营地，用摆放或收起整理', state: input };
  if (to === 'camp' && p.location !== 'camp') return { error: '人不在营地，放不进营地箱', state: input };
  if (IDS.includes(to) && to !== actorId && input.actors[to].location !== p.location) return { error: NAMES[to] + '不在同一个地方，交接不了', state: input };
  if (inst.durableProtected) return { error: '这件东西现在不能移动', state: input };
  const s = copy(input);
  findItem(s, uid).container = to;
  if (IDS.includes(to)) fulfillItemWish(s, to, inst.itemId, 'obtain');
  if (to === 'camp') for (const id of IDS) if (s.actors[id].life === 'active' && s.actors[id].location === 'camp') fulfillItemWish(s, id, inst.itemId, 'obtain');
  s.stateRevision += 1;
  return { state: s };
}

// 卖瓶罐：人在回收巷且老周回收铺开门，1 元/个，不占行动。
export function sellBottles(input, actorId, options = {}) {
  if (pendingWorkError(input)) return pendingWorkError(input);
  if (input.phase !== 'planning') return { error: '现在不能交易', state: input };
  const p = input.actors[actorId];
  if (!p || p.life !== 'active') return { error: '这个人现在不能交易', state: input };
  if (!(input.bottles > 0)) return { error: '没有瓶罐可卖', state: input };
  if (p.location !== 'recycle') return { error: '人要在电子回收巷才能卖给老周', state: input };
  const closed = shopClosedReason(input, 'recycle_shop', input.slot);
  if (closed) return { error: '老周回收铺：' + closed, state: input };
  const s = copy(input);
  const n = s.bottles;
  s.bottles = 0; s.cash += n; s.ledger.income += n; s.stateRevision += 1;
  s.log.unshift(`${NAMES[actorId]}把${n}个瓶罐卖给老周，得${n}块。`);
  const income = finishImmediateIncome(input, s, actorId, options.controlledActorId ?? null, 'sellBottles', `bottle-${input.stateRevision}`, '卖瓶罐');
  return income.error ? income : { ...income, cash: n };
}

export function travelTo(input, actorId, district) {
  if (pendingWorkError(input)) return pendingWorkError(input);
  const p = input.actors?.[actorId];
  if (input.phase !== 'planning' || input.pendingMorning || input.pending?.bins?.length || input.pending?.beg?.length || input.pending?.cards || input.pending?.casino || input.pending?.fishingQte?.length || input.pending?.riverFight) return { state: input, error: '先处理当前待办互动。' };
  if (!p || p.life !== 'active') return { state: input, error: '角色当前不能移动。' };
  if (p.location === district) return { state: input };
  const from = getData().districts.find(x => x.id === p.location);
  if (!from?.neighbors.includes(district) || !getData().districts.some(x => x.id === district)) return { state: input, error: '街区不相邻。' };
  if (p.energy < 2) return { state: input, error: '体力不足，跨街需要2点体力。' };
  const s = copy(input);
  s.actors[actorId].location = district;
  fulfillReachedItemWishes(s, actorId);
  s.actors[actorId].energy -= 2;
  s.stateRevision += 1;
  s.log.unshift(`${NAMES[actorId]}从${from.name}走到${getData().districts.find(x => x.id === district).name}，体力-2。`);
  return { state: s };
}

export function sellFish(input, actorId, uid, options = {}) {
  if (pendingWorkError(input)) return pendingWorkError(input);
  const p = input.actors?.[actorId];
  if (input.phase !== 'planning' || !p || p.life !== 'active') return { state: input, error: '现在不能交易。' };
  const item = input.items.find(x => x.uid === uid && x.container === actorId && ['fish_common', 'fish_rare'].includes(x.itemId));
  if (!item) return { state: input, error: '鱼获不在自己包里。' };
  if (p.location !== 'market') return { state: input, error: '要到老街便利店卖鱼。' };
  const closed = shopClosedReason(input, 'convenience', input.slot);
  if (closed) return { state: input, error: '便利店：' + closed };
  const cash = item.itemId === 'fish_rare' ? 14 : 6;
  const s = copy(input);
  s.items = s.items.filter(x => x.uid !== uid);
  s.cash += cash; s.ledger.income += cash; s.stateRevision += 1;
  s.log.unshift(`${NAMES[actorId]}把${itemDef(item.itemId).name}卖给便利店，得${cash}块。`);
  const income = finishImmediateIncome(input, s, actorId, options.controlledActorId ?? null, 'sellFish', `fish-${uid}`, '卖鱼');
  return income.error ? income : { ...income, cash };
}

// 今晚睡哪儿：camp 营地 / shelter 服务站临时过夜区 / station 候车室。
export function nightSpotOptions(s) {
  const wx = weatherOf(s.seed, s.day);
  const trust = (s.relations.reg_wang && s.relations.reg_wang.trust) || 0;
  const shelterOpen = ['cold', 'coldwave', 'storm', 'rain'].includes(wx.kind) || trust >= 2 || s.flags.shelterDay === s.day || Boolean(s.flags.wangShelter);
  return [
    { id: 'camp', label: '旧桥营地', note: `干燥床位${s.camp.beds}/${alive(s).length}，防雨${s.camp.rain}/3` },
    { id: 'shelter', label: '服务站临时过夜区', note: shelterOpen ? '干、暖、挤：全员算干燥床位，精神-1' : '今晚不开放（寒冷/雨夜或王叔信任≥2时开放）', disabled: !shelterOpen },
    { id: 'station', label: '车站候车室', note: '没有床，比露天暖一点；可能被赶（精神-3、体力-5）' },
  ];
}

export function setNightSpot(input, spot) {
  if (input.phase !== 'planning') return { error: '现在不能改', state: input };
  const opt = nightSpotOptions(input).find((o) => o.id === spot);
  if (!opt) return { error: '没有这个过夜地点', state: input };
  if (opt.disabled) return { error: opt.note, state: input };
  const s = copy(input);
  s.flags.nightSpot = spot;
  if (spot === 'shelter') s.flags.shelterDay = s.day; else if (s.flags.shelterDay === s.day) delete s.flags.shelterDay;
  return { state: s };
}

export function meet(input, choice) {
  if (input.phase !== 'meeting' || input.metMa || input.day !== 1 || input.hour !== 18 || ![0, 1, 2].includes(choice)) return { state: input, error: '当前没有待处理的马哥相遇。' };
  const s = copy(input);
  s.metMa = true; s.phase = 'planning'; s.actors.ma.life = 'active'; s.actors.ma.joinedTurn = 4; s.actors.ma.location = 'camp';
  s.camp.floorSheets = 3;
  if (choice === 1) s.actors.ma.mind = clamp(s.actors.ma.mind + 4);
  s.plan.ma[12] = task('rest', ['ma']);
  // 马哥随身带一副旧扑克：夜里三人牌局靠它开桌。
  makeItem(s, 'cards', 'ma');
  s.flags.maCardsGranted = true;
  s.log.unshift('马哥加入队伍。三人每天六份饭，目前有' + s.camp.floorSheets + '张地铺床单。');
  return { state: s };
}

export function morningChoice(input, choiceId) {
  if (input.phase !== 'planning' || !input.pendingMorning) return { state: input, error: '没有待处理的晨间节点' };
  const node = input.pendingMorning;
  const c = node.choices.find((x) => x.id === choiceId);
  if (!c) return { state: input, error: '无效选项' };
  if (c.requires) { const err = c.requires(input); if (err) return { state: input, error: err }; }
  const s = copy(input);
  const ev = [];
  applyMorningChoice(s, choiceId, ev);
  s.pendingMorning = null;
  for (const m of ev) s.log.unshift(m);
  return { state: s, events: ev };
}

export function respond(input, uid, response) {
  if (pendingWorkError(input)) return pendingWorkError(input);
  if (input.phase !== 'planning') return { state: input, error: '现在不能回应愿望' };
  const s = copy(input);
  const r = respondWish(s, uid, response);
  if (r.error) return { state: input, error: r.error };
  s.stateRevision += 1;
  s.log.unshift(r.message);
  return { state: s, message: r.message };
}

export function eventChoice(input, uid, choiceId, actorId) {
  if (pendingWorkError(input)) return pendingWorkError(input);
  if (input.phase !== 'planning') return { state: input, error: '现在不能处理事件' };
  const s = copy(input);
  const r = chooseEvent(s, uid, choiceId, actorId);
  if (r.error) return { state: input, error: r.error };
  if (r.book) {
    const ev = s.events.find((e) => e.uid === uid);
    const a = ACTIONS[r.book.action];
    const cost = ev.reserved.costOverride !== null ? { cash: ev.reserved.costOverride } : null;
    const res = assign(s, actorId, s.hour, r.book.action, { zone: r.book.zone, eventUid: uid, pay: ev.reserved.pay, extraCost: ev.reserved.cost, costOverride: cost ? cost.cash : null });
    if (res.error) { releaseEvent(s, uid); return { state: input, error: res.error }; }
    res.state.log.unshift(`${NAMES[actorId]}预约了「${ev.title}」，本格改为「${a.name}」。`);
    return { state: res.state, booked: true };
  }
  for (const m of r.events || []) s.log.unshift(m);
  s.stateRevision += 1;
  return { state: s, events: r.events || [] };
}

export function chat(input, actorId, npcId) {
  if (pendingWorkError(input)) return pendingWorkError(input);
  if (input.phase !== 'planning') return { state: input, error: '现在不能聊天' };
  const s = copy(input);
  const r = chatWith(s, actorId, npcId);
  if (r.error) return { state: input, error: r.error };
  return { state: s };
}

// 待处理交互：读人乞讨。UI 逐步调用；脚本用 autoResolvePending 一次走完。
export function begStep(input, sessionIndex, npcId, step, value) {
  const s = copy(input);
  const session = s.pending.beg[sessionIndex];
  if (!session) return { state: input, error: '没有这场对话' };
  let r;
  if (step === 'open') r = begOpening(s, session, npcId, value);
  else if (step === 'ask') r = begAsk(s, session, npcId, value);
  else if (step === 'finish') r = begFinish(s, session);
  else return { state: input, error: '未知步骤' };
  if (r && r.error) return { state: input, error: r.error };
  if (step === 'finish' && r.summary) s.log.unshift(r.summary);
  s.stateRevision += 1;
  return { state: s, result: r, session: s.pending.beg[sessionIndex] || session };
}

export function acceptFavor(input, npcId, actorId) {
  if (pendingWorkError(input)) return pendingWorkError(input);
  if (input.phase !== 'planning') return { state: input, error: '现在不能接委托' };
  const s = copy(input);
  const r = favAccept(s, npcId, actorId);
  if (r.error) return { state: input, error: r.error };
  s.stateRevision += 1;
  s.log.unshift(`${NAMES[actorId]}接下了${favorStatus(s, npcId).chain.name}的委托「${r.step.title}」（第${s.day + r.step.days}天前）。`);
  return { state: s };
}

export function deliverFavor(input, npcId, actorId) {
  if (pendingWorkError(input)) return pendingWorkError(input);
  if (input.phase !== 'planning') return { state: input, error: '现在不能交付' };
  const s = copy(input);
  const r = favDeliver(s, npcId, actorId);
  if (r.error) return { state: input, error: r.error };
  s.stateRevision += 1;
  s.log.unshift(`${NAMES[actorId]}把东西送到了。`);
  return { state: s };
}

// 接力项目第三步：任何人带着成品到老街交付。
export function deliverProject(input, actorId, options = {}) {
  if (pendingWorkError(input)) return pendingWorkError(input);
  if (input.phase !== 'planning') return { state: input, error: '现在不能交付' };
  const pj = input.flags.project;
  if (!pj || pj.stage !== 3) return { state: input, error: '成品还没出来' };
  const p = input.actors[actorId];
  if (p.location !== 'market') return { state: input, error: '要到老街交给刘姐' };
  const item = input.items.find((x) => x.itemId === 'promo_video' && x.container === actorId);
  if (!item) return { state: input, error: '成品不在这个人包里' };
  const s = copy(input);
  s.items = s.items.filter((x) => x.uid !== item.uid);
  s.cash += 90; s.ledger.income += 90;
  s.flags.fixedJobs = (s.flags.fixedJobs || 0) + 1;
  s.flags.projectsDone = (s.flags.projectsDone || 0) + 1;
  s.flags.project = null;
  const rel = s.relations.reg_liu || (s.relations.reg_liu = { trust: 0, helped: 0, refused: 0, jobs: 0, lastDay: 0 });
  rel.trust = clamp(rel.trust + 1, 0, 5); rel.jobs += 1;
  s.stateRevision += 1;
  s.log.unshift(`${NAMES[actorId]}把宣传片交给了刘姐：收入90，三个人的活。`);
  return finishImmediateIncome(input, s, actorId, options.controlledActorId ?? null, 'deliverProject', `project-${item.uid}`, '交付宣传片');
}

export { favorStatus, activeFavors };

// 翻桶棋盘：一格一格翻；脚本用 autoResolvePending 按顺序翻完。
export function binReveal(input, boardIndex, cellIndex) {
  const s = copy(input);
  const board = s.pending.bins[boardIndex];
  if (!board) return { state: input, error: '没有这只桶' };
  const r = revealCell(s, board, cellIndex);
  if (r.error) return { state: input, error: r.error };
  if (r.done || board.done) { s.log.unshift(boardSummary(board)); s.pending.bins.splice(boardIndex, 1); }
  s.stateRevision += 1;
  s.effectiveFood = foodEquivalent(s);
  return { state: s, result: r, board: r.done || board.done ? null : s.pending.bins[boardIndex] };
}

export function binForfeit(input, boardIndex) {
  const s = copy(input);
  const board = s.pending.bins[boardIndex];
  if (!board) return { state: input, error: '没有这只桶' };
  forfeit(board);
  s.log.unshift(boardSummary(board));
  s.pending.bins.splice(boardIndex, 1);
  s.stateRevision += 1;
  return { state: s };
}

// 旧物处置：卖（在回收巷）、留（自用效果）、送（同街区熟人）。
export function salvageDispose(input, uid, choice, opts = {}) {
  if (pendingWorkError(input)) return pendingWorkError(input);
  if (input.phase !== 'planning') return { state: input, error: '现在不能处置' };
  const s = copy(input);
  const r = dispose(s, uid, choice, opts);
  if (r.error) return { state: input, error: r.error };
  if (choice === 'keep') {
    if (r.effectKey === 'headphones' || (findItem(s, uid)?.itemId === 'headphones')) fulfillWish(s, 'xuan', 'xuan_headphones', 'exact', []);
    if (findItem(s, uid)?.itemId === 'tv') s.flags.tvHome = true;
    if (findItem(s, uid)?.itemId === 'phone') s.flags.phone = true;
  }
  if (choice === 'gift' && findItem(input, uid)?.itemId === 'tv') s.flags.xuVenue = true;
  s.stateRevision += 1;
  s.log.unshift(r.text || '处置完成。');
  if (choice !== 'sell') return { state: s, text: r.text };
  const actorId = findItem(input, uid)?.container;
  const income = finishImmediateIncome(input, s, actorId, opts.controlledActorId ?? null, 'salvageSell', `salvage-${uid}`, '卖旧物');
  return income.error ? income : { ...income, text: r.text };
}

export function salvageOptions(state, uid) { return { options: disposeOptions(state, uid), giftTargets: giftTargets(state) }; }

export function borrowFrom(input, npcId, actorId) {
  if (pendingWorkError(input)) return pendingWorkError(input);
  if (input.phase !== 'planning') return { state: input, error: '现在不能借' };
  const c = canBorrow(input, npcId, actorId);
  if (!c.ok) return { state: input, error: c.reason };
  const s = copy(input);
  const r = borrow(s, npcId, actorId);
  if (r && r.error) return { state: input, error: r.error };
  s.stateRevision += 1;
  s.log.unshift(`${NAMES[actorId]}从${LOANS[npcId].name}那里借来了${itemDef(LOANS[npcId].thingId)?.name || LOANS[npcId].thingId}，第${s.day + LOANS[npcId].days}天前要还。`);
  return { state: s };
}

export function returnLoanTo(input, uid, actorId) {
  if (pendingWorkError(input)) return pendingWorkError(input);
  if (input.phase !== 'planning') return { state: input, error: '现在不能还' };
  const s = copy(input);
  const r = returnLoan(s, uid, actorId);
  if (r && r.error) return { state: input, error: r.error };
  s.stateRevision += 1;
  s.log.unshift(r?.text || '还回去了。');
  return { state: s };
}

export function extendLoanOf(input, uid) {
  if (pendingWorkError(input)) return pendingWorkError(input);
  const s = copy(input);
  const r = extendLoan(s, uid);
  if (r && r.error) return { state: input, error: r.error };
  s.stateRevision += 1;
  s.log.unshift(r?.text || '说好了晚两天还。');
  return { state: s };
}

export function uninstallFacility(input, slot, actorId) {
  if (pendingWorkError(input)) return pendingWorkError(input);
  if (input.phase !== 'planning') return { state: input, error: '现在不能拆' };
  if (input.actors[actorId]?.location !== 'camp') return { state: input, error: '人要在营地才能拆设施' };
  const s = copy(input);
  const r = campUninstall(s, slot);
  if (r.error) return { state: input, error: r.error };
  s.stateRevision += 1;
  s.log.unshift(r.text);
  return { state: s };
}

export { campReport, FACILITIES, fuelCount, canInstall, LOANS };

export function autoResolvePending(input) {
  const s = copy(input);
  while (s.pending?.workGames?.length) {
    const resolved = finishWorkGame(s, s.pending.workGames[0].id, { forfeit: true });
    if (resolved.error) return { state: input, error: resolved.error };
    Object.assign(s, resolved.state);
  }
  if (s.pending?.casino && s.pending.casino.phase !== 'settled') Object.assign(s, closeCasino(s).state);
  while (s.pending.fishingQte?.length) Object.assign(s, autoResolveFishingQte(s).state);
  s.pending.riverFight = null;
  while (s.pending.beg.length) { const r = begAuto(s, s.pending.beg[0]); if (r.summary) s.log.unshift(r.summary); }
  while (s.pending.bins.length) {
    const board = s.pending.bins[0];
    const order = board.cells.map((c, i) => i).sort((a, b) => Number(board.cells[a].warned) - Number(board.cells[b].warned));
    for (const i of order) { if (board.done) break; if (!board.cells[i].revealed) revealCell(s, board, i); }
    if (!board.done) forfeit(board);
    s.log.unshift(boardSummary(board));
    s.pending.bins.shift();
  }
  if (s.pending.cards) settleCardNight(s, s.pending.cards);
  s.effectiveFood = foodEquivalent(s);
  s.stateRevision += 1;
  return { state: s };
}

export function finishRiverFight(input, eventId) {
  if (!input.pending?.riverFight || input.pending.riverFight.id !== eventId) return { state: input, error: '这段河边插曲已处理。' };
  const s = copy(input);
  s.pending.riverFight = null;
  s.stateRevision += 1;
  return { state: s };
}

export { passersby, binsAvailable, activeWishes, careMatches, ACTIONS, directorTick, shopClosedReason };

// 夜间牌局：三人打炸金花或德州，玩家操控其中一人。会话放在 pending.cards，界面逐步调用；自动对局直接收桌。
export function canCardNight(input, stakes = 'free') {
  const rules = getData().rules.gambling;
  if (input.phase !== 'planning') return { ok: false, reason: '现在不是打牌的时候' };
  if (!input.metMa) return { ok: false, reason: '还没遇到马哥' };
  if (IDS.some((id) => input.actors[id].life !== 'active')) return { ok: false, reason: '三个人得都在' };
  if (IDS.some((id) => input.actors[id].location === 'station')) return { ok: false, reason: '候车室里不方便摊牌' };
  if (!input.items.some((x) => x.itemId === 'cards' && ['ma', 'camp'].includes(x.container))) return { ok: false, reason: '马哥那副旧扑克不在' };
  if (input.pending?.cards) return { ok: false, reason: '牌局已经开着' };
  if (input.flags.cardNightDay === input.day) return { ok: false, reason: '今晚已经打过了' };
  if (stakes === 'cash') {
    if (IDS.some((id) => input.actors[id].intox > 0) && rules.requiresSober) return { ok: false, reason: '有人还有醉意，不能来真钱的' };
    if (input.daily.bets + 1 > rules.paidActionsTeamDailyCap) return { ok: false, reason: '全队今日付费博彩额度用完了' };
    if (input.cash - CARD_BUY_IN * IDS.length < reserve(input)) return { ok: false, reason: '现金不足或会动用预留的饭钱' };
  }
  return { ok: true };
}

export function canStartCasino(input, game = 'zjh', options = {}) {
  const c = input.pending?.casino;
  const rules = getData().rules.gambling;
  let amounts;
  try { amounts = casinoAmounts(options); } catch (error) { return { ok: false, reason: error.message }; }
  const { buyIn, baseBet } = amounts;
  if (!c || c.phase !== 'invited') return { ok: false, reason: '没有待确认的入馆邀请' };
  if (!['zjh', 'texas', 'blackjack'].includes(game)) return { ok: false, reason: '未知牌类' };
  if (input.phase !== 'planning' || input.actors[c.actorId]?.life !== 'active' || input.actors[c.actorId].location !== 'cardhall') return { ok: false, reason: '入馆角色不在棋牌馆' };
  if (input.hour < 14 || input.hour > 21 || input.day !== c.day || input.hourTick !== c.hourTick) return { ok: false, reason: '棋牌馆已过营业时间' };
  if (input.actors[c.actorId].intox > 0 && rules.requiresSober) return { ok: false, reason: '有醉意不能下注' };
  if (input.daily.bets + 1 > rules.paidActionsTeamDailyCap) return { ok: false, reason: '今日付费博彩额度已用完' };
  if (input.cash - buyIn < reserve(input)) return { ok: false, reason: '现金不足或会动用预留的饭钱' };
  if (['hall_lan', 'hall_qiao'].some((id) => input.casinoVenue.bankrolls[id] < buyIn)) return { ok: false, reason: '馆内对手资金不足' };
  if (game === 'blackjack' && input.casinoVenue.bankrolls.hall_dealer < 4 * baseBet * 3) return { ok: false, reason: '发牌员准备金不足' };
  return { ok: true };
}

export function startCasino(input, game = 'zjh', options = {}) {
  const check = canStartCasino(input, game, options);
  return check.ok ? openCasino(input, game, options) : { state: input, error: check.reason };
}

export function casinoAction(input, action) {
  const c = input.pending?.casino;
  if (!c || c.session?.cur?.turn !== c.actorId) return { state: input, error: '还没轮到你' };
  return casinoAct(input, action);
}

export function applyCasinoNpcChoice(input, choice, provenance = {}) {
  const c = input.pending?.casino;
  if (!c || c.session?.cur?.turn === c.actorId || !choice || !choice.npcId) return { state: input, error: '没有待处理的 NPC 行动' };
  return casinoAct(input, choice.action, choice, { source: provenance.source ?? choice.source, line: provenance.line ?? choice.line });
}

export const nextCasinoHand = nextCasinoRound;
export const finishCasino = closeCasino;

export function startCardNight(input, opts = {}) {
  const stakes = opts.stakes === 'cash' ? 'cash' : 'free';
  const c = canCardNight(input, stakes);
  if (!c.ok) return { state: input, error: c.reason };
  const controller = IDS.includes(opts.controller) ? opts.controller : opts.controller === null ? null : 'xuan';
  const s = copy(input);
  if (!s.pending) s.pending = { bins: [], beg: [], cards: null };
  if (opts.game === 'blackjack') {
    if (!IDS.includes(controller)) return { state: input, error: '先选一位操控者' };
    const dealerId = IDS.find((id) => id !== controller);
    const players = IDS.filter((id) => id !== dealerId);
    const bj = newBlackjackSession({ seed: s.seed, sessionId: `night:${s.seed}:${s.day}:${s.hourTick}:${controller}`, players, controller, dealerId,
      chips: Object.fromEntries(players.map((id) => [id, CARD_BUY_IN])), bank: CARD_BUY_IN });
    bj.stakes = stakes; bj.buyIn = CARD_BUY_IN;
    if (stakes === 'cash') { s.cash -= CARD_BUY_IN * IDS.length; s.ledger.expense += CARD_BUY_IN * IDS.length; s.daily.bets++; }
    const dealt = startBlackjackHand(bj);
    if (dealt.error) return { state: input, error: dealt.error };
    s.pending.cards = dealt.state;
    runNightBlackjack(s);
    s.flags.cardNightDay = s.day;
    s.stateRevision++;
    return { state: s };
  }
  const session = cardSession(s, { game: opts.game, stakes, controller });
  if (stakes === 'cash') {
    // 三人共用现金：本钱从公共现金拿，散场按筹码放回。钱在自己人手里转，意义在马哥的瘾和当日博彩额度。
    const total = CARD_BUY_IN * IDS.length;
    s.cash -= total; s.ledger.expense += total; s.daily.bets += 1;
  }
  cardStartHand(s, session);
  cardRunAI(s, session);
  s.pending.cards = session;
  s.flags.cardNightDay = s.day;
  s.stateRevision += 1;
  return { state: s };
}

export function cardAction(input, action, amount = 0, target = null) {
  if (!input.pending?.cards) return { state: input, error: '没有开着的牌局' };
  const s = copy(input);
  const session = s.pending.cards;
  if (!session.cur || session.cur.over) return { state: input, error: '这一手已经结束' };
  if (session.cur.turn !== session.controller) return { state: input, error: '还没轮到你' };
  if (session.game === 'blackjack') {
    const r = blackjackAct(session, action);
    if (r.error) return { state: input, error: r.error };
    s.pending.cards = r.state;
    runNightBlackjack(s);
    s.stateRevision++;
    return { state: s };
  }
  const r = cardAct(s, session, action, amount, target);
  if (r.error) return { state: input, error: r.error };
  cardRunAI(s, session);
  s.stateRevision += 1;
  return { state: s };
}

export function nextHand(input) {
  if (!input.pending?.cards) return { state: input, error: '没有开着的牌局' };
  const s = copy(input);
  const session = s.pending.cards;
  if (session.done) return { state: input, error: '今晚的牌打完了' };
  if (session.cur && !session.cur.over) return { state: input, error: '这一手还没打完' };
  if (session.game === 'blackjack') {
    const r = startBlackjackHand(session);
    if (r.error) return { state: input, error: r.error };
    s.pending.cards = r.state;
    runNightBlackjack(s);
    s.stateRevision++;
    return { state: s };
  }
  cardStartHand(s, session);
  cardRunAI(s, session);
  s.stateRevision += 1;
  return { state: s };
}

function settleCardNight(s, session) {
  if (session.game === 'blackjack') {
    let guard = 0;
    while (!session.cur.over && guard++ < 100) {
      const action = session.cur.turn === session.controller ? 'stand' : blackjackLocalDecision(session, session.cur.turn);
      if (!action) throw new Error('夜间二十一点无法收桌');
      session = blackjackAct(session, action).state;
    }
    if (!session.cur.over) throw new Error('夜间二十一点收桌超出上限');
    for (const id of IDS) {
      s.actors[id].energy = clamp(s.actors[id].energy - 5);
      if (session.stakes === 'free') s.actors[id].mind = clamp(s.actors[id].mind + 6);
    }
    if (session.stakes === 'cash') {
      const returned = Object.values(session.chips).reduce((a, b) => a + b, 0) + session.bank;
      s.cash += returned; s.ledger.income += returned;
      s.flags.gambles = (s.flags.gambles || 0) + 1;
    }
    fulfillWish(s, 'ma', 'ma_cards', session.stakes === 'cash' ? 'exact' : 'partial', []);
    s.log.unshift(`夜里打了${session.handSeq}手二十一点（${session.stakes === 'cash' ? '真钱' : '火柴棍'}），三人熬夜体力-5。`);
    s.pending.cards = null;
    return;
  }
  const ev = [];
  const chips = session.chips;
  for (const id of session.players) {
    const p = s.actors[id];
    if (p.life !== 'active') continue;
    p.energy = clamp(p.energy - 5);
    if (session.stakes === 'free') p.mind = clamp(p.mind + 6);
  }
  if (session.stakes === 'free') fulfillWish(s, 'ma', 'ma_cards', 'partial', ev);
  else {
    const total = Object.values(chips).reduce((a, b) => a + b, 0);
    s.cash += total; s.ledger.income += total;
    s.flags.gambles = (s.flags.gambles || 0) + 1;
    fulfillWish(s, 'ma', 'ma_cards', 'exact', ev);
  }
  const unit = session.stakes === 'free' ? '根火柴' : '块';
  const tally = session.players.map((id) => `${NAMES[id]}${chips[id] - session.buyIn >= 0 ? '+' : ''}${chips[id] - session.buyIn}${unit}`).join('、');
  const game = session.game === 'texas' ? '德州' : '炸金花';
  s.log.unshift(`夜里打了${session.hand}手${game}（${session.stakes === 'free' ? '火柴棍' : '真钱'}）：${tally}。${session.stakes === 'free' ? '三人精神+6，' : ''}熬夜体力-5。`);
  for (const m of ev) s.log.unshift(m);
  s.pending.cards = null;
}

export function finishCardNight(input) {
  if (!input.pending?.cards) return { state: input, error: '没有开着的牌局' };
  const s = copy(input);
  settleCardNight(s, s.pending.cards);
  s.stateRevision += 1;
  return { state: s };
}

function runNightBlackjack(s) {
  let guard = 0;
  while (!s.pending.cards.cur.over && s.pending.cards.cur.turn !== s.pending.cards.controller && guard++ < 100) {
    const action = blackjackLocalDecision(s.pending.cards, s.pending.cards.cur.turn);
    if (!action) throw new Error('夜间二十一点本地行动失败');
    s.pending.cards = blackjackAct(s.pending.cards, action).state;
  }
  if (guard >= 100) throw new Error('夜间二十一点超出行动上限');
}
