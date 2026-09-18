// 物品实例与四个容器（xuan/fan/ma 背包 + camp 营地箱）。
// 一件一实例：{uid, itemId, container, uses, obtainedTurn, expiresDay, wet, dirty, ticket}
import { getData, indexById } from './data.js';

const FOOD_IDS = ['meal', 'bread', 'hot_soup', 'fish_common_cooked', 'fish_rare_cooked', 'meal_hot', 'bread_toasted', 'hot_soup_heated'];
const PERISHABLE_IDS = new Set([...FOOD_IDS, 'fish_common', 'fish_rare']);
export const FOOD_VALUE = { meal: 30, bread: 18, hot_soup: 26, fish_common_cooked: 32, fish_rare_cooked: 46, meal_hot: 35, bread_toasted: 23, hot_soup_heated: 31 };

// 设计数据之外的两件开局旧设备：不出售、不消耗，只在这里定义。
export const EXTRA_ITEMS = {
  legacy_bed: { id: 'legacy_bed', name: '旧床', category: 'furniture', price: 0, uses: 1, effectText: '旧营地保留的床位', shopIds: [] },
  broken_phone: { id: 'broken_phone', name: '坏手机', category: 'device', price: 0, uses: 1, effectText: '翻桶捡的，屏碎了；轩哥用1个零件能修好', shopIds: [] },
  broken_radio: { id: 'broken_radio', name: '坏收音机', category: 'device', price: 0, uses: 1, effectText: '没声；轩哥用1个零件能修好，修好放营地每晚听广播', shopIds: [] },
  broken_headphones: { id: 'broken_headphones', name: '坏耳机', category: 'device', price: 0, uses: 1, effectText: '一边不响；轩哥用1个零件能修好', shopIds: [] },
  broken_tv: { id: 'broken_tv', name: '坏电视', category: 'device', price: 0, uses: 1, effectText: '熟人给的旧电视；要修理桌和2个零件才能修', shopIds: [] },
  phone: { id: 'phone', name: '修好的手机', category: 'device', price: 0, uses: 1, effectText: '卖给老周24；留着能给不在身边的同伴发消息', shopIds: [] },
  radio: { id: 'radio', name: '收音机', category: 'device', price: 0, uses: 1, effectText: '放营地箱里，每晚播天气、招工和店铺消息', shopIds: [] },
  tv: { id: 'tv', name: '修好的电视', category: 'device', price: 0, uses: 1, effectText: '卖给老周60；留在营地能放片给人看', shopIds: [] },
  gloves: { id: 'gloves', name: '劳保手套', category: 'tool', price: 8, uses: 1, effectText: '翻垃圾桶多翻2格，并能看出哪格是脏物', shopIds: ['art_hardware'] },
  toolkit: { id: 'toolkit', name: '鲁叔的工具箱', category: 'tool', price: 0, uses: 1, effectText: '借来的：每天一次维修不耗零件；到期要还', shopIds: [] },
  cart: { id: 'cart', name: '老陈的推车', category: 'tool', price: 0, uses: 1, effectText: '借来的：搬运短工收入+6；到期要还', shopIds: [] },
  studio_pass: { id: 'studio_pass', name: '许姐的工作位', category: 'tool', price: 0, uses: 1, effectText: '借来的：剪辑不占唯一电脑；到期要还', shopIds: [] },
  thermos: { id: 'thermos', name: '刘姐的保温桶', category: 'tool', price: 0, uses: 1, effectText: '借来的：晚间每人饱食+5；到期要还', shopIds: [] },
  promo_video: { id: 'promo_video', name: '商户宣传片', category: 'device', price: 0, uses: 1, effectText: '三人接力做出来的成品：送到老街交付换报酬', shopIds: [] },
  butts: { id: 'butts', name: '捡来的烟头', category: 'tobacco', price: 0, uses: 1, effectText: '翻桶捡的半截烟：精神+2、卫生-3，需要火', shopIds: [] },
  old_camera: { id: 'old_camera', name: '旧相机', category: 'device', price: 0, uses: 1, effectText: '开局带来的旧相机，能拍；耗电量', shopIds: [] },
  old_computer: { id: 'old_computer', name: '旧笔记本', category: 'device', price: 0, uses: 1, effectText: '开局带来的旧电脑，键盘坏了一半', shopIds: [] },
  fish_common_cooked: { id: 'fish_common_cooked', name: '篝火烤鱼', category: 'food', price: 0, uses: 1, effectText: '篝火烤熟的常见鱼，饱食+32', shopIds: [] },
  fish_rare_cooked: { id: 'fish_rare_cooked', name: '篝火烤少见鱼', category: 'food', price: 0, uses: 1, effectText: '篝火烤熟的少见鱼，饱食+46', shopIds: [] },
  meal_hot: { id: 'meal_hot', name: '热盒饭', category: 'food', price: 0, uses: 1, effectText: '篝火加热的盒饭，饱食+35', shopIds: [] },
  bread_toasted: { id: 'bread_toasted', name: '烤面包', category: 'food', price: 0, uses: 1, effectText: '篝火烤过的面包，饱食+23', shopIds: [] },
  hot_soup_heated: { id: 'hot_soup_heated', name: '加热的汤', category: 'food', price: 0, uses: 1, effectText: '篝火加热的汤，饱食+31', shopIds: [] },
};
export const DURABLE = new Set(['device', 'tool']);

