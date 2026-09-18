import { clamp } from './rules.js';

const IDS = ['xuan', 'fan', 'ma'];

export function killActor(state, id, turn, events, cause = null) {
  const p = state.actors[id];
  if (!p || p.life === 'dead' || p.life === 'unrecruited') return;
  p.life = 'dead'; p.health = 0; p.deathTurn = turn; p.deadline = null;
  p.deathCause = cause || p.deathCause || '救援未及时完成';
  state.deaths.push({ id, day: state.day, turn, cause: p.deathCause });
  for (const it of state.items) if (it.container === id) it.container = 'relic:' + id;
  const begin = state.hour >= 6 && state.hour < 22 ? state.hour - 6 : 0;
  for (let h = begin; h < 16; h++) {
    const group = state.plan[id]?.[h]?.group;
    for (const m of IDS) if (m === id || (group && state.plan[m]?.[h]?.group === group)) state.plan[m][h] = null;
  }
  for (const m of IDS) if (state.busy?.[m]?.task.participants.includes(id)) state.busy[m] = null;
  for (const ev of state.events) {
    if (!['open', 'reserved'].includes(ev.status)) continue;
    if (ev.reserved?.actorId === id) { ev.status = 'open'; ev.reserved = null; }
    if (ev.cast?.includes(id)) { ev.cast = ev.cast.filter((x) => x !== id); if (!ev.cast.length) ev.status = 'expired'; }
  }
  for (const w of state.wishes) if (w.actor === id && w.status === 'active') { w.status = 'closed'; w.closedDay = state.day; }
  events.push(state.names[id] + '死亡。已取消其后续劳动和合作；幸存者继续。');
  for (const m of IDS) if (['active', 'downed'].includes(state.actors[m].life)) {
    state.actors[m].mind = clamp(state.actors[m].mind - 18);
    state.actors[m].grief = 3;
  }
  if (!IDS.some((m) => ['active', 'downed'].includes(state.actors[m].life))) state.phase = 'gameover';
}
