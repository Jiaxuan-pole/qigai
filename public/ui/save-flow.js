import { UI, loadSave, save, toast } from './core.js';
import { fresh } from '../game/engine.js';
import { ensureBasicWishes } from '../game/wishes.js';
import { validateSave, normalizeSave } from '../game/save.js';
import { promptSaveName, showSaveTable } from './saves.js';
import { createSharedSave, setActiveSharedSave, flushSharedSave } from './saves-client.js';
import { writeNightCheckpoint, clearNightCheckpoint } from './night-state.js';

export async function prepareNamedGame() {
  const name = await promptSaveName();
  if (!name) return null;
  try {
    await flushSharedSave().catch(() => {});
    const state = fresh((Date.now() % 4294967295) >>> 0);
    ensureBasicWishes(state);
    const record = await createSharedSave(name, state);
    clearNightCheckpoint();
    return normalizeSave(record.state);
  } catch (error) { toast('没有创建存档：' + error.message); return null; }
}

export async function importNamedState(state, night = null) {
  const valid = validateSave(state);
  if (!valid.ok) { toast(valid.reason); return false; }
  const name = await promptSaveName();
  if (!name) return false;
  try {
    const record = await createSharedSave(name, normalizeSave(state), night);
    useSharedRecord(record);
    return true;
  } catch (error) { toast('没有导入存档：' + error.message); return false; }
}

export function useSharedRecord(record) {
  const valid = validateSave(record.state);
  if (!valid.ok) throw new Error(valid.reason);
  UI.state = normalizeSave(record.state);
  UI.night = record.night || null;
  setActiveSharedSave(record);
  try {
    if (record.night) writeNightCheckpoint(UI.state, record.night);
    else clearNightCheckpoint();
  } catch { toast('本机无法保留夜间恢复记录。'); }
  save();
}

export async function openSavedGames(onReady) {
  if (UI.night) { toast('先结束这一晚，再切换存档。'); return; }
  try { await flushSharedSave(); } catch (error) { toast(error.message); }
  return showSaveTable({
    onLoad(record) { useSharedRecord(record); onReady(); },
    async onImport() {
      const state = UI.state || loadSave();
      if (!state || state.invalid) return toast('没有可导入的本机进度。');
      if (await importNamedState(state)) onReady();
    },
  });
}
