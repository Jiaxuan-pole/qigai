import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../public/game/data.js';
import { fresh } from '../public/game/engine.js';
import { makeItem } from '../public/game/items.js';
import { UI, apply } from '../public/ui/core.js';
import { showInventory } from '../public/ui/modals.js';

before(loadData);

test('只有成功消费物品才播放咖啡和餐食 cue，重复展示不播放', () => {
  const old = { window: globalThis.window, document: globalThis.document, localStorage: globalThis.localStorage };
  const cues = [];
  const s = fresh(923);
  s.pendingMorning = null;
  const coffee = makeItem(s, 'coffee', 'xuan');
  const meal = makeItem(s, 'meal', 'xuan');
  const nodes = new Map();
  const el = () => ({ innerHTML: '', style: {}, classList: { add() {}, remove() {}, toggle() {} }, querySelector: () => null, focus() {} });
  for (const id of ['toast', 'modal', 'modalOverlay', 'modalContent', 'modalClose', 'inventoryFurniture']) nodes.set(id, el());
  const furnitureRoot = { querySelector: () => null, querySelectorAll: () => [] };
  nodes.get('modalContent').querySelector = (selector) => selector === '.furn-window' ? furnitureRoot : null;
  const buttons = [coffee, meal].map((item) => ({ dataset: { use: item.uid, actor: 'xuan' } }));
  nodes.get('modalContent').querySelectorAll = (selector) => selector === '[data-use]' ? buttons : [];
  globalThis.window = { jwsnAudio: { play: (cue) => cues.push(cue), stopSpeech() {} } };
  globalThis.document = { activeElement: null, body: { style: {} }, getElementById: (id) => nodes.get(id) };
  globalThis.localStorage = { setItem() {} };
  UI.state = s; UI.night = null; UI.render = () => {};
  try {
    showInventory('xuan');
    showInventory('xuan');
    assert.deepEqual(cues, []);
    buttons[0].onclick();
    assert.deepEqual(cues, ['coffee_sip']);
    buttons.find((b) => b.dataset.use === meal.uid).onclick();
    assert.deepEqual(cues, ['coffee_sip', 'meal']);
    assert.match(nodes.get('modalContent').innerHTML, /id="inventoryFurniture"/);
    nodes.get('inventoryFurniture').onclick();
    assert.match(nodes.get('modalContent').innerHTML, /class="furn-window"/);
    buttons.find((b) => b.dataset.use === meal.uid).onclick();
    assert.deepEqual(cues, ['coffee_sip', 'meal']);
  } finally { Object.assign(globalThis, old); UI.state = null; }
});

test('第六杯咖啡先确认，取消不播放，确认后才播放一次', () => {
  const old = { window: globalThis.window, document: globalThis.document, localStorage: globalThis.localStorage };
  const cues = [];
  const state = fresh(925); state.pendingMorning = null; state.daily.coffeeCups.xuan = 5;
  const coffee = makeItem(state, 'coffee', 'xuan');
  const use = { dataset: { use: coffee.uid, actor: 'xuan' } };
  const nodes = new Map();
  const el = () => ({ innerHTML: '', style: {}, classList: { add() {}, remove() {}, toggle() {} }, querySelector: () => null, focus() {} });
  for (const id of ['toast', 'modal', 'modalOverlay', 'modalContent', 'modalClose', 'confirmCoffeeRisk', 'cancelCoffeeRisk', 'inventoryFurniture']) nodes.set(id, el());
  nodes.get('modalContent').querySelectorAll = (selector) => selector === '[data-use]' ? [use] : [];
  globalThis.window = { jwsnAudio: { play: (cue) => cues.push(cue), stopSpeech() {} } };
  globalThis.document = { activeElement: null, body: { style: {} }, getElementById: (id) => nodes.get(id) };
  globalThis.localStorage = { setItem() {} };
  UI.state = state; UI.night = null; UI.render = () => {};
  try {
    showInventory('xuan'); use.onclick();
    assert.deepEqual(cues, []);
    nodes.get('cancelCoffeeRisk').onclick();
    assert.deepEqual(cues, []);
    use.onclick();
    nodes.get('confirmCoffeeRisk').onclick();
    assert.deepEqual(cues, ['coffee_sip']);
  } finally { Object.assign(globalThis, old); UI.state = null; }
});

test('apply只为同局新密封包裹播放一次到货 cue', () => {
  const old = { window: globalThis.window, localStorage: globalThis.localStorage };
  const cues = [];
  globalThis.window = { jwsnAudio: { play: (cue) => cues.push(cue) } };
  globalThis.localStorage = { setItem() {} };
  UI.render = () => {};
  try {
    const before = fresh(924);
    UI.state = before;
    const after = structuredClone(before);
    after.camp.parcels.push({ id: 'p1', status: 'sealed', itemUids: ['it1'], createdDay: 1, createdHour: 6 });
    assert.equal(apply({ state: after }, { noRender: true }), true);
    assert.deepEqual(cues, ['parcel_arrive']);
    apply({ state: structuredClone(after) }, { noRender: true });
    assert.deepEqual(cues, ['parcel_arrive']);
  } finally { Object.assign(globalThis, old); UI.state = null; }
});
