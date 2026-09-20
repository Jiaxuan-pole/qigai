import test from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../public/game/data.js';
import { fresh } from '../public/game/engine.js';
import { makeItem } from '../public/game/items.js';
import { UI, closeModal } from '../public/ui/core.js';

const TABS = ['plan', 'inventory', 'wishes', 'health', 'tasks', 'map', 'camp', 'chapters', 'system', 'help'];

function element(extra = {}) {
  const classes = new Set(), attrs = {};
  return {
    hidden: false, attrs, dataset: {}, style: {}, focus() {},
    classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)), contains: (c) => classes.has(c) },
    setAttribute(key, value) { attrs[key] = String(value); },
    getAttribute(key) { return attrs[key] ?? null; },
    removeAttribute(key) { delete attrs[key]; },
    ...extra,
  };
}

// 假 DOM 只覆盖 core.js 弹层、planner-window.js 与菜单/快捷栏会碰到的节点；缺的节点返回 null 以验证判空。
function mount() {
  const nodes = {
    modalOverlay: element(), modalContent: element(), modal: element({ querySelector: () => null }), modalClose: element(), toast: element(),
    modalTabs: element(), plannerOverlay: element({ hidden: true }), planToggle: element(), drawer: element({ hidden: true }), planner: element({ hidden: true }), plannerClose: element(),
    game: element(), hotbar: element(),
  };
  nodes.modalTabs.attrs.hidden = '';
  const tabs = TABS.map((tab) => element({ dataset: { menuTab: tab } }));
  const listeners = new Map();
  const prior = { document: globalThis.document, window: globalThis.window, localStorage: globalThis.localStorage };
  globalThis.document = {
    activeElement: null,
    body: { style: {}, classList: { toggle() {} } },
    getElementById: (id) => nodes[id] ?? null,
    querySelector: () => null,
    querySelectorAll: (selector) => (selector === '[data-menu-tab]' ? tabs : []),
    addEventListener: (type, fn) => listeners.set(type, fn),
  };
  globalThis.window = {};
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  return { nodes, tabs, listeners, restore() { Object.assign(globalThis, prior); UI.night = null; } };
}

const selected = (tabs) => tabs.filter((b) => b.getAttribute('aria-selected') === 'true').map((b) => b.dataset.menuTab);

test('打开库存 tab：调用对应 handler、露出 tab 栏、只有该 tab 被选中；关弹层后 tab 栏收起', async () => {
  const dom = mount();
  try {
    const { initMenu, openMenu } = await import('../public/ui/menu.js');
    const calls = [];
    initMenu(Object.fromEntries(TABS.map((tab) => [tab, () => { calls.push(tab); dom.nodes.modalOverlay.classList.add('open'); }])));
    openMenu('inventory');
    assert.deepEqual(calls, ['inventory']);
    assert.equal(dom.nodes.modalTabs.getAttribute('hidden'), null);
    assert.deepEqual(selected(dom.tabs), ['inventory']);
    assert.equal(dom.tabs.filter((b) => b.getAttribute('aria-selected') === 'false').length, TABS.length - 1);
    closeModal();
    assert.equal(dom.nodes.modalTabs.getAttribute('hidden'), '');
    UI.modalLock = true;
    openMenu('wishes');
    assert.deepEqual(calls, ['inventory']);
    assert.equal(dom.nodes.modalTabs.getAttribute('hidden'), '');
    UI.modalLock = false;
  } finally { dom.restore(); }
});

test('打开排程 tab：关掉已开弹层并展开 planner 浮层，不调用占位 handler', async () => {
  const dom = mount();
  try {
    const { initMenu, openMenu } = await import('../public/ui/menu.js');
    const calls = [];
    initMenu(Object.fromEntries(TABS.map((tab) => [tab, () => calls.push(tab)])));
    dom.nodes.modalOverlay.classList.add('open');
    openMenu('plan');
    assert.deepEqual(calls, []);
    assert.equal(dom.nodes.modalOverlay.classList.contains('open'), false);
    assert.equal(dom.nodes.plannerOverlay.hidden, false);
    assert.equal(dom.nodes.planToggle.getAttribute('aria-expanded'), 'true');
    assert.deepEqual(selected(dom.tabs), ['plan']);
  } finally { dom.restore(); }
});

