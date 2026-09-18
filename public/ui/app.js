// 总控：加载、标题页、开场动画、事件绑定、推进流程（结算→行走动画→到店→结果→夜结算→夜话→晨报）。
import { $, esc, UI, toast, showModal, closeModal, modalOpen, apply, save, loadSave, clearSave } from './core.js';
import { loadData } from '../game/data.js';
import { travelTo, fresh, assign, IDS, NAMES, alive, active, sellBottles, setNightSpot, nightSpotOptions, careOptions, setCare, shopClosedReason, autoResolvePending } from '../game/engine.js';
import { settle } from '../game/settle.js';
import { validateSave } from '../game/save.js';
import { ACTIONS } from '../game/actions.js';
import { plannerToggleOwnsSpace, renderAll, setDrawerExpanded, zoneName } from './render.js';
import { initMap, animateMoves, showWalkNote, viewStreet } from './map.js';
import { showShop, showTicket, showInventory, showWishes, showHealth, showEvents, showEvent, showNpcs, showMapList, showChapters, showHelp, showBegSession, showBinBoard, showCamp } from './modals.js';
import { showMeeting, showMorning, showResults, showNight, showScreening, eveningTalk, showEnding } from './flow.js';
import { playIntro } from './intro.js';
import { offerCardNight } from './cardtable.js';
import { fetchAiStatus, setAiEnabled } from './ai.js';
import { initAudio, audioScene } from './audio.js';
import { maybeStartTutorial } from './tutorial.js';
import { runCampNight } from './night-flow.js';
import { readNightCheckpoint, clearNightCheckpoint } from './night-state.js';
import { triggerCampNightActivity } from './camp-night.js';
import { prepareNamedGame, importNamedState, openSavedGames } from './save-flow.js';
import { getActiveSharedSave, onSharedSaveStatus } from './saves-client.js';
import { autoArrangeTeammates } from './autoplan.js';
import { queueItemWishes, cancelItemWishes } from './wish-flow.js';
import { DAY_END_HOUR, planIndex } from '../game/clock.js';
import { showCooking } from './cooking-modal.js';
import { showFurniture } from './furniture-modal.js';
import { resolvePendingFishing } from './fishing-flow.js';
import { resumeCasino } from './casino.js';
import { bindPlannerWindow } from './planner-window.js';
import { pendingWorkGame, showPendingWorkGame, forfeitPendingWorkGames } from './work-game-flow.js';
import { startLiveClock, encounteredEvent } from './live-clock.js';
import { showCombat } from './combat.js';
import { showQuickItems } from './quick-items.js';
import { configureTasks, renderTaskStrip, showTasks } from './tasks.js';

let busy = false;
let planningRequest = null;
let liveClock = null;

function phaseDialog() {
  if (UI.night) return;
  const s = UI.state;
  if (s.pending?.combat) { void showCombat(); return; }
  if (pendingWorkGame()) { showPendingWorkGame(); return; }
  if (s.pending?.fishingQte?.length || s.pending?.riverFight) { void resolvePendingFishing().then(phaseDialog); return; }
  if (s.pending?.casino && s.pending.casino.phase !== 'settled') { resumeCasino(); return; }
  if (s.phase === 'meeting') showMeeting();
  else if (s.phase === 'ending' || s.phase === 'gameover') showEnding();
  else if (s.phase === 'planning' && s.pendingMorning) showMorning();
}

function render() {
  if (!UI.state) return;
  const pane = $('plannerWindowBody');
  const scrollTop = pane?.scrollTop;
  const focused = document.activeElement;
  const focusHour = focused?.dataset?.hour;
  const focusActor = focused?.dataset?.actor;
  const focusAction = focused?.dataset?.action;
  renderAll();
  renderTaskStrip();
  bindGame();
  if (pane && !$('plannerOverlay').hidden) {
    pane.scrollTop = scrollTop;
    const target = focusHour && focusActor ? [...document.querySelectorAll('[data-hour]')].find((el) => el.dataset.hour === focusHour && el.dataset.actor === focusActor) : focusAction ? [...document.querySelectorAll('[data-action]')].find((el) => el.dataset.action === focusAction) : null;
    target?.focus?.({ preventScroll: true });
  }
  queueItemWishes(() => !busy && !planningRequest);
}

