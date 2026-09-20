// 星露谷式全屏菜单：一个按钮（或 E 键）在排程浮层、地图总览与各弹层 tab 之间切换，并记住上次打开的 tab。
import { $, UI, closeModal, modalOpen, toast } from './core.js';
import { setDrawerExpanded } from './render.js';
import { setMapMode } from './map.js';

let handlers = {};
let lastTab = 'plan';

const plannerOpen = () => Boolean($('plannerOverlay')) && !$('plannerOverlay').hidden;

// 两处 nav（弹层顶部与 planner 头部）共用同一批按钮标记，所以按 data 属性统一刷选中态。
function markTabs(tab) {
  document.querySelectorAll?.('[data-menu-tab]').forEach((button) => button.setAttribute('aria-selected', String(button.dataset.menuTab === tab)));
}

export function openMenu(tab) {
  // 锁定弹层（工作挑战等）不能被菜单顶掉，否则点 tab 就能绕过放弃结算。
  if (UI.modalLock) return;
  // 原 data-open 按钮在夜里拦住地图与营地，改为 tab 后保留同一规则，避免夜间探索被切回总览。
  if (UI.night && ['map', 'camp'].includes(tab)) return toast('今晚留在营地，物件就在街景里。');
  lastTab = tab;
  // 在弹层内切 tab 时保留最初的触发元素，关闭后焦点回到菜单按钮而不是已隐藏的 tab。
  const returnFocus = modalOpen() ? UI.lastFocus : null;
  setDrawerExpanded(false);
  if (tab === 'plan') { closeModal(); setDrawerExpanded(true); }
  else if (tab === 'map') { closeModal(); setMapMode('overview'); toast('按 M 或点「街道」回到街景'); }
  else {
    handlers[tab]?.();
    if (modalOpen()) {
      if (returnFocus) UI.lastFocus = returnFocus;
      $('modalTabs')?.removeAttribute('hidden');
      // showModal 取初始焦点时 tab 栏还是 hidden，聚不上任何按钮，这里把焦点补到当前 tab。
      $('modalTabs')?.querySelector?.(`[data-menu-tab="${tab}"]`)?.focus?.();
    }
  }
  markTabs(tab);
}

function toggleMenu() {
  if (modalOpen() || plannerOpen()) { closeModal(); setDrawerExpanded(false); return; }
  openMenu(lastTab);
}

// 与 app.js 现有快捷键同一套守卫：输入控件聚焦、标题页、教程或过场期间不抢按键。
function blocked() {
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
    || Boolean($('game')?.classList.contains('hidden'))
    || Boolean(document.querySelector?.('.tut-root, .intro, .fishing-qte-overlay'));
}

export function initMenu(menuHandlers) {
  handlers = menuHandlers;
  const button = $('btnMenu');
  if (button) button.onclick = toggleMenu;
  document.addEventListener('click', (event) => {
    const tab = event.target?.closest?.('[data-menu-tab]')?.dataset.menuTab;
    if (tab) openMenu(tab);
  });
  document.addEventListener('keydown', (event) => {
    if ((event.key !== 'e' && event.key !== 'E') || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || blocked()) return;
    event.preventDefault();
    toggleMenu();
  });
}
