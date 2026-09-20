// 新手导览：第 1 回合用六步认一遍 HUD，第 1 回合结算后三步讲记事、菜单与热点；按天做事的引导链在 guide.js/tasks.js。
// 遮罩挖洞高亮目标，卡片说一两句就走，随时可跳过。纯逻辑（步骤表、阶段判断）与 DOM 分开，前者给 node 测试用。

const KEY = 'jwsn.tutorial';

export function prepareTutorialTarget(step) {
  const toggle = document.getElementById('planToggle');
  if (step.openDrawer && toggle?.getAttribute('aria-expanded') === 'false') toggle.click();
  if (step.closeDrawer && toggle?.getAttribute('aria-expanded') === 'true') toggle.click();
  return document.querySelector(step.sel);
}

export const STEPS = {
  1: [
    { sel: '.topstats', closeDrawer: true, title: '顶上这一排', text: '日、时间、天气，右边是三个人共用的现金和有效食物。饭钱先留出来。' },
    { sel: '#characters', closeDrawer: true, title: '三张人物卡', text: '点卡换人操控，点箭头展开完整状态。谁不舒服先照顾谁。' },
    { sel: '.stage-view', closeDrawer: true, title: '街景', text: '点街上的热点：垃圾桶、瓶罐、水点、早餐摊，立刻就做这件事。走到路口自动到下一条街。' },
    { sel: '#taskStrip', closeDrawer: true, title: '跟着引导走', text: '前三天左上角有一步一步的引导，按钮直接执行。之后是每10天一阶段的长期目标。' },
    { sel: '#hotbar', closeDrawer: true, title: '快捷物品', text: '随身物品一格一种，点一下就用；抽烟、喝酒会播放动作。' },
    { sel: '.hud-actions', closeDrawer: true, title: '底部四个按钮', text: '安排行动排整天，开始行动结算这一小时，AI安排队友全天，结束今天让剩下的小时自动过。' },
  ],
  2: [
    { sel: '.journal', closeDrawer: true, title: '刚才发生了什么', text: '行动后这里记收入、消耗和事件，点「全部」看完整日志。' },
    { sel: '#btnMenu', closeDrawer: true, title: '菜单 E', text: '库存、愿望、健康、任务、章节、存档、说明都在这，按 E 也能开。' },
    { sel: '[data-open="events"]', closeDrawer: true, title: '热点', text: '街上的机会限时几回合，点开看清条件再决定；有些可以说不。' },
  ],
};

export const CONTEXT_GUIDES = {
  combat: [{ sel: '.combat-actions', title: '先看对方的动作', text: '攻击削弱对方架势；防守减轻伤害、寻找反击空当；撤离尝试脱身。每次选择推进一个短回合，受伤会影响健康和精神。' }],
  company: [{ sel: '#characters', closeDrawer: true, title: '多一双手，也多一张嘴', text: '点人物卡换人。每个人有拿手活，新伙伴也要吃饭、要有地方睡。先看他的背包和熟练度，再安排今天。' }, { sel: '.hud-actions', closeDrawer: true, title: '各做各的，一起过日子', text: '三人共用时钟：「安排行动」排整天，「AI安排队友全天」让其他人自己动。别让大家都出去挣钱，却没人给今晚备饭。' }],
  weather: [{ sel: '#taskStrip', closeDrawer: true, title: '雨来的时候，先想晚上', text: '营地要有挡雨的棚和干床，长期目标里能看到防雨进度。没准备好时夜里选服务站或候车室过夜；别穿着湿衣一直硬扛。' }],
  health: [{ sel: '#characters', closeDrawer: true, title: '不舒服就先看清原因', text: '人物卡上会标出异常。卫生低先去水点，病了去诊所做评估；药和绷带放在包里不会自己起效，要在菜单「健康护理」里安排。' }],
  wishes: [{ sel: '#characters', closeDrawer: true, title: '话里还有没说出口的事', text: '留意人物卡上的小气泡。想画画、想聊聊和想休息都是愿望；留一点时间做喜欢的事，比一直硬熬有用。' }],
  fishing: [{ sel: '.stage-view', closeDrawer: true, title: '带着鱼竿去河边', text: '把鱼竿和鱼饵带在要钓鱼的人身上，在河岸安排钓鱼。当前操控角色咬钩后完成收线 QTE，队友自动收线，判定区会随熟练度变宽；马哥熟手，其他人也能慢慢练。' }, { sel: '#hotbar', closeDrawer: true, title: '这条鱼怎么用', text: '生鱼不能直接吃，须回营地用一份木炭加工，或带去老街便利店换钱。马哥三连空钩会偶尔跳河，衣服湿了也不会白送鱼。' }],
  chapter2: [{ sel: '[data-open="events"]', closeDrawer: true, title: '街上的事，不会一直等着', text: '热点有剩余时间，也有地点和条件。点开先读清楚，赶得上再答应；有些事可以说不。' }, { sel: '.stage-view', closeDrawer: true, title: '记住这些门面', text: '店要开门、人要到场，才能买东西。认识熟面孔后，聊天和帮忙可能带来新的活。' }],
};

