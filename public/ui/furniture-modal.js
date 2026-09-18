import { FURNITURE_SLOTS, furnitureRect, isFurniture, moveFurniture, placeFurniture, rotateFurniture, storeFurniture, unpackParcel } from '../game/furniture.js';
import { itemDef } from '../game/items.js';
import { NAMES } from '../game/engine.js';
import { $, UI, apply, esc, showModal } from './core.js';
import { drawFurnitureSprite, drawParcel } from './furniture-art.js';

const SLOT_NAMES = Object.fromEntries(FURNITURE_SLOTS.map((slot, index) => [slot.id, `${index < 4 ? '近侧' : '后侧'} ${index < 4 ? index + 1 : index - 3} 号位`]));
let styleReady = false;
let activeCleanup = null;

function ensureStyle() {
  if (styleReady || !document.head?.append) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/ui/furniture-modal.css';
  document.head.append(link);
  styleReady = true;
}

function label(item) {
  const def = itemDef(item.itemId);
  return `${def?.name || item.itemId} · ${item.uid}${def ? ` · ¥${def.price}` : ''}`;
}

function eligible(state, actorId) {
  const actor = state.actors?.[actorId];
  return actor?.life === 'active' && actor.location === 'camp' && ['planning', 'arrival'].includes(state.phase);
}

function paint(root, state, selectedUid, selectedSlot) {
  const canvas = root.querySelector('canvas');
  const c = canvas?.getContext?.('2d');
  if (!c) return;
  c.fillStyle = '#26333b';
  c.fillRect(0, 0, 1600, 480);
  c.fillStyle = '#766f5c';
  c.fillRect(108, 185, 1392, 245);
  c.fillStyle = '#39444a';
  c.fillRect(108, 430, 1392, 16);
  for (const slot of FURNITURE_SLOTS) {
    c.fillStyle = slot.id === selectedSlot ? '#e3bb72' : '#b9aa83';
    c.fillRect(slot.x, slot.y, 8, 8);
  }
  for (const placement of state.camp.placements) {
    const item = state.items.find((entry) => entry.uid === placement.uid);
    const rect = furnitureRect(item?.itemId, placement.slot, placement.rotation);
    if (rect) drawFurnitureSprite(c, item.itemId, rect.x, rect.y, placement.rotation, { night: Boolean(UI.night) });
  }
  const selected = state.items.find((item) => item.uid === selectedUid);
  const placement = state.camp.placements.find((entry) => entry.uid === selectedUid);
  if (selected && selectedSlot && !placement) {
    const rect = furnitureRect(selected.itemId, selectedSlot, 0);
    if (rect) {
      c.globalAlpha = 0.55;
      drawFurnitureSprite(c, selected.itemId, rect.x, rect.y, 0, { night: Boolean(UI.night) });
      c.globalAlpha = 1;
    }
  }
  state.camp.parcels.filter((parcel) => parcel.status === 'sealed').forEach((parcel, index) => drawParcel(c, 125 + index * 70, 135, parcel.itemUids.length));
}

