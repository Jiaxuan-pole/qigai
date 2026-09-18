export const DAY_START_HOUR = 6;
export const DAY_END_HOUR = 22;

export function slotOfHour(hour) {
  if (!Number.isInteger(hour) || hour < DAY_START_HOUR || hour > DAY_END_HOUR) throw new RangeError('无效小时');
  return Math.min(3, Math.floor((hour - DAY_START_HOUR) / 4));
}

export function planIndex(hour) {
  if (!Number.isInteger(hour) || hour < DAY_START_HOUR || hour >= DAY_END_HOUR) throw new RangeError('无效排程小时');
  return hour - DAY_START_HOUR;
}

export function currentTask(state, id) {
  const index = state.phase === 'tail' ? state.hour - DAY_END_HOUR : planIndex(state.hour);
  return state.busy?.[id]?.task || state.plan[id]?.[index] || null;
}
