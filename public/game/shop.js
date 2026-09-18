// 店铺：营业时段、每日库存、同街区购买校验、彩票票券。
import { getData, indexById } from './data.js';
import { makeItem, itemDef } from './items.js';
import { rng } from './rng.js';
import { ticketOutcome } from './rules.js';
import { createFurnitureParcel } from './furniture.js';

// 每日清晨补货的基准库存；限量品另有刷新周期。
const STOCK = {
  convenience: { meal: 6, bread: 6, tea: 3, coffee: 3, soda: 4, cigarette: 3, cigarette_regular: 2, cigarette_premium: 1, lighter: 2, charcoal_cheap: 6, charcoal_quality: 4, charcoal_smokeless: 3, beer: 6, spirit: 2, beer_bottle: 3, baijiu: 2, vodka: 1, soap: 3, towel: 1, wipes: 3, toothbrush: 2, toothpaste: 2, detergent: 2, socks: 2, clean_clothes: 1, trash_bag: 3, cards: 1, ticket: 12, ticket_10: 8, ticket_20: 5, blanket: 1, underwear: 2, fish_bait: 8, fishing_rod: 2 },
  lottery_kiosk: { ticket: 20, ticket_10: 12, ticket_20: 8 },
  recycle_shop: { electronic_part: 5, headphones: 1, keyboard: 1, shoes: 1, camera: 1 },
  pharmacy: { soap: 2, wipes: 2, toothbrush: 1, toothpaste: 1, bandage: 4, cleaning_care: 3, rehydration: 3, symptom_relief: 2, care_course: 2, thermometer: 1 },
  bathhouse: { bath_service: 9 },
  art_hardware: { paper_set: 4, paint: 3, tape: 3, rain_cover: 2, lighter: 2, charcoal_cheap: 6, charcoal_quality: 4, charcoal_smokeless: 3, towel: 1, gloves: 2, fishing_rod_pro: 1 },
  tavern: { meal: 4, hot_soup: 4, beer: 6, spirit: 2 },
  clinic: { clinical_visit: 6, care_course: 2 },
  coffee_shop: { espresso: 6, americano: 6, latte: 4, cappuccino: 4, mocha: 3, cold_brew: 5 },
  furniture_store: { bed_basic: 2, bed_comfort: 2, dining_table: 2, chair: 3, sofa: 3, cabinet: 3, lamp: 3, rug: 3 },
};
// 限量品不每天补：售出后隔这么多天回货。
const RESTOCK_DAYS = { headphones: 8, keyboard: 8, shoes: 6, camera: 999, blanket: 3, clean_clothes: 2 };

export function freshStock() {
  const out = {};
  for (const [shopId, table] of Object.entries(STOCK)) out[shopId] = { stock: { ...table }, soldOut: {}, closedSlots: [] };
  return out;
}

export function restockMorning(state) {
  for (const [shopId, table] of Object.entries(STOCK)) {
    const s = state.shops[shopId];
    s.closedSlots = [];
    for (const [itemId, n] of Object.entries(table)) {
      if (RESTOCK_DAYS[itemId]) {
        const back = s.soldOut[itemId];
        if (back && state.day >= back) { s.stock[itemId] = n; delete s.soldOut[itemId]; }
        else if (!back) s.stock[itemId] = Math.max(s.stock[itemId] || 0, n);
      } else s.stock[itemId] = n;
    }
  }
}

export function shopDef(shopId) {
  return indexById(getData().shops)[shopId];
}

// 关门原因，null 表示开门。寒潮日（71-74）便利店只开日间午后，彩票亭关。
export function shopClosedReason(state, shopId, slot) {
  const def = shopDef(shopId);
  if (!def) return '没有这家店';
  if (state.day < def.unlockDay) return '第' + def.unlockDay + '天起才认识这家店';
  if (!def.openSlots.includes(slot)) return '本时段不营业';
  if (state.shops[shopId]?.closedSlots.includes(slot)) return '今天提前关门';
  if (state.day >= 71 && state.day <= 74) {
    if (shopId === 'lottery_kiosk') return '寒潮期间不开';
    if (shopId === 'convenience' && !(slot === 1 || slot === 2)) return '寒潮期间只开日间与午后';
  }
  return null;
}

export function shopsInDistrict(districtId) {
  return getData().shops.filter((s) => s.district === districtId).map((s) => s.id);
}

export function itemPrice(itemId) {
  return itemDef(itemId).price;
}