function bindGame() {
  document.querySelectorAll('[data-actor].char-card').forEach((el) => { el.onclick = () => selectActor(el.dataset.actor); el.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectActor(el.dataset.actor); } }; });
  document.querySelectorAll('[data-hour]').forEach((b) => { b.onclick = () => chooseHour(b.dataset.actor, Number(b.dataset.hour), true); });
  document.querySelectorAll('[data-action]').forEach((b) => { b.onclick = () => { UI.sel.action = b.dataset.action; UI.sel.duration = undefined; render(); }; });
  const durationPick = $('durationPick'); if (durationPick) durationPick.onchange = () => { UI.sel.duration = Number(durationPick.value); render(); };
  const zonePick = $('zonePick'); if (zonePick) zonePick.onchange = () => { UI.sel.zone = zonePick.value; UI.sel.targets = []; render(); };
  const clearZone = $('clearZone'); if (clearZone) clearZone.onclick = () => { UI.sel.zone = null; render(); };
  document.querySelectorAll('[data-npc]').forEach((cb) => { cb.onchange = () => { const set = new Set(UI.sel.targets); if (cb.checked) set.add(cb.dataset.npc); else set.delete(cb.dataset.npc); UI.sel.targets = [...set].slice(0, 3); if (UI.sel.targets.length >= 3) render(); }; });
  document.querySelectorAll('[data-openshop]').forEach((b) => { b.onclick = () => { const zone = b.dataset.openshop; const shop = UI.data.shops.find((sh) => sh.district === zone && UI.state.day >= sh.unlockDay); if (shop) showShop(shop.id, UI.sel.actor, 'plan'); }; });
  const carePick = $('carePick'); if (carePick) carePick.onchange = () => { const opts = careOptions(UI.state, UI.sel.actor, UI.sel.hour); const choice = carePick.value === '' ? null : opts[Number(carePick.value)]; apply(setCare(UI.state, UI.sel.actor, UI.sel.hour, choice)); };
  const sleepBtn = document.querySelector('[data-sleep-hour]'); if (sleepBtn) sleepBtn.onclick = () => { UI.sel.hour = Number(sleepBtn.dataset.sleepHour); UI.sel.action = 'sleep'; UI.sel.duration = 1; UI.sel.zone = null; UI.sel.cart = []; UI.sel.targets = []; assignNow(); };
  const coffeeBtn = document.querySelector('[data-view-coffee]'); if (coffeeBtn) coffeeBtn.onclick = () => showInventory(UI.sel.actor);
  const assignBtn = $('assignBtn'); if (assignBtn) assignBtn.onclick = () => assignNow();
}

function selectActor(id) {
  if (busy || UI.state.pending?.combat) return;
  const alreadySelected = UI.sel.actor === id;
  chooseHour(id, UI.state.hour);
  if (alreadySelected && !modalOpen()) showQuickItems(id, showInventory, () => { setDrawerExpanded(true); render(); });
}

function chooseHour(id, _hour, openPlanner = false) {
  planningRequest?.abort();
  let s = UI.state;
  const changedActor = UI.sel.actor !== id;
  if (s.actors[id].life === 'unrecruited') { toast('这里还没有人。去街上走走吧。'); return; }
  if (changedActor && pendingWorkGame() && !forfeitPendingWorkGames()) return;
  if (changedActor && !s.pending?.casino && !s.pending?.cards && !s.pending?.riverFight &&
      (s.pending?.beg?.length || s.pending?.bins?.length || s.pending?.fishingQte?.length)) {
    if (!apply(autoResolvePending(s), { noRender: true })) return;
    s = UI.state;
  }
  UI.sel.actor = id;
  UI.sel.hour = s.hour;
  const index = s.phase === 'tail' ? s.hour - DAY_END_HOUR : s.hour < DAY_END_HOUR ? planIndex(s.hour) : null;
  const t = index === null ? null : s.plan[id][index];
  UI.sel.duration = undefined;
  UI.sel.action = t?.id || UI.sel.action;
  if (t && t.zone && ACTIONS[t.id].zone === 'pick') UI.sel.zone = t.zone;
  UI.sel.cart = t?.cart || [];
  UI.sel.targets = t?.targets || [];
  if (openPlanner) setDrawerExpanded(true);
  render();
  if (changedActor) window.jwsnAudio?.speak?.(id, $('quote').textContent);
}

