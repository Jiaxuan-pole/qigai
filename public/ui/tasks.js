import { objectives, actionHints } from '../game/objectives.js';
import { acceptFavor, deliverFavor } from '../game/engine.js';
import { guideSteps, currentGuide, guideSummary, skipGuide } from '../game/guide.js';
import { $, esc, UI, apply, closeModal, modalOpen, showModal, toast } from './core.js';

let handlers = {};
// null 表示自动：有引导步骤就展开、没有就收起；玩家点过展开/收起后固定为布尔，不再自动。
let taskStripExpanded = null;

export function configureTasks(callbacks = {}) {
  handlers = { ...callbacks };
}

const STATUS = { urgent: '优先处理', active: '进行中', ready: '已达条件', available: '可接取', completed: '已完成', locked: '待开启', guide: '行动建议', failed: '未完成' };
const KIND = { survival: '生存', favor: '长期互助', route: '人生出路', daily: '建议', chapter: '章节', event: '街头机会', headline: '今日事' };
const HANDLER = { plan: 'onPlan', npcs: 'onNpcs', inventory: 'onInventory', event: 'onEvent', camp: 'onCamp', endDay: 'onEndDay', shop: 'onShop', wishes: 'onWishes' };
// 引导里的 plan 走 onGuidePlan：像街景热点一样立刻做这一小时，而不是打开排程窗口。
const GUIDE_HANDLER = { ...HANDLER, plan: 'onGuidePlan' };

function blocked() {
  return !UI.state || UI.night || UI.state.phase !== 'planning' || UI.state.pending?.combat || UI.state.pending?.workGames?.length;
}

function canRun(cta, handlerOf = HANDLER) {
  if (!cta) return false;
  if (['accept', 'deliver'].includes(cta.kind)) return true;
  return typeof handlers[handlerOf[cta.kind]] === 'function';
}

function actionButton(task) {
  if (!task.cta) return '';
  return `<button class="task-action" data-task-action="${esc(task.id)}" ${blocked() || !canRun(task.cta) ? 'disabled' : ''}>${esc(task.cta.label)}</button>`;
}

function progressText(task) {
  return task.progress === null || task.target === null ? '' : `${task.progress}/${task.target}${task.unit ? ' ' + task.unit : ''}`;
}

function taskMarkup(task, compact = false) {
  const nextPreparation = compact && task.kind === 'survival' ? task.conditions?.find((condition) => !condition.complete) : null;
  return `<article class="task-item task-${esc(task.status)}" data-objective="${esc(task.id)}">
    <div class="task-copy"><div class="task-meta"><span>${esc(KIND[task.kind])}</span><span class="task-status">${esc(STATUS[task.status])}</span>${task.location ? `<span>${esc(task.location)}</span>` : ''}</div>
    <strong>${esc(task.title)}</strong>${compact ? (nextPreparation ? `<small>下一步：${esc(nextPreparation.label)}</small>` : '') : `<p class="small">${esc(task.detail)}</p>`}
    ${progressText(task) ? `<span class="task-progress small">${esc(progressText(task))}</span>` : ''}</div>${actionButton(task)}</article>`;
}

const skipButton = '<button class="linkbtn" data-guide-skip>跳过引导</button>';

// meta 是「引导」后面那个 span 的内容；withAction 决定是否画执行按钮（只有当前步画）；withSkip 把跳过按钮放进卡里（任务条用）。
function guideMarkup(step, meta, { withAction = false, withSkip = false } = {}) {
  const action = withAction && step.cta ? `<button class="task-action" data-guide-action ${blocked() || !canRun(step.cta, GUIDE_HANDLER) ? 'disabled' : ''}>${esc(step.cta.label)}</button>` : '';
  const buttons = action || withSkip ? `<div class="task-onboarding-btns">${action}${withSkip ? skipButton : ''}</div>` : '';
  return `<article class="task-item task-onboarding${step.done ? ' task-onboarding-done' : ''}" data-guide-step="${esc(step.id)}">
    <div class="task-copy"><div class="task-meta"><span>引导</span>${meta}</div>
    <strong>${esc(step.title)}</strong><small>${esc(step.why)}</small></div>${buttons}</article>`;
}

function dispatch(cta, handlerOf) {
  // 锁定弹层（乞讨、翻桶、工作挑战）期间任务条按钮不该绕过它。
  if (UI.modalLock) return;
  if (cta.actorId) UI.sel.actor = cta.actorId;
  if (cta.kind === 'accept' || cta.kind === 'deliver') {
    // 面板里点的就刷新面板；从任务条点的只提示一句，别突然弹出整张面板。
    const inPanel = modalOpen();
    const result = cta.kind === 'accept' ? acceptFavor(UI.state, cta.npcId, cta.actorId) : deliverFavor(UI.state, cta.npcId, cta.actorId);
    if (apply(result)) { if (inPanel) showTasks(); else toast(UI.state.log?.[0] || '已办好。'); }
    return;
  }
  if (modalOpen()) closeModal();
  const run = handlers[handlerOf[cta.kind]];
  if (cta.kind === 'plan') run({ actorId: cta.actorId, actionId: cta.actionId, zone: cta.zone });
  else if (cta.kind === 'npcs') run(cta.district);
  else if (cta.kind === 'inventory') run(cta.actorId);
  else if (cta.kind === 'event') run(cta.eventUid);
  else if (cta.kind === 'shop') run(cta.shopId, cta.actorId);
  else run();
}

