// 旧 v2（28 日）存档不自动迁移。
import { IDS, copy } from './engine.js';
import { freshStock } from './shop.js';
import { makeItem } from './items.js';
import { FISHING_SKILL_DEFAULT } from './fishing.js';
import { itemDef } from './items.js';
import { slotOfHour } from './clock.js';
import { freshCasinoVenue, validateCasinoState } from './casino-contract.js';
import { assertCasinoReplay } from './casino-replay.js';
import { normalizeWorkGames, validateWorkGames } from './work-games-save.js';
import { beginDayReport, normalizeDayReport, validateDayReport } from './day-report.js';
import { FURNITURE_SLOTS, validateFurnitureState } from './furniture.js';

export const SAVE_KEY = 'jinwan-shui-naer-v3';

export function normalizeSave(input) {
  const s = copy(input);
  if (s.version !== 3 && s.version !== 4) return s;
  const stock = freshStock();
  for (const [shopId, entry] of Object.entries(stock)) {
    if (!s.shops[shopId]) s.shops[shopId] = copy(entry);
    else for (const [itemId, count] of Object.entries(entry.stock)) {
      if (!Object.hasOwn(s.shops[shopId].stock, itemId)) s.shops[shopId].stock[itemId] = count;
    }
  }
  for (const [shopId, itemId] of [['convenience', 'fish_bait'], ['convenience', 'fishing_rod'], ['art_hardware', 'fishing_rod_pro'], ...['cigarette_regular', 'cigarette_premium', 'beer_bottle', 'baijiu', 'vodka', 'ticket_10', 'ticket_20'].map((id) => ['convenience', id]), ...['ticket_10', 'ticket_20'].map((id) => ['lottery_kiosk', id]), ...['beer_bottle', 'baijiu', 'vodka'].map((id) => ['tavern', id])]) {
    const current = s.shops?.[shopId]?.stock;
    if (current && !Object.hasOwn(current, itemId)) current[itemId] = stock[shopId].stock[itemId];
  }
  if (s.metMa && s.actors?.ma?.life !== 'unrecruited' && !s.flags?.maCardsGranted) {
    if (!s.items.some((it) => it.itemId === 'cards')) makeItem(s, 'cards', 'ma');
    s.flags ??= {};
    s.flags.maCardsGranted = true;
  }
  for (const id of IDS) {
    const actor = s.actors?.[id];
    if (actor && !Object.hasOwn(actor, 'fishingSkill')) actor.fishingSkill = FISHING_SKILL_DEFAULT[id];
    if (actor && !Object.hasOwn(actor, 'fishingDryStreak')) actor.fishingDryStreak = 0;
  }
  if (s.pending && !Object.hasOwn(s.pending, 'riverFight')) s.pending.riverFight = null;
  s.pending ??= {};
  if (!Object.hasOwn(s.pending, 'fishingQte')) s.pending.fishingQte = [];
  if (!Object.hasOwn(s.pending, 'casino')) s.pending.casino = null;
  if (!Object.hasOwn(s, 'casinoVenue')) s.casinoVenue = freshCasinoVenue();
  if (s.version === 3) {
    s.version = 4;
    const tail = s.day === 100 && ['tail', 'ending', 'gameover'].includes(s.phase) && s.turn >= 400;
    s.hour = tail ? 22 + Math.max(0, Math.min(2, s.turn - 400)) : 6 + s.slot * 4;
    s.hourTick = tail ? 1600 : (s.day - 1) * 16 + s.slot * 4;
    if (tail) s.slot = 3;
    // 旧存档没有已完成行动计数；零值只影响新计数器，不重放已完成槽。
    s.actionCount = 0;
    s.busy = Object.fromEntries(IDS.map((id) => [id, null]));
    for (const id of IDS) {
      const previous = s.plan[id];
      s.plan[id] = Array(16).fill(null);
      if (!tail) for (let slot = s.slot; slot < 4; slot++) {
        const task = previous[slot];
        s.plan[id][slot * 4] = task ? { ...task, hours: task.hours ?? 1 } : null;
      }
      s.actors[id].coffeeCredit = 0;
      s.actors[id].hangoverDay = null;
    }
    s.daily.coffeeCups = Object.fromEntries(IDS.map((id) => [id, 0]));
    s.daily.coffeeUnits = Object.fromEntries(IDS.map((id) => [id, 0]));
    for (const id of IDS) for (let slot = 0; slot < 4; slot++) {
      if (s.daily.errands[`${id}:${slot}`]) for (let hour = 6 + slot * 4; hour < 10 + slot * 4; hour++) {
        s.daily.errands[`${id}:${hour}`] = true;
      }
    }
    s.meta = { ...s.meta, migrationFrom3: true };
  } else {
    if (s.daily.coffeeUnits === undefined) s.daily.coffeeUnits = {};
    for (const id of IDS) if (!Object.hasOwn(s.daily.coffeeUnits, id)) {
      s.daily.coffeeUnits[id] = s.daily.coffeeCups[id] * 2;
    }
  }
  if (s.camp && !Object.hasOwn(s.camp, 'furnitureVersion')) {
    const oldBeds = s.camp.beds;
    s.camp.furnitureVersion = 1;
    s.camp.floorSheets = s.metMa || s.actors?.ma?.life !== 'unrecruited' ? 3 : 2;
    s.camp.placements = [];
    s.camp.parcels = [];
    s.camp.parcelSeq = 0;
    s.daily.tableMeals = Object.fromEntries(IDS.map(id => [id, 0]));
    s.itemSeq = Math.max(s.itemSeq || 0, ...s.items.map(it => /^it([1-9]\d*)$/.test(it.uid) ? Number(it.uid.slice(2)) : 0));
    for (let i = 0; i < oldBeds; i++) {
      const item = makeItem(s, 'legacy_bed', 'camp');
      s.camp.placements.push({ uid: item.uid, slot: FURNITURE_SLOTS[i].id, rotation: 0 });
    }
    for (const id of IDS) for (const task of s.plan[id]) if (task?.id === 'bed') task.id = 'rest';
  }
  normalizeDayReport(s);
  if (!s.daily.report) beginDayReport(s, { partial: true });
  return normalizeWorkGames(s);
}

