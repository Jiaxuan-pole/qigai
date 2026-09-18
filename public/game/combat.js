import { rng } from './rng.js';
import { C, fightPower, applyFightOutcome, applyInjury, resolveConfrontation } from './trouble.js';

export const COMBAT_MAX_ROUNDS = 6;
const ACTIONS = ['attack', 'defend', 'flee'];
const INTENTS = ['strike', 'guard', 'rush'];
const roll = (s, c, label) => rng(s.seed, `combat:${c.id}:${c.round}:${label}`);
const opponentIntent = (s, c) => INTENTS[Math.floor(roll(s, c, 'intent') * INTENTS.length)];
export const combatPending = (state) => Boolean(state.pending?.combat);

export function beginCombat(input, { actorId, kind, eventUid } = {}) {
  const ev = input.events?.find(e => e.uid === eventUid);
  if (combatPending(input)) return { state: input, error: '先处理眼前的冲突。' };
  if (input.phase !== 'planning' || input.pendingMorning || input.pending?.beg?.length || input.pending?.bins?.length ||
    input.pending?.fishingQte?.length || input.pending?.workGames?.length || input.pending?.riverFight || input.pending?.cards || input.pending?.casino) {
    return { state: input, error: '先处理当前待办互动。' };
  }
  if (!ev || !['open', 'reserved'].includes(ev.status) ||
    !['thugs', 'chengguan'].includes(kind) || ev.templateId !== (kind === 'thugs' ? 'street_thugs' : 'chengguan_sweep')) {
    return { state: input, error: '这场冲突已经不在了。' };
  }
  const actor = input.actors?.[actorId];
  if (!actor || actor.life !== 'active') return { state: input, error: '需要一名可行动的人。' };
  if (actor.location !== ev.district) return { state: input, error: '角色要在冲突现场的街区才能反抗。' };
  const s = structuredClone(input);
  const allies = Object.keys(s.actors).filter(id => id !== actorId && s.actors[id].life === 'active' && s.actors[id].location === ev.district);
  const [low, high] = kind === 'thugs' ? C.thugPower : C.chengguanPower;
  const combat = {
    id: `combat:${s.seed}:${eventUid}`, eventUid, kind, actorId, allies, day: s.day, hourTick: s.hourTick,
    phase: 'fighting', round: 0, playerStamina: 100, opponentStamina: 100, opening: 0,
    power: fightPower(s, actorId, allies), opponentPower: low + rng(s.seed, `combat:${eventUid}:power`) * (high - low),
    intent: null, history: [], result: null,
  };
  combat.intent = opponentIntent(s, combat);
  s.pending ??= {};
  s.pending.combat = combat;
  const event = s.events.find(e => e.uid === eventUid);
  event.status = 'combat'; event.reserved = null;
  s.stateRevision = (s.stateRevision || 0) + 1;
  return { state: s, events: [`${s.names[actorId]}站到了前面，冲突开始。`], combat };
}

function applyResult(s, c, outcome, events) {
  let result;
  if (outcome === 'flee') {
    result = resolveConfrontation(s, { kind: c.kind, actorId: c.actorId, choice: c.kind === 'thugs' ? 'run' : 'leave', key: c.id, allies: c.allies }, events);
    result.outcome = 'flee';
    if (c.playerStamina <= 60) {
      result.injuries[c.actorId] = applyInjury(s, c.actorId, 'light', c.id, events);
      events.push(`${s.names[c.actorId]}撤离时仍有擦伤，健康-${result.injuries[c.actorId].health}。`);
      result.text = events.join('');
    }
  } else {
    result = applyFightOutcome(s, { kind: c.kind, actorId: c.actorId, allies: c.allies, key: c.id,
      mine: c.power, theirs: c.opponentPower, win: outcome === 'win',
      scratch: c.playerStamina < 75,
      severity: c.playerStamina <= 15 ? 'heavy' : c.playerStamina <= 50 ? 'medium' : 'light',
    }, events);
    events.push(result.text);
  }
  c.phase = 'resolved'; c.result = result;
  const event = s.events.find(e => e.uid === c.eventUid);
  event.status = 'resolved'; event.reserved = null;
}

