import { itemDef } from './items.js';

export const FACILITIES = {
  repair_table: { name: '修理桌', cost: { wood: 2, parts: 1 }, effectKey: 'repair_table' },
  display_rack: { name: '展架', cost: { wood: 1, cloth: 1 }, effectKey: 'display_rack' },
  drying_rack: { name: '晾晒架', cost: { wood: 1, cloth: 2 }, effectKey: 'drying_rack' },
};

export function hasFacility(state, kind) {
  return state.camp?.facilities?.includes(kind) ?? false;
}

export function canInstall(state, slot, kind) {
  if (slot !== 0 && slot !== 1) return { ok: false, reason: '功能位只能选第1或第2位。' };
  if (!Object.hasOwn(FACILITIES, kind)) return { ok: false, reason: '没有这种营地设施。' };
  if (hasFacility(state, kind)) return { ok: false, reason: '同一种设施只能安装一件。' };
  if (state.camp?.facilities?.[slot] != null) return { ok: false, reason: '请先卸下这个功能位的设施。' };
  const cost = FACILITIES[kind].cost;
  if (Object.entries(cost).some(([resource, qty]) => (state[resource] ?? 0) < qty)) {
    return { ok: false, reason: '安装材料不足。' };
  }
  return { ok: true, reason: '' };
}

export function install(state, slot, kind) {
  const check = canInstall(state, slot, kind);
  if (!check.ok) return { error: check.reason };
  for (const [resource, qty] of Object.entries(FACILITIES[kind].cost)) state[resource] -= qty;
  state.camp ??= {};
  state.camp.facilities ??= [null, null];
  state.camp.facilities[slot] = kind;
  return { text: `第${slot + 1}个功能位装好了${FACILITIES[kind].name}。`, effectKey: kind };
}

export function uninstall(state, slot) {
  if (slot !== 0 && slot !== 1) return { error: '功能位只能选第1或第2位。' };
  const kind = state.camp?.facilities?.[slot];
  if (!Object.hasOwn(FACILITIES, kind)) return { error: '这个功能位没有可卸下的设施。' };
  const refund = {};
  for (const [resource, qty] of Object.entries(FACILITIES[kind].cost)) {
    refund[resource] = Math.floor(qty / 2);
    state[resource] = (state[resource] ?? 0) + refund[resource];
  }
  state.camp.facilities[slot] = null;
  return { text: `卸下了${FACILITIES[kind].name}，各项材料退回一半（向下取整）。`, refund };
}

export function fuelCount(state) {
  return (state.items ?? []).filter((item) => item.uses > 0 && isFuelAvailable(state, item))
    .reduce((sum, item) => sum + item.uses, 0);
}

const FUEL_PRIORITY = ['charcoal_smokeless', 'charcoal_quality', 'charcoal_cheap'];

function isFuelAvailable(state, item) {
  return FUEL_PRIORITY.includes(item.itemId) && (item.container === 'camp' || state.actors?.[item.container]?.life === 'active');
}

export function burnFuel(state, need = 2) {
  const demand = Math.max(0, Math.floor(need));
  let burned = 0;
  const depleted = new Set();
  for (const itemId of FUEL_PRIORITY) {
    for (const item of state.items ?? []) {
      if (burned >= demand) break;
      if (item.itemId !== itemId || item.uses <= 0 || !isFuelAvailable(state, item)) continue;
      const count = Math.min(item.uses, demand - burned);
      item.uses -= count;
      if (item.uses === 0) depleted.add(item.uid);
      burned += count;
      state.flags ??= {};
      const smoke = itemDef(itemId)?.smokePerUnit ?? 0;
      if (smoke) {
        state.flags.fireSmoke = (state.flags.fireSmoke ?? 0) + count * smoke;
        state.flags.smokeSeq = (state.flags.smokeSeq ?? 0) + count;
        state.flags.fireSmokeDay = state.day;
      }
    }
  }
  if (depleted.size) state.items = state.items.filter((item) => !depleted.has(item.uid));
  return burned;
}

export function nightWarmthBonus(state, weatherKind) {
  const need = ['cold', 'coldwave', 'storm'].includes(weatherKind) ? 3 : 2;
  const burned = burnFuel(state, need);
  return burned === 0 ? 0 : burned >= need ? 10 : 4;
}

export function campReport(state) {
  const slots = [0, 1].map((slot) => FACILITIES[state.camp?.facilities?.[slot]]?.name ?? '空位');
  const fuel = fuelCount(state);
  return `营地功能位：${slots.join('、')}；燃料${fuel}单位，够普通天气${Math.floor(fuel / 2)}晚、寒冷天气${Math.floor(fuel / 3)}晚。`;
}
