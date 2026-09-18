import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../public/game/data.js';
import { fresh, acceptFavor, deliverFavor, assign, task } from '../public/game/engine.js';
import { makeItem } from '../public/game/items.js';
import { noteAction, tickFavors } from '../public/game/favors.js';
import { preflight } from '../public/game/settle.js';

before(loadData);

async function list(state, selector = 'objectives') {
  const module = await import('../public/game/objectives.js').catch((error) => {
    if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
    throw error;
  });
  assert.equal(typeof module[selector], 'function', `需要可读取状态的${selector}生成器`);
  return module[selector](state);
}

const hints = (state) => list(state, 'actionHints');

test('当日建议独立于长期目标，仍包含真实工作地点和可安排动作且不改存档', async () => {
  const state = fresh(901);
  const beforeState = structuredClone(state);
  const tasks = await hints(state);
  const fan = tasks.find((task) => task.id === 'daily:1:fan');
  assert.match(fan.detail, /问早餐摊工作/);
  assert.deepEqual(fan.cta, { kind: 'plan', label: '安排凡哥早餐帮厨', actorId: 'fan', actionId: 'kitchen', zone: 'market' });
  assert.match(fan.location, /老街/);
  assert.equal(tasks.some((task) => task.actorId === 'ma'), false);
  assert.equal(new Set(tasks.map((task) => task.id)).size, tasks.length);
  assert.deepEqual(state, beforeState);
});

test('长期目标以十日生存阶段、章节、熟人关系和结局路线为主体', async () => {
  const state = fresh(914);
  const beforeState = structuredClone(state);
  state.actors.fan.food = 0;
  state.events = [{ uid: 'short-job', title: '临时工作', district: 'market', status: 'open', expiresTurn: 2 }];
  const tasks = await list(state);
  assert.deepEqual([...new Set(tasks.map((item) => item.kind))].sort(), ['chapter', 'favor', 'route', 'survival']);
  assert.equal(tasks.filter((item) => item.kind === 'survival').length, 1);
  const survival = tasks.find((item) => item.kind === 'survival');
  assert.equal(survival.id, 'survival:stage:1');
  assert.equal(survival.target, 3);
  assert.equal(survival.unit, '项准备');
  assert.match(survival.title, /第1-10天/);
  assert.match(survival.detail, /刘姐.*0\/2/);
  assert.match(survival.detail, /防雨1\/2/);
  assert.match(survival.detail, /应急现金72\/52/);
  assert.match(survival.detail, /下一步.*刘姐/);
  assert.equal(survival.cta.kind, 'plan');
  const assigned = assign(state, survival.cta.actorId, state.hour, survival.cta.actionId, { zone: survival.cta.zone });
  assigned.state.pendingMorning = null;
  assert.equal(assigned.error, undefined);
  assert.equal(preflight(assigned.state).error, undefined);
  assert.equal(tasks.some((item) => item.id.startsWith('daily:') || item.id.startsWith('event:')), false);
  assert.equal(tasks.filter((item) => item.kind === 'favor').length, 5);
  assert.equal(tasks.filter((item) => item.kind === 'route').length, 3);
  assert.equal(state.cash, beforeState.cash);
  assert.deepEqual(state.flags, beforeState.flags);
});

test('十日阶段跨日保持相同目标，阶段边界更换准备项且章节进度不变', async () => {
  const state = fresh(915);
  const initial = (await list(state)).find((item) => item.kind === 'survival');
  state.day = 9;
  const later = (await list(state)).find((item) => item.kind === 'survival');
  assert.equal(later.id, initial.id);
  assert.equal(later.title, initial.title);
  assert.equal(later.progress, initial.progress);
  assert.deepEqual(later.conditions, initial.conditions);
  state.day = 11;
  const second = (await list(state)).find((item) => item.kind === 'survival');
  assert.equal(second.id, 'survival:stage:2');
  assert.match(second.title, /第11-20天/);
  assert.match(second.detail, /暴雨/);
  state.day = 12;
  let tasks = await list(state);
  assert.equal(tasks.find((item) => item.kind === 'survival').id, second.id);
  const chapters = tasks.filter((item) => item.kind === 'chapter');
  assert.equal(chapters.length, 2);
  assert.deepEqual(chapters.map(({ progress, target, status }) => ({ progress, target, status })), [
    { progress: 1, target: 10, status: 'active' }, { progress: 10, target: 10, status: 'completed' },
  ]);
});