export function stepsFor(stage) {
  return STEPS[stage] || CONTEXT_GUIDES[stage] || [];
}

// seen: localStorage 里的记录，'1' 表示看过第一组，'done' 表示全看过或跳过。
export function stageOf(state, seen, seenGuides = []) {
  if (!state || state.phase !== 'planning') return null;
  if (seen !== 'done') {
    if (state.turn === 0 && state.day === 1 && seen !== '1') return 1;
    if (state.turn === 1) return 2;
  }
  if (state.day > 20 || state.turn < 2) return null;
  const offered = [
    ['company', state.metMa && state.day <= 10],
    ['chapter2', state.day >= 11],
    ['weather', ['rain', 'storm', 'cold'].includes(state.weatherKind)],
    ['health', Object.values(state.actors || {}).some((p) => p.life === 'active' && (p.hygiene < 35 || p.diseases?.length))],
    ['fishing', state.items?.some((it) => it.itemId.startsWith('fishing_rod'))],
    ['wishes', state.day >= 6 && state.wishes?.some((w) => w.status === 'active')],
  ];
  return offered.find(([id, needed]) => needed && !seenGuides.includes(id))?.[0] || null;
}
function readGuides(seed) { try { const value = JSON.parse(localStorage.getItem('jwsn.guides.' + seed) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } }
function rememberGuide(seed, id) { try { localStorage.setItem('jwsn.guides.' + seed, JSON.stringify([...new Set([...readGuides(seed), id])])); } catch {} }

function readSeen() { try { return localStorage.getItem(KEY); } catch { return null; } }
function writeSeen(v) { try { localStorage.setItem(KEY, v); } catch { /* 隐私模式下没有存储也不影响游戏 */ } }

let running = null, waiting = null;

function modalIsOpen() {
  const ov = document.getElementById('modalOverlay');
  return Boolean(ov && ov.classList.contains('open'));
}

function run(steps, onDone, options = {}) {
  if (running) running.stop();
  const root = document.createElement('div');
  root.className = 'tut-root';
  root.innerHTML = '<div class="tut-hole"></div><div class="tut-card"><h4></h4><p></p><div class="tut-foot"><div class="tut-dots"></div><button class="linkbtn tut-skip">跳过引导</button><button class="primary tut-next">下一步</button></div></div>';
  document.body.appendChild(root);
  const hole = root.querySelector('.tut-hole'), card = root.querySelector('.tut-card');
  let i = -1, timer = 0, stopped = false;
  const drawerInitiallyOpen = document.getElementById('planToggle')?.getAttribute('aria-expanded') === 'true';

  const place = () => {
    const step = steps[i];
    const el = step && document.querySelector(step.sel);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    hole.style.top = (r.top - 6) + 'px'; hole.style.left = (r.left - 6) + 'px'; hole.style.width = (r.width + 12) + 'px'; hole.style.height = (r.height + 12) + 'px';
    if (window.innerWidth <= 700) { card.classList.add('bottom'); card.style.top = ''; card.style.left = ''; return true; }
    card.classList.remove('bottom');
    const cw = card.offsetWidth, ch = card.offsetHeight;
    let top = r.bottom + 12;
    if (top + ch > window.innerHeight - 8) top = Math.max(8, r.top - ch - 12);
    card.style.top = top + 'px';
    card.style.left = Math.min(Math.max(16, r.left), window.innerWidth - cw - 16) + 'px';
    return true;
  };
  const show = (n) => {
    i = n;
    if (i >= steps.length) return stop(true);
    const step = steps[i];
    const el = prepareTutorialTarget(step);
    if (!el) return show(i + 1);
    const r = el.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ block: step.openDrawer ? 'nearest' : 'center' });
    card.querySelector('h4').textContent = step.title;
    card.querySelector('p').textContent = step.text;
    card.querySelector('.tut-dots').innerHTML = steps.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('');
    card.querySelector('.tut-next').textContent = i === steps.length - 1 ? '知道了' : '下一步';
    requestAnimationFrame(place);
  };
  const stop = (finished) => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    window.removeEventListener('resize', place);
    window.removeEventListener('scroll', place, true);
    document.removeEventListener('keydown', onKey, true);
    root.remove();
    running = null;
    const toggle = document.getElementById('planToggle');
    if (toggle && (toggle.getAttribute('aria-expanded') === 'true') !== drawerInitiallyOpen) toggle.click();
    onDone(finished);
  };
  const onKey = (e) => {
    if (modalIsOpen() && !options.allowModal) return;
    if (e.code === 'Space') { e.preventDefault(); e.stopPropagation(); return; }
    if (e.key === 'Escape') { e.stopPropagation(); stop(false); }
    else if (e.key === 'Enter' || e.key === 'ArrowRight') { e.stopPropagation(); e.preventDefault(); show(i + 1); }
  };
  card.querySelector('.tut-next').onclick = () => show(i + 1);
  card.querySelector('.tut-skip').onclick = () => stop(false);
  window.addEventListener('resize', place);
  window.addEventListener('scroll', place, true);
  document.addEventListener('keydown', onKey, true);
  // 弹层开着时先让路，关了再回来；位置每 250ms 校一次，够用了。
  timer = setInterval(() => { const hidden = modalIsOpen() && !options.allowModal; root.style.display = hidden ? 'none' : ''; if (!hidden) place(); }, 250);
  running = { stop };
  show(0);
}

