import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadData } from '../public/game/data.js';
import { fresh, assign } from '../public/game/engine.js';
import { makeItem } from '../public/game/items.js';
import { UI } from '../public/ui/core.js';
import { plannerToggleOwnsSpace, renderDrawer, renderSchedule, setDrawerExpanded, zoneName } from '../public/ui/render.js';
import { showInventory } from '../public/ui/modals.js';
import { bindPlannerWindow } from '../public/ui/planner-window.js';

test('地图按钮初始同时控制隐藏的行动与排程区域', () => {
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(html, /id="planToggle"[^>]*aria-controls="plannerWindow"[^>]*aria-expanded="false"/);
  assert.match(html, /id="plannerOverlay"[^>]* hidden/);
  assert.match(html, /id="plannerWindow"[^>]*role="dialog"[^>]*aria-modal="true"/);
  assert.match(html, /id="plannerClose"/);
  const overlay = html.slice(html.indexOf('id="plannerOverlay"'), html.indexOf('id="modalOverlay"'));
  assert.match(overlay, /id="drawer"/);
  assert.match(overlay, /id="planner"/);
  assert.match(html, /id="drawer"[^>]* hidden/);
  assert.match(html, /id="planner"[^>]* hidden/);
  assert.match(html, /<h2>三个人的下一件事<\/h2>/);
});

