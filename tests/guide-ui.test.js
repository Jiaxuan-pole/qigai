// 引导任务链的 UI 接线：任务条第一张是引导卡且自动展开，跳过后回到长期目标；任务进度弹层列出当天全部步骤。
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../public/game/data.js';
import { fresh } from '../public/game/engine.js';
import { guideSteps, skipGuide } from '../public/game/guide.js';
import { UI } from '../public/ui/core.js';

function element(extra = {}) {
  const classes = new Set(), attrs = {};
  return {
    hidden: false, attrs, dataset: {}, style: {}, innerHTML: '', focus() {},
    classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)), contains: (c) => classes.has(c) },
    setAttribute(key, value) { attrs[key] = String(value); },
    getAttribute(key) { return attrs[key] ?? null; },
    removeAttribute(key) { delete attrs[key]; },
    querySelector: () => null,
    querySelectorAll: () => [],
    ...extra,
  };
}

// 假 DOM 只挂 tasks.js 与 core.js 弹层会碰到的节点；不认识的选择器返回空，用来验证判空。
function mount() {
  const nodes = { taskStrip: element(), modalOverlay: element(), modalContent: element(), modal: element(), modalClose: element(), modalTabs: element(), toast: element() };
  const prior = { document: globalThis.document, window: globalThis.window, localStorage: globalThis.localStorage };
  globalThis.document = {
    activeElement: null,
    body: { style: {}, classList: { toggle() {} } },
    getElementById: (id) => nodes[id] ?? null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
  };
  globalThis.window = {};
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  return { nodes, restore() { Object.assign(globalThis, prior); UI.night = null; UI.state = null; } };
}

const count = (html, needle) => html.split(needle).length - 1;
const listHidden = (html) => /<div id="taskStripList" class="task-strip-list" hidden>/.test(html);

