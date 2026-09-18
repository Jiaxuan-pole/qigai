import { active, assign, fresh } from '../public/game/engine.js';

export function ready(seed = 260916, options = {}) {
  let s = fresh(seed);
  s.pendingMorning = null;
  s.phase = options.phase || 'planning';
  s.turn = options.turn ?? 4;
  s.day = options.day ?? Math.floor(s.turn / 4) + 1;
  s.slot = options.slot ?? s.turn % 4;
  s.hour = 9 + s.slot * 4;
  s.hourTick = (s.day - 1) * 16 + s.hour - 6;
  s.plan = { xuan: Array(16).fill(null), fan: Array(16).fill(null), ma: Array(16).fill(null) };
  if (options.ma) {
    s.metMa = true;
    s.actors.ma.life = 'active';
    s.actors.ma.joinedTurn = 4;
  }
  return restCurrent(s);
}

export function restCurrent(input) {
  let s = input;
  for (const id of active(s)) {
    const r = assign(s, id, s.hour, 'rest');
    if (r.error) throw new Error(r.error);
    s = r.state;
  }
  return s;
}

export function plan(input, actorId, actionId, options = {}) {
  const r = assign(input, actorId, input.hour, actionId, options);
  if (r.error) throw new Error(r.error);
  return r.state;
}

export function recruitMa(s) {
  s.metMa = true;
  s.actors.ma.life = 'active';
  s.actors.ma.joinedTurn = 4;
  return s;
}

export function down(s, id, deadline = s.turn + 2) {
  const p = s.actors[id];
  p.life = 'downed';
  p.health = 0;
  p.downedAt = s.turn;
  p.deadline = deadline;
  p.deathCause = '测试伤势';
  return s;
}

export function bareTask(id, actorId, extra = {}) {
  return {
    id,
    participants: extra.participants || [actorId],
    target: extra.target || null,
    group: extra.group || null,
    zone: extra.zone || (id === 'aid' || id === 'rescue' || id === 'clinic' ? 'service' : id === 'wait' || id === 'rest' ? 'camp' : 'recycle'),
    cart: null,
    destination: 'self',
    targets: null,
    care: null,
    eventUid: extra.eventUid || null,
    pay: null,
    extraCost: null,
    costOverride: null,
  };
}

export function wish(uid, actor, category, intensity) {
  return {
    uid,
    templateId: actor === 'xuan' ? 'xuan_keyboard' : 'good_meal',
    actor,
    category,
    intensity,
    createdTurn: 0,
    createdDay: 1,
    revealed: true,
    revealTurn: 0,
    promise: null,
    declined: false,
    status: 'active',
    lastLoss: 0,
  };
}