function assignNow(skipRisk = false) {
  if (UI.night) return toast('今晚先歇歇，睡醒再排明天。');
  const s = UI.state;
  const a = ACTIONS[UI.sel.action];
  if (!a) return;
  const opts = { zone: UI.sel.zone, cart: UI.sel.cart, targets: UI.sel.targets, destination: UI.sel.destination, duration: UI.sel.duration || 1 };
  if (a.rescue) { opts.target = $('partner')?.value; opts.participants = [UI.sel.actor, opts.target]; }
  else if (a.min === 2) opts.participants = [UI.sel.actor, $('partner')?.value];
  else if (a.min === 3) opts.participants = [...IDS];
  if (a.zone === 'pick' && !opts.zone) opts.zone = $('zonePick')?.value;
  if (a.begging) opts.style = $('begStyle')?.value || 'ask';
  if (a.risky && !skipRisk) {
    showModal('这项劳动可能让角色濒死', `<p>${NAMES[UI.sel.actor]}当前健康${s.actors[UI.sel.actor].health}。本行动有明示的16—32事故伤害并留下伤口，马哥减免25%，另叠加饥寒伤害。请留出施救的人和钱。</p><div class="modalbuttons"><button id="confirmRisk" class="primary">仍然安排危险劳动</button><button id="cancelRisk">返回</button></div>`);
    $('confirmRisk').onclick = () => { closeModal(); assignNow(true); };
    $('cancelRisk').onclick = () => closeModal();
    return;
  }
  const r = assign(s, UI.sel.actor, UI.sel.hour, UI.sel.action, opts);
  if (apply(r)) { setDrawerExpanded(false); toast(`已安排：${NAMES[UI.sel.actor]}「${a.name}」连续${opts.duration}小时，至${String(UI.sel.hour + opts.duration).padStart(2, '0')}:00。`); }
}