export function maybeStartCombatTutorial(state) {
  if (typeof document === 'undefined' || readGuides(state.seed).includes('combat')) return;
  run(stepsFor('combat'), () => rememberGuide(state.seed, 'combat'), { allowModal: true });
}

function whenClear(fn) {
  clearInterval(waiting);
  waiting = setInterval(() => {
    if (document.getElementById('game')?.classList.contains('hidden')) { clearInterval(waiting); waiting = null; return; }
    if (!modalIsOpen()) { clearInterval(waiting); waiting = null; fn(); }
  }, 200);
}

export function maybeStartTutorial(state) {
  if (typeof document === 'undefined') return;
  if (window.jwsn && !window.jwsn.tutorial) window.jwsn.tutorial = { restart: restartTutorial };
  const stage = stageOf(state, readSeen(), readGuides(state.seed));
  if (!stage || running) return;
  whenClear(() => {
    const latest = window.jwsn?.state || state;
    if (latest.seed !== state.seed || stageOf(latest, readSeen(), readGuides(latest.seed)) !== stage) return;
    run(stepsFor(stage), (finished) => {
      if (typeof stage === 'string') rememberGuide(latest.seed, stage);
      else writeSeen(stage === 2 || !finished ? 'done' : '1');
    });
  });
}

// 从「玩法说明」或控制台重看：两组一起走完，不管现在第几回合。
export function restartTutorial() {
  if (typeof document === 'undefined') return;
  whenClear(() => run([...stepsFor(1), ...stepsFor(2), ...Object.values(CONTEXT_GUIDES).flat()], () => writeSeen('done')));
}