test('阶段进度来自真实委托、防雨和现金，达标仍置顶到本阶段结束', async () => {
  const state = fresh(918);
  state.cash = 0;
  let survival = (await list(state))[0];
  assert.equal(survival.progress, 0);
  state.favors.reg_liu = { step: 0, done: [], active: { id: 'liu1', progress: 1, deadline: 5 }, cooldownUntil: 0 };
  survival = (await list(state))[0];
  assert.match(survival.detail, /刘姐.*1\/2/);
  assert.equal(survival.progress, 0);
  state.favors.reg_liu.done = ['liu1'];
  state.flags.liuBonusMeal = true;
  state.flags.wangShelter = true;
  state.cash = 52;
  const beforeState = structuredClone(state);
  survival = (await list(state))[0];
  assert.equal(survival.progress, 3);
  assert.equal(survival.status, 'ready');
  assert.equal(survival.priority, 0);
  assert.equal(survival.cta, null);
  assert.match(survival.detail, /维持.*第10天/);
  assert.deepEqual(state, beforeState);
});

test('十个阶段都含可测量的准备条件，阶段读取不改存档且下一步可执行', async () => {
  const state = fresh(919);
  state.pendingMorning = null;
  const ids = [];
  for (let day = 1; day <= 100; day += 10) {
    state.day = day;
    const beforeState = structuredClone(state);
    const survival = (await list(state))[0];
    ids.push(survival.id);
    assert.equal(survival.priority, 0);
    assert.equal(survival.target, survival.conditions.length);
    assert.ok(survival.conditions.length >= 3);
    assert.ok(survival.conditions.every((condition) => Number.isFinite(condition.progress) && Number.isFinite(condition.target)));
    assert.match(survival.detail, /下一步|维持/);
    assert.deepEqual(state, beforeState);
    if (survival.cta?.kind === 'plan') {
      const assigned = assign(state, survival.cta.actorId, state.hour, survival.cta.actionId, { zone: survival.cta.zone });
      assert.equal(assigned.error, undefined, survival.title);
      assert.equal(preflight(assigned.state).error, undefined, survival.title);
    }
  }
  assert.equal(new Set(ids).size, 10);
});

test('寒潮准备只把真正可分配的干毯算给存活角色，食物按鲜度计算', async () => {
  const state = fresh(920);
  state.day = 61;
  state.flags.wangShelter = true;
  makeItem(state, 'blanket', 'fan');
  makeItem(state, 'blanket', 'fan');
  makeItem(state, 'blanket', 'camp').wet = true;
  let survival = (await list(state))[0];
  assert.equal(survival.conditions.find((item) => item.id === 'blankets').progress, 1);
  assert.equal(survival.conditions.find((item) => item.id === 'food').progress, 0);
  assert.equal(survival.cta.kind, 'inventory');
  makeItem(state, 'blanket', 'camp');
  survival = (await list(state))[0];
  assert.equal(survival.conditions.find((item) => item.id === 'blankets').progress, 2);
});

test('最终生存按真实结局完成，全灭失败且不再提供行动', async () => {
  const state = fresh(921);
  state.day = 100;
  state.hour = 21;
  assert.notEqual((await list(state))[0].status, 'completed');
  state.phase = 'ending';
  const survived = (await list(state))[0];
  assert.equal(survived.status, 'completed');
  assert.equal(survived.cta, null);
  state.phase = 'gameover';
  state.day = 12;
  state.actors.fan.life = 'dead';
  state.actors.xuan.life = 'dead';
  assert.equal((await list(state))[0].status, 'failed');
  assert.equal((await list(state))[0].cta, null);
});