async function advance(force = false, automatic = false) {
  cancelItemWishes();
  planningRequest?.abort();
  if (UI.night) { toast('先结束这一晚，再安排明天。'); return false; }
  if (busy) return false;
  const s = UI.state;
  if (s.pending?.combat) { void showCombat(); return false; }
  if (s.phase !== 'planning' && s.phase !== 'tail') { phaseDialog(); return false; }
  if (pendingWorkGame()) { showPendingWorkGame(); return false; }
  if (s.pending?.fishingQte?.length || s.pending?.riverFight) { await resolvePendingFishing(); phaseDialog(); return false; }
  if (s.pending?.casino && s.pending.casino.phase !== 'settled') { resumeCasino(); return false; }
  if (s.pending && s.pending.beg.length) { showBegSession(0); return false; }
  if (s.pending && s.pending.bins.length) { showBinBoard(0); return false; }
  const currentIndex = s.phase === 'tail' ? s.hour - DAY_END_HOUR : planIndex(s.hour);
  const survivalTick = s.phase === 'tail' || [9, 13, 17, 21].includes(s.hour);
  const doomed = survivalTick ? alive(s).filter((id) => { const p = s.actors[id], t = s.plan[id][currentIndex]; return p.life === 'downed' && p.deadline <= s.turn + 1 && !['aid', 'rescue'].includes(t?.id) && !IDS.some((x) => s.plan[x][currentIndex]?.id === 'rescue' && s.plan[x][currentIndex]?.target === id); }) : [];
  if (doomed.length && !force) {
    showModal('继续后，将有人死亡', `<p>${doomed.map((x) => NAMES[x]).join('、')}处在最后一个救援回合，却没有得到救援安排。继续结算会造成永久死亡。</p><div class="modalbuttons"><button id="backRescue" class="primary">回去安排救援</button><button id="confirmDeath">确认仍然推进</button></div>`);
    $('backRescue').onclick = () => { closeModal(); liveClock?.restart(); };
    $('confirmDeath').onclick = () => { closeModal(); void advance(true).then((advanced) => { if (advanced) liveClock?.restart(); }); };
    return false;
  }
  const settledHour = s.hour, settledDay = s.day;
  const controlledActorId = UI.sel.actor;
  const result = settle(s, { controlledActorId });
  if (result.error) { liveClock?.pause(); toast(result.error + (result.error.includes('体力不足') ? ' 睡1小时恢复20；便利店速溶4杯或咖啡店现制2杯补20（混饮累计）。' : '')); if (result.at) { UI.errAt = result.at; UI.sel.actor = result.at.actorId; UI.sel.hour = result.at.hour; } render(); return false; }
  setDrawerExpanded(false);
  busy = true;
  UI.state = result.state; save();
  audioScene(UI.state, result);
  UI.errAt = null;
  UI.sel.hour = UI.state.hour;
  UI.sel.cart = []; UI.sel.targets = []; UI.sel.zone = null;
  if (!alive(UI.state).includes(UI.sel.actor)) UI.sel.actor = alive(UI.state)[0] || UI.sel.actor;
  renderAll();
  // 人物自己走过去
  if (result.moves.length) showWalkNote(`${String(settledHour).padStart(2, '0')}:00：` + result.moves.map((m) => NAMES[m.actorId] + '→' + zoneName(m.to)).join('，'));
  // settle 已前进时段甚至换日，动作仍须读取结算前的任务。
  const executed = Object.fromEntries(IDS.map((id) => [id, s.plan[id][currentIndex]]));
  await animateMoves(UI.state, result.moves, executed);
  const cookedUid = executed[UI.sel.actor]?.id === 'cook' ? executed[UI.sel.actor].targets?.[0] : null;
  if (cookedUid && s.items.find((item) => item.uid === cookedUid)?.itemId !== UI.state.items.find((item) => item.uid === cookedUid)?.itemId) {
    globalThis.window?.jwsnAudio?.play?.('cook_sizzle', { scope: 'cooking' });
  }
  showWalkNote(null);
  render();
  busy = false;
  // 到店的人：当场买
  for (const ar of result.arrivals) {
    if (ar.kind && ar.kind !== 'shop') continue;
    if (UI.state.actors[ar.actorId].life !== 'active') continue;
    const shop = UI.data.shops.find((sh) => sh.district === ar.zone && !shopClosedReason(UI.state, sh.id, ar.slot) && UI.state.day >= sh.unlockDay);
    if (shop) { await new Promise((res) => { showShop(shop.id, ar.actorId, 'now', ar.slot); const t = setInterval(() => { if (!modalOpen()) { clearInterval(t); res(); } }, 150); }); }
  }
  bindGame();
  await openPending();
  if (UI.state.phase === 'meeting') { showMeeting(); return true; }
  if (UI.state.phase === 'ending' || UI.state.phase === 'gameover') { showEnding(); return true; }
  if (result.night) {
    showNight(result.night, result.events);
    audioScene(UI.state, result, 'night');
    await waitModal();
    if (result.night.spot === 'camp' && UI.state.phase === 'planning') {
      await runCampNight(result.night);
    } else {
      if (result.night.screening) { showScreening(result.night.screening); await waitModal(); }
      await offerCardNight();
      if (UI.state.phase === 'planning') { await eveningTalk(); await waitModal(); }
    }
  } else {
    const shown = !automatic && showResults(result.events, `第${settledDay}天${settledHour}:00 · 小时${UI.state.hourTick}`);
    if (shown) await waitModal(); else toast('回合' + UI.state.turn + '已共同结算。' + (result.events[0] || ''));
    const encounter = automatic && encounteredEvent(s, UI.state, controlledActorId);
    if (encounter && UI.state.phase === 'planning') { showEvent(encounter.uid); await waitModal(); }
  }
  maybeStartTutorial(UI.state);
  if (UI.state.phase === 'tail') { toast('救援尾声：只处理救援。'); }
  phaseDialog();
  render();
  return true;
}

