import assert from 'node:assert/strict';
import test from 'node:test';
import { loadData } from '../public/game/data.js';
import { fresh } from '../public/game/engine.js';
import { makeItem } from '../public/game/items.js';
import { placeFurniture, unpackParcel } from '../public/game/furniture.js';
import { UI } from '../public/ui/core.js';
import { showFurniture } from '../public/ui/furniture-modal.js';
import { showInventory, showShop } from '../public/ui/modals.js';

function dom() {
  const classes = new Set();
  const overlay = { classList: { add: (value) => classes.add(value), remove: (value) => classes.delete(value), contains: (value) => classes.has(value) } };
  const canvasContext = { fillRect() {}, save() {}, restore() {}, translate() {}, rotate() {}, set fillStyle(value) {}, set globalAlpha(value) {} };
  const content = {
    nodes: [],
    querySelector(selector) {
      if (selector === '.furn-window') return this;
      if (selector === 'canvas') return { getContext: () => canvasContext };
      if (selector === 'button:not(:disabled)' || selector === '.furn-window button:not(:disabled)') return this.nodes.find((node) => !node.disabled) || null;
      const match = selector.match(/^\[data-([a-z]+)="([^"]+)"\]$/);
      return match ? this.nodes.find((node) => node.dataset[match[1]] === match[2]) || null : null;
    },
    querySelectorAll(selector) {
      const key = selector.match(/^\[data-([a-z]+)\]$/)?.[1];
      return key ? this.nodes.filter((node) => node.dataset[key] !== undefined) : [];
    },
    set innerHTML(html) {
      this.html = html;
      this.nodes = [...html.matchAll(/<button\b([^>]*)>/g)].map(([, attrs]) => {
        const dataset = Object.fromEntries([...attrs.matchAll(/data-([a-z]+)="([^"]+)"/g)].map(([, key, value]) => [key, value]));
        const id = attrs.match(/\bid="([^"]+)"/)?.[1];
        return { id, dataset, disabled: /\sdisabled(?:\s|$)/.test(attrs), focus(options) { document.activeElement = this; this.focusOptions = options; if (!options?.preventScroll) modal.scrollTop = 0; }, onclick: null };
      });
    },
    get innerHTML() { return this.html || ''; },
    get isConnected() { return true; },
  };
  const modal = { scrollTop: 0, classList: { toggle() {} }, querySelector: (selector) => content.querySelector(selector) };
  const cells = { modal, modalContent: content, modalOverlay: overlay, modalClose: { disabled: false }, toast: { classList: { add() {}, remove() {} }, textContent: '' } };
  const old = { document: globalThis.document, window: globalThis.window, localStorage: globalThis.localStorage };
  const sounds = [];
  globalThis.document = { activeElement: null, body: { style: {} }, head: { append() {} }, createElement: () => ({}), getElementById: (id) => cells[id] || content.nodes.find((node) => node.id === id) || null };
  globalThis.window = { jwsnAudio: { play: (...args) => sounds.push(args), cancelScope() {} } };
  globalThis.localStorage = { setItem() {} };
  return { content, modal, sounds, restore() { globalThis.document = old.document; globalThis.window = old.window; globalThis.localStorage = old.localStorage; } };
}

async function fixture() {
  UI.data = await loadData();
  const state = fresh(41);
  state.phase = 'planning';
  state.actors.xuan.location = 'camp';
  const item = makeItem(state, 'bed_basic', 'parcel:p1');
  state.camp.parcels.push({ id: 'p1', itemUids: [item.uid], status: 'sealed', createdDay: state.day, createdHour: state.hour });
  state.camp.parcelSeq = 1;
  UI.state = state;
  UI.sel.actor = 'xuan';
  UI.render = () => {};
  UI.night = null;
  return item.uid;
}

function click(content, key, value) {
  const node = content.querySelector(`[data-${key}="${value}"]`);
  assert.ok(node, `${key}=${value}`);
  assert.equal(node.disabled, false);
  node.onclick();
}

test('keyboard unpack and place furniture', async () => {
  const uid = await fixture();
  const d = dom();
  try {
    showFurniture();
    assert.match(d.content.innerHTML, /包裹 p1/);
    assert.doesNotMatch(d.content.innerHTML, /data-item=/);
    click(d.content, 'unpack', 'p1');
    assert.equal(UI.state.camp.parcels[0].status, 'opened');
    assert.equal(document.activeElement.dataset.item, uid);
    assert.deepEqual(d.sounds[0], ['parcel_open', { scope: 'furniture' }]);
    click(d.content, 'slot', 'upper_1');
    d.modal.scrollTop = 312;
    click(d.content, 'action', 'place');
    assert.deepEqual(UI.state.camp.placements, [{ uid, slot: 'upper_1', rotation: 0 }]);
    assert.equal(UI.state.camp.beds, 1);
    assert.equal(d.modal.scrollTop, 312);
    assert.match(d.content.innerHTML, /后侧 1 号位/);
    assert.equal(document.activeElement.dataset.item, uid);
    assert.deepEqual(d.sounds[1], ['furniture_place', { scope: 'furniture' }]);
  } finally { d.restore(); }
});