test('结局路线展示引擎既有积累，达标后仍需选定且读取不发奖励', async () => {
  const state = fresh(916);
  state.art = 3;
  state.flags.fixedJobs = 6;
  let route = (await list(state)).find((item) => item.id === 'route:studio');
  assert.equal(route.status, 'locked');
  assert.match(route.detail, /作品3\/3，固定单6\/6/);
  state.day = 85;
  state.flags.route = 'studio';
  route = (await list(state)).find((item) => item.id === 'route:studio');
  assert.equal(route.status, 'ready');
  assert.equal(route.progress, null);
  state.day = 100;
  state.phase = 'ending';
  const beforeState = structuredClone(state);
  assert.equal((await list(state)).find((item) => item.id === 'route:studio').status, 'completed');
  assert.deepEqual(state, beforeState);
  state.phase = 'gameover';
  assert.equal((await list(state)).find((item) => item.id === 'route:studio').status, 'failed');
});

test('在熟人街区可接委托，行动进度和完成奖励由原引擎产生', async () => {
  let state = fresh(902);
  state.pendingMorning = null;
  state.actors.fan.location = 'market';
  let task = (await list(state)).find((item) => item.id === 'favor:reg_liu');
  assert.equal(task.status, 'available');
  assert.equal(task.cta.kind, 'accept');
  assert.equal(task.cta.actorId, 'fan');
  state = acceptFavor(state, task.cta.npcId, task.cta.actorId).state;
  noteAction(state, 'fan', 'kitchen', 'market');
  task = (await list(state)).find((item) => item.id === 'favor:reg_liu');
  assert.equal(task.status, 'active');
  assert.equal(task.progress, 0);
  assert.equal(task.target, 3);
  assert.equal(task.stepProgress, 1);
  assert.equal(task.stepTarget, 2);
  assert.equal(task.cta.actionId, 'kitchen');
  assert.equal(state.flags.liuBonusMeal, undefined);
  noteAction(state, 'fan', 'kitchen', 'market');
  tickFavors(state, []);
  task = (await list(state)).find((item) => item.id === 'favor:reg_liu');
  assert.equal(task.progress, 1);
  assert.equal(task.target, 3);
  assert.equal(task.stepId, 'liu2');
  assert.equal(state.flags.liuBonusMeal, true);
});

test('交付委托只在持物者抵达目标街区后提供交付，已交付不会再次消耗', async () => {
  let state = fresh(903);
  state.pendingMorning = null;
  state.favors.reg_liu = { step: 2, done: ['liu1', 'liu2'], cooldownUntil: 0, active: { id: 'liu3', progress: 0, deadline: 4 } };
  makeItem(state, 'hot_soup', 'fan');
  let task = (await list(state)).find((item) => item.id === 'favor:reg_liu');
  assert.equal(task.cta.kind, 'plan');
  assert.equal(task.cta.zone, 'service');
  assert.equal(task.cta.actorId, 'fan');
  state.actors.fan.location = 'service';
  task = (await list(state)).find((item) => item.id === 'favor:reg_liu');
  assert.equal(task.cta.kind, 'deliver');
  state = deliverFavor(state, task.cta.npcId, task.cta.actorId).state;
  task = (await list(state)).find((item) => item.id === 'favor:reg_liu');
  assert.equal(task.status, 'ready');
  assert.equal(task.progress, 2);
  assert.equal(task.stepProgress, 1);
  assert.equal(task.cta, null);
  tickFavors(state, []);
  state.day += 1;
  task = (await list(state)).find((item) => item.id === 'favor:reg_liu');
  assert.equal(task.status, 'completed');
  assert.equal(task.progress, 3);
  assert.equal(task.cta, null);
});

test('濒死救助排在普通任务之前，已死亡人物不分配行动', async () => {
  const state = fresh(904);
  state.actors.xuan.life = 'dead';
  state.actors.fan.life = 'downed';
  state.actors.fan.deadline = 2;
  const tasks = await hints(state);
  assert.equal(tasks[0].id, 'survival:fan:aid');
  assert.equal(tasks[0].cta.actionId, 'aid');
  assert.equal(tasks[0].cta.actorId, 'fan');
  assert.equal(tasks.some((task) => task.cta?.actorId === 'xuan'), false);
});