// 校验一张购物清单：cart = [{shopId, itemId, qty}]，all in one district。
export function validateCart(state, actorId, districtId, slot, cart) {
  if (!Array.isArray(cart) || cart.length === 0) return { error: '购物清单为空' };
  let total = 0;
  const need = {};
  for (const line of cart) {
    const def = shopDef(line.shopId);
    if (!def) return { error: '没有这家店' };
    if (def.district !== districtId) return { error: def.name + '不在' + districtId + '街区' };
    const closed = shopClosedReason(state, line.shopId, slot);
    if (closed) return { error: def.name + '：' + closed };
    const item = itemDef(line.itemId);
    if (!item || !item.shopIds.includes(line.shopId)) return { error: def.name + '不卖这件东西' };
    if (!Number.isInteger(line.qty) || line.qty < 1 || line.qty > 20) return { error: '数量无效' };
    const key = line.shopId + '|' + line.itemId;
    need[key] = (need[key] || 0) + line.qty;
    if ((state.shops[line.shopId].stock[line.itemId] || 0) < need[key]) return { error: def.name + '的' + item.name + '库存不足（剩' + (state.shops[line.shopId].stock[line.itemId] || 0) + '）' };
    if (item.category === 'lottery' && state.actors[actorId].intox > 0) return { error: '有醉意不能购买彩票' };
    total += item.price * line.qty;
  }
  return { total };
}

// 执行购买：扣库存、生成实例、彩票锁结果。返回生成的实例列表。
export function executeCart(state, actorId, cart, destination) {
  const made = [];
  const furnitureUids = [];
  for (const line of cart) {
    for (let i = 0; i < line.qty; i++) {
      const s = state.shops[line.shopId];
      s.stock[line.itemId] -= 1;
      if (RESTOCK_DAYS[line.itemId] && s.stock[line.itemId] <= 0) s.soldOut[line.itemId] = state.day + RESTOCK_DAYS[line.itemId];
      let opts = {};
      if (itemDef(line.itemId).category === 'lottery') {
        state.ticketSeq = (state.ticketSeq || 0) + 1;
        const ticketId = 't' + state.ticketSeq;
        const price = itemDef(line.itemId).price;
        const payout = ticketOutcome(actorId, rng(state.seed, 'ticket:' + ticketId), getData().rules) * (price / getData().rules.gambling.ticketPrice);
        const style = line.itemId === 'ticket_10' ? 'bells' : line.itemId === 'ticket_20' ? 'goodday' : 'street';
        opts.ticket = { ticketId, buyer: actorId, price, style, payout, scratched: false, claimed: false };
        state.daily.bets += 1;
      }
      const inst = makeItem(state, line.itemId, destination === 'camp' ? 'camp' : actorId, opts);
      made.push(inst);
      if (itemDef(line.itemId).category === 'furniture') furnitureUids.push(inst.uid);
    }
  }
  if (furnitureUids.length) createFurnitureParcel(state, furnitureUids);
  return made;
}

// 刮票只是演出：写回 scratched，不改结果。
export function scratchTicket(state, uid) {
  const inst = state.items.find((x) => x.uid === uid);
  if (!inst || !inst.ticket) return { error: '没有这张票' };
  if (inst.ticket.scratched) return { error: '已经刮开' };
  inst.ticket.scratched = true;
  return { payout: inst.ticket.payout };
}

// 核销：持票人必须在售票店所在街区且店开门；只成功一次。
export function claimTicket(state, actorId, uid) {
  const inst = state.items.find((x) => x.uid === uid);
  if (!inst || !inst.ticket) return { error: '没有这张票' };
  if (!inst.ticket.scratched) return { error: '先刮开再核销' };
  if (inst.ticket.claimed) return { error: '这张票已经核销过' };
  if (inst.container !== actorId) return { error: '票不在这个人手里' };
  const p = state.actors[actorId];
  const here = getData().shops.filter((s) => s.district === p.location && s.categories.includes('lottery'));
  const open = here.find((s) => !shopClosedReason(state, s.id, state.slot));
  if (!open) return { error: '人不在开着门的售票点（便利店或彩票亭）' };
  inst.ticket.claimed = true;
  const won = inst.ticket.payout;
  state.cash += won;
  state.ledger.income += won;
  state.items = state.items.filter((x) => x.uid !== uid);
  return { payout: won, shop: open.name };
}

// 记录已刮开的格子（演出进度），全部刮开即标记 scratched。不改结果。
export function revealTicketCells(state, uid, indices, total) {
  const inst = state.items.find((x) => x.uid === uid);
  if (!inst || !inst.ticket) return { error: '没有这张票' };
  const set = new Set(inst.ticket.revealed || []);
  for (const i of indices) set.add(i);
  inst.ticket.revealed = [...set].sort((a, b) => a - b);
  if (inst.ticket.revealed.length >= total) inst.ticket.scratched = true;
  return { ok: true, scratched: inst.ticket.scratched };
}