test('规划窗口只显示三人下一件事，按钮始终携带当前真实小时', async () => {
  await loadData();
  const state = fresh(81);
  const cells = Object.fromEntries(['schedule', 'planFocus', 'btnAdvance', 'planStatus'].map((id) => [id, { innerHTML: '', textContent: '', style: {}, classList: { toggle() {} } }]));
  const priorDocument = globalThis.document;
  const priorWidth = globalThis.innerWidth;
  globalThis.document = { getElementById: (id) => cells[id] };
  globalThis.innerWidth = 375;
  UI.state = state;
  UI.data = await loadData();
  UI.sel.hour = 6;
  try {
    renderSchedule(state);
    const html = cells.schedule.innerHTML;
    assert.equal((html.match(/class="next-task/g) || []).length, 3);
    assert.equal((html.match(/data-hour="6"/g) || []).length, 2);
    assert.doesNotMatch(html, /data-hour="21"/);
    assert.doesNotMatch(html, /data-slot=/);
    assert.equal(cells.btnAdvance.textContent, '开始行动');
    assert.equal(zoneName('cafe'), '咖啡街区');
  } finally {
    globalThis.document = priorDocument;
    globalThis.innerWidth = priorWidth;
  }
});

test('旧时段数值被引擎拒绝，真实小时落入正确计划格', async () => {
  await loadData();
  const state = fresh(82);
  assert.ok(assign(state, 'xuan', 0, 'sleep').error);
  const result = assign(state, 'xuan', 10, 'sleep');
  assert.equal(result.error, undefined);
  assert.equal(result.state.plan.xuan[4].id, 'sleep');
});

test('错误定位到当前小时，救援尾声只显示当前下一件事', async () => {
  await loadData();
  const state = fresh(83);
  const cells = Object.fromEntries(['schedule', 'planFocus', 'btnAdvance', 'planStatus'].map((id) => [id, { innerHTML: '', textContent: '', style: {} }]));
  const priorDocument = globalThis.document;
  globalThis.document = { getElementById: (id) => cells[id] };
  UI.state = state;
  UI.data = await loadData();
  try {
    UI.errAt = { actorId: 'xuan', hour: 6 };
    renderSchedule(state);
    assert.match(cells.schedule.innerHTML, /class="next-task [^"]*err[^"]*"[^>]*data-hour="6" data-actor="xuan"/);
    state.phase = 'tail';
    state.hour = 22;
    UI.sel.hour = 22;
    renderSchedule(state);
    assert.equal((cells.schedule.innerHTML.match(/class="next-task/g) || []).length, 3);
    assert.match(cells.schedule.innerHTML, /data-hour="22"/);
    assert.doesNotMatch(cells.schedule.innerHTML, /data-hour="23"/);
    state.hour = 23;
    renderSchedule(state);
    assert.match(cells.schedule.innerHTML, /data-hour="23"/);
  } finally {
    UI.errAt = null;
    globalThis.document = priorDocument;
  }
});

test('体力与咖啡额度合计不足时给可达补给入口，足够时不误报', async () => {
  await loadData();
  const state = fresh(84);
  const drawer = { innerHTML: '' };
  const priorDocument = globalThis.document;
  globalThis.document = { getElementById: (id) => id === 'drawer' ? drawer : null };
  UI.state = state;
  UI.data = await loadData();
  UI.sel.actor = 'xuan'; UI.sel.hour = 6; UI.sel.zone = null; UI.sel.action = 'scavenge'; UI.sel.cart = []; UI.sel.targets = [];
  try {
    state.actors.xuan.energy = 19;
    renderDrawer(state);
    assert.match(drawer.innerHTML, /睡1小时恢复20/);
    assert.match(drawer.innerHTML, /速溶4杯或咖啡店现制2杯补20（混饮累计）/);
    assert.match(drawer.innerHTML, /data-sleep-hour="6"/);
    assert.match(drawer.innerHTML, /data-view-coffee/);
    state.actors.xuan.coffeeCredit = 1;
    renderDrawer(state);
    assert.doesNotMatch(drawer.innerHTML, /data-sleep-hour=/);
  } finally {
    globalThis.document = priorDocument;
  }
});

test('夜间库存可看但咖啡使用入口被禁用', async () => {
  await loadData();
  const state = fresh(85);
  makeItem(state, 'coffee', 'xuan');
  const modalContent = { innerHTML: '', querySelectorAll: () => [] };
  const simple = { classList: { add() {}, remove() {}, toggle() {} }, querySelector: () => null, style: {} };
  const cells = { toast: simple, modalContent, modal: simple, modalOverlay: simple, modalClose: {}, inventoryFurniture: {} };
  const priorDocument = globalThis.document;
  globalThis.document = { getElementById: (id) => cells[id], body: { style: {} }, activeElement: null };
  UI.state = state;
  UI.night = { day: 1 };
  try {
    showInventory('xuan');
    assert.match(modalContent.innerHTML, /data-use="[^"]+" data-actor="xuan" disabled/);
    assert.match(modalContent.innerHTML, /结束夜间活动后可在清晨使用物品/);
    UI.night = null;
    showInventory('xuan');
    assert.match(modalContent.innerHTML, /data-use="[^"]+" data-actor="xuan"\s*>使用/);
  } finally {
    UI.night = null;
    globalThis.document = priorDocument;
  }
});

test('行动抽屉按钮可折叠并保持 aria 状态，重绘内容不改变展开状态', async () => {
  await loadData();
  const state = fresh(86);
  const toggle = { attrs: { 'aria-expanded': 'false' }, getAttribute(name) { return this.attrs[name]; }, setAttribute(name, value) { this.attrs[name] = value; } };
  const drawer = { hidden: true, innerHTML: '' };
  const planner = { hidden: true };
  const overlay = { hidden: true };
  const close = { focused: false, focus() { this.focused = true; } };
  const priorDocument = globalThis.document;
  globalThis.document = { getElementById: (id) => ({ planToggle: toggle, drawer, planner, plannerOverlay: overlay, plannerClose: close })[id], activeElement: toggle, body: { classList: { toggle() {} } } };
  UI.state = state; UI.data = await loadData(); UI.sel.actor = 'xuan'; UI.sel.hour = 6; UI.sel.zone = null; UI.sel.action = 'scavenge'; UI.sel.cart = []; UI.sel.targets = [];
  try {
    setDrawerExpanded(true);
    assert.equal(toggle.getAttribute('aria-expanded'), 'true');
    assert.equal(overlay.hidden, false);
    assert.equal(close.focused, true);
    assert.equal(drawer.hidden, false);
    assert.equal(planner.hidden, false);
    renderDrawer(state);
    assert.equal(drawer.hidden, false);
    assert.equal(planner.hidden, false);
    setDrawerExpanded(false);
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(overlay.hidden, true);
    assert.equal(drawer.hidden, true);
    assert.equal(planner.hidden, true);
  } finally {
    globalThis.document = priorDocument;
  }
});

test('工具栏按钮按空格由自身处理，不进入全局推进快捷键', () => {
  const toggle = { closest: (selector) => selector.includes('button') ? {} : null };
  const action = { closest: (selector) => selector.includes('button') ? {} : null };
  const elsewhere = { closest: () => null };
  assert.equal(plannerToggleOwnsSpace({ code: 'Space', target: toggle }), true);
  assert.equal(plannerToggleOwnsSpace({ code: 'Space', target: action }), true);
  assert.equal(plannerToggleOwnsSpace({ code: 'Space', target: elsewhere }), false);
  assert.equal(plannerToggleOwnsSpace({ code: 'Enter', target: toggle }), false);
});

test('规划窗口背景与Escape关闭，Tab留在窗口并归还焦点', () => {
  const priorDocument = globalThis.document;
  const toggle = { attrs: {}, getAttribute(name) { return this.attrs[name]; }, setAttribute(name, value) { this.attrs[name] = value; }, focus() { globalThis.document.activeElement = this; } };
  const first = { getClientRects: () => [{}], focus() { globalThis.document.activeElement = this; } };
  const last = { getClientRects: () => [{}], focus() { globalThis.document.activeElement = this; } };
  const overlay = { hidden: true, contains(node) { return node === first || node === last; } };
  const panel = { querySelectorAll: () => [first, last] };
  const drawer = { hidden: true }, planner = { hidden: true };
  const cells = { planToggle: toggle, plannerOverlay: overlay, plannerWindow: panel, plannerClose: first, drawer, planner, modalOverlay: { classList: { contains: () => false } } };
  globalThis.document = { getElementById: (id) => cells[id], activeElement: toggle, body: { classList: { toggle() {} } }, addEventListener(type, listener) { if (type === 'keydown') this.keydown = listener; } };
  try {
    bindPlannerWindow();
    setDrawerExpanded(true);
    assert.equal(globalThis.document.activeElement, first);
    overlay.onclick({ target: {} });
    assert.equal(overlay.hidden, false);
    globalThis.document.activeElement = last;
    let prevented = false;
    overlay.onkeydown({ key: 'Tab', shiftKey: false, preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(globalThis.document.activeElement, first);
    globalThis.document.activeElement = {};
    globalThis.document.keydown({ key: 'Tab', preventDefault() { prevented = true; } });
    assert.equal(globalThis.document.activeElement, first);
    overlay.onkeydown({ key: 'Escape', preventDefault() {}, stopPropagation() {} });
    assert.equal(overlay.hidden, true);
    assert.equal(globalThis.document.activeElement, toggle);
    setDrawerExpanded(true);
    overlay.onclick({ target: overlay });
    assert.equal(overlay.hidden, true);
  } finally {
    globalThis.document = priorDocument;
  }
});