export function itemDef(itemId) {
  if (EXTRA_ITEMS[itemId]) return EXTRA_ITEMS[itemId];
  const items = indexById(getData().items);
  return items[itemId];
}

export function makeItem(state, itemId, container, opts = {}) {
  const def = itemDef(itemId);
  if (!def) throw new Error('未知物品 ' + itemId);
  state.itemSeq = (state.itemSeq || 0) + 1;
  const inst = {
    uid: 'it' + state.itemSeq,
    itemId,
    container,
    uses: def.uses,
    obtainedTurn: state.turn,
    expiresDay: def.shelfLifeDays ? state.day + def.shelfLifeDays : null,
    wet: false,
    dirty: false,
  };
  if (opts.ticket) inst.ticket = opts.ticket;
  state.items.push(inst);
  return inst;
}

export function itemsIn(state, container, itemId = null) {
  return state.items.filter((x) => x.container === container && (!itemId || x.itemId === itemId));
}

export function findItem(state, uid) {
  return state.items.find((x) => x.uid === uid) || null;
}

export function removeItem(state, uid) {
  state.items = state.items.filter((x) => x.uid !== uid);
}

// 角色现在能碰到的容器：自己的包永远可及，营地箱要人在营地。
export function accessibleContainers(state, actorId) {
  const p = state.actors[actorId];
  const out = [actorId];
  if (p.location === 'camp') out.push('camp');
  return out;
}

export function accessibleItems(state, actorId, itemId = null) {
  const cs = accessibleContainers(state, actorId);
  const placed = new Set(state.camp?.placements?.map(p => p.uid) || []);
  return state.items.filter((x) => cs.includes(x.container) && !placed.has(x.uid) && (!itemId || x.itemId === itemId));
}

export function isFood(itemId) {
  return FOOD_IDS.includes(itemId);
}

export function foodFresh(state, inst) {
  return isFood(inst.itemId) && (inst.expiresDay === null || inst.expiresDay >= state.day);
}

// 有效食物份数：未过期的正餐/面包/热汤。
export function effectiveFood(state) {
  return state.items.filter((x) => foodFresh(state, x)).length;
}

// 消耗一格；用完删除实例。返回是否成功。
export function consumeUse(state, uid, n = 1) {
  const inst = findItem(state, uid);
  if (!inst || inst.uses < n) return false;
  if (DURABLE.has(itemDef(inst.itemId)?.category)) return true;
  inst.uses -= n;
  if (inst.uses <= 0) removeItem(state, uid);
  return true;
}

// 清掉过期食物，返回丢弃份数。
export function discardExpired(state) {
  const before = state.items.length;
  state.items = state.items.filter((x) => !(PERISHABLE_IDS.has(x.itemId) && x.expiresDay !== null && x.expiresDay < state.day));
  return before - state.items.length;
}

// 给某人吃一份：自己包优先，再营地箱；先吃快过期的。返回吃掉的实例（含 itemId 与 dirty 标签）或 null。
export function eatOne(state, actorId) {
  const cands = state.items
    .filter((x) => foodFresh(state, x) && (x.container === actorId || x.container === 'camp'))
    .sort((a, b) => (a.expiresDay ?? 999) - (b.expiresDay ?? 999) || (a.container === actorId ? -1 : 1));
  const inst = cands[0];
  if (!inst) return null;
  removeItem(state, inst.uid);
  return inst;
}

// 设备只认活人拿得到的：营地箱里的电脑谁都能用（回营取），相机要在包里或营地箱。
export function hasDevice(state, kind) {
  const ids = kind === 'camera' ? ['camera', 'old_camera'] : ['old_computer'];
  return state.items.some((x) => ids.includes(x.itemId) && !x.container.startsWith('relic:'));
}

export function transferItem(state, uid, toContainer) {
  const inst = findItem(state, uid);
  if (!inst) return false;
  if (inst.container.startsWith('parcel:') || state.camp?.placements?.some(p => p.uid === uid)) return false;
  if (typeof toContainer === 'string' && toContainer.startsWith('parcel:')) return false;
  if (itemDef(inst.itemId)?.category === 'furniture' && toContainer !== 'camp') return false;
  inst.container = toContainer;
  return true;
}

// 把一堆实例按 itemId+container 分组给 UI。
export function groupItems(state, container) {
  const map = new Map();
  for (const x of state.items) {
    if (container && x.container !== container) continue;
    const key = x.itemId + '|' + x.container;
    if (!map.has(key)) map.set(key, { itemId: x.itemId, container: x.container, count: 0, uses: 0, uids: [], wet: false, dirty: false, expiresDay: x.expiresDay });
    const g = map.get(key);
    g.count++;
    g.uses += x.uses;
    g.uids.push(x.uid);
    g.wet = g.wet || x.wet;
    g.dirty = g.dirty || x.dirty;
    if (x.expiresDay !== null && (g.expiresDay === null || x.expiresDay < g.expiresDay)) g.expiresDay = x.expiresDay;
  }
  return [...map.values()];
}