const casinoMoney = (n) => Number.isSafeInteger(n) && n >= 0 && n <= 1_000_000_000;
const casinoObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const casinoSeats = ['xuan', 'fan', 'ma', 'hall_lan', 'hall_qiao'];

function checkCasinoTable(state) {
  const c = state.pending?.casino;
  if (c === undefined || c === null) return;
  if (!casinoObject(c) || c.seed !== state.seed || c.day > state.day || c.hourTick > state.hourTick ||
    c.day < 1 || c.hourTick < 0 || c.hourTick > 1600 || c.casinoSeq < 1 ||
    c.phase === 'invited' && (c.handSeq !== 0 || c.actionSeq !== 0 || c.appliedActionIds.length !== 0 || c.game !== null)) throw new Error('牌局身份或阶段无效');
  if (c.phase === 'invited') return;
  if (c.phase !== 'playing' && c.phase !== 'settled') throw new Error('牌局阶段无效');
  if (!['zjh', 'texas', 'blackjack'].includes(c.game) || !casinoObject(c.session)) throw new Error('牌局会话无效');
  const s = c.session;
  if (s.game !== c.game || s.sessionId !== c.sessionId || s.seed !== c.seed ||
    !Number.isSafeInteger(s.handSeq) || s.handSeq !== c.handSeq || s.handSeq < 0 ||
    !Array.isArray(s.players) || s.players.length < 1 || s.players.length > 5 ||
    new Set(s.players).size !== s.players.length || !s.players.includes(c.actorId) ||
    s.players.some((id) => !casinoSeats.includes(id)) || s.controller !== c.actorId ||
    !casinoObject(s.chips) || Object.keys(s.chips).length !== s.players.length ||
    s.players.some((id) => !casinoMoney(s.chips[id]))) throw new Error('牌局座位或资金无效');
  if (c.game === 'blackjack') {
    if (s.dealerId !== 'hall_dealer' || !casinoMoney(s.bank) || !Number.isSafeInteger(s.maxHands) ||
      s.maxHands < 1 || s.maxHands > 5 || s.handSeq > s.maxHands) throw new Error('二十一点资金无效');
  } else if (!Number.isSafeInteger(s.hand) || s.hand < 0 || s.hand > 5 ||
    s.hand !== s.handSeq || !Number.isSafeInteger(s.dealer) || s.dealer < 0 || s.dealer >= s.players.length) throw new Error('扑克手数无效');
  const cur = s.cur;
  let pot = 0;
  if (cur !== null) {
    if (!casinoObject(cur) || !Array.isArray(cur.deck) || cur.deck.length !== 52 ||
      new Set(cur.deck).size !== 52 || cur.deck.some((n) => !Number.isInteger(n) || n < 0 || n > 51) ||
      !Number.isInteger(cur.di) || cur.di < 0 || cur.di > 52) throw new Error('牌堆无效');
    const shown = [];
    if (c.game === 'blackjack') {
      if (!casinoObject(cur.hands) || !Array.isArray(cur.dealerCards) || !casinoObject(cur.bets) ||
        Object.keys(cur.hands).length !== s.players.length || Object.keys(cur.bets).length !== s.players.length ||
        s.players.some((id) => !Array.isArray(cur.hands[id]) || cur.hands[id].length < 2 || !casinoMoney(cur.bets[id]))) throw new Error('二十一点手牌无效');
      for (const id of s.players) { shown.push(...cur.hands[id]); if (!cur.over) pot += cur.bets[id]; }
      shown.push(...cur.dealerCards);
      if (cur.dealerCards.length < 2 || cur.turn !== null && cur.turn !== s.dealerId && !s.players.includes(cur.turn)) throw new Error('二十一点行动者无效');
    } else {
      if (!Array.isArray(cur.order) || cur.order.length !== s.players.length ||
        new Set(cur.order).size !== s.players.length || cur.order.some((id) => !s.players.includes(id)) ||
        cur.dealerId !== s.players[s.dealer] || !casinoMoney(cur.pot) ||
        cur.turn !== null && !s.players.includes(cur.turn)) throw new Error('扑克牌桌无效');
      if (!cur.over) pot = cur.pot;
      const pockets = c.game === 'zjh' ? cur.hands : cur.hole;
      if (!casinoObject(pockets) || Object.keys(pockets).length !== s.players.length ||
        s.players.some((id) => !Array.isArray(pockets[id]) || pockets[id].length !== (c.game === 'zjh' ? 3 : 2))) throw new Error('扑克底牌无效');
      for (const id of s.players) shown.push(...pockets[id]);
      if (c.game === 'texas') {
        if (!Array.isArray(cur.board) || cur.board.length > 5) throw new Error('公共牌无效');
        shown.push(...cur.board);
      }
      if (cur.hand !== s.hand) throw new Error('扑克手数不匹配');
    }
    if (shown.some((n) => !Number.isInteger(n) || n < 0 || n > 51 || !cur.deck.slice(0, cur.di).includes(n)) ||
      new Set(shown).size !== shown.length) throw new Error('已发牌与牌堆不匹配');
  } else if (s.handSeq !== 0 && c.phase === 'playing') throw new Error('进行中牌局缺少手牌');
  if (c.phase === 'playing') {
    const escrow = Object.values(c.escrow).reduce((a, b) => a + b, 0);
    const chips = Object.values(s.chips).reduce((a, b) => a + b, 0);
    if (escrow !== chips + pot + (c.game === 'blackjack' ? s.bank : 0)) throw new Error('托管与牌桌资金不平');
  }
  assertCasinoReplay(c);
}