// 待处理交互（路人对话等）：逐个弹出，处理完才继续。
async function openPending() {
  if (UI.state.pending?.combat) await showCombat();
  while (pendingWorkGame()) {
    showPendingWorkGame();
    await waitModal();
    if (pendingWorkGame() && !modalOpen()) break;
  }
  await resolvePendingFishing();
  if (UI.state.pending?.casino && UI.state.pending.casino.phase !== 'settled') { resumeCasino(); await waitModal(); }
  while (UI.state.pending && (UI.state.pending.beg.length || UI.state.pending.bins.length)) {
    const before = UI.state.pending.beg.length + UI.state.pending.bins.length;
    if (UI.state.pending.beg.length) showBegSession(0); else showBinBoard(0);
    await waitModal();
    if (UI.state.pending.beg.length + UI.state.pending.bins.length >= before && !modalOpen()) break;
  }
}

function waitModal() {
  return new Promise((res) => { const t = setInterval(() => { if (!modalOpen()) { clearInterval(t); res(); } }, 120); });
}

function showSystem() {
  const s = UI.state;
  showModal('存档与设置', `<p>当前进度${getActiveSharedSave()?.name ? '「' + esc(getActiveSharedSave().name) + '」自动保存到局域网服务' : '保留在本机，可在存档表中起名上传'}；本机备份${UI.storageOK ? '可用' : '不可用，请导出'}。不同设备可从存档表继续同一份进度。</p><div class="kv"><b>种子</b><span>${s.seed}</span><b>回合</b><span>${s.turn}/400 · D${s.day} ${s.hour}:00</span><b>AI 台词</b><span>${UI.ai.available ? '<label><input type="checkbox" id="aiToggle" ' + (UI.ai.enabled ? 'checked' : '') + '> 开启（' + esc(UI.ai.model) + '，服务端调用，失败自动回退模板）</label>' : '服务端未配置密钥，使用本地模板'}</span></div><div class="modalbuttons"><button id="sysExport">导出存档</button><button id="sysImport">导入存档</button><button id="sysReset" class="danger">重新开始</button><button id="sysTitle">回到标题</button></div>`);
  const t = $('aiToggle'); if (t) t.onchange = () => setAiEnabled(t.checked);
  $('sysExport').onclick = exportSave;
  $('sysImport').onclick = importSave;
  $('sysReset').onclick = () => { showModal('重新开始？', `<p>将创建另一份有名字的新存档，已有共享存档会保留。</p><div class="modalbuttons"><button id="r1">先导出</button><button id="r2" class="primary">确认从第1天开始</button><button id="r3">取消</button></div>`); $('r1').onclick = exportSave; $('r2').onclick = () => { closeModal(true); newGame(true); }; $('r3').onclick = () => closeModal(); };
  $('sysTitle').onclick = () => { closeModal(); goTitle(); };
}