test('第 1 天任务条：第一张是引导卡（带执行与跳过按钮），列表自动展开，长期目标只列一条', async () => {
  await loadData();
  const dom = mount();
  try {
    const { renderTaskStrip } = await import('../public/ui/tasks.js');
    UI.state = fresh(1);
    renderTaskStrip();
    const html = dom.nodes.taskStrip.innerHTML;
    const firstItem = html.match(/<article class="task-item [^"]*"/)?.[0];
    assert.match(firstItem, /task-onboarding/);
    assert.match(html, /data-guide-step="/);
    assert.match(html, /data-guide-action/);
    assert.match(html, /data-guide-skip/);
    assert.match(html, /<span>引导<\/span>/);
    assert.match(html, /class="task-strip-summary">第1天引导 \d+\/\d+</);
    assert.equal(listHidden(html), false, '有引导时自动展开');
    assert.equal(count(html, 'data-objective='), 1);
  } finally { dom.restore(); }
});

test('跳过引导后：没有引导卡，长期目标回到三条，列表收起', async () => {
  await loadData();
  const dom = mount();
  try {
    const { renderTaskStrip } = await import('../public/ui/tasks.js');
    UI.state = skipGuide(fresh(1)).state;
    renderTaskStrip();
    const html = dom.nodes.taskStrip.innerHTML;
    assert.equal(count(html, 'task-onboarding'), 0);
    assert.equal(count(html, 'data-objective='), 3);
    assert.equal(listHidden(html), true, '没有引导时自动收起');
    assert.doesNotMatch(html, /引导/);
  } finally { dom.restore(); }
});

test('第 4 天起没有引导卡', async () => {
  await loadData();
  const dom = mount();
  try {
    const { renderTaskStrip } = await import('../public/ui/tasks.js');
    UI.state = { ...fresh(1), day: 4 };
    renderTaskStrip();
    assert.equal(count(dom.nodes.taskStrip.innerHTML, 'task-onboarding'), 0);
  } finally { dom.restore(); }
});

test('任务进度弹层：最上方列出当天全部引导步骤，只有当前步带执行按钮，末尾能跳过', async () => {
  await loadData();
  const dom = mount();
  try {
    const { showTasks } = await import('../public/ui/tasks.js');
    UI.state = fresh(1);
    showTasks();
    const html = dom.nodes.modalContent.innerHTML;
    assert.match(html, /<section class="task-onboarding-list"><h3>新手引导<\/h3>/);
    assert.equal(count(html, '<article class="task-item task-onboarding'), guideSteps(UI.state).length);
    assert.equal(count(html, 'data-guide-step="'), guideSteps(UI.state).length);
    assert.ok(guideSteps(UI.state).length > 0);
    assert.equal(count(html, 'data-guide-action'), 1);
    assert.equal(count(html, 'data-guide-skip'), 1);
    assert.match(html, /class="task-status">(进行中|待开启|已完成)</);
    assert.equal(dom.nodes.modalOverlay.classList.contains('open'), true);
  } finally { dom.restore(); }
});

test('点引导按钮：plan 类走 onGuidePlan 并把执行者切成该步的人；没配 handler 时按钮禁用', async () => {
  await loadData();
  const dom = mount();
  try {
    const { configureTasks, renderTaskStrip } = await import('../public/ui/tasks.js');
    let button;
    dom.nodes.taskStrip.querySelectorAll = (selector) => (selector === '[data-guide-action]' ? [button = { dataset: {} }] : []);
    UI.state = fresh(1);
    // 第 1 天首步是热点预约（event 类）；把赠餐标成已预约，让当前步落到帮厨这个 plan 类步骤。
    UI.state.events.find((e) => e.templateId === 'beg_food').status = 'reserved';
    UI.render = () => {};
    configureTasks({});
    renderTaskStrip();
    assert.match(dom.nodes.taskStrip.innerHTML, /data-guide-action disabled/);
    const calls = [];
    configureTasks({ onGuidePlan: (request) => calls.push(request), onPlan: () => calls.push('wrong handler') });
    renderTaskStrip();
    assert.doesNotMatch(dom.nodes.taskStrip.innerHTML, /data-guide-action disabled/);
    button.onclick();
    assert.deepEqual(calls, [{ actorId: 'fan', actionId: 'kitchen', zone: 'market' }]);
    assert.equal(UI.sel.actor, 'fan');
  } finally { UI.sel.actor = 'xuan'; UI.render = () => {}; dom.restore(); }
});

// 放在最后：点过开关后模块里的展开状态就固定成布尔，会影响后面依赖「自动」的用例。
test('点过展开/收起后不再自动：有引导时点一下收起，重渲染仍收起', async () => {
  await loadData();
  const dom = mount();
  try {
    const { renderTaskStrip } = await import('../public/ui/tasks.js');
    let toggle;
    dom.nodes.taskStrip.querySelectorAll = (selector) => (selector === '[data-toggle-task-strip]' ? [toggle = { dataset: {} }] : []);
    UI.state = fresh(1);
    renderTaskStrip();
    assert.match(dom.nodes.taskStrip.innerHTML, /data-toggle-task-strip[^>]*aria-expanded="true"/);
    toggle.onclick();
    assert.match(dom.nodes.taskStrip.innerHTML, /data-toggle-task-strip[^>]*aria-expanded="false"/);
    assert.equal(listHidden(dom.nodes.taskStrip.innerHTML), true);
    renderTaskStrip();
    assert.equal(listHidden(dom.nodes.taskStrip.innerHTML), true, '显式收起后重渲染不再自动展开');
    toggle.onclick();
    assert.equal(listHidden(dom.nodes.taskStrip.innerHTML), false);
    UI.state = skipGuide(UI.state).state;
    renderTaskStrip();
    assert.equal(listHidden(dom.nodes.taskStrip.innerHTML), false, '显式展开后没有引导也保持展开');
  } finally { dom.restore(); }
});

test('没有 #taskStrip 节点时静默跳过', async () => {
  await loadData();
  const dom = mount();
  try {
    delete dom.nodes.taskStrip;
    const { renderTaskStrip } = await import('../public/ui/tasks.js');
    UI.state = fresh(1);
    assert.doesNotThrow(renderTaskStrip);
  } finally { dom.restore(); }
});