export function validateSave(s) {
  try {
    if (!s || typeof s !== 'object') return { ok: false, reason: '不是存档对象' };
    if (s.version === 2) return { ok: false, reason: '这是旧版 28 日原型存档，100 日版不自动迁移；请新开局' };
    if (s.version !== 3 && s.version !== 4) return { ok: false, reason: '存档版本不识别' };
    if (!Number.isInteger(s.seed) || !Number.isInteger(s.day) || s.day < 1 || s.day > 100) return { ok: false, reason: '日期或种子无效' };
    if (![0, 1, 2, 3].includes(s.slot) || !Number.isInteger(s.turn) || s.turn < 0 || s.turn > 402) return { ok: false, reason: '回合无效' };
    if (!['planning', 'meeting', 'tail', 'ending', 'gameover'].includes(s.phase)) return { ok: false, reason: '阶段无效' };
    if (s.version === 4) {
      const normal = s.hour <= 21 && !['tail', 'ending'].includes(s.phase);
      if (!Number.isInteger(s.hour) || (normal && (s.hour < 6 || s.hour > 21)) || (!normal && (s.day !== 100 || s.hour < 22 || s.hour > 24)) ||
        s.slot !== (normal ? slotOfHour(s.hour) : 3) ||
        !Number.isInteger(s.hourTick) || s.hourTick !== (normal ? (s.day - 1) * 16 + s.hour - 6 : 1600) ||
        !Number.isSafeInteger(s.actionCount) || s.actionCount < 0 || s.actionCount > 4800 ||
        (normal && s.turn !== (s.day - 1) * 4 + s.slot) ||
        (!normal && s.turn !== 400 + s.hour - 22)) return { ok: false, reason: '回合无效' };
    }
    if (!Number.isInteger(s.cash) || s.cash < 0 || s.cash > 10000000) return { ok: false, reason: '现金无效' };
    for (const id of IDS) {
      const p = s.actors?.[id];
      if (!p || !['unrecruited', 'active', 'downed', 'dead'].includes(p.life)) return { ok: false, reason: '角色状态无效' };
      for (const k of ['health', 'food', 'energy', 'warmth', 'mind', 'hygiene']) if (!Number.isInteger(p[k]) || p[k] < 0 || p[k] > 100) return { ok: false, reason: '角色数值越界' };
      if (p.fishingSkill !== undefined && (!Number.isInteger(p.fishingSkill) || p.fishingSkill < 0 || p.fishingSkill > 100)) return { ok: false, reason: '钓鱼熟练度无效' };
      if (p.fishingDryStreak !== undefined && (!Number.isInteger(p.fishingDryStreak) || p.fishingDryStreak < 0 || p.fishingDryStreak > 10000)) return { ok: false, reason: '空钩次数无效' };
      if (!Array.isArray(s.plan?.[id]) || s.plan[id].length !== (s.version === 4 ? 16 : 4)) return { ok: false, reason: '排程结构无效' };
      if (s.version === 4) {
        const units = s.daily?.coffeeUnits;
        if (!Number.isInteger(p.coffeeCredit) || p.coffeeCredit < 0 || p.coffeeCredit > 180 ||
          !(p.hangoverDay === null || (Number.isInteger(p.hangoverDay) && p.hangoverDay >= 1 && p.hangoverDay <= 101)) ||
          !Number.isInteger(s.daily?.coffeeCups?.[id]) || s.daily.coffeeCups[id] < 0 || s.daily.coffeeCups[id] > 18 ||
          (units !== undefined && (units === null || typeof units !== 'object' || Array.isArray(units) ||
            (Object.hasOwn(units, id) && (!Number.isInteger(units[id]) || units[id] < 0 || units[id] > 36))))) return { ok: false, reason: '咖啡状态无效' };
        const busy = s.busy?.[id];
        if (busy !== null && (!busy || typeof busy.jobId !== 'string' || !busy.jobId ||
          !Number.isInteger(busy.startedHour) || busy.startedHour < 6 || busy.startedHour > 21 ||
          !Number.isInteger(busy.remainingHours) || busy.remainingHours < 1 || busy.remainingHours > 4 ||
          !busy.task || typeof busy.task !== 'object' || !Number.isInteger(busy.task.hours) || busy.task.hours < 1 || busy.task.hours > 4 ||
          (s.hour >= 6 && s.hour <= 21 && busy.startedHour > s.hour))) return { ok: false, reason: '忙碌状态无效' };
        for (const task of s.plan[id]) if (task !== null && (typeof task !== 'object' || !Number.isInteger(task.hours) || task.hours < 1 || task.hours > 4)) return { ok: false, reason: '排程结构无效' };
      }
    }
    if (!Array.isArray(s.items) || !Array.isArray(s.wishes) || !Array.isArray(s.events) || !s.shops || !s.daily) return { ok: false, reason: '缺少子系统数据' };
    if (!s.camp || (Object.hasOwn(s.camp, 'furnitureVersion') && s.camp.furnitureVersion !== 1)) return { ok: false, reason: '家具版本无效' };
    if (!Object.hasOwn(s.camp, 'furnitureVersion')) {
      if (!Number.isInteger(s.camp.beds) || s.camp.beds < 0 || s.camp.beds > 3 ||
        !Number.isSafeInteger(s.itemSeq) || s.itemSeq < 0 ||
        new Set(s.items.map(item => item.uid)).size !== s.items.length ||
        ['floorSheets', 'placements', 'parcels', 'parcelSeq'].some(key => Object.hasOwn(s.camp, key)) ||
        s.daily.tableMeals !== undefined) return { ok: false, reason: '旧家具状态无效' };
    } else {
      const furniture = validateFurnitureState(s);
      if (!furniture.ok) return furniture;
      if (!s.daily.tableMeals || Object.keys(s.daily.tableMeals).sort().join() !== 'fan,ma,xuan' ||
        IDS.some(id => !Number.isInteger(s.daily.tableMeals[id]) || s.daily.tableMeals[id] < 0 || s.daily.tableMeals[id] > 2)) return { ok: false, reason: '同桌用餐次数无效' };
    }
    const workGames = validateWorkGames(s);
    if (!workGames.ok) return workGames;
    if (!validateDayReport(s)) return { ok: false, reason: '每日报告无效' };
    const riverFight = s.pending?.riverFight;
    if (riverFight !== undefined && riverFight !== null && (
      s.version !== 4 || typeof riverFight !== 'object' || Array.isArray(riverFight) ||
      Object.keys(riverFight).length !== 7 ||
      riverFight.kind !== 'riverFight' || riverFight.actorId !== 'ma' || riverFight.seed !== s.seed ||
      !Number.isInteger(riverFight.day) || riverFight.day < 1 || riverFight.day > s.day ||
      !Number.isInteger(riverFight.hourTick) || riverFight.hourTick < 0 || riverFight.hourTick > 1600 || riverFight.hourTick > s.hourTick ||
      riverFight.id !== `riverFight:${s.seed}:${riverFight.day}:${riverFight.hourTick}:ma` ||
      riverFight.line !== '这个鱼就是欠干'
    )) return { ok: false, reason: '河边事件无效' };
    const fishingQte = s.pending?.fishingQte;
    if (fishingQte !== undefined && (!Array.isArray(fishingQte) || fishingQte.length > 3 ||
      new Set(fishingQte.map((bite) => bite?.id)).size !== fishingQte.length ||
      fishingQte.some((bite) => !casinoObject(bite) || Object.keys(bite).length !== 8 ||
        !IDS.includes(bite.actorId) || !Number.isInteger(bite.day) || bite.day < 1 || bite.day > s.day ||
        !Number.isInteger(bite.hourTick) || bite.hourTick < 0 || bite.hourTick > s.hourTick || bite.hourTick > 1600 ||
        !Number.isInteger(bite.skill) || bite.skill < 0 || bite.skill > 100 ||
        !['fish_common', 'fish_rare'].includes(bite.fishItemId) ||
        !Number.isInteger(bite.zoneStart) || bite.zoneStart < 0 || bite.zoneStart > 359 ||
        bite.zoneWidth !== 40 + 0.8 * bite.skill ||
        bite.id !== `fishQte:${s.seed}:${bite.day}:${bite.hourTick}:${bite.actorId}`))) return { ok: false, reason: '收线挑战无效' };
    if (s.casinoVenue !== undefined || s.pending?.casino !== undefined) {
      if (s.casinoVenue === undefined && s.pending?.casino != null) return { ok: false, reason: '牌局缺少棋牌馆资金' };
      if (s.casinoVenue !== undefined) {
        validateCasinoState(s);
        checkCasinoTable(s);
      }
    }
    if (s.items.length > 2000 || s.wishes.length > 500 || s.events.length > 500) return { ok: false, reason: '存档异常膨胀' };
    for (const it of s.items) if (typeof it.uid !== 'string' || typeof it.itemId !== 'string' || typeof it.container !== 'string') return { ok: false, reason: '物品实例无效' };
    if (s.wishAiDay && (typeof s.wishAiDay !== 'object' || Object.entries(s.wishAiDay).some(([id, day]) => !IDS.includes(id) || !Number.isInteger(day) || day < 1 || day > s.day))) return { ok: false, reason: '愿望日期无效' };
    for (const w of s.wishes) if (w.targetItem && (!itemDef(w.targetItem) || typeof w.reason !== 'string' || w.reason.length > 100 || typeof w.indirectLine !== 'string' || w.indirectLine.length > 60 || !['ai','local'].includes(w.source))) return { ok: false, reason: '物品愿望无效' };
    if (s.ledger.start + s.ledger.income - s.ledger.expense !== s.cash) return { ok: false, reason: '账本与现金对不上' };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: '存档损坏：' + e.message };
  }
}
