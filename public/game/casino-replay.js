import { newSession, startHand, act, legalActions, BUY_IN, MAX_HANDS } from './cards.js';
import { newBlackjackSession, startBlackjackHand, blackjackAct, blackjackLegalActions, BLACKJACK_BET } from './blackjack.js';

const npcIds = ['hall_lan', 'hall_qiao'];
const plain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export function casinoAmounts(options = {}) {
  if (!plain(options)) throw new Error('带入与底注必须是正整数');
  const buyIn = options.buyIn === undefined ? BUY_IN : options.buyIn;
  const baseBet = options.baseBet === undefined ? BLACKJACK_BET : options.baseBet;
  if (!Number.isSafeInteger(buyIn) || !Number.isSafeInteger(baseBet) || buyIn < 1 || baseBet < 1 ||
    baseBet > buyIn) throw new Error('带入与底注必须是正整数，且底注不超过带入');
  return { buyIn, baseBet };
}

export function casinoTableKey(c, { buyIn, baseBet }) {
  return buyIn === BUY_IN && baseBet === BLACKJACK_BET ? undefined : `${c.sessionId}:buy${buyIn}:bet${baseBet}`;
}

export function casinoCandidates(session) {
  const legal = session.game === 'blackjack' ? blackjackLegalActions(session) : legalActions(session);
  return legal.flatMap((a) => {
    if (a.targets) return a.targets.map((target) => ({ id: a.id, target }));
    if (a.min !== undefined) return [...new Set([a.min, Math.floor((a.min + a.max) / 2), a.max])].map((amount) => ({ id: a.id, amount }));
    if (a.to !== undefined) return [{ id: a.id, amount: a.to }];
    return [{ id: a.id }];
  });
}

export function casinoActionLegal(session, action) {
  if (!validAction(action)) return false;
  if (casinoCandidates(session).some((candidate) => equal(candidate, action))) return true;
  if (session.game !== 'texas' || !['bet', 'raise'].includes(action.id) ||
    Object.keys(action).sort().join(',') !== 'amount,id' || !Number.isSafeInteger(action.amount)) return false;
  return legalActions(session).some((candidate) => candidate.id === action.id &&
    action.amount >= candidate.min && action.amount <= candidate.max);
}

function equal(a, b, depth = 0) {
  if (depth > 30) return false;
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, i) => equal(value, b[i], depth + 1));
  if (!plain(a) || !plain(b)) return false;
  const keysA = Object.keys(a).sort(), keysB = Object.keys(b).sort();
  return equal(keysA, keysB, depth + 1) && keysA.every((key) => equal(a[key], b[key], depth + 1));
}

function validAction(action) {
  if (!plain(action) || typeof action.id !== 'string' || !action.id) return false;
  const keys = Object.keys(action);
  return keys.every((key) => ['id', 'amount', 'target'].includes(key)) &&
    (action.amount === undefined || Number.isSafeInteger(action.amount) && action.amount >= 0) &&
    (action.target === undefined || typeof action.target === 'string');
}

export function replayCasinoSession(casino) {
  const c = casino;
  if (!plain(c) || !['zjh', 'texas', 'blackjack'].includes(c.game) || !Array.isArray(c.playLog) ||
    c.playLog.length < 1 || c.playLog.length > 1000 || !c.playLog.every(plain)) throw new Error('牌局缺少完整行动记录');
  const amounts = casinoAmounts(c);
  const tableKey = casinoTableKey(c, amounts);
  const players = [c.actorId, ...npcIds];
  let session = c.game === 'blackjack'
    ? newBlackjackSession({ seed: c.seed, sessionId: c.sessionId, players, controller: c.actorId, dealerId: 'hall_dealer',
      chips: Object.fromEntries(players.map((id) => [id, amounts.buyIn])), bank: 4 * amounts.baseBet * players.length,
      ...(c.baseBet === undefined ? {} : { bet: amounts.baseBet }), ...(tableKey ? { tableKey } : {}) })
    : newSession({ day: c.day, seed: c.seed }, { game: c.game, stakes: 'cash', controller: c.actorId, players, sessionId: c.sessionId,
      buyIn: amounts.buyIn, ...(c.baseBet === undefined ? {} : { baseBet: amounts.baseBet }), ...(tableKey ? { tableKey } : {}) });
  if (c.playLog[0].kind !== 'hand' || Object.keys(c.playLog[0]).length !== 1) throw new Error('牌局首手记录无效');
  for (let i = 0; i < c.playLog.length; i++) {
    const step = c.playLog[i];
    if (step.kind === 'hand') {
      if (Object.keys(step).length !== 1 || i > 0 && (!session.cur?.over || session.done || session.handSeq >= MAX_HANDS)) throw new Error('牌局开手记录无效');
      if (c.game === 'blackjack') {
        const dealt = startBlackjackHand(session);
        if (dealt.error) throw new Error('牌局开手资金不足');
        session = dealt.state;
      } else startHand({ day: c.day, seed: c.seed }, session);
    } else if (step.kind === 'act') {
      if (Object.keys(step).sort().join(',') !== 'action,actor,kind' || !validAction(step.action) ||
        !session.cur || session.cur.over || step.actor !== session.cur.turn ||
        !casinoActionLegal(session, step.action)) throw new Error('牌局行动记录无效');
      const result = c.game === 'blackjack' ? blackjackAct(session, step.action.id) : act({}, session, step.action.id, step.action.amount, step.action.target);
      if (result.error) throw new Error('牌局行动规则不符');
      if (c.game === 'blackjack') session = result.state;
    } else throw new Error('牌局行动类型无效');
  }
  return session;
}

export function assertCasinoReplay(c) {
  if (c?.phase === 'invited' || !c) return true;
  const expected = replayCasinoSession(c);
  if (!equal(JSON.parse(JSON.stringify(expected)), JSON.parse(JSON.stringify(c.session)))) throw new Error('牌局会话与行动记录不符');
  if (c.handSeq !== expected.handSeq || !equal(c.allowedActions, c.phase === 'playing' ? casinoCandidates(expected) : [])) throw new Error('牌局当前行动与记录不符');
  const escrow = Object.values(c.escrow || {});
  if (escrow.length !== 6 || escrow.some((amount) => !Number.isSafeInteger(amount) || amount < 0)) throw new Error('牌局托管资金无效');
  const held = escrow.reduce((sum, amount) => sum + amount, 0);
  const pot = expected.cur?.over ? 0 : c.game === 'blackjack'
    ? Object.values(expected.cur?.bets || {}).reduce((sum, bet) => sum + bet, 0) : expected.cur?.pot || 0;
  const shadow = Object.values(expected.chips).reduce((sum, chips) => sum + chips, 0) + pot + (c.game === 'blackjack' ? expected.bank : 0);
  if (held !== (c.phase === 'playing' ? shadow : 0)) throw new Error('牌局托管与行动记录不平');
  return true;
}