export function showFurniture(actorId = UI.sel.actor) {
  activeCleanup?.();
  ensureStyle();
  const opener = document.activeElement;
  let selectedUid = null;
  let selectedSlot = null;
  let message = '';
  let observer = null;
  let root = null;
  let alive = true;
  const cleanup = () => {
    if (!alive) return;
    alive = false;
    observer?.disconnect();
    window?.jwsnAudio?.cancelScope?.('furniture');
    if (activeCleanup === cleanup) activeCleanup = null;
  };
  activeCleanup = cleanup;

  const render = (restore = null) => {
    if (!alive) return;
    const state = UI.state;
    if (!state?.camp?.parcels || !state?.camp?.placements) { cleanup(); return; }
    const canAct = eligible(state, actorId);
    const placed = new Map(state.camp.placements.map((placement) => [placement.uid, placement]));
    const warehouse = state.items.filter((item) => item.container === 'camp' && isFurniture(item.itemId));
    const inventory = warehouse.filter((item) => !placed.has(item.uid));
    const visible = warehouse.some((item) => item.uid === selectedUid);
    if (!visible) selectedUid = null;
    const selected = warehouse.find((item) => item.uid === selectedUid);
    const current = placed.get(selectedUid);
    const parcels = state.camp.parcels.filter((parcel) => parcel.status === 'sealed');
    const parcelRows = parcels.map((parcel) => `<article class="furn-parcel"><strong>封条完好 · 包裹 ${esc(parcel.id)}</strong><p>清单 · ${parcel.itemUids.length} 件</p><ul>${parcel.itemUids.map((uid) => { const item = state.items.find((entry) => entry.uid === uid); return `<li>${item ? esc(label(item)) : esc(uid)}</li>`; }).join('')}</ul><button type="button" data-unpack="${esc(parcel.id)}" ${canAct ? '' : 'disabled'}>拆包</button></article>`).join('');
    const itemRows = warehouse.map((item) => {
      const placement = placed.get(item.uid);
      return `<button type="button" class="furn-item" data-item="${esc(item.uid)}" aria-pressed="${item.uid === selectedUid}">${esc(label(item))}<small>${placement ? `已摆放 · ${esc(SLOT_NAMES[placement.slot] || placement.slot)} · ${placement.rotation}°` : '营地箱 · 待摆放'}</small></button>`;
    }).join('');
    const slotRows = FURNITURE_SLOTS.map((slot) => {
      const occupants = state.camp.placements.filter((entry) => {
        const item = state.items.find((candidate) => candidate.uid === entry.uid);
        const rect = furnitureRect(item?.itemId, entry.slot, entry.rotation);
        return rect && slot.x >= rect.x && slot.x < rect.x + rect.w && slot.y >= rect.y && slot.y < rect.y + rect.h;
      });
      const occupied = occupants.map((entry) => state.items.find((item) => item.uid === entry.uid)).filter(Boolean).map((item) => itemDef(item.itemId)?.name || item.itemId).join('、');
      return `<button type="button" class="furn-slot" data-slot="${slot.id}" aria-pressed="${slot.id === selectedSlot}">${esc(SLOT_NAMES[slot.id])}<small>${occupied ? `占位：${esc(occupied)}` : '空位'}</small></button>`;
    }).join('');
    const body = `<div class="furn-window" data-sfx-scene="furniture"><p>执行者：${esc(NAMES[actorId] || actorId)} · ${canAct ? '人在营地，可以整理' : '需要可行动的人在营地整理家具'}</p>${UI.night ? '<p class="risk-note">今晚休息已结算，新摆家具下次睡眠生效</p>' : ''}<p class="furn-error" role="status" aria-live="polite">${esc(message)}</p><canvas class="furn-preview" width="1600" height="480" aria-label="营地家具摆放预览"></canvas><section><h3>待拆包裹</h3>${parcelRows || '<p>没有密封包裹。</p>'}</section><section><h3>营地箱 · ${inventory.length} 件待摆</h3><div class="furn-items">${itemRows || '<p>没有家具。</p>'}</div></section><section><h3>摆放位置</h3><div class="furn-slots">${slotRows}</div></section><div class="furn-actions"><button type="button" data-action="place" ${canAct && selected && !current && selectedSlot ? '' : 'disabled'}>摆放</button><button type="button" data-action="move" ${canAct && current && selectedSlot ? '' : 'disabled'}>移动</button><button type="button" data-action="rotate" ${canAct && current ? '' : 'disabled'}>旋转 90°</button><button type="button" data-action="store" ${canAct && current ? '' : 'disabled'}>收起</button></div></div>`;
    const top = restore?.scrollTop ?? $('modal').scrollTop;
    showModal('营地家具', body, { wide: true, focus: '.furn-window button:not(:disabled)' });
    UI.lastFocus = opener;
    root = $('modalContent').querySelector('.furn-window');
    $('modal').scrollTop = top;
    paint(root, state, selectedUid, selectedSlot);
    if (restore?.selector) { const target = root.querySelector(restore.selector); (target && !target.disabled ? target : root.querySelector(`[data-item="${selectedUid}"]`) || root.querySelector('button:not(:disabled)'))?.focus({ preventScroll: true }); }
    const redraw = (selector) => render({ selector, scrollTop: $('modal').scrollTop });
    root.querySelectorAll('[data-item]').forEach((button) => { button.onclick = () => { selectedUid = button.dataset.item; const placement = placed.get(selectedUid); selectedSlot = placement?.slot || selectedSlot; message = ''; redraw(`[data-item="${selectedUid}"]`); }; });
    root.querySelectorAll('[data-slot]').forEach((button) => { button.onclick = () => { selectedSlot = button.dataset.slot; message = ''; redraw(`[data-slot="${selectedSlot}"]`); }; });
    root.querySelectorAll('[data-unpack]').forEach((button) => { button.onclick = () => { const parcel = UI.state.camp.parcels.find((entry) => entry.id === button.dataset.unpack); run(unpackParcel(UI.state, actorId, button.dataset.unpack), 'parcel_open', `[data-unpack="${button.dataset.unpack}"]`, parcel?.itemUids[0]); }; });
    root.querySelectorAll('[data-action]').forEach((button) => { button.onclick = () => {
      const uid = selectedUid;
      const actions = {
        place: () => placeFurniture(UI.state, actorId, uid, selectedSlot),
        move: () => moveFurniture(UI.state, actorId, uid, selectedSlot),
        rotate: () => rotateFurniture(UI.state, actorId, uid, ((UI.state.camp.placements.find((p) => p.uid === uid)?.rotation ?? 0) + 90) % 360),
        store: () => storeFurniture(UI.state, actorId, uid),
      };
      run(actions[button.dataset.action](), button.dataset.action === 'place' ? 'furniture_place' : 'furniture_move', `[data-action="${button.dataset.action}"]`);
    }; });
  };
  const run = (result, cue, selector, unpackedUid = null) => {
    if (result.error) { message = result.error; render({ selector, scrollTop: $('modal').scrollTop }); return; }
    if (!result.events?.length) return;
    if (!apply(result, { noRender: true })) return;
    window?.jwsnAudio?.play?.(cue, { scope: 'furniture' });
    message = result.events[0];
    if (unpackedUid) { selectedUid = unpackedUid; selector = `[data-item="${unpackedUid}"]`; }
    render({ selector, scrollTop: $('modal').scrollTop });
    UI.render();
  };
  render();
  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver(() => {
      if (!$('modalOverlay').classList.contains('open') || !root?.isConnected) cleanup();
    });
    observer.observe($('modalOverlay'), { attributes: true, attributeFilter: ['class'] });
    observer.observe($('modalContent'), { childList: true });
  }
}
