const ACTIVE_KEY = 'jwsn.shared-save';
let active = null;
let pending = null;
let timer = null;
let sending = null;
let status = 'idle';
let onStatus = () => {};
let generation = 0;

try {
  const saved = JSON.parse(localStorage.getItem(ACTIVE_KEY) || 'null');
  if (saved && typeof saved.id === 'string' && Number.isSafeInteger(saved.revision)) active = saved;
} catch { /* 无本地存储时仍可从存档表继续 */ }

function statusTo(value, detail = '') { status = value; onStatus({ status, detail, active }); }
function persistActive() {
  try {
    if (active) localStorage.setItem(ACTIVE_KEY, JSON.stringify({ id: active.id, revision: active.revision }));
    else localStorage.removeItem(ACTIVE_KEY);
  } catch { /* 云端存档不依赖本机索引 */ }
}

async function request(path, options) {
  const response = await fetch(path, { ...options, headers: options?.body ? { 'content-type': 'application/json' } : undefined });
  let body;
  try { body = await response.json(); } catch { throw new Error('存档服务返回了无效响应'); }
  if (!response.ok || !body.ok) {
    const error = new Error(body.reason || '存档请求失败');
    error.status = response.status;
    error.current = body.current;
    throw error;
  }
  return body;
}

export const listSharedSaves = async () => (await request('/api/saves')).saves;
export const loadSharedSave = async (id) => (await request(`/api/saves/${encodeURIComponent(id)}`)).save;
export function getActiveSharedSave() { return active ? { ...active } : null; }
export function getSharedSaveStatus() { return status; }
export function onSharedSaveStatus(listener) { onStatus = listener; listener({ status, active }); }

export function setActiveSharedSave(record) {
  generation += 1;
  clearTimeout(timer);
  pending = null;
  active = record ? { id: record.id, name: record.name, revision: record.revision } : null;
  persistActive();
  statusTo(active ? 'saved' : 'idle');
}

export async function createSharedSave(name, state, night = null) {
  const record = (await request('/api/saves', { method: 'POST', body: JSON.stringify({ name, state, night }) })).save;
  setActiveSharedSave(record);
  return record;
}

async function drain() {
  if (sending) return sending;
  if (!pending || !active || status === 'conflict') return;
  const snapshot = pending;
  pending = null;
  const target = { ...active };
  const token = generation;
  statusTo('saving');
  sending = request(`/api/saves/${encodeURIComponent(target.id)}`, {
    method: 'PUT', body: JSON.stringify({ ...snapshot, expectedRevision: target.revision }),
  }).then(({ save }) => {
    if (token !== generation) return;
    active = { id: save.id, name: save.name, revision: save.revision };
    persistActive();
    statusTo(pending ? 'pending' : 'saved');
  }).catch((error) => {
    if (token !== generation) return;
    pending = pending || snapshot;
    statusTo(error.status === 409 ? 'conflict' : 'error', error.message);
    throw error;
  }).finally(() => { sending = null; });
  await sending;
  if (pending && status !== 'conflict' && status !== 'error') return drain();
}

export function queueSharedSave(state, night = null) {
  if (!active || status === 'conflict') return;
  pending = structuredClone({ state, night });
  statusTo('pending');
  clearTimeout(timer);
  timer = setTimeout(() => { drain().catch(() => {}); }, 350);
}

export async function flushSharedSave() {
  clearTimeout(timer);
  if (sending) await sending;
  if (status === 'conflict') throw new Error('其他设备已更新这份存档，请重新载入或另存新档');
  if (pending) await drain();
}
