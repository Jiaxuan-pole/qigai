import { itemDef } from './items.js';

export const FURNITURE_FOOTPRINTS = Object.freeze({
  bed_basic: [130, 44], bed_comfort: [130, 44], legacy_bed: [130, 44],
  dining_table: [148, 52], chair: [46, 45], sofa: [140, 55],
  cabinet: [70, 70], lamp: [30, 35], rug: [110, 65],
});

export const FURNITURE_SLOTS = Object.freeze([
  { id: 'west_1', x: 185, y: 365 }, { id: 'west_2', x: 340, y: 365 },
  { id: 'west_3', x: 900, y: 365 }, { id: 'east_1', x: 1190, y: 365 },
  { id: 'upper_1', x: 185, y: 255 }, { id: 'upper_2', x: 340, y: 255 },
  { id: 'upper_3', x: 500, y: 255 }, { id: 'upper_4', x: 650, y: 255 },
  { id: 'upper_5', x: 900, y: 255 }, { id: 'upper_6', x: 1060, y: 255 },
  { id: 'upper_7', x: 1220, y: 255 }, { id: 'upper_8', x: 1380, y: 255 },
]);

const RESERVED = [
  [34, 75, 108, 465], [1510, 75, 1584, 465],
  [520, 315, 700, 430], [750, 330, 855, 430],
  [1080, 325, 1180, 430], [1325, 350, 1455, 430],
  [108, 430, 1500, 446],
];
const SLOT_BY_ID = new Map(FURNITURE_SLOTS.map(x => [x.id, x]));
const BED_IDS = new Set(['bed_basic', 'bed_comfort', 'legacy_bed']);
const ROTATIONS = new Set([0, 90, 180, 270]);

export function isFurniture(itemId) {
  return Object.hasOwn(FURNITURE_FOOTPRINTS, itemId) &&
    (itemId === 'legacy_bed' || itemDef(itemId)?.category === 'furniture');
}

export function furnitureRect(itemId, slotId, rotation = 0) {
  const slot = SLOT_BY_ID.get(slotId);
  const size = FURNITURE_FOOTPRINTS[itemId];
  if (!slot || !size || !ROTATIONS.has(rotation)) return null;
  const [w, h] = rotation % 180 ? [size[1], size[0]] : size;
  return { x: slot.x, y: slot.y, w, h };
}