test('furniture store checkout sends a parcel and inventory opens furniture controls', async () => {
  await fixture();
  const d = dom();
  try {
    UI.state.cash = 500;
    UI.state.day = 7;
    UI.state.hour = 10;
    UI.state.slot = 1;
    UI.state.actors.xuan.location = 'furniture';
    UI.cartDraft = null;
    showShop('furniture_store', 'xuan', 'now');
    assert.match(d.content.innerHTML, /家具统一快递到营地包裹/);
    assert.doesNotMatch(d.content.innerHTML, /name="dest"/);
    click(d.content, 'inc', 'bed_basic');
    const buy = document.getElementById('buyNow');
    assert.ok(buy && !buy.disabled);
    buy.onclick();
    assert.equal(UI.state.camp.parcels.filter((parcel) => parcel.status === 'sealed').length, 2);
    assert.equal(UI.state.items.filter((item) => item.itemId === 'bed_basic' && item.container.startsWith('parcel:')).length, 2);
    assert.match(document.getElementById('toast').textContent, /包裹 p2 已快递到营地/);
    showInventory();
    assert.match(d.content.innerHTML, /密封包裹 2 件/);
    assert.ok(document.getElementById('inventoryFurniture'));
  } finally { d.restore(); UI.cartDraft = null; }
});

test('remote actor disabled and night timing hint', async () => {
  const uid = await fixture();
  const d = dom();
  try {
    UI.state.actors.xuan.location = 'market';
    const rejected = unpackParcel(UI.state, 'xuan', 'p1');
    assert.equal(rejected.error, '需要人在营地拆包');
    showFurniture();
    assert.equal(d.content.querySelector('[data-unpack="p1"]').disabled, true);
    assert.equal(UI.state.items.find((item) => item.uid === uid).container, 'parcel:p1');
    UI.state.actors.xuan.location = 'camp';
    UI.night = { report: { beds: 0 } };
    showFurniture();
    assert.match(d.content.innerHTML, /今晚休息已结算，新摆家具下次睡眠生效/);
    click(d.content, 'unpack', 'p1');
    click(d.content, 'slot', 'upper_1');
    click(d.content, 'action', 'place');
    assert.equal(UI.night.report.beds, 0);
  } finally { d.restore(); UI.night = null; }
});

test('occupied and reserved positions reject atomically while preserving focus', async () => {
  const first = await fixture();
  const d = dom();
  try {
    const second = makeItem(UI.state, 'bed_basic', 'camp');
    const opened = unpackParcel(UI.state, 'xuan', 'p1');
    UI.state = opened.state;
    UI.state = placeFurniture(UI.state, 'xuan', first, 'upper_1').state;
    showFurniture();
    click(d.content, 'item', second.uid);
    click(d.content, 'slot', 'upper_1');
    d.modal.scrollTop = 220;
    click(d.content, 'action', 'place');
    assert.equal(UI.state.camp.placements.length, 1);
    assert.match(d.content.innerHTML, /这个位置放不下家具/);
    assert.equal(d.modal.scrollTop, 220);
    assert.equal(document.activeElement.dataset.action, 'place');
    assert.equal(d.sounds.length, 0);
    click(d.content, 'slot', 'upper_8');
    click(d.content, 'action', 'place');
    assert.equal(UI.state.camp.placements.length, 1);
    assert.equal(UI.state.items.find((item) => item.uid === second.uid).container, 'camp');
  } finally { d.restore(); }
});

 test('move rotate and store keep the same furniture uid', async () => {
  const uid = await fixture();
  const d = dom();
  try {
    UI.state = unpackParcel(UI.state, 'xuan', 'p1').state;
    UI.state = placeFurniture(UI.state, 'xuan', uid, 'west_1').state;
    showFurniture();
    click(d.content, 'item', uid);
    click(d.content, 'slot', 'upper_2');
    click(d.content, 'action', 'move');
    assert.deepEqual(UI.state.camp.placements[0], { uid, slot: 'upper_2', rotation: 0 });
    click(d.content, 'action', 'rotate');
    assert.deepEqual(UI.state.camp.placements[0], { uid, slot: 'upper_2', rotation: 90 });
    click(d.content, 'action', 'store');
    assert.deepEqual(UI.state.camp.placements, []);
    assert.equal(UI.state.items.filter((item) => item.uid === uid).length, 1);
    assert.equal(UI.state.camp.beds, 0);
    assert.deepEqual(d.sounds.map((sound) => sound[0]), ['furniture_move', 'furniture_move', 'furniture_move']);
  } finally { d.restore(); }
});
