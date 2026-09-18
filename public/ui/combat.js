import { $, UI, esc, apply, showModal, closeModal } from './core.js';
import { actCombat, closeCombat, COMBAT_MAX_ROUNDS } from '../game/combat.js';
import { px } from './pixel.js';
import { streetSprite } from './street-people.js';
import { drawConflictNpc } from './npc-art.js';
import { maybeStartCombatTutorial } from './tutorial.js';

const INTENT_TEXT = { strike: '对方抬起拳头，正逼近。', guard: '对方收紧架势，护着上身。', rush: '对方压低身子，准备猛冲。' };
const OUTCOME_TEXT = { win: '对方退开了', lose: '没能顶住', flee: '已经脱身' };
let activeView = null;

export function drawCombatScene(c, state, combat, frame = null, progress = 1) {
  c.imageSmoothingEnabled = false;
  px(c, 0, 0, 480, 270, '#1f2a32');
  px(c, 0, 38, 480, 149, '#26333b');
  for (let y = 48; y < 184; y += 24) {
    px(c, 0, y, 480, 2, '#3e4c53');
    for (let x = (y % 48 ? 0 : 24); x < 480; x += 48) px(c, x, y, 2, 24, '#3e4c53');
  }
  px(c, 206, 64, 82, 123, '#141a1f'); px(c, 215, 73, 65, 114, '#131a20');
  px(c, 0, 187, 480, 83, '#3e4c53'); px(c, 0, 187, 480, 4, '#a7b1b3');
  for (let x = 0; x < 480; x += 68) px(c, x, 225, 42, 2, '#26333b');
  px(c, 23, 174, 43, 33, '#b98358'); px(c, 28, 181, 32, 2, '#d9a577'); px(c, 31, 166, 26, 8, '#d7cbb1');
  const active = frame && progress < 1;
  const firstHalf = progress < 0.52;
  const strike = active && frame.action === 'attack' && firstHalf;
  const hit = active && frame.received > 0 && !firstHalf;
  const wave = Math.sin(Math.min(1, progress * 2) * Math.PI);
  const playerX = active && frame.action === 'flee' ? 64 - progress * (frame.escaped ? 78 : 16) : 64 + (strike ? wave * 33 : 0) - (hit ? 3 : 0);
  const motionFrame = Math.floor(progress * 8) % 4;
  const actionFrame = Math.min(2, Math.floor((firstHalf ? progress : progress - 0.52) * 6));
  const playerPose = active && frame.action === 'flee' ? `walk${motionFrame}` : hit ? `hit${actionFrame}` : strike ? `attack${actionFrame}` : frame?.action === 'defend' && active ? `defend${actionFrame}` : 'stand';
  c.save(); c.scale(2, 2);
  for (let i = 0; i < combat.allies.length; i++) streetSprite(c, 4 + i * 27, 59, combat.allies[i], 1.16, 'defend0');
  streetSprite(c, playerX, 54, combat.actorId, 1.35, playerPose, active && frame.action === 'flee' ? -1 : 1);
  const enemyX = 139 + (strike && frame.dealt > 0 ? wave * 5 : 0) - (hit ? 28 : 0);
  const enemyPose = hit ? 'attack' : strike && frame.dealt > 0 && progress > 0.2 ? 'hit' : frame?.intent === 'guard' && firstHalf ? 'defend' : 'stand';
  drawConflictNpc(c, enemyX, 54, combat.kind, enemyPose, actionFrame, -1, 1);
  if (combat.kind === 'thugs') drawConflictNpc(c, 192, 55, 'thug_hood', hit ? 'defend' : 'stand', motionFrame, -1, 0.96);
  if (active && ((strike && frame.dealt > 0 && progress > 0.22) || hit)) {
    const x = hit ? playerX + 23 : enemyX - 3;
    px(c, x, 74, 5, 3, '#e3bb72'); px(c, x + 2, 68, 2, 14, '#d7cbb1'); px(c, x - 3, 74, 11, 2, '#d7cbb1');
  }
  c.restore();
  px(c, 24, 22, 164, 6, '#141a1f'); px(c, 24, 22, combat.playerStamina * 1.64, 6, '#a7b1b3');
  px(c, 292, 22, 164, 6, '#141a1f'); px(c, 292, 22, combat.opponentStamina * 1.64, 6, '#e3bb72');
}

