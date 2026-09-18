import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { validateSave, normalizeSave } from '../public/game/save.js';
import { FURNITURE_SLOTS } from '../public/game/furniture.js';

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FLOOR_ANCHORS = [[230, 402], [385, 402], [945, 402], [1235, 402], [230, 312], [385, 312], [945, 312], [1235, 312]];

export class SaveError extends Error {
  constructor(status, reason, current = null) { super(reason); this.status = status; this.current = current; }
}

function validScreening(screen) {
  const text = (value, max) => typeof value === 'string' && value.length <= max;
  const ids = ['xuan', 'fan', 'ma'];
  return screen && typeof screen === 'object' && !Array.isArray(screen)
    && text(screen.title, 120) && typeof screen.premiere === 'boolean'
    && Array.isArray(screen.sources) && screen.sources.length <= 8 && screen.sources.every((s) => text(s, 160))
    && Array.isArray(screen.audience) && screen.audience.length <= 3 && screen.audience.every((id) => ids.includes(id))
    && (!screen.guest || (text(screen.guest.id, 80) && text(screen.guest.name, 40)))
    && ['fan', 'other'].every((id) => Number.isInteger(screen.gains?.[id]) && screen.gains[id] >= 0 && screen.gains[id] <= 100)
    && Array.isArray(screen.lines) && screen.lines.length <= 10
    && screen.lines.every((line) => line && text(line.name, 40) && text(line.text, 240));
}

function validSleepSurfaces(surfaces, state) {
  if (!surfaces || typeof surfaces !== 'object' || Array.isArray(surfaces)) return false;
  const actors = Object.keys(surfaces);
  if (actors.length < 1 || actors.length > 3 || actors.some(id => !['xuan', 'fan', 'ma'].includes(id))) return false;
  const bedUids = new Set();
  return actors.every(id => {
    const surface = surfaces[id];
    if (!surface || typeof surface !== 'object' || Array.isArray(surface) ||
      Object.keys(surface).sort().join() !== 'anchor,kind,slot,uid') return false;
    const { kind, uid, slot, anchor } = surface;
    if (kind === 'shelter' || kind === 'station') return uid === null && slot === null && anchor === null;
    if (!anchor || typeof anchor !== 'object' || Array.isArray(anchor) ||
      Object.keys(anchor).sort().join() !== 'x,y' || !Number.isInteger(anchor.x) || !Number.isInteger(anchor.y)) return false;
    if (kind === 'floor') return uid === null && /^floor_[1-8]$/.test(slot) &&
      FLOOR_ANCHORS.some(([x, y]) => anchor.x === x && anchor.y === y);
    if (kind !== 'bed' || typeof uid !== 'string' || bedUids.has(uid)) return false;
    const item = state.items.find(entry => entry.uid === uid);
    const authored = FURNITURE_SLOTS.find(entry => entry.id === slot);
    if (!item || !['bed_basic', 'bed_comfort', 'legacy_bed'].includes(item.itemId) || !authored ||
      anchor.x !== authored.x + 28 || anchor.y !== authored.y + 28) return false;
    bedUids.add(uid);
    return true;
  });
}

function checkedState(state, night) {
  const result = validateSave(state);
  if (!result.ok) throw new SaveError(400, result.reason);
  const normalized = normalizeSave(state);
  const normalizedResult = validateSave(normalized);
  if (!normalizedResult.ok) throw new SaveError(400, normalizedResult.reason);
  if (night !== null && night !== undefined && (
    typeof night !== 'object' || Array.isArray(night) || night.spot !== 'camp' ||
    !Number.isInteger(night.day) || night.day !== normalized.day - 1 ||
    normalized.hour !== 6 || normalized.turn !== night.day * 4
  )) throw new SaveError(400, '夜间进度与存档日期不匹配');
  if (night?.screening && !validScreening(night.screening)) throw new SaveError(400, '夜间放映记录无效');
  if (night && Object.hasOwn(night, 'fire') && typeof night.fire !== 'boolean') throw new SaveError(400, '夜间篝火记录无效');
  if (night && Object.hasOwn(night, 'sleepSurfaces') && !validSleepSurfaces(night.sleepSurfaces, normalized)) throw new SaveError(400, '夜间睡眠位置无效');
  return { state: normalized, night: night ?? null };
}

function checkedName(name) {
  if (typeof name !== 'string') throw new SaveError(400, '请输入存档名');
  const clean = name.trim();
  if (!clean || [...clean].length > 32 || /[\x00-\x1f\x7f-\x9f]/u.test(clean)) throw new SaveError(400, '存档名须为1到32字，不能包含控制字符');
  return clean;
}

export function createSaveStore(dir) {
  let writes = Promise.resolve();
  const pathFor = (id) => {
    if (!ID.test(id)) throw new SaveError(400, '存档编号无效');
    return join(dir, `${id}.json`);
  };
  const read = async (id) => {
    try { return JSON.parse(await readFile(pathFor(id), 'utf8')); }
    catch (error) {
      if (error instanceof SaveError) throw error;
      if (error.code === 'ENOENT') throw new SaveError(404, '存档不存在');
      throw error;
    }
  };
  const list = async () => {
    await mkdir(dir, { recursive: true });
    const names = await readdir(dir);
    const rows = await Promise.all(names.filter((name) => ID.test(name.slice(0, -5)) && name.endsWith('.json')).map((name) => read(name.slice(0, -5))));
    return rows.map(({ id, name, state, updatedAt, revision }) => ({ id, name, day: state.day, updatedAt, revision }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  };
  const atomicWrite = async (record) => {
    await mkdir(dir, { recursive: true });
    const target = pathFor(record.id);
    const temp = join(dir, `.${record.id}.${randomUUID()}.tmp`);
    try { await writeFile(temp, JSON.stringify(record), { flag: 'wx' }); await rename(temp, target); }
    catch (error) { await unlink(temp).catch(() => {}); throw error; }
  };
  const serial = (operation) => {
    const result = writes.then(operation);
    writes = result.catch(() => {});
    return result;
  };
  return {
    list: () => writes.then(list),
    get: (id) => writes.then(() => read(id)),
    create: ({ name, state, night = null }) => serial(async () => {
      const clean = checkedName(name);
      const normalized = checkedState(state, night);
      const existing = await list();
      if (existing.some((row) => row.name === clean)) throw new SaveError(409, '同名存档已存在，请换一个名字');
      const record = { id: randomUUID(), name: clean, ...normalized, revision: 1, updatedAt: new Date().toISOString() };
      await atomicWrite(record);
      return record;
    }),
    update: (id, { state, night = null, expectedRevision }) => serial(async () => {
      const current = await read(id);
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) throw new SaveError(400, '缺少存档版本');
      if (current.revision !== expectedRevision) throw new SaveError(409, '其他设备已更新这份存档，请重新载入或另存新档', { revision: current.revision, updatedAt: current.updatedAt });
      const normalized = checkedState(state, night);
      const record = { ...current, ...normalized, revision: current.revision + 1, updatedAt: new Date().toISOString() };
      await atomicWrite(record);
      return record;
    }),
  };
}
