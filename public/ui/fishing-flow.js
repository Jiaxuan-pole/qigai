import { UI, apply, toast } from './core.js';
import { resolveFishingQte } from '../game/fishing.js';
import { finishRiverFight } from '../game/engine.js';
import { playFishingQte } from './fishing-qte.js';
import { playRiverFight } from './river-fight-intro.js';

let running = null;

export function resolvePendingFishing() {
  if (running) return running;
  const perform = async () => {
    while (UI.state.pending?.fishingQte?.length) {
      const state = UI.state, bite = state.pending.fishingQte[0];
      if (UI.sel.actor !== bite.actorId) { UI.sel.actor = bite.actorId; UI.render(); }
      const resolve = (angle) => {
        if (UI.state.seed !== state.seed || UI.state.pending?.fishingQte?.[0]?.id !== bite.id) return { error: '这次收竿已不在当前存档。' };
        if (UI.sel.actor !== bite.actorId) { UI.sel.actor = bite.actorId; UI.render(); }
        const result = resolveFishingQte(UI.state, bite.id, angle);
        if (!result.error) apply(result);
        return result;
      };
      if (state.actors[bite.actorId].life !== 'active') resolve(null);
      else {
        try { await playFishingQte(bite, resolve); }
        catch (error) { toast(error.message); return; }
      }
      if (UI.state.seed !== state.seed) return;
    }
    const encounter = UI.state.pending?.riverFight;
    if (!encounter) return;
    if (UI.sel.actor !== encounter.actorId) { UI.sel.actor = encounter.actorId; UI.render(); }
    const finish = () => {
      if (UI.state.pending?.riverFight?.id === encounter.id) apply(finishRiverFight(UI.state, encounter.id));
    };
    if (UI.state.actors.ma.life !== 'active') { finish(); return; }
    await new Promise((resolve) => playRiverFight(encounter, () => { finish(); resolve(); }));
  };
  running = perform().finally(() => { running = null; });
  return running;
}
