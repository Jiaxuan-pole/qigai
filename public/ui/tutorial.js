// 新手引导：第 1 回合讲界面，第 1 回合结算后讲结果与晚上。遮罩挖洞高亮目标，卡片说一两句就走，随时可跳过。
// 纯逻辑（步骤表、阶段判断）与 DOM 分开，前者给 node 测试用。

const KEY = 'jwsn.tutorial';

export function prepareTutorialTarget(step) {
  const toggle = document.getElementById('planToggle');
  if (step.openDrawer && toggle?.getAttribute('aria-expanded') === 'false') toggle.click();
  if (step.closeDrawer && toggle?.getAttribute('aria-expanded') === 'true') toggle.click();
  return document.querySelector(step.sel);
}

export const STEPS = {
  1: [
    { sel: '.topstats', closeDrawer: true, title: '顶上这一排', text: '日、回合、时间、天气，右边是三个人共用的钱包和几份饭。饭按份算：每人一天两份，钱先留饭钱。' },
    { sel: '#characters .char-card', closeDrawer: true, title: '人物状态', text: '人物栏平时收起，点展开查看完整状态。健康、饱食、体力、精神各自独立，异常时先照顾身体。' },
    { sel: '#taskStrip', closeDrawer: true, title: '这段日子要奔向哪里', text: '长期生存目标每10天一阶段：先稳住吃住，再准备暴雨、早寒和寒潮。点任务进度，看还缺哪些准备、下一步去哪做；熟人委托、章节和人生出路继续跨天积累。' },
    { sel: '#planToggle', closeDrawer: true, title: '安排行动入口', text: '地图 M 旁点「安排行动」打开完整安排窗口。点下一步会帮你打开；关窗就回地图。' },
    { sel: '#drawer .ctx', openDrawer: true, title: '选择下一件事', text: '在窗口里给当前人物选行动和街区，体力不够就安排睡眠或补给。' },
    { sel: '#durationPick', openDrawer: true, title: '一件事可以做几个小时', text: '每种活动有建议时长，也能调整连续小时数。确认结束时间、精神变化、体力和费用后再安排；中途遇事会停下来处理。' },
    { sel: '#schedule', openDrawer: true, title: '三个人的下一件事', text: '每件事可以选择持续时间；所有人共用时钟，按小时获得收入和承受消耗。' },
    { sel: '#btnAdvance', openDrawer: true, title: '执行当前安排', text: '想直接看到这一小时的结果，也可以按开始行动。剩余安排会继续保留。' },
    { sel: '#mapWrap', closeDrawer: true, title: '走进街道', text: '方向键或街道方向按钮可以上下左右走，左右会改变朝向。切换人物保留各自位置；沿街能找到路人、告示、店铺和随机事件。' },
    { sel: '#mapWrap', closeDrawer: true, title: '点人物用随身物品', text: '点街上的人物打开快捷物品。抽烟、喝酒后会播放动作，次数按使用者单独计算。涂鸦与钓鱼要先带齐用具，再到对应地点安排行动。' },
    { sel: '#tSlot', closeDrawer: true, title: '街上的时间', text: '站着时，时间会自动流逝；事件与安排窗口会暂时停下时钟。' },
    { sel: '[data-open="events"]', closeDrawer: true, title: '热点与愿望', text: '街上会冒出热点，只持续有限时间。第 1 天清晨老街有个免费赠餐的教学热点，可以让人去领。人也会冒愿望，不理会积压扣精神。' },
  ],
  2: [
    { sel: '.journal', closeDrawer: true, title: '刚才发生了什么', text: '行动后弹出收入、消耗和事件；关掉后街头记事还能翻，点「全部」看完整日志。' },
    { sel: '#planStatus', openDrawer: true, title: '饭钱保护', text: '这一行是本小时预算：收入、支出、剩多少。饭钱先留出来（每人两份），不够饭钱的花销会被拦下。' },
    { sel: '#nightSpot', openDrawer: true, title: '晚间和过夜', text: '晚间也可给每人安排睡眠或爱好（讲段子、速写、无赌注纸牌）。今晚睡哪儿在这里选：营地床位、服务站、候车室，各有代价。' },
    { sel: '#mapWrap', closeDrawer: true, title: '走进街里', text: '街道可以上下左右走，路边有告示、物品与热点。走到路口可去相邻街区，每次花少量体力。' },
    { sel: '[data-open="help"]', closeDrawer: true, title: '随时能看', text: '顶上「说明」随时能看规则。引导就到这儿，剩下的自己摸。' },
  ],
};

export const CONTEXT_GUIDES = {
  combat: [{ sel: '.combat-actions', title: '先看对方的动作', text: '攻击削弱对方架势；防守减轻伤害、寻找反击空当；撤离尝试脱身。每次选择推进一个短回合，受伤会影响健康和精神。' }],
  company: [{ sel: '#characters', closeDrawer: true, title: '多一双手，也多一张嘴', text: '点人物卡换人。每个人有拿手活，新伙伴也要吃饭、要有地方睡。先看他的背包和熟练度，再安排今天。' }, { sel: '#schedule', openDrawer: true, title: '各做各的，一起过日子', text: '三人下一件事仍共用时钟。别让大家都出去挣钱，却没人给今晚备饭。' }],
  weather: [{ sel: '#nightSpot', openDrawer: true, title: '雨来的时候，先想晚上', text: '营地要有挡雨的棚和干床。没准备好时可选服务站或候车室过夜；别穿着湿衣一直硬扛。' }],
  health: [{ sel: '[data-open="health"]', openDrawer: true, title: '不舒服就先看清原因', text: '卫生低先去水点，病了去诊所做评估。药和绷带放在包里不会自己起效，要给当前行动安排护理。' }],
  wishes: [{ sel: '[data-open="wishes"]', openDrawer: true, title: '话里还有没说出口的事', text: '留意人物的小气泡。想画画、想聊聊和想休息都是愿望；留一点时间做喜欢的事，比一直硬熬有用。' }],
  fishing: [{ sel: '#mapWrap', closeDrawer: true, title: '带着鱼竿去河边', text: '把鱼竿和鱼饵带在要钓鱼的人身上，在河岸安排钓鱼。当前操控角色咬钩后完成收线 QTE，队友自动收线，判定区会随熟练度变宽；马哥熟手，其他人也能慢慢练。' }, { sel: '[data-open="inventory"]', openDrawer: true, title: '这条鱼怎么用', text: '生鱼不能直接吃，须回营地用一份木炭加工，或带去老街便利店换钱。马哥三连空钩会偶尔跳河，衣服湿了也不会白送鱼。' }],
  chapter2: [{ sel: '[data-open="events"]', closeDrawer: true, title: '街上的事，不会一直等着', text: '热点有剩余时间，也有地点和条件。点开先读清楚，赶得上再答应；有些事可以说不。' }, { sel: '#mapWrap', closeDrawer: true, title: '记住这些门面', text: '店要开门、人要到场，才能买东西。认识熟面孔后，聊天和帮忙可能带来新的活。' }],
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