test('E 键：关着时打开上次 tab，开着时关闭；焦点在输入框或有修饰键时不响应', async () => {
  const dom = mount();
  try {
    const { initMenu, openMenu } = await import('../public/ui/menu.js');
    const calls = [];
    initMenu(Object.fromEntries(TABS.map((tab) => [tab, () => { calls.push(tab); dom.nodes.modalOverlay.classList.add('open'); }])));
    const keydown = dom.listeners.get('keydown');
    assert.equal(typeof keydown, 'function');
    openMenu('health');
    closeModal();
    keydown({ key: 'e', preventDefault() {} });
    assert.deepEqual(calls, ['health', 'health']);
    keydown({ key: 'E', preventDefault() {} });
    assert.equal(dom.nodes.modalOverlay.classList.contains('open'), false);
    assert.equal(dom.nodes.plannerOverlay.hidden, true);
    globalThis.document.activeElement = { tagName: 'INPUT' };
    keydown({ key: 'e', preventDefault() {} });
    globalThis.document.activeElement = null;
    keydown({ key: 'e', ctrlKey: true, preventDefault() {} });
    assert.deepEqual(calls, ['health', 'health']);
  } finally { dom.restore(); }
});

test('快捷栏：随身可用物品每种一格、显示件数或剩余格数、补空格到 8 格，夜里全部禁用', async () => {
  await loadData();
  const dom = mount();
  try {
    const { renderHotbar } = await import('../public/ui/hotbar.js');
    const state = fresh(77);
    makeItem(state, 'cigarette', 'xuan');
    makeItem(state, 'bread', 'xuan');
    renderHotbar(state, 'xuan');
    assert.match(dom.nodes.hotbar.innerHTML, /data-quick-use="[^"]+"[^>]*title="[^"]*正餐 · 营地箱"[\s\S]*?<small class="hotslot-count">4<\/small>/);
    state.actors.xuan.location = 'market';
    renderHotbar(state, 'xuan');
    const html = dom.nodes.hotbar.innerHTML;
    const slots = [...html.matchAll(/<button type="button" class="hotslot" data-quick-use="(it\d+)"([^>]*)>/g)];
    assert.equal(slots.length, 2);
    assert.equal(slots.filter(([, , attrs]) => /\bdisabled\b/.test(attrs)).length, 0);
    assert.equal((html.match(/<span class="hotslot empty" aria-hidden="true"><\/span>/g) || []).length, 6);
    assert.match(html, /data-item-art="cigarette"[\s\S]*?<small class="hotslot-count">6<\/small>/);
    assert.match(html, /data-item-art="bread"[\s\S]*?<small class="hotslot-count">1<\/small>/);
    assert.match(html, /title="[^"]*香烟[^"]*轩哥今日 0次"/);
    UI.night = { day: state.day };
    renderHotbar(state, 'xuan');
    const nightSlots = [...dom.nodes.hotbar.innerHTML.matchAll(/<button type="button" class="hotslot" data-quick-use="(it\d+)"([^>]*)>/g)];
    assert.equal(nightSlots.length, 2);
    assert.equal(nightSlots.every(([, , attrs]) => /\bdisabled\b/.test(attrs)), true);
    assert.equal(typeof dom.nodes.hotbar.onclick, 'function');
  } finally { dom.restore(); }
});

test('没有 #hotbar 或菜单节点时静默跳过，不抛错', async () => {
  await loadData();
  const dom = mount();
  try {
    delete dom.nodes.hotbar;
    delete dom.nodes.modalTabs;
    const { renderHotbar } = await import('../public/ui/hotbar.js');
    const { openMenu } = await import('../public/ui/menu.js');
    assert.doesNotThrow(() => renderHotbar(fresh(78), 'xuan'));
    assert.doesNotThrow(() => openMenu('wishes'));
    assert.doesNotThrow(() => closeModal());
  } finally { dom.restore(); }
});
