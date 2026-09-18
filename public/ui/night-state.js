const KEY = 'jwsn.camp-night';

export function writeNightCheckpoint(state, night, storage = localStorage) {
  storage.setItem(KEY, JSON.stringify({ seed: state.seed, turn: state.turn, night }));
}

export function readNightCheckpoint(state, storage = localStorage) {
  try {
    const value = JSON.parse(storage.getItem(KEY) || 'null');
    if (!value || value.seed !== state.seed || value.turn !== state.turn || value.night?.spot !== 'camp') return null;
    if (!Number.isInteger(value.night.day) || value.night.day !== state.day - 1) return null;
    if (state.version === 4 && state.hour !== 6) return null;
    if (state.version === 3 && state.slot !== 0) return null;
    if (state.turn !== value.night.day * 4) return null;
    return value.night;
  } catch { return null; }
}

export function clearNightCheckpoint(storage = localStorage) { storage.removeItem(KEY); }
