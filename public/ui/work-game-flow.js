import { $, UI, apply, closeModal, showModal } from './core.js';
import { finishWorkGame, stepWorkGame } from '../game/work-games.js';
import { mountWorkGame } from './work-games.js';

let active = null;
const actionCue = {
  sorting: { place: 'work_sort' }, memory: { ready: 'work_sort', pick: 'work_handoff' },
  circuit: { rotate: 'work_rotate', submit: 'work_rotate' }, audit: { flag: 'work_sort' },
  camera: { move: 'work_camera', shoot: 'work_camera' }, sequence: { select: 'work_cut' },
  route: { move: 'footstep' }, balance: { shift: 'work_handoff', advance: 'work_handoff' },
  relay: { pass: 'work_handoff' }, cups: { watch: 'cups_shuffle', choose: 'work_sort' },
};
const sound = (cue) => { if (cue) globalThis.window?.jwsnAudio?.play?.(cue, { scope: 'work-game' }); };

export function pendingWorkGame() {
  return UI.state?.pending?.workGames?.[0] || null;
}

export function forfeitPendingWorkGames() {
  if (active) { active.destroy(); active = null; globalThis.window?.jwsnAudio?.cancelScope?.('work-game'); closeModal(true); }
  while (pendingWorkGame()) {
    const result = finishWorkGame(UI.state, pendingWorkGame().id, { forfeit: true });
    if (!apply(result, { noRender: true })) return false;
  }
  UI.render();
  return true;
}

export function showPendingWorkGame() {
  const session = pendingWorkGame();
  if (!session) return false;
  if (active) return true;
  if (UI.state.actors[session.controllerId]?.life !== 'active' || UI.state.actors[session.jobActorId]?.life !== 'active') {
    forfeitPendingWorkGames();
    return Boolean(pendingWorkGame());
  }
  UI.sel.actor = session.controllerId;
  showModal('工作挑战', '<div id="workGameRoot" data-sfx-scene="work-game"></div><div class="modalbuttons"><button id="workGameContinue" class="primary" hidden>继续</button></div>', { lock: true, wide: true, tag: 'WORK' });
  const gameId = session.id;
  const current = () => pendingWorkGame()?.id === gameId;
  const finish = (forfeit) => {
    if (!current()) return { error: '这次挑战已结算。' };
    const result = finishWorkGame(UI.state, gameId, { forfeit });
    if (result.error) return result;
    apply(result, { noRender: true });
    if (forfeit) { globalThis.window?.jwsnAudio?.cancelScope?.('work-game'); sound('back'); }
    else { sound(result.score >= 50 ? 'work_success' : 'work_miss'); if (result.bonus > 0) sound('coin'); }
    $('workGameContinue').hidden = false;
    $('workGameContinue').focus();
    return result;
  };
  active = mountWorkGame($('workGameRoot'), session, {
    onInput(input) {
      if (!current()) return { error: '这次挑战已结算。' };
      const result = stepWorkGame(UI.state, gameId, input);
      if (!result.error && apply(result, { noRender: true })) sound(actionCue[session.challenge.family]?.[input.type]);
      return result;
    },
    onFinish: () => finish(false),
    onForfeit: () => finish(true),
  });
  $('workGameContinue').onclick = () => {
    active?.destroy(); active = null;
    globalThis.window?.jwsnAudio?.cancelScope?.('work-game');
    closeModal(true);
    UI.render();
    if (pendingWorkGame()) showPendingWorkGame();
  };
  return true;
}