export function actCombat(input, combatId, action, expectedRound) {
  const current = input.pending?.combat;
  if (!current || current.id !== combatId || current.phase !== 'fighting') return { state: input, error: '这场战斗已经结束或处理过了。' };
  if (expectedRound !== current.round) return { state: input, error: '这一回合已经处理，请按当前局面选择。' };
  if (!ACTIONS.includes(action)) return { state: input, error: '没有这个战斗动作。' };
  if (input.actors[current.actorId]?.life !== 'active') return { state: input, error: '角色当前不能继续战斗。' };
  const s = structuredClone(input), c = s.pending.combat, events = [];
  const entry = { round: c.round, action, intent: c.intent, dealt: 0, received: 0, escaped: false };
  if (action === 'flee') entry.escaped = roll(s, c, 'flee') < Math.min(0.9, 0.4 + c.power * 0.15 + c.opening / 100);
  if (!entry.escaped) {
    if (action === 'attack') {
      entry.dealt = Math.round((16 + c.power * 12 + Math.floor(roll(s, c, 'attack') * 7) + c.opening) * (c.intent === 'guard' ? 0.5 : 1));
      c.opponentStamina = Math.max(0, c.opponentStamina - entry.dealt);
      c.opening = 0;
    }
    if (c.opponentStamina > 0) {
      entry.received = c.intent === 'guard' ? 0 : Math.round((12 + c.opponentPower * 10 + Math.floor(roll(s, c, 'counter') * 6)) *
        (c.intent === 'rush' ? 1.35 : 1) * (action === 'defend' ? 0.25 : 1));
      c.playerStamina = Math.max(0, c.playerStamina - entry.received);
    }
    if (action === 'defend') c.opening = c.intent === 'guard' ? 6 : c.intent === 'rush' ? 20 : 14;
  }
  c.history.push(entry); c.round += 1;
  if (entry.escaped) applyResult(s, c, 'flee', events);
  else if (c.opponentStamina <= 0) applyResult(s, c, 'win', events);
  else if (c.playerStamina <= 0 || c.round >= COMBAT_MAX_ROUNDS) {
    applyResult(s, c, c.playerStamina > c.opponentStamina && c.opponentStamina < 60 ? 'win' : 'lose', events);
  } else c.intent = opponentIntent(s, c);
  const name = s.names[c.actorId];
  const text = action === 'attack' ? `${name}出手，对方架势-${entry.dealt}${entry.received ? `，承压${entry.received}` : ''}。` :
    action === 'defend' ? `${name}护住要害${entry.received ? `，承压${entry.received}` : ''}，寻找反击空当。` :
      entry.escaped ? `${name}找到了撤离的空当。` : `${name}没能脱身，承压${entry.received}。`;
  events.unshift(text);
  s.log.unshift(...events.slice().reverse());
  s.stateRevision = (s.stateRevision || 0) + 1;
  return { state: s, events, combat: c, frame: entry };
}

export function closeCombat(input, combatId) {
  const c = input.pending?.combat;
  if (!c || c.id !== combatId || c.phase !== 'resolved') return { state: input, error: '战斗还未结束或结果已经确认。' };
  const s = structuredClone(input);
  s.pending.combat = null;
  s.stateRevision = (s.stateRevision || 0) + 1;
  return { state: s, events: [] };
}

export function validateCombat(state) {
  const c = state.pending?.combat;
  const invalid = () => ({ ok: false, reason: '战斗存档无效' });
  if (c == null) return state.events?.some(e => e.status === 'combat') ? invalid() : { ok: true };
  const ev = state.events?.find(e => e.uid === c.eventUid);
  if (typeof c !== 'object' || Array.isArray(c) || !ev ||
    c.id !== `combat:${state.seed}:${c.eventUid}` || !['thugs', 'chengguan'].includes(c.kind) ||
    ev.templateId !== (c.kind === 'thugs' ? 'street_thugs' : 'chengguan_sweep') ||
    !['xuan', 'fan', 'ma'].includes(c.actorId) || c.day !== state.day || c.hourTick !== state.hourTick ||
    !['fighting', 'resolved'].includes(c.phase) || ev.status !== (c.phase === 'fighting' ? 'combat' : 'resolved') ||
    !Number.isInteger(c.round) || c.round < 0 || c.round > COMBAT_MAX_ROUNDS ||
    !Number.isInteger(c.playerStamina) || c.playerStamina < 0 || c.playerStamina > 100 ||
    !Number.isInteger(c.opponentStamina) || c.opponentStamina < 0 || c.opponentStamina > 100 ||
    ![0, 6, 14, 20].includes(c.opening) || !INTENTS.includes(c.intent) ||
    !Number.isFinite(c.power) || c.power < 0 || c.power > 2 ||
    !Number.isFinite(c.opponentPower) || c.opponentPower < C[c.kind === 'thugs' ? 'thugPower' : 'chengguanPower'][0] ||
    c.opponentPower > C[c.kind === 'thugs' ? 'thugPower' : 'chengguanPower'][1] ||
    !Array.isArray(c.allies) || new Set(c.allies).size !== c.allies.length ||
    c.allies.some(id => id === c.actorId || !['xuan', 'fan', 'ma'].includes(id)) ||
    !Array.isArray(c.history) || c.history.length !== c.round ||
    c.history.some((h, i) => !h || h.round !== i || !ACTIONS.includes(h.action) || !INTENTS.includes(h.intent) ||
      !Number.isInteger(h.dealt) || h.dealt < 0 || h.dealt > 100 || !Number.isInteger(h.received) || h.received < 0 || h.received > 100 ||
      typeof h.escaped !== 'boolean') ||
    c.phase === 'fighting' && (c.result !== null || c.round >= COMBAT_MAX_ROUNDS || c.playerStamina === 0 || c.opponentStamina === 0 || state.actors[c.actorId]?.life !== 'active') ||
    c.phase === 'resolved' && (!c.result || !['win', 'lose', 'flee'].includes(c.result.outcome) || typeof c.result.text !== 'string')) return invalid();
  return { ok: true };
}
