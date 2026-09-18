import test from 'node:test';
import assert from 'node:assert/strict';
import { writeNightCheckpoint, readNightCheckpoint, clearNightCheckpoint } from '../public/ui/night-state.js';

test('营地夜间刷新能恢复，另一存档或下一回合不会误恢复', () => {
  let raw = null;
  const storage = { getItem: () => raw, setItem: (_, v) => { raw = v; }, removeItem: () => { raw = null; } };
  const state = { version: 4, seed: 2, turn: 28, day: 8, hour: 6, slot: 0 };
  const night = { day: 7, spot: 'camp', end: 72, fire: true, sleepSurfaces: {
    xuan: { kind: 'floor', uid: null, slot: 'floor_1', anchor: { x: 230, y: 402 } },
  } };
  writeNightCheckpoint(state, night, storage);
  assert.deepEqual(readNightCheckpoint(state, storage), night);
  assert.equal(readNightCheckpoint({ ...state, seed: 3 }, storage), null);
  assert.equal(readNightCheckpoint({ ...state, turn: 29 }, storage), null);
  assert.equal(readNightCheckpoint({ ...state, hour: 7 }, storage), null);
  clearNightCheckpoint(storage);
  assert.equal(readNightCheckpoint(state, storage), null);
});
