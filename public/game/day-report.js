import { templateOf } from './wishes.js';

const IDS = ['xuan', 'fan', 'ma'];
const STATS = ['health', 'food', 'energy', 'coffeeCredit', 'mind', 'hygiene', 'warmth', 'fishingSkill'];
const LIVES = ['active', 'downed', 'dead', 'unrecruited'];
const MAX_ACTIVITIES = 300;
const finite = (value, min = -1000000, max = 1000000) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const dayNumber = (n) => Number.isInteger(n) && n >= 1 && n <= 100000;
const short = (s, max = 100) => typeof s === 'string' && s.length > 0 && s.length <= max && !/[<>\x00-\x1f\x7f-\x9f]/.test(s);
const actorId = (id) => IDS.includes(id);
const statsOf = (actor) => Object.fromEntries(STATS.map((key) => [key, finite(actor?.[key]) ? actor[key] : 0]));
const actorStart = (actor) => ({ life: LIVES.includes(actor?.life) ? actor.life : 'unrecruited', stats: statsOf(actor) });

export function beginDayReport(state, { partial = false } = {}) {
  if (!state?.daily || !dayNumber(state.day)) return null;
  if (state.daily.report?.day === state.day && validCurrent(state.daily.report)) return state.daily.report;
  state.daily.report = {
    day: state.day, partial: Boolean(partial), startCash: finite(state.cash) ? state.cash : 0,
    actors: Object.fromEntries(IDS.map((id) => [id, actorStart(state.actors?.[id])])),
    activities: [], controlledBonusIncome: 0,
  };
  return state.daily.report;
}

export function recordAutomaticWork(state, { actorId: actor, participants, controlledActorId = null, source, sourceUid, label, hour, income = 0 } = {}) {
  const report = state?.daily?.report;
  if (!validCurrent(report) || report.day !== state.day || !actorId(actor) || state.actors?.[actor]?.life === 'unrecruited') return false;
  if (!short(source, 40) || !short(sourceUid, 100) || !short(label, 100) || !finite(income, 0) || !Number.isInteger(hour) || hour < 0 || hour > 24) return false;
  const group = Array.isArray(participants) ? [...new Set(participants)] : [actor];
  if (!group.length || group.some((id) => !actorId(id)) || !group.includes(actor)) return false;
  if (group.length === 1 && actor === controlledActorId) return false;
  if (group.length > 1 && !group.some((id) => id !== controlledActorId)) return false;
  const id = `${source}:${sourceUid}`;
  if (report.activities.some((item) => item.id === id) || report.activities.length >= MAX_ACTIVITIES) return false;
  report.activities.push({ id, actorId: actor, participants: group, controlledActorId: actorId(controlledActorId) ? controlledActorId : null, source, sourceUid, label, hour, income });
  return true;
}

function wishSnapshot(state) {
  const items = [];
  let hiddenCount = 0;
  for (const wish of state.wishes || []) {
    if (!actorId(wish.actor)) continue;
    if (!wish.revealed) { if (wish.status === 'active') hiddenCount++; continue; }
    const closedToday = wish.closedDay === state.day && wish.status === 'fulfilled';
    if (wish.status !== 'active' && !closedToday) continue;
    const tpl = templateOf(wish);
    if (!tpl?.name) continue;
    const status = closedToday ? 'fulfilled' : wish.declined ? 'declined' : wish.promise && state.turn < wish.promise.until ? 'deferred' : 'active';
    items.push({ actorId: wish.actor, name: String(tpl.name).slice(0, 100), reason: typeof wish.reason === 'string' && ['ai', 'local'].includes(wish.source) ? wish.reason.slice(0, 100) : '', status });
    if (items.length >= 100) break;
  }
  return { items, hiddenCount: Math.min(hiddenCount, 100) };
}

export function finishDayReport(state) {
  const current = state?.daily?.report;
  if (!validCurrent(current) || current.day !== state.day) return null;
  const actors = Object.fromEntries(IDS.map((id) => {
    const before = current.actors[id];
    const after = actorStart(state.actors?.[id]);
    const stats = Object.fromEntries(STATS.map((key) => [key, { start: before.stats[key], end: after.stats[key], delta: after.stats[key] - before.stats[key] }]));
    const autoSoloIncome = current.activities.filter((a) => a.actorId === id && a.participants.length === 1).reduce((sum, a) => sum + a.income, 0);
    return [id, { life: { start: before.life, end: after.life }, stats, autoSoloIncome }];
  }));
  const report = {
    day: current.day, partial: current.partial, startCash: current.startCash, endCash: state.cash,
    cashDelta: state.cash - current.startCash, actors, activities: structuredClone(current.activities),
    totalAutoIncome: current.activities.reduce((sum, a) => sum + a.income, 0),
    controlledBonusIncome: current.controlledBonusIncome ?? 0, wishes: wishSnapshot(state),
  };
  if (!validFinished(report)) return null;
  state.lastDayReport = report;
  return report;
}