function exportSave() {
  const blob = new Blob([JSON.stringify(UI.state, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = `今晚睡哪儿_D${UI.state.day}_存档.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast('已导出当前进度。');
}

function importSave() {
  if (UI.night) return toast('先结束这一晚，再导入另一份进度。');
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json,application/json';
  input.onchange = async () => {
    try {
      const file = input.files[0];
      if (!file || file.size > 2000000) throw Error('未选择文件或文件过大');
      const s = JSON.parse(await file.text());
      const v = validateSave(s);
      if (!v.ok) throw Error(v.reason);
      closeModal(true);
      if (await importNamedState(s)) { UI.sel.actor = alive(UI.state)[0] || 'xuan'; UI.sel.hour = UI.state.hour; enterGame(); toast('存档已命名导入。'); }
    } catch (e) { toast('无法导入：' + e.message); }
  };
  input.click();
}

function goTitle() {
  if (UI.night) { toast('先结束这一晚，或直接关闭页面，下次可以继续。'); return; }
  $('game').classList.add('hidden');
  setDrawerExpanded(false);
  $('title').classList.remove('hidden');
  renderTitle();
}

function renderTitle() {
  const saved = loadSave();
  const ok = saved && !saved.invalid;
  $('btnContinue').disabled = false;
  $('btnContinue').textContent = '存档表 / 继续';
  $('titleSaveInfo').textContent = ok ? `上次：第${saved.day}天 ${saved.hour}:00 · 现金${saved.cash} · ${alive(saved).length}人在世` : saved?.invalid ? '本地存档无法读取：' + saved.invalid : '没有本地存档';
  $('titleAi').textContent = UI.ai.available ? 'AI 台词：可用（' + UI.ai.model + '）' : 'AI 台词：未配置，使用本地模板';
}

function enterGame() {
  $('title').classList.add('hidden');
  $('game').classList.remove('hidden');
  UI.sel.hour = UI.state.hour;
  const pendingController = pendingWorkGame()?.controllerId || UI.state.pending?.beg?.[0]?.actorId || UI.state.pending?.bins?.[0]?.actorId || UI.state.pending?.fishingQte?.[0]?.actorId;
  if (pendingController && UI.state.actors[pendingController]?.life === 'active') UI.sel.actor = pendingController;
  if (!alive(UI.state).includes(UI.sel.actor)) UI.sel.actor = alive(UI.state)[0] || 'xuan';
  viewStreet(UI.state.actors[UI.sel.actor].location);
  render();
  const night = readNightCheckpoint(UI.state);
  if (night) { void runCampNight(night).then(() => { phaseDialog(); maybeStartTutorial(UI.state); }); return; }
  if (pendingWorkGame() || UI.state.pending?.beg?.length || UI.state.pending?.bins?.length || UI.state.pending?.fishingQte?.length || UI.state.pending?.riverFight) {
    void openPending().then(() => { phaseDialog(); maybeStartTutorial(UI.state); });
    return;
  }
  phaseDialog();
  maybeStartTutorial(UI.state);
}

async function newGame(skipIntro = false) {
  if (UI.night) return toast('先结束这一晚，再新开另一局。');
  planningRequest?.abort();
  const state = await prepareNamedGame();
  if (!state) return;
  const start = () => { UI.state = state; setDrawerExpanded(false); save(); enterGame(); };
  if (skipIntro) start(); else playIntro(start);
}

async function arrangeTeammates() {
  cancelItemWishes();
  if (busy || UI.night || modalOpen()) return;
  planningRequest?.abort();
  const ctrl = new AbortController(); planningRequest = ctrl;
  const state = UI.state, selected = UI.sel.actor;
  const button = $('btnAiPlan'); button.disabled = true; button.textContent = '正在安排队友…';
  try {
    const result = await autoArrangeTeammates(state, selected, { signal: ctrl.signal, stillCurrent: () => !ctrl.signal.aborted && UI.state === state && UI.state.seed === state.seed && UI.state.hour === state.hour && UI.state.hourTick === state.hourTick && UI.state.turn === state.turn && UI.state.stateRevision === state.stateRevision && UI.sel.actor === selected && !UI.night });
    if (ctrl.signal.aborted) return;
    if (result.error) return toast(result.error);
    if (apply(result)) toast((result.source === 'local' ? 'AI暂不可用，使用本地建议。' : 'AI已安排队友。') + result.summary);
  } catch (error) { if (!ctrl.signal.aborted) toast('这次没安排上：' + error.message); }
  finally { if (planningRequest === ctrl) { planningRequest = null; button.disabled = false; button.textContent = 'AI安排队友本次'; } }
}

async function boot() {
  UI.data = await loadData();
  await fetchAiStatus();
  UI.render = render;
  configureTasks({
    onPlan: ({ actorId, actionId, zone }) => {
      chooseHour(actorId, UI.state.hour);
      UI.sel.action = actionId; UI.sel.zone = zone; UI.sel.duration = undefined;
      setDrawerExpanded(true); render();
    },
    onNpcs: showNpcs,
    onInventory: showInventory,
    onEvent: showEvent,
  });
  bindPlannerWindow();
  new MutationObserver(() => { if (!modalOpen()) queueItemWishes(() => !busy && !planningRequest); }).observe($('modalOverlay'), { attributes: true, attributeFilter: ['class'] });
  UI.exportSave = exportSave;
  UI.goTitle = goTitle;
  initMap({
    onActorSelect: selectActor,
    onActorUse: (id) => { if (busy || modalOpen()) return; chooseHour(id, UI.state.hour); showQuickItems(id, showInventory, () => { setDrawerExpanded(true); render(); }); },
    onTravel: (actorId, district) => {
      if (busy || UI.night || modalOpen()) return false;
      const result = travelTo(UI.state, actorId, district);
      if (!apply(result)) return false;
      return result.state;
    },
    onDistrict: (id) => { if (UI.night) return; UI.sel.zone = UI.sel.zone === id ? null : id; UI.sel.targets = []; setDrawerExpanded(true); render(); },
    onShop: (shopId) => { if (UI.night) return toast('夜深了，明天再去店里。'); showShop(shopId, UI.sel.actor, 'now'); },
    onSpot: (spot, district) => {
      if (UI.night && district === 'camp') { void triggerCampNightActivity(spot); return; }
      if (spot === 'storage' || spot === 'box') return showInventory();
      if (spot === 'furniture' || spot === 'parcel' || spot === 'table') return showFurniture(UI.sel.actor);
      if (spot === 'workbench' || spot === 'tv') return showCamp();
      if (spot === 'fire') { showCooking(UI.sel.actor); return; }
      if (spot === 'bed') { UI.sel.zone = 'camp'; UI.sel.action = 'sleep'; setDrawerExpanded(true); render(); return; }
      if (spot === 'passersby') return showNpcs(district);
      if (spot === 'bins' || spot === 'bottles') { UI.sel.zone = district; UI.sel.action = spot; setDrawerExpanded(true); render(); return; }
      if (spot === 'fishing') { UI.sel.zone = 'river'; UI.sel.action = 'fish'; setDrawerExpanded(true); render(); return; }
      if (spot === 'cardhall') { UI.sel.zone = 'cardhall'; UI.sel.action = 'casino'; setDrawerExpanded(true); render(); return; }
      if (spot === 'board' || spot === 'tasks') return showTasks();
      UI.sel.zone = district;
      UI.sel.action = spot === 'water' ? 'wash' : spot === 'wall' ? 'graffiti' : spot === 'breakfast' ? 'kitchen' : UI.sel.action;
      if (spot === 'breakfast' || spot === 'studio') { setDrawerExpanded(true); render(); return showNpcs(district); }
      setDrawerExpanded(true);
      render();
    },
    onEvent: (uid) => { if (UI.night) return toast('先在营地歇歇，明天再出门。'); showEvent(uid); },
  });
  $('btnContinue').onclick = () => openSavedGames(enterGame);
  $('btnNew').onclick = () => newGame(false);
  $('btnImport').onclick = importSave;
  $('btnHelp').onclick = showHelp;
  initAudio();
  liveClock = startLiveClock(() => advance(false, true), () => busy || planningRequest || Boolean(UI.state?.pending?.combat) || Boolean(pendingWorkGame()));
  $('btnSaves').onclick = () => openSavedGames(enterGame);
  $('btnAiPlan').onclick = arrangeTeammates;
  $('planToggle').onclick = (event) => { event.stopPropagation(); setDrawerExpanded($('planToggle').getAttribute('aria-expanded') !== 'true'); };
  $('planToggle').onkeydown = (event) => { if (event.code === 'Space') event.stopPropagation(); };
  onSharedSaveStatus(({ status, detail, active }) => {
    const labels = { idle: '本机进度', pending: '待保存', saving: '保存中', saved: '已保存', conflict: '版本冲突', error: '保存失败' };
    $('sharedSaveStatus').textContent = (active?.name ? active.name + ' · ' : '') + labels[status];
    $('sharedSaveStatus').title = detail || '局域网共享存档';
    if (status === 'conflict' || status === 'error') toast(detail + '。打开存档表可重新载入，或把本机进度另存新档。', 10000);
  });
  $('btnTitle').onclick = goTitle;
  $('btnAdvance').onclick = () => advance();
  document.querySelectorAll('[data-open]').forEach((b) => { b.onclick = () => { if (UI.night && ['map', 'events', 'camp'].includes(b.dataset.open)) return toast('今晚留在营地，物件就在街景里。'); return ({ tasks: showTasks, camp: showCamp, chapters: showChapters, help: showHelp, system: showSystem, map: showMapList, events: showEvents, inventory: showInventory, wishes: showWishes, health: showHealth, logs: () => showModal('街头记事', UI.state.log.map((x) => `<div class="logitem">${esc(x)}</div>`).join(''), { wide: true }) }[b.dataset.open])(); }; });
  $('modalClose').onclick = () => closeModal();
  $('modalOverlay').onclick = (e) => { if (e.target === $('modalOverlay')) closeModal(); };
  document.addEventListener('keydown', (e) => {
    const open = modalOpen();
    if (e.key === 'Escape' && open) { closeModal(); return; }
    if (open || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) || $('game').classList.contains('hidden')) return;
    if (['1', '2', '3'].includes(e.key)) chooseHour(IDS[Number(e.key) - 1], UI.state.hour);
    if (plannerToggleOwnsSpace(e)) return;
    if (e.code === 'Space') { e.preventDefault(); advance(); }
  });
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(render, 120); });
  // 底部过夜地点 + 卖瓶罐 控件
  const tools = document.querySelector('.plan-tools');
  const spotSel = document.createElement('select'); spotSel.id = 'nightSpot'; spotSel.style.cssText = 'width:auto;display:inline-block;margin:0;min-height:38px';
  tools.prepend(spotSel);
  spotSel.onchange = () => { if (apply(setNightSpot(UI.state, spotSel.value))) toast('今晚过夜：' + spotSel.options[spotSel.selectedIndex].text); else render(); };
  const campBtn = document.createElement('button'); campBtn.textContent = '营地'; campBtn.dataset.open = 'camp'; tools.prepend(campBtn); campBtn.onclick = showCamp;
  const sellBtn = document.createElement('button'); sellBtn.id = 'btnSell'; sellBtn.textContent = '卖瓶罐'; tools.prepend(sellBtn);
  sellBtn.onclick = () => { const r = sellBottles(UI.state, UI.sel.actor, { controlledActorId: UI.sel.actor }); if (apply(r)) { toast('卖了' + r.cash + '块。'); showPendingWorkGame(); } };
  const origRender = UI.render;
  UI.render = () => { origRender(); const s = UI.state; if (!s) return; const opts = nightSpotOptions(s); const cur = s.flags.nightSpot || (s.flags.shelterDay === s.day ? 'shelter' : 'camp'); spotSel.innerHTML = opts.map((o) => `<option value="${o.id}" ${o.disabled ? 'disabled' : ''} ${cur === o.id ? 'selected' : ''}>今晚睡：${o.label}</option>`).join(''); spotSel.title = opts.map((o) => o.label + '：' + o.note).join('\n'); sellBtn.textContent = `卖瓶罐（${s.bottles || 0}）`; sellBtn.disabled = !(s.bottles > 0); };
  renderTitle();
  const params = new URLSearchParams(location.search);
  if (params.get('autostart') === '1') { const s = loadSave(); if (s && !s.invalid) { UI.state = s; enterGame(); } else newGame(true); }
}

// 调试与自动化 QA 入口：只读状态与安全的状态替换，不绕过引擎校验。
window.jwsn = { get state() { return UI.state; }, UI, setState(s) { const v = validateSave(s); if (!v.ok) throw new Error(v.reason); UI.state = s; save(); render(); phaseDialog(); }, advance, render };

boot().catch((e) => { console.error(e); document.body.insertAdjacentHTML('afterbegin', `<div style="padding:20px;color:#e57e6b">启动失败：${esc(e.message)}</div>`); });