test('显示真实食物储备，过期事件和冷却委托不会被误标成可接取', async () => {
  const state = fresh(905);
  state.effectiveFood = 99;
  state.items = state.items.filter((item) => item.itemId !== 'meal');
  state.favors.reg_liu = { step: 0, done: [], active: null, cooldownUntil: 4 };
  state.events = [
    { uid: 'open-event', title: '现有短工', district: 'market', status: 'open', expiresTurn: 2 },
    { uid: 'old-event', title: '旧短工', district: 'market', status: 'open', expiresTurn: 0 },
    { uid: 'closed-event', title: '已处理', district: 'market', status: 'resolved', expiresTurn: 2 },
  ];
  const tasks = await hints(state);
  const reserve = tasks.find((task) => task.id === 'survival:food');
  assert.equal(reserve.progress, 0);
  assert.equal(reserve.target, 4);
  assert.equal((await list(state)).find((task) => task.id === 'favor:reg_liu').status, 'locked');
  assert.deepEqual(tasks.filter((task) => task.kind === 'event').map((task) => task.cta.eventUid), ['open-event']);
});

test('冻结状态也可读取，返回内容修改不污染委托与事件', async () => {
  const state = fresh(906);
  const freeze = (value) => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } };
  freeze(state);
  const tasks = await list(state);
  const task = tasks.find((item) => item.id === 'favor:reg_liu');
  task.title = '只改视图';
  task.cta.zone = 'camp';
  assert.notEqual((await list(state)).find((item) => item.id === 'favor:reg_liu').title, '只改视图');
});

test('体力不足时今日建议可由真实引擎安排并通过行动预检', async () => {
  const state = fresh(908);
  state.pendingMorning = null;
  state.actors.fan.energy = 0;
  const beforeState = structuredClone(state);
  const cta = (await hints(state)).find((item) => item.id === 'daily:1:fan').cta;
  const assigned = assign(state, cta.actorId, state.hour, cta.actionId, { zone: cta.zone });
  assert.equal(assigned.error, undefined);
  assert.equal(preflight(assigned.state).error, undefined);
  assert.deepEqual(state, beforeState);
});

test('角色执行长任务时不提供会被排程拒绝的覆盖按钮', async () => {
  const state = fresh(909);
  state.busy.fan = { task: task('warm', ['fan']), remainingHours: 2 };
  const tasks = [...await list(state), ...await hints(state)];
  assert.equal(tasks.find((item) => item.id === 'daily:1:fan').cta, null);
  assert.equal(tasks.some((item) => item.cta?.kind === 'plan' && item.cta.actorId === 'fan'), false);
});

test('前往委托街区的行动在捡瓶次数用完后仍可真实执行', async () => {
  const state = fresh(910);
  state.pendingMorning = null;
  state.daily.orders.bottles = 3;
  const cta = (await list(state)).find((item) => item.id === 'favor:reg_chen').cta;
  assert.equal(cta.zone, 'station');
  const assigned = assign(state, cta.actorId, state.hour, cta.actionId, { zone: cta.zone });
  assert.equal(assigned.error, undefined);
  assert.equal(preflight(assigned.state).error, undefined);
});

test('免费餐第三份解锁后缺粮目标仍能安排领取', async () => {
  const state = fresh(911);
  state.pendingMorning = null;
  state.items = state.items.filter((item) => item.itemId !== 'meal');
  state.flags.wangSoup = true;
  state.daily.orders.soup = 2;
  state.daily.orders.kitchen = 1;
  state.plan.fan[0] = null;
  const cta = (await hints(state)).find((item) => item.id === 'survival:food').cta;
  assert.equal(cta.actionId, 'soup');
  assert.equal(preflight(assign(state, cta.actorId, state.hour, cta.actionId, { zone: cta.zone }).state).error, undefined);
});

test('缺少修理材料时委托不会把无法执行的修旧电器列为下一步', async () => {
  const state = fresh(912);
  state.favors.reg_lu = { step: 1, done: ['lu1'], cooldownUntil: 0, active: { id: 'lu2', progress: 0, deadline: 7 } };
  const objective = (await list(state)).find((item) => item.id === 'favor:reg_lu');
  assert.equal(objective.status, 'active');
  assert.equal(objective.cta, null);
});