export function accountWorkGameBonus(state, sessionDay, bonus) {
  if (!Number.isSafeInteger(bonus) || bonus <= 0 || !dayNumber(sessionDay)) return state;
  const next = { ...state };
  const late = state.day > sessionDay;
  if (state.lastDayReport?.day === sessionDay) next.lastDayReport = {
    ...state.lastDayReport,
    endCash: state.lastDayReport.endCash + bonus,
    cashDelta: state.lastDayReport.cashDelta + bonus,
    controlledBonusIncome: (state.lastDayReport.controlledBonusIncome ?? 0) + bonus,
  };
  if (state.daily?.report?.day === state.day) next.daily = { ...state.daily, report: {
    ...state.daily.report,
    startCash: state.daily.report.startCash + (late ? bonus : 0),
    controlledBonusIncome: (state.daily.report.controlledBonusIncome ?? 0) + (late ? 0 : bonus),
  } };
  if (late && state.lastDayReport?.day === sessionDay) next.ledger = {
    ...state.ledger, start: state.ledger.start + bonus, income: state.ledger.income - bonus,
  };
  return next;
}

function validActivities(list) {
  return Array.isArray(list) && list.length <= MAX_ACTIVITIES && new Set(list.map((a) => a?.id)).size === list.length && list.every((a) =>
    a && short(a.id, 141) && actorId(a.actorId) && Array.isArray(a.participants) && a.participants.length >= 1 && a.participants.length <= 3
    && new Set(a.participants).size === a.participants.length && a.participants.every(actorId) && a.participants.includes(a.actorId)
    && (a.controlledActorId === null || actorId(a.controlledActorId)) && short(a.source, 40) && short(a.sourceUid, 100)
    && a.id === `${a.source}:${a.sourceUid}` && short(a.label, 100) && Number.isInteger(a.hour) && a.hour >= 0 && a.hour <= 24 && finite(a.income, 0));
}
function validCurrent(r) {
  return r && dayNumber(r.day) && typeof r.partial === 'boolean' && finite(r.startCash)
    && (r.controlledBonusIncome === undefined || finite(r.controlledBonusIncome, 0)) && validActivities(r.activities)
    && r.actors && IDS.every((id) => LIVES.includes(r.actors[id]?.life) && STATS.every((key) => finite(r.actors[id]?.stats?.[key])));
}
function validFinished(r) {
  return r && dayNumber(r.day) && typeof r.partial === 'boolean' && finite(r.startCash) && finite(r.endCash)
    && finite(r.cashDelta) && r.cashDelta === r.endCash - r.startCash && validActivities(r.activities)
    && finite(r.totalAutoIncome, 0) && r.totalAutoIncome === r.activities.reduce((sum, a) => sum + a.income, 0)
    && (r.controlledBonusIncome === undefined || finite(r.controlledBonusIncome, 0))
    && r.actors && IDS.every((id) => LIVES.includes(r.actors[id]?.life?.start) && LIVES.includes(r.actors[id]?.life?.end)
      && finite(r.actors[id]?.autoSoloIncome, 0) && STATS.every((key) => {
        const s = r.actors[id]?.stats?.[key]; return finite(s?.start) && finite(s?.end) && finite(s?.delta) && s.delta === s.end - s.start;
      }))
    && r.wishes && Array.isArray(r.wishes.items) && r.wishes.items.length <= 100
    && Number.isInteger(r.wishes.hiddenCount) && r.wishes.hiddenCount >= 0 && r.wishes.hiddenCount <= 100
    && r.wishes.items.every((w) => actorId(w?.actorId) && short(w.name, 100) && typeof w.reason === 'string' && w.reason.length <= 100
      && ['fulfilled', 'deferred', 'declined', 'active'].includes(w.status));
}
export function validateDayReport(state) {
  return (!Object.hasOwn(state?.daily ?? {}, 'report') || validCurrent(state.daily.report)) &&
    (!Object.hasOwn(state ?? {}, 'lastDayReport') || validFinished(state.lastDayReport));
}
export function normalizeDayReport(state) {
  if (!state || typeof state !== 'object') return state;
  if (state.daily?.report && !validCurrent(state.daily.report)) delete state.daily.report;
  if (state.lastDayReport && !validFinished(state.lastDayReport)) delete state.lastDayReport;
  return state;
}
