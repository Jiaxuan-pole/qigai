// UI 核心：状态持有、存档、弹层、提示。渲染在 render.js，弹层内容在 modals.js。
import { validateSave, normalizeSave, SAVE_KEY } from '../game/save.js';
import { queueSharedSave } from './saves-client.js';

export const $ = (id) => document.getElementById(id);
export const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const UI = {
  state: null,
  data: null,
  sel: { actor: 'xuan', hour: 6, action: 'scavenge', zone: null, participants: null, target: null, cart: [], destination: 'self', targets: [] },
  ai: { enabled: false, available: false, model: '' },
  storageOK: true,
  render: () => {},
  lastFocus: null,
  modalLock: false,
  night: null,
};

let toastTimer = null;
export function toast(msg, ms = 4200) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

export function save() {
  queueSharedSave(UI.state, UI.night);
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(UI.state));
    UI.storageOK = true;
  } catch (_) {
    UI.storageOK = false;
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    const v = validateSave(s);
    if (!v.ok) return { invalid: v.reason };
    return normalizeSave(s);
  } catch (_) {
    return { invalid: '本地存档损坏' };
  }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (_) { /* 无存储时忽略 */ }
}

// 统一应用引擎结果：错误只提示，不动状态。
export function apply(result, opts = {}) {
  if (!result) return false;
  if (result.error) {
    toast(result.error);
    if (result.at) UI.errAt = result.at;
    if (!opts.silent) UI.render();
    return false;
  }
  const before = UI.state;
  UI.state = result.state;
  if (before?.seed === UI.state?.seed) {
    const known = new Set(before.camp?.parcels?.map((parcel) => parcel.id) || []);
    if (UI.state.camp?.parcels?.some((parcel) => parcel.status === 'sealed' && !known.has(parcel.id))) globalThis.window?.jwsnAudio?.play?.('parcel_arrive', { scope: 'parcel' });
  }
  UI.errAt = null;
  save();
  if (!opts.noRender) UI.render();
  return true;
}

export function showModal(title, body, opts = {}) {
  globalThis.window?.jwsnAudio?.stopSpeech?.();
  clearTimeout(toastTimer);
  $('toast').classList.remove('show');
  UI.lastFocus = document.activeElement;
  $('modalContent').innerHTML = `<div class="section-tag">${esc(opts.tag || 'STREET NOTES / THREE LIVES')}</div><h2 id="modalTitle">${esc(title)}</h2>${body}`;
  $('modal').classList.toggle('wide', Boolean(opts.wide));
  $('modalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  UI.modalLock = Boolean(opts.lock);
  $('modalClose').disabled = UI.modalLock;
  const first = $('modal').querySelector(opts.focus || 'button:not(:disabled):not(.close)');
  if (first) first.focus();
}

export function closeModal(force = false) {
  if (UI.modalLock && !force) return;
  globalThis.window?.jwsnAudio?.stopSpeech?.();
  globalThis.window?.jwsnAudio?.cancelScope?.('card-table');
  UI.modalLock = false;
  $('modalOverlay').classList.remove('open');
  document.body.style.overflow = '';
  UI.lastFocus?.focus?.();
}

export function modalOpen() {
  return $('modalOverlay').classList.contains('open');
}

export function bindOnce(root, selector, handler) {
  root.querySelectorAll(selector).forEach((el) => { el.onclick = (e) => handler(el, e); });
}