function runTask(id) {
  if (blocked()) return;
  const task = [...objectives(UI.state), ...actionHints(UI.state)].find((entry) => entry.id === id);
  if (!canRun(task?.cta)) return;
  dispatch(task.cta, HANDLER);
}

function runGuide() {
  if (blocked()) return;
  const cta = currentGuide(UI.state)?.step.cta;
  if (!canRun(cta, GUIDE_HANDLER)) return;
  dispatch(cta, GUIDE_HANDLER);
}

function skipGuideChain() {
  if (apply(skipGuide(UI.state)) && modalOpen()) showTasks();
}

function bindTasks(root) {
  root.querySelectorAll('[data-task-action]').forEach((button) => { button.onclick = () => runTask(button.dataset.taskAction); });
  root.querySelectorAll('[data-guide-action]').forEach((button) => { button.onclick = runGuide; });
  root.querySelectorAll('[data-guide-skip]').forEach((button) => { button.onclick = skipGuideChain; });
  root.querySelectorAll('[data-show-tasks]').forEach((button) => { button.onclick = showTasks; });
  root.querySelectorAll('[data-toggle-task-strip]').forEach((button) => {
    // 重渲染会销毁被点的按钮，键盘用户的焦点得还给新的开关。
    button.onclick = () => { taskStripExpanded = !(taskStripExpanded ?? Boolean(currentGuide(UI.state))); renderTaskStrip(); $('taskStrip')?.querySelector?.('[data-toggle-task-strip]')?.focus?.(); };
  });
}

export function renderTaskStrip() {
  const root = $('taskStrip');
  if (!root) return;
  const guide = currentGuide(UI.state);
  const expanded = taskStripExpanded ?? Boolean(guide);
  const tasks = objectives(UI.state);
  const current = tasks.filter((task) => !['completed', 'locked', 'failed'].includes(task.status)).slice(0, guide ? 1 : 3);
  const stage = tasks.find((task) => task.kind === 'survival');
  const stageSummary = stage ? `${stage.title}${progressText(stage) ? ` · ${progressText(stage)}` : ''}` : '当前没有长期目标';
  const guideText = guide ? guideSummary(UI.state) : null;
  const guideCard = guide ? guideMarkup(guide.step, `<span>${esc(guideText)}</span>`, { withAction: true, withSkip: true }) : '';
  const list = guideCard + current.map((task) => taskMarkup(task, true)).join('');
  root.innerHTML = `<div class="task-strip-heading"><div class="task-strip-title"><strong>长期目标</strong><span class="task-strip-summary">${esc(guideText || stageSummary)}</span></div><div class="task-strip-actions"><button type="button" data-toggle-task-strip aria-controls="taskStripList" aria-expanded="${expanded}">${expanded ? '收起' : '展开'}</button><button data-show-tasks>任务进度</button></div></div><div id="taskStripList" class="task-strip-list"${expanded ? '' : ' hidden'}>${list || '<p class="small muted">这段旅程已经结束。</p>'}</div>`;
  bindTasks(root);
}

function guideListMarkup() {
  const steps = guideSteps(UI.state);
  if (!steps.length) return '';
  const currentId = currentGuide(UI.state)?.step.id;
  const status = (step) => (step.done ? '已完成' : step.possible ? '进行中' : '待开启');
  return `<section class="task-onboarding-list"><h3>新手引导</h3>${steps.map((step) => guideMarkup(step, `<span class="task-status">${status(step)}</span>`, { withAction: step.id === currentId })).join('')}${skipButton}</section>`;
}

export function showTasks() {
  const tasks = objectives(UI.state);
  const pending = tasks.filter((task) => task.status !== 'completed');
  const completed = tasks.filter((task) => task.status === 'completed');
  const hints = actionHints(UI.state).filter(task => task.status !== 'completed');
  const body = `${guideListMarkup()}<div class="task-summary small">长期目标 ${pending.length} · 已完成 ${completed.length}</div>
    <div class="task-list">${pending.map((task) => taskMarkup(task)).join('') || '<p class="muted">当前没有待办任务。</p>'}</div>
    ${completed.length ? `<h3>已完成</h3><div class="task-list task-completed-list">${completed.map((task) => taskMarkup(task)).join('')}</div>` : ''}
    ${hints.length ? `<details class="task-hints"><summary>眼下的行动建议与街头机会</summary><div class="task-list">${hints.map(task => taskMarkup(task)).join('')}</div></details>` : ''}`;
  showModal('长期任务', body, { wide: true, tag: 'STREET TASKS' });
  bindTasks($('modalContent'));
}