test('结局时仍可读取已完成任务，且不提供下一小时安排', async () => {
  const state = fresh(913);
  state.day = 100;
  state.hour = 22;
  state.phase = 'ending';
  state.favors.reg_liu = { step: 3, done: ['liu1', 'liu2', 'liu3'], active: null, cooldownUntil: 0 };
  state.actors.fan.location = 'station';
  const tasks = await list(state);
  assert.equal(tasks.find((item) => item.id === 'favor:reg_liu').status, 'completed');
  assert.equal(tasks.some((item) => item.cta), false);
  const chapter = tasks.filter((item) => item.kind === 'chapter').at(-1);
  assert.equal(chapter.status, 'completed');
  assert.equal(chapter.progress, chapter.target);
});

test('百日救援尾声仍可读取独立提示，不再读取已结束的当天排程', async () => {
  const state = fresh(917);
  state.day = 100;
  state.hour = 22;
  state.phase = 'tail';
  const tasks = await hints(state);
  assert.equal(tasks.filter((item) => item.kind === 'daily').every((item) => item.cta === null), true);
});

test('任务面板把安排交给集成回调，并通过引擎接取委托', async () => {
  const module = await import('../public/ui/tasks.js').catch((error) => {
    if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
    throw error;
  });
  assert.equal(typeof module.showTasks, 'function', '需要可操作的任务面板');
  const { UI } = await import('../public/ui/core.js');
  const taskButtons = [];
  const toggleButtons = [{ dataset: {} }];
  const content = { innerHTML: '', querySelectorAll(selector) {
    if (selector === '[data-task-action]') {
      taskButtons.length = 0;
      for (const match of this.innerHTML.matchAll(/data-task-action="([^"]+)"/g)) taskButtons.push({ dataset: { taskAction: match[1] } });
      return taskButtons;
    }
    if (selector === '[data-show-tasks]') return [...this.innerHTML.matchAll(/data-show-tasks/g)].map(() => ({ dataset: {} }));
    if (selector === '[data-toggle-task-strip]') return toggleButtons;
    return [];
  } };
  const plain = { classList: { add() {}, remove() {}, toggle() {} }, style: {}, querySelector: () => null };
  const cells = { taskStrip: content, modalContent: content, toast: plain, modal: plain, modalOverlay: plain, modalClose: {} };
  const previousDocument = globalThis.document;
  globalThis.document = { getElementById: (id) => cells[id], body: { style: {} }, activeElement: null };
  const oldState = UI.state;
  const oldNight = UI.night;
  const oldRender = UI.render;
  const oldActor = UI.sel.actor;
  try {
    UI.state = fresh(907);
    UI.state.pendingMorning = null;
    UI.night = null;
    UI.render = () => {};
    let planned;
    module.configureTasks({ onPlan: (request) => { planned = request; } });
    module.renderTaskStrip();
    assert.match(content.innerHTML, /长期目标/);
    assert.match(content.innerHTML, /data-toggle-task-strip[^>]*aria-expanded="false"/);
    assert.match(content.innerHTML, /id="taskStripList"[^>]* hidden/);
    assert.match(content.innerHTML, /data-show-tasks/);
    content.querySelectorAll('[data-toggle-task-strip]')[0].onclick();
    assert.match(content.innerHTML, /data-toggle-task-strip[^>]*aria-expanded="true"/);
    assert.doesNotMatch(content.innerHTML, /id="taskStripList"[^>]* hidden/);
    module.renderTaskStrip();
    assert.match(content.innerHTML, /data-toggle-task-strip[^>]*aria-expanded="true"/);
    module.showTasks();
    taskButtons.find((button) => button.dataset.taskAction === 'favor:reg_liu').onclick();
    assert.deepEqual(planned, { actorId: 'xuan', actionId: 'shop', zone: 'market' });
    assert.equal(UI.state.favors.reg_liu, undefined);
    UI.state.actors.fan.location = 'market';
    module.showTasks();
    taskButtons.find((button) => button.dataset.taskAction === 'favor:reg_liu').onclick();
    assert.equal(UI.state.favors.reg_liu.active.id, 'liu1');
    assert.equal(UI.state.favors.reg_liu.active.progress, 0);
    assert.equal(UI.state.flags.liuBonusMeal, undefined);
  } finally {
    globalThis.document = previousDocument;
    UI.state = oldState;
    UI.night = oldNight;
    UI.render = oldRender;
    UI.sel.actor = oldActor;
    module.configureTasks({});
  }
});
