import { UI, $, toast, modalOpen, save } from './core.js';
import { active } from '../game/engine.js';
import { weatherOf } from '../game/story.js';
import { exploreCampNight } from './camp-night.js';
import { setNightExploration, setActorPose } from './map.js';
import { showInventory } from './modals.js';
import { eveningTalk, showScreening } from './flow.js';
import { offerCardNight } from './cardtable.js';
import { audioScene } from './audio.js';
import { writeNightCheckpoint, clearNightCheckpoint } from './night-state.js';
import { showSleepScene } from './sleep-scene.js';

let running = null;
const waitClose = () => new Promise((resolve) => {
  if (!modalOpen()) return resolve();
  const observer = new MutationObserver(() => { if (!modalOpen()) { observer.disconnect(); resolve(); } });
  observer.observe($('modalOverlay'), { attributes: true, attributeFilter: ['class'] });
});

export function runCampNight(night) {
  if (running) return running;
  const perform = async () => {
    UI.night = night;
    save();
    let completed = false;
    try {
    try { writeNightCheckpoint(UI.state, night); } catch { toast('本次夜间活动无法保存，刷新会返回排程。'); }
    setNightExploration(night.day);
    UI.render();
    const scene = () => audioScene({ ...UI.state, weatherKind: weatherOf(UI.state.seed, night.day).kind }, { night }, 'night');
    scene();
    if (UI.state.pending?.cards) await offerCardNight();
    await exploreCampNight({
      state: UI.state, getState: () => UI.state, night,
      onActorChange(id) { UI.sel.actor = id; UI.render(); },
      onSit(id) { setActorPose(id, 'sit'); window.jwsnAudio?.speak?.(id, '坐一会儿。'); },
      async onInventory(id) { showInventory(id); await waitClose(); },
      async onTalk() { await eveningTalk(); await waitClose(); scene(); },
      async onCards() { await offerCardNight(); scene(); return UI.state.flags.cardNightDay === UI.state.day; },
      async onScreening() { if (night.screening) { showScreening(night.screening); await waitClose(); scene(); } },
      async onEnd() { await showSleepScene({ state: UI.state, night, selectedId: UI.sel.actor }); },
    });
    completed = true;
    } finally {
    if (completed) { try { clearNightCheckpoint(); } catch {} }
    for (const id of active(UI.state)) setActorPose(id, null);
    UI.night = null;
    save();
    setNightExploration(null);
    audioScene(UI.state, { night: null });
    UI.render();
    }
  };
  running = perform().finally(() => { running = null; });
  return running;
}
