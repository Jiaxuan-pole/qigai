import { objectives, actionHints } from '../game/objectives.js';
import { acceptFavor, deliverFavor } from '../game/engine.js';
import { $, esc, UI, apply, closeModal, showModal } from './core.js';

let handlers = {};

export function configureTasks(callbacks = {}) {
  handlers = { ...callbacks };
}

const STATUS = { urgent: '优先处理', active: '进行中', ready: '已达条件', available: '可接取', completed: '已完成', locked: '待开启', guide: '行动建议', failed: '未完成' };
const KIND = { survival: '生存', favor: '长期互助', route: '人生出路', daily: '建议', chapter: '章节', event: '街头机会' };

function blocked() {
  return !UI.state || UI.night || UI.state.phase !== 'planning' || UI.state.pending?.combat || UI.state.pending?.workGames?.length;
}

function canRun(cta) {
  if (!cta) return false;
  if (['accept', 'deliver'].includes(cta.kind)) return true;
  return typeof handlers[{ plan: 'onPlan', npcs: 'onNpcs', inventory: 'onInventory', event: 'onEvent' }[cta.kind]] === 'function';
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

function runTask(id) {
  if (blocked()) return;
  const task = [...objectives(UI.state), ...actionHints(UI.state)].find((entry) => entry.id === id);
  const cta = task?.cta;
  if (!canRun(cta)) return;
  if (cta.actorId) UI.sel.actor = cta.actorId;
  if (cta.kind === 'accept' || cta.kind === 'deliver') {
    const result = cta.kind === 'accept' ? acceptFavor(UI.state, cta.npcId, cta.actorId) : deliverFavor(UI.state, cta.npcId, cta.actorId);
    if (apply(result)) showTasks();
    return;
  }
  closeModal();
  if (cta.kind === 'plan') handlers.onPlan({ actorId: cta.actorId, actionId: cta.actionId, zone: cta.zone });
  else if (cta.kind === 'npcs') handlers.onNpcs(cta.district);
  else if (cta.kind === 'inventory') handlers.onInventory(cta.actorId);
  else if (cta.kind === 'event') handlers.onEvent(cta.eventUid);
}

function bindTasks(root) {
  root.querySelectorAll('[data-task-action]').forEach((button) => { button.onclick = () => runTask(button.dataset.taskAction); });
  root.querySelectorAll('[data-show-tasks]').forEach((button) => { button.onclick = showTasks; });
}

export function renderTaskStrip() {
  const root = $('taskStrip');
  if (!root) return;
  const tasks = objectives(UI.state);
  const current = tasks.filter((task) => !['completed', 'locked', 'failed'].includes(task.status)).slice(0, 3);
  root.innerHTML = `<div class="task-strip-heading"><strong>长期目标</strong><button data-show-tasks>任务进度</button></div><div class="task-strip-list">${current.length ? current.map((task) => taskMarkup(task, true)).join('') : '<p class="small muted">这段旅程已经结束。</p>'}</div>`;
  bindTasks(root);
}

export function showTasks() {
  const tasks = objectives(UI.state);
  const pending = tasks.filter((task) => task.status !== 'completed');
  const completed = tasks.filter((task) => task.status === 'completed');
  const hints = actionHints(UI.state).filter(task => task.status !== 'completed');
  const body = `<div class="task-summary small">长期目标 ${pending.length} · 已完成 ${completed.length}</div>
    <div class="task-list">${pending.map((task) => taskMarkup(task)).join('') || '<p class="muted">当前没有待办任务。</p>'}</div>
    ${completed.length ? `<h3>已完成</h3><div class="task-list task-completed-list">${completed.map((task) => taskMarkup(task)).join('')}</div>` : ''}
    ${hints.length ? `<details class="task-hints"><summary>眼下的行动建议与街头机会</summary><div class="task-list">${hints.map(task => taskMarkup(task)).join('')}</div></details>` : ''}`;
  showModal('长期任务', body, { wide: true, tag: 'STREET TASKS' });
  bindTasks($('modalContent'));
}
