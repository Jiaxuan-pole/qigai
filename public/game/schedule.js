import { ACTIONS } from './actions.js';
import { assign, copy, IDS } from './engine.js';
import { DAY_END_HOUR, planIndex, slotOfHour } from './clock.js';
import { preflight, settle } from './settle.js';

export function assignDuration(input, actorId, hour, actionId, options) {
  const duration = options.duration;
  if (hour + duration > (input.phase === 'tail' ? 24 : DAY_END_HOUR)) return { state: input, error: '任务时长超过今天剩余小时。' };
  let state = input;
  for (let offset = 0; offset < duration; offset++) {
    const at = hour + offset;
    const result = assign(state, actorId, at, actionId, { ...options, duration: 1 });
    if (result.error) return { ...result, state: input };
    const index = input.phase === 'tail' ? at - DAY_END_HOUR : planIndex(at);
    const scheduled = result.state.plan[actorId][index];
    if (offset > 0 && scheduled.participants.some(id => {
      const existing = input.plan[id][index];
      return existing && (existing.id !== actionId || existing.group || existing.eventUid);
    })) return { state: input, error: '后续小时已有行动或合作，请先调整已安排的任务。' };
    state = result.state;
  }
  const action = ACTIONS[actionId];
  const limit = actionId === 'soup' && state.flags.wangSoup ? 3 : action.limit;
  if (limit) {
    const reserved = new Set();
    for (const id of IDS) for (let at = input.hour; at < DAY_END_HOUR; at++) {
      const scheduled = state.plan[id][planIndex(at)];
      if (scheduled?.id === actionId) reserved.add(scheduled.group || `${id}:${at}`);
    }
    if ((state.daily.orders[actionId] || 0) + reserved.size > limit) return { state: input, error: action.name + '的本日岗位/次数不足以连续安排。' };
  }
  for (let offset = 0; offset < duration; offset++) {
    const at = hour + offset;
    const check = preflight({ ...state, hour: at, slot: input.phase === 'tail' ? 3 : slotOfHour(at) });
    if (check.error) return { state: input, error: check.error, at: { actorId: check.actorId || actorId, hour: at } };
  }
  return { state };
}

// Keep concurrent sleepers for bed allocation, but exclude unrelated jobs and their wages.
export function actionEstimate(input, actorId, actionId, duration = 1, options = {}) {
  if (!input.actors[actorId]) return { error: '无效角色。' };
  let state = copy(input);
  state.plan = Object.fromEntries(IDS.map(id => [id, state.plan[id].map(task => id !== actorId && task?.id === 'sleep' ? task : null)]));
  for (const id of IDS) if (id !== actorId && state.busy?.[id]?.task.id !== 'sleep') state.busy[id] = null;
  const assigned = assign(state, actorId, state.hour, actionId, { ...options, duration });
  if (assigned.error) return { error: assigned.error };
  state = assigned.state;
  let completedHours = 0;
  let error = null;
  while (completedHours < duration) {
    const result = settle(state);
    if (result.error) { error = result.error; break; }
    state = result.state;
    completedHours++;
  }
  const actor = state.actors[actorId];
  return {
    duration, completedHours, complete: completedHours === duration,
    energy: actor.energy - input.actors[actorId].energy,
    mind: actor.mind - input.actors[actorId].mind,
    pendingMind: (state.periodFacts?.mindGain?.[actorId] || 0) - (input.periodFacts?.mindGain?.[actorId] || 0),
    cash: state.cash - input.cash,
    ...(error ? { error } : {}),
  };
}
