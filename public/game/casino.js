import { newSession, startHand, act, MAX_HANDS } from './cards.js';
import { newBlackjackSession, startBlackjackHand, blackjackAct, blackjackLocalDecision } from './blackjack.js';
import { applyCasinoTransaction, assertConservation, validateCasinoState } from './casino-contract.js';
import { casinoCandidates, casinoActionLegal, casinoAmounts, casinoTableKey, assertCasinoReplay } from './casino-replay.js';

const copy = (s) => structuredClone(s);
const fail = (state, error) => ({ state, error });
const npcIds = ['hall_lan', 'hall_qiao'];
export { casinoCandidates } from './casino-replay.js';

const same = (a, b) => a?.id === b?.id && a?.amount === b?.amount && a?.target === b?.target;
const current = (s) => { s.pending.casino.handSeq = s.pending.casino.session.handSeq; s.pending.casino.allowedActions = casinoCandidates(s.pending.casino.session); };
const mark = (s, id) => {
  const c = s.pending.casino;
  c.actionSeq++;
  c.appliedActionIds.push(id);
  s.stateRevision++;
};

function transact(s, from, to, amount, key) {
  if (!amount) return s;
  return applyCasinoTransaction(s, { actionId: `${s.pending.casino.sessionId}:${key}`, from, to, amount }).state;
}

function syncEscrow(input) {
  let s = input;
  const c = s.pending.casino;
  const cur = c.session.cur;
  if (!cur?.over) return s;
  const desired = { ...c.session.chips, ...(c.game === 'blackjack' ? { hall_dealer: c.session.bank } : {}) };
  const accounts = Object.keys(desired);
  for (const from of accounts) for (const to of accounts) {
    if (from === to) continue;
    const excess = s.pending.casino.escrow[from] - desired[from];
    const deficit = desired[to] - s.pending.casino.escrow[to];
    if (excess > 0 && deficit > 0) s = transact(s, `escrow:${from}`, `escrow:${to}`, Math.min(excess, deficit), `settle:${c.handSeq}:${from}:${to}`);
  }
  if (accounts.some((id) => s.pending.casino.escrow[id] !== desired[id])) throw new Error('牌局托管结算不平');
  return s;
}

export function openCasino(input, game, options = {}) {
  const c = input.pending.casino;
  const { buyIn, baseBet } = casinoAmounts(options);
  const tableKey = casinoTableKey(c, { buyIn, baseBet });
  let s = copy(input);
  s.pending.casino.phase = 'playing';
  s.pending.casino.game = game;
  s.pending.casino.buyIn = buyIn;
  s.pending.casino.baseBet = baseBet;
  for (const id of [c.actorId, ...npcIds]) s = transact(s, id === c.actorId ? 'cash' : `npc:${id}`, `escrow:${id}`, buyIn, `buy:${id}`);
  if (game === 'blackjack') {
    const bank = 4 * baseBet * 3;
    s = transact(s, 'dealerBank', 'escrow:hall_dealer', bank, 'dealer-reserve');
    s.pending.casino.session = newBlackjackSession({ seed: s.seed, sessionId: c.sessionId, players: [c.actorId, ...npcIds], controller: c.actorId, dealerId: 'hall_dealer', chips: { [c.actorId]: buyIn, hall_lan: buyIn, hall_qiao: buyIn }, bank, bet: baseBet,
      ...(tableKey ? { tableKey } : {}) });
    const dealt = startBlackjackHand(s.pending.casino.session);
    if (dealt.error) return fail(input, dealt.error);
    s.pending.casino.session = dealt.state;
  } else {
    const session = newSession(s, { game, stakes: 'cash', controller: c.actorId, players: [c.actorId, ...npcIds], sessionId: c.sessionId, buyIn, baseBet,
      ...(tableKey ? { tableKey } : {}) });
    startHand(s, session);
    s.pending.casino.session = session;
  }
  s.pending.casino.handSeq = s.pending.casino.session.handSeq;
  s.pending.casino.playLog = [{ kind: 'hand' }];
  s.daily.bets++;
  current(s);
  assertConservation(input, s);
  return { state: s, events: [{ type: 'casinoStarted', game, sessionId: c.sessionId }] };
}

