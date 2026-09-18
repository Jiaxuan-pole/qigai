import test from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../public/game/data.js';
import { fresh } from '../public/game/engine.js';
import { UI } from '../public/ui/core.js';
import { useSharedRecord } from '../public/ui/save-flow.js';
import { flushSharedSave, setActiveSharedSave } from '../public/ui/saves-client.js';

test('从共享表恢复夜间后，首次自动保存仍带着夜间进度', async () => {
  await loadData();
  const state = fresh(901); state.day = 8; state.hourTick = 112; state.turn = 28; state.pendingMorning = null;
  const night = { day: 7, spot: 'camp' };
  const record = { id: 'test-slot', name: '桥下这晚', revision: 1, state, night };
  const oldFetch = globalThis.fetch, oldStorage = globalThis.localStorage;
  const memory = new Map(); let sent;
  globalThis.localStorage = { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v), removeItem: (k) => memory.delete(k) };
  globalThis.fetch = async (_url, options) => { sent = JSON.parse(options.body); return { ok: true, json: async () => ({ ok: true, save: { ...record, ...sent, revision: 2 } }) }; };
  try {
    useSharedRecord(record);
    await flushSharedSave();
    assert.deepEqual(sent.night, night);
    assert.deepEqual(UI.night, night);
  } finally {
    setActiveSharedSave(null); UI.state = null; UI.night = null;
    globalThis.fetch = oldFetch; globalThis.localStorage = oldStorage;
  }
});
