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

test('行动显示独立时长选择和总消耗，连续计划显示结束时间', async () => {
  await loadData();
  const state = fresh(184);
  state.pendingMorning = null;
  const cells = Object.fromEntries(['drawer', 'schedule', 'planFocus', 'btnAdvance', 'planStatus'].map(id => [id, { innerHTML: '', textContent: '', style: {} }]));
  const before = globalThis.document;
  globalThis.document = { getElementById: id => cells[id] };
  UI.state = state; UI.data = await loadData();
  Object.assign(UI.sel, { actor: 'xuan', hour: 6, action: 'sleep', zone: null, duration: 3, cart: [], targets: [] });
  try {
    renderDrawer(state);
    assert.match(cells.drawer.innerHTML, /id="durationPick"/);
    assert.match(cells.drawer.innerHTML, /06:00.*09:00/);
    assert.match(cells.drawer.innerHTML, /精神/);
    const result = assign(state, 'xuan', 6, 'sleep', { duration: 3 });
    assert.equal(result.error, undefined);
    renderSchedule(result.state);
    assert.match(cells.schedule.innerHTML, /连续3小时/);
    assert.match(cells.schedule.innerHTML, /09:00/);
    assert.match(cells.schedule.innerHTML, /基础精神\+0/);
  } finally { globalThis.document = before; UI.sel.duration = undefined; }
});

test('行动抽屉使用引擎预估显示工资加成后的完整收支', async () => {
  await loadData();
  const state = fresh(185);
  state.pendingMorning = null;
  state.flags.trialPassed = true;
  state.actors.xuan.energy = 100;
  const drawer = { innerHTML: '' };
  const before = globalThis.document;
  globalThis.document = { getElementById: (id) => id === 'drawer' ? drawer : null };
  UI.state = state; UI.data = await loadData();
  Object.assign(UI.sel, { actor: 'xuan', hour: 6, action: 'repair', zone: null, duration: 2, cart: [], targets: [] });
  try {
    renderDrawer(state);
    assert.match(drawer.innerHTML, /预计变化：精神 \+0（待结算 -2）·体力 -40·现金 \+30/);
    assert.match(drawer.innerHTML, /每小时基础耗材：<b>零件1<\/b>/);
  } finally { globalThis.document = before; UI.sel.duration = undefined; }
});

test('行动抽屉使用引擎预估显示睡眠实际恢复', async () => {
  await loadData();
  const state = fresh(186);
  state.pendingMorning = null;
  state.actors.xuan.energy = 10;
  const drawer = { innerHTML: '' };
  const before = globalThis.document;
  globalThis.document = { getElementById: (id) => id === 'drawer' ? drawer : null };
  UI.state = state; UI.data = await loadData();
  Object.assign(UI.sel, { actor: 'xuan', hour: 6, action: 'sleep', zone: null, duration: 3, cart: [], targets: [] });
  try {
    renderDrawer(state);
    assert.match(drawer.innerHTML, /预计变化：精神 \+0·体力 \+60·现金 \+0/);
  } finally { globalThis.document = before; UI.sel.duration = undefined; }
});

test('行动抽屉将资源不足的部分预估标为未完整执行', async () => {
  await loadData();
  const state = fresh(187);
  state.pendingMorning = null;
  state.actors.xuan.energy = 100;
  state.parts = 1;
  const drawer = { innerHTML: '' };
  const before = globalThis.document;
  globalThis.document = { getElementById: (id) => id === 'drawer' ? drawer : null };
  UI.state = state; UI.data = await loadData();
  Object.assign(UI.sel, { actor: 'xuan', hour: 6, action: 'repair', zone: null, duration: 2, cart: [], targets: [] });
  try {
    renderDrawer(state);
    assert.match(drawer.innerHTML, /仅完成1\/2小时：精神 \+0（待结算 -1）·体力 -20·现金 \+13/);
    assert.match(drawer.innerHTML, /后续未执行：零件不足/);
    assert.doesNotMatch(drawer.innerHTML, /预计变化：精神 \+0（待结算 -1）·体力 -20·现金 \+13/);
  } finally { globalThis.document = before; UI.sel.duration = undefined; }
});

test('行动抽屉重绘时保留当前乞讨方式供预估和安排使用', async () => {
  await loadData();
  const state = fresh(188);
  state.pendingMorning = null;
  const drawer = { innerHTML: '', querySelector: (selector) => selector === '#begStyle' ? { value: 'sign' } : null };
  const before = globalThis.document;
  globalThis.document = { getElementById: (id) => id === 'drawer' ? drawer : null };
  UI.state = state; UI.data = await loadData();
  Object.assign(UI.sel, { actor: 'xuan', hour: 6, action: 'beg', zone: 'market', duration: 1, cart: [], targets: [] });
  try {
    renderDrawer(state);
    assert.match(drawer.innerHTML, /预计变化：/);
    assert.match(drawer.innerHTML, /option value="sign" selected/);
  } finally { globalThis.document = before; UI.sel.duration = undefined; }
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
    assert.match(modalContent.innerHTML, /data-use="[^"]+" data-actor="xuan"\s*>轩哥使用/);
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