export function casinoAct(input, action, identity = null, provenance = {}) {
  const c = input.pending?.casino;
  if (!c || c.phase !== 'playing' || !c.session?.cur || c.session.cur.over) return fail(input, '没有进行中的一手');
  try { validateCasinoState(input); assertCasinoReplay(c); } catch (error) { return fail(input, error.message); }
  if (c.playLog.length >= 1000) return fail(input, '牌局行动记录已满');
  const actor = c.session.cur.turn;
  if (identity && (identity.sessionId !== c.sessionId || identity.handSeq !== c.handSeq || identity.actionSeq !== c.actionSeq || identity.stateRevision !== input.stateRevision || identity.npcId !== actor)) return fail(input, '牌局动作已过期');
  if (!action || typeof action.id !== 'string' || !(identity ? c.allowedActions.some((candidate) => same(candidate, action)) : casinoActionLegal(c.session, action))) return fail(input, '动作或金额不合法');
  try {
  const s = copy(input);
  const session = s.pending.casino.session;
  const result = c.game === 'blackjack' ? blackjackAct(session, action.id) : act(s, session, action.id, action.amount, action.target);
  if (result.error) return fail(input, result.error);
  if (c.game === 'blackjack') s.pending.casino.session = result.state;
  s.pending.casino.playLog.push({ kind: 'act', actor, action: copy(action) });
  const actionId = `${c.sessionId}:act:${c.handSeq}:${c.actionSeq}:${actor}`;
  mark(s, actionId);
  if (actor !== c.actorId) {
    s.pending.casino.npcLine = typeof provenance.line === 'string' ? provenance.line.slice(0, 60) : '';
    s.pending.casino.npcSource = provenance.source === 'ai' || provenance.source === 'model' ? 'ai' : 'local';
  }
  let out = syncEscrow(s);
  current(out);
  assertConservation(input, out);
  return { state: out, events: [{ type: 'casinoAction', actor, action, source: out.pending.casino.npcSource }] };
  } catch (error) { return fail(input, error.message); }
}

export function localCasinoChoice(state) {
  const s = state.pending.casino.session;
  if (s.game === 'blackjack') return { id: blackjackLocalDecision(s, s.cur.turn) };
  const actions = casinoCandidates(s);
  return actions.find((a) => a.id === 'check') || actions.find((a) => a.id === 'call') || actions.find((a) => a.id === 'stand') || actions.find((a) => a.id === 'fold') || actions[0];
}

export function nextCasinoRound(input) {
  const c = input.pending?.casino;
  if (!c || c.phase !== 'playing' || !c.session?.cur?.over) return fail(input, '这一手还没结束');
  try { validateCasinoState(input); assertCasinoReplay(c); } catch (error) { return fail(input, error.message); }
  if (c.playLog.length >= 1000) return fail(input, '牌局行动记录已满');
  try {
  const s = copy(input);
  const session = s.pending.casino.session;
  if (session.done || session.handSeq >= MAX_HANDS) return fail(input, '牌局已经打完');
  if (c.game === 'blackjack') {
    const result = startBlackjackHand(session);
    if (result.error) return fail(input, result.error);
    s.pending.casino.session = result.state;
  } else startHand(s, session);
  s.pending.casino.playLog.push({ kind: 'hand' });
  current(s);
  mark(s, `${c.sessionId}:hand:${s.pending.casino.handSeq}`);
  assertConservation(input, s);
  return { state: s, events: [{ type: 'casinoHandStarted', handSeq: s.pending.casino.handSeq }] };
  } catch (error) { return fail(input, error.message); }
}

export function closeCasino(input) {
  const c = input.pending?.casino;
  if (!c) return { state: input, events: [] };
  try {
  if (c.phase !== 'invited') try { validateCasinoState(input); assertCasinoReplay(c); } catch (error) { return fail(input, error.message); }
  if (c.phase === 'settled') return { state: input, events: [] };
  if (c.phase === 'invited') {
    const s = copy(input);
    s.pending.casino = null;
    s.stateRevision++;
    return { state: s, events: [{ type: 'casinoDeclined' }] };
  }
  let s = input;
  let guard = 0;
  while (!s.pending.casino.session.cur.over && guard++ < 200) {
    const cur = s.pending.casino.session.cur;
    let action;
    if (cur.turn === s.pending.casino.actorId) action = casinoCandidates(s.pending.casino.session).find((a) => a.id === (c.game === 'blackjack' ? 'stand' : 'fold'));
    else action = localCasinoChoice(s);
    if (!action) throw new Error('牌局无法收桌');
    const result = casinoAct(s, action, null, { source: 'local', line: '收桌结算。' });
    if (result.error) throw new Error(result.error);
    s = result.state;
  }
  if (!s.pending.casino.session.cur.over) throw new Error('牌局收桌超出行动上限');
  s = syncEscrow(s);
  const balances = { ...s.pending.casino.escrow };
  for (const [id, amount] of Object.entries(balances)) {
    if (!amount) continue;
    s = transact(s, `escrow:${id}`, id === c.actorId ? 'cash' : id === 'hall_dealer' ? 'dealerBank' : `npc:${id}`, amount, `return:${id}`);
  }
  s.pending.casino.phase = 'settled';
  s.pending.casino.allowedActions = [];
  s.stateRevision++;
  validateCasinoState(s);
  assertConservation(input, s);
  return { state: s, events: [{ type: 'casinoSettled', balances }] };
  } catch (error) { return fail(input, error.message); }
}
