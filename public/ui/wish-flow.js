import { UI, apply, modalOpen } from './core.js';
import { maybeGenerateItemWishes } from './wishes-ai.js';

let request = null;
let timer = null;

export function queueItemWishes(canRun = () => true) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    const state = UI.state;
    const ready = () => canRun() && state && UI.state === state && state.phase === 'planning'
      && !state.pendingMorning && !UI.night && !modalOpen()
      && !state.pending?.fishingQte?.length && !state.pending?.riverFight && !state.pending?.casino
      && !document.querySelector('.intro,.tut-root,.fishing-qte-overlay') && !document.getElementById('game').classList.contains('hidden');
    if (request || !ready()) return;
    const ctrl = new AbortController(); request = ctrl;
    maybeGenerateItemWishes(state, { signal: ctrl.signal, useAI: UI.ai.enabled, stillCurrent: ready })
      .then((result) => { if (result && ready()) apply(result); })
      .catch((error) => console.warn('[wishes]', error.message))
      .finally(() => { if (request === ctrl) request = null; });
  }, 250);
}

export function cancelItemWishes() {
  clearTimeout(timer); request?.abort(); request = null;
}