function intersects(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function fits(state, uid, slot, rotation) {
  const item = state.items.find(x => x.uid === uid);
  const rect = furnitureRect(item?.itemId, slot, rotation);
  if (!rect || rect.x < 108 || rect.y < 185 || rect.x + rect.w > 1500 || rect.y + rect.h > 430) return false;
  if (RESERVED.some(([x1, y1, x2, y2]) => intersects(rect, { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }))) return false;
  return !state.camp.placements.some(p => {
    if (p.uid === uid) return false;
    const other = state.items.find(x => x.uid === p.uid);
    const occupied = furnitureRect(other?.itemId, p.slot, p.rotation);
    return !occupied || intersects(rect, occupied);
  });
}

function fail(state, error) { return { state, error }; }
function actorError(state, actorId, unpack = false) {
  const actor = state.actors?.[actorId];
  if (!actor || actor.life !== 'active') return '需要可行动的人';
  if (actor.location !== 'camp') return unpack ? '需要人在营地拆包' : '需要人在营地摆放家具';
  if (!['planning', 'arrival'].includes(state.phase)) return '现在不能整理营地';
  return null;
}
function clone(state) { return structuredClone(state); }
function committed(next, message) {
  next.camp.beds = placedBedCount(next);
  next.stateRevision = (next.stateRevision || 0) + 1;
  return { state: next, events: [message] };
}

export function placedBedCount(state) {
  const placed = state.camp?.placements || [];
  return Math.min(3, placed.filter(p => {
    const item = state.items?.find(x => x.uid === p.uid);
    return item?.container === 'camp' && BED_IDS.has(item.itemId);
  }).length);
}

export function hasDiningTable(state) {
  return (state.camp?.placements || []).some(p => {
    const item = state.items?.find(x => x.uid === p.uid);
    return item?.container === 'camp' && item.itemId === 'dining_table';
  });
}

// Checkout already owns newly made UIDs; this mutating adapter only changes their container.
export function createFurnitureParcel(state, itemUids) {
  if (!state.camp || state.camp.furnitureVersion !== 1 || !Array.isArray(state.camp.parcels)) throw new Error('家具状态未初始化');
  if (!Array.isArray(itemUids) || !itemUids.length || new Set(itemUids).size !== itemUids.length) throw new Error('无效家具包裹');
  const items = itemUids.map(uid => state.items.find(x => x.uid === uid));
  if (items.some(x => !x || !isFurniture(x.itemId) || x.itemId === 'legacy_bed' || x.container?.startsWith('parcel:') || state.camp.placements.some(p => p.uid === x.uid))) throw new Error('包裹只能包含本次购买的未摆家具');
  const id = 'p' + (state.camp.parcelSeq + 1);
  if (state.camp.parcels.some(x => x.id === id)) throw new Error('包裹编号冲突');
  state.camp.parcelSeq += 1;
  const parcel = { id, itemUids: [...itemUids], status: 'sealed', createdDay: state.day, createdHour: state.hour };
  state.camp.parcels.push(parcel);
  for (const item of items) item.container = 'parcel:' + id;
  return parcel;
}

export function unpackParcel(state, actorId, parcelId) {
  const error = actorError(state, actorId, true);
  if (error) return fail(state, error);
  const parcel = state.camp.parcels.find(x => x.id === parcelId);
  if (!parcel) return fail(state, '找不到包裹');
  if (parcel.status === 'opened') return { state, events: [] };
  if (parcel.status !== 'sealed' || parcel.itemUids.some(uid => state.items.find(x => x.uid === uid)?.container !== 'parcel:' + parcelId)) return fail(state, '包裹内容不完整');
  const next = clone(state);
  next.camp.parcels.find(x => x.id === parcelId).status = 'opened';
  for (const uid of parcel.itemUids) next.items.find(x => x.uid === uid).container = 'camp';
  return committed(next, '包裹' + parcelId + '已拆开，家具收入营地箱。');
}

export function placeFurniture(state, actorId, uid, slot, rotation = 0) {
  const error = actorError(state, actorId);
  if (error) return fail(state, error);
  const item = state.items.find(x => x.uid === uid);
  if (!item || !isFurniture(item.itemId) || item.container !== 'camp' || state.camp.placements.some(p => p.uid === uid)) return fail(state, '家具不在营地仓库');
  if (BED_IDS.has(item.itemId) && placedBedCount(state) >= 3) return fail(state, '营地最多摆三张床');
  if (!fits(state, uid, slot, rotation)) return fail(state, '这个位置放不下家具');
  const next = clone(state);
  next.camp.placements.push({ uid, slot, rotation });
  return committed(next, '家具已摆放。');
}

function changePlacement(state, actorId, uid, change, message) {
  const error = actorError(state, actorId);
  if (error) return fail(state, error);
  const placement = state.camp.placements.find(p => p.uid === uid);
  if (!placement) return fail(state, '家具尚未摆放');
  const candidate = { ...placement, ...change };
  if (!fits(state, uid, candidate.slot, candidate.rotation)) return fail(state, '这个位置放不下家具');
  if (candidate.slot === placement.slot && candidate.rotation === placement.rotation) return fail(state, '家具位置没有变化');
  const next = clone(state);
  Object.assign(next.camp.placements.find(p => p.uid === uid), change);
  return committed(next, message);
}

export function moveFurniture(state, actorId, uid, slot) {
  return changePlacement(state, actorId, uid, { slot }, '家具已移动。');
}
export function rotateFurniture(state, actorId, uid, rotation) {
  return changePlacement(state, actorId, uid, { rotation }, '家具已旋转。');
}
export function storeFurniture(state, actorId, uid) {
  const error = actorError(state, actorId);
  if (error) return fail(state, error);
  if (!state.camp.placements.some(p => p.uid === uid)) return fail(state, '家具尚未摆放');
  const next = clone(state);
  next.camp.placements = next.camp.placements.filter(p => p.uid !== uid);
  return committed(next, '家具已收回营地箱。');
}

const FLOOR_SHEETS = [
  [185, 390], [340, 390], [900, 390], [1190, 390],
  [185, 300], [340, 300], [900, 300], [1190, 300],
];
export function sleepSurfaceFor(state, actorId, spot = 'camp', options = {}) {
  if (spot === 'shelter' || spot === 'station') return { kind: spot, uid: null, slot: null, anchor: null };
  const overnight = Array.isArray(options.sleepingIds);
  const provided = overnight ? options.sleepingIds : options.presentIds;
  const present = new Set(provided || Object.keys(state.actors || {}).filter(id => state.actors[id].life === 'active' && state.actors[id].location === 'camp'));
  const allowedLife = overnight ? ['active', 'downed'] : ['active'];
  const eligible = [...new Set(state.camp?.bedPriority || ['xuan', 'fan', 'ma'])]
    .filter(id => present.has(id) && allowedLife.includes(state.actors?.[id]?.life));
  const beds = (state.camp?.placements || []).filter(p => {
    const item = state.items?.find(x => x.uid === p.uid);
    return item?.container === 'camp' && BED_IDS.has(item.itemId);
  }).slice(0, 3);
  const index = eligible.indexOf(actorId);
  if (index < 0) return null;
  if (index < beds.length) {
    const placement = beds[index];
    const slot = SLOT_BY_ID.get(placement.slot);
    return { kind: 'bed', uid: placement.uid, slot: placement.slot, anchor: slot ? { x: slot.x + 28, y: slot.y + 28 } : null };
  }
  const floorIndex = index - beds.length;
  const available = FLOOR_SHEETS.filter(([x, y]) => !(state.camp?.placements || []).some(p => {
    const item = state.items?.find(entry => entry.uid === p.uid);
    const rect = furnitureRect(item?.itemId, p.slot, p.rotation);
    return rect && intersects({ x, y, w: 130, h: 35 }, rect);
  }));
  const [x, y] = available[floorIndex] || FLOOR_SHEETS[floorIndex];
  return { kind: 'floor', uid: null, slot: 'floor_' + (floorIndex + 1), anchor: { x: x + 45, y: y + 12 } };
}

export function validateFurnitureState(state) {
  const bad = reason => ({ ok: false, reason });
  const camp = state.camp;
  if (camp?.furnitureVersion !== 1) return bad('家具版本无效');
  if (!Number.isInteger(camp.floorSheets) || camp.floorSheets < 2 || camp.floorSheets > 3 || !Number.isSafeInteger(camp.parcelSeq) || camp.parcelSeq < 0 || !Number.isSafeInteger(state.itemSeq) || state.itemSeq < 0 || !Array.isArray(camp.placements) || !Array.isArray(camp.parcels) || !Array.isArray(state.items)) return bad('家具结构无效');
  if (!Array.isArray(camp.bedPriority) || camp.bedPriority.length !== 3 || new Set(camp.bedPriority).size !== 3 || !['xuan', 'fan', 'ma'].every(id => camp.bedPriority.includes(id))) return bad('床位优先顺序无效');
  const uids = new Set();
  let largestItemSeq = 0;
  for (const item of state.items) {
    if (typeof item.uid !== 'string' || !item.uid || uids.has(item.uid)) return bad('物品 UID 重复或无效');
    uids.add(item.uid);
    if (/^it[1-9]\d*$/.test(item.uid)) {
      const sequence = Number(item.uid.slice(2));
      if (!Number.isSafeInteger(sequence)) return bad('物品 UID 超出范围');
      largestItemSeq = Math.max(largestItemSeq, sequence);
    }
  }
  if (state.itemSeq < largestItemSeq) return bad('物品序号倒退');
  const parcelIds = new Set();
  const parcelUids = new Set();
  for (const parcel of camp.parcels) {
    if (Object.keys(parcel).sort().join() !== 'createdDay,createdHour,id,itemUids,status' || !/^p[1-9]\d*$/.test(parcel.id) || Number(parcel.id.slice(1)) > camp.parcelSeq || parcelIds.has(parcel.id) || !['sealed', 'opened'].includes(parcel.status) || !Number.isSafeInteger(parcel.createdDay) || parcel.createdDay < 1 || !Number.isInteger(parcel.createdHour) || parcel.createdHour < 0 || parcel.createdHour > 23 || !Array.isArray(parcel.itemUids) || !parcel.itemUids.length) return bad('包裹记录无效');
    parcelIds.add(parcel.id);
    for (const uid of parcel.itemUids) {
      const item = state.items.find(x => x.uid === uid);
      if (parcelUids.has(uid) || !item || !isFurniture(item.itemId) || item.itemId === 'legacy_bed' || (parcel.status === 'sealed' ? item.container !== 'parcel:' + parcel.id : item.container !== 'camp')) return bad('包裹物品引用无效');
      parcelUids.add(uid);
    }
  }
  for (const item of state.items) if (typeof item.container === 'string' && item.container.startsWith('parcel:') && !parcelUids.has(item.uid)) return bad('游离密封物品');
  const placed = new Set();
  for (const p of camp.placements) {
    const item = state.items.find(x => x.uid === p.uid);
    if (Object.keys(p).sort().join() !== 'rotation,slot,uid' || placed.has(p.uid) || !item || item.container !== 'camp' || !isFurniture(item.itemId) || !fits({ ...state, camp: { ...camp, placements: camp.placements.filter(x => x !== p) } }, p.uid, p.slot, p.rotation)) return bad('摆放位置无效');
    placed.add(p.uid);
  }
  const bedPlacements = camp.placements.filter(p => BED_IDS.has(state.items.find(x => x.uid === p.uid)?.itemId)).length;
  if (bedPlacements > 3 || placedBedCount(state) !== camp.beds || !Number.isInteger(camp.beds)) return bad('床位投影无效');
  return { ok: true };
}