export function showCombat(onDone = () => {}) {
  const combat = UI.state?.pending?.combat;
  if (!combat) { onDone(); return Promise.resolve(); }
  if (activeView?.id === combat.id && $('combatCanvas')?.isConnected) return activeView.promise;
  activeView?.dispose();
  let resolveDone, raf = 0, disposed = false;
  const promise = new Promise(resolve => { resolveDone = resolve; });
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(raf);
    observer.disconnect();
    window.jwsnAudio?.cancelScope?.('combat');
    activeView = null;
    resolveDone(); onDone();
  };
  const observer = new MutationObserver(() => { if (!$('combatCanvas')?.isConnected || !$('modalOverlay').classList.contains('open')) dispose(); });
  activeView = { id: combat.id, promise, dispose };
  const render = (frame = null) => {
    const s = UI.state, c = s.pending.combat;
    if (!c || c.id !== combat.id) { dispose(); return; }
    const finished = c.phase === 'resolved';
    const latest = c.history.at(-1);
    const summary = latest ? `${latest.action === 'attack' ? '出手' : latest.action === 'defend' ? '防守' : '撤离'}${latest.dealt ? ` · 对方架势 -${latest.dealt}` : ''}${latest.received ? ` · 我方架势 -${latest.received}` : ''}` : '';
    showModal(finished ? OUTCOME_TEXT[c.result.outcome] : '街头冲突', `<section class="combat-view" data-combat-id="${esc(c.id)}">
      <div class="combat-status"><strong>${esc(s.names[c.actorId])} · 架势 ${c.playerStamina}/100</strong><span>${c.kind === 'thugs' ? '拦路混混' : '巡查队'} · 架势 ${c.opponentStamina}/100</span></div>
      <canvas id="combatCanvas" width="480" height="270" style="display:block;width:100%;aspect-ratio:16/9;image-rendering:pixelated" aria-label="${esc(s.names[c.actorId])}与${c.kind === 'thugs' ? '混混' : '巡查队'}的街头冲突"></canvas>
      <p class="combat-intent" role="status">${finished ? esc(c.result.text) : `${esc(INTENT_TEXT[c.intent])}${c.opening ? ` 反击空当 +${c.opening}` : ''}`}</p>
      <p class="small muted">第 ${finished ? c.round : c.round + 1} / ${COMBAT_MAX_ROUNDS} 回合${summary ? ` · ${summary}` : ''}</p>
      <div class="modalbuttons combat-actions">${finished ? '<button id="combatDone" class="primary">继续</button>' : '<button data-combat-action="attack" class="danger">攻击</button><button data-combat-action="defend">防守</button><button data-combat-action="flee">撤离</button>'}</div>
      </section>`, { wide: true, lock: true, tag: 'STREET CONFLICT' });
    const canvas = $('combatCanvas'), context = canvas.getContext('2d');
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const buttons = [...$('modalContent').querySelectorAll('[data-combat-action], #combatDone')];
    let started;
    let impactPlayed = false;
    const animate = time => {
      if (disposed || !canvas.isConnected) return;
      started ??= time;
      const progress = frame && !reduced ? Math.min(1, (time - started) / 620) : 1;
      drawCombatScene(context, s, c, frame, progress);
      if (frame && !impactPlayed && progress >= 0.25) {
        impactPlayed = true;
        window.jwsnAudio?.play?.(frame.action === 'defend' ? 'combat_block' : frame.dealt || frame.received ? 'combat_hit' : 'combat_flee', { scope: 'combat' });
      }
      if (progress < 1) raf = requestAnimationFrame(animate);
      else { buttons.forEach(b => { b.disabled = false; }); buttons[0]?.focus(); }
    };
    buttons.forEach(b => { b.disabled = Boolean(frame && !reduced); });
    animate(performance.now());
    for (const button of buttons) button.onclick = () => {
      if (button.id === 'combatDone') {
        if (apply(closeCombat(UI.state, c.id))) { closeModal(true); dispose(); }
        return;
      }
      const action = button.dataset.combatAction;
      const result = actCombat(UI.state, c.id, action, c.round);
      if (!apply(result, { noRender: true })) return;
      window.jwsnAudio?.play?.(action === 'attack' ? 'combat_swing' : action === 'defend' ? 'combat_block' : 'combat_flee', { scope: 'combat' });
      cancelAnimationFrame(raf);
      render(result.frame);
    };
  };
  render();
  if (combat.phase === 'fighting') maybeStartCombatTutorial(UI.state);
  observer.observe($('modalOverlay'), { attributes: true, attributeFilter: ['class'] });
  observer.observe($('modalContent'), { childList: true });
  return promise;
}
